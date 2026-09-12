import RFB from '/native/client/core/rfb.js';
const target=new URL('/native/websockify',location.href);target.protocol=location.protocol==='https:'?'wss:':'ws:';
let connection;
function connect(){
  connection?.disconnect();document.documentElement.classList.remove('noVNC_connected');
  document.querySelector('#desktop-status').textContent='Connecting to downloader…';
  connection=new RFB(document.querySelector('#native-screen'),target.href);connection.scaleViewport=true;
  connection.addEventListener('connect',()=>{document.documentElement.classList.add('noVNC_connected');document.querySelector('#desktop-status').textContent='Complete the app’s normal login below. Your session is saved on this server.';});
  connection.addEventListener('disconnect',()=>{document.documentElement.classList.remove('noVNC_connected');document.querySelector('#desktop-status').textContent='Disconnected. Reconnect, or sign in to the dashboard again.';});
}
document.querySelector('#reconnect').onclick=connect;connect();
