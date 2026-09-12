import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import {WebSocketServer,WebSocket} from 'ws';
const nativePage=fileURLToPath(new URL('../dist/native.html',import.meta.url));

export async function proxyDesktop(req,res){
  // The noVNC client is bundled into the public /assets build; only the page itself stays behind the session.
  if(new URL(req.url,'http://localhost').pathname!=='/native/vnc.html'){res.writeHead(404).end();return;}
  try{const data=await readFile(nativePage);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(data);}catch{res.writeHead(404).end();}
}
export function desktopUpgradeAllowed(req,authenticated){
  try{return req.url==='/native/websockify'&&new URL(req.headers.origin).host===req.headers.host&&authenticated(req);}catch{return false;}
}
export function attachDesktop(server,authenticated){
  const desktop=new WebSocketServer({noServer:true,maxPayload:1024*1024,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    if(!desktopUpgradeAllowed(req,authenticated)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    desktop.handleUpgrade(req,socket,head,ws=>{
      const tcp=net.createConnection({host:'127.0.0.1',port:5900});
      tcp.on('data',data=>{tcp.pause();if(ws.readyState!==WebSocket.OPEN){tcp.destroy();return;}ws.send(data,{binary:true},error=>{if(error)tcp.destroy();else tcp.resume();});});
      ws.on('message',(data,binary)=>{if(!binary){ws.close(1003);return;}if(!tcp.write(data))ws.pause();});
      tcp.on('drain',()=>ws.resume());
      tcp.on('error',()=>ws.close(1011,'Downloader login is unavailable'));
      tcp.on('close',()=>ws.close());ws.on('close',()=>tcp.destroy());ws.on('error',()=>tcp.destroy());
    });
  });
}
