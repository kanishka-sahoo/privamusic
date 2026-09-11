import http from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {NativeBridge} from './bridge.mjs';
import {Store,spotifyInput} from './model.mjs';
import {Navidrome} from './navidrome.mjs';
import {Worker} from './worker.mjs';
import {proxyDesktop,attachDesktop} from './native-desktop.mjs';
const user=process.env.DASHBOARD_USER||'social@ksahoo.com';
const password=process.env.DASHBOARD_PASSWORD;
const secret=process.env.SESSION_SECRET;
if(!password||password.length<16||!secret||secret.length<32)throw Error('Set a dashboard password of at least 16 characters and a session secret of at least 32 characters');
const salt=randomBytes(16);const hash=scryptSync(password,salt,32);
const data=process.env.DATA_DIR||'/data';mkdirSync(data,{recursive:true});
const store=new Store(`${data}/queue.db`);
const bridge=new NativeBridge();
const nav=new Navidrome(process.env.NAVIDROME_URL||'http://navidrome:4533',user,process.env.NAVIDROME_PASSWORD||password);
const worker=new Worker(store,bridge,nav,process.env.MUSIC_DIR||'/music');
let navReady=false;
nav.initialize().then(()=>{navReady=true;return worker.start();}).catch(e=>{console.error(e.message);process.exit(1);});
const assets=new Map(['/','/app.js','/style.css'].map(p=>[p,readFileSync(fileURLToPath(new URL(`../web/${p==='/'?'index.html':p.slice(1)}`,import.meta.url)))]));
const sign=value=>createHmac('sha256',secret).update(value).digest('hex');
function authenticated(req){const value=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('pm_session='))?.slice(11);if(!value)return false;const [expires,nonce,signature]=value.split('.');const expected=sign(`${expires}.${nonce}`);return Number(expires)>Date.now()&&signature?.length===expected.length&&timingSafeEqual(Buffer.from(signature),Buffer.from(expected));}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));}
async function body(req){let bytes=0;const chunks=[];for await(const c of req){bytes+=c.length;if(bytes>8192)throw Error('Request too large');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)return false;try{return new URL(origin).host===req.headers.host;}catch{return false;}}
const failures=new Map();
function publicJob(job){return {...job,tracks:job.tracks.map(t=>({spotify_id:t.spotify_id,name:t.name,artists:t.artists,status:t.status,error:t.error,bytes:t.bytes})),done:job.tracks.filter(t=>t.status==='completed').length,failed:job.tracks.filter(t=>t.status==='failed').length};}
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https://i.scdn.co data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const url=new URL(req.url,'http://localhost');
  try{
    if(req.method==='GET'&&url.pathname==='/healthz')return send(res,200,{ready:bridge.connected&&navReady});
    if(req.method==='GET'&&assets.has(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html');return res.end(assets.get(url.pathname));}
    if(['POST','PUT','DELETE','PATCH'].includes(req.method)&&!sameOrigin(req))return send(res,403,{error:'Origin check failed'});
    if(req.method==='POST'&&url.pathname==='/api/login'){
      const key=req.socket.remoteAddress;const entry=failures.get(key)||{count:0,until:0};
      if(entry.until>Date.now())return send(res,429,{error:'Too many attempts. Try again in 15 minutes.'});
      const input=await body(req);const candidate=scryptSync(String(input.password||''),salt,32);
      if(input.username!==user||!timingSafeEqual(candidate,hash)){entry.count++;if(entry.count>=10){entry.until=Date.now()+900000;entry.count=0;}failures.set(key,entry);return send(res,401,{error:'Email or password is incorrect'});}
      failures.delete(key);const value=`${Date.now()+7*86400000}.${randomBytes(24).toString('hex')}`;
      const secure=req.headers['x-forwarded-proto']==='https'||req.socket.encrypted;
      res.setHeader('Set-Cookie',`pm_session=${value}.${sign(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure?'; Secure':''}`);return send(res,200,{user});
    }
    if(!authenticated(req))return send(res,401,{error:'Sign in to continue'});
    if(req.method==='GET'&&url.pathname.startsWith('/native/'))return proxyDesktop(req,res);
    if(req.method==='POST'&&url.pathname==='/api/logout'){res.setHeader('Set-Cookie','pm_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
    if(req.method==='GET'&&url.pathname==='/api/state')return send(res,200,{user,connected:bridge.connected,navReady,navidromePort:Number(process.env.NAVIDROME_PORT||4533),halted:worker.halted,progress:worker.progress,jobs:store.list().map(publicJob)});
    if(req.method==='POST'&&url.pathname==='/api/jobs'){
      if(worker.halted)return send(res,503,{error:'Native worker stopped after a timeout. Restart the service before retrying.'});
      const input=spotifyInput((await body(req)).url);
      const existing=store.list().find(j=>j.url===input.url&&['queued','resolving','downloading','syncing'].includes(j.status));
      if(existing)return send(res,200,publicJob(existing));
      if(store.list().filter(j=>j.status==='queued').length>=100)return send(res,429,{error:'Queue is full'});
      return send(res,201,publicJob(store.add(input.url)));
    }
    const match=url.pathname.match(/^\/api\/jobs\/([a-f0-9-]+)\/(retry|cancel)$/);
    if(req.method==='POST'&&match){
      const job=store.get(match[1]);if(!job)return send(res,404,{error:'Job not found'});
      if(match[2]==='retry'){
        if(worker.halted)return send(res,503,{error:'Restart the service before retrying'});
        if(!['failed','partial','cancelled'].includes(job.status))return send(res,409,{error:'This job cannot be retried now'});
        job.status='queued';job.cancelRequested=false;job.error=null;
      }else{if(!['queued','resolving','downloading'].includes(job.status))return send(res,409,{error:'This job cannot be cancelled now'});job.cancelRequested=true;if(job.status==='queued')job.status='cancelled';}
      return send(res,200,publicJob(store.save(job)));
    }
    send(res,404,{error:'Not found'});
  }catch(e){send(res,400,{error:e.message});}
});
attachDesktop(server,authenticated);
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('PrivaMusic dashboard listening on port '+(process.env.PORT||8080)));
