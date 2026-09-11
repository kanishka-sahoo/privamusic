import {Store} from './model.mjs';
import {enrichAudio} from './enrichment.mjs';
import {Navidrome} from './navidrome.mjs';
import {writeFile} from 'node:fs/promises';
const store=new Store(`${process.env.DATA_DIR||'/data'}/queue.db`);
const tracks=new Map(store.list().flatMap(j=>j.tracks).filter(t=>t.status==='completed').map(t=>[t.spotify_id,t]));
const report=[];
for(const [id,t] of tracks){
  try{report.push({id,...await enrichAudio(`${process.env.MUSIC_DIR||'/music'}/${id}.flac`,t)});}catch(e){report.push({id,warnings:[e.message]});}
  console.log(JSON.stringify({done:report.length,total:tracks.size,...report.at(-1)}));
}
await writeFile(`${process.env.DATA_DIR||'/data'}/enrichment-report.json`,JSON.stringify(report,null,2));
const nav=new Navidrome(process.env.NAVIDROME_URL,process.env.DASHBOARD_USER,process.env.NAVIDROME_PASSWORD||process.env.DASHBOARD_PASSWORD);
await nav.call('startScan',{fullScan:true});
console.log('Navidrome rescan requested.');
