import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
process.env.TMPDIR ||=new URL('../build/tmp/',import.meta.url).pathname;mkdirSync(process.env.TMPDIR,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}});let polls=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const jobs=[0,1].map(i=>({id:`job-${i}`,name:`Playlist ${i}`,kind:'playlist',status:'downloading',done:1,failed:0,tracks:Array.from({length:150},(_,n)=>({spotify_id:String(n),name:`Song ${n}`,artists:'Artist',album_name:'Album',duration_ms:200000,status:'queued'}))}));
 const state=jobs=>({connected:true,navReady:true,navidromePort:4533,jobs});
 await page.route('http://scroll.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/state'){polls++;return route.fulfill({json:state(jobs.map(j=>({...j,done:polls})))});}
  // Serve the Vite build (run `npm run build` first); extensionless paths get the app shell like the real server.
  const file=path==='/'||!/\.\w+$/.test(path)?'index.html':path.slice(1);
  let body;try{body=readFileSync(new URL(`../dist/${file}`,import.meta.url));}catch{return route.fulfill({status:404});}
  return route.fulfill({body,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'});
 });
 // Collection page: the paginated track table keeps its rows and the page keeps its scroll position while polling.
 await page.goto('http://scroll.test/playlists/job-0');await page.locator('.track').first().waitFor();
 assert.equal(await page.locator('.track').count(),50,'First page shows 50 tracks');
 assert.equal(await page.locator('.pagination-summary').textContent(),'Showing 1–50 of 150 tracks');
 await page.evaluate(()=>window.scrollTo(0,600));
 await page.evaluate(()=>{window.retained={head:document.querySelector('.detail'),bar:document.querySelector('[role=progressbar] > div'),table:document.querySelector('.track-table'),row:document.querySelector('.track')};});
 const before=await page.evaluate(()=>scrollY);const initial=polls;
 while(polls<initial+3)await page.waitForTimeout(250);
 await page.waitForFunction(n=>document.querySelector('.detail-counts')?.textContent.startsWith(String(n)),polls);
 assert.equal(await page.evaluate(()=>scrollY),before,'Polling must not move the page');
 assert.equal(await page.evaluate(()=>retained.head===document.querySelector('.detail')&&retained.bar===document.querySelector('[role=progressbar] > div')&&retained.table===document.querySelector('.track-table')&&retained.row===document.querySelector('.track')),true,'Refresh must retain existing DOM nodes');
 // Status changes update in place.
 const changed=jobs.map(j=>({...j,status:'partial',done:12,failed:1,error:'Provider unavailable',tracks:j.tracks.map((t,i)=>i? t:{...t,status:'failed',error:'Test failure'})}));
 await page.evaluate(jobs=>privamusic.render({connected:true,navReady:true,navidromePort:4533,jobs}),changed);
 assert.equal(await page.locator('.track .error').first().textContent(),'Test failure');
 assert.equal(await page.locator('.detail-actions button').first().textContent(),'Retry');
 assert.equal(await page.evaluate(()=>retained.table===document.querySelector('.track-table')&&retained.row===document.querySelector('.track')),true);
 await page.waitForTimeout(500);
 await page.evaluate(jobs=>privamusic.render({connected:true,navReady:true,navidromePort:4533,jobs}),changed);
 assert.equal(await page.evaluate(()=>retained.bar.getAnimations().length),0,'Unchanged progress must not restart its animation');
 // Pagination and the failed-only filter live in the URL.
 await page.locator('.page-button[aria-label="Next page"]').click();
 assert.equal(await page.locator('td.track-index').nth(0).textContent(),'51');
 assert.equal(new URL(page.url()).searchParams.get('page'),'2');
 await page.getByRole('button',{name:/^Failed/}).click();
 assert.equal(await page.locator('.track').count(),1);
 // Queue page: inserting a new collection keeps existing cards.
 await page.locator('.nav-item',{hasText:'Queue'}).click();await page.locator('.job').first().waitFor();
 assert.equal(new URL(page.url()).pathname,'/queue');
 await page.evaluate(jobs=>privamusic.render({connected:true,navReady:true,navidromePort:4533,jobs:jobs.map(j=>({...j,status:'downloading'}))}),changed);
 await page.evaluate(()=>{window.retainedCard=document.querySelector('[data-job-id="job-0"]');});
 await page.evaluate(jobs=>privamusic.render({connected:true,navReady:true,navidromePort:4533,jobs:[{...jobs[0],id:'new-job',status:'queued'},...jobs.map(j=>({...j,status:'downloading'}))]}),changed);
 assert.equal(await page.evaluate(()=>retainedCard===document.querySelector('[data-job-id="job-0"]')),true);
 assert.equal(await page.locator('.job').count(),3);
 // Section pages and the browser back button.
 await page.locator('.nav-item',{hasText:'Playlists'}).click();await page.locator('.job').first().waitFor();
 assert.equal(await page.locator('.nav-item.active').textContent(),'Playlists3');
 await page.goBack();await page.waitForURL('**/queue');
 assert.deepEqual(errors,[]);
 console.log('Routing, pagination, filters, polling, status changes and new collections preserve existing elements and scrolling; unchanged progress does not animate.');
}finally{await browser.close();}
