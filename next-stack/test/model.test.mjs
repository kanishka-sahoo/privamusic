import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {Store,spotifyInput,metadata} from '../src/model.mjs';
const id='5FwoQeE2v5BGBvNj4JvdWl';
test('accepts Spotify media URLs, strips tracking, rejects other origins and paths',()=>{
  assert.deepEqual(spotifyInput(`https://open.spotify.com/playlist/${id}?si=tracking`),{kind:'playlist',spotifyId:id,url:`https://open.spotify.com/playlist/${id}`});
  for(const url of [`http://open.spotify.com/playlist/${id}`,`https://open.spotify.com.evil.test/playlist/${id}`,`https://open.spotify.com@evil.test/playlist/${id}`,`https://open.spotify.com:444/playlist/${id}`,`file:///playlist/${id}`,`https://open.spotify.com/artist/${id}`,`https://open.spotify.com/track/short`])assert.throws(()=>spotifyInput(url));
});
test('understands the native playlist owner nesting and preserves order',()=>{
  const track={spotify_id:'1uySv0BiiI8hqcAXCCacsd',name:'Remedy'};
  const result=metadata(JSON.stringify({playlist_info:{owner:{name:'Gym',images:'cover'}},track_list:[track,track]}),'playlist');
  assert.equal(result.name,'Gym');assert.equal(result.cover,'cover');assert.equal(result.tracks.length,2);assert.equal(result.tracks[0].status,'queued');
  assert.throws(()=>metadata('{"track_list":[]}','playlist'));
});
test('recovers interrupted jobs while retaining completed tracks and playlist IDs',()=>{
  const dir=mkdtempSync(`${tmpdir()}/privamusic-test-`);
  const store=new Store(`${dir}/queue.db`);
  const job=store.add(`https://open.spotify.com/playlist/${id}`);
  Object.assign(job,{status:'downloading',playlistId:'existing',tracks:[{status:'completed'},{status:'downloading'}]});store.save(job);store.db.close();
  const reopened=new Store(`${dir}/queue.db`);reopened.recover();const recovered=reopened.get(job.id);
  assert.equal(recovered.status,'queued');assert.equal(recovered.playlistId,'existing');assert.deepEqual(recovered.tracks.map(t=>t.status),['completed','queued']);
  reopened.db.close();rmSync(dir,{recursive:true});
});
