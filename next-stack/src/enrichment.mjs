import {mkdtemp,writeFile,rename,rm,chmod} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export async function inspectAudio(file){
  const {stdout}=await exec(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-show_format','-show_streams','-of','json',file],{maxBuffer:4*1024*1024});
  return JSON.parse(stdout);
}
export function ffmetadata(tags){return ';FFMETADATA1\n'+Object.entries(tags).map(([k,v])=>`${escape(k)}=${escape(v)}`).join('\n')+'\n';}
function escape(value){return String(value).replace(/\\/g,'\\\\').replace(/[=;#\n]/g,c=>'\\'+c).replace(/\r/g,'');}
async function download(url,maxBytes){
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'PrivaMusic/1.0 (music library metadata sync)'}});
  if(r.status===404)return null;
  if(!r.ok)throw Error(`Metadata source returned ${r.status}`);
  let size=0;const chunks=[];
  for await(const chunk of r.body){size+=chunk.length;if(size>maxBytes)throw Error('Metadata response too large');chunks.push(chunk);}
  return Buffer.concat(chunks);
}
// Remux only: preserve FLAC audio and all existing tags. Never replace existing artwork/lyrics.
export async function enrichAudio(file,track,{fetchCover,fetchLyrics}={}){
  const info=await inspectAudio(file);const tags=info.format.tags||{};
  let artwork=info.streams.some(s=>s.disposition?.attached_pic),lyrics=Object.entries(tags).find(([k])=>k.toUpperCase()==='LYRICS')?.[1]||'';
  const warnings=[];let cover=null,newLyrics='';
  if(!artwork)try{
    const raw=Array.isArray(track.images)?track.images[0]?.url:track.images;
    if(raw){const url=new URL(raw);if(url.protocol!=='https:'||url.hostname!=='i.scdn.co'||url.port||url.username||url.password)throw Error('Unsupported artwork URL');cover=await (fetchCover||download)(url,10*1024*1024);}
  }catch(e){warnings.push(`Artwork: ${e.message}`);}
  if(!lyrics)try{
    const url=new URL('https://lrclib.net/api/get');
    url.search=new URLSearchParams({track_name:track.name||tags.TITLE||'',artist_name:track.artists||tags.ARTIST||'',album_name:track.album_name||tags.ALBUM||'',duration:String(Math.round(Number(info.format.duration)))});
    const raw=await (fetchLyrics||download)(url,1024*1024);const data=raw?JSON.parse(raw):null;
    if(data&&!data.instrumental&&Math.abs(Number(data.duration)-Number(info.format.duration))<=3)newLyrics=data.syncedLyrics||data.plainLyrics||'';
  }catch(e){warnings.push(`Lyrics: ${e.message}`);}
  if(cover||newLyrics){
    const work=await mkdtemp(join(dirname(file),'.metadata-'));
    try{
      const args=['-v','error','-nostdin','-i',file];
      if(cover){await writeFile(join(work,'cover'),cover);args.push('-i',join(work,'cover'));}
      await writeFile(join(work,'tags'),ffmetadata({...tags,...(newLyrics?{LYRICS:newLyrics}:{})}));
      args.push('-f','ffmetadata','-i',join(work,'tags'),'-map','0:a','-map',cover?'1:v':'0:v?','-map_metadata',cover?'2':'1','-c','copy');
      if(cover)args.push('-disposition:v:0','attached_pic');
      const output=join(work,'enriched.flac');args.push(output);
      await exec(process.env.FFMPEG_PATH||'ffmpeg',args,{timeout:120000,maxBuffer:1024*1024});
      const checked=await inspectAudio(output);
      if(!checked.streams.some(s=>s.codec_name==='flac')||Math.abs(Number(checked.format.duration)-Number(info.format.duration))>0.1)throw Error('Enriched audio verification failed');
      if(cover&&!checked.streams.some(s=>s.disposition?.attached_pic))throw Error('Cover embedding failed');
      if(newLyrics&&checked.format.tags?.LYRICS!==newLyrics)throw Error('Lyrics embedding failed');
      await chmod(output,0o644);await rename(output,file);artwork=artwork||!!cover;lyrics=lyrics||newLyrics;
    }finally{await rm(work,{recursive:true,force:true});}
  }
  if(lyrics){const sidecar=file.replace(/\.flac$/,'.lrc');await writeFile(sidecar+'.part',lyrics,{mode:0o644});await rename(sidecar+'.part',sidecar);}
  return {artwork,lyrics:lyrics?(/^\[\d+:\d+/m.test(lyrics)?'synced':'plain'):'unavailable',warnings};
}
