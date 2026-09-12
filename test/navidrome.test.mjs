import test from 'node:test';
import assert from 'node:assert/strict';
import {Navidrome} from '../src/navidrome.mjs';
test('matches exact file paths and creates playlist in Spotify order, retaining repeats',async()=>{
  const nav=new Navidrome('http://localhost','test','test');const calls=[];
  nav.call=async(method,params)=>{calls.push({method,params});if(method==='getScanStatus')return {scanStatus:{scanning:false}};if(method==='search3')return {searchResult3:{song:[{id:'b',path:'second.flac'},{id:'a',path:'first.flac'},{id:'wrong',path:'other.flac'}]}};if(method==='createPlaylist')return {playlist:{id:'saved'}};if(method==='getPlaylist')return {playlist:{entry:[{id:'a'},{id:'b'},{id:'a'}]}};return {};};
  const job={kind:'playlist',name:'Example',tracks:[{spotify_id:'first',status:'completed'},{spotify_id:'missing',status:'failed'},{spotify_id:'second',status:'completed'},{spotify_id:'first',status:'completed'}]};
  let saved=false;assert.equal(await nav.sync(job,()=>{saved=true;}),'saved');assert.ok(saved);
  assert.deepEqual(calls.find(c=>c.method==='createPlaylist').params.songId,['a','b','a']);
  calls.length=0;await nav.sync(job);assert.equal(calls.find(c=>c.method==='createPlaylist').params.playlistId,'saved');
});
test('does not report success if Navidrome changes playlist contents',async()=>{
  const nav=new Navidrome('http://localhost','test','test');
  nav.call=async m=>m==='getScanStatus'?{scanStatus:{scanning:false}}:m==='search3'?{searchResult3:{song:[{id:'a',path:'first.flac'}]}}:m==='createPlaylist'?{playlist:{id:'saved'}}:m==='getPlaylist'?{playlist:{entry:[]}}:{};
  const job={kind:'playlist',name:'Example',tracks:[{spotify_id:'first',status:'completed'}]};
  await assert.rejects(nav.sync(job),/verification failed/);assert.equal(job.playlistId,'saved');
});
