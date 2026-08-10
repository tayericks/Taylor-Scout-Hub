import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, ClipboardPaste, GripVertical, Layers3, LockKeyhole, MapPin,
  Plus, RefreshCw, Search, Trash2, Warehouse, X
} from 'lucide-react';
import {
  deleteProductionSet, fetchMyToolAccess, fetchProductionCore, reorderProductionSets,
  saveProductionSet, subscribeProductionCore
} from './supabase';

function emptySet(sortOrder = 0) {
  return {
    id: null, name: '', set_number: '', int_ext: 'INT', work_type: 'location', day_night: 'DAY',
    page_count: '', requirements: '', notes: '', sort_order: sortOrder,
    parent_set_id: null, unitIds: [], scenes: []
  };
}

function inferWorkType(name, supplied = '') {
  const normalized = supplied.trim().toLowerCase();
  if (['stage','studio'].includes(normalized)) return 'stage';
  if (['location','on location','loc'].includes(normalized)) return 'location';
  if (['tbd','unknown'].includes(normalized)) return 'tbd';
  return /\b(stage|soundstage|studio|backlot)\b/i.test(name) ? 'stage' : 'location';
}

function sceneTextFor(set, unitId) {
  return (set.scenes || []).filter(scene => (scene.unit_id || '') === (unitId || '')).map(scene => scene.scene_number).join(', ');
}

function parseSceneNumbers(value) {
  return value.split(/[,\s]+/).map(item => item.trim()).filter(Boolean);
}

function UnitPicker({ units, selected, onChange }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);
  }
  if (!units.length) return <div className="single-production-note">This production has no episode structure. The set is available production-wide.</div>;
  return <div className="unit-picker">{units.map(unit => <label key={unit.id} className={selected.includes(unit.id)?'selected':''}><input type="checkbox" checked={selected.includes(unit.id)} onChange={()=>toggle(unit.id)}/><span><b>{unit.code || unit.name}</b><small>{unit.name}</small></span></label>)}</div>;
}

function SetEditor({ show, units, sets, initial, onClose, onSaved, onDeleted }) {
  const [record, setRecord] = useState(initial);
  const [sceneText, setSceneText] = useState(() => {
    const entries = (initial.unitIds.length ? initial.unitIds : ['']).map(id => [id, sceneTextFor(initial,id)]);
    return Object.fromEntries(entries);
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const update = (field,value) => setRecord(current => ({...current,[field]:value}));

  useEffect(() => {
    setSceneText(current => {
      const next = {...current};
      (record.unitIds.length ? record.unitIds : ['']).forEach(id => { if (!(id in next)) next[id] = sceneTextFor(record,id); });
      return next;
    });
  }, [record.unitIds]);

  async function save() {
    if (!record.name.trim()) return setMessage('Enter the set name.');
    setBusy(true); setMessage('');
    try {
      const sceneUnits = record.unitIds.length ? record.unitIds : [''];
      const scenes = sceneUnits.flatMap(unitId => parseSceneNumbers(sceneText[unitId] || '').map((sceneNumber,index) => ({
        unit_id: unitId || null, scene_number: sceneNumber, sort_order: index
      })));
      const id = await saveProductionSet(show.id, {...record, scenes});
      onSaved(id);
    } catch (error) { setMessage(error?.message || String(error)); setBusy(false); }
  }

  async function remove() {
    if (!record.id) return;
    if (!window.confirm(`Delete “${record.name}” from the Set List? Linked scouting references will be removed, but the location itself will remain.`)) return;
    setBusy(true); setMessage('');
    try { await deleteProductionSet(show.id, record.id); onDeleted(record.id); }
    catch (error) { setMessage(error?.message || String(error)); setBusy(false); }
  }

  const activeSceneUnits = record.unitIds.length ? units.filter(unit => record.unitIds.includes(unit.id)) : [{id:'',name:'Production-wide',code:''}];
  return <div className="modal-backdrop set-editor-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}>
    <section className="set-editor-modal" role="dialog" aria-modal="true" aria-label={record.id?'Edit set':'Add set'}>
      <header className="set-editor-header"><div><p className="eyebrow">SET LIST · {show.name}</p><h2>{record.id?'Edit set':'Add set'}</h2><p>Changes update the canonical set record used by Location List and the rest of Taylor Scout.</p></div><button className="icon-button" onClick={onClose} disabled={busy}><X size={19}/></button></header>
      <div className="set-editor-body">
        <section className="editor-section">
          <h3>Set identity</h3>
          <div className="field-grid set-identity-grid">
            <label>Set #<input value={record.set_number||''} onChange={e=>update('set_number',e.target.value)} placeholder="Optional"/></label>
            <label className="set-name-field">Set name<input autoFocus value={record.name} onChange={e=>update('name',e.target.value)} placeholder="Exterior house"/></label>
            <label>INT / EXT<select value={record.int_ext} onChange={e=>update('int_ext',e.target.value)}><option>INT</option><option>EXT</option><option>I/E</option><option>OTHER</option></select></label>
            <label>Day / night<select value={record.day_night} onChange={e=>update('day_night',e.target.value)}><option>DAY</option><option>NIGHT</option><option>D/N</option><option>OTHER</option></select></label>
            <label>Work type<select value={record.work_type} onChange={e=>update('work_type',e.target.value)}><option value="location">On Location</option><option value="stage">Stage</option><option value="tbd">TBD</option></select></label>
            <label>Pages<input type="number" min="0" step="0.125" value={record.page_count??''} onChange={e=>update('page_count',e.target.value)}/></label>
            <label className="span-two">Parent set<select value={record.parent_set_id||''} onChange={e=>update('parent_set_id',e.target.value||null)}><option value="">No parent set</option>{sets.filter(set=>set.id!==record.id).map(set=><option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
          </div>
        </section>
        <section className="editor-section">
          <div className="editor-section-title"><div><h3>Episodes / spots</h3><p>Select every entry this set appears in. Cross-episode sets remain one canonical set.</p></div><b>{record.unitIds.length || 'All'}</b></div>
          <UnitPicker units={units} selected={record.unitIds} onChange={value=>update('unitIds',value)}/>
        </section>
        <section className="editor-section">
          <div className="editor-section-title"><div><h3>Scenes</h3><p>Scenes stay searchable here and do not clutter the scouting list.</p></div></div>
          <div className="scene-entry-list">{activeSceneUnits.map(unit=><label key={unit.id||'all'}><span><b>{unit.code || 'All'}</b><small>{unit.name}</small></span><input value={sceneText[unit.id]||''} onChange={e=>setSceneText(current=>({...current,[unit.id]:e.target.value}))} placeholder="1, 2, 14A"/></label>)}</div>
        </section>
        <section className="editor-section notes-section"><div className="field-grid two"><label>Requirements<textarea rows="3" value={record.requirements||''} onChange={e=>update('requirements',e.target.value)} placeholder="Practical needs, geography, access…"/></label><label>Set notes<textarea rows="3" value={record.notes||''} onChange={e=>update('notes',e.target.value)} placeholder="Script or scouting notes…"/></label></div></section>
        {message && <div className="wizard-message">{message}</div>}
      </div>
      <footer className="set-editor-footer"><div>{record.id&&<button className="danger-button" onClick={remove} disabled={busy}><Trash2 size={16}/> Delete set</button>}</div><div><button className="secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="primary" onClick={save} disabled={busy}>{busy?'Saving…':'Save set'}</button></div></footer>
    </section>
  </div>;
}

function BulkPasteModal({ show, units, startOrder, onClose, onComplete }) {
  const [value,setValue]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  async function importRows() {
    const lines=value.split(/\n+/).map(line=>line.trim()).filter(Boolean);
    if(!lines.length)return setMessage('Paste at least one row.');
    setBusy(true);setMessage('');
    try{
      let saved=0;
      for(const [index,line] of lines.entries()){
        const columns=line.split(/\t|\|/).map(item=>item.trim());
        const [unitText='',setNumber='',intExt='INT',name='',workType='',sceneText='']=columns;
        if(!name)continue;
        const unitTokens=unitText.split(/[,+/&]+/).map(item=>item.trim().toLowerCase()).filter(Boolean);
        const selectedUnits=units.filter(unit=>unitTokens.some(token=>token===String(unit.code||'').toLowerCase()||token===unit.name.toLowerCase()));
        const scenes=[];
        const sceneGroups=sceneText.split(';').map(item=>item.trim()).filter(Boolean);
        for(const group of sceneGroups){
          const separator=group.indexOf(':');
          if(separator>0){
            const unitToken=group.slice(0,separator).trim().toLowerCase();
            const unit=units.find(entry=>String(entry.code||'').toLowerCase()===unitToken||entry.name.toLowerCase()===unitToken);
            parseSceneNumbers(group.slice(separator+1)).forEach((sceneNumber,sceneIndex)=>scenes.push({unit_id:unit?.id||selectedUnits[0]?.id||null,scene_number:sceneNumber,sort_order:sceneIndex}));
          }else{
            parseSceneNumbers(group).forEach((sceneNumber,sceneIndex)=>scenes.push({unit_id:selectedUnits[0]?.id||null,scene_number:sceneNumber,sort_order:sceneIndex}));
          }
        }
        await saveProductionSet(show.id,{...emptySet(startOrder+index),set_number:setNumber,int_ext:['INT','EXT','I/E','OTHER'].includes(intExt.toUpperCase())?intExt.toUpperCase():'INT',name,work_type:inferWorkType(name,workType),unitIds:selectedUnits.map(unit=>unit.id),scenes});
        saved+=1;
      }
      if(!saved)throw new Error('No valid rows were found. Include a set name in the fourth column.');
      onComplete(saved);
    }catch(error){setMessage(error?.message||String(error));setBusy(false);}
  }
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}><section className="bulk-paste-modal"><header className="set-editor-header"><div><p className="eyebrow">FAST ENTRY</p><h2>Bulk paste sets</h2><p>Paste rows from a spreadsheet. Taylor Scout creates canonical sets and links matching episodes automatically.</p></div><button className="icon-button" onClick={onClose}><X size={19}/></button></header><div className="bulk-paste-body"><div className="paste-format"><b>Columns</b><span>Episode(s)</span><span>Set #</span><span>INT/EXT</span><span>Set name</span><span>Location/Stage</span><span>Scenes</span></div><textarea autoFocus rows="13" value={value} onChange={e=>setValue(e.target.value)} placeholder={'303\t12\tEXT\tHERO HOUSE\tLocation\t1, 4, 18A\n303+304\t13\tINT\tHERO HOUSE - KITCHEN\tLocation\t303:2,5;304:22'}/><p>Use tabs (best) or | between columns. For cross-episode scenes, use <b>303:1,2;304:18</b>.</p>{message&&<div className="wizard-message">{message}</div>}</div><footer className="set-editor-footer"><span></span><div><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={importRows} disabled={busy}><ClipboardPaste size={16}/>{busy?'Importing…':'Import rows'}</button></div></footer></section></div>;
}

export default function SetListWorkspace({ show, onBack }) {
  const [core,setCore]=useState({settings:null,units:[],sets:[]});
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');
  const [syncState,setSyncState]=useState('Saved');
  const [query,setQuery]=useState('');
  const [unitFilter,setUnitFilter]=useState('all');
  const [workFilter,setWorkFilter]=useState('all');
  const [editor,setEditor]=useState(null);
  const [bulkOpen,setBulkOpen]=useState(false);
  const [dragId,setDragId]=useState(null);
  const [access,setAccess]=useState(show.role==='owner'?'admin':'view');
  const reloadTimer=useRef(null);

  const load=useCallback(async(quiet=false)=>{
    if(!quiet)setLoading(true);
    try{
      const [nextCore,nextAccess]=await Promise.all([
        fetchProductionCore(show.id),
        show.role==='owner'?Promise.resolve('admin'):fetchMyToolAccess(show.id,'set_list')
      ]);
      setCore(nextCore);setAccess(nextAccess);setMessage('');setSyncState('Saved');
    }
    catch(error){setMessage(error?.message||String(error));setSyncState('Save error');}
    finally{setLoading(false);}
  },[show.id]);
  const editorOpen=Boolean(editor);
  useEffect(()=>{load();const unsubscribe=subscribeProductionCore(show.id,()=>{clearTimeout(reloadTimer.current);reloadTimer.current=setTimeout(()=>{if(!editorOpen)load(true);},350);});return()=>{clearTimeout(reloadTimer.current);unsubscribe();};},[show.id,editorOpen,load]);

  const unitMap=useMemo(()=>new Map(core.units.map(unit=>[unit.id,unit])),[core.units]);
  const setMap=useMemo(()=>new Map(core.sets.map(set=>[set.id,set])),[core.sets]);
  const filtered=useMemo(()=>core.sets.filter(set=>{
    const haystack=[set.set_number,set.name,set.requirements,set.notes,...(set.scenes||[]).map(scene=>scene.scene_number),...(set.unitIds||[]).map(id=>unitMap.get(id)?.name)].join(' ').toLowerCase();
    return (!query.trim()||haystack.includes(query.toLowerCase()))&&(unitFilter==='all'||set.unitIds.includes(unitFilter))&&(workFilter==='all'||set.work_type===workFilter);
  }),[core.sets,query,unitFilter,workFilter,unitMap]);
  const counts=useMemo(()=>({location:core.sets.filter(set=>set.work_type==='location').length,stage:core.sets.filter(set=>set.work_type==='stage').length,tbd:core.sets.filter(set=>set.work_type==='tbd').length}),[core.sets]);
  const canEdit=access==='edit'||access==='admin';

  async function dropOn(targetId){
    if(!dragId||dragId===targetId)return setDragId(null);
    const ordered=[...core.sets];
    const from=ordered.findIndex(set=>set.id===dragId);const to=ordered.findIndex(set=>set.id===targetId);
    if(from<0||to<0)return setDragId(null);
    const [moved]=ordered.splice(from,1);ordered.splice(to,0,moved);
    setCore(current=>({...current,sets:ordered.map((set,index)=>({...set,sort_order:index}))}));setDragId(null);setSyncState('Saving…');
    try{await reorderProductionSets(show.id,ordered.map(set=>set.id));setSyncState('Saved');}
    catch(error){setMessage(error?.message||String(error));setSyncState('Save error');load(true);}
  }

  function themeStyle(){
    const theme=core.settings?.theme||show.theme||{};
    return {'--show-primary':theme.primary||'#061f33','--show-secondary':theme.secondary||'#0b2e46','--show-accent':theme.accent||'#2fb5b2','--show-font':theme.font||'Inter'};
  }

  return <main className="set-list-workspace" style={themeStyle()}>
    <aside className="set-list-sidebar">
      <button className="set-list-back" onClick={onBack}><ArrowLeft size={17}/> Production home</button>
      <div className="set-list-show-lockup">{show.logo?<img src={show.logo} alt=""/>:<div>{(show.signCode||show.name).slice(0,2).toUpperCase()}</div>}<p>{show.name}</p><small>{show.season||show.productionType||'Production'}</small></div>
      <nav><p>EPISODES / UNITS</p><button className={unitFilter==='all'?'active':''} onClick={()=>setUnitFilter('all')}><span>All sets</span><b>{core.sets.length}</b></button>{core.units.map(unit=><button key={unit.id} className={unitFilter===unit.id?'active':''} onClick={()=>setUnitFilter(unit.id)}><span>{unit.code||unit.name}</span><b>{core.sets.filter(set=>set.unitIds.includes(unit.id)).length}</b></button>)}</nav>
      <div className="set-list-source-note"><Layers3 size={17}/><p><b>Core control</b><span>Rename a set here and every linked Location List record keeps the same canonical set.</span></p></div>
    </aside>
    <section className="set-list-main">
      <header className="set-list-header"><div><p className="eyebrow">SCRIPT → SCOUTING</p><h1>Set List Breakdown</h1><p>Every scripted set, organized before scouting begins. No scouting status belongs here.</p></div><div className={`set-list-save-state ${syncState==='Save error'?'error':''}`}>{syncState==='Saved'?<Check size={15}/>:<RefreshCw size={15}/>} {syncState}</div></header>
      <div className="set-list-toolbar"><label className="set-list-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search set, scene, episode, requirement…"/></label><select value={workFilter} onChange={e=>setWorkFilter(e.target.value)}><option value="all">All work types</option><option value="location">On Location</option><option value="stage">Stage</option><option value="tbd">TBD</option></select>{canEdit?<><button className="secondary" onClick={()=>setBulkOpen(true)}><ClipboardPaste size={16}/> Bulk paste</button><button className="primary" onClick={()=>setEditor(emptySet(core.sets.length))}><Plus size={16}/> Add set</button></>:<span className="read-only-badge"><LockKeyhole size={15}/> View only</span>}</div>
      <div className="set-list-summary"><button className={workFilter==='location'?'active':''} onClick={()=>setWorkFilter(workFilter==='location'?'all':'location')}><MapPin size={18}/><span><b>{counts.location}</b> On Location</span><small>Available to Location List</small></button><button className={workFilter==='stage'?'active':''} onClick={()=>setWorkFilter(workFilter==='stage'?'all':'stage')}><Warehouse size={18}/><span><b>{counts.stage}</b> Stage</span><small>Separated automatically</small></button><button className={workFilter==='tbd'?'active':''} onClick={()=>setWorkFilter(workFilter==='tbd'?'all':'tbd')}><Layers3 size={18}/><span><b>{counts.tbd}</b> TBD</span><small>Needs classification</small></button></div>
      {message&&<div className="set-list-error">{message}<button onClick={()=>setMessage('')}><X size={15}/></button></div>}
      <section className="set-list-table-shell">
        <div className="set-list-table-head"><span></span><span>Set</span><span>Episodes / units</span><span>Scenes</span><span>Work</span><span>Pages</span></div>
        {loading?<div className="set-list-empty">Loading the connected Set List…</div>:!filtered.length?<div className="set-list-empty"><Layers3 size={28}/><h3>{core.sets.length?'No matching sets':'Start with the script’s set list'}</h3><p>{core.sets.length?'Clear the search or filters.':canEdit?'Add one line at a time or bulk paste directly from a spreadsheet.':'The production owner can grant Set List edit access from Team & Permissions.'}</p>{!core.sets.length&&canEdit&&<button className="primary" onClick={()=>setEditor(emptySet(0))}><Plus size={16}/> Add first set</button>}</div>:<div className="set-list-rows">{filtered.map(set=>{
          const parent=setMap.get(set.parent_set_id);const unitLabels=set.unitIds.map(id=>unitMap.get(id)).filter(Boolean);const sceneNumbers=(set.scenes||[]).map(scene=>scene.scene_number);
          return <button key={set.id} className={`set-list-row ${dragId===set.id?'dragging':''} ${set.parent_set_id?'child-set':''} ${canEdit?'':'view-only'}`} draggable={canEdit} onDragStart={event=>{if(!canEdit)return;setDragId(set.id);event.dataTransfer.effectAllowed='move';}} onDragOver={event=>{if(canEdit)event.preventDefault();}} onDrop={()=>canEdit&&dropOn(set.id)} onDragEnd={()=>setDragId(null)} onClick={()=>canEdit&&setEditor(set)}>
            <span className="drag-handle" onClick={event=>event.stopPropagation()}><GripVertical size={18}/></span>
            <span className="set-cell">{parent&&<small>{parent.name} ›</small>}<b>{set.set_number&&<em>{set.set_number}</em>}{set.int_ext}. {set.name}</b>{set.requirements&&<small>{set.requirements}</small>}</span>
            <span className="unit-cell">{unitLabels.length?unitLabels.map(unit=><i key={unit.id}>{unit.code||unit.name}</i>):<i>Production-wide</i>}</span>
            <span className="scene-cell">{sceneNumbers.length?sceneNumbers.slice(0,6).join(', '):'—'}{sceneNumbers.length>6&&<small> +{sceneNumbers.length-6}</small>}</span>
            <span className={`work-pill ${set.work_type}`}>{set.work_type==='location'?'On Location':set.work_type==='stage'?'Stage':'TBD'}</span>
            <span className="pages-cell">{set.page_count??'—'}</span>
          </button>;
        })}</div>}
      </section>
      <footer className="set-list-footer"><span>{filtered.length} of {core.sets.length} sets</span><p>Location List only offers canonical <b>On Location</b> sets for the selected episode or spot.</p></footer>
    </section>
    {editor&&<SetEditor show={show} units={core.units} sets={core.sets} initial={editor} onClose={()=>setEditor(null)} onSaved={async()=>{setEditor(null);setSyncState('Saving…');await load(true);}} onDeleted={async()=>{setEditor(null);await load(true);}}/>}
    {bulkOpen&&<BulkPasteModal show={show} units={core.units} startOrder={core.sets.length} onClose={()=>setBulkOpen(false)} onComplete={async count=>{setBulkOpen(false);setMessage(`${count} set${count===1?'':'s'} added from bulk paste.`);await load(true);}}/>}
  </main>;
}
