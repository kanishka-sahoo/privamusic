import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
process.env.TMPDIR ||=new URL('../build/tmp/',import.meta.url).pathname;mkdirSync(process.env.TMPDIR,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}});let polls=0;
 const jobs=[0,1].map(i=>({id:`job-${i}`,name:`Playlist ${i}`,kind:'playlist',status:'downloading',done:1,failed:0,tracks:Array.from({length:150},(_,n)=>({spotify_id:String(n),name:`Song ${n}`,artists:'Artist',status:'queued'}))}));
 await page.route('http://scroll.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/state'){polls++;return route.fulfill({json:{connected:true,navReady:true,navidromePort:4533,jobs:jobs.map(j=>({...j,done:polls}))}});}
  const file=path==='/'?'index.html':path.slice(1);
  if(!['index.html','app.js','style.css'].includes(file))return route.fulfill({status:404});
  return route.fulfill({body:readFileSync(new URL(`../web/${file}`,import.meta.url),'utf8')+(file==='app.js'?'\nwindow.testRender=render;':''),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
 });
 await page.goto('http://scroll.test/');await page.locator('details').first().waitFor();
 const before=await page.evaluate(()=>{document.querySelectorAll('details').forEach((d,i)=>{d.open=true;d.querySelector('.track-list').scrollTop=700+i*400;});window.scrollTo(0,600);return {lists:[...document.querySelectorAll('.track-list')].map(e=>e.scrollTop),y:scrollY};});
 await page.evaluate(()=>{window.retained={card:document.querySelector('.job'),bar:document.querySelector('[role=progressbar] > div'),list:document.querySelector('.track-list'),row:document.querySelector('.track')};});
 const initial=polls;await page.waitForFunction(()=>document.querySelector('.job-footer')?.textContent.includes('collected'));
 while(polls<initial+3)await page.waitForTimeout(250);
 const after=await page.evaluate(()=>({lists:[...document.querySelectorAll('.track-list')].map(e=>e.scrollTop),y:scrollY}));
 assert.deepEqual(after,before);assert.equal(await page.locator('details[open]').count(),2);
 assert.equal(await page.evaluate(()=>retained.card===document.querySelector('.job')&&retained.bar===document.querySelector('[role=progressbar] > div')&&retained.list===document.querySelector('.track-list')&&retained.row===document.querySelector('.track')),true,'Refresh must retain existing DOM nodes');
 const changed=jobs.map(j=>({...j,status:'partial',done:12,failed:1,error:'Provider unavailable',tracks:j.tracks.map((t,i)=>i? t:{...t,status:'failed',error:'Test failure'})}));
 await page.evaluate(jobs=>testRender({connected:true,navReady:true,navidromePort:4533,jobs}),changed);
 assert.equal(await page.locator('.track .error').first().textContent(),'Test failure');
 assert.equal(await page.locator('.job-footer button').first().textContent(),'Retry');
 assert.equal(await page.evaluate(()=>retained.list===document.querySelector('.track-list')&&retained.row===document.querySelector('.track')),true);
 await page.waitForTimeout(500);
 await page.evaluate(jobs=>testRender({connected:true,navReady:true,navidromePort:4533,jobs}),changed);
 assert.equal(await page.evaluate(()=>retained.bar.getAnimations().length),0,'Unchanged progress must not restart its animation');
 await page.evaluate(()=>window.scrollBeforeInsert=retained.list.scrollTop);
 await page.evaluate(jobs=>testRender({connected:true,navReady:true,navidromePort:4533,jobs:[{...jobs[0],id:'new-job'},...jobs]}),changed);
 assert.equal(await page.evaluate(()=>retained.card===document.querySelector('[data-job-id="job-0"]')&&retained.list.scrollTop===scrollBeforeInsert),true);
 console.log('Polling, errors, status changes and new playlists preserve existing elements and scrolling; unchanged progress does not animate.');
}finally{await browser.close();}
