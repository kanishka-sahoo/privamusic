const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let signedIn=false,statePromise=null;
async function api(path,options={}){const r=await fetch(path,{...options,headers:{'Content-Type':'application/json'}});const data=await r.json();if(r.status===401){showLogin();throw Error(data.error);}if(!r.ok)throw Error(data.error||'Request failed');return data;}
function showLogin(){signedIn=false;$('#login').hidden=false;$('#dashboard').hidden=true;$('#nav').hidden=true;}
function message(error){$('#message').textContent=error?.message||'';}
function state(){
  if(statePromise)return statePromise;
  statePromise=(async()=>{try{const data=await api('/api/state');signedIn=true;$('#login').hidden=true;$('#dashboard').hidden=false;$('#nav').hidden=false;render(data);}catch(e){if(signedIn)message(e);}finally{statePromise=null;}})();
  return statePromise;
}
// Update the fixed card structure without discarding browser interaction state.
function updateNode(current,next){
  if(current.nodeType!==next.nodeType||current.nodeName!==next.nodeName){current.replaceWith(next.cloneNode(true));return;}
  if(current.nodeType===Node.TEXT_NODE){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
  for(const attr of [...current.attributes]){
    if(!['open','style','disabled'].includes(attr.name)&&!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
  }
  for(const attr of next.attributes){
    if(!['open','style','disabled'].includes(attr.name)&&current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
  }
  const previous=[...current.childNodes],incoming=[...next.childNodes];
  incoming.forEach((child,i)=>previous[i]?updateNode(previous[i],child):current.append(child.cloneNode(true)));
  previous.slice(incoming.length).forEach(child=>child.remove());
}
function render(data){
  const library=new URL(window.location.href);library.port=String(data.navidromePort);library.pathname="/";library.search="";library.hash="";$("#library-link").href=library.href;
  const active=['queued','resolving','downloading','syncing'];
  $('#connection').textContent=data.halted?'Worker needs restart':data.connected&&data.navReady?'Library connected':'Starting services…';
  $('#count-tracks').textContent=new Set(data.jobs.flatMap(j=>j.tracks.filter(t=>t.status==='completed').map(t=>t.spotify_id))).size;
  $('#count-active').textContent=data.jobs.filter(j=>active.includes(j.status)).length;
  $('#count-playlists').textContent=data.jobs.filter(j=>j.playlistId).length;
  $('#empty').hidden=!!data.jobs.length;$('#queue-label').textContent=data.jobs.length?`${data.jobs.length} additions`:'Your collection starts here';
  const cards=new Map([...$('#jobs').children].map(el=>[el.dataset.jobId,el]));
  data.jobs.forEach((j,index)=>{
    const current=j.tracks.find(t=>t.status==='downloading');
    const cover=typeof j.cover==='string'&&/^https:\/\/i\.scdn\.co\//.test(j.cover)?`<img class="cover" src="${esc(j.cover)}" alt="" loading="lazy">`:'<div class="cover">♫</div>';
    const pct=j.tracks.length?Math.round((j.done+j.failed)/j.tracks.length*100):0;
    const template=document.createElement('template');
    template.innerHTML=`<article class="job" data-job-id="${esc(j.id)}"><div class="job-top">${cover}<div class="job-info"><h3>${esc(j.name)}</h3><p class="meta">${esc(j.kind)} · ${j.tracks.length||'…'} tracks${j.playlistId?' · Playlist in Navidrome':''}</p></div><span class="badge ${esc(j.status)}">${esc(j.status)}</span></div><div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Download progress"><div></div></div><div class="job-footer"><span>${j.done} collected${j.failed?` · ${j.failed} failed`:''}${current?` · ${esc(current.name)}`:''}${current&&data.progress?.mb_downloaded?` · ${Number(data.progress.mb_downloaded).toFixed(1)} MB`:''}${j.retryAt>Date.now()?` · Cooling down · resumes ${esc(new Date(j.retryAt).toLocaleTimeString())}`:''}${j.status==='syncing'?' · Updating Navidrome…':''}${j.cancelRequested&&active.includes(j.status)?' · Stopping after current track':''}</span>${['partial','failed','cancelled'].includes(j.status)?`<button data-action="retry" data-id="${j.id}">Retry</button>`:['queued','resolving','downloading'].includes(j.status)?`<button data-action="cancel" data-id="${j.id}">Cancel</button>`:''}</div><p class="error" ${j.error?'':'hidden'}>${esc(j.error)}</p><details data-id="${esc(j.id)}" ${j.tracks.length?'':'hidden'}><summary>Track details</summary><div class="track-list">${j.tracks.map(t=>`<div class="track"><span>${esc(t.name)} <small>— ${esc(t.artists)}</small><p class="error" ${t.error?'':'hidden'}>${esc(t.error)}</p></span><small>${esc(t.status)}</small></div>`).join('')}</div></details></article>`;
    const incoming=template.content.firstElementChild;
    const card=cards.get(j.id)||incoming;
    if(card!==incoming)updateNode(card,incoming);
    const position=$('#jobs').children[index];
    if(position!==card)$('#jobs').insertBefore(card,position||null);
    cards.delete(j.id);
  });
  for(const card of cards.values())card.remove();
  // CSP disallows inline styles; set progress through the DOM API.
  document.querySelectorAll('[role="progressbar"]').forEach(el=>el.firstElementChild.style.width=`${el.getAttribute('aria-valuenow')}%`);
}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{message();await api('/api/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.password.value='';if(statePromise)await statePromise;await state();}catch(e){message(e);}finally{button.disabled=false;}});
$('#add-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{message();await api('/api/jobs',{method:'POST',body:JSON.stringify({url:e.target.url.value})});e.target.reset();await state();}catch(e){message(e);}finally{button.disabled=false;}});
$('#logout').onclick=async()=>{try{await api('/api/logout',{method:'POST',body:'{}'});showLogin();}catch(e){message(e);}};
$('#jobs').onclick=async e=>{const b=e.target.closest('button[data-action]');if(!b)return;b.disabled=true;try{await api(`/api/jobs/${b.dataset.id}/${b.dataset.action}`,{method:'POST',body:'{}'});await state();}catch(e){message(e);}finally{b.disabled=false;}};
state();setInterval(()=>{if(signedIn)state();},2000);
