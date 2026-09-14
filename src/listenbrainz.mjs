// ListenBrainz discovery feeds: Weekly Jams, Daily Jams and Weekly Exploration are playlists that ListenBrainz
// generates for a user. Each new edition becomes a queue job whose MusicBrainz recordings are mapped to Spotify
// tracks (ListenBrainz Labs), downloaded through the normal worker, and published to one Navidrome playlist per
// feed that is updated in place. Scrobbling itself is done by Navidrome's built-in ListenBrainz scrobbler.
import {randomUUID} from 'node:crypto';
import {metadata} from './model.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const FEEDS={'weekly-jams':'Weekly Jams','daily-jams':'Daily Jams','weekly-exploration':'Weekly Exploration'};
const JSPF='https://musicbrainz.org/doc/jspf#';
const API='https://api.listenbrainz.org/1';
const LABS='https://labs.api.listenbrainz.org';
const MB='https://musicbrainz.org/ws/2';
const UA='PrivaMusic/1.0 (ListenBrainz discovery feeds)';
export function feedList(value){
  const feeds=[...new Set(String(value??'').split(',').map(s=>s.trim()).filter(Boolean))];
  if(!feeds.length)return Object.keys(FEEDS);
  for(const feed of feeds)if(!FEEDS[feed])throw Error(`Unknown ListenBrainz feed "${feed}". Use ${Object.keys(FEEDS).join(', ')}`);
  return feeds;
}
// Newest edition of each wanted feed in a "created for" listing.
export function latestEditions(playlists,feeds){
  const latest={};
  for(const entry of playlists||[]){
    const p=entry?.playlist||entry;const ext=p?.extension?.[JSPF+'playlist'];
    const feed=ext?.additional_metadata?.algorithm_metadata?.source_patch;
    const mbid=String(p?.identifier||'').match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i)?.[1];
    if(!feeds.includes(feed)||!mbid)continue;
    const edition={feed,mbid,title:p.title||FEEDS[feed],date:p.date||ext.last_modified_at||null,url:`https://listenbrainz.org/playlist/${mbid}/`};
    if(!latest[feed]||Date.parse(edition.date)>Date.parse(latest[feed].date))latest[feed]=edition;
  }
  return Object.values(latest);
}
export function jspfTracks(jspf){
  const p=jspf?.playlist||jspf;
  if(!Array.isArray(p?.track))throw Error('ListenBrainz returned no tracks');
  return p.track.map(t=>({
    mbid:(Array.isArray(t.identifier)?t.identifier:[t.identifier]).map(i=>String(i||'').match(/recording\/([0-9a-f-]{36})/i)?.[1]).find(Boolean)||null,
    title:String(t.title||''),artist:String(t.creator||''),album:String(t.album||''),duration:Number(t.duration)||0,
  }));
}
export class ListenBrainz {
  musicbrainzDelay=1100;
  constructor(user,token='',fetchImpl=fetch){
    if(!/^[A-Za-z0-9._-]{1,64}$/.test(user||''))throw Error('LISTENBRAINZ_USER must be a ListenBrainz user name');
    Object.assign(this,{user,token:String(token||'').trim(),fetch:fetchImpl});
  }
  async request(url,body){
    const headers={'User-Agent':UA,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{}),...(this.token&&url.startsWith(API)?{Authorization:`Token ${this.token}`}:{})};
    let r;
    for(let attempt=0;attempt<3;attempt++){
      r=await this.fetch(url,{method:body?'POST':'GET',headers,body,signal:AbortSignal.timeout(30000)});
      if(![429,502,503,504].includes(r.status)||attempt===2)break;
      await r.body?.cancel();await sleep(Number(r.headers.get('retry-after'))*1000||2000*(attempt+1));
    }
    if(r.status===401)throw Error('ListenBrainz rejected the token');
    if(r.status===404)throw Error(url.startsWith(API)?'ListenBrainz user or playlist not found':url.startsWith(MB)?'MusicBrainz recording not found':'ListenBrainz Labs endpoint not found');
    if(!r.ok)throw Error(`ListenBrainz returned ${r.status}`);
    return r.json();
  }
  async createdFor(){return (await this.request(`${API}/user/${encodeURIComponent(this.user)}/playlists/createdfor?count=50`)).playlists||[];}
  async playlist(mbid){return jspfTracks(await this.request(`${API}/playlist/${mbid}`));}
  // Spotify links that MusicBrainz editors attached to the recording itself. One request per second, as MusicBrainz asks.
  async musicbrainzSpotifyIds(mbid){
    const data=await this.request(`${MB}/recording/${mbid}?inc=url-rels&fmt=json`);
    return (data.relations||[]).map(r=>String(r.url?.resource||'').match(/^https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]{22})/)?.[1]).filter(Boolean);
  }
  // Last resort for a recording: Spotify album links on its MusicBrainz releases, plus its ISRCs to pick the track.
  async albumHints(mbid,maxReleases=3){
    const rec=await this.request(`${MB}/recording/${mbid}?inc=releases+isrcs&fmt=json`);
    const albums=[];
    for(const release of (rec.releases||[]).slice(0,maxReleases)){
      await sleep(this.musicbrainzDelay);
      let rel;try{rel=await this.request(`${MB}/release/${release.id}?inc=url-rels&fmt=json`);}catch{continue;}
      for(const r of rel.relations||[]){const id=String(r.url?.resource||'').match(/^https:\/\/open\.spotify\.com\/album\/([A-Za-z0-9]{22})/)?.[1];if(id&&!albums.includes(id))albums.push(id);}
      if(albums.length>=2)break;
    }
    return {albums,isrcs:rec.isrcs||[]};
  }
  // Spotify track IDs per recording, aligned with `tracks`: ListenBrainz Labs by MBID, MusicBrainz URL relationships,
  // then Labs by artist/release/title.
  async spotifyIds(tracks){
    const ids=tracks.map(()=>[]);
    const byMbid=new Map();
    const withMbid=tracks.filter(t=>t.mbid);
    for(let i=0;i<withMbid.length;i+=50){
      const chunk=withMbid.slice(i,i+50);
      for(const row of await this.request(`${LABS}/spotify-id-from-mbid/json`,JSON.stringify(chunk.map(t=>({recording_mbid:t.mbid})))))byMbid.set(row.recording_mbid,(row.spotify_track_ids||[]).filter(valid));
    }
    tracks.forEach((t,i)=>{ids[i]=byMbid.get(t.mbid)||[];});
    let first=true;
    for(const i of tracks.map((t,i)=>i).filter(i=>!ids[i].length&&tracks[i].mbid)){
      if(!first)await sleep(this.musicbrainzDelay);first=false;
      try{ids[i]=await this.musicbrainzSpotifyIds(tracks[i].mbid);}catch{}
    }
    // Then by metadata: the full artist credit first, then the primary artist for "A feat. B" credits.
    const primary=artist=>artist.split(/\s+(?:feat\.?|ft\.?|featuring|with|&|x)\s+/i)[0];
    const passes=[t=>t.artist,t=>primary(t.artist)!==t.artist?primary(t.artist):''];
    for(const artistOf of passes){
      const missing=tracks.map((t,i)=>i).filter(i=>!ids[i].length&&tracks[i].title&&artistOf(tracks[i]));
      for(let i=0;i<missing.length;i+=50){
        const chunk=missing.slice(i,i+50);
        const rows=await this.request(`${LABS}/spotify-id-from-metadata/json`,JSON.stringify(chunk.map(i=>({artist_name:artistOf(tracks[i]),release_name:tracks[i].album,track_name:tracks[i].title}))));
        if(Array.isArray(rows)&&rows.length===chunk.length)rows.forEach((row,n)=>{ids[chunk[n]]=(row.spotify_track_ids||[]).filter(valid);});
      }
    }
    return ids;
  }
}
const valid=id=>/^[A-Za-z0-9]{22}$/.test(String(id));
export class Discover {
  lastCheck=null; lastError=null; nextCheck=null; checking=false; lookupDelay=1000;
  constructor(store,client,feeds=Object.keys(FEEDS),interval=7200000){Object.assign(this,{store,client,feeds,interval});}
  get enabled(){return !!this.client;}
  feedJobs(feed){return this.store.list().filter(j=>j.kind==='listenbrainz'&&j.feed===feed);}
  status(){
    return {enabled:this.enabled,user:this.client?.user||null,lastCheck:this.lastCheck,lastError:this.lastError,nextCheck:this.nextCheck,checking:this.checking,
      feeds:this.feeds.map(feed=>{const jobs=this.feedJobs(feed);const last=jobs[0];return {feed,name:FEEDS[feed],jobId:last?.id||null,edition:last?.edition||null,status:last?.status||null,importedAt:last?.createdAt||null,playlistId:jobs.find(j=>j.playlistId)?.playlistId||null};})};
  }
  // Queue one job per feed edition that has not been imported yet. Returns the new jobs.
  async check(){
    if(!this.client)throw Error('ListenBrainz is not configured. Set LISTENBRAINZ_USER in .env and redeploy.');
    if(this.checking)return [];
    this.checking=true;
    try{
      const created=[];
      for(const e of latestEditions(await this.client.createdFor(),this.feeds)){
        const jobs=this.feedJobs(e.feed);
        if(jobs.some(j=>j.source?.mbid===e.mbid))continue;
        // The Navidrome playlist ID carries over so the feed's playlist is replaced, not duplicated.
        created.push(this.store.save({id:randomUUID(),kind:'listenbrainz',feed:e.feed,url:e.url,source:{mbid:e.mbid,date:e.date},name:FEEDS[e.feed],edition:e.title,cover:'',status:'queued',tracks:[],createdAt:new Date().toISOString(),error:null,playlistId:jobs.find(j=>j.playlistId)?.playlistId||null}));
      }
      this.lastCheck=new Date().toISOString();this.lastError=null;
      return created;
    }catch(e){this.lastError=e.message;throw e;}
    finally{this.checking=false;}
  }
  async start(){
    for(;;){
      try{const created=await this.check();if(created.length)console.log(`ListenBrainz: queued ${created.map(j=>j.edition).join('; ')}`);}
      catch(e){console.error('ListenBrainz: '+e.message);}
      this.nextCheck=new Date(Date.now()+this.interval).toISOString();
      await sleep(this.interval);
    }
  }
  // Worker hook: the feed's recordings as Spotify track metadata. `lookup` resolves one Spotify URL through the
  // native app; `known` are already downloaded tracks, reused by Spotify ID or ISRC so nothing is fetched twice.
  async resolve(job,lookup,known=[]){
    const sources=await this.client.playlist(job.source.mbid);
    if(!sources.length)throw Error('ListenBrainz playlist is empty');
    return this.match(sources,lookup,known);
  }
  // Retry hook: look again for tracks that had no Spotify match, e.g. after MusicBrainz gained a link.
  async rematch(job,lookup,known=[]){
    const skipped=job.tracks.map((t,i)=>i).filter(i=>job.tracks[i].status==='skipped');
    if(!skipped.length)return 0;
    const sources=skipped.map(i=>{const t=job.tracks[i];return {mbid:t.mbid||null,title:t.name||'',artist:t.artists||'',album:t.album_name||'',duration:t.duration_ms||0};});
    const found=await this.match(sources,lookup,known);
    let matched=0;
    found.forEach((t,n)=>{if(t.status!=='skipped'){job.tracks[skipped[n]]=t;matched++;}});
    return matched;
  }
  async match(sources,lookup,known){
    const ids=await this.client.spotifyIds(sources);
    const byId=new Map(known.map(t=>[t.spotify_id,t])),byIsrc=new Map(known.filter(t=>t.isrc).map(t=>[t.isrc,t]));
    let lookups=0;
    const fetch=async url=>{if(lookups++)await sleep(this.lookupDelay);return lookup(url);};
    const resolved=[];
    for(let i=0;i<sources.length;i++){
      const source=sources[i];
      let track=byId.get(ids[i].find(id=>byId.has(id)));
      try{
        if(!track&&ids[i].length)track=metadata(await fetch(`https://open.spotify.com/track/${ids[i][0]}`),'track').tracks[0];
        if(!track&&source.mbid)track=await this.fromAlbums(source,fetch);
      }catch(e){throw Error(`Spotify lookup failed for "${source.artist} - ${source.title}": ${e.message}`);}
      if(!track){resolved.push({spotify_id:null,mbid:source.mbid,name:source.title,artists:source.artist,album_name:source.album,duration_ms:source.duration,status:'skipped',error:'No Spotify match for this recording'});continue;}
      if(track.isrc&&byIsrc.has(track.isrc))track=byIsrc.get(track.isrc);
      resolved.push({...track,mbid:source.mbid,status:'queued',error:null,rateLimitAttempts:0});
    }
    return resolved;
  }
  // Album fallback: the Spotify albums linked from the recording's releases, searched by ISRC and then by title.
  async fromAlbums(source,fetch){
    let hints;try{hints=await this.client.albumHints(source.mbid);}catch{return null;}
    for(const album of hints.albums){
      let tracks;try{tracks=metadata(await fetch(`https://open.spotify.com/album/${album}`),'album').tracks;}catch{continue;}
      const byIsrc=tracks.find(t=>t.isrc&&hints.isrcs.includes(t.isrc));
      if(byIsrc)return byIsrc;
      const wanted=normalize(source.title);
      const byTitle=tracks.find(t=>normalize(t.name)===wanted&&(!source.duration||!t.duration_ms||Math.abs(t.duration_ms-source.duration)<=5000));
      if(byTitle)return byTitle;
    }
    return null;
  }
}
const normalize=title=>String(title||'').toLowerCase().replace(/\s*[\(\[].*?[\)\]]/g,'').replace(/\s+-\s+.*$/,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
