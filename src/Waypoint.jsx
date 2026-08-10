import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, CalendarDays, Check, ChevronDown, CircleDot, Crosshair,
  DollarSign, Hand, MapPin, MousePointer2, Plus, Printer, Save, Trash2, Truck, X
} from 'lucide-react';
import { supabase } from './supabase';
import './waypoint.css';

const HUB_URL = import.meta.env.VITE_HUB_URL || 'https://www.taylorscout.com';
const BUDGET_URL = import.meta.env.VITE_BUDGET_URL || 'https://budget.taylorscout.com';
const BIBLE_URL = import.meta.env.VITE_BIBLE_URL || 'https://bible.taylorscout.com';
const CALENDAR_URL = import.meta.env.VITE_CALENDAR_URL || 'https://calendar.taylorscout.com';

const uid = () => crypto.randomUUID();
const fmtDate = value => {
  if (!value) return '';
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const dateRange = event => {
  const a = event?.shootStart || event?.shoot_start || '';
  const b = event?.shootEnd || event?.shoot_end || a;
  if (!a) return '';
  return a === b ? fmtDate(a) : `${fmtDate(a)} – ${fmtDate(b)}`;
};

function toolUrl(base, show, extra = {}) {
  const url = new URL(base, window.location.origin);
  url.searchParams.set('show', show.id);
  url.searchParams.set('showId', show.id);
  url.searchParams.set('showName', show.name || '');
  Object.entries(extra).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  return url.toString();
}

function WaypointLogo() {
  return <span className="wp-brand" aria-label="Waypoint">
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <path d="M30 3c-10.7 0-19.4 8.5-19.4 19 0 14.4 19.4 34.8 19.4 34.8S49.4 36.4 49.4 22C49.4 11.5 40.7 3 30 3Z"/>
      <circle cx="30" cy="22" r="7"/>
      <path className="wp-route" d="M5 49c12-8 20-8 29-2 7 5 13 4 21-2"/>
    </svg>
    <span><b>WAYPOINT</b><small>SET SCHEMATICS</small></span>
  </span>;
}

function IconMark({ type }) {
  if (type === 'condor') return <span className="wp-map-icon condor">C</span>;
  if (type === 'generator') return <span className="wp-map-icon generator">G</span>;
  return <span className="wp-map-icon restroom">RR</span>;
}

function MetadataCard({ schematic }) {
  return <div className="wp-meta-card">
    <div><small>EPISODE</small><b>{schematic.episode || '—'}</b></div>
    <div><small>SCENES</small><b>{schematic.scenes || '—'}</b></div>
    <div><small>UNIT</small><b>{schematic.unit || '—'}</b></div>
    <div><small>DATE</small><b>{schematic.dates || '—'}</b></div>
    <div className="wide"><small>SET</small><b>{schematic.set || '—'}</b></div>
    <div className="wide"><small>LOCATION</small><b>{schematic.location || '—'}</b></div>
    <div className="wide"><small>ADDRESS</small><b>{schematic.address || '—'}</b></div>
  </div>;
}

function WaypointChooser({ show, events, schematics, onOpen, onCreate, onDashboard, loading }) {
  const [existingId, setExistingId] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const selectedEvent = events.find(e => e.id === calendarId);
  return <div className="wp-shell wp-chooser-shell">
    <header className="wp-topbar">
      <button className="wp-logo-button" onClick={onDashboard}><WaypointLogo/></button>
      <div className="wp-show-name">{show.name}</div>
      <div className="wp-tool-links">
        <a href={toolUrl(BUDGET_URL, show)}><DollarSign size={15}/> Budget</a>
        <a href={toolUrl(BIBLE_URL, show)}><BookOpen size={15}/> Bible</a>
        <a href={toolUrl(CALENDAR_URL, show)}><CalendarDays size={15}/> Calendar</a>
      </div>
    </header>
    <main className="wp-menu-page">
      <button className="wp-back-link" onClick={onDashboard}><ArrowLeft size={16}/> Show Dashboard</button>
      <div className="wp-menu-heading"><p>TAYLOR SCOUT / WAYPOINT</p><h1>Which schematic are you working on?</h1><span>Open an existing Waypoint or start one directly from the Prep / Wrap Calendar. Calendar metadata becomes the schematic title block automatically.</span></div>
      <div className="wp-menu-grid">
        <section className="wp-menu-card">
          <div className="wp-menu-icon"><MapPin/></div><h2>Open a Waypoint</h2><p>Continue an existing schematic for this production.</p>
          <label>Existing schematic<div className="wp-select-wrap"><select value={existingId} onChange={e=>setExistingId(e.target.value)}><option value="">Select a schematic…</option>{schematics.map(s=><option key={s.id} value={s.id}>{s.location || 'Untitled'} — {s.set || s.episode || 'Schematic'}</option>)}</select><ChevronDown size={16}/></div></label>
          <button className="wp-primary" disabled={!existingId || loading} onClick={()=>onOpen(existingId)}>Open schematic</button>
        </section>
        <section className="wp-menu-card featured">
          <div className="wp-menu-icon"><Plus/></div><h2>New from Calendar</h2><p>Choose a scheduled location and start with the address, episode, scene, set and shoot dates already loaded.</p>
          <label>Calendar location<div className="wp-select-wrap"><select value={calendarId} onChange={e=>setCalendarId(e.target.value)}><option value="">Select calendar entry…</option>{events.map(e=><option key={e.id} value={e.id}>{e.location || 'Untitled'} — {e.set || e.episode || 'Scheduled'}</option>)}</select><ChevronDown size={16}/></div></label>
          {selectedEvent && <div className="wp-calendar-preview"><b>{selectedEvent.location}</b><span>{selectedEvent.address || 'No address entered yet'}</span><span>{selectedEvent.episode} · {selectedEvent.scenes || 'No scenes'} · {dateRange(selectedEvent)}</span></div>}
          <button className="wp-primary" disabled={!calendarId || loading} onClick={()=>onCreate(selectedEvent)}>Create Waypoint</button>
        </section>
      </div>
      {!loading && !schematics.length && <div className="wp-empty-note">No saved Waypoints yet. Start with a calendar location.</div>}
    </main>
  </div>;
}

function SchematicEditor({ show, schematic, onBack, onDashboard, onChange, onSave, saving }) {
  const [tool, setTool] = useState('hand');
  const [truckChoiceOpen, setTruckChoiceOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const boardRef = useRef(null);
  const shapes = schematic.shapes || [];

  const mapUrl = schematic.address ? `https://www.google.com/maps?q=${encodeURIComponent(schematic.address)}&output=embed` : '';
  const isDrawing = tool !== 'hand';
  const cursor = isDrawing ? 'crosshair' : 'grab';

  function pointFromEvent(e) {
    const rect = boardRef.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)), y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)) };
  }
  function commitShape(shape) {
    onChange({ ...schematic, shapes: [...shapes, { id: uid(), ...shape }] });
    setDraft([]); setTool('hand'); setTruckChoiceOpen(false);
  }
  function onBoardClick(e) {
    if (tool === 'hand') return;
    const p = pointFromEvent(e);
    if (['condor','generator','restroom'].includes(tool)) return commitShape({ kind: 'icon', icon: tool, points: [p], label: tool === 'restroom' ? 'RESTROOM' : tool.toUpperCase() });
    if (tool === 'line' || tool === 'truck-line') {
      if (!draft.length) return setDraft([p]);
      return commitShape({ kind: 'line', points: [draft[0], p], label: tool === 'truck-line' ? 'TRUCK PARKING' : 'ROUTE' });
    }
    if (tool === 'polygon' || tool === 'truck-polygon') setDraft(current => [...current, p]);
  }
  function finishPolygon() {
    if (draft.length < 3) return;
    commitShape({ kind: 'polygon', points: draft, label: tool === 'truck-polygon' ? 'TRUCK PARKING' : 'AREA' });
  }
  function removeShape(id) { onChange({ ...schematic, shapes: shapes.filter(s => s.id !== id) }); }

  return <div className="wp-shell editor-open">
    <header className="wp-topbar">
      <button className="wp-logo-button" onClick={onDashboard}><WaypointLogo/></button>
      <div className="wp-show-name"><span>{show.name}</span><b>{schematic.location}</b></div>
      <div className="wp-tool-links">
        <a href={toolUrl(BUDGET_URL, show, {locationId:schematic.locationId})}><DollarSign size={15}/> Budget</a>
        <a href={toolUrl(BIBLE_URL, show, {locationId:schematic.locationId})}><BookOpen size={15}/> Bible</a>
        <a href={toolUrl(CALENDAR_URL, show, {locationId:schematic.locationId})}><CalendarDays size={15}/> Calendar</a>
      </div>
    </header>
    <div className="wp-editor-bar">
      <button onClick={onBack}><ArrowLeft size={16}/> Waypoints</button>
      <div className="wp-editor-title"><small>{schematic.episode || 'PRODUCTION SCHEMATIC'}</small><b>{schematic.set || schematic.location}</b></div>
      <div className="wp-editor-actions"><button onClick={()=>window.print()}><Printer size={16}/> Print</button><button className="save" onClick={onSave} disabled={saving}><Save size={16}/>{saving?'Saving…':'Save'}</button></div>
    </div>
    <div className="wp-workspace">
      <aside className="wp-toolbar">
        <button className={tool==='hand'?'active':''} onClick={()=>{setTool('hand');setDraft([])}} title="Pan / select"><Hand size={20}/><span>Hand</span></button>
        <button className={tool==='line'?'active':''} onClick={()=>{setTool('line');setDraft([])}}><Crosshair size={20}/><span>Line</span></button>
        <button className={tool==='polygon'?'active':''} onClick={()=>{setTool('polygon');setDraft([])}}><MousePointer2 size={20}/><span>Area</span></button>
        <div className="wp-tool-popover-wrap"><button className={tool.startsWith('truck')?'active':''} onClick={()=>setTruckChoiceOpen(v=>!v)}><Truck size={20}/><span>Truck Parking</span></button>{truckChoiceOpen && <div className="wp-tool-popover"><button onClick={()=>{setTool('truck-line');setDraft([]);setTruckChoiceOpen(false)}}>Line</button><button onClick={()=>{setTool('truck-polygon');setDraft([]);setTruckChoiceOpen(false)}}>Polygon</button></div>}</div>
        <div className="wp-toolbar-divider"/>
        <button className={tool==='condor'?'active':''} onClick={()=>setTool('condor')}><span className="tool-glyph">C</span><span>Condor</span></button>
        <button className={tool==='generator'?'active':''} onClick={()=>setTool('generator')}><span className="tool-glyph">G</span><span>Generator</span></button>
        <button className={tool==='restroom'?'active':''} onClick={()=>setTool('restroom')}><span className="tool-glyph rr">RR</span><span>Restroom</span></button>
      </aside>
      <main className="wp-board-column">
        <MetadataCard schematic={schematic}/>
        <div className={`wp-board ${isDrawing?'drawing':''}`} ref={boardRef} style={{cursor}} onClick={onBoardClick} onDoubleClick={finishPolygon}>
          {mapUrl ? <iframe title="Map" src={mapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/> : <div className="wp-map-placeholder"><MapPin/><b>Add an address in Calendar to load the map.</b></div>}
          <svg className="wp-drawing-layer" viewBox="0 0 100 100" preserveAspectRatio="none" style={{pointerEvents:isDrawing?'auto':'none'}}>
            {shapes.map(shape => shape.kind === 'line' ? <g key={shape.id}><polyline points={shape.points.map(p=>`${p.x},${p.y}`).join(' ')} className="wp-line"/><text x={(shape.points[0].x+shape.points[1].x)/2} y={(shape.points[0].y+shape.points[1].y)/2} className="wp-label">{shape.label}</text></g> : shape.kind === 'polygon' ? <g key={shape.id}><polygon points={shape.points.map(p=>`${p.x},${p.y}`).join(' ')} className="wp-polygon"/><text x={shape.points.reduce((a,p)=>a+p.x,0)/shape.points.length} y={shape.points.reduce((a,p)=>a+p.y,0)/shape.points.length} className="wp-label">{shape.label}</text></g> : null)}
            {draft.length>0 && <polyline points={draft.map(p=>`${p.x},${p.y}`).join(' ')} className="wp-draft"/>}
          </svg>
          <div className="wp-icon-layer" style={{pointerEvents:isDrawing?'none':'auto'}}>{shapes.filter(s=>s.kind==='icon').map(shape => <button key={shape.id} className="wp-icon-pin" style={{left:`${shape.points[0].x}%`,top:`${shape.points[0].y}%`}} title={`${shape.label} — click X in legend to remove`}><IconMark type={shape.icon}/></button>)}</div>
          {isDrawing && <div className="wp-cursor-help"><Crosshair size={15}/>{tool.includes('polygon') || tool==='polygon' ? 'Click points · double-click to finish' : 'Click map to place / draw'}</div>}
          <div className="wp-map-label"><b>{schematic.location}</b><span>{schematic.address}</span></div>
        </div>
      </main>
      <aside className="wp-layers-panel">
        <div className="wp-panel-heading"><span><small>SCHEMATIC</small><b>Live layers</b></span><CircleDot size={17}/></div>
        {!shapes.length ? <p className="wp-layers-empty">Choose a drawing tool. The cursor switches to crosshairs while drawing, then returns to the hand tool when the item is complete.</p> : <div className="wp-layer-list">{shapes.map(shape=><div key={shape.id}><span>{shape.kind==='icon'?<IconMark type={shape.icon}/>:shape.kind==='line'?<Crosshair size={16}/>:<MousePointer2 size={16}/>}<b>{shape.label}</b></span><button onClick={()=>removeShape(shape.id)}><X size={14}/></button></div>)}</div>}
      </aside>
    </div>
    <section className="wp-print-titleblock">
      <div className="print-brand"><WaypointLogo/></div><div><small>PRODUCTION</small><b>{show.name}</b></div><div><small>EPISODE / SCENES</small><b>{schematic.episode || '—'} / {schematic.scenes || '—'}</b></div><div><small>SET</small><b>{schematic.set || '—'}</b></div><div><small>LOCATION</small><b>{schematic.location || '—'}</b></div><div><small>ADDRESS</small><b>{schematic.address || '—'}</b></div><div><small>DATE</small><b>{schematic.dates || '—'}</b></div>
    </section>
  </div>;
}

export default function Waypoint({ show, onDashboard }) {
  const [events, setEvents] = useState([]);
  const [schematics, setSchematics] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { let cancelled=false; (async()=>{
    setLoading(true);
    const [{data:calendar,error:calendarError},{data:docs,error:docsError}] = await Promise.all([
      supabase.from('tool_documents').select('payload').eq('show_id',show.id).eq('tool_key','calendar').maybeSingle(),
      supabase.from('tool_documents').select('tool_key,payload,updated_at').eq('show_id',show.id).like('tool_key','waypoint:%').order('updated_at',{ascending:false})
    ]);
    if (calendarError) console.error(calendarError);
    if (docsError) console.error(docsError);
    if (!cancelled) {
      setEvents(Array.isArray(calendar?.payload?.events)?calendar.payload.events.filter(e=>e.eventType!=='note'):[]);
      setSchematics((docs||[]).map(row=>({...(row.payload||{}),id:(row.payload||{}).id||row.tool_key.replace('waypoint:',''),toolKey:row.tool_key})));
      setLoading(false);
    }
  })(); return()=>{cancelled=true}; },[show.id]);

  async function persist(next) {
    setSaving(true);
    const payload = { ...next, updatedAt:new Date().toISOString() };
    const { error } = await supabase.from('tool_documents').upsert({show_id:show.id,tool_key:`waypoint:${payload.id}`,payload},{onConflict:'show_id,tool_key'});
    setSaving(false);
    if (error) throw error;
    setSchematics(current => [payload, ...current.filter(s=>s.id!==payload.id)]);
    setActive(payload);
  }
  async function createFromEvent(event) {
    if (!event) return;
    const next = {
      id:uid(), locationId:event.locationId||'', calendarEventId:event.id||'',
      episode:event.episode||'', scenes:event.scenes||'', unit:event.unit||'', set:event.set||'',
      location:event.location||'Untitled Location', address:event.address||'', dates:dateRange(event),
      shootStart:event.shootStart||'', shootEnd:event.shootEnd||event.shootStart||'', shapes:[]
    };
    try { await persist(next); } catch(e) { alert(`Could not create Waypoint: ${e.message}`); }
  }
  const open = id => setActive(schematics.find(s=>s.id===id)||null);
  const dashboard = () => {
    const url = new URL(HUB_URL, window.location.origin);
    url.searchParams.set('show',show.id);url.searchParams.set('showId',show.id);url.searchParams.set('showName',show.name||'');
    window.location.href=url.toString();
  };
  if (!active) return <WaypointChooser show={show} events={events} schematics={schematics} onOpen={open} onCreate={createFromEvent} onDashboard={onDashboard||dashboard} loading={loading}/>;
  return <SchematicEditor show={show} schematic={active} onChange={setActive} onSave={()=>persist(active).catch(e=>alert(`Could not save Waypoint: ${e.message}`))} saving={saving} onBack={()=>setActive(null)} onDashboard={onDashboard||dashboard}/>;
}
