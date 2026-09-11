import {createHash,randomBytes} from 'node:crypto';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export class Navidrome {
  constructor(url,user,password){this.url=url.replace(/\/$/,'');this.user=user;this.password=password;}
  async initialize(){
    for(let i=0;i<60;i++){
      try{
        const credentials=JSON.stringify({username:this.user,password:this.password});
        const login=await fetch(`${this.url}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:credentials,signal:AbortSignal.timeout(5000)});
        if(login.ok)return;
        const create=await fetch(`${this.url}/auth/createAdmin`,{method:'POST',headers:{'Content-Type':'application/json'},body:credentials,signal:AbortSignal.timeout(5000)});
        if(create.ok)return;
        if(i>5)throw Error('Navidrome login failed. Check the configured account.');
      }catch(e){if(i===59)throw e;}
      await sleep(1000);
    }
    throw Error('Navidrome did not become ready');
  }
  async call(method,params={}){
    const s=randomBytes(12).toString('hex');
    const body=new URLSearchParams({u:this.user,s,t:createHash('md5').update(this.password+s).digest('hex'),v:'1.16.1',c:'privamusic-next',f:'json'});
    for(const [k,v] of Object.entries(params))for(const item of Array.isArray(v)?v:[v])body.append(k,String(item));
    const r=await fetch(`${this.url}/rest/${method}.view`,{method:'POST',body,signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw Error(`Navidrome ${method} failed (${r.status})`);
    const data=(await r.json())['subsonic-response'];
    if(data?.status!=='ok')throw Error(`Navidrome: ${data?.error?.message||'invalid response'}`);
    return data;
  }
  async songs(){
    const songs=[];
    for(let offset=0;offset<100000;offset+=500){
      const data=await this.call('search3',{query:'',songCount:500,songOffset:offset,albumCount:0,artistCount:0});
      const page=data.searchResult3?.song||[];songs.push(...page);if(page.length<500)return songs;
    }
    throw Error('Navidrome library exceeds the indexing limit');
  }
  async sync(job,onPlaylist=()=>{}){
    await this.call('startScan');
    const wanted=job.tracks.filter(t=>t.status==='completed');
    let byPath;
    for(let i=0;i<90;i++){
      const status=await this.call('getScanStatus');
      if(!status.scanStatus?.scanning){
        byPath=new Map((await this.songs()).map(s=>[s.path?.replace(/^\/?music\//,''),s.id]));
        if(wanted.every(t=>byPath.has(`${t.spotify_id}.flac`)))break;
      }
      if(i===89)throw Error('Navidrome has not indexed every downloaded file yet. Retry to finish syncing.');
      await sleep(2000);
    }
    if(job.kind!=='playlist'||!wanted.length)return null;
    const songId=wanted.map(t=>byPath.get(`${t.spotify_id}.flac`));
    const data=await this.call('createPlaylist',job.playlistId?{playlistId:job.playlistId,songId}:{name:job.name,songId});
    const id=data.playlist?.id||job.playlistId;
    if(!id)throw Error('Navidrome returned no playlist ID');
    // Persist the ID before verification so a retry updates the same playlist.
    job.playlistId=id;onPlaylist();
    const actual=(await this.call('getPlaylist',{id})).playlist?.entry||[];
    if(actual.length!==songId.length||actual.some((s,i)=>s.id!==songId[i]))throw Error('Navidrome playlist verification failed');
    return id;
  }
}
