import {chromium} from 'playwright';
import {WebSocket} from 'ws';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const credentials=JSON.parse(readFileSync(0,'utf8'));
const base=process.env.TEST_URL;
assert.ok(base);
process.env.TMPDIR ||=new URL('../build/tmp/',import.meta.url).pathname;mkdirSync(process.env.TMPDIR,{recursive:true});
mkdirSync(new URL('../build/screenshots/',import.meta.url),{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1365,height:1000}});
 assert.equal((await context.request.get(`${base}/native/vnc.html`)).status(),401);
 async function deniedSocket(headers){
  const url=new URL('/native/websockify',base);url.protocol=url.protocol==='https:'?'wss:':'ws:';
  await new Promise((resolve,reject)=>{const ws=new WebSocket(url,{headers,handshakeTimeout:10000});ws.on('unexpected-response',(_,res)=>{try{assert.equal(res.statusCode,403);res.resume();resolve();}catch(e){reject(e);}});ws.on('open',()=>{ws.close();reject(Error('Unexpected desktop access'));});ws.on('error',reject);});
 }
 await deniedSocket({Origin:base});
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base);await p.getByLabel('Email',{exact:true}).fill(credentials.DASHBOARD_USER);await p.getByLabel('Password',{exact:true}).fill(credentials.DASHBOARD_PASSWORD);await p.getByRole('button',{name:'Sign in'}).click();await p.getByRole('heading',{name:'Bring it home.'}).waitFor();
 const cookie=(await context.cookies()).find(c=>c.name==='pm_session');assert.ok(cookie.secure);
 await deniedSocket({Origin:'https://untrusted.example',Cookie:`pm_session=${cookie.value}`});
 await p.goto(`${base}/native/vnc.html?autoconnect=1&resize=scale&path=native/websockify`);
 await p.waitForFunction(()=>document.documentElement.classList.contains('noVNC_connected'),null,{timeout:30000});
 await p.screenshot({path:new URL('../build/screenshots/netcup-native-login.png',import.meta.url).pathname,fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Native login screen connected over Tailscale HTTPS. Anonymous and cross-origin WebSocket access were rejected.');
}finally{await browser.close();}
