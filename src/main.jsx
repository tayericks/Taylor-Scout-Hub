import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowLeft, BookOpen, CalendarDays, Check, ChevronRight, Clock3,
  DollarSign, FileText, Filter, ListChecks, LockKeyhole, LogOut, Map, MapPin,
  Route, Search, ShieldCheck, SlidersHorizontal, Users, WalletCards, X, Plus, Send
} from 'lucide-react';
import { configured, fetchShows, submitShowRequest, supabase } from './supabase';
import './styles.css';

function TaylorScoutLogo({compact=false}) { return <span className={`ts-logo ${compact?'compact':''}`} aria-label="Taylor Scout"><svg viewBox="0 0 74 92" role="img" aria-hidden="true"><path className="pin-outline" d="M37 3C18 3 5 17 5 36c0 22 17 40 32 53 15-13 32-31 32-53C69 17 56 3 37 3Z"/><path className="mountain" d="M16 39l15-13 8 7 10-10 12 14-12-8-10 10-8-7-15 7Z"/><path className="road" d="M19 69c12-14 24-18 31-27-3 14-12 22-20 31l7 8-9 2-9-14Z"/><path className="star" d="M21 17l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"/></svg><span className="ts-wordmark"><b>TAYLOR SCOUT</b><small>PRODUCTION TOOLS</small></span></span> }

const APPS = [
  {
    key: 'calendar', title: 'Prep / Wrap Calendar', icon: CalendarDays,
    description: 'Schedule episodes, units, sets, keys, prep, hold, shoot, and strike dates.',
    env: 'VITE_CALENDAR_URL', fallback: 'https://calendar.taylorscout.com', status: 'Open tool'
  },
  {
    key: 'scout', title: 'Scout Route', icon: Route,
    description: 'Build, optimize, print, and share scout itineraries.',
    env: 'VITE_SCOUT_ROUTE_URL', fallback: 'https://app.taylorscout.com', status: 'Open tool'
  },
  {
    key: 'locations', title: 'Location List', icon: ListChecks,
    description: 'Track candidate locations and maintain the final connected locations list.',
    env: 'VITE_LOCATION_LIST_URL', fallback: 'https://locations.taylorscout.com', status: 'Open tool'
  },
  {
    key: 'budget', title: 'Budget', icon: WalletCards,
    description: 'Create episode and set budgets, estimates, POs, commitments, and actuals.',
    env: 'VITE_BUDGET_URL', fallback: 'https://budget.taylorscout.com', status: 'Open tool'
  },
  {
    key: 'bible', title: 'Location Bible', icon: BookOpen,
    description: 'Run vendor orders, contacts, permits, schedules, and closer logistics.',
    env: 'VITE_BIBLE_URL', fallback: 'https://bible.taylorscout.com', status: 'Open tool'
  },
  {
    key: 'waypoint', title: 'Waypoint', icon: Map,
    description: 'Create professional logistics maps and set schematics.',
    env: 'VITE_WAYPOINT_URL', fallback: '', status: 'Coming soon'
  }
];

const ROLE_TEMPLATES = {
  owner: { label: 'Owner', description: 'Full show, tool, team, and financial access.' },
  manager: { label: 'Location Manager', description: 'Full operations access without ownership transfer.' },
  key: { label: 'Key Assistant', description: 'Assigned locations, calendars, Bibles, and maps.' },
  scout: { label: 'Scout', description: 'Scout Route and candidate-location tracker access.' },
  accounting: { label: 'Accounting', description: 'Budget and actuals access only.' },
  viewer: { label: 'Viewer', description: 'Read-only access to approved material.' }
};

const DEFAULT_PERMISSION_ROWS = [
  { id: 'owner', name: 'Show Owner', email: 'Owner account', role: 'owner', scope: 'All locations', calendar: 'Edit', scout: 'Edit', locations: 'Edit', budget: 'Full', bible: 'Edit', waypoint: 'Edit', invite: true },
  { id: 'key', name: 'Key Assistant', email: 'Template', role: 'key', scope: 'Assigned only', calendar: 'Edit', scout: 'View', locations: 'Assigned', budget: 'Totals only', bible: 'Edit', waypoint: 'Edit', invite: false },
  { id: 'scout', name: 'Scout', email: 'Template', role: 'scout', scope: 'Assigned episodes', calendar: 'View', scout: 'Edit', locations: 'Scout tracker', budget: 'None', bible: 'None', waypoint: 'View', invite: false }
];

function envUrl(name, fallback) {
  const map = {
    VITE_CALENDAR_URL: import.meta.env.VITE_CALENDAR_URL,
    VITE_SCOUT_ROUTE_URL: import.meta.env.VITE_SCOUT_ROUTE_URL,
    VITE_LOCATION_LIST_URL: import.meta.env.VITE_LOCATION_LIST_URL,
    VITE_BUDGET_URL: import.meta.env.VITE_BUDGET_URL,
    VITE_WAYPOINT_URL: import.meta.env.VITE_WAYPOINT_URL,
    VITE_BIBLE_URL: import.meta.env.VITE_BIBLE_URL,
  };
  return (map[name] || fallback || '').trim();
}

function Login({ onReady }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMessage(error.message); else onReady();
  }
  async function reset() {
    if (!email.trim()) return setMessage('Enter your email first.');
    setBusy(true); setMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    setMessage(error ? error.message : 'Password email sent.');
  }
  return <main className="login-shell">
    <section className="login-card">
      <div className="brand-lockup"><TaylorScoutLogo/></div>
      <h1>Sign in</h1><p>Open your productions and connected tools.</p>
      <form onSubmit={signIn}>
        <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
        <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <button className="text-button" onClick={reset} disabled={busy}>First time here or forgot your password?</button>
      {message && <div className="message">{message}</div>}
    </section>
  </main>;
}

function Header({ show, onHome, onSignOut }) {
  return <header className="topbar">
    <button className="brand-button" onClick={onHome}><TaylorScoutLogo/></button>
    <div className="crumb">{show ? show.name : 'Your Shows'}</div>
    <button className="icon-button" onClick={onSignOut} title="Sign out"><LogOut size={18}/></button>
  </header>;
}

function RequestShowModal({ onClose }) {
  const [form, setForm] = useState({ showName:'', season:'', company:'', accessType:'Production workspace', notes:'' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));
  async function submit(e) {
    e.preventDefault();
    if (!form.showName.trim()) return setMessage('Enter the show name.');
    setBusy(true); setMessage('');
    try {
      await submitShowRequest(form);
      setComplete(true);
    } catch (error) {
      const text = String(error?.message || error);
      setMessage(text.includes('show_requests') ? 'The request table has not been installed yet. Run the included Supabase migration, then submit again.' : text);
    } finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
    <section className="request-modal" role="dialog" aria-modal="true" aria-label="Request a new show">
      <header className="modal-header"><div><p className="eyebrow">NEW PRODUCTION</p><h2>Request a new show</h2><p>New productions require approval before a workspace is created. This keeps access controlled and supports future paid plans.</p></div><button className="icon-button" onClick={onClose}><X size={18}/></button></header>
      {complete ? <div className="request-complete"><Check size={30}/><h3>Request submitted</h3><p>Your request is pending approval. The show will appear under Your Shows after it is approved and activated.</p><button className="primary" onClick={onClose}>Done</button></div> : <form className="request-form" onSubmit={submit}>
        <label>Show name<input autoFocus value={form.showName} onChange={e=>update('showName',e.target.value)} placeholder="Example: El Dorado" required/></label>
        <div className="request-grid"><label>Season<input value={form.season} onChange={e=>update('season',e.target.value)} placeholder="Season 3"/></label><label>Production company<input value={form.company} onChange={e=>update('company',e.target.value)} placeholder="Studio or production company"/></label></div>
        <label>Access requested<select value={form.accessType} onChange={e=>update('accessType',e.target.value)}><option>Production workspace</option><option>Trial / evaluation</option><option>Additional show under current account</option></select></label>
        <label>Notes<textarea value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Expected start date, team size, or anything needed for approval." rows="4"/></label>
        {message && <div className="message">{message}</div>}
        <footer className="request-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}><Send size={16}/>{busy?'Submitting…':'Submit request'}</button></footer>
      </form>}
    </section>
  </div>;
}

function Shows({ shows, loading, onOpen }) {
  const [query, setQuery] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const filtered = shows.filter(show => `${show.name} ${show.season || ''} ${show.company || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="page">
    <div className="page-heading"><div><p className="eyebrow">PRODUCTIONS</p><h1>Your Shows</h1><p>Select a show to open its connected production workspace.</p></div>
      <div className="shows-heading-actions"><label className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search shows"/></label><button className="primary request-show-button" onClick={()=>setRequestOpen(true)}><Plus size={16}/> Request New Show</button></div>
    </div>
    {loading ? <div className="empty">Loading shows…</div> : shows.length === 0 ? <div className="empty"><h2>No shows available</h2><p>Request access to create your first production workspace.</p><button className="primary" onClick={()=>setRequestOpen(true)}>Request New Show</button></div> :
      <div className="show-list">{filtered.map(show => {
        const episodes = Array.isArray(show.episodes) ? show.episodes.length : 0;
        const itineraries = Array.isArray(show.itineraries) ? show.itineraries.length : 0;
        const locations = Array.isArray(show.locationLibrary) ? show.locationLibrary.length : 0;
        return <button key={show.id} className="show-card" onClick={()=>onOpen(show)}>
          <div className="show-art">{show.logo ? <img src={show.logo} alt=""/> : <MapPin size={28}/>}</div>
          <div className="show-main"><p className="eyebrow">{show.season || 'PRODUCTION'}</p><h2>{show.name}</h2><p>{show.company || show.productionOffice?.address || 'Production workspace'}</p></div>
          <div className="stats"><span><b>{episodes}</b> Episodes</span><span><b>{itineraries}</b> Itineraries</span><span><b>{locations}</b> Locations</span></div>
          <div className="role"><ShieldCheck size={16}/>{String(show.role || 'member').replace(/^./, c=>c.toUpperCase())}</div>
          <ChevronRight className="chev"/>
        </button>;
      })}</div>}
    {requestOpen && <RequestShowModal onClose={()=>setRequestOpen(false)}/>}
  </main>;
}

function PermissionsModal({ show, onClose }) {
  const storageKey = `taylor-scout-permissions-${show.id}`;
  const [rows, setRows] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || DEFAULT_PERMISSION_ROWS; }
    catch { return DEFAULT_PERMISSION_ROWS; }
  });
  const [saved, setSaved] = useState(false);

  function updateRow(id, field, value) {
    setRows(current => current.map(row => row.id === id ? { ...row, [field]: value } : row));
    setSaved(false);
  }
  function save() {
    localStorage.setItem(storageKey, JSON.stringify(rows));
    setSaved(true);
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{ if (e.target === e.currentTarget) onClose(); }}>
    <section className="permissions-modal" role="dialog" aria-modal="true" aria-label="Team and permissions">
      <header className="modal-header"><div><p className="eyebrow">{show.name}</p><h2>Team & Permissions</h2><p>Prototype permission planning. Database enforcement will be added with shared Supabase tables.</p></div><button className="icon-button" onClick={onClose}><X size={18}/></button></header>
      <div className="template-row">{Object.entries(ROLE_TEMPLATES).map(([key, role]) => <div key={key} className="template-chip"><b>{role.label}</b><small>{role.description}</small></div>)}</div>
      <div className="permission-table-wrap">
        <table className="permission-table">
          <thead><tr><th>Teammate</th><th>Scope</th><th>Calendar</th><th>Scout Route</th><th>Location List</th><th>Budget</th><th>Bible</th><th>Waypoint</th><th>Invite</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id}>
            <td><b>{row.name}</b><small>{row.email}</small></td>
            <td><select value={row.scope} onChange={e=>updateRow(row.id,'scope',e.target.value)}><option>All locations</option><option>Assigned only</option><option>Assigned episodes</option><option>Specific locations</option></select></td>
            {['calendar','scout','locations','budget','bible','waypoint'].map(field => <td key={field}><select value={row[field]} onChange={e=>updateRow(row.id,field,e.target.value)}><option>None</option><option>View</option><option>Edit</option><option>Assigned</option><option>Scout tracker</option><option>Totals only</option><option>Full</option></select></td>)}
            <td><label className="switch-row"><input type="checkbox" checked={row.invite} onChange={e=>updateRow(row.id,'invite',e.target.checked)}/><span>{row.invite ? 'Yes' : 'No'}</span></label></td>
          </tr>)}</tbody>
        </table>
      </div>
      <footer className="modal-footer"><span>{saved ? <><Check size={15}/> Saved locally</> : 'No live permissions changed'}</span><div><button className="secondary" onClick={onClose}>Close</button><button className="primary" onClick={save}>Save prototype</button></div></footer>
    </section>
  </div>;
}

function Dashboard({ show, onBack }) {
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const counts = useMemo(() => ({
    episodes: Array.isArray(show.episodes) ? show.episodes.length : 0,
    itineraries: Array.isArray(show.itineraries) ? show.itineraries.length : 0,
    locations: Array.isArray(show.locationLibrary) ? show.locationLibrary.length : 0,
  }), [show]);

  function openTool(app) {
    const url = envUrl(app.env, app.fallback);
    if (!url) return;
    const target = new URL(url, window.location.origin);
    target.searchParams.set('show', show.id);
    target.searchParams.set('showName', show.name || '');
    window.location.href = target.toString();
  }

  return <main className="page dashboard-page">
    <div className="dashboard-actions"><button className="back" onClick={onBack}><ArrowLeft size={17}/> All Shows</button><button className="secondary permissions-button" onClick={()=>setPermissionsOpen(true)}><LockKeyhole size={16}/> Team & Permissions</button></div>
    <section className="show-hero">
      <div className="hero-logo">{show.logo ? <img src={show.logo} alt=""/> : <MapPin size={34}/>}</div>
      <div><p className="eyebrow">{show.season || 'SHOW DASHBOARD'}</p><h1>{show.name}</h1><p>{show.company || show.productionOffice?.address || 'Connected production workspace'}</p></div>
      <div className="hero-stats"><span><b>{counts.episodes}</b> Episodes</span><span><b>{counts.itineraries}</b> Itineraries</span><span><b>{counts.locations}</b> Saved locations</span></div>
    </section>

    <section className="dashboard-summary">
      <div className="summary-card"><CalendarDays size={19}/><span><b>Upcoming schedule</b><small>Open Calendar to manage prep, hold, shoot, and strike dates.</small></span></div>
      <div className="summary-card"><ListChecks size={19}/><span><b>Location pipeline</b><small>Candidate tracking and final locations list are ready for the next build.</small></span></div>
      <div className="summary-card"><DollarSign size={19}/><span><b>Financial privacy</b><small>Owner-controlled Budget access will support assigned-location views.</small></span></div>
    </section>

    <div className="section-title"><div><p className="eyebrow">TOOLS</p><h2>Production workspace</h2></div><div className="connected"><Users size={16}/> Shared show access</div></div>
    <section className="app-grid">
      {APPS.map(app => {
        const Icon = app.icon; const url = envUrl(app.env, app.fallback); const enabled = Boolean(url);
        return <button key={app.key} className={`app-card ${enabled ? '' : 'disabled'}`} onClick={()=>openTool(app)} disabled={!enabled}>
          <span className={`app-icon ${app.key}`}><Icon size={27}/></span>
          <div><h3>{app.title}</h3><p>{app.description}</p><small>{enabled ? app.status : app.status}</small></div>
          {enabled && <ChevronRight className="chev"/>}
        </button>;
      })}
    </section>

    <section className="activity-strip">
      <div><Activity size={18}/><span><b>One show record</b><small>Calendar, locations, budgets, orders, and maps will share the same record IDs.</small></span></div>
      <div><SlidersHorizontal size={18}/><span><b>Permission-aware tools</b><small>Owners control tool, episode, location, and financial visibility.</small></span></div>
    </section>
    {permissionsOpen && <PermissionsModal show={show} onClose={()=>setPermissionsOpen(false)}/>} 
  </main>;
}

function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeShow, setActiveShow] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    if (!configured) return setReady(true);
    const { data } = await supabase.auth.getSession();
    setSession(data.session || null); setReady(true);
  }
  async function loadShows() {
    setLoading(true); setError('');
    try { setShows(await fetchShows()); } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); if (!configured) return; const { data } = supabase.auth.onAuthStateChange((_event,s)=>setSession(s)); return ()=>data.subscription.unsubscribe(); }, []);
  useEffect(() => { if (session) loadShows(); else { setShows([]); setActiveShow(null); } }, [session?.user?.id]);

  if (!configured) return <main className="login-shell"><section className="login-card"><h1>Connect Supabase</h1><p>Add the same Supabase URL and anon key used by Scout Route to this project’s Vercel environment variables.</p></section></main>;
  if (!ready) return <div className="loading-screen">Loading Taylor Scout…</div>;
  if (!session) return <Login onReady={load}/>;
  return <div className="app-shell">
    <Header show={activeShow} onHome={()=>setActiveShow(null)} onSignOut={()=>supabase.auth.signOut()}/>
    {error && <div className="error-banner">{error}</div>}
    {activeShow ? <Dashboard show={activeShow} onBack={()=>setActiveShow(null)}/> : <Shows shows={shows} loading={loading} onOpen={setActiveShow}/>} 
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
