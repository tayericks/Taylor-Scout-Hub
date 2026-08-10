import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, ChevronDown, DollarSign, MapPin, Plus } from 'lucide-react';
import WaypointApp from './WaypointApp';
import { supabase } from '../supabase';
import './waypoint.css';

type Props = { show:any; onBack?:()=>void };
type CalendarEvent = {
  id:string; episode?:string; scenes?:string; unit?:string; set?:string; location?:string; address?:string;
  shootStart?:string; shootEnd?:string; locationId?:string;
};
type SchematicContext = {
  id:string; toolKey:string; calendarEventId?:string; locationId?:string; episode?:string; scenes?:string; unit?:string;
  set?:string; location?:string; address?:string; shootStart?:string; shootEnd?:string;
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

export default function WaypointWorkspace({show,onBack}:Props){
  const [events,setEvents]=useState<CalendarEvent[]>([]),[schematics,setSchematics]=useState<SchematicContext[]>([]),[active,setActive]=useState<SchematicContext|null>(null);
  const [existingId,setExistingId]=useState(''),[calendarId,setCalendarId]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const selectedEvent=useMemo(()=>events.find(e=>e.id===calendarId)||null,[events,calendarId]);

  useEffect(()=>{let dead=false;(async()=>{setLoading(true);setError('');
    const [{data:cal,error:calErr},{data:docs,error:docErr}] = await Promise.all([
      supabase.from('tool_documents').select('payload').eq('show_id',show.id).eq('tool_key','calendar').maybeSingle(),
      supabase.from('tool_documents').select('tool_key,payload,updated_at').eq('show_id',show.id).like('tool_key','waypoint:%').order('updated_at',{ascending:false})
    ]);
    if(dead)return;if(calErr||docErr){setError((calErr||docErr)?.message||'Could not load Waypoint data.');setLoading(false);return}
    const ev=Array.isArray(cal?.payload?.events)?cal.payload.events.filter((x:any)=>x.eventType!=='note'):[];setEvents(ev);
    const list=(docs||[]).map((row:any)=>{const c=row.payload?.context||{};return {id:c.id||row.tool_key.replace('waypoint:',''),toolKey:row.tool_key,...c}});setSchematics(list);setLoading(false);
  })();return()=>{dead=true}},[show.id]);

  async function createFromCalendar(){if(!selectedEvent)return;const id=crypto.randomUUID();const context:SchematicContext={id,toolKey:`waypoint:${id}`,calendarEventId:selectedEvent.id,locationId:selectedEvent.locationId||'',episode:selectedEvent.episode||'',scenes:selectedEvent.scenes||'',unit:selectedEvent.unit||'',set:selectedEvent.set||'',location:selectedEvent.location||'Untitled Location',address:selectedEvent.address||'',shootStart:selectedEvent.shootStart||'',shootEnd:selectedEvent.shootEnd||selectedEvent.shootStart||''};
    const {data:{user}}=await supabase.auth.getUser();const {error:e}=await supabase.from('tool_documents').upsert({show_id:show.id,tool_key:context.toolKey,payload:{context,objects:[],published:false,revision:'A'},revision:1,updated_by:user?.id||null},{onConflict:'show_id,tool_key'});if(e){setError(e.message);return}setSchematics(v=>[context,...v]);setActive(context)}
  const dashboard=()=>{if(onBack)return onBack();window.location.assign(link(HUB_URL,show))};
  if(active)return <WaypointApp show={show} onBack={()=>setActive(null)} onDashboard={dashboard} toolKey={active.toolKey} context={active}/>;

  return <div className="wp-menu-app">
    <header className="wp-menu-topbar"><button className="wp-menu-brand-button" onClick={dashboard}><WaypointLogo/></button><div className="wp-menu-show">{show.name}</div><nav><a href={link(BUDGET_URL,show)}><DollarSign size={15}/>Budget</a><a href={link(BIBLE_URL,show)}><BookOpen size={15}/>Bible</a><a href={link(CALENDAR_URL,show)}><CalendarDays size={15}/>Calendar</a></nav></header>
    <main className="wp-menu-main"><button className="wp-menu-back" onClick={dashboard}><ArrowLeft size={16}/>Show Dashboard</button><div className="wp-menu-intro"><small>TAYLOR SCOUT / WAYPOINT</small><h1>Which schematic are you working on?</h1><p>Open an existing Waypoint or start a new one directly from the Prep / Wrap Calendar. The calendar entry controls the schematic label, location, address, episode, scenes, unit and shoot dates.</p></div>
      {error&&<div className="wp-menu-error">{error}</div>}
      <div className="wp-menu-cards">
        <section><div className="wp-menu-card-icon"><MapPin/></div><h2>Open a Waypoint</h2><p>Continue a saved schematic for this show.</p><label>EXISTING SCHEMATIC<div className="wp-menu-select"><select value={existingId} onChange={e=>setExistingId(e.target.value)}><option value="">Select a schematic…</option>{schematics.map(s=><option key={s.id} value={s.id}>{s.location||'Untitled'} — {s.set||s.episode||'Schematic'}</option>)}</select><ChevronDown size={15}/></div></label><button disabled={!existingId||loading} onClick={()=>setActive(schematics.find(s=>s.id===existingId)||null)}>Open schematic</button></section>
        <section className="new"><div className="wp-menu-card-icon"><Plus/></div><h2>New from Calendar</h2><p>Choose a scheduled location and start with the production information already loaded.</p><label>CALENDAR LOCATION<div className="wp-menu-select"><select value={calendarId} onChange={e=>setCalendarId(e.target.value)}><option value="">Select a calendar entry…</option>{events.map(e=><option key={e.id} value={e.id}>{e.location||'Untitled'} — {e.set||e.episode||'Scheduled'}</option>)}</select><ChevronDown size={15}/></div></label>{selectedEvent&&<div className="wp-menu-preview"><b>{selectedEvent.location||'Untitled Location'}</b><span>{selectedEvent.address||'No address entered yet'}</span><span>{selectedEvent.episode||'No episode'} · {selectedEvent.scenes||'No scenes'} · {dateLabel(selectedEvent)||'No shoot date'}</span></div>}<button disabled={!calendarId||loading} onClick={createFromCalendar}>Create Waypoint</button></section>
      </div>
      {!loading&&!schematics.length&&<div className="wp-menu-empty">No saved Waypoints yet. Start with a location from Calendar.</div>}
    </main>
  </div>;
}
