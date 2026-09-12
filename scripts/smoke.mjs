import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync(new URL('../.env',import.meta.url),'utf8').trim().split('\n').map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const base=process.env.TEST_URL||`http://127.0.0.1:${env.DASHBOARD_PORT||18780}`;
process.env.TMPDIR ||= new URL('../build/tmp/',import.meta.url).pathname;mkdirSync(process.env.TMPDIR,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1365,height:1050}});
const page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  assert.equal((await context.request.get(`${base}/api/state`)).status(),401);
  assert.equal((await context.request.post(`${base}/api/jobs`,{data:{url:'file:///etc/passwd'}})).status(),403);
  await page.goto(base);await page.getByLabel('Email',{exact:true}).fill(env.DASHBOARD_USER);await page.getByLabel('Password',{exact:true}).fill(env.DASHBOARD_PASSWORD);await page.getByRole('button',{name:'Sign in'}).click();await page.getByRole('heading',{name:'Bring it home.'}).waitFor();
  const url=process.env.TEST_SPOTIFY_URL||'https://open.spotify.com/track/1uySv0BiiI8hqcAXCCacsd';
  await page.getByLabel('Spotify playlist, album, or track URL').fill(url);await page.getByRole('button',{name:'Add to library'}).click();
  let state,job;
  for(let i=0;i<180;i++){
    state=await (await context.request.get(`${base}/api/state`)).json();job=state.jobs.find(j=>j.url===url);
    if(job&&['completed','partial','failed'].includes(job.status))break;
    if(i%10===0)console.log(JSON.stringify({status:job?.status,done:job?.done,total:job?.tracks.length}));
    await new Promise(r=>setTimeout(r,2000));
  }
  console.log(JSON.stringify({status:job?.status,done:job?.done,total:job?.tracks.length,error:job?.error,trackErrors:job?.tracks.filter(t=>t.error).map(t=>({name:t.name,error:t.error})),playlistId:job?.playlistId}));
  mkdirSync(new URL('../build/screenshots/',import.meta.url),{recursive:true});
  await page.screenshot({path:new URL('../build/screenshots/dashboard.png',import.meta.url).pathname,fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:new URL('../build/screenshots/mobile.png',import.meta.url).pathname,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);assert.equal(job?.status,'completed');
  console.log('Browser smoke passed: login, protected API, submission, completed download, responsive dashboard.');
}finally{await browser.close();}
