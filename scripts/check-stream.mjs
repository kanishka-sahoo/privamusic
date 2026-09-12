// Run inside the dashboard container. No media is fetched from a public URL.
import {Navidrome} from './src/navidrome.mjs';
import {createHash,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const url=process.env.NAVIDROME_URL;assert.equal(new URL(url).hostname,'navidrome');
const user=process.env.DASHBOARD_USER,password=process.env.NAVIDROME_PASSWORD||process.env.DASHBOARD_PASSWORD;
const nav=new Navidrome(url,user,password);
const playlists=(await nav.call('getPlaylists')).playlists.playlist;
const list=(await nav.call('getPlaylist',{id:playlists[0].id})).playlist;
const song=list.entry[0];assert.ok(song);
async function binary(method,params,headers={}){
 const salt=randomBytes(12).toString('hex');const body=new URLSearchParams({u:user,s:salt,t:createHash('md5').update(password+salt).digest('hex'),v:'1.16.1',c:'privamusic-next',...params});
 return fetch(`${url}/rest/${method}.view`,{method:'POST',body,headers,signal:AbortSignal.timeout(30000)});
}
const stream=await binary('stream',{id:song.id,format:'raw'},{Range:'bytes=0-63'});assert.equal(stream.status,206);assert.equal(Buffer.from(await stream.arrayBuffer()).subarray(0,4).toString(),'fLaC');
const art=await binary('getCoverArt',{id:song.coverArt,size:'100'});assert.equal(art.status,200);assert.ok(art.headers.get('content-type').startsWith('image/'));await art.arrayBuffer();
console.log('Private Docker network: FLAC streaming with byte ranges and embedded cover art both verified.');
