import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Camera, CheckCircle2, Clock3, ImagePlus, MapPin,
  Plus, Radio, Save, Trash2, Users
} from 'lucide-react';
import { fetchProductionCore } from './supabase';

const DEFAULT_VENDORS = [
  'Security','Police','Fire','AC / Heaters','Layout / Mats','Restrooms',
  'Trash','Tents','Catering','Parking Attendants'
];

const FOLLOW_UPS = [
  'Damage','Vendor Still On-Site','Equipment Left','Cleanup Needed',
  'Property Owner Issue','Neighborhood Issue','Other'
];

const CLEANUP_ITEMS = [
  'Trash removed','Signs removed','Parking signs removed','Layout removed',
  'Furniture / property reset','Final sweep completed'
];

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function emptyReport(show) {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0,10),
    unitId: '',
    locationId: '',
    closerName: '',
    status: 'wrapping',
    productionWrap: '',
    locationsOut: '',
    closerOut: '',
    vendors: DEFAULT_VENDORS.map(name => ({ id: crypto.randomUUID(), name, outTime: '', note: '' })),
    outstanding: '',
    walkies: '',
    gear: '',
    damageFound: false,
    damageType: 'unknown',
    damageDescription: '',
    ownerNotified: false,
    cleanup: Object.fromEntries(CLEANUP_ITEMS.map(item => [item, false])),
    notes: '',
    followUps: [],
    photos: [],
    showId: show.id
  };
}

function TimestampField({ label, value, onChange, actionLabel='OUT NOW' }) {
  return <div className="closer-time-row">
    <label>{label}<input type="time" value={value} onChange={e=>onChange(e.target.value)}/></label>
    <button type="button" className="closer-now" onClick={()=>onChange(new Date().toTimeString().slice(0,5))}><Clock3 size={14}/>{actionLabel}</button>
  </div>;
}

export default function CloserWorkspace({ show, onBack }) {
  const storageKey = `ts-closer-report:${show.id}`;
  const [core, setCore] = useState({ units: [], locations: [] });
  const [report, setReport] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || emptyReport(show); }
    catch { return emptyReport(show); }
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    fetchProductionCore(show.id).then(data => {
      if (!active) return;
      const locations = [];
      for (const set of data.sets || []) {
        for (const location of set.selectedLocations || []) {
          if (!locations.some(item => item.id === location.id)) locations.push(location);
        }
      }
      setCore({ units: data.units || [], locations });
    }).catch(() => setCore({ units: [], locations: [] }));
    return () => { active = false; };
  }, [show.id]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(report));
  }, [report, storageKey]);

  function patch(values) {
    setReport(current => ({ ...current, ...values }));
    setSaved(false);
  }

  function setVendor(id, values) {
    patch({ vendors: report.vendors.map(v => v.id === id ? { ...v, ...values } : v) });
  }

  function addVendor() {
    patch({ vendors: [...report.vendors, { id: crypto.randomUUID(), name: '', outTime: '', note: '' }] });
  }

  function toggleFollowUp(item) {
    patch({ followUps: report.followUps.includes(item) ? report.followUps.filter(x=>x!==item) : [...report.followUps, item] });
  }

  async function addPhotos(files) {
    const next = await Promise.all(Array.from(files).slice(0,8).map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve({ id: crypto.randomUUID(), name:file.name, dataUrl: reader.result });
      reader.readAsDataURL(file);
    })));
    patch({ photos: [...report.photos, ...next].slice(0,12) });
  }

  function saveReport() {
    localStorage.setItem(storageKey, JSON.stringify(report));
    setSaved(true);
    setTimeout(()=>setSaved(false), 1800);
  }

  const selectedLocation = useMemo(
    () => core.locations.find(x => x.id === report.locationId),
    [core.locations, report.locationId]
  );

  return <main className="closer-shell">
    <div className="closer-topbar">
      <button className="back" onClick={onBack}><ArrowLeft size={17}/> Production workspace</button>
      <div className="closer-heading">
        <div><p className="eyebrow">SET CLOSER</p><h1>Wrap Report</h1><p>{show.name}{selectedLocation ? ` · ${selectedLocation.location_name}` : ''}</p></div>
        <div className="closer-status-actions">
          <select value={report.status} onChange={e=>patch({status:e.target.value})} className={`closer-status ${report.status}`}>
            <option value="wrapping">Wrapping</option>
            <option value="review">Ready for Review</option>
            <option value="closed">Closed</option>
          </select>
          <button className="primary" onClick={saveReport}><Save size={16}/>{saved?'Saved':'Save Report'}</button>
        </div>
      </div>
    </div>

    <section className="closer-grid">
      <div className="closer-main">
        <section className="closer-card">
          <header><div><p className="eyebrow">TODAY</p><h2>Wrap details</h2></div><MapPin size={20}/></header>
          <div className="closer-form-grid">
            <label>Date<input type="date" value={report.date} onChange={e=>patch({date:e.target.value})}/></label>
            <label>Closer name<input value={report.closerName} onChange={e=>patch({closerName:e.target.value})} placeholder="Name"/></label>
            <label>Unit<select value={report.unitId} onChange={e=>patch({unitId:e.target.value})}><option value="">Select unit</option>{core.units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
            <label>Location<select value={report.locationId} onChange={e=>patch({locationId:e.target.value})}><option value="">Select location</option>{core.locations.map(location=><option key={location.id} value={location.id}>{location.location_name || location.address || 'Location'}</option>)}</select></label>
          </div>
          <div className="closer-time-stack">
            <TimestampField label="Production wrap" value={report.productionWrap} onChange={value=>patch({productionWrap:value})} actionLabel="PRODUCTION WRAPPED"/>
            <TimestampField label="Locations clear" value={report.locationsOut} onChange={value=>patch({locationsOut:value})} actionLabel="LOCATIONS CLEAR"/>
            <TimestampField label="Closer out" value={report.closerOut} onChange={value=>patch({closerOut:value})} actionLabel="CLOSER OUT"/>
          </div>
        </section>

        <section className="closer-card">
          <header><div><p className="eyebrow">OUT TIMES</p><h2>Vendors & departments</h2></div><Users size={20}/></header>
          <div className="vendor-list">{report.vendors.map(vendor=><div className="vendor-row" key={vendor.id}>
            <input className="vendor-name" value={vendor.name} onChange={e=>setVendor(vendor.id,{name:e.target.value})} placeholder="Vendor / department"/>
            <input type="time" value={vendor.outTime} onChange={e=>setVendor(vendor.id,{outTime:e.target.value})}/>
            <button type="button" className="closer-now compact" onClick={()=>setVendor(vendor.id,{outTime:new Date().toTimeString().slice(0,5)})}>OUT NOW</button>
            <input className="vendor-note" value={vendor.note} onChange={e=>setVendor(vendor.id,{note:e.target.value})} placeholder="Note"/>
            <button className="icon-button" onClick={()=>patch({vendors:report.vendors.filter(x=>x.id!==vendor.id)})}><Trash2 size={15}/></button>
          </div>)}</div>
          <button className="secondary closer-add" onClick={addVendor}><Plus size={15}/> Add vendor / department</button>
        </section>

        <section className="closer-card">
          <header><div><p className="eyebrow">GEAR & HANDOFF</p><h2>What is still on site?</h2></div><Radio size={20}/></header>
          <label>Outstanding people / equipment<textarea rows="3" value={report.outstanding} onChange={e=>patch({outstanding:e.target.value})} placeholder="Who is still on site? What still needs pickup?"/></label>
          <label>Walkies / radios<textarea rows="2" value={report.walkies} onChange={e=>patch({walkies:e.target.value})} placeholder="Where walkies were left, who has them, charger location..."/></label>
          <label>Keys / signs / cones / EZ-Ups / tables / other gear<textarea rows="3" value={report.gear} onChange={e=>patch({gear:e.target.value})} placeholder="Anything the morning crew needs to know..."/></label>
        </section>

        <section className="closer-card">
          <header><div><p className="eyebrow">PROPERTY</p><h2>Damage & condition</h2></div><AlertTriangle size={20}/></header>
          <label className="closer-check"><input type="checkbox" checked={report.damageFound} onChange={e=>patch({damageFound:e.target.checked})}/><span>Damage or property issue found</span></label>
          {report.damageFound && <div className="damage-panel">
            <label>Damage status<select value={report.damageType} onChange={e=>patch({damageType:e.target.value})}><option value="unknown">Needs review</option><option value="existing">Existing / pre-existing</option><option value="production">Production-caused</option></select></label>
            <label>Description<textarea rows="4" value={report.damageDescription} onChange={e=>patch({damageDescription:e.target.value})} placeholder="Describe the issue and exact location..."/></label>
            <label className="closer-check"><input type="checkbox" checked={report.ownerNotified} onChange={e=>patch({ownerNotified:e.target.checked})}/><span>Property owner / site rep notified</span></label>
          </div>}
          <div className="photo-upload">
            <label className="secondary photo-button"><ImagePlus size={16}/> Add wrap photos<input type="file" accept="image/*" multiple onChange={e=>addPhotos(e.target.files)} hidden/></label>
            <span>Final condition, damage, equipment left behind.</span>
          </div>
          {!!report.photos.length && <div className="photo-grid">{report.photos.map(photo=><figure key={photo.id}><img src={photo.dataUrl} alt="Wrap"/><button onClick={()=>patch({photos:report.photos.filter(x=>x.id!==photo.id)})}><Trash2 size={14}/></button></figure>)}</div>}
        </section>

        <section className="closer-card">
          <header><div><p className="eyebrow">RESTORE</p><h2>Cleanup checklist</h2></div><CheckCircle2 size={20}/></header>
          <div className="cleanup-grid">{CLEANUP_ITEMS.map(item=><label className="closer-check" key={item}><input type="checkbox" checked={Boolean(report.cleanup[item])} onChange={e=>patch({cleanup:{...report.cleanup,[item]:e.target.checked}})}/><span>{item}</span></label>)}</div>
        </section>

        <section className="closer-card">
          <header><div><p className="eyebrow">HANDOFF NOTES</p><h2>Notes for the team</h2></div><Camera size={20}/></header>
          <textarea className="closer-notes" rows="6" value={report.notes} onChange={e=>patch({notes:e.target.value})} placeholder="Property owner requests, neighborhood issues, access instructions, vendor problems, items for tomorrow..."/>
        </section>
      </div>

      <aside className="closer-side">
        <section className="closer-card sticky">
          <header><div><p className="eyebrow">NEEDS FOLLOW-UP</p><h2>Open issues</h2></div></header>
          <div className="followup-list">{FOLLOW_UPS.map(item=><button key={item} className={report.followUps.includes(item)?'active':''} onClick={()=>toggleFollowUp(item)}>{report.followUps.includes(item)?<CheckCircle2 size={15}/>:<span className="empty-dot"/>}{item}</button>)}</div>
          <div className="closer-summary">
            <b>{report.followUps.length ? `${report.followUps.length} item${report.followUps.length===1?'':'s'} need attention` : 'No open issues flagged'}</b>
            <span>{report.status==='closed'?'Report closed':report.status==='review'?'Ready for LM / ALM review':'Closer is still wrapping'}</span>
          </div>
          <button className="primary closer-submit" onClick={()=>{patch({status:'review'});saveReport();}}><CheckCircle2 size={16}/> Submit Wrap Report</button>
        </section>
      </aside>
    </section>
  </main>;
}
