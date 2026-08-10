import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, FileUp, Palette, Plus, Users, X } from 'lucide-react';
import { createProduction } from './supabase';

const TYPES = [
  ['episodic', 'Episodic', 'Episodes can share sets across the season.'],
  ['feature', 'Feature', 'One connected set list without episode requirements.'],
  ['commercial', 'Commercial', 'One-day jobs or multiple spots and units.'],
  ['short_film', 'Short film', 'A compact feature-style workflow.'],
  ['music_video', 'Music video', 'Performance, narrative, and company-move sets.'],
  ['branded', 'Branded / custom', 'Flexible structure for any production.']
];

const FONTS = ['Inter', 'Arial', 'Avenir Next', 'Georgia', 'Trebuchet MS'];

function splitLines(value) {
  return value.split(/[\n,]+/).map(item => item.trim()).filter(Boolean);
}

function buildUnits(form) {
  const values = splitLines(form.structure);
  if (form.productionType === 'episodic') {
    return values.map(code => ({ id: crypto.randomUUID(), kind: 'episode', code, name: `Episode ${code}` }));
  }
  if (form.productionType === 'commercial') {
    return values.map((name, index) => ({ id: crypto.randomUUID(), kind: 'spot', code: String(index + 1), name }));
  }
  return values.map((name, index) => ({ id: crypto.randomUUID(), kind: 'unit', code: String(index + 1), name }));
}

export default function CreateProductionWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', productionType: 'episodic', season: '', company: '', signCode: '',
    structure: '101', logo: '', primary: '#061f33', secondary: '#0b2e46', accent: '#2fb5b2',
    font: 'Inter', inviteEmails: '', startMode: 'blank'
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const units = useMemo(() => buildUnits(form), [form.productionType, form.structure]);
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));

  function structureCopy() {
    if (form.productionType === 'episodic') return ['Episode codes', 'Enter one per line or separate with commas. Sets can later span multiple episodes.', '303, 304, 305'];
    if (form.productionType === 'commercial') return ['Spots / deliverables', 'Optional. Leave blank for a single-job commercial.', 'Hero :30, Social :15'];
    return ['Units or parts', 'Optional. Use this only when the production needs separate units or parts.', 'Main unit, Splinter unit'];
  }

  function validate(nextStep) {
    setMessage('');
    if (step === 0 && !form.name.trim()) { setMessage('Enter the production name.'); return; }
    if (step === 1 && form.productionType === 'episodic' && units.length === 0) { setMessage('Add at least one episode.'); return; }
    setStep(nextStep);
  }

  async function readLogo(file) {
    if (!file) return;
    if (file.size > 1_500_000) return setMessage('Use a logo smaller than 1.5 MB.');
    const reader = new FileReader();
    reader.onload = () => update('logo', String(reader.result || ''));
    reader.onerror = () => setMessage('That logo could not be read.');
    reader.readAsDataURL(file);
  }

  async function create() {
    setBusy(true); setMessage('');
    try {
      const invites = splitLines(form.inviteEmails).map(email => ({ email, role: 'viewer' }));
      const result = await createProduction({
        name: form.name,
        productionType: form.productionType,
        season: form.season,
        company: form.company,
        signCode: form.signCode,
        logo: form.logo,
        units,
        theme: { primary: form.primary, secondary: form.secondary, accent: form.accent, font: form.font },
        preferences: { start_mode: form.startMode },
        invites
      });
      onCreated(result.showId, result.warnings || []);
    } catch (error) {
      setMessage(error?.message || String(error));
      setBusy(false);
    }
  }

  const structure = structureCopy();
  return <div className="modal-backdrop create-production-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="create-production-modal" role="dialog" aria-modal="true" aria-label="Create production">
      <header className="create-production-header">
        <div><p className="eyebrow">TAYLOR SCOUT SETUP</p><h2>Create Production</h2><p>One setup controls the Set List, scouting, calendars, budgets, Bibles, maps, and Wrap Book.</p></div>
        <button className="icon-button" onClick={onClose} disabled={busy} aria-label="Close"><X size={19}/></button>
      </header>
      <div className="wizard-progress" aria-label={`Step ${step + 1} of 4`}>
        {['Identity','Structure','Look & team','Review'].map((label,index) => <div key={label} className={index <= step ? 'active' : ''}><span>{index < step ? <Check size={14}/> : index + 1}</span><b>{label}</b></div>)}
      </div>

      <div className="wizard-body">
        {step === 0 && <div className="wizard-panel">
          <div className="field-grid two">
            <label className="span-two">Production name<input autoFocus value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Production title"/></label>
            <label>Season / project label<input value={form.season} onChange={e=>update('season',e.target.value)} placeholder="Season 1 or Summer Campaign"/></label>
            <label>Production company<input value={form.company} onChange={e=>update('company',e.target.value)} placeholder="Company or studio"/></label>
            <label className="span-two">Yellow sign code<input value={form.signCode} onChange={e=>update('signCode',e.target.value)} placeholder="Example: ED"/></label>
          </div>
          <div className="production-type-grid">{TYPES.map(([value,label,copy]) => <button type="button" key={value} className={form.productionType===value?'selected':''} onClick={()=>update('productionType',value)}><b>{label}</b><span>{copy}</span></button>)}</div>
        </div>}

        {step === 1 && <div className="wizard-panel structure-panel">
          <div className="field-help"><div><p className="eyebrow">PRODUCTION STRUCTURE</p><h3>{structure[0]}</h3><p>{structure[1]}</p></div><span className="unit-count">{units.length} {units.length===1?'entry':'entries'}</span></div>
          <label>{structure[0]}<textarea autoFocus rows="9" value={form.structure} onChange={e=>update('structure',e.target.value)} placeholder={structure[2]}/></label>
          <div className="unit-preview">{units.length ? units.map(unit => <span key={unit.id}>{unit.name}</span>) : <p>No separate structure is required. Sets will still work normally.</p>}</div>
        </div>}

        {step === 2 && <div className="wizard-panel look-team-grid">
          <section className="setup-card">
            <div className="setup-card-title"><Palette size={19}/><div><h3>Production look</h3><p>The Taylor Scout shell stays consistent; these tokens identify this show.</p></div></div>
            <label className="logo-upload"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>readLogo(e.target.files?.[0])}/><FileUp size={18}/><span>{form.logo?'Replace show logo':'Upload show logo'}</span></label>
            {form.logo && <div className="logo-preview"><img src={form.logo} alt="Show logo preview"/><button type="button" onClick={()=>update('logo','')}>Remove</button></div>}
            <div className="color-grid">
              <label>Header<input type="color" value={form.primary} onChange={e=>update('primary',e.target.value)}/></label>
              <label>Secondary<input type="color" value={form.secondary} onChange={e=>update('secondary',e.target.value)}/></label>
              <label>Accent<input type="color" value={form.accent} onChange={e=>update('accent',e.target.value)}/></label>
            </div>
            <label>Show font<select value={form.font} onChange={e=>update('font',e.target.value)}>{FONTS.map(font=><option key={font}>{font}</option>)}</select></label>
          </section>
          <section className="setup-card">
            <div className="setup-card-title"><Users size={19}/><div><h3>Initial team</h3><p>Invite the first teammates now. Permissions can be tightened per tool after setup.</p></div></div>
            <label>Email addresses<textarea rows="6" value={form.inviteEmails} onChange={e=>update('inviteEmails',e.target.value)} placeholder="key@example.com\nscout@example.com"/></label>
            <p className="field-note">New invitations start read-only. The production owner assigns Set List, Location List, Budget, Bible, and other edit access separately.</p>
            <div className="start-mode"><b>Starting point</b><label><input type="radio" checked={form.startMode==='blank'} onChange={()=>update('startMode','blank')}/> Blank production</label><label className="disabled-choice"><input type="radio" disabled/> Import / clone enters review before writing live data</label></div>
          </section>
        </div>}

        {step === 3 && <div className="wizard-panel review-production">
          <section className="production-preview" style={{'--preview-primary':form.primary,'--preview-accent':form.accent,fontFamily:form.font}}>
            <div className="production-preview-bar">{form.logo?<img src={form.logo} alt=""/>:<span>{form.signCode || form.name.slice(0,2).toUpperCase()}</span>}<b>{form.name || 'Untitled Production'}</b></div>
            <div><p>{TYPES.find(type=>type[0]===form.productionType)?.[1]}</p><h3>{form.season || 'Production workspace'}</h3><small>{form.company || 'No company entered'}</small></div>
          </section>
          <section className="review-list">
            <div><span>Structure</span><b>{units.length ? `${units.length} ${form.productionType==='episodic'?'episodes':'units / spots'}` : 'Single production'}</b></div>
            <div><span>Set List</span><b>Ready for manual entry, bulk paste, hierarchy, scenes, and cross-episode sets</b></div>
            <div><span>Team</span><b>{splitLines(form.inviteEmails).length ? `${splitLines(form.inviteEmails).length} invitation(s)` : 'Owner only for now'}</b></div>
            <div><span>Data flow</span><b>Set List becomes the source for Location List and downstream tools</b></div>
          </section>
        </div>}
        {message && <div className="wizard-message">{message}</div>}
      </div>

      <footer className="wizard-footer">
        <span>Step {step + 1} of 4 · saves atomically</span>
        <div>{step > 0 && <button className="secondary" onClick={()=>validate(step-1)} disabled={busy}><ChevronLeft size={16}/> Back</button>}{step < 3 ? <button className="primary" onClick={()=>validate(step+1)}>Continue <ChevronRight size={16}/></button> : <button className="primary create-production-button" onClick={create} disabled={busy}><Plus size={16}/>{busy?'Creating…':'Create Production'}</button>}</div>
      </footer>
    </section>
  </div>;
}
