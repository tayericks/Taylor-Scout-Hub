import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, BookOpen, FileText, ClipboardList, ShieldCheck, Mail,
  Printer, Save, ChevronRight, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { fetchPrepToolContext, savePrepToolDraft } from './supabase';

const TOOLS = [
  { key:'bible', title:'Location Bible', icon:BookOpen, description:'Operational location record, vendors, logistics, security and orders.' },
  { key:'prep-memo', title:'Prep Memo', icon:FileText, description:'Location Department work guidelines for prep.' },
  { key:'permit-grid', title:'Permit Grid', icon:ClipboardList, description:'Permit, posting, closure and safety requirements grid.' },
  { key:'neighborhood-letter', title:'Neighborhood Letter', icon:Mail, description:'Resident / business notification letter.' },
  { key:'shoot-memo', title:'Shoot Memo', icon:FileText, description:'Shoot-day Location Department memo.', awaiting:true },
  { key:'safety', title:'Safety Form & Checklist', icon:ShieldCheck, description:'Location-specific safety assessment and checklist.', awaiting:true }
];

const dateFmt = value => {
  if (!value) return '';
  const d = new Date(value + (String(value).includes('T') ? '' : 'T12:00:00'));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
};
const shortDate = value => {
  if (!value) return '';
  const d = new Date(value + (String(value).includes('T') ? '' : 'T12:00:00'));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-US',{month:'numeric',day:'numeric'});
};
const safe = v => String(v ?? '');

function buildDefaults(show, loc, bible) {
  const record = bible?.record || bible || {};
  const logistics = record.logistics || {};
  const schedule = loc?.metadata?.schedule || record.location?.metadata?.schedule || {};
  const locationName = loc?.location_name || record.locationName || record.location?.location_name || '';
  const locationAddress = [loc?.address, loc?.city, loc?.state, loc?.postal_code].filter(Boolean).join(', ') || record.location?.address || '';
  const setName = loc?.set_name || record.setName || record.location?.set_name || '';
  const episode = loc?.episode_name || loc?.episode_id || record.episodeName || record.location?.episode_id || '';
  const productionAddress = show?.productionOffice?.address || '';
  const prepDays = [schedule.prep_start,schedule.prep_end].filter(Boolean);
  const shootDays = [schedule.shoot_start,schedule.shoot_end].filter(Boolean);
  const strikeDays = [schedule.strike_start,schedule.strike_end].filter(Boolean);
  const holdDays = [schedule.hold_start,schedule.hold_end].filter(Boolean);
  const bullets = [];
  if (loc?.notes) bullets.push({text:loc.notes,priority:false});
  if (logistics.crewParking?.address) bullets.push({text:`Crew Parking: ${logistics.crewParking.name || ''} — ${logistics.crewParking.address}`,priority:true});
  if (logistics.basecamp?.address) bullets.push({text:`Basecamp: ${logistics.basecamp.name || ''} — ${logistics.basecamp.address}`,priority:false});
  return {
    common:{ locationName,locationAddress,setName,episode,productionAddress,schedule,logistics },
    prepMemo:{
      to:'All Crew',
      from:'Location Department',
      date:new Date().toISOString().slice(0,10),
      re:`Work Guidelines for ${locationName}`,
      set:setName,
      bullets: bullets.length ? bullets : [{text:'',priority:true},{text:'',priority:false},{text:'',priority:false}],
      closing:'If you have any questions or requests, please contact the Location Department.',
      signerName:'',
      signerTitle:'Key Assistant Location Manager',
      signerPhone:'',
      signerEmail:''
    },
    neighborhood:{
      letterDate:new Date().toISOString().slice(0,10),
      salutation:'Dear Neighbor,',
      intro:`We will be filming scenes of the ${show?.productionType === 'feature' ? 'feature film' : 'TV Series'} “${show?.name || 'SHOW NAME'}” at ${locationName || 'FILMING LOCATION'}. Here are some of the details of our activities while we are in your neighborhood.`,
      prepTimes:'7AM – 7PM',
      filmingTimes:'',
      wrapTimes:'7AM – 7PM',
      activity:'',
      equipmentStaging:'',
      parking: logistics.crewParking?.address ? `Crew Parking & Basecamp will be located at ${logistics.crewParking.address}` : '',
      generator:'',
      sidewalkClosure:'',
      curbLaneClosure:'',
      posting:'',
      signerName:'',
      signerTitle:'',
      signerPhone:''
    },
    permitGrid:{
      preparedDate:new Date().toISOString().slice(0,10),
      locationAccess:'',
      enla:'',
      enlaPhone:'',
      enlaContact:'',
      block:'',
      curbCount:'',
      setName,
      crewCount:'',
      interiorExterior:'',
      backgroundCount:'',
      filmingActivity:'',
      aerialOrSfx:'',
      permitAgency:'',
      permitDate:'',
      permitHours:'',
      permitNumber:'',
      basecampName:logistics.basecamp?.name || '',
      basecampAddress:logistics.basecamp?.address || '',
      basecampDates:'',
      crewParkingName:logistics.crewParking?.name || '',
      crewParkingAddress:logistics.crewParking?.address || '',
      crewParkingDates:'',
      cateringName:logistics.catering?.name || '',
      cateringAddress:logistics.catering?.address || '',
      cateringDates:'',
      restroomLocation:'',
      equipmentParking:'',
      pictureCarParking:'',
      truckOverflowParking:'',
      postingForPrepCrew:'',
      postingForShoot:'',
      closedStreet:'',
      laneClosure:'',
      sidewalkClosure:'',
      intermittentTrafficControl:'',
      intermittentPedestrianControl:'',
      specialEffects:'',
      notes:'',
      safetyNotes:''
    },
    ranges:{prepDays,shootDays,strikeDays,holdDays}
  };
}

function Editable({label,value,onChange,textarea=false,placeholder=''}) {
  return <label className="prep-field"><span>{label}</span>{textarea
    ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>
    : <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>}</label>;
}

function PrepMemoEditor({show,loc,data,setData}) {
  const update=(key,value)=>setData({...data,[key]:value});
  const updateBullet=(i,patch)=>update('bullets',data.bullets.map((b,idx)=>idx===i?{...b,...patch}:b));
  const addBullet=()=>update('bullets',[...data.bullets,{text:'',priority:false}]);
  const removeBullet=i=>update('bullets',data.bullets.filter((_,idx)=>idx!==i));
  return <div className="prep-editor-form">
    <div className="prep-form-grid">
      <Editable label="To" value={data.to} onChange={v=>update('to',v)}/>
      <Editable label="From" value={data.from} onChange={v=>update('from',v)}/>
      <label className="prep-field"><span>Date</span><input type="date" value={data.date} onChange={e=>update('date',e.target.value)}/></label>
      <Editable label="Re" value={data.re} onChange={v=>update('re',v)}/>
      <Editable label="Set" value={data.set} onChange={v=>update('set',v)}/>
    </div>
    <div className="prep-subhead">WORK GUIDELINES</div>
    <div className="prep-bullet-editor">
      {data.bullets.map((b,i)=><div className="prep-bullet-row" key={i}>
        <label className="priority-check"><input type="checkbox" checked={!!b.priority} onChange={e=>updateBullet(i,{priority:e.target.checked})}/><span>Priority</span></label>
        <textarea value={b.text} onChange={e=>updateBullet(i,{text:e.target.value})} placeholder="Add a prep guideline, restriction, access note, vendor instruction, safety note…"/>
        <button type="button" className="prep-remove" onClick={()=>removeBullet(i)}>×</button>
      </div>)}
      <button type="button" className="secondary" onClick={addBullet}>+ Add guideline</button>
    </div>
    <Editable label="Closing" value={data.closing} onChange={v=>update('closing',v)} textarea/>
    <div className="prep-form-grid">
      <Editable label="Name" value={data.signerName} onChange={v=>update('signerName',v)}/>
      <Editable label="Title" value={data.signerTitle} onChange={v=>update('signerTitle',v)}/>
      <Editable label="Cell" value={data.signerPhone} onChange={v=>update('signerPhone',v)}/>
      <Editable label="Email" value={data.signerEmail} onChange={v=>update('signerEmail',v)}/>
    </div>
  </div>;
}

function PrepMemoPreview({show,data}) {
  return <article className="prep-preview memo-preview">
    <div className="doc-logo">{show.logo ? <img src={show.logo} alt=""/> : <div className="doc-show-name">{show.name}</div>}</div>
    <h1>LOCATION DEPARTMENT PREP MEMO</h1>
    <div className="memo-meta">
      <b>To:</b><span>{data.to}</span><b>From:</b><span>{data.from}</span>
      <b>Date:</b><span>{dateFmt(data.date)}</span><b>Re:</b><span>{data.re}</span>
      <b>Set:</b><span>{data.set}</span>
    </div>
    <div className="memo-bullets">{data.bullets.filter(b=>b.text.trim()).map((b,i)=><div className={`memo-bullet ${b.priority?'priority':''}`} key={i}><span>●</span><p>{b.text}</p></div>)}</div>
    <p className="memo-closing">{data.closing}</p>
    <div className="memo-signature">{data.signerName&&<div>{data.signerName}</div>}{data.signerTitle&&<div>{data.signerTitle}</div>}{data.signerPhone&&<div>{data.signerPhone}</div>}{data.signerEmail&&<div>{data.signerEmail}</div>}</div>
  </article>;
}

function NeighborhoodEditor({data,setData}) {
  const update=(key,value)=>setData({...data,[key]:value});
  return <div className="prep-editor-form">
    <div className="prep-form-grid">
      <label className="prep-field"><span>Letter date</span><input type="date" value={data.letterDate} onChange={e=>update('letterDate',e.target.value)}/></label>
      <Editable label="Salutation" value={data.salutation} onChange={v=>update('salutation',v)}/>
    </div>
    <Editable label="Opening paragraph" value={data.intro} onChange={v=>update('intro',v)} textarea/>
    <div className="prep-form-grid">
      <Editable label="Prep hours" value={data.prepTimes} onChange={v=>update('prepTimes',v)}/>
      <Editable label="Filming hours" value={data.filmingTimes} onChange={v=>update('filmingTimes',v)} placeholder="e.g. 4AM – 11PM"/>
      <Editable label="Wrap hours" value={data.wrapTimes} onChange={v=>update('wrapTimes',v)}/>
      <Editable label="Equipment staging" value={data.equipmentStaging} onChange={v=>update('equipmentStaging',v)}/>
      <Editable label="Parking" value={data.parking} onChange={v=>update('parking',v)}/>
      <Editable label="Generator" value={data.generator} onChange={v=>update('generator',v)}/>
      <Editable label="Sidewalk closure" value={data.sidewalkClosure} onChange={v=>update('sidewalkClosure',v)}/>
      <Editable label="Curb lane closure" value={data.curbLaneClosure} onChange={v=>update('curbLaneClosure',v)}/>
    </div>
    <Editable label="Activity" value={data.activity} onChange={v=>update('activity',v)} textarea/>
    <Editable label="Posting" value={data.posting} onChange={v=>update('posting',v)} textarea/>
    <div className="prep-form-grid">
      <Editable label="Signer name" value={data.signerName} onChange={v=>update('signerName',v)}/>
      <Editable label="Title" value={data.signerTitle} onChange={v=>update('signerTitle',v)}/>
      <Editable label="Cell" value={data.signerPhone} onChange={v=>update('signerPhone',v)}/>
    </div>
  </div>;
}

function NeighborhoodPreview({show,loc,common,ranges,data}) {
  const fmtRange=(arr,hours)=>{
    const vals=[...new Set(arr.filter(Boolean))];
    if(!vals.length)return 'None';
    return vals.map(d=>`${dateFmt(d)} ${hours||''}`.trim()).join('\n');
  };
  return <article className="prep-preview neighborhood-preview">
    <div className="doc-logo">{show.logo ? <img src={show.logo} alt=""/> : <div className="doc-show-name">{show.name}</div>}</div>
    <p>{dateFmt(data.letterDate)}</p>
    <p className="neighbor-salutation">{data.salutation}</p>
    <p>{data.intro}</p>
    <div className="neighbor-grid">
      <b>Location:</b><span>{common.locationName}<br/>{common.locationAddress}</span>
      <b>Prep days and Times:</b><span className="preline">{fmtRange(ranges.prepDays,data.prepTimes)}</span>
      <b>Filming Days and Times:</b><span className="preline">{fmtRange(ranges.shootDays,data.filmingTimes)}</span>
      <b>Wrap Days and Times:</b><span className="preline">{fmtRange(ranges.strikeDays,data.wrapTimes)}</span>
      <b>Hold Days:</b><span className="preline">{fmtRange(ranges.holdDays,'')}</span>
      <b>Activity:</b><span>{data.activity || '________________________________________'}</span>
      <b>Equipment staging:</b><span>{data.equipmentStaging || '________________________________________'}</span>
      <b>Parking:</b><span>{data.parking || '________________________________________'}</span>
      <b>Generator:</b><span>{data.generator || '________________________________________'}</span>
      <b>Sidewalk Closure:</b><span>{data.sidewalkClosure || '________________________________________'}</span>
      <b>Curb Lane Closure:</b><span>{data.curbLaneClosure || '________________________________________'}</span>
      <b>Posting:</b><span className="preline">{data.posting || '________________________________________'}</span>
    </div>
    <p>Thank you for having us in your neighborhood and helping to keep filming in Los Angeles.</p>
    <p>Sincerely,<br/>{data.signerName || '________________________'}<br/>{data.signerTitle || '________________________'}<br/>{data.signerPhone || '________________________'}</p>
    <footer className="neighbor-footer"><b>{show.company || 'PRODUCTION COMPANY'}</b><span>{show.productionOffice?.name || 'Production Office'}</span><span>{show.productionOffice?.address || 'Production office address'}</span></footer>
  </article>;
}

const GRID_FIELDS = [
  ['LOCATION ACCESS','locationAccess'],['ENLA','enla'],['ENLA (phone)','enlaPhone'],['ENLA (contact)','enlaContact'],
  ['BLOCK','block'],['CURB COUNT','curbCount'],['SET NAME','setName'],['CREW COUNT','crewCount'],
  ['INTERIOR AND EXTERIOR','interiorExterior'],['BACKGROUND COUNT','backgroundCount'],['FILMING ACTIVITY','filmingActivity'],['AERIAL OR SFX','aerialOrSfx'],
  ['PERMIT AGENCY','permitAgency'],['PERMIT DATE','permitDate'],['PERMIT HOURS','permitHours'],['PERMIT NUMBER','permitNumber'],
  ['PREP BASECAMP','basecampName'],['PREP BASECAMP ADDRESS','basecampAddress'],['PREP BASECAMP DATES/TIMES','basecampDates'],
  ['CREW PARKING','crewParkingName'],['CREW PARKING ADDRESS','crewParkingAddress'],['CREW PARKING DATES/TIMES','crewParkingDates'],
  ['CATERING','cateringName'],['CATERING ADDRESS','cateringAddress'],['CATERING DATES/TIMES','cateringDates'],
  ['RESTROOMS','restroomLocation'],['EQUIPMENT PARKING','equipmentParking'],['PICTURE CAR PARKING','pictureCarParking'],['TRUCK / OVERFLOW PARKING','truckOverflowParking'],
  ['POSTING FOR PREP / CREW','postingForPrepCrew'],['POSTING FOR SHOOT','postingForShoot'],
  ['CLOSED STREET','closedStreet'],['LANE CLOSURE','laneClosure'],['SIDEWALK CLOSURE','sidewalkClosure'],
  ['INTERMITTENT TRAFFIC CONTROL (ITC)','intermittentTrafficControl'],['INTERMITTENT PEDESTRIAN CONTROL (IPC)','intermittentPedestrianControl'],
  ['SPECIAL EFFECTS','specialEffects'],['NOTES','notes'],['SAFETY NOTES','safetyNotes']
];

function PermitGridEditor({data,setData}) {
  const update=(key,value)=>setData({...data,[key]:value});
  return <div className="prep-editor-form permit-form">
    <div className="prep-form-grid"><label className="prep-field"><span>Prepared date</span><input type="date" value={data.preparedDate} onChange={e=>update('preparedDate',e.target.value)}/></label></div>
    <div className="permit-editor-grid">{GRID_FIELDS.map(([label,key])=><Editable key={key} label={label} value={data[key]||''} onChange={v=>update(key,v)} textarea={['filmingActivity','notes','safetyNotes'].includes(key)}/>)}</div>
  </div>;
}

function PermitGridPreview({show,common,data}) {
  const row=(label,val)=><div className="permit-row" key={label}><b>{label}</b><span>{val || ''}</span></div>;
  return <article className="prep-preview permit-preview">
    <div className="permit-title-row"><div>{show.logo?<img src={show.logo} alt=""/>:<b>{show.name}</b>}</div><div><b>{show.name}</b><span>{show.company}</span></div><div><b>{dateFmt(data.preparedDate)}</b></div></div>
    <div className="permit-section-title">LOCATION INFORMATION</div>
    {row('LOCATION',common.locationName)}{row('ADDRESS',common.locationAddress)}
    <div className="permit-section-title">LOCATION ACCESS / CONTACT</div>
    {['LOCATION ACCESS','ENLA','ENLA (phone)','ENLA (contact)'].map(label=>row(label,data[GRID_FIELDS.find(x=>x[0]===label)?.[1]]))}
    <div className="permit-section-title">DESCRIPTION</div>
    {['BLOCK','CURB COUNT','SET NAME','CREW COUNT','INTERIOR AND EXTERIOR','BACKGROUND COUNT','FILMING ACTIVITY','AERIAL OR SFX'].map(label=>row(label,data[GRID_FIELDS.find(x=>x[0]===label)?.[1]]))}
    <div className="permit-section-title">PERMIT / POLICE / FIRE</div>
    {['PERMIT AGENCY','PERMIT DATE','PERMIT HOURS','PERMIT NUMBER'].map(label=>row(label,data[GRID_FIELDS.find(x=>x[0]===label)?.[1]]))}
    <div className="permit-section-title">PARKING / BASECAMP / SUPPORT</div>
    {['PREP BASECAMP','PREP BASECAMP ADDRESS','PREP BASECAMP DATES/TIMES','CREW PARKING','CREW PARKING ADDRESS','CREW PARKING DATES/TIMES','CATERING','CATERING ADDRESS','CATERING DATES/TIMES','RESTROOMS','EQUIPMENT PARKING','PICTURE CAR PARKING','TRUCK / OVERFLOW PARKING'].map(label=>row(label,data[GRID_FIELDS.find(x=>x[0]===label)?.[1]]))}
    <div className="permit-section-title">POSTING / CLOSURES / CONTROL</div>
    {['POSTING FOR PREP / CREW','POSTING FOR SHOOT','CLOSED STREET','LANE CLOSURE','SIDEWALK CLOSURE','INTERMITTENT TRAFFIC CONTROL (ITC)','INTERMITTENT PEDESTRIAN CONTROL (IPC)','SPECIAL EFFECTS'].map(label=>row(label,data[GRID_FIELDS.find(x=>x[0]===label)?.[1]]))}
    <div className="permit-section-title">NOTES</div>{row('NOTES',data.notes)}
    <div className="permit-section-title safety">SAFETY NOTES</div>{row('SAFETY NOTES',data.safetyNotes)}
  </article>;
}

export default function PrepToolsWorkspace({show,onBack}) {
  const [ctx,setCtx]=useState({loading:true,locations:[],bibles:{},drafts:{}});
  const [tool,setTool]=useState('prep-memo');
  const [locationId,setLocationId]=useState('');
  const [draft,setDraft]=useState(null);
  const [saveState,setSaveState]=useState('');

  useEffect(()=>{let dead=false;(async()=>{
    try{
      const data=await fetchPrepToolContext(show.id);
      if(dead)return;
      const locations=(data.locations||[]).filter(x=>!x.metadata?.archived_at);
      setCtx({...data,locations,loading:false});
      const first=new URLSearchParams(window.location.search).get('locationId')||locations[0]?.id||'';
      setLocationId(first);
    }catch(error){if(!dead)setCtx({loading:false,locations:[],bibles:{},drafts:{},error:error?.message||String(error)})}
  })();return()=>{dead=true}},[show.id]);

  const loc=useMemo(()=>ctx.locations.find(x=>x.id===locationId)||ctx.locations[0]||null,[ctx.locations,locationId]);
  const bible=loc?ctx.bibles?.[loc.id]:null;
  const defaults=useMemo(()=>loc?buildDefaults(show,loc,bible):null,[show,loc,bible]);

  useEffect(()=>{
    if(!loc||!defaults)return;
    const saved=ctx.drafts?.[loc.id]||{};
    setDraft({
      prepMemo:{...defaults.prepMemo,...(saved.prepMemo||{})},
      neighborhood:{...defaults.neighborhood,...(saved.neighborhood||{})},
      permitGrid:{...defaults.permitGrid,...(saved.permitGrid||{})}
    });
  },[loc?.id,ctx.drafts,defaults]);

  async function save(){
    if(!loc||!draft)return;
    setSaveState('Saving…');
    try{
      const row=await savePrepToolDraft(show.id,loc.id,draft);
      setCtx(current=>({...current,drafts:{...current.drafts,[loc.id]:draft}}));
      setSaveState('Saved');
      setTimeout(()=>setSaveState(''),1800);
    }catch(error){setSaveState(error?.message||'Save failed')}
  }
  function print(){document.body.classList.add('prep-printing');window.print();setTimeout(()=>document.body.classList.remove('prep-printing'),250)}
  function openBible(){
    const url=new URL('https://bible.taylorscout.com');
    url.searchParams.set('show',show.id);url.searchParams.set('showId',show.id);url.searchParams.set('showName',show.name||'');
    if(loc?.id)url.searchParams.set('locationId',loc.id);
    window.location.href=url.toString();
  }

  if(ctx.loading)return <main className="prep-tools-loading">Loading Prep Tools…</main>;
  if(ctx.error)return <main className="prep-tools-loading"><h2>Prep Tools</h2><p>{ctx.error}</p><button onClick={onBack}>Back</button></main>;
  return <main className="prep-tools-shell">
    <header className="prep-tools-header">
      <button className="back" onClick={onBack}><ArrowLeft size={17}/> Show Dashboard</button>
      <div><p className="eyebrow">PREP TOOLS</p><h1>{show.name}</h1><p>Location prep documents connected to the production record.</p></div>
      <label className="prep-location-select"><span>LOCATION</span><select value={loc?.id||''} onChange={e=>setLocationId(e.target.value)}>{ctx.locations.map(x=><option key={x.id} value={x.id}>{x.location_name}{x.set_name?` — ${x.set_name}`:''}</option>)}</select></label>
    </header>

    <div className="prep-tools-layout">
      <aside className="prep-tools-nav">
        {TOOLS.map(item=>{const Icon=item.icon;return <button key={item.key} className={`prep-tool-nav-item ${tool===item.key?'active':''} ${item.awaiting?'awaiting':''}`} onClick={()=>item.key==='bible'?openBible():!item.awaiting&&setTool(item.key)}>
          <Icon size={20}/><span><b>{item.title}</b><small>{item.awaiting?'Upload example to activate':item.description}</small></span><ChevronRight size={17}/>
        </button>})}
      </aside>

      <section className="prep-tool-workspace">
        {!loc?<div className="prep-empty"><AlertTriangle/><h2>No locations available</h2><p>Add a location in Location List first.</p></div>:
        !draft?<div className="prep-empty">Loading document…</div>:
        <>
          <div className="prep-tool-toolbar">
            <div><p className="eyebrow">{TOOLS.find(x=>x.key===tool)?.title}</p><h2>{loc.location_name}</h2><p>{[loc.address,loc.city,loc.state,loc.postal_code].filter(Boolean).join(', ')}</p></div>
            <div className="prep-toolbar-actions"><span className="prep-save-state">{saveState}</span><button className="secondary" onClick={save}><Save size={16}/> Save Draft</button><button className="primary" onClick={print}><Printer size={16}/> Print / PDF</button></div>
          </div>
          <div className="prep-document-layout">
            <div className="prep-editor-pane">
              {tool==='prep-memo'&&<PrepMemoEditor show={show} loc={loc} data={draft.prepMemo} setData={x=>setDraft({...draft,prepMemo:x})}/>}
              {tool==='neighborhood-letter'&&<NeighborhoodEditor data={draft.neighborhood} setData={x=>setDraft({...draft,neighborhood:x})}/>}
              {tool==='permit-grid'&&<PermitGridEditor data={draft.permitGrid} setData={x=>setDraft({...draft,permitGrid:x})}/>}
            </div>
            <div className="prep-preview-pane">
              {tool==='prep-memo'&&<PrepMemoPreview show={show} data={draft.prepMemo}/>}
              {tool==='neighborhood-letter'&&<NeighborhoodPreview show={show} loc={loc} common={defaults.common} ranges={defaults.ranges} data={draft.neighborhood}/>}
              {tool==='permit-grid'&&<PermitGridPreview show={show} common={defaults.common} data={draft.permitGrid}/>}
            </div>
          </div>
        </>}
      </section>
    </div>
  </main>;
}
