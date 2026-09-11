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
  return route.fulfill({body:readFileSync(new URL(`../web/${file}`,import.meta.url)),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
 });
 await page.goto('http://scroll.test/');await page.locator('details').first().waitFor();
 const before=await page.evaluate(()=>{document.querySelectorAll('details').forEach((d,i)=>{d.open=true;d.querySelector('.track-list').scrollTop=700+i*400;});window.scrollTo(0,600);return {lists:[...document.querySelectorAll('.track-list')].map(e=>e.scrollTop),y:scrollY};});
 const initial=polls;await page.waitForFunction(()=>document.querySelector('.job-footer')?.textContent.includes('collected'));
 while(polls<initial+3)await page.waitForTimeout(250);
 const after=await page.evaluate(()=>({lists:[...document.querySelectorAll('.track-list')].map(e=>e.scrollTop),y:scrollY}));
 assert.deepEqual(after,before);assert.equal(await page.locator('details[open]').count(),2);
 console.log('Both track lists and page scroll stayed in place across three live updates.');
}finally{await browser.close();}
