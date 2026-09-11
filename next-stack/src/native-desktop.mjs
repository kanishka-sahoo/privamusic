import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import net from 'node:net';
import {WebSocketServer,WebSocket} from 'ws';
const clientRoot=fileURLToPath(new URL('../node_modules/@novnc/novnc/',import.meta.url));
const webRoot=fileURLToPath(new URL('../web/',import.meta.url));

export async function proxyDesktop(req,res){
  const path=new URL(req.url,'http://localhost').pathname;
  let file;
  if(path==='/native/vnc.html')file=resolve(webRoot,'native.html');
  else if(path==='/native/desktop.js')file=resolve(webRoot,'native.js');
  else if(path.startsWith('/native/client/')){
    try{file=resolve(clientRoot,decodeURIComponent(path.slice('/native/client/'.length)));}catch{res.writeHead(404).end();return;}
    if(!file.startsWith(clientRoot)||!file.endsWith('.js')){res.writeHead(404).end();return;}
  }else{res.writeHead(404).end();return;}
  try{const data=await readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html':'text/javascript'});res.end(data);}catch{res.writeHead(404).end();}
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
