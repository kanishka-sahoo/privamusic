// Run inside the dashboard container via stdin: node --input-type=module < this-file.
import {Store} from './src/model.mjs';
import {Navidrome} from './src/navidrome.mjs';
import {readdir,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const exec=promisify(execFile);
const store=new Store('/data/queue.db');
const nav=new Navidrome(process.env.NAVIDROME_URL,process.env.DASHBOARD_USER,process.env.NAVIDROME_PASSWORD||process.env.DASHBOARD_PASSWORD);
const job=store.list().find(j=>j.kind==='playlist'&&j.playlistId);
assert.ok(job,'A synced playlist is required');
const before=job.playlistId;
await nav.sync(job,()=>store.save(job));assert.equal(job.playlistId,before);
const list=(await nav.call('getPlaylist',{id:job.playlistId})).playlist;
const expected=job.tracks.filter(t=>t.status==='completed').map(t=>`/music/${t.spotify_id}.flac`);
assert.deepEqual(list.entry.map(t=>t.path),expected);
const files=(await readdir('/music')).filter(p=>p.endsWith('.flac'));
let bytes=0;
for(const f of files){await exec('/root/.local/share/spotiflac-next/ffmpeg',['-v','error','-xerror','-i',`/music/${f}`,'-map','0:a:0','-f','null','-'],{timeout:60000,maxBuffer:1024*1024});bytes+=(await stat(`/music/${f}`)).size;}
console.log(JSON.stringify({playlistId:job.playlistId,playlistName:list.name,verifiedEntries:list.entry.length,orderMatches:true,retryKeptPlaylistId:true,decodedFiles:files.length,bytes},null,2));
