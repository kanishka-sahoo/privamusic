import {mkdir,stat,rename,rm,realpath,copyFile,chmod} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {metadata} from './model.mjs';
import {enrichAudio} from './enrichment.mjs';
const exec=promisify(execFile);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function verifyAudio(path,expectedMs=0){
  const {stdout}=await exec(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name','-of','json',path],{timeout:30000,maxBuffer:1024*1024});
  const info=JSON.parse(stdout);const duration=Number(info.format?.duration);
  if(!info.streams?.some(s=>s.codec_type==='audio'&&s.codec_name==='flac')||!Number.isFinite(duration)||duration<1)throw Error('Downloaded file is not valid FLAC audio');
  if(expectedMs&&Math.abs(duration-expectedMs/1000)>Math.max(10,expectedMs/1000*0.08))throw Error('Downloaded audio duration does not match Spotify');
  return {bytes:(await stat(path)).size,duration};
}
export class Worker {
  progress=null; halted=false;
  constructor(store,bridge,nav,music){Object.assign(this,{store,bridge,nav,music});store.recover();}
  save(job){if(this.store.get(job.id)?.cancelRequested)job.cancelRequested=true;return this.store.save(job);}
  async enrich(file,track){
    try{track.enrichment=await enrichAudio(file,track);}catch(e){track.enrichment={warnings:[e.message]};}
  }
  async start(){
    await mkdir(this.music,{recursive:true});
    for(;;){
      const job=this.store.list().reverse().find(j=>j.status==='queued');
      if(job&&this.bridge.connected&&!this.halted)await this.run(job);
      await sleep(1000);
    }
  }
  async run(job){
    try{
      job.error=null;job.cancelRequested=false;
      if(!job.tracks.length){job.status='resolving';this.save(job);Object.assign(job,metadata(await this.bridge.call('GetSpotifyMetadata',[{url:job.url}]),job.kind));}
      job.status='downloading';this.save(job);
      for(const t of job.tracks){
        if(this.store.get(job.id)?.cancelRequested){
          if(job.tracks.some(t=>t.status==='completed')){job.status='syncing';this.save(job);await this.nav.sync(job,()=>this.save(job));}
          job.status='cancelled';this.save(job);return;
        }
        const target=resolve(this.music,`${t.spotify_id}.flac`);
        try{
          try{Object.assign(t,await verifyAudio(target,t.duration_ms),{status:'completed',error:null});await this.enrich(target,t);this.save(job);continue;}catch{}
          t.status='downloading';t.error=null;this.save(job);
          const stage=resolve(process.env.DATA_DIR||'/data','staging',job.id,t.spotify_id);await mkdir(stage,{recursive:true});
          let polling=false;
          const timer=setInterval(async()=>{if(polling)return;polling=true;try{this.progress=await this.bridge.call('GetDownloadProgress',[],5000);}catch{}finally{polling=false;}},1000);
          let result;
          try{result=await this.bridge.call('DownloadTrack',[{
            service:'tidal',spotify_id:t.spotify_id,track_name:t.name,artist_name:t.artists,album_name:t.album_name,album_artist:t.album_artist,
            release_date:t.release_date,cover_url:t.images,isrc:t.isrc,copyright:t.copyright,publisher:t.publisher,composer:t.composer,
            spotify_track_number:t.track_number,spotify_disc_number:t.disc_number,spotify_total_tracks:t.total_tracks,spotify_total_discs:t.total_discs,
            duration:Math.round(t.duration_ms/1000),output_dir:stage,filename_format:'{artist} - {title}',audio_format:'LOSSLESS',
            item_id:`${job.id}-${t.spotify_id}`,allow_fallback:true,embed_lyrics:true,embed_cover:true,ext_lrclib:true,tidal_embed_lyrics:true,amazon_embed_lyrics:true,
          }],600000);}finally{clearInterval(timer);this.progress=null;}
          if(!result?.success||!result.file)throw Error(result?.message||'Native download failed');
          const file=await realpath(result.file);const root=await realpath(stage);
          if(!file.startsWith(root+sep))throw Error('Native app returned a file outside the staging directory');
          Object.assign(t,await verifyAudio(file,t.duration_ms));
          const temporary=target+'.part';await copyFile(file,temporary);await chmod(temporary,0o644);await rename(temporary,target);await rm(stage,{recursive:true,force:true});
          await this.enrich(target,t);t.status='completed';
        }catch(e){t.status='failed';t.error=e.message;if(/timed out|disconnected/.test(e.message)){this.halted=true;throw e;}}
        this.save(job);
      }
      const done=job.tracks.filter(t=>t.status==='completed').length;
      if(done){job.status='syncing';this.save(job);await this.nav.sync(job,()=>this.save(job));}
      job.status=done===job.tracks.length?'completed':done?'partial':'failed';
      if(!done)job.error='No tracks downloaded. Open track details for the provider errors.';
    }catch(e){job.status='failed';job.error=e.message;}
    finally{this.save(job);this.progress=null;}
  }
}
