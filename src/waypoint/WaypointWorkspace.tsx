import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, ChevronDown, DollarSign, MapPin, Plus, Trash2 } from 'lucide-react';
import WaypointApp from './WaypointApp';
import { supabase } from '../supabase';
import './waypoint.css';
import './waypoint-refresh.css';

type Props = { show:any; onBack?:()=>void };
type CalendarEvent = {
  id:string; episode?:string; scenes?:string; unit?:string; set?:string; location?:string; address?:string;
  shootStart?:string; shootEnd?:string; locationId?:string;
};
type LocationRecord = { id?:string; location_name?:string; address?:string; metadata?:any };
type SchematicContext = {
  id:string; toolKey:string; calendarEventId?:string; locationId?:string; episode?:string; scenes?:string; unit?:string;
  set?:string; location?:string; address?:string; shootStart?:string; shootEnd?:string; latitude?:number; longitude?:number;
};

const HUB_URL = import.meta.env.VITE_HUB_URL || 'https://www.taylorscout.com';
const BUDGET_URL = import.meta.env.VITE_BUDGET_URL || 'https://budget.taylorscout.com';
const BIBLE_URL = import.meta.env.VITE_BIBLE_URL || 'https://bible.taylorscout.com';
const CALENDAR_URL = import.meta.env.VITE_CALENDAR_URL || 'https://calendar.taylorscout.com';

function link(base:string, show:any){const u=new URL(base,window.location.origin);u.searchParams.set('show',show.id);u.searchParams.set('showId',show.id);u.searchParams.set('showName',show.name||'');return u.toString()}
function dateLabel(e:CalendarEvent){
  const a=e.shootStart||'',b=e.shootEnd||a;
  const f=(v:string)=>{if(!v)return '';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})};
  return a?(a===b?f(a):`${f(a)} – ${f(b)}`):'';
}
function WaypointLogo(){return <span className="wp-menu-logo"><svg viewBox="0 0 74 50" aria-hidden="true"><circle cx="8" cy="36" r="6"/><path d="M14 36h22l15-21h15"/><circle cx="68" cy="15" r="6"/></svg><span><b>WAYPOINT</b><small>SET SCHEMATICS</small></span></span>}
function episodeSort(a:string,b:string){if(a==='Unassigned')return 1;if(b==='Unassigned')return-1;return a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'})}
async function qualifyAddress(c:SchematicContext){
  if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude))return c;
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat=${c.latitude}&lon=${c.longitude}`,{headers:{'Accept-Language':'en'}});
    const j=await r.json(),a=j?.address||{};
    const city=a.city||a.town||a.village||a.municipality||a.county||'',state=a.state_code||a.state||'',postcode=a.postcode||'';
    const pieces=[c.address||[a.house_number,a.road].filter(Boolean).join(' '),city,state,postcode].filter(Boolean);
    const address=pieces.filter((x,i)=>pieces.findIndex(y=>String(y).toLowerCase()===String(x).toLowerCase())===i).join(', ');
    return address?{...c,address}:c;
  }catch{return c}
}

export default function WaypointWorkspace({show,onBack}:Props){
  const [events,setEvents]=useState<CalendarEvent[]>([]),[locations,setLocations]=useState<LocationRecord[]>([]),[schematics,setSchematics]=useState<SchematicContext[]>([]),[active,setActive]=useState<SchematicContext|null>(null);
  const [existingId,setExistingId]=useState(''),[calendarId,setCalendarId]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const selectedEvent=useMemo(()=>events.find(e=>e.id===calendarId)||null,[events,calendarId]);
  const groupedSchematics=useMemo(()=>{const groups:Record<string,SchematicContext[]>={};for(const s of schematics){const ep=String(s.episode||'Unassigned');(groups[ep]||(groups[ep]=[])).push(s)}return Object.entries(groups).sort(([a],[b])=>episodeSort(a,b)).map(([episode,items])=>({episode,items:items.sort((a,b)=>`${a.location||''} ${a.set||''}`.localeCompare(`${b.location||''} ${b.set||''}`,undefined,{numeric:true}))}))},[schematics]);
  const groupedEvents=useMemo(()=>{const groups:Record<string,CalendarEvent[]>={};for(const e of events){const ep=String(e.episode||'Unassigned');(groups[ep]||(groups[ep]=[])).push(e)}return Object.entries(groups).sort(([a],[b])=>episodeSort(a,b)).map(([episode,items])=>({episode,items}))},[events]);

  function locationFor(input:{locationId?:string;calendarEventId?:string;location?:string;address?:string}){
    return locations.find(l=>l.id&&l.id===input.locationId)
      || locations.find(l=>l.metadata?.calendar_event_id&&l.metadata.calendar_event_id===input.calendarEventId)
      || locations.find(l=>Array.isArray(l.metadata?.calendar_events)&&l.metadata.calendar_events.some((e:any)=>e?.event_id===input.calendarEventId))
      || locations.find(l=>String(l.location_name||'').toLowerCase()===String(input.location||'').toLowerCase()&&String(l.address||'').toLowerCase()===String(input.address||'').toLowerCase())
      || locations.find(l=>String(l.location_name||'').toLowerCase()===String(input.location||'').toLowerCase())
      || null;
  }
  function enrich<T extends SchematicContext>(c:T):T{const l=locationFor(c);const lat=Number(l?.metadata?.latitude),lng=Number(l?.metadata?.longitude);return {...c,locationId:c.locationId||l?.id||'',latitude:Number.isFinite(c.latitude)?c.latitude:Number.isFinite(lat)?lat:undefined,longitude:Number.isFinite(c.longitude)?c.longitude:Number.isFinite(lng)?lng:undefined} as T}

  useEffect(()=>{let dead=false;(async()=>{setLoading(true);setError('');
    const [{data:cal,error:calErr},{data:locs,error:locErr},{data:docs,error:docErr},{data:legacy,error:legacyErr}] = await Promise.all([
      supabase.from('tool_documents').select('payload').eq('show_id',show.id).eq('tool_key','calendar').maybeSingle(),
      supabase.from('production_locations').select('id,location_name,address,metadata').eq('show_id',show.id),
      supabase.from('tool_documents').select('tool_key,payload,updated_at').eq('show_id',show.id).like('tool_key','waypoint:%').order('updated_at',{ascending:false}),
      supabase.from('tool_documents').select('tool_key,payload,updated_at').eq('show_id',show.id).eq('tool_key','waypoint').maybeSingle()
    ]);
    if(dead)return;if(calErr||locErr||docErr||legacyErr){setError((calErr||locErr||docErr||legacyErr)?.message||'Could not load Waypoint data.');setLoading(false);return}
    const liveLocations=(locs||[]) as LocationRecord[];setLocations(liveLocations);
    const ev=Array.isArray(cal?.payload?.events)?cal.payload.events.filter((x:any)=>x.eventType!=='note'):[];setEvents(ev);
    const attachCoords=(c:any)=>{const l=liveLocations.find(x=>x.id&&x.id===c.locationId)||liveLocations.find(x=>x.metadata?.calendar_event_id&&x.metadata.calendar_event_id===c.calendarEventId)||liveLocations.find(x=>Array.isArray(x.metadata?.calendar_events)&&x.metadata.calendar_events.some((e:any)=>e?.event_id===c.calendarEventId))||liveLocations.find(x=>String(x.location_name||'').toLowerCase()===String(c.location||'').toLowerCase());const lat=Number(l?.metadata?.latitude),lng=Number(l?.metadata?.longitude);return {...c,locationId:c.locationId||l?.id||'',latitude:Number.isFinite(c.latitude)?c.latitude:Number.isFinite(lat)?lat:undefined,longitude:Number.isFinite(c.longitude)?c.longitude:Number.isFinite(lng)?lng:undefined}};
    const list=(docs||[]).filter((row:any)=>!row.payload?.archivedAt).map((row:any)=>{const c=row.payload?.context||{};return attachCoords({id:c.id||row.tool_key.replace('waypoint:',''),toolKey:row.tool_key,...c})});
    if(legacy?.payload&&!legacy.payload.archivedAt){const c=legacy.payload.context||{};list.push(attachCoords({id:'legacy-waypoint',toolKey:'waypoint',location:c.location||'Existing Waypoint',set:c.set||'Legacy schematic',episode:c.episode||show.season||'',scenes:c.scenes||'',unit:c.unit||'',address:c.address||'',shootStart:c.shootStart||'',shootEnd:c.shootEnd||'',locationId:c.locationId||''}))}
    setSchematics(list);setLoading(false);
  })();return()=>{dead=true}},[show.id]);

  async function createFromCalendar(){if(!selectedEvent)return;const id=crypto.randomUUID();const l=locationFor({locationId:selectedEvent.locationId,calendarEventId:selectedEvent.id,location:selectedEvent.location,address:selectedEvent.address});const lat=Number(l?.metadata?.latitude),lng=Number(l?.metadata?.longitude);let context:SchematicContext={id,toolKey:`waypoint:${id}`,calendarEventId:selectedEvent.id,locationId:selectedEvent.locationId||l?.id||'',episode:selectedEvent.episode||'',scenes:selectedEvent.scenes||'',unit:selectedEvent.unit||'',set:selectedEvent.set||'',location:selectedEvent.location||'Untitled Location',address:selectedEvent.address||l?.address||'',shootStart:selectedEvent.shootStart||'',shootEnd:selectedEvent.shootEnd||selectedEvent.shootStart||'',latitude:Number.isFinite(lat)?lat:undefined,longitude:Number.isFinite(lng)?lng:undefined};context=await qualifyAddress(context);
    const {data:{user}}=await supabase.auth.getUser();const {error:e}=await supabase.from('tool_documents').upsert({show_id:show.id,tool_key:context.toolKey,payload:{context,objects:[],published:false,revision:'A'},revision:1,updated_by:user?.id||null},{onConflict:'show_id,tool_key'});if(e){setError(e.message);return}setSchematics(v=>[context,...v]);setActive(context)}
  async function openSchematic(){const target=schematics.find(s=>s.id===existingId);if(!target)return;setActive(await qualifyAddress(enrich(target)))}
  async function archiveSchematic(){const target=schematics.find(s=>s.id===existingId);if(!target)return;if(!window.confirm(`Remove ${target.location||'this Waypoint'}${target.set?` — ${target.set}`:''} from saved Waypoints?`))return;const {data:row,error:loadErr}=await supabase.from('tool_documents').select('payload').eq('show_id',show.id).eq('tool_key',target.toolKey).maybeSingle();if(loadErr){setError(loadErr.message);return}const {error:e}=await supabase.from('tool_documents').update({payload:{...(row?.payload||{}),archivedAt:new Date().toISOString()}}).eq('show_id',show.id).eq('tool_key',target.toolKey);if(e){setError(e.message);return}setSchematics(v=>v.filter(s=>s.id!==target.id));setExistingId('')}
  const dashboard=()=>{if(onBack)return onBack();window.location.assign(link(HUB_URL,show))};
  if(active)return <WaypointApp show={show} onBack={()=>setActive(null)} onDashboard={dashboard} toolKey={active.toolKey} context={active}/>;

  return <div className="wp-menu-app">
    <header className="wp-menu-topbar"><button className="wp-menu-brand-button" onClick={dashboard}><WaypointLogo/></button><div className="wp-menu-show">{show.name}</div><nav><a href={link(BUDGET_URL,show)}><DollarSign size={15}/>Budget</a><a href={link(BIBLE_URL,show)}><BookOpen size={15}/>Bible</a><a href={link(CALENDAR_URL,show)}><CalendarDays size={15}/>Calendar</a></nav></header>
    <main className="wp-menu-main"><button className="wp-menu-back" onClick={dashboard}><ArrowLeft size={16}/>Show Dashboard</button><div className="wp-menu-intro"><small>TAYLOR SCOUT / WAYPOINT</small><h1>Which schematic are you working on?</h1><p>Open an existing Waypoint or start a new one directly from the Prep / Wrap Calendar. The calendar entry controls the schematic label, location, address, episode, scenes, unit and shoot dates.</p></div>
      {error&&<div className="wp-menu-error">{error}</div>}
      <div className="wp-menu-cards">
        <section><div className="wp-menu-card-icon"><MapPin/></div><h2>Open a Waypoint</h2><p>Continue a saved schematic for this show. Saved Waypoints are grouped by episode.</p><label>EXISTING SCHEMATIC<div className="wp-menu-select"><select value={existingId} onChange={e=>setExistingId(e.target.value)}><option value="">Select a schematic…</option>{groupedSchematics.map(g=><optgroup key={g.episode} label={g.episode==='Unassigned'?'Unassigned':`Episode ${g.episode}`}>{g.items.map(s=><option key={s.id} value={s.id}>{s.location||'Untitled'} — {s.set||'Schematic'}</option>)}</optgroup>)}</select><ChevronDown size={15}/></div></label><div className="wp-menu-existing-actions"><button disabled={!existingId||loading} onClick={openSchematic}>Open schematic</button><button className="danger" disabled={!existingId||loading} onClick={archiveSchematic}><Trash2 size={15}/>Delete</button></div></section>
        <section className="new"><div className="wp-menu-card-icon"><Plus/></div><h2>New from Calendar</h2><p>Choose a scheduled location and start with the production information already loaded.</p><label>CALENDAR LOCATION<div className="wp-menu-select"><select value={calendarId} onChange={e=>setCalendarId(e.target.value)}><option value="">Select a calendar entry…</option>{groupedEvents.map(g=><optgroup key={g.episode} label={g.episode==='Unassigned'?'Unassigned':`Episode ${g.episode}`}>{g.items.map(e=><option key={e.id} value={e.id}>{e.location||'Untitled'} — {e.set||'Scheduled'}</option>)}</optgroup>)}</select><ChevronDown size={15}/></div></label>{selectedEvent&&<div className="wp-menu-preview"><b>{selectedEvent.location||'Untitled Location'}</b><span>{selectedEvent.address||'No address entered yet'}</span><span>{selectedEvent.episode||'No episode'} · {selectedEvent.scenes||'No scenes'} · {dateLabel(selectedEvent)||'No shoot date'}</span></div>}<button disabled={!calendarId||loading} onClick={createFromCalendar}>Create Waypoint</button></section>
      </div>
      {!loading&&!schematics.length&&<div className="wp-menu-empty">No saved Waypoints yet. Start with a location from Calendar.</div>}
    </main>
  </div>;
}
