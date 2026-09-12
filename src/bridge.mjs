import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {WebSocketServer, WebSocket} from 'ws';
export class NativeBridge {
  pending = new Map(); socket = null; counter = 0;
  constructor(port = 9181, scriptPath = '/run/next-bridge.js') {
    const token = randomBytes(32).toString('hex');
    const allowed = ['GetSpotifyMetadata', 'DownloadTrack', 'GetDownloadProgress'];
    this.allowed = new Set(allowed);
    const script = `(()=>{let active=false;setInterval(()=>{if(active||!window.go?.main?.App)return;active=true;const s=new WebSocket('ws://127.0.0.1:${port}/${token}');s.onclose=()=>active=false;s.onerror=()=>s.close();s.onmessage=async e=>{let m;try{m=JSON.parse(e.data);if(!${JSON.stringify(allowed)}.includes(m.method))throw Error('Unsupported method');const result=await window.go.main.App[m.method](...m.args);s.send(JSON.stringify({id:m.id,result}));}catch(error){if(m&&s.readyState===1)s.send(JSON.stringify({id:m.id,error:String(error)}));}};},1000);})();`;
    writeFileSync(scriptPath, script, {mode:0o600});
    this.server = http.createServer((_,res)=>res.writeHead(404).end());
    const wss = new WebSocketServer({noServer:true, maxPayload:8*1024*1024});
    this.server.on('upgrade',(req,socket,head)=>{
      if(req.url !== `/${token}` || this.connected) return socket.destroy();
      wss.handleUpgrade(req,socket,head,s=>wss.emit('connection',s));
    });
    wss.on('connection',socket=>{
      this.socket=socket;
      socket.on('message',raw=>{try {const m=JSON.parse(raw);const p=this.pending.get(m.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.result);}catch{socket.close();}});
      socket.on('close',()=>{if(this.socket===socket)this.socket=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Native app disconnected'));}this.pending.clear();});
    });
    this.server.listen(port,'127.0.0.1');
  }
  get connected(){return this.socket?.readyState===WebSocket.OPEN;}
  call(method,args=[],timeout=180000){
    if(!this.allowed.has(method))return Promise.reject(Error('Unsupported native method'));
    if(!this.connected)return Promise.reject(Error('Native app is starting or requires login'));
    return new Promise((resolve,reject)=>{const id=++this.counter;const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Native operation timed out; restart the app before retrying'));},timeout);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,args}));});
  }
}
