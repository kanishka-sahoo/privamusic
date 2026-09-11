import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
export function spotifyInput(value){
  let u;try{u=new URL(value);}catch{throw Error('Enter a Spotify playlist, album, or track URL');}
  const match=u.pathname.match(/^\/(playlist|album|track)\/([A-Za-z0-9]{22})\/?$/);
  if(u.protocol!=='https:'||u.hostname!=='open.spotify.com'||u.port||u.username||u.password||!match)throw Error('Use an https://open.spotify.com playlist, album, or track link');
  return {kind:match[1],spotifyId:match[2],url:`https://open.spotify.com/${match[1]}/${match[2]}`};
}
export function metadata(raw,kind){
  const data=typeof raw==='string'?JSON.parse(raw):raw;
  if(data.error)throw Error(String(data.error));
  const info=data.playlist_info||data.album_info||data.track;
  const tracks=kind==='track'?[data.track]:data.track_list;
  if(!info||!Array.isArray(tracks)||!tracks.length)throw Error('Spotify returned no downloadable tracks');
  if(tracks.length>2000)throw Error('Collections are limited to 2,000 tracks');
  return {name:info.name||info.owner?.name||'Spotify collection',cover:info.images||info.owner?.images||info.cover||'',tracks:tracks.map(t=>{
    if(!t||!String(t.spotify_id).match(/^[A-Za-z0-9]{22}$/))throw Error('Spotify returned an unsupported track');
    return {...t,status:'queued',error:null};
  })};
}
export class Store {
  constructor(path){this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, data TEXT NOT NULL);');}
  list(){return this.db.prepare('SELECT data FROM jobs ORDER BY rowid DESC').all().map(r=>JSON.parse(r.data));}
  get(id){const row=this.db.prepare('SELECT data FROM jobs WHERE id=?').get(id);return row?JSON.parse(row.data):null;}
  save(job){job.updatedAt=new Date().toISOString();this.db.prepare('INSERT INTO jobs VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(job.id,JSON.stringify(job));return job;}
  add(input){return this.save({id:randomUUID(),...spotifyInput(input),name:'Reading Spotify…',status:'queued',tracks:[],createdAt:new Date().toISOString(),error:null,playlistId:null});}
  recover(){for(const job of this.list())if(['resolving','downloading','syncing'].includes(job.status)){job.status='queued';for(const t of job.tracks)if(t.status==='downloading')t.status='queued';this.save(job);}}
}
