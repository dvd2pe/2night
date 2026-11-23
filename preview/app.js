
'use strict';
(function(){
  const $ = (id) => document.getElementById(id);
  const base = location.pathname.replace(/(?:preview\/)?(?:index\.html)?$/, '');
  const root = base.endsWith('/') ? base : base + '/';
  const assetUrl = (value) => root + String(value || '').replace(/^\/+/, '');
  const state = {games:[],active:null,registry:null,screens:[],assets:[],filtered:[],selected:null,filter:'all',regions:[],screen:'title',inspect:false,snapshot:false,run:0,drag:null,replacement:null};
  const msg = (text,sticky) => { $('activity').textContent=text; $('stage-banner').textContent=text; $('stage-banner').classList.remove('hidden'); clearTimeout(msg.timer); if(!sticky)msg.timer=setTimeout(()=> $('stage-banner').classList.add('hidden'),4800); };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep = (n) => new Promise(r=>setTimeout(r,n));
  const keyCode = (key) => ({Enter:13,Escape:27,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Space:32})[key] || (key.length===1 ? key.toUpperCase().charCodeAt(0):0);
  const localKey = () => '2night:regions:v1:' + (state.active?.id || 'unknown');
  function readRegions(){try{state.regions=JSON.parse(localStorage.getItem(localKey())||'[]');if(!Array.isArray(state.regions))state.regions=[];}catch{state.regions=[];}}
  function saveRegions(){try{localStorage.setItem(localKey(),JSON.stringify(state.regions));}catch{}renderRegions();}
  async function json(url,fallback){try{const r=await fetch(assetUrl(url));if(!r.ok)throw Error(r.status);return await r.json();}catch(e){console.warn('2Night load',url,e);return fallback;}}
  function normalize(reg){
    if(!reg)return [];
    if(Array.isArray(reg.sprites)){
      const textures=reg.textures||[];
      const sprites=reg.sprites.map(s=>({id:'sprite:'+s.index,name:s.name,kind:'sprite',sub:(s.frameCount||0)+' frames · '+(s.width||'?')+'×'+(s.height||'?'),width:s.width,height:s.height,frames:s.frames||[],originX:s.originX,originY:s.originY,atlasUrl:textures.find(t=>t.index===(s.frames||[])[0]?.page)?.file,raw:s}));
      const atlases=textures.map(t=>({id:'texture:'+t.index,name:t.name,kind:'texture',sub:t.width+'×'+t.height,width:t.width,height:t.height,path:t.file,url:t.file,raw:t}));
      const objects=(reg.objects||[]).map(o=>({id:'object:'+o.index,name:o.name,kind:'object',sub:'GameMaker object',raw:o}));
      return sprites.concat(atlases,objects);
    }
    return (reg.files||[]).filter(f=>['png','jpg','jpeg','webp','mp3','ogg','xml','json','woff','ttf'].includes(f.type)).map(f=>({id:'file:'+f.path,name:f.path.split('/').pop(),kind:['png','jpg','jpeg','webp'].includes(f.type)?'image':['mp3','ogg'].includes(f.type)?'audio':'file',sub:f.path,width:f.width,height:f.height,path:f.path,url:f.path,raw:f}));
  }
  function gameTabs(){
    $('game-tabs').replaceChildren();
    for(const g of state.games){const b=document.createElement('button');b.textContent=g.name;b.className=state.active?.id===g.id?'active':'';b.onclick=()=>switchGame(g.id);$('game-tabs').append(b);}
  }
  function renderScreens(){
    $('screen-select').replaceChildren();
    for(const s of state.screens){const opt=document.createElement('option');opt.value=s.id;opt.textContent=s.name+(s.manualOnly?' · manual':'');$('screen-select').append(opt);}
    $('screen-select').value=state.screen;
    showScreenDescription();
  }
  function showScreenDescription(){const s=state.screens.find(x=>x.id===$('screen-select').value);$('scene-description').textContent=s?.description||'';}
  async function switchGame(id){
    state.run++;
    state.active=state.games.find(g=>g.id===id);if(!state.active)return;
    state.registry=null;state.assets=[];state.selected=null;state.replacement=null;state.filter='all';state.screen='title';
    leaveInspect();readRegions();gameTabs();renderRegions();renderInspector();
    $('footer-game').textContent=state.active.name;
    const token=state.run;
    const [registry,screenObj]=await Promise.all([json(state.active.registry,null),json(state.active.screens,{screens:[]})]);
    if(token!==state.run)return;
    state.registry=registry;state.assets=normalize(registry);state.screens=screenObj.screens||[];state.screen=state.screens[0]?.id||'title';
    renderScreens();renderAssets();loadGame();
  }
  function renderFilters(){
    const counts={all:state.assets.length};for(const a of state.assets)counts[a.kind]=(counts[a.kind]||0)+1;
    $('asset-filters').replaceChildren();
    for(const [kind,count] of Object.entries(counts)){
      const b=document.createElement('button');b.textContent=(kind==='all'?'All':kind)+' '+count;b.className=state.filter===kind?'active':'';b.onclick=()=>{state.filter=kind;renderAssets();};$('asset-filters').append(b);
    }
  }
  function renderAssets(){
    renderFilters();const search=$('asset-search').value.trim().toLowerCase();
    state.filtered=state.assets.filter(a=>(state.filter==='all'||a.kind===state.filter)&&(a.name.toLowerCase().includes(search)||(a.path||'').toLowerCase().includes(search)));
    $('asset-count').textContent=state.filtered.length+' / '+state.assets.length;
    const list=$('asset-list');list.replaceChildren();
    if(!state.filtered.length){list.innerHTML='<p class="notice">Nessun asset trovato. Cambia ricerca o filtro.</p>';return;}
    const fragment=document.createDocumentFragment();
    for(const a of state.filtered.slice(0,400)){
      const b=document.createElement('button');b.className='asset-item'+(a.id===state.selected?.id?' active':'');
      const icon=document.createElement('span');icon.className='asset-icon';icon.textContent=a.kind==='sprite'?'▧':a.kind==='audio'?'♫':a.kind==='image'?'▧':a.kind==='texture'?'◈':'◇';
      const text=document.createElement('span');text.className='asset-text';text.innerHTML='<strong>'+esc(a.name)+'</strong><small>'+esc(a.sub||a.kind)+'</small>';
      b.append(icon,text);b.onclick=()=>selectAsset(a);fragment.append(b);
    }
    list.append(fragment);
    if(state.filtered.length>400){const p=document.createElement('p');p.className='hint';p.textContent='Mostrati 400 di '+state.filtered.length+' elementi; usa la ricerca.';list.append(p);}
  }
  function selectAsset(a){
    state.selected=a;state.replacement=null;renderInspector();renderAssets();
    if(state.inspect&&state.regions.some(r=>r.screen===state.screen&&r.id===state.currentRegionId)) {
      const r=state.regions.find(r=>r.id===state.currentRegionId);r.assetId=a.id;r.assetName=a.name;saveRegions();msg('Regione associata a '+a.name);
    }
  }
  function addProperty(label,value){const el=document.createElement('div');el.className='property-row';el.innerHTML='<span>'+esc(label)+'</span><span>'+esc(value ?? '—')+'</span>';$('asset-meta').append(el);}
  function renderInspector(){
    const a=state.selected;
    $('inspector-empty').classList.toggle('hidden',!!a);
    $('inspector-content').classList.toggle('hidden',!a);
    $('inspector-kind').textContent=a?.kind||'—';
    if(!a)return;
    $('asset-title').textContent=a.name;$('asset-path').textContent=a.path||a.atlasUrl||a.id;
    $('asset-meta').replaceChildren();addProperty('Tipo',a.kind);addProperty('Dimensioni',a.width&&a.height?a.width+' × '+a.height:'—');
    if(a.frames)addProperty('Frame',a.frames.length);
    if(a.raw?.sizeBytes)addProperty('Dimensione file',Math.round(a.raw.sizeBytes/1024)+' KB');
    if(a.originX!==undefined)addProperty('Origine',a.originX+', '+a.originY);
    const preview=$('asset-preview');preview.replaceChildren();
    if(state.replacement){const img=document.createElement('img');img.src=state.replacement;img.alt='Texture locale sostitutiva';preview.append(img);return;}
    if(a.kind==='sprite'&&a.atlasUrl&&a.frames?.length){
      const f=a.frames[0];const img=new Image();img.onload=()=>{
        if(state.selected!==a)return;
        const c=document.createElement('canvas');const w=Math.max(1,f.w),h=Math.max(1,f.h);c.width=w;c.height=h;
        const ctx=c.getContext('2d');ctx?.drawImage(img,f.x,f.y,w,h,0,0,w,h);
        c.style.cssText='max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated';
        preview.replaceChildren(c);
      };img.onerror=()=>preview.textContent='Atlas non disponibile';img.src=assetUrl('games/'+state.active.id+'/'+a.atlasUrl);
    }else if(['image','texture'].includes(a.kind)&&a.url){
      const img=document.createElement('img');img.src=assetUrl('games/'+state.active.id+'/'+a.url);img.alt=a.name;preview.append(img);
    }else{preview.innerHTML='<div class="no-preview">Anteprima immagine non disponibile</div>';}
  }
  function renderRegions(){
    const regions=state.regions.filter(r=>r.screen===state.screen);const list=$('region-list');list.replaceChildren();
    $('regions-hint').textContent=regions.length?regions.length+' regioni salvate su questo dispositivo':'Nessuna regione su questa schermata.';
    for(const r of regions){
      const row=document.createElement('div');row.className='region-item';
      const select=document.createElement('button');select.className=r.id===state.currentRegionId?'active':'';select.textContent=r.assetName||r.name||'Regione '+r.id.slice(-4);
      select.title='Seleziona regione';select.onclick=()=>{state.currentRegionId=r.id;const a=state.assets.find(a=>a.id===r.assetId);if(a)selectAsset(a);else renderInspector();renderRegions();showRegion(r);};
      const del=document.createElement('button');del.textContent='✕';del.title='Elimina regione';del.onclick=()=>{state.regions=state.regions.filter(x=>x.id!==r.id);if(state.currentRegionId===r.id)state.currentRegionId=null;saveRegions();$('selection-box').classList.add('hidden');};
      row.append(select,del);list.append(row);
    }
  }
  function loadGame(){
    if(!state.active)return;
    const token=++state.run;leaveInspect();
    const frame=$('game-frame');frame.onload=()=>{if(token!==state.run)return;msg('Gioco caricato. Premi ⌨ Focus e usa la tastiera.');};
    frame.src=assetUrl(state.active.src)+'?previewReload='+token;
    msg('Caricamento '+state.active.name+'…',true);
  }
  function sendKey(k){
    const frame=$('game-frame');
    let win,doc;try{win=frame.contentWindow;doc=frame.contentDocument;if(!win||!doc)return false;}catch{return false;}
    const code=keyCode(k), key=k==='Space'?' ':k;
    try{
      if(k==='Enter'||k.startsWith('Arrow')||k==='Escape')win.focus();
      if(typeof win.__openflKeyDown==='function'&&typeof win.__openflKeyUp==='function'){
        win.__openflKeyDown.call(win.__openflKeyDownWin||win,code);
        setTimeout(()=>{try{win.__openflKeyUp.call(win.__openflKeyUpWin||win,code);}catch{}},110);return true;
      }
      if(typeof win.__sendKey==='function'){win.__sendKey(key,code);return true;}
      for(const target of [win,doc]){
        const opt={key,code:k,keyCode:code,which:code,bubbles:true,cancelable:true};
        const down=new KeyboardEvent('keydown',opt),up=new KeyboardEvent('keyup',opt);
        try{Object.defineProperties(down,{keyCode:{get:()=>code},which:{get:()=>code}});Object.defineProperties(up,{keyCode:{get:()=>code},which:{get:()=>code}});}catch{}
        target.dispatchEvent(down);setTimeout(()=>{try{target.dispatchEvent(up);}catch{}},90);
      }
      return false;
    }catch(e){console.warn('Key send failed',e);return false;}
  }
  async function goScreen(){
    const s=state.screens.find(x=>x.id===$('screen-select').value);if(!s)return;
    state.screen=s.id;renderRegions();
    if(s.manualOnly){msg('Schermata manuale: '+s.name+'. Naviga usando i tasti del gioco.');return;}
    if(!s.steps?.length){loadGame();msg('Apertura schermata iniziale…',true);return;}
    const token=++state.run;const frame=$('game-frame');leaveInspect();
    frame.src=assetUrl(state.active.src)+'?navigation='+token;
    msg('Avvio '+s.name+'…',true);
    await new Promise(resolve=>{const done=()=>resolve();frame.addEventListener('load',done,{once:true});setTimeout(done,20000);});
    if(token!==state.run)return;
    const delay=Math.max(1000,Math.min(45000,state.active.bootDelayMs||3000));
    msg('Attendo il motore del gioco ('+Math.round(delay/1000)+'s)…',true);
    await sleep(delay);
    let bridgeUsed=true;
    for(let i=0;i<s.steps.length;i++){
      if(token!==state.run)return;
      const step=s.steps[i];
      msg('Navigazione '+s.name+' · tasto '+(i+1)+'/'+s.steps.length+': '+step.k,true);
      if(!sendKey(step.k))bridgeUsed=false;
      await sleep(Math.max(150,Math.min(12000,step.delay||500)));
    }
    if(token===state.run)msg(bridgeUsed?'Sequenza completata: verifica la schermata.':'Sequenza inviata con fallback DOM: alcuni motori ignorano i tasti sintetici; naviga manualmente se necessario.');
  }
  function fitSurface(){
    const layer=$('inspect-layer'),img=$('snapshot-img'),surface=$('drawing-surface');
    if(!state.snapshot){surface.style.cssText='left:0;top:0;width:100%;height:100%';return;}
    const r=img.getBoundingClientRect(),p=layer.getBoundingClientRect();
    surface.style.left=(r.left-p.left)+'px';surface.style.top=(r.top-p.top)+'px';surface.style.width=r.width+'px';surface.style.height=r.height+'px';
  }
  function capture(){
    if(!state.active)return;
    if(state.inspect){leaveInspect();return;}
    const frame=$('game-frame');let canvas;
    try{canvas=frame.contentDocument?.querySelector('canvas');}catch{}
    state.snapshot=false;
    const layer=$('inspect-layer'),img=$('snapshot-img');
    try{
      if(canvas&&canvas.width&&canvas.height){
        img.src=canvas.toDataURL('image/png');
        img.classList.remove('hidden');state.snapshot=true;layer.style.background='#0e1420';
      }else throw Error('Canvas non trovato');
      msg('Snapshot acquisito. Trascina sullo sprite da annotare.');
    }catch(e){
      img.removeAttribute('src');img.classList.add('hidden');
      layer.style.background='transparent';
      msg('Overlay live: snapshot canvas non disponibile ('+e.message+'). Trascina per annotare elementi visibili.');
    }
    state.inspect=true;layer.classList.remove('hidden');$('exit-inspect').classList.remove('hidden');$('capture').textContent='◫ Inspect attivo';$('stage-mode').textContent='INSPECT MODE';
    requestAnimationFrame(fitSurface);
  }
  function leaveInspect(){
    state.inspect=false;state.drag=null;$('inspect-layer').classList.add('hidden');$('selection-box').classList.add('hidden');
    $('exit-inspect').classList.add('hidden');$('capture').textContent='◫ Snapshot / Inspect';$('stage-mode').textContent='GAME LIVE';
  }
  function regionBox(x,y,w,h){
    const r=$('drawing-surface').getBoundingClientRect();const p=$('inspect-layer').getBoundingClientRect(),box=$('selection-box');
    box.style.left=(r.left-p.left+x*r.width)+'px';box.style.top=(r.top-p.top+y*r.height)+'px';box.style.width=w*r.width+'px';box.style.height=h*r.height+'px';
    box.classList.remove('hidden');
  }
  function showRegion(region){if(!state.inspect)return;regionBox(region.x,region.y,region.w,region.h);}
  function setupDrawing(){
    const s=$('drawing-surface');
    const point=e=>{const r=s.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
    s.addEventListener('pointerdown',e=>{if(e.button!==0)return;s.setPointerCapture(e.pointerId);state.drag={start:point(e)};$('selection-box').classList.add('hidden');});
    s.addEventListener('pointermove',e=>{if(!state.drag)return;const end=point(e),start=state.drag.start;regionBox(Math.min(start.x,end.x),Math.min(start.y,end.y),Math.abs(end.x-start.x),Math.abs(end.y-start.y));});
    s.addEventListener('pointerup',e=>{
      if(!state.drag)return;const end=point(e),start=state.drag.start;state.drag=null;
      const r={id:'r'+Date.now()+'-'+Math.random().toString(36).slice(2,6),screen:state.screen,x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y),assetId:state.selected?.id||null,assetName:state.selected?.name||null,name:'Region'};
      if(r.w<.005||r.h<.005){$('selection-box').classList.add('hidden');return;}
      state.regions.push(r);state.currentRegionId=r.id;saveRegions();showRegion(r);
      msg('Regione salvata. Seleziona uno sprite nell’Asset Explorer per associarlo.');
    });
    window.addEventListener('resize',()=>{if(state.inspect){fitSurface();const r=state.regions.find(x=>x.id===state.currentRegionId);if(r)showRegion(r);}});
  }
  function exportAnnotations(){
    const data={game:state.active?.id,exportedAt:new Date().toISOString(),regions:state.regions};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(state.active?.id||'2night')+'-annotations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function init(){
    setupDrawing();
    $('asset-search').addEventListener('input',renderAssets);$('screen-select').addEventListener('change',showScreenDescription);
    $('go-screen').onclick=goScreen;$('reload-game').onclick=()=>{state.screen='title';loadGame();};
    $('focus-game').onclick=()=>{try{$('game-frame').contentWindow?.focus();}catch{}msg('Focus inviato al gioco: usa frecce e Invio.');};
    $('fullscreen').onclick=()=>{const e=$('main-stage');if(document.fullscreenElement)document.exitFullscreen();else e.requestFullscreen?.();};
    $('capture').onclick=capture;$('exit-inspect').onclick=leaveInspect;
    $('export-annotations').onclick=exportAnnotations;
    $('clear-annotations').onclick=()=>{if(confirm('Eliminare tutte le annotazioni locali di questo gioco?')){state.regions=[];state.currentRegionId=null;saveRegions();$('selection-box').classList.add('hidden');}};
    $('replacement-file').onchange=e=>{const f=e.target.files?.[0];if(!f||!state.selected)return;if(!f.type.startsWith('image/'))return msg('Seleziona un’immagine valida.');const reader=new FileReader();reader.onload=()=>{state.replacement=reader.result;renderInspector();msg('Anteprima reskin locale applicata al pannello (gioco originale non modificato).');};reader.readAsDataURL(f);};
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.inspect)leaveInspect();});
    const index=await json('games/index.json',{games:[]});state.games=index.games||[];
    if(!state.games.length){msg('Impossibile caricare games/index.json. Verifica che il deploy contenga public/games.',true);return;}
    await switchGame(state.games[0].id);
  }
  init().catch(e=>{console.error(e);msg('Errore nell’inizializzazione: '+e.message,true);});
})();
