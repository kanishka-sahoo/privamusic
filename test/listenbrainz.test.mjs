import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {Store} from '../src/model.mjs';
import {Navidrome} from '../src/navidrome.mjs';
import {Discover,ListenBrainz,feedList,jspfTracks,latestEditions} from '../src/listenbrainz.mjs';
const ext=patch=>({'https://musicbrainz.org/doc/jspf#playlist':{additional_metadata:{algorithm_metadata:{source_patch:patch}}}});
const daily='d86c3248-479d-4187-a737-16756e444d9c',weekly='54cc305b-f68e-4ab8-a2b9-3188727a3b5b',older='97311398-1604-4bb3-8a6e-435e5e241dd2';
// Shape of GET /1/user/<name>/playlists/createdfor, as returned by api.listenbrainz.org.
const listing=[
  {playlist:{title:'Daily Jams for rob, 2026-09-14 Mon',identifier:`https://listenbrainz.org/playlist/${daily}`,date:'2026-09-13T22:01:20+00:00',extension:ext('daily-jams')}},
  {playlist:{title:'Weekly Jams for rob, week of 2026-08-17 Mon',identifier:`https://listenbrainz.org/playlist/${older}`,date:'2026-08-16T22:07:13+00:00',extension:ext('weekly-jams')}},
  {playlist:{title:'Weekly Jams for rob, week of 2026-08-24 Mon',identifier:`https://listenbrainz.org/playlist/${weekly}`,date:'2026-08-23T22:07:21+00:00',extension:ext('weekly-jams')}},
  {playlist:{title:'Top Discoveries of 2025 for rob',identifier:'https://listenbrainz.org/playlist/3c8f40f3-0e59-4275-8b86-8f3d3588b4d8',date:'2026-02-22T10:42:29+00:00',extension:ext('top-discoveries-of-2025')}},
];
const id=c=>c.repeat(22);
test('feed list validates names and defaults to all three feeds',()=>{
  assert.deepEqual(feedList(''),['weekly-jams','daily-jams','weekly-exploration']);
  assert.deepEqual(feedList(' daily-jams, weekly-jams ,daily-jams'),['daily-jams','weekly-jams']);
  assert.throws(()=>feedList('monthly-jams'),/Unknown ListenBrainz feed/);
});
test('picks the newest edition per wanted feed and ignores other generated playlists',()=>{
  const editions=latestEditions(listing,['weekly-jams','daily-jams','weekly-exploration']);
  assert.deepEqual(editions.map(e=>[e.feed,e.mbid]),[['daily-jams',daily],['weekly-jams',weekly]]);
  assert.equal(editions[1].url,`https://listenbrainz.org/playlist/${weekly}/`);
  assert.deepEqual(latestEditions(listing,['weekly-exploration']),[]);
});
test('reads recording MBIDs and titles from JSPF',()=>{
  const tracks=jspfTracks({playlist:{track:[{title:'Take Me Into Your Skin',creator:'Trentemøller',album:'The Last Resort',duration:464093,identifier:['https://musicbrainz.org/recording/4c1fddcc-0f0e-42a1-8ea4-efba8f50b553']},{title:'Unknown',creator:'Nobody',identifier:[]}]}});
  assert.deepEqual(tracks[0],{mbid:'4c1fddcc-0f0e-42a1-8ea4-efba8f50b553',title:'Take Me Into Your Skin',artist:'Trentemøller',album:'The Last Resort',duration:464093});
  assert.equal(tracks[1].mbid,null);
  assert.throws(()=>jspfTracks({playlist:{}}),/no tracks/);
});
test('maps recordings to Spotify by MBID, then by metadata, and sends the token only to ListenBrainz',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url,auth:init.headers.Authorization,body:init.body&&JSON.parse(init.body)});
    const json=data=>({ok:true,status:200,headers:new Headers(),json:async()=>data});
    if(url.includes('spotify-id-from-mbid'))return json([{recording_mbid:'m1',spotify_track_ids:[id('a')]},{recording_mbid:'m2',spotify_track_ids:[]},{recording_mbid:'m3',spotify_track_ids:[]}]);
    if(url.includes('musicbrainz.org/ws/2/recording/m3'))return json({relations:[{url:{resource:'https://music.apple.com/x'}},{url:{resource:`https://open.spotify.com/track/${id('c')}`}}]});
    if(url.includes('musicbrainz.org/ws/2/recording/m2'))return json({relations:[]});
    if(url.includes('spotify-id-from-metadata'))return json([{spotify_track_ids:[id('b'),'not an id']}]);
    return json({});
  };
  const lb=new ListenBrainz('rob','secret-token',fetchImpl);lb.musicbrainzDelay=0;
  const ids=await lb.spotifyIds([{mbid:'m1',title:'One',artist:'A',album:''},{mbid:'m2',title:'Two',artist:'B',album:'Album'},{mbid:'m3',title:'Three',artist:'C',album:''},{mbid:null,title:'',artist:'D',album:''}]);
  assert.deepEqual(ids,[[id('a')],[id('b')],[id('c')],[]]);
  assert.deepEqual(calls.map(c=>c.auth),[undefined,undefined,undefined,undefined]);
  assert.deepEqual(calls.map(c=>c.url.replace(/^https:\/\/[^/]+/,'')),['/spotify-id-from-mbid/json','/ws/2/recording/m2?inc=url-rels&fmt=json','/ws/2/recording/m3?inc=url-rels&fmt=json','/spotify-id-from-metadata/json']);
  assert.deepEqual(calls[3].body,[{artist_name:'B',release_name:'Album',track_name:'Two'}]);
  await lb.createdFor();
  assert.equal(calls.at(-1).auth,'Token secret-token');assert.match(calls.at(-1).url,/\/user\/rob\/playlists\/createdfor/);
  assert.throws(()=>new ListenBrainz('not a user name'),/LISTENBRAINZ_USER/);
});
test('queues one job per new edition, carries the Navidrome playlist over, and resolves tracks reusing the library',async()=>{
  const dir=mkdtempSync(`${tmpdir()}/privamusic-lb-`);const store=new Store(`${dir}/queue.db`);
  try{
    const client={user:'rob',createdFor:async()=>listing,
      playlist:async()=>[{mbid:'m1',title:'Owned',artist:'A',album:'',duration:1000},{mbid:'m2',title:'New',artist:'B',album:'',duration:2000},{mbid:'m3',title:'Same ISRC',artist:'C',album:'',duration:3000},{mbid:'m4',title:'Nowhere',artist:'D',album:'',duration:4000}],
      spotifyIds:async()=>[[id('x'),id('o')],[id('n')],[id('s')],[]]};
    const discover=new Discover(store,client,['weekly-jams','daily-jams']);discover.lookupDelay=0;
    // An earlier Weekly Jams import already synced a playlist.
    store.save({id:'old',kind:'listenbrainz',feed:'weekly-jams',source:{mbid:older},status:'completed',playlistId:'nd-weekly',tracks:[],createdAt:'2026-08-17T00:00:00Z'});
    const created=await discover.check();
    assert.deepEqual(created.map(j=>[j.feed,j.edition,j.playlistId,j.status,j.url]).sort(),[['daily-jams','Daily Jams for rob, 2026-09-14 Mon',null,'queued',`https://listenbrainz.org/playlist/${daily}/`],['weekly-jams','Weekly Jams for rob, week of 2026-08-24 Mon','nd-weekly','queued',`https://listenbrainz.org/playlist/${weekly}/`]]);
    assert.deepEqual(await discover.check(),[]);
    const status=discover.status();
    assert.equal(status.enabled,true);assert.equal(status.user,'rob');
    assert.deepEqual(status.feeds.map(f=>[f.feed,f.playlistId,f.status]),[['weekly-jams','nd-weekly','queued'],['daily-jams',null,'queued']]);
    const known=[{spotify_id:id('o'),name:'Owned',isrc:'ISRC1',status:'completed',bytes:5},{spotify_id:id('z'),name:'Library copy',isrc:'ISRC3',status:'completed'}];
    const lookups=[];
    const lookup=async url=>{lookups.push(url);const spotifyId=url.split('/').pop();return {track:{spotify_id:spotifyId,name:spotifyId[0]==='n'?'New':'Same ISRC',isrc:spotifyId[0]==='s'?'ISRC3':''}};};
    const tracks=await discover.resolve(created[0],lookup,known);
    assert.deepEqual(lookups,[`https://open.spotify.com/track/${id('n')}`,`https://open.spotify.com/track/${id('s')}`]);
    assert.deepEqual(tracks.map(t=>[t.spotify_id,t.status]),[[id('o'),'queued'],[id('n'),'queued'],[id('z'),'queued'],[null,'skipped']]);
    assert.equal(tracks[3].error,'No Spotify match for this recording');assert.equal(tracks[0].mbid,'m1');assert.equal(tracks[0].bytes,5);
    await assert.rejects(discover.resolve(created[0],async()=>({error:'Spotify returned 429'}),[]),/Spotify lookup failed for "A - Owned": Spotify returned 429/);
    // A later retry finds the recording that had no match and queues it in place.
    const job={...created[0],tracks};client.spotifyIds=async sources=>{assert.deepEqual(sources,[{mbid:'m4',title:'Nowhere',artist:'D',album:'',duration:4000}]);return [[id('f')]];};
    assert.equal(await discover.rematch(job,async()=>({track:{spotify_id:id('f'),name:'Found'}}),known),1);
    assert.deepEqual(job.tracks.map(t=>[t.spotify_id,t.status]),[[id('o'),'queued'],[id('n'),'queued'],[id('z'),'queued'],[id('f'),'queued']]);
    assert.equal(job.tracks[3].mbid,'m4');assert.equal(await discover.rematch(job,()=>assert.fail('nothing skipped'),known),0);
    // Album fallback: no track match anywhere, but a release links a Spotify album that contains the ISRC.
    client.spotifyIds=async()=>[[]];client.albumHints=async mbid=>{assert.equal(mbid,'m9');return {albums:[id('l')],isrcs:['ISRCX']};};
    const viaAlbum={...created[1],tracks:[{mbid:'m9',name:'Deep Cut',artists:'E',album_name:'LP',duration_ms:100000,status:'skipped'}]};
    const albumLookup=async url=>{assert.equal(url,`https://open.spotify.com/album/${id('l')}`);return {album_info:{name:'LP'},track_list:[{spotify_id:id('q'),name:'Other',isrc:'Z'},{spotify_id:id('p'),name:'Deep Cut (Remastered)',isrc:'ISRCX',duration_ms:101000}]};};
    assert.equal(await discover.rematch(viaAlbum,albumLookup,[]),1);
    assert.deepEqual([viaAlbum.tracks[0].spotify_id,viaAlbum.tracks[0].status,viaAlbum.tracks[0].mbid],[id('p'),'queued','m9']);
    client.albumHints=async()=>({albums:[id('l')],isrcs:[]});
    const byTitle={...viaAlbum,tracks:[{mbid:'m9',name:'Deep Cut',artists:'E',album_name:'LP',duration_ms:100000,status:'skipped'}]};
    assert.equal(await discover.rematch(byTitle,albumLookup,[]),1);assert.equal(byTitle.tracks[0].spotify_id,id('p'));
    await assert.rejects(new Discover(store,null).check(),/not configured/);
  }finally{store.db.close();rmSync(dir,{recursive:true});}
});
test('recreates a deleted Navidrome playlist for a feed and annotates it with the edition',async()=>{
  const nav=new Navidrome('http://localhost','test','test');const calls=[];
  nav.call=async(method,params)=>{calls.push({method,params});if(method==='getScanStatus')return {scanStatus:{scanning:false}};if(method==='search3')return {searchResult3:{song:[{id:'a',path:'first.flac'}]}};if(method==='createPlaylist'){if(params.playlistId)throw Error('Navidrome: Playlist not found');return {playlist:{id:'fresh'}};}if(method==='getPlaylist')return {playlist:{entry:[{id:'a'}]}};return {};};
  const job={kind:'listenbrainz',name:'Weekly Jams',edition:'Weekly Jams for rob, week of 2026-08-24 Mon',url:'https://listenbrainz.org/playlist/x/',playlistId:'gone',tracks:[{spotify_id:'first',status:'completed'},{spotify_id:null,status:'skipped'}]};
  assert.equal(await nav.sync(job),'fresh');assert.equal(job.playlistId,'fresh');
  assert.deepEqual(calls.filter(c=>c.method==='createPlaylist').map(c=>c.params),[{playlistId:'gone',songId:['a']},{name:'Weekly Jams',songId:['a']}]);
  assert.equal(calls.find(c=>c.method==='updatePlaylist').params.comment,'Weekly Jams for rob, week of 2026-08-24 Mon · https://listenbrainz.org/playlist/x/');
});
