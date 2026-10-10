import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Camera, CheckSquare, ChevronDown, ChevronRight, Clock3, FileUp,
  GripVertical, Image as ImageIcon, Mic, MoreHorizontal, Plus, Printer,
  Search, Trash2, Upload, Wifi, WifiOff, X
} from 'lucide-react';
import { fetchProductionCore, fetchMyToolAccess, supabase } from '../supabase';
import './tech-scout.css';

const DEFAULT_DEPARTMENTS = [
  'General',
  'Art Department / Construction',
  'Set Dressing',
  'Grip',
  'Electric',
  'Fixtures',
  'SPFX',
  'Transportation',
  'Locations / Misc'
];

const OFFLINE_DB = 'ts-tech-scout-offline-v1';
const OFFLINE_STORE = 'pending-notes';

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('Offline storage is unavailable.'));
    const request = indexedDB.open(OFFLINE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) db.createObjectStore(OFFLINE_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function queueOfflineNote(record) {
  const db = await openOfflineDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function listOfflineNotes() {
  try {
    const db = await openOfflineDb();
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_STORE, 'readonly');
      const req = tx.objectStore(OFFLINE_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows;
  } catch {
    return [];
  }
}

async function removeOfflineNote(id) {
  const db = await openOfflineDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function formatStamp(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(new Date(value));
}

function sceneLabel(set) {
  const values = (set.scenes || []).map(scene => scene.scene_number).filter(Boolean);
  return values.length ? values.join(', ') : '—';
}

function locationLabel(target) {
  return target.location?.location_name || target.set?.name || 'Untitled location';
}

function targetKey(target) {
  return [target.unit?.id || 'all', target.set?.id || 'none', target.location?.id || 'set'].join(':');
}

function parseImportedNotes(text, departments) {
  const byName = new Map(departments.map(d => [d.name.toLowerCase().replace(/[^a-z0-9]/g, ''), d]));
  const aliases = new Map([
    ['artdepartmentconstruction', 'artdepartmentconstruction'],
    ['artconstruction', 'artdepartmentconstruction'],
    ['locationsmisc', 'locationsmisc'],
    ['locationandmisc', 'locationsmisc'],
    ['specialeffects', 'spfx']
  ]);
  let active = departments[0] || null;
  const out = [];
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const clean = line.replace(/:$/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const mapped = aliases.get(clean) || clean;
    const heading = byName.get(mapped);
    if (heading && (line.endsWith(':') || line.length < 45)) { active = heading; continue; }
    const body = line.replace(/^[-•*]\s*/, '').trim();
    if (!body || body === '-') continue;
    if (active) out.push({ departmentId: active.id, body });
  }
  return out;
}

function NoteCard({ note, photos, canEdit, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  return <article className={`tsn-note ${note._offline ? 'is-offline' : ''}`}>
    <div className="tsn-note-body">
      {editing ? <textarea value={body} onChange={e=>setBody(e.target.value)} autoFocus/> : <p>{note.body}</p>}
      {note.is_action_item && <span className="tsn-action-pill"><CheckSquare size={13}/> Action item</span>}
    </div>
    {photos?.length > 0 && <div className="tsn-photo-row">{photos.map(photo =>
      <a key={photo.id || photo.storage_path} href={photo.signedUrl || '#'} target="_blank" rel="noreferrer" className="tsn-photo-thumb">
        {photo.signedUrl ? <img src={photo.signedUrl} alt={photo.file_name || 'Scout note'}/> : <ImageIcon size={22}/>}
      </a>
    )}</div>}
    <footer className="tsn-note-meta">
      <span><b>{note.author_name || 'Production team'}</b> · {formatStamp(note.created_at)}{note.updated_at && note.updated_at !== note.created_at ? ' · edited' : ''}{note._offline ? ' · waiting to sync' : ''}</span>
      {canEdit && !note._offline && <div className="tsn-note-actions">
        {editing ? <>
          <button onClick={()=>{setBody(note.body);setEditing(false)}}>Cancel</button>
          <button className="primary-text" onClick={async()=>{const value=body.trim(); if(!value)return; await onUpdate(note,{body:value}); setEditing(false)}}>Save</button>
        </> : <>
          <button onClick={()=>setEditing(true)}>Edit</button>
          <button className="danger-text" onClick={()=>onDelete(note)}><Trash2 size={14}/></button>
        </>}
      </div>}
    </footer>
  </article>;
}

export default function TechScoutWorkspace({ show, onBack }) {
  const [core, setCore] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [access, setAccess] = useState('view');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeUnitId, setActiveUnitId] = useState('');
  const [activeTargetKey, setActiveTargetKey] = useState('');
  const [openDepartments, setOpenDepartments] = useState({});
  const [composerDepartment, setComposerDepartment] = useState(null);
  const [draft, setDraft] = useState({ body: '', action: false, files: [] });
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [dragDepartment, setDragDepartment] = useState(null);
  const inputRef = useRef(null);

  const canEdit = show.role === 'owner' || access === 'edit' || access === 'admin';

  async function ensureDepartments() {
    const existing = await supabase.from('tech_scout_departments').select('*').eq('show_id', show.id).eq('active', true).order('sort_order').order('name');
    if (existing.error) throw existing.error;
    if (existing.data?.length) return existing.data;
    if (!canEdit && show.role !== 'owner') return [];
    const rows = DEFAULT_DEPARTMENTS.map((name, index) => ({ show_id: show.id, name, sort_order: index * 10 }));
    const inserted = await supabase.from('tech_scout_departments').upsert(rows, { onConflict: 'show_id,name', ignoreDuplicates: true }).select();
    if (inserted.error) {
      const retry = await supabase.from('tech_scout_departments').select('*').eq('show_id', show.id).eq('active', true).order('sort_order');
      if (retry.error) throw retry.error;
      return retry.data || [];
    }
    return (inserted.data || []).sort((a,b)=>a.sort_order-b.sort_order);
  }

  async function loadData({ quiet=false } = {}) {
    if (!quiet) setLoading(true);
    try {
      const [nextCore, nextAccess] = await Promise.all([
        fetchProductionCore(show.id),
        fetchMyToolAccess(show.id, 'tech_scout')
      ]);
      setCore(nextCore);
      setAccess(nextAccess);
      const [deptResult, noteResult, photoResult] = await Promise.all([
        supabase.from('tech_scout_departments').select('*').eq('show_id', show.id).eq('active', true).order('sort_order').order('name'),
        supabase.from('tech_scout_notes').select('*').eq('show_id', show.id).order('created_at'),
        supabase.from('tech_scout_note_photos').select('*').eq('show_id', show.id).order('created_at')
      ]);
      if (deptResult.error) throw deptResult.error;
      if (noteResult.error) throw noteResult.error;
      if (photoResult.error) throw photoResult.error;
      let nextDepartments = deptResult.data || [];
      if (!nextDepartments.length && (show.role === 'owner' || ['edit','admin'].includes(nextAccess))) {
        const rows = DEFAULT_DEPARTMENTS.map((name, index) => ({ show_id: show.id, name, sort_order: index * 10 }));
        const seeded = await supabase.from('tech_scout_departments').upsert(rows, { ignoreDuplicates: true }).select();
        if (!seeded.error) nextDepartments = seeded.data || [];
      }
      setDepartments(nextDepartments.sort((a,b)=>a.sort_order-b.sort_order));
      setNotes(noteResult.data || []);
      const rawPhotos = photoResult.data || [];
      const internalPaths = rawPhotos
        .map(p=>p.storage_path)
        .filter(path=>path && !/^https?:\/\//i.test(path));
      let urls = [];
      if (internalPaths.length) {
        const signed = await supabase.storage.from('tech-scout-notes').createSignedUrls(internalPaths, 3600);
        if (!signed.error) urls = signed.data || [];
      }
      const urlByPath = new Map(urls.map((item,index)=>[internalPaths[index], item.signedUrl]));
      setPhotos(rawPhotos.map(p=>({
        ...p,
        signedUrl: /^https?:\/\//i.test(p.storage_path || '') ? p.storage_path : (urlByPath.get(p.storage_path)||'')
      })));
      const queued = await listOfflineNotes();
      setPendingCount(queued.filter(item=>item.showId===show.id).length);
      setError('');
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [show.id]);

  useEffect(() => {
    const channel = supabase.channel(`tech-scout:${show.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'tech_scout_departments', filter:`show_id=eq.${show.id}` }, ()=>loadData({quiet:true}))
      .on('postgres_changes', { event:'*', schema:'public', table:'tech_scout_notes', filter:`show_id=eq.${show.id}` }, ()=>loadData({quiet:true}))
      .on('postgres_changes', { event:'*', schema:'public', table:'tech_scout_note_photos', filter:`show_id=eq.${show.id}` }, ()=>loadData({quiet:true}))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [show.id]);

  useEffect(() => {
    const syncState = () => setOnline(navigator.onLine);
    window.addEventListener('online', syncState);
    window.addEventListener('offline', syncState);
    return () => { window.removeEventListener('online', syncState); window.removeEventListener('offline', syncState); };
  }, []);

  const units = useMemo(() => {
    const list = (core?.units || []).filter(unit => unit.active !== false);
    return list.length ? list : [{id:'all',name:'All Sets',code:''}];
  }, [core]);

  const targets = useMemo(() => {
    if (!core) return [];
    const out = [];
    const desiredUnit = activeUnitId || units[0]?.id || 'all';
    for (const set of core.sets || []) {
      if (desiredUnit !== 'all' && !(set.unitIds || []).includes(desiredUnit)) continue;
      const unit = units.find(u=>u.id===desiredUnit) || null;
      const linked = set.selectedLocations?.length ? set.selectedLocations : [null];
      linked.forEach(location => out.push({ unit, set, location }));
    }
    return out.sort((a,b)=>(a.set.sort_order||0)-(b.set.sort_order||0) || locationLabel(a).localeCompare(locationLabel(b)));
  }, [core, activeUnitId, units]);

  useEffect(() => {
    if (!activeUnitId && units[0]) setActiveUnitId(units[0].id);
  }, [units, activeUnitId]);

  useEffect(() => {
    if (!targets.length) { setActiveTargetKey(''); return; }
    if (!targets.some(t=>targetKey(t)===activeTargetKey)) setActiveTargetKey(targetKey(targets[0]));
  }, [targets, activeTargetKey]);

  const activeTarget = targets.find(t=>targetKey(t)===activeTargetKey) || targets[0] || null;
  const filteredTargets = targets.filter(target => {
    const hay = `${target.set?.name||''} ${target.location?.location_name||''} ${target.location?.address||''} ${sceneLabel(target.set)}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const notesForTarget = useMemo(() => {
    if (!activeTarget) return [];
    return notes.filter(note =>
      note.set_id === activeTarget.set.id &&
      (note.unit_id || '') === (activeTarget.unit?.id === 'all' ? '' : (activeTarget.unit?.id || '')) &&
      (note.location_id || '') === (activeTarget.location?.id || '')
    );
  }, [notes, activeTarget]);

  const photosByNote = useMemo(() => {
    const map = new Map();
    photos.forEach(photo => { const list=map.get(photo.note_id)||[]; list.push(photo); map.set(photo.note_id,list); });
    return map;
  }, [photos]);

  async function createNoteWithPhotos(payload, files=[]) {
    const result = await supabase.from('tech_scout_notes').insert(payload).select().single();
    if (result.error) throw result.error;
    const note = result.data;
    for (const file of files) {
      const safeName = String(file.name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${show.id}/${note.id}/${crypto.randomUUID()}-${safeName}`;
      const upload = await supabase.storage.from('tech-scout-notes').upload(path, file, { contentType:file.type || 'image/jpeg', upsert:false });
      if (upload.error) throw upload.error;
      const photoInsert = await supabase.from('tech_scout_note_photos').insert({
        show_id: show.id, note_id: note.id, storage_path: path, file_name: file.name || safeName, mime_type: file.type || null
      });
      if (photoInsert.error) throw photoInsert.error;
    }
    return note;
  }

  async function saveNote() {
    if (!activeTarget || !composerDepartment || !draft.body.trim()) return;
    setSaving(true); setError('');
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      const payload = {
        show_id: show.id,
        unit_id: activeTarget.unit?.id && activeTarget.unit.id !== 'all' ? activeTarget.unit.id : null,
        set_id: activeTarget.set.id,
        location_id: activeTarget.location?.id || null,
        department_id: composerDepartment,
        body: draft.body.trim(),
        is_action_item: draft.action,
        author_name: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Production team'
      };
      if (!navigator.onLine) {
        const id = crypto.randomUUID();
        await queueOfflineNote({ id, showId:show.id, payload, files:draft.files, queuedAt:new Date().toISOString() });
        setNotes(current=>[...current,{...payload,id:`offline:${id}`,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),_offline:true}]);
        setPendingCount(count=>count+1);
      } else {
        await createNoteWithPhotos(payload, draft.files);
      }
      setDraft({body:'',action:false,files:[]});
      setComposerDepartment(null);
      if (inputRef.current) inputRef.current.value = '';
      await loadData({quiet:true});
    } catch (e) { setError(e?.message || String(e)); }
    finally { setSaving(false); }
  }

  async function flushOffline() {
    if (!navigator.onLine) return;
    const queued = (await listOfflineNotes()).filter(item=>item.showId===show.id);
    for (const item of queued) {
      try { await createNoteWithPhotos(item.payload, item.files || []); await removeOfflineNote(item.id); }
      catch { break; }
    }
    await loadData({quiet:true});
  }

  useEffect(() => { if (online && pendingCount) flushOffline(); }, [online]);

  async function updateNote(note, patch) {
    const result = await supabase.from('tech_scout_notes').update(patch).eq('show_id',show.id).eq('id',note.id);
    if (result.error) setError(result.error.message); else await loadData({quiet:true});
  }

  async function deleteNote(note) {
    if (!window.confirm('Delete this tech scout note?')) return;
    const attached = photosByNote.get(note.id) || [];
    if (attached.length) await supabase.storage.from('tech-scout-notes').remove(attached.map(p=>p.storage_path));
    const result = await supabase.from('tech_scout_notes').delete().eq('show_id',show.id).eq('id',note.id);
    if (result.error) setError(result.error.message); else await loadData({quiet:true});
  }

  function startVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return setError('Voice dictation is not supported in this browser.');
    const recognition = new Recognition();
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US';
    recognition.onresult = event => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      setDraft(current=>({...current,body:[current.body,text].filter(Boolean).join(current.body ? ' ' : '')}));
    };
    recognition.onerror = event => setError(`Voice dictation: ${event.error}`);
    recognition.start();
  }

  async function addDepartment() {
    const name = window.prompt('Department name');
    if (!name?.trim()) return;
    const result = await supabase.from('tech_scout_departments').insert({
      show_id:show.id, name:name.trim(), sort_order:(departments.at(-1)?.sort_order||0)+10
    }).select().single();
    if (result.error) setError(result.error.message); else await loadData({quiet:true});
  }

  async function moveDepartment(targetId) {
    if (!dragDepartment || dragDepartment===targetId) return;
    const next = [...departments];
    const from = next.findIndex(d=>d.id===dragDepartment);
    const to = next.findIndex(d=>d.id===targetId);
    const [item] = next.splice(from,1); next.splice(to,0,item);
    setDepartments(next);
    await Promise.all(next.map((dept,index)=>supabase.from('tech_scout_departments').update({sort_order:index*10}).eq('show_id',show.id).eq('id',dept.id)));
    setDragDepartment(null);
  }

  async function importNotes() {
    if (!activeTarget || !importText.trim()) return;
    const parsed = parseImportedNotes(importText, departments);
    if (!parsed.length) return setError('No notes were detected. Add department headings or paste notes under General.');
    const { data:{ user } } = await supabase.auth.getUser();
    const base = {
      show_id:show.id,
      unit_id:activeTarget.unit?.id && activeTarget.unit.id!=='all' ? activeTarget.unit.id : null,
      set_id:activeTarget.set.id,
      location_id:activeTarget.location?.id || null,
      author_name:user?.user_metadata?.full_name || user?.email || 'Production team'
    };
    const result = await supabase.from('tech_scout_notes').insert(parsed.map(item=>({...base,department_id:item.departmentId,body:item.body})));
    if (result.error) return setError(result.error.message);
    setImportText(''); setImportOpen(false); await loadData({quiet:true});
  }

  if (loading) return <main className="tsn-loading">Loading Tech Scout Notes…</main>;

  return <main className="tsn-shell">
    <header className="tsn-toolbar">
      <div className="tsn-toolbar-left">
        <button className="tsn-back" onClick={onBack}><ArrowLeft size={17}/> Back</button>
        <div><p className="tsn-eyebrow">{show.name}</p><h1>Tech Scout Notes</h1></div>
      </div>
      <div className="tsn-toolbar-actions">
        <span className={`tsn-connection ${online?'online':'offline'}`}>{online?<Wifi size={15}/>:<WifiOff size={15}/>} {online?'Live':'Offline'}{pendingCount? ` · ${pendingCount} pending`:''}</span>
        <button onClick={()=>setImportOpen(true)} disabled={!canEdit || !activeTarget}><FileUp size={16}/> Import</button>
        <button onClick={()=>window.print()}><Printer size={16}/> Print / PDF</button>
      </div>
    </header>
    {error && <div className="tsn-error">{error}<button onClick={()=>setError('')}><X size={15}/></button></div>}
    <div className="tsn-workspace">
      <aside className="tsn-sidebar">
        <label className="tsn-field"><span>Episode</span><select value={activeUnitId} onChange={e=>setActiveUnitId(e.target.value)}>
          {units.map(unit=><option key={unit.id} value={unit.id}>{unit.code ? `${unit.code} — ${unit.name}` : unit.name}</option>)}
        </select></label>
        <label className="tsn-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search sets / locations"/></label>
        <div className="tsn-targets">
          {filteredTargets.map(target => {
            const key = targetKey(target);
            const count = notes.filter(note=>note.set_id===target.set.id && (note.location_id||'')===(target.location?.id||'') && (note.unit_id||'')===(target.unit?.id==='all'?'':(target.unit?.id||''))).length;
            return <button key={key} className={`tsn-target ${key===activeTargetKey?'active':''}`} onClick={()=>setActiveTargetKey(key)}>
              <div><b>{locationLabel(target)}</b>{target.location?.location_name && <small>{target.set.name}</small>}<small>{target.location?.address || 'Set notes'}</small></div>
              <span>{count}</span>
            </button>;
          })}
          {!filteredTargets.length && <div className="tsn-empty-side">No sets or selected locations found for this episode.</div>}
        </div>
      </aside>

      <section className="tsn-main">
        {activeTarget ? <>
          <div className="tsn-location-head">
            <div><p className="tsn-eyebrow">{activeTarget.unit?.name || 'Production'}</p><h2>{locationLabel(activeTarget)}</h2>
              <p>{activeTarget.location?.location_name ? activeTarget.set.name : 'Set-level tech scout notes'}</p>
            </div>
            <div className="tsn-facts">
              <span><b>Scenes</b>{sceneLabel(activeTarget.set)}</span>
              {activeTarget.location?.address && <span><b>Address</b>{[activeTarget.location.address,activeTarget.location.city,activeTarget.location.state].filter(Boolean).join(', ')}</span>}
            </div>
          </div>

          <div className="tsn-department-list">
            {departments.map(dept => {
              const sectionNotes = notesForTarget.filter(note=>note.department_id===dept.id);
              const isOpen = openDepartments[dept.id] !== false;
              return <section key={dept.id} className="tsn-department" draggable={canEdit}
                onDragStart={()=>setDragDepartment(dept.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>moveDepartment(dept.id)}>
                <header>
                  <button className="tsn-drag" title="Drag department" disabled={!canEdit}><GripVertical size={17}/></button>
                  <button className="tsn-dept-toggle" onClick={()=>setOpenDepartments(current=>({...current,[dept.id]:!isOpen}))}>
                    {isOpen?<ChevronDown size={17}/>:<ChevronRight size={17}/>}<b>{dept.name}</b><span>{sectionNotes.length}</span>
                  </button>
                  {canEdit && <button className="tsn-add-note" onClick={()=>{setComposerDepartment(dept.id);setDraft({body:'',action:false,files:[]})}}><Plus size={15}/> Note</button>}
                </header>
                {isOpen && <div className="tsn-department-body">
                  {sectionNotes.length ? sectionNotes.map(note=><NoteCard key={note.id} note={note} photos={photosByNote.get(note.id)||[]} canEdit={canEdit} onUpdate={updateNote} onDelete={deleteNote}/>) : <p className="tsn-empty-dept">No notes yet.</p>}
                  {composerDepartment===dept.id && <div className="tsn-composer">
                    <textarea value={draft.body} onChange={e=>setDraft(current=>({...current,body:e.target.value}))} placeholder={`Add ${dept.name} note…`} autoFocus/>
                    <div className="tsn-composer-tools">
                      <div>
                        <button onClick={startVoice} type="button"><Mic size={16}/> Dictate</button>
                        <label className="tsn-file-button"><Camera size={16}/> Photos<input ref={inputRef} type="file" accept="image/*" capture="environment" multiple onChange={e=>setDraft(current=>({...current,files:Array.from(e.target.files||[])}))}/></label>
                        <label className="tsn-check"><input type="checkbox" checked={draft.action} onChange={e=>setDraft(current=>({...current,action:e.target.checked}))}/> Action item</label>
                      </div>
                      <div><button onClick={()=>setComposerDepartment(null)}>Cancel</button><button className="tsn-save" onClick={saveNote} disabled={saving||!draft.body.trim()}>{saving?'Saving…':'Save note'}</button></div>
                    </div>
                    {draft.files.length>0 && <small className="tsn-file-count">{draft.files.length} photo{draft.files.length===1?'':'s'} attached{!online?' · will sync when online':''}</small>}
                  </div>}
                </div>}
              </section>;
            })}
            {canEdit && <button className="tsn-add-department" onClick={addDepartment}><Plus size={16}/> Add department</button>}
          </div>
        </> : <div className="tsn-empty-main"><h2>No locations yet</h2><p>Add sets and selected locations in the Location List, then Tech Scout Notes will pull them in automatically.</p></div>}
      </section>
    </div>

    {importOpen && <div className="tsn-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setImportOpen(false)}}>
      <section className="tsn-modal">
        <header><div><p className="tsn-eyebrow">{activeTarget ? locationLabel(activeTarget) : ''}</p><h2>Import scout notes</h2><p>Paste from Google Docs, Notes, or another scout document. Department headings will be detected automatically.</p></div><button onClick={()=>setImportOpen(false)}><X size={18}/></button></header>
        <label className="tsn-upload-box"><Upload size={20}/><span>Upload a text or markdown export</span><input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={async e=>{const file=e.target.files?.[0]; if(file)setImportText(await file.text())}}/></label>
        <textarea className="tsn-import-text" value={importText} onChange={e=>setImportText(e.target.value)} placeholder={"General:\n- Owner will unlock south gate\n\nGrip:\n- Condor can stage behind barn"}/>
        <footer><button onClick={()=>setImportOpen(false)}>Cancel</button><button className="tsn-save" onClick={importNotes} disabled={!importText.trim()}>Import notes</button></footer>
      </section>
    </div>}
  </main>;
}
