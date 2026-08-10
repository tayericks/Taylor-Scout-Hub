import React,{useEffect,useMemo,useRef,useState}from'react';
import{MapContainer,Marker,TileLayer}from'react-leaflet';
import L from'leaflet';
import maplibregl from'maplibre-gl';
import{ArrowLeft,ChevronDown,GripVertical,MapPin,Plus,Printer,Save,Trash2}from'lucide-react';
import'leaflet/dist/leaflet.css';
import'maplibre-gl/dist/maplibre-gl.css';
import'./crew-maps-design-board.css';
import{supabase}from'../supabase';

const MAP_TYPES=['CREW','PREP / STRIKE','GRIP & ELECTRIC','TRUCKS','BACKGROUND','SHOOT DAY','CUSTOM'];
const ORIGINS=[{id:'valley',name:'Valley',lat:34.2011,lng:-118.5360},{id:'westside',name:'Santa Monica / Westside',lat:34.0195,lng:-118.4912},{id:'eastside',name:'Eastside / Downtown',lat:34.0522,lng:-118.2437}];
const PALETTE=['SET','CREW PARKING','VIP PARKING','BASECAMP','CATERING','TRUCK PARKING','BG HOLDING','LUNCH','RESTROOMS','CUSTOM'];
const TRAUMA_CENTERS=[
 {name:'Providence Holy Cross Medical Center',level:'II',address:'15031 Rinaldi St, Mission Hills, CA 91345',phone:'818-365-8051'},
 {name:'Ronald Reagan UCLA Medical Center',level:'I',address:'757 Westwood Plaza, Los Angeles, CA 90095',phone:'310-825-9111'},
 {name:'Cedars-Sinai Medical Center',level:'I',address:'8700 Beverly Blvd, Los Angeles, CA 90048',phone:'310-423-3277'},
 {name:'LA General Medical Center',level:'I',address:'2051 Marengo St, Los Angeles, CA 90033',phone:'323-409-1000'}
];
const uid=()=>crypto.randomUUID();
const fmt=v=>{if(!v)return'';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})};
const range=e=>{const a=e?.shootStart||'',b=e?.shootEnd||a;return a?(a===b?fmt(a):`${fmt(a)} – ${fmt(b)}`):''};
function deepFind(obj,terms){if(!obj||typeof obj!=='object')return'';const w=terms.map(x=>x.toLowerCase());const walk=(v,k='')=>{if(v==null)return'';if(typeof v==='string'&&w.some(t=>k.toLowerCase().includes(t))&&v.trim())return v.trim();if(Array.isArray(v)){for(const x of v){const h=walk(x,k);if(h)return h}}else if(typeof v==='object'){for(const[k2,x]of Object.entries(v)){if(typeof x==='string'&&w.some(t=>k2.toLowerCase().includes(t))&&x.trim())return x.trim();const h=walk(x,k2);if(h)return h}}return''};return walk(obj)}
async function geocode(address){if(!address)return null;try{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`,{headers:{'Accept-Language':'en'}});const j=await r.json();return j?.[0]?[+j[0].lat,+j[0].lon]:null}catch{return null}}
function miles(a,b){if(!a||!b)return Infinity;const R=3958.8,dLat=(b[0]-a[0])*Math.PI/180,dLng=(b[1]-a[1])*Math.PI/180,la1=a[0]*Math.PI/180,la2=b[0]*Math.PI/180;const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
async function nearestTraumaCenter(setPoint){if(!setPoint)return null;const rows=await Promise.all(TRAUMA_CENTERS.map(async h=>({...h,point:await geocode(h.address)})));return rows.filter(h=>h.point).sort((a,b)=>miles(setPoint,a.point)-miles(setPoint,b.point))[0]||null}
function stepText(s){const m=s.maneuver||{},name=(s.name||'').toUpperCase(),mod=(m.modifier||'').toUpperCase().replaceAll('_',' '),mi=s.distance?`${(s.distance/1609.344).toFixed(1)} MI`:'';if(m.type==='off ramp')return`Take ${name||'the next'} EXIT`;if(m.type==='on ramp'||m.type==='merge')return`Take ${name||'freeway ramp'}`;if(m.type==='turn')return`Turn ${mod||''}${name?` onto ${name}`:''}${s.distance>350?` and go ${mi}`:''}`.replace(/\s+/g,' ').trim();if(m.type==='continue'||m.type==='new name')return`Continue${name?` on ${name}`:''}${s.distance>500?` for ${mi}`:''}`;if(m.type==='arrive')return'Arrive at destination. Park as directed.';return''}
async function route(origin,dest){if(!dest)return null;try{const u=`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest[1]},${dest[0]}?overview=full&geometries=geojson&steps=true`;const r=await fetch(u),j=await r.json(),rt=j.routes?.[0],steps=rt?.legs?.[0]?.steps||[];if(!rt)return null;let exit=steps.map(s=>s.maneuver?.type).lastIndexOf('off ramp');if(exit<0)exit=Math.max(0,steps.length-5);const tail=[];for(const s of steps.slice(exit)){for(const c of s.geometry?.coordinates||[])tail.push([c[1],c[0]])}const instructions=steps.filter(s=>s.distance>30||s.maneuver?.type==='arrive').map(stepText).filter(Boolean);return{origin,tail,instructions}}catch{return null}}
function routeLength(points=[]){let total=0;for(let i=1;i<points.length;i++)total+=miles(points[i-1],points[i]);return total}
function chooseLocalRoute(routes=[]){return routes.filter(r=>(r.tail||[]).length>1).sort((a,b)=>routeLength(a.tail)-routeLength(b.tail))[0]||null}
function mapIcon(label,color='#e31b23'){return L.divIcon({className:'cmb-icon',html:`<div style="--c:${color}" class="cmb-pin">${label}</div>`,iconSize:[34,34],iconAnchor:[17,17]})}
function Brand(){return <span className="cmb-brand"><b>TAYLOR SCOUT</b><small>CREW MAPS</small></span>}
function toolHref(base,show){const u=new URL(base,window.location.origin);u.searchParams.set('show',show.id);u.searchParams.set('showId',show.id);u.searchParams.set('showName',show.name||'');u.searchParams.set('fromHub','1');return u.toString()}
function ToolNav({show}){return <nav className="cmb-shell-toolnav"><a href={toolHref('https://budget.taylorscout.com',show)}>Budget</a><a href={toolHref('https://bible.taylorscout.com',show)}>Bible</a><a href={toolHref('https://calendar.taylorscout.com',show)}>Calendar</a><a href={toolHref('/waypoint',show)}>Waypoint</a></nav>}
function PinLogo(){return <svg viewBox="0 0 74 92" aria-hidden="true"><path className="o" d="M37 3C18 3 5 17 5 36c0 22 17 40 32 53 15-13 32-31 32-53C69 17 56 3 37 3Z"/><path className="m" d="M16 39l15-13 8 7 10-10 12 14-12-8-10 10-8-7-15 7Z"/><path className="r" d="M19 69c12-14 24-18 31-27-3 14-12 22-20 31l7 8-9 2-9-14Z"/></svg>}
function calloutClass(type=''){return`cmb-map-callout ${String(type).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`}

function VectorStreetMap({data,onCalloutMove,onCalloutEdit}){
 const ref=useRef(null),markers=useRef([]);
 useEffect(()=>{
  if(!ref.current)return;
  let map;
  try{
   const center=data.destPoint||data.setPoint||[34.05,-118.25];
   map=new maplibregl.Map({container:ref.current,style:'https://tiles.openfreemap.org/styles/bright',center:[center[1],center[0]],zoom:14.2,attributionControl:false});
   map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
   map.on('load',()=>{
    for(const layer of map.getStyle().layers||[]){
     const id=(layer.id||'').toLowerCase();
     const major=/(motorway|trunk|highway)/.test(id);
     const roadLine=layer.type==='line'&&/(road|street|highway|motorway|trunk|bridge|tunnel|transportation)/.test(id);
     const roadLabel=layer.type==='symbol'&&/(road|street|highway|motorway|trunk|shield)/.test(id);
     if(layer.type==='background'){
      try{map.setPaintProperty(layer.id,'background-color','#fff')}catch{}
     }else if(roadLine){
      try{
       map.setPaintProperty(layer.id,'line-color',major?'#111':'#8d9398');
       map.setPaintProperty(layer.id,'line-opacity',major?.92:.72);
       map.setPaintProperty(layer.id,'line-width',major?2.4:1.05);
      }catch{}
     }else if(roadLabel){
      try{
       map.setPaintProperty(layer.id,'text-color','#111');
       map.setPaintProperty(layer.id,'text-halo-color','#fff');
       map.setPaintProperty(layer.id,'text-halo-width',1.5);
      }catch{}
     }else{
      try{map.setLayoutProperty(layer.id,'visibility','none')}catch{}
     }
    }

    const local=chooseLocalRoute(data.routes||[]);
    const routePoints=local?.tail||[];
    if(routePoints.length>1){
     const coords=routePoints.map(p=>[p[1],p[0]]);
     map.addSource('crew-route',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:coords}}});
     map.addLayer({id:'crew-route-line',type:'line',source:'crew-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ef2020','line-width':6,'line-opacity':.5}});
    }

    markers.current.forEach(m=>m.remove());markers.current=[];
    const visibleCallouts=(data.callouts||[]).filter(c=>c.visible!==false&&c.point);
    visibleCallouts.forEach(c=>{
     const el=document.createElement('div');
     el.className=calloutClass(c.type);
     el.innerHTML=`<span>${c.icon||''}</span><b>${c.label||c.type}</b><button type="button" class="cmb-callout-edit" aria-label="Edit callout">✎</button>`;
     const edit=el.querySelector('.cmb-callout-edit');
     edit?.addEventListener('pointerdown',e=>e.stopPropagation());
     edit?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const next=window.prompt('Edit map callout label',c.label||c.type);if(next?.trim())onCalloutEdit?.(c.id,next.trim())});
     el.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();const next=window.prompt('Edit map callout label',c.label||c.type);if(next?.trim())onCalloutEdit?.(c.id,next.trim())});
     const mk=new maplibregl.Marker({element:el,draggable:true,anchor:'bottom'}).setLngLat([c.point[1],c.point[0]]).addTo(map);
     mk.on('dragend',()=>{const p=mk.getLngLat();onCalloutMove(c.id,[p.lat,p.lng])});
     markers.current.push(mk);
    });

    const fit=[...routePoints,...visibleCallouts.map(c=>c.point),data.destPoint,data.setPoint].filter(Boolean);
    if(fit.length>1){
     const b=new maplibregl.LngLatBounds();fit.forEach(p=>b.extend([p[1],p[0]]));
     map.fitBounds(b,{padding:{top:72,right:145,bottom:74,left:90},maxZoom:15.4,duration:0});
    }
   });
   map.on('error',e=>console.error('Crew Maps vector map error',e?.error||e));
  }catch(e){console.error('Crew Maps vector map init failed',e)}
  return()=>{markers.current.forEach(m=>m.remove());markers.current=[];map?.remove()}
 },[data.id,JSON.stringify(data.routes),JSON.stringify(data.callouts)]);
 return <div className="cmb-vector-map" ref={ref}/>;
}

export default function CrewMapsDesignBoard({show,onBack}){
 const[loading,setLoading]=useState(true),[error,setError]=useState(''),[events,setEvents]=useState([]),[locations,setLocations]=useState([]),[bibles,setBibles]=useState([]),[maps,setMaps]=useState([]),[settings,setSettings]=useState({signCode:'TFS',defaultPaper:'legal'}),[eventId,setEventId]=useState(''),[mapType,setMapType]=useState('CREW'),[active,setActive]=useState(null),[busy,setBusy]=useState(false);
 const event=events.find(x=>x.id===eventId)||null;
 const loc=useMemo(()=>event?locations.find(l=>l.id===event.locationId)||locations.find(l=>l.location_name===event.location)||null:null,[event,locations]);
 useEffect(()=>{let dead=false;(async()=>{const[cal,l,b,cm,st]=await Promise.all([supabase.from('tool_documents').select('payload').eq('show_id',show.id).eq('tool_key','calendar').maybeSingle(),supabase.from('production_locations').select('*').eq('show_id',show.id),supabase.from('tool_documents').select('tool_key,payload').eq('show_id',show.id).like('tool_key','bible-location:%'),supabase.from('tool_documents').select('tool_key,payload,updated_at').eq('show_id',show.id).like('tool_key','crew-map:%').order('updated_at',{ascending:false}),supabase.from('tool_documents').select('payload').eq('show_id',show.id).eq('tool_key','crew-maps-settings').maybeSingle()]);if(dead)return;const bad=[cal,l,b,cm,st].find(x=>x.error);if(bad)setError(bad.error.message);else{const ev=(cal.data?.payload?.events||[]).filter(x=>x.eventType!=='note');setEvents(ev);setEventId(ev[0]?.id||'');setLocations((l.data||[]).filter(x=>!x.metadata?.archived_at));setBibles(b.data||[]);setMaps((cm.data||[]).map(x=>({...x.payload,toolKey:x.tool_key,updatedAt:x.updated_at})));if(st.data?.payload)setSettings(s=>({...s,...st.data.payload}))}setLoading(false)})();return()=>{dead=true}},[show.id]);
 const bibleFor=id=>{const r=bibles.find(x=>x.tool_key===`bible-location:${id}`);return r?.payload?.record||r?.payload||{}};
 async function generate(){if(!event)return;setBusy(true);setError('');try{const b=bibleFor(loc?.id||event.locationId);const setAddress=loc?.address||event.address||deepFind(b,['locationAddress','setAddress','address'])||'';const crew=deepFind(b,['crewParkingAddress','crew_parking_address','parkingAddress','parking_address'])||setAddress;const basecamp=deepFind(b,['basecampAddress','base_camp_address']);const catering=deepFind(b,['cateringAddress','catering_address']);const vip=deepFind(b,['vipParkingAddress','vip_parking_address']);const[setPoint,destPoint,basePoint,cateringPoint,vipPoint]=await Promise.all([geocode(setAddress),geocode(crew),geocode(basecamp),geocode(catering),geocode(vip)]);if(!destPoint)throw new Error('Crew Maps could not locate the destination address.');const[routes,hospital]=await Promise.all([(async()=> (await Promise.all(ORIGINS.map(o=>route(o,destPoint)))).filter(Boolean))(),nearestTraumaCenter(setPoint||destPoint)]);const id=uid(),cards=[{id:uid(),type:'SET',title:event.set||'SET',name:event.location||loc?.location_name||'',address:setAddress,point:setPoint},{id:uid(),type:'CREW PARKING',title:'CREW PARKING',name:'',address:crew,point:destPoint},basecamp&&{id:uid(),type:'BASECAMP',title:'BASECAMP',name:'',address:basecamp,point:basePoint},catering&&{id:uid(),type:'CATERING',title:'CATERING',name:'',address:catering,point:cateringPoint},vip&&{id:uid(),type:'VIP PARKING',title:'VIP PARKING',name:'',address:vip,point:vipPoint}].filter(Boolean);const icons={SET:'★','CREW PARKING':'P','VIP PARKING':'VIP',BASECAMP:'B',CATERING:'🍴'};const callouts=cards.filter(c=>c.point).map(c=>({id:uid(),cardId:c.id,type:c.type,label:c.title,icon:icons[c.type]||'',point:c.point,visible:c.type==='SET'||c.type==='CREW PARKING'}));const contact={name:deepFind(b,['locationManager','keyName','keyAssistant','contactName'])||'',phone:deepFind(b,['locationManagerPhone','keyPhone','contactPhone'])||'',role:'KEY ASSISTANT LOCATION'};const m={id,episode:event.episode||loc?.episode_name||'',scenes:event.scenes||'',unit:event.unit||'',mapType,location:event.location||loc?.location_name||'LOCATION',set:event.set||loc?.set_name||'',shootStart:event.shootStart||'',shootEnd:event.shootEnd||event.shootStart||'',setAddress,crewParkingAddress:crew,setPoint,destPoint,routes,signCode:settings.signCode||'TFS',warning:deepFind(b,['warning','crew note','parking note'])||'',cards,slots:[cards[0]?.id||null,cards[1]?.id||null,null,null],callouts,contact,directions:Object.fromEntries(routes.map(r=>[r.origin.id,r.instructions.join('\n')])),hospital,paper:settings.defaultPaper||'legal',createdAt:new Date().toISOString()};const{data:{user}}=await supabase.auth.getUser();const{error:e}=await supabase.from('tool_documents').upsert({show_id:show.id,tool_key:`crew-map:${id}`,payload:m,revision:1,updated_by:user?.id||null},{onConflict:'show_id,tool_key'});if(e)throw e;setMaps(v=>[m,...v]);setActive(m)}catch(e){setError(e.message||String(e))}finally{setBusy(false)}}
 async function save(m){setActive(m);setMaps(v=>v.map(x=>x.id===m.id?m:x));const{data:{user}}=await supabase.auth.getUser();await supabase.from('tool_documents').upsert({show_id:show.id,tool_key:`crew-map:${m.id}`,payload:m,updated_by:user?.id||null},{onConflict:'show_id,tool_key'})}
 async function del(m){if(!confirm(`Delete ${m.location} Crew Map?`))return;await supabase.from('tool_documents').delete().eq('show_id',show.id).eq('tool_key',`crew-map:${m.id}`);setMaps(v=>v.filter(x=>x.id!==m.id))}
 const groups=useMemo(()=>{const g={};for(const m of maps){const k=m.episode||'Unassigned';(g[k]||(g[k]=[])).push(m)}return Object.entries(g).sort(([a],[b])=>String(a).localeCompare(String(b),undefined,{numeric:true}))},[maps]);
 if(active)return <Board show={show} map={active} onBack={()=>setActive(null)} onSave={save} onDashboard={onBack}/>;
 return <div className="cmb-home"><header><button onClick={onBack}><Brand/></button><b>{show.name}</b></header><main><button className="cmb-back" onClick={onBack}><ArrowLeft size={15}/>Show Dashboard</button><h1>Crew Maps</h1><p>Choose a scheduled location, generate the locked template, then arrange the production information.</p>{error&&<div className="cmb-error">{error}</div>}<section className="cmb-generate"><label><small>CALENDAR / LOCATION</small><div><select value={eventId} onChange={e=>setEventId(e.target.value)}><option value="">Select…</option>{events.map(e=><option key={e.id} value={e.id}>{e.location||e.set} — {e.set||''} — {range(e)}</option>)}</select><ChevronDown/></div></label><label><small>MAP TYPE</small><div><select value={mapType} onChange={e=>setMapType(e.target.value)}>{MAP_TYPES.map(x=><option key={x}>{x}</option>)}</select><ChevronDown/></div></label><button disabled={!event||busy} onClick={generate}>{busy?'Generating…':'Generate Map'}</button></section><section className="cmb-saved"><h2>Saved Maps</h2>{loading?<p>Loading…</p>:groups.map(([ep,items])=><div className="cmb-ep" key={ep}><h3>Episode {ep}</h3>{items.map(m=><div className="cmb-row" key={m.id}><button onClick={()=>setActive(m)}><b>{m.location}</b><span>{m.set} · {m.mapType} · {range(m)}</span></button><button onClick={()=>del(m)}><Trash2 size={15}/></button></div>)}</div>)}</section></main></div>;
}

function Board({show,map,onBack,onSave,onDashboard}){
 const[d,setD]=useState(map),timer=useRef();
 useEffect(()=>setD(map),[map.id]);
 function patch(p){const n={...d,...p};setD(n);clearTimeout(timer.current);timer.current=setTimeout(()=>onSave(n),500)}
 function cardBy(id){return d.cards?.find(c=>c.id===id)}
 function drop(slot,id){const slots=[...(d.slots||[null,null,null,null])];slots[slot]=id;patch({slots})}
 function add(type){const c={id:uid(),type,title:type,name:'',address:'',point:null};patch({cards:[...(d.cards||[]),c]})}
 function editCard(id,p){patch({cards:d.cards.map(c=>c.id===id?{...c,...p}:c),callouts:(d.callouts||[]).map(x=>x.cardId===id?{...x,label:p.title??x.label}:x)})}
 async function toggleCallout(c){let point=c.point;if(!point&&c.address)point=await geocode(c.address);const existing=(d.callouts||[]).find(x=>x.cardId===c.id);if(existing){patch({callouts:d.callouts.map(x=>x.id===existing.id?{...x,visible:x.visible===false}:x)})}else if(point){patch({cards:d.cards.map(x=>x.id===c.id?{...x,point}:x),callouts:[...(d.callouts||[]),{id:uid(),cardId:c.id,type:c.type,label:c.title,icon:c.type==='SET'?'★':c.type==='CATERING'||c.type==='LUNCH'?'🍴':c.type==='RESTROOMS'?'🚻':c.type.includes('PARKING')?'P':c.type==='BASECAMP'?'B':'',point,visible:true}]})}}
 function moveCallout(id,point){patch({callouts:(d.callouts||[]).map(c=>c.id===id?{...c,point}:c)})}
 function editCallout(id,label){const target=(d.callouts||[]).find(c=>c.id===id);patch({callouts:(d.callouts||[]).map(c=>c.id===id?{...c,label}:c),cards:(d.cards||[]).map(c=>c.id===target?.cardId?{...c,title:label}:c)})}
 return <div className="cmb-board"><header className="cmb-toolbar cmb-ts-shell" data-shell-locked="1"><button className="cmb-ts-brand" onClick={onDashboard}><PinLogo/><span><b>TAYLOR SCOUT</b><small>PRODUCTION TOOLS</small></span></button><div className="cmb-native-title">CREW MAPS</div><div className="cmb-shell-actions"><ToolNav show={show}/><button className="cmb-shell-save" onClick={()=>onSave(d)}><Save size={15}/>Save</button><button className="cmb-shell-print" onClick={()=>window.print()}><Printer size={15}/>Print</button></div></header><aside className="cmb-app-sidebar"><div className="cmb-side-head"><b>{show.name}</b><small>CREW MAPS</small></div><button className="cmb-side-primary">MAP EDITOR</button><div className="cmb-side-section"><small>WORKSPACE</small><button className="active">Current Map</button><button onClick={onBack}>All Crew Maps</button></div><div className="cmb-side-spacer"/><button className="cmb-side-dashboard" onClick={onDashboard}>Show Dashboard</button></aside><main><aside className="cmb-palette"><h3>DRAG INFO TO BOXES</h3>{(d.cards||[]).map(c=><div className="cmb-cardbar-wrap" key={c.id}><div draggable onDragStart={e=>e.dataTransfer.setData('text/plain',c.id)} className="cmb-cardbar"><GripVertical size={14}/><div><b>{c.title}</b><span>{c.address||c.name||'Add details'}</span></div></div><button className="cmb-map-toggle" onClick={()=>toggleCallout(c)}><MapPin size={13}/>Map</button></div>)}<h4>ADD</h4>{PALETTE.map(x=><button key={x} onClick={()=>add(x)}><Plus size={13}/>{x}</button>)}<h4>CONTACT BOX</h4><div className="cmb-contact-editor"><input value={d.contact?.name||''} placeholder="Name" onChange={e=>patch({contact:{...(d.contact||{}),name:e.target.value}})}/><input value={d.contact?.phone||''} placeholder="Phone" onChange={e=>patch({contact:{...(d.contact||{}),phone:e.target.value}})}/><input value={d.contact?.role||''} placeholder="Role" onChange={e=>patch({contact:{...(d.contact||{}),role:e.target.value}})}/></div><div className="cmb-editlist">{(d.cards||[]).map(c=><details key={c.id}><summary>{c.title}</summary><input value={c.title} onChange={e=>editCard(c.id,{title:e.target.value})}/><input value={c.name||''} placeholder="Name" onChange={e=>editCard(c.id,{name:e.target.value})}/><textarea value={c.address||''} placeholder="Address / details" onChange={e=>editCard(c.id,{address:e.target.value})}/></details>)}</div><h4>DIRECTIONS</h4>{(d.routes||[]).map(r=><label key={r.origin.id}><small>{r.origin.name}</small><textarea rows="6" value={d.directions?.[r.origin.id]||''} onChange={e=>patch({directions:{...d.directions,[r.origin.id]:e.target.value}})}/></label>)}</aside><div className="cmb-canvas-scroll"><section className={`cmb-sheet ${d.paper==='letter'?'letter':'legal'}`}><div className="cmb-left"><div className="cmb-head"><div className="cmb-logo">{show.logo?<img src={show.logo}/>:<b>SHOW LOGO</b>}</div><div className="cmb-contact"><b>{d.contact?.name||'NAME'}</b><strong>{d.contact?.phone||'NUMBER'}</strong><span>{d.contact?.role||'KEY ASSISTANT LOCATION'}</span></div></div><div className="cmb-setname">{d.set||d.location}</div><div className="cmb-meta"><span>MAP IS CLOSE<br/>TO SCALE</span><b>{range(d)}</b><strong>{d.mapType}</strong></div><div className="cmb-warning" contentEditable suppressContentEditableWarning onBlur={e=>patch({warning:e.currentTarget.innerText})}>{d.warning||'WARNING/CUSTOM TEXT'}</div><div className="cmb-qrrow"><div className="cmb-qrtxt">Aim the camera on your smart phone on the QR Code to pull up Google Maps link to CREW PARKING</div><img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://www.google.com/maps/dir/?api=1&destination=${d.crewParkingAddress||d.setAddress}`)}`}/></div><div className="cmb-dir">{(d.routes||[]).map(r=><section key={r.origin.id}><h3>Directions from the {r.origin.name} to {d.crewParkingAddress?'CREW PARKING':'SET'}</h3><ol>{(d.directions?.[r.origin.id]||'').split('\n').filter(Boolean).map((x,i)=><li key={i}>{x}</li>)}</ol></section>)}</div><div className="cmb-hospital"><div className="h">H</div><div><b>NEAREST LEVEL I–III TRAUMA CENTER</b><span>{d.hospital?.name||'Finding verified trauma center…'}</span><strong>{d.hospital?.level?`LEVEL ${d.hospital.level}`:''}</strong><small>{d.hospital?.address||''}{d.hospital?.phone?` · ${d.hospital.phone}`:''}</small></div></div></div><div className="cmb-right"><div className="cmb-look"><small>LOOK FOR:</small><b>{d.signCode||'TFS'}</b><strong>➜</strong></div><div className="cmb-map"><VectorStreetMap data={d} onCalloutMove={moveCallout} onCalloutEdit={editCallout}/></div><div className="cmb-dropgrid">{[0,1,2,3].map(i=>{const c=cardBy(d.slots?.[i]);return <div className={`cmb-drop ${c?'filled':''}`} key={i} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(i,e.dataTransfer.getData('text/plain'))}>{c?<><b>{c.title}</b><strong>{c.name}</strong><span>{c.address}</span></>:<>DRAG AND DROP<br/>INFO TO BOXES</>}</div>})}</div><div className="cmb-inset"><MapContainer center={d.setPoint||[34.05,-118.25]} zoom={9} zoomControl={false} dragging={false} scrollWheelZoom={false} attributionControl={false}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{d.setPoint&&<Marker position={d.setPoint} icon={mapIcon('LOCATION','#e51f25')}/>}</MapContainer></div></div></section></div></main></div>;
}
