import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {enrichAudio,inspectAudio} from '../src/enrichment.mjs';
let available=true;try{execFileSync('ffmpeg',['-version']);}catch{available=false;}
test('enrichment preserves audio and tags, embeds cover and timed lyrics, and is idempotent',{skip:!available},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'enrichment-'));
 try{
  const file=join(dir,'song.flac'),cover=join(dir,'cover.png');
  execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-metadata','TITLE=Test = # ; song','-c:a','flac',file]);
  execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=red:s=32x32','-frames:v','1','-threads','1',cover]);
  const hash=()=>execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:a','-f','hash','-hash','sha256','-']).toString();
  const before=hash(),lyrics='[00:00.00]Test = # ; \\ words\n[00:01.00]Second line';
  const result=await enrichAudio(file,{images:'https://i.scdn.co/image/test'},{fetchCover:()=>readFile(cover),fetchLyrics:async()=>JSON.stringify({duration:2,syncedLyrics:lyrics})});
  assert.equal(result.artwork,true);assert.equal(result.lyrics,'synced');assert.equal(hash(),before);
  assert.equal((await inspectAudio(file)).format.tags.TITLE,'Test = # ; song');assert.equal(await readFile(join(dir,'song.lrc'),'utf8'),lyrics);
  const mtime=(await stat(file)).mtimeMs;
  await enrichAudio(file,{}, {fetchLyrics:()=>{throw Error('Should not refetch');}});
  assert.equal((await stat(file)).mtimeMs,mtime);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('unavailable metadata leaves the audio untouched and reports source errors',{skip:!available},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'enrichment-'));
 try{
  const file=join(dir,'song.flac');
  execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=duration=2','-c:a','flac',file]);
  const before=await readFile(file);
  const result=await enrichAudio(file,{images:'https://i.scdn.co/image/test'},{fetchCover:async()=>{throw Error('offline');},fetchLyrics:async()=>JSON.stringify({duration:30,plainLyrics:'Wrong recording'})});
  assert.deepEqual(await readFile(file),before);assert.equal(result.artwork,false);assert.equal(result.lyrics,'unavailable');assert.deepEqual(result.warnings,['Artwork: offline']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
