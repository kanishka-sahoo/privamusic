import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/model.mjs';
import {Worker} from '../src/worker.mjs';
for(const attempts of [0,3,5])test(`native 429 pauses the queue with persisted backoff (previous attempts ${attempts})`,async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rate-limit-'));const old=process.env.DATA_DIR;process.env.DATA_DIR=dir;
 const store=new Store(join(dir,'queue.db'));
 try{
  const job=store.add('https://open.spotify.com/playlist/5FwoQeE2v5BGBvNj4JvdWl');
  job.tracks=[{spotify_id:'a'.repeat(22),name:'Test',rateLimitAttempts:attempts},{spotify_id:'b'.repeat(22),status:'queued'}];store.save(job);
  let calls=0;
  const worker=new Worker(store,{call:async()=>{calls++;return {success:false,message:'odesli api returned status 429: TOO_MANY_REQUESTS'};}},{sync:async()=>assert.fail('No files to sync')},join(dir,'music'));
  const before=Date.now();await worker.run(job);const saved=store.get(job.id);
  assert.equal(calls,1);assert.equal(saved.tracks[1].status,'queued');assert.equal(saved.tracks[0].rateLimitAttempts,attempts+1);
  assert.equal(saved.status,attempts<5?'queued':'failed');assert.ok(saved.retryAt>=before+Math.min(900000,60000*2**attempts));
  const retryAt=saved.retryAt;store.recover();assert.equal(store.get(job.id).retryAt,retryAt);
 }finally{store.db.close();if(old===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=old;await rm(dir,{recursive:true,force:true});}
});
