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
      signerPhone:'',
      include:{
        equipmentStaging:true,
        parking:true,
        generator:true,
        sidewalkClosure:true,
        curbLaneClosure:true,
        posting:true
      }
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
      safetyNotes:'',
      locationManagerInfo:'',
      kalm:'',
      kalmCloser:'',
      almOpener:'',
      lineProducer:'',
      director:'',
      firstAD:'',
      episodeScenes:'',
      areasOfUse:'',
      prepDates:prepDays.filter(Boolean).map(shortDate).join(', '),
      prepHours:'',
      shootDates:shootDays.filter(Boolean).map(shortDate).join(', '),
      shootHours:'',
      strikeDates:strikeDays.filter(Boolean).map(shortDate).join(', '),
      strikeHours:'',
      holdDates:holdDays.filter(Boolean).map(shortDate).join(', '),
      holdHours:'',
      prepTruckParking:'',
      prepTruckParkingDates:'',
      prepCrewParking:'',
      prepCrewParkingDates:'',
      backgroundParking:'',
      backgroundParkingDates:'',
      displacementParking:'',
      displacementParkingDates:'',
      generatorPlacement:'',
      generatorDates:'',
      busStopBikeLane:'',
      busStopBikeLaneDates:'',
      effectsDates:'',
      dateSubmitted:'',
      filmingActivities:[]
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

function OptionalNeighborhoodField({label,field,data,setData,textarea=false,placeholder=''}) {
  const included=data.include?.[field]!==false;
  const updateInclude=value=>setData({...data,include:{...(data.include||{}),[field]:value}});
  const updateValue=value=>setData({...data,[field]:value});
  return <div className={`neighbor-option ${included?'included':'excluded'}`}>
    <div className="neighbor-option-head">
      <span>{label}</span>
      <label className="include-toggle"><input type="checkbox" checked={included} onChange={e=>updateInclude(e.target.checked)}/><span>Include on letter</span></label>
    </div>
    {textarea?<textarea disabled={!included} value={data[field]||''} onChange={e=>updateValue(e.target.value)} placeholder={placeholder}/>:<input disabled={!included} value={data[field]||''} onChange={e=>updateValue(e.target.value)} placeholder={placeholder}/>}
  </div>;
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
      <OptionalNeighborhoodField label="Equipment staging" field="equipmentStaging" data={data} setData={setData}/>
      <OptionalNeighborhoodField label="Parking" field="parking" data={data} setData={setData}/>
      <OptionalNeighborhoodField label="Generator" field="generator" data={data} setData={setData}/>
      <OptionalNeighborhoodField label="Sidewalk closure" field="sidewalkClosure" data={data} setData={setData}/>
      <OptionalNeighborhoodField label="Curb lane closure" field="curbLaneClosure" data={data} setData={setData}/>
    </div>
    <Editable label="Activity" value={data.activity} onChange={v=>update('activity',v)} textarea/>
    <OptionalNeighborhoodField label="Posting" field="posting" data={data} setData={setData} textarea/>
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
      {data.include?.equipmentStaging!==false&&<><b>Equipment staging:</b><span>{data.equipmentStaging || '________________________________________'}</span></>}
      {data.include?.parking!==false&&<><b>Parking:</b><span>{data.parking || '________________________________________'}</span></>}
      {data.include?.generator!==false&&<><b>Generator:</b><span>{data.generator || '________________________________________'}</span></>}
      {data.include?.sidewalkClosure!==false&&<><b>Sidewalk Closure:</b><span>{data.sidewalkClosure || '________________________________________'}</span></>}
      {data.include?.curbLaneClosure!==false&&<><b>Curb Lane Closure:</b><span>{data.curbLaneClosure || '________________________________________'}</span></>}
      {data.include?.posting!==false&&<><b>Posting:</b><span className="preline">{data.posting || '________________________________________'}</span></>}
    </div>
    <p>Thank you for having us in your neighborhood and helping to keep filming in Los Angeles.</p>
    <p>Sincerely,<br/>{data.signerName || '________________________'}<br/>{data.signerTitle || '________________________'}<br/>{data.signerPhone || '________________________'}</p>
    <footer className="neighbor-footer"><b>{show.company || 'PRODUCTION COMPANY'}</b><span>{show.productionOffice?.name || 'Production Office'}</span><span>{show.productionOffice?.address || 'Production office address'}</span></footer>
  </article>;
}

const GRID_FIELDS = [
  ['LOCATION MANAGER INFO','locationManagerInfo'],['KALM','kalm'],['KALM (closer)','kalmCloser'],['ALM (opener)','almOpener'],
  ['LINE PRODUCER','lineProducer'],['DIRECTOR','director'],['1st AD','firstAD'],['EPISODE AND SCENE','episodeScenes'],
  ['BLOCK','block'],['SET NAME','setName'],['CREW COUNT','crewCount'],['CAST COUNT','castCount'],['BACKGROUND COUNT','backgroundCount'],
  ['FILMING ACTIVITY','filmingActivity'],['AREAS OF USE','areasOfUse'],
  ['PREP DATES','prepDates'],['PREP HOURS','prepHours'],['SHOOT DATES','shootDates'],['SHOOT HOURS','shootHours'],
  ['STRIKE DATES','strikeDates'],['STRIKE HOURS','strikeHours'],['HOLD DATES','holdDates'],['HOLD HOURS','holdHours'],
  ['PREP TRUCK PARKING','prepTruckParking'],['PREP TRUCK PARKING DATES/TIMES','prepTruckParkingDates'],
  ['PREP CREW PARKING','prepCrewParking'],['PREP CREW PARKING DATES/TIMES','prepCrewParkingDates'],
  ['BASECAMP','basecampName'],['BASECAMP ADDRESS','basecampAddress'],['BASECAMP DATES/TIMES','basecampDates'],
  ['CREW PARKING','crewParkingName'],['CREW PARKING ADDRESS','crewParkingAddress'],['CREW PARKING DATES/TIMES','crewParkingDates'],
  ['BACKGROUND PARKING','backgroundParking'],['BACKGROUND PARKING DATES/TIMES','backgroundParkingDates'],
  ['PICTURE CAR PARKING','pictureCarParking'],['WORK TRUCK / OVERFLOW PARKING','truckOverflowParking'],
  ['CATERING','cateringName'],['CATERING ADDRESS','cateringAddress'],['CATERING DATES/TIMES','cateringDates'],
  ['DISPLACEMENT PARKING','displacementParking'],['DISPLACEMENT PARKING DATES/TIMES','displacementParkingDates'],
  ['GENERATOR PLACEMENT','generatorPlacement'],['GENERATOR DATES/TIMES','generatorDates'],
  ['POSTING FOR PREP/STRIKE','postingForPrepCrew'],['POSTING FOR SHOOT','postingForShoot'],
  ['LANE CLOSURE, FULL/PARTIAL','laneClosure'],['SIDEWALK CLOSURE','sidewalkClosure'],['BUS STOP REMOVAL / BIKE LANE','busStopBikeLane'],
  ['INTERMITTENT TRAFFIC CONTROL (ITC)','intermittentTrafficControl'],['INTERMITTENT PEDESTRIAN CONTROL (IPC)','intermittentPedestrianControl'],
  ['EFFECTS','specialEffects'],['EFFECTS DATES/TIMES','effectsDates'],['NOTES','notes'],['DATE SUBMITTED','dateSubmitted'],['SAFETY NOTES','safetyNotes']
];

const FILMING_ACTIVITIES = [
  'Aerial Photography with remote control aircraft (UAS)','Animal on set','Atmospheric smoke effects (water based)',
  'Brandishing weapons','Brandishing weapons (not in public view)','Camera in car','Camera on sticks','Car-to-Car',
  'Crossovers in street','Drive by','Drive ups & away','Driving shots','Driving shots with the flow of traffic',
  'Emergency vehicles with flashing lights','Equipment across street','Equipment on property','Equipment on sand',
  'Equipment on sidewalk & street','Equipment on sidewalk only','Equipment on sidewalk, in curb lane & across street',
  'Extended run, holding intersections','Exterior Dialogue','Exterior establishing shots','Exterior models against scenery',
  'Exterior motion without sound','Exterior music performance and amplified playback','Generators','Handheld equipment',
  'Helicopter activity','Helicopter landing & take off','Interior and exterior dialogue','Interior and exterior motion without sound',
  'Interior and exterior music performance and amplified playback','Interior Dialogue','Interior models against scenery',
  'Interior motion without sound','Interior music performance and amplified playback','Intermittent pedestrian control',
  'Intermittent traffic control - 2 minute standard','Intermittent traffic control - 90 seconds standard','Near hits & misses',
  'Precision driving','Process Trailer','Rain effects','Rooftop activity','Running & tow shots','Smoking herbal cigarettes',
  'Talent in police uniforms','Wetdown','Wind effects'
];

function PermitGridEditor({data,setData}) {
  const update=(key,value)=>setData({...data,[key]:value});
  const toggleActivity=value=>{
    const current=new Set(data.filmingActivities||[]);
    current.has(value)?current.delete(value):current.add(value);
    setData({...data,filmingActivities:[...current],filmingActivity:[...current].join(', ')});
  };
  return <div className="prep-editor-form permit-form">
    <div className="prep-form-grid"><label className="prep-field"><span>Prepared date</span><input type="date" value={data.preparedDate} onChange={e=>update('preparedDate',e.target.value)}/></label></div>
    <div className="permit-editor-grid">{GRID_FIELDS.map(([label,key])=><Editable key={key} label={label} value={data[key]||''} onChange={v=>update(key,v)} textarea={['filmingActivity','areasOfUse','notes','safetyNotes'].includes(key)}/>)}</div>
    <div className="prep-subhead">FILMING ACTIVITIES</div>
    <div className="filming-activity-checklist">{FILMING_ACTIVITIES.map(item=><label key={item}><input type="checkbox" checked={(data.filmingActivities||[]).includes(item)} onChange={()=>toggleActivity(item)}/><span>{item}</span></label>)}</div>
  </div>;
}

function PermitGridPreview({show,common,data}) {
  const row=(label,val)=><div className="permit-row" key={label}><b>{label}</b><span>{val || ''}</span></div>;
  const rows=labels=>labels.map(label=>row(label,data[GRID_FIELDS.find(x=>x[0]===label)?.[1]]));
  return <article className="prep-preview permit-preview">
    <div className="permit-title-row"><div>{show.logo?<img src={show.logo} alt=""/>:<b>{show.name}</b>}</div><div><b>{show.company || show.name}</b><span>{show.productionOffice?.address||''}</span></div><div><b>as of {shortDate(data.preparedDate)}</b></div></div>
    <div className="permit-section-title">LOCATION MANAGER INFO</div>
    {rows(['LOCATION MANAGER INFO','KALM','KALM (closer)','ALM (opener)','LINE PRODUCER','DIRECTOR','1st AD'])}
    <div className="permit-section-title">LOCATION INFORMATION</div>
    {row('LOCATION ADDRESS',common.locationAddress)}{rows(['EPISODE AND SCENE'])}
    <div className="permit-section-title">DESCRIPTION</div>
    {rows(['BLOCK','SET NAME','CREW COUNT','CAST COUNT','BACKGROUND COUNT','FILMING ACTIVITY','AREAS OF USE'])}
    <div className="permit-section-title">PREP / SHOOT / STRIKE</div>
    {rows(['PREP DATES','PREP HOURS','SHOOT DATES','SHOOT HOURS','STRIKE DATES','STRIKE HOURS','HOLD DATES','HOLD HOURS'])}
    <div className="permit-section-title">PREP PARKING</div>
    {rows(['PREP TRUCK PARKING','PREP TRUCK PARKING DATES/TIMES','PREP CREW PARKING','PREP CREW PARKING DATES/TIMES'])}
    <div className="permit-section-title">SHOOT PARKING</div>
    {rows(['BASECAMP','BASECAMP ADDRESS','BASECAMP DATES/TIMES','CREW PARKING','CREW PARKING ADDRESS','CREW PARKING DATES/TIMES','BACKGROUND PARKING','BACKGROUND PARKING DATES/TIMES','PICTURE CAR PARKING','WORK TRUCK / OVERFLOW PARKING','CATERING','CATERING ADDRESS','CATERING DATES/TIMES','DISPLACEMENT PARKING','DISPLACEMENT PARKING DATES/TIMES','GENERATOR PLACEMENT','GENERATOR DATES/TIMES'])}
    <div className="permit-section-title">POSTING FOR PREP / STRIKE</div>{rows(['POSTING FOR PREP/STRIKE'])}
    <div className="permit-section-title">POSTING FOR SHOOT</div>{rows(['POSTING FOR SHOOT'])}
    <div className="permit-section-title">CLOSURES</div>{rows(['LANE CLOSURE, FULL/PARTIAL','SIDEWALK CLOSURE','BUS STOP REMOVAL / BIKE LANE'])}
    <div className="permit-section-title">INTERMITTENT CONTROL (IPC / ITC)</div>{rows(['INTERMITTENT TRAFFIC CONTROL (ITC)','INTERMITTENT PEDESTRIAN CONTROL (IPC)'])}
    <div className="permit-section-title">EFFECTS</div>{rows(['EFFECTS','EFFECTS DATES/TIMES'])}
    <div className="permit-section-title">NOTES</div>{rows(['NOTES','DATE SUBMITTED'])}
    <div className="permit-section-title safety">FILMING ACTIVITIES</div>
    <div className="permit-activity-grid">{FILMING_ACTIVITIES.map(item=><span key={item} className={(data.filmingActivities||[]).includes(item)?'selected':''}>{(data.filmingActivities||[]).includes(item)?'☑':'☐'} {item}</span>)}</div>
    <div className="permit-section-title safety">SAFETY NOTES</div>{rows(['SAFETY NOTES'])}
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
