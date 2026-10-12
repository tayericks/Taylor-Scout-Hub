import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, CalendarDays, Camera, Check, ChevronDown, ChevronRight,
  Circle, ClipboardList, FileText, MapPin, ParkingCircle, Pin, Search,
  ShieldCheck, Truck, Users, Wrench
} from 'lucide-react';
import { fetchMyToolAccess, fetchProductionCore, supabase } from '../supabase';
import './set-prep.css';

const STATUS_KEYS = [
  ['permit','Permit'],
  ['owner','Owner OK'],
  ['parking','Parking'],
  ['posting','Posting'],
  ['vendors','Vendors'],
  ['prep','Prep'],
  ['shoot','Shoot'],
  ['wrap','Wrap']
];

const SECTION_DEFS = [
  ['contacts','Contacts',Users],
  ['access','Access',MapPin],
  ['parking','Parking',ParkingCircle],
  ['permits','Permits',ShieldCheck],
  ['vendors','Vendors',Truck],
  ['prepNotes','Prep Notes',Wrench],
  ['shootNotes','Shoot Notes',CalendarDays],
  ['wrap','Wrap & Restoration',Check],
  ['documents','Documents',FileText]
];

const EMPTY_FOLDER = {
  statuses:{},
  pinned_info:[],
  sections:{
    contacts:'',access:'',parking:'',permits:'',vendors:'',
    prepNotes:'',shootNotes:'',wrap:'',documents:''
  }
};

function sceneSummary(set){
  const values=(set?.scenes||[]).map(s=>s.scene_number).filter(Boolean);
  return values.length?values.join(', '):'—';
}
function folderKey(setId,locationId){return `${setId}:${locationId||'set'}`}
function targetKey(target){return folderKey(target.set.id,target.location?.id)}
function cleanLines(text){return String(text||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,6)}
function formatDate(value){
  if(!value)return '—';
  const d=new Date(`${value}T12:00:00`);
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
}
function scheduleFor(target){
  const m=target.location?.metadata||{};
  const event=(m.calendar_events||[]).find(e=>String(e.set||'').toLowerCase()===String(target.set.name||'').toLowerCase()) || (m.calendar_events||[])[0];
  return event?.schedule||m.schedule||{};
}
function mergeFolder(row){
  if(!row)return structuredClone(EMPTY_FOLDER);
  return {
    ...row,
    statuses:{...EMPTY_FOLDER.statuses,...(row.statuses||{})},
    pinned_info:Array.isArray(row.pinned_info)?row.pinned_info:[],
    sections:{...EMPTY_FOLDER.sections,...(row.sections||{})}
  };
}
function statusMeta(value){
  if(value==='done')return {label:'Done',next:'not_started'};
  if(value==='in_progress')return {label:'In progress',next:'done'};
  return {label:'Not started',next:'in_progress'};
}

function TextSection({label,Icon,value,onChange,readOnly,open,onToggle,placeholder}){
  return <section className="spf-section">
    <button className="spf-section-head" onClick={onToggle}>
      <span className="spf-section-icon"><Icon size={17}/></span>
      <b>{label}</b>
      {value?.trim() && <span className="spf-has-content">Added</span>}
      {open?<ChevronDown size={17}/>:<ChevronRight size={17}/>}
    </button>
    {open&&<div className="spf-section-body">
      {readOnly
        ? <div className="spf-readonly-text">{value?.trim()||'No information added yet.'}</div>
        : <textarea value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder||`Add ${label.toLowerCase()} information…`}/>}
    </div>}
  </section>;
}

export default function SetPrepWorkspace({show,onBack}){
  const [core,setCore]=useState(null);
  const [access,setAccess]=useState('view');
  const [folders,setFolders]=useState([]);
  const [staffing,setStaffing]=useState([]);
  const [members,setMembers]=useState([]);
  const [techNotes,setTechNotes]=useState([]);
  const [techPhotos,setTechPhotos]=useState([]);
  const [documents,setDocuments]=useState([]);
  const [activeUnitId,setActiveUnitId]=useState('');
  const [activeTargetKey,setActiveTargetKey]=useState('');
  const [query,setQuery]=useState('');
  const [draft,setDraft]=useState(structuredClone(EMPTY_FOLDER));
  const [staffDraft,setStaffDraft]=useState({key_name:'',alm_names:[]});
  const [openSections,setOpenSections]=useState({contacts:true,access:true,tech:true});
  const [saveState,setSaveState]=useState('Saved');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const hydratedRef=useRef(false);
  const saveTimer=useRef(null);

  const canEdit=show.role==='owner'||access==='edit'||access==='admin';

  async function load({quiet=false}={}){
    if(!quiet)setLoading(true);
    try{
      const [nextCore,nextAccess,folderRes,staffRes,memberRes,noteRes,photoRes,docRes]=await Promise.all([
        fetchProductionCore(show.id),
        fetchMyToolAccess(show.id,'set_prep'),
        supabase.from('set_prep_folders').select('*').eq('show_id',show.id),
        supabase.from('production_set_staffing').select('*').eq('show_id',show.id),
        supabase.rpc('list_show_members',{p_show_id:show.id}),
        supabase.from('tech_scout_notes').select('*').eq('show_id',show.id).order('created_at'),
        supabase.from('tech_scout_note_photos').select('*').eq('show_id',show.id).order('created_at'),
        supabase.from('production_documents').select('id,unit_id,set_id,location_id,document_type,title,storage_path,is_final,metadata,created_at').eq('show_id',show.id).order('created_at',{ascending:false})
      ]);
      [folderRes,staffRes,noteRes,photoRes,docRes].forEach(r=>{if(r.error)throw r.error});
      setCore(nextCore); setAccess(nextAccess);
      setFolders(folderRes.data||[]); setStaffing(staffRes.data||[]);
      if(!memberRes.error)setMembers((memberRes.data||[]).filter(m=>m.status!=='pending'));
      setTechNotes(noteRes.data||[]);
      const rawPhotos=photoRes.data||[];
      const internal=rawPhotos.map(p=>p.storage_path).filter(path=>path&&!/^https?:\/\//i.test(path));
      let signed=[];
      if(internal.length){
        const sr=await supabase.storage.from('tech-scout-notes').createSignedUrls(internal,3600);
        if(!sr.error)signed=sr.data||[];
      }
      const signedMap=new Map(signed.map((x,i)=>[internal[i],x.signedUrl]));
      setTechPhotos(rawPhotos.map(p=>({...p,signedUrl:/^https?:\/\//i.test(p.storage_path||'')?p.storage_path:(signedMap.get(p.storage_path)||'')})));
      setDocuments(docRes.data||[]);
      setError('');
    }catch(e){setError(e?.message||String(e))}
    finally{if(!quiet)setLoading(false)}
  }

  useEffect(()=>{load()},[show.id]);

  useEffect(()=>{
    const channel=supabase.channel(`set-prep:${show.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'set_prep_folders',filter:`show_id=eq.${show.id}`},()=>load({quiet:true}))
      .on('postgres_changes',{event:'*',schema:'public',table:'production_set_staffing',filter:`show_id=eq.${show.id}`},()=>load({quiet:true}))
      .subscribe();
    return()=>{supabase.removeChannel(channel)};
  },[show.id]);

  const units=useMemo(()=>core?.units||[],[core]);
  useEffect(()=>{if(!activeUnitId&&units[0])setActiveUnitId(units[0].id)},[units,activeUnitId]);

  const targets=useMemo(()=>{
    if(!core)return[];
    const result=[];
    const unit=units.find(u=>u.id===activeUnitId)||null;
    for(const set of core.sets||[]){
      if(activeUnitId && !(set.unitIds||[]).includes(activeUnitId))continue;
      const locs=set.selectedLocations?.length?set.selectedLocations:[null];
      for(const location of locs)result.push({unit,set,location});
    }
    return result.sort((a,b)=>(a.set.sort_order||0)-(b.set.sort_order||0)||String(a.location?.location_name||'').localeCompare(String(b.location?.location_name||'')));
  },[core,units,activeUnitId]);

  useEffect(()=>{
    if(targets.length&&!targets.some(t=>targetKey(t)===activeTargetKey))setActiveTargetKey(targetKey(targets[0]));
  },[targets,activeTargetKey]);

  const active=targets.find(t=>targetKey(t)===activeTargetKey)||targets[0]||null;
  const filtered=targets.filter(t=>{
    const hay=`${t.set.name} ${t.location?.location_name||''} ${t.location?.address||''} ${sceneSummary(t.set)}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  useEffect(()=>{
    if(!active)return;
    hydratedRef.current=false;
    clearTimeout(saveTimer.current);
    const saved=folders.find(f=>f.folder_key===targetKey(active));
    setDraft(mergeFolder(saved));
    const st=staffing.find(x=>x.set_id===active.set.id);
    setStaffDraft({key_name:st?.key_name||'',alm_names:Array.isArray(st?.alm_names)?st.alm_names:[]});
    setSaveState('Saved');
    requestAnimationFrame(()=>{hydratedRef.current=true});
  },[activeTargetKey,folders,staffing,active?.set?.id]);

  async function persist(nextDraft=draft,nextStaff=staffDraft){
    if(!active||!canEdit)return;
    setSaveState('Saving…');
    const folderPayload={
      show_id:show.id,
      folder_key:targetKey(active),
      unit_id:active.unit?.id||null,
      set_id:active.set.id,
      location_id:active.location?.id||null,
      statuses:nextDraft.statuses||{},
      pinned_info:nextDraft.pinned_info||[],
      sections:nextDraft.sections||{}
    };
    const [folderRes,staffRes]=await Promise.all([
      supabase.from('set_prep_folders').upsert(folderPayload,{onConflict:'show_id,folder_key'}),
      supabase.from('production_set_staffing').upsert({
        show_id:show.id,set_id:active.set.id,key_name:nextStaff.key_name?.trim()||null,alm_names:nextStaff.alm_names||[]
      },{onConflict:'show_id,set_id'})
    ]);
    if(folderRes.error||staffRes.error){
      setError(folderRes.error?.message||staffRes.error?.message||'Could not save');
      setSaveState('Save failed');
      return;
    }
    setSaveState('Saved');
  }

  function queueSave(nextDraft,nextStaff=staffDraft){
    if(!canEdit||!hydratedRef.current)return;
    clearTimeout(saveTimer.current);
    setSaveState('Unsaved');
    saveTimer.current=setTimeout(()=>persist(nextDraft,nextStaff),650);
  }
  function changeDraft(updater){
    setDraft(current=>{
      const next=typeof updater==='function'?updater(current):updater;
      queueSave(next,staffDraft); return next;
    });
  }
  function changeStaff(patch){
    setStaffDraft(current=>{
      const next={...current,...patch};
      queueSave(draft,next); return next;
    });
  }
  function cycleStatus(key){
    if(!canEdit)return;
    changeDraft(current=>{
      const currentValue=current.statuses?.[key]||'not_started';
      const nextValue=statusMeta(currentValue).next;
      return {...current,statuses:{...current.statuses,[key]:nextValue}};
    });
  }
  function setSection(key,value){
    changeDraft(current=>({...current,sections:{...current.sections,[key]:value}}));
  }

  const schedule=active?scheduleFor(active):{};
  const techForActive=useMemo(()=>{
    if(!active)return[];
    return techNotes.filter(n=>n.set_id===active.set.id&&(n.location_id||'')===(active.location?.id||''));
  },[active,techNotes]);
  const photosByNote=useMemo(()=>{
    const map=new Map();
    techPhotos.forEach(p=>{const list=map.get(p.note_id)||[];list.push(p);map.set(p.note_id,list)});
    return map;
  },[techPhotos]);
  const docsForActive=useMemo(()=>{
    if(!active)return[];
    return documents.filter(d=>d.set_id===active.set.id&&(!d.location_id||d.location_id===active.location?.id));
  },[active,documents]);

  if(loading)return <main className="spf-loading">Loading Set Prep Folder…</main>;

  return <main className="spf-shell">
    <header className="spf-toolbar">
      <div className="spf-toolbar-left">
        <button className="spf-back" onClick={onBack}><ArrowLeft size={17}/> Back</button>
        <div><p className="spf-eyebrow">{show.name}</p><h1>Set Prep Folder</h1></div>
      </div>
      <div className="spf-save-state">{canEdit?saveState:'View only'}</div>
    </header>
    {error&&<div className="spf-error">{error}</div>}

    <div className="spf-workspace">
      <aside className="spf-sidebar">
        <label className="spf-field"><span>Episode</span><select value={activeUnitId} onChange={e=>setActiveUnitId(e.target.value)}>
          {units.map(u=><option key={u.id} value={u.id}>{u.code?`${u.code} — ${u.name}`:u.name}</option>)}
        </select></label>
        <label className="spf-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search sets / locations"/></label>
        <div className="spf-folder-list">
          {filtered.map(t=>{
            const key=targetKey(t);
            const saved=folders.find(f=>f.folder_key===key);
            const completed=STATUS_KEYS.filter(([statusKey])=>saved?.statuses?.[statusKey]==='done').length;
            return <button key={key} className={`spf-folder-item ${key===activeTargetKey?'active':''}`} onClick={()=>setActiveTargetKey(key)}>
              <div><b>{t.location?.location_name||t.set.name}</b>{t.location&&<small>{t.set.name}</small>}<small>{t.location?.address||'Stage / set'}</small></div>
              <span>{completed}/{STATUS_KEYS.length}</span>
            </button>
          })}
        </div>
      </aside>

      <section className="spf-main">
        {!active?<div className="spf-empty"><h2>No set folders yet</h2><p>Add sets and selected locations first.</p></div>:<>
          <section className="spf-hero">
            <div className="spf-hero-title">
              <p className="spf-eyebrow">{active.unit?.name||'Production'}</p>
              <h2>{active.location?.location_name||active.set.name}</h2>
              {active.location&&<p>{active.set.name}</p>}
              <div className="spf-address">{active.location?.address||'Stage / controlled set'}</div>
            </div>
            <div className="spf-meta-grid">
              <span><b>Scenes</b>{sceneSummary(active.set)}</span>
              <span><b>Prep</b>{formatDate(schedule.prep_start)}{schedule.prep_end&&schedule.prep_end!==schedule.prep_start?` – ${formatDate(schedule.prep_end)}`:''}</span>
              <span><b>Shoot</b>{formatDate(schedule.shoot_start)}{schedule.shoot_end&&schedule.shoot_end!==schedule.shoot_start?` – ${formatDate(schedule.shoot_end)}`:''}</span>
              <span><b>Wrap</b>{formatDate(schedule.strike_start)}{schedule.strike_end&&schedule.strike_end!==schedule.strike_start?` – ${formatDate(schedule.strike_end)}`:''}</span>
            </div>
          </section>

          <section className="spf-staffing">
            <div className="spf-block-title"><div><p className="spf-eyebrow">SET OWNERSHIP</p><h3>Key & ALM</h3></div><small>Default staffing follows this set throughout Taylor Scout. Calendar date overrides will supersede it when present.</small></div>
            <div className="spf-staff-grid">
              <label><span>Key ALM</span><input disabled={!canEdit} list="spf-member-names" value={staffDraft.key_name} onChange={e=>changeStaff({key_name:e.target.value})} placeholder="Assign Key"/></label>
              <label><span>ALMs</span><input disabled={!canEdit} value={(staffDraft.alm_names||[]).join(', ')} onChange={e=>changeStaff({alm_names:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})} placeholder="Names separated by commas"/></label>
              <datalist id="spf-member-names">{members.map(m=><option key={m.user_id||m.email} value={m.display_name||m.email}/>)}</datalist>
            </div>
          </section>

          <section className="spf-status-panel">
            <div className="spf-block-title"><div><p className="spf-eyebrow">CHECKPOINTS</p><h3>Set readiness</h3></div><small>Tap a status to advance it.</small></div>
            <div className="spf-statuses">{STATUS_KEYS.map(([key,label])=>{
              const value=draft.statuses?.[key]||'not_started';
              const meta=statusMeta(value);
              return <button key={key} disabled={!canEdit} className={`spf-status ${value}`} onClick={()=>cycleStatus(key)}>
                {value==='done'?<Check size={15}/>:value==='in_progress'?<Circle size={13}/>:<Circle size={13}/>}<span><b>{label}</b><small>{meta.label}</small></span>
              </button>
            })}</div>
          </section>

          <section className="spf-pins">
            <div className="spf-block-title"><div><p className="spf-eyebrow">PINNED INFO</p><h3>Must-see details</h3></div><small>Up to 6 items that stay at the top of this set.</small></div>
            {canEdit
              ? <textarea value={(draft.pinned_info||[]).join('\n')} onChange={e=>changeDraft(current=>({...current,pinned_info:cleanLines(e.target.value)}))} placeholder={"Gate code / access note\nOwner restriction\nParking instruction"}/>
              : <div className="spf-pin-list">{draft.pinned_info?.length?draft.pinned_info.map((item,i)=><div key={i}><Pin size={14}/>{item}</div>):<p>No pinned information.</p>}</div>}
          </section>

          <div className="spf-sections">
            {SECTION_DEFS.map(([key,label,Icon])=><TextSection key={key} label={label} Icon={Icon} value={draft.sections?.[key]||''}
              readOnly={!canEdit} onChange={value=>setSection(key,value)} open={Boolean(openSections[key])}
              onToggle={()=>setOpenSections(current=>({...current,[key]:!current[key]}))}/>)}

            <section className="spf-section">
              <button className="spf-section-head" onClick={()=>setOpenSections(current=>({...current,tech:!current.tech}))}>
                <span className="spf-section-icon"><ClipboardList size={17}/></span><b>Tech Scout Notes</b>
                <span className="spf-count">{techForActive.length}</span>{openSections.tech?<ChevronDown size={17}/>:<ChevronRight size={17}/>}
              </button>
              {openSections.tech&&<div className="spf-section-body">
                {techForActive.length===0?<div className="spf-muted">No Tech Scout Notes yet.</div>:techForActive.map(note=><article className="spf-tech-note" key={note.id}>
                  <p>{note.body}</p><small>{note.author_name||'Production team'} · {new Date(note.created_at).toLocaleString()}</small>
                  {(photosByNote.get(note.id)||[]).length>0&&<div className="spf-photo-row">{(photosByNote.get(note.id)||[]).map(photo=><a key={photo.id} href={photo.signedUrl||'#'} target="_blank" rel="noreferrer">{photo.signedUrl?<img src={photo.signedUrl} alt="Tech scout reference"/>:<Camera size={20}/>}</a>)}</div>}
                </article>)}
              </div>}
            </section>

            <section className="spf-section">
              <button className="spf-section-head" onClick={()=>setOpenSections(current=>({...current,photos:!current.photos}))}>
                <span className="spf-section-icon"><Camera size={17}/></span><b>Photos</b>
                <span className="spf-count">{techForActive.reduce((sum,n)=>sum+(photosByNote.get(n.id)||[]).length,0)}</span>{openSections.photos?<ChevronDown size={17}/>:<ChevronRight size={17}/>}
              </button>
              {openSections.photos&&<div className="spf-section-body">
                <div className="spf-gallery">{techForActive.flatMap(n=>(photosByNote.get(n.id)||[])).map(photo=><a key={photo.id} href={photo.signedUrl||'#'} target="_blank" rel="noreferrer">{photo.signedUrl?<img src={photo.signedUrl} alt="Set reference"/>:<Camera size={24}/>}</a>)}</div>
                {techForActive.every(n=>(photosByNote.get(n.id)||[]).length===0)&&<div className="spf-muted">No linked Tech Scout photos yet.</div>}
              </div>}
            </section>

            <section className="spf-section">
              <button className="spf-section-head" onClick={()=>setOpenSections(current=>({...current,linkedDocs:!current.linkedDocs}))}>
                <span className="spf-section-icon"><BookOpen size={17}/></span><b>Linked Taylor Scout Documents</b>
                <span className="spf-count">{docsForActive.length}</span>{openSections.linkedDocs?<ChevronDown size={17}/>:<ChevronRight size={17}/>}
              </button>
              {openSections.linkedDocs&&<div className="spf-section-body">
                {docsForActive.length?docsForActive.map(doc=><div className="spf-doc-row" key={doc.id}><FileText size={16}/><div><b>{doc.title}</b><small>{doc.document_type}{doc.is_final?' · Final':''}</small></div></div>):<div className="spf-muted">No linked production documents yet.</div>}
              </div>}
            </section>
          </div>
        </>}
      </section>
    </div>
  </main>;
}
