import http from 'node:http';

// The desktop is reachable only through the dashboard's authenticated HTTP/WS paths.
export function proxyDesktop(req,res){
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  const upstream=http.request({host:'127.0.0.1',port:6080,path:req.url.slice('/native'.length),method:req.method},response=>{
    res.writeHead(response.statusCode,{'Content-Type':response.headers['content-type']||'application/octet-stream'});
    response.pipe(res);
  });
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503).end('Downloader login is starting. Reload shortly.');else res.destroy();});
  res.on('close',()=>upstream.destroy());req.pipe(upstream);
}
export function desktopUpgradeAllowed(req,authenticated){
  try{return req.url==='/native/websockify'&&new URL(req.headers.origin).host===req.headers.host&&authenticated(req);}catch{return false;}
}
export function attachDesktop(server,authenticated){
  server.on('upgrade',(req,socket,head)=>{
    if(!desktopUpgradeAllowed(req,authenticated)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    const headers={...req.headers,host:'127.0.0.1:6080'};delete headers.cookie;
    const proxy=http.request({host:'127.0.0.1',port:6080,path:'/websockify',headers});
    proxy.on('upgrade',(response,upstream,upstreamHead)=>{
      socket.write('HTTP/1.1 101 Switching Protocols\r\n'+response.rawHeaders.reduce((s,v,i)=>s+v+(i%2?'\r\n':': '),'')+'\r\n');
      if(head.length)upstream.write(head);if(upstreamHead.length)socket.write(upstreamHead);
      socket.pipe(upstream);upstream.pipe(socket);
      socket.on('close',()=>upstream.destroy());upstream.on('close',()=>socket.destroy());
      socket.on('error',()=>upstream.destroy());upstream.on('error',()=>socket.destroy());
    });
    proxy.on('error',()=>socket.destroy());proxy.on('response',()=>socket.destroy());
    socket.on('close',()=>proxy.destroy());socket.on('error',()=>proxy.destroy());proxy.end();
  });
}
