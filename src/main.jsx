import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowLeft, BookOpen, CalendarDays, Check, ChevronRight, Clock3,
  DollarSign, FileText, Filter, ListChecks, LockKeyhole, LogOut, Map, MapPin,
  Route, Search, ShieldCheck, SlidersHorizontal, Users, WalletCards, X, Plus, Send
} from 'lucide-react';
import {
  configured, fetchShowTeamPermissions, fetchShows, inviteShowMember,
  saveShowTeamPermissions, supabase, TOOL_PERMISSION_KEYS
} from './supabase';
import CreateProductionWizard from './CreateProductionWizard';
import SetListWorkspace from './SetListWorkspace';
import './styles.css';

function TaylorScoutLogo({compact=false}) { return <span className={`ts-logo ${compact?'compact':''}`} aria-label="Taylor Scout"><svg viewBox="0 0 74 92" role="img" aria-hidden="true"><path className="pin-outline" d="M37 3C18 3 5 17 5 36c0 22 17 40 32 53 15-13 32-31 32-53C69 17 56 3 37 3Z"/><path className="mountain" d="M16 39l15-13 8 7 10-10 12 14-12-8-10 10-8-7-15 7Z"/><path className="road" d="M19 69c12-14 24-18 31-27-3 14-12 22-20 31l7 8-9 2-9-14Z"/><path className="star" d="M21 17l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"/></svg><span className="ts-wordmark"><b>TAYLOR SCOUT</b><small>PRODUCTION TOOLS</small></span></span> }

const APPS = [
  {
    key: 'setlist', title: 'Set List Breakdown', icon: FileText, internal: true,
    description: 'Turn the script into the canonical sets, episodes, scenes, hierarchy, and scouting categories.',
    status: 'Open tool'
  },
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
    env: 'VITE_WAYPOINT_URL', fallback: '/waypoint', status: 'Open tool'
  },
  {
    key: 'crew-maps', title: 'Crew Maps', icon: FileText,
    description: 'Generate crew directional maps from Calendar, Bible, Location List, and Waypoint data.',
    env: 'VITE_CREW_MAPS_URL', fallback: '/crew-maps', status: 'Open tool'
  }
];

const TOOL_PERMISSION_LABELS = {
  set_list: 'Set List', calendar: 'Calendar', scout_route: 'Scout Route',
  location_list: 'Location List', budget: 'Budget', bible: 'Bible',
  waypoint: 'Waypoint', wrap_book: 'Wrap Book'
};

function envUrl(name, fallback) {
  const map = {
    VITE_CALENDAR_URL: import.meta.env.VITE_CALENDAR_URL,
    VITE_SCOUT_ROUTE_URL: import.meta.env.VITE_SCOUT_ROUTE_URL,
    VITE_LOCATION_LIST_URL: import.meta.env.VITE_LOCATION_LIST_URL,
    VITE_BUDGET_URL: import.meta.env.VITE_BUDGET_URL,
    VITE_WAYPOINT_URL: import.meta.env.VITE_WAYPOINT_URL,
    VITE_CREW_MAPS_URL: import.meta.env.VITE_CREW_MAPS_URL,
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

function Shows({ shows, loading, onOpen, onCreated }) {
  const [query, setQuery] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const filtered = shows.filter(show => `${show.name} ${show.season || ''} ${show.company || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="page">
    <div className="page-heading"><div><p className="eyebrow">PRODUCTIONS</p><h1>Your Shows</h1><p>Select a show to open its connected production workspace.</p></div>
      <div className="shows-heading-actions"><label className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search productions"/></label><button className="primary request-show-button" onClick={()=>setRequestOpen(true)}><Plus size={16}/> Create Production</button></div>
    </div>
    {loading ? <div className="empty">Loading productions…</div> : shows.length === 0 ? <div className="empty"><h2>No productions yet</h2><p>Create the first connected Taylor Scout workspace.</p><button className="primary" onClick={()=>setRequestOpen(true)}>Create Production</button></div> :
      <div className="show-list">{filtered.map(show => {
        return <button key={show.id} className="show-card" onClick={()=>onOpen(show)}>
          <div className="show-art">{show.logo ? <img src={show.logo} alt=""/> : <MapPin size={28}/>}</div>
          <div className="show-main"><p className="eyebrow">{show.season || 'PRODUCTION'}</p><h2>{show.name}</h2><p>{show.company || show.productionOffice?.address || 'Production workspace'}</p></div>
          <div className="role"><ShieldCheck size={16}/>{String(show.role || 'member').replace(/^./, c=>c.toUpperCase())}</div>
          <ChevronRight className="chev"/>
        </button>;
      })}</div>}
    {requestOpen && <CreateProductionWizard onClose={()=>setRequestOpen(false)} onCreated={(showId,warnings)=>{setRequestOpen(false);onCreated(showId,warnings);}}/>}
  </main>;
}

function PermissionsModal({ show, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const canManage = show.role === 'owner';

  async function loadRows() {
    setLoading(true); setMessage('');
    try { setRows(await fetchShowTeamPermissions(show.id)); }
    catch (error) { setMessage(error?.message || String(error)); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadRows(); }, [show.id]);

  function updateRow(id, toolKey, value) {
    setRows(current => current.map(row => row.id === id ? {
      ...row, permissions: { ...row.permissions, [toolKey]: value }
    } : row));
    setSaved(false);
  }
  async function save() {
    setBusy(true); setMessage('');
    try { await saveShowTeamPermissions(show.id, rows); setSaved(true); }
    catch (error) { setMessage(error?.message || String(error)); }
    finally { setBusy(false); }
  }
  async function invite(event) {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    setBusy(true); setMessage('');
    try {
      await inviteShowMember(show.id, inviteEmail, inviteRole);
      setInviteEmail(''); setInviteRole('viewer');
      await loadRows();
      setMessage('Invitation saved. Registered teammates receive access immediately; new accounts remain pending.');
    } catch (error) { setMessage(error?.message || String(error)); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{ if (e.target === e.currentTarget) onClose(); }}>
    <section className="permissions-modal" role="dialog" aria-modal="true" aria-label="Team and permissions">
      <header className="modal-header"><div><p className="eyebrow">{show.name}</p><h2>Team & Permissions</h2><p>Production owners control edit access per tool. Changes save to the shared production database.</p></div><button className="icon-button" onClick={onClose}><X size={18}/></button></header>
      <div className="template-row"><div className="template-chip"><b>Owner</b><small>Full production, team, and tool administration.</small></div><div className="template-chip"><b>View</b><small>Can read shared production information without changing it.</small></div><div className="template-chip"><b>Edit / Admin</b><small>Can change that tool. Admin is reserved for tool leads.</small></div></div>
      {canManage && <form className="permission-invite" onSubmit={invite}><label><span>Invite teammate</span><input type="email" value={inviteEmail} onChange={event=>setInviteEmail(event.target.value)} placeholder="name@production.com" required/></label><label><span>Membership</span><select value={inviteRole} onChange={event=>setInviteRole(event.target.value)}><option value="viewer">Viewer</option><option value="editor">Editor</option></select></label><button className="secondary" disabled={busy}><Send size={15}/> Send invite</button></form>}
      <div className="permission-table-wrap">
        <table className="permission-table">
          <thead><tr><th>Teammate</th><th>Membership</th>{TOOL_PERMISSION_KEYS.map(toolKey=><th key={toolKey}>{TOOL_PERMISSION_LABELS[toolKey]}</th>)}</tr></thead>
          <tbody>{loading?<tr><td colSpan={10}>Loading live access…</td></tr>:rows.map(row => <tr key={row.id}>
            <td><b>{row.name}</b><small>{row.email}</small></td>
            <td><span className={`membership-pill ${row.status}`}>{row.status==='pending'?'Pending':row.role}</span></td>
            {TOOL_PERMISSION_KEYS.map(toolKey => <td key={toolKey}>{row.status==='pending'?<span className="permission-pending">—</span>:<select value={row.permissions[toolKey]} onChange={event=>updateRow(row.id,toolKey,event.target.value)} disabled={!canManage||row.role==='owner'||busy}><option value="view">View</option><option value="edit">Edit</option><option value="admin">Admin</option></select>}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {message&&<div className="permission-message">{message}</div>}
      <footer className="modal-footer"><span>{saved ? <><Check size={15}/> Live permissions saved</> : canManage ? 'Owner changes apply across the production' : 'Only the production owner can change access'}</span><div><button className="secondary" onClick={onClose}>Close</button>{canManage&&<button className="primary" onClick={save} disabled={busy||loading}>{busy?'Saving…':'Save permissions'}</button>}</div></footer>
    </section>
  </div>;
}

function Dashboard({ show, onBack, onOpenSetList }) {
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const counts = useMemo(() => ({
    episodes: Array.isArray(show.episodes) ? show.episodes.length : 0,
    itineraries: Array.isArray(show.itineraries) ? show.itineraries.length : 0,
    locations: Array.isArray(show.locationLibrary) ? show.locationLibrary.length : 0,
  }), [show]);

  function toolUrl(app) {
    let url = envUrl(app.env, app.fallback);
    if (!url) return '';

    if (app.key === 'scout') {
      url = 'https://app.taylorscout.com';
    }

    const target = new URL(url, window.location.origin);
    target.searchParams.set('show', show.id);
    target.searchParams.set('showId', show.id);
    target.searchParams.set('showName', show.name || '');
    target.searchParams.set('fromHub', '1');
    if (app.key === 'scout') target.searchParams.set('tool', 'scout-route');
    return target.toString();
  }

  return <main className="page dashboard-page">
    <div className="dashboard-actions"><button className="back" onClick={onBack}><ArrowLeft size={17}/> All Shows</button><button className="secondary permissions-button" onClick={()=>setPermissionsOpen(true)}><LockKeyhole size={16}/> Team & Permissions</button></div>
    <section className="show-hero">
      <div className="hero-logo">{show.logo ? <img src={show.logo} alt=""/> : <MapPin size={34}/>}</div>
      <div><p className="eyebrow">{show.season || 'SHOW DASHBOARD'}</p><h1>{show.name}</h1><p>{show.company || show.productionOffice?.address || 'Connected production workspace'}</p></div>
    </section>

    <div className="section-title"><div><p className="eyebrow">TOOLS</p><h2>Production workspace</h2></div><div className="connected"><Users size={16}/> Shared show access</div></div>
    <section className="app-grid">
      {APPS.map(app => {
        const Icon = app.icon; const url = app.internal ? '' : envUrl(app.env, app.fallback); const enabled = app.internal || Boolean(url);
        const href = enabled ? toolUrl(app) : '';
        if (app.internal) return <button key={app.key} className="app-card internal-tool-card" onClick={onOpenSetList}>
          <span className={`app-icon ${app.key}`}><Icon size={27}/></span>
          <div><h3>{app.title}</h3><p>{app.description}</p><small>{app.status}</small></div>
          <ChevronRight className="chev"/>
        </button>;
        return enabled ? <a key={app.key} className="app-card" href={href}>
          <span className={`app-icon ${app.key}`}><Icon size={27}/></span>
          <div><h3>{app.title}</h3><p>{app.description}</p><small>{app.status}</small></div>
          <ChevronRight className="chev"/>
        </a> : <div key={app.key} className="app-card disabled" aria-disabled="true">
          <span className={`app-icon ${app.key}`}><Icon size={27}/></span>
          <div><h3>{app.title}</h3><p>{app.description}</p><small>{app.status}</small></div>
        </div>;
      })}
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
  const [showChooser, setShowChooser] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const initialSelectionDone = useRef(false);

  async function load() {
    if (!configured) return setReady(true);
    const { data } = await supabase.auth.getSession();
    setSession(data.session || null); setReady(true);
  }
  async function loadShows() {
    setLoading(true); setError('');
    try { const next = await fetchShows(); setShows(next); return next; }
    catch (e) { setError(e.message); return []; }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); if (!configured) return; const { data } = supabase.auth.onAuthStateChange((_event,s)=>setSession(s)); return ()=>data.subscription.unsubscribe(); }, []);
  useEffect(() => { if (session) loadShows(); else { setShows([]); setActiveShow(null); initialSelectionDone.current=false; } }, [session?.user?.id]);
  useEffect(() => {
    if (!session || loading || !shows.length || activeShow || showChooser || initialSelectionDone.current) return;
    const remembered = localStorage.getItem('ts-active-show-id');
    const next = shows.find(s => s.id === remembered) || shows[0];
    if (next) { setActiveShow(next); localStorage.setItem('ts-active-show-id', next.id); }
    initialSelectionDone.current = true;
  }, [session, loading, shows, activeShow, showChooser]);

  if (!configured) return <main className="login-shell"><section className="login-card"><h1>Connect Supabase</h1><p>Add the same Supabase URL and anon key used by Scout Route to this project’s Vercel environment variables.</p></section></main>;
  if (!ready) return <div className="loading-screen">Loading Taylor Scout…</div>;
  if (!session) return <Login onReady={load}/>;
  const theme = activeShow?.theme || {};
  const shellStyle = {'--ts-navy':theme.primary||'#061f33','--ts-navy-2':theme.secondary||'#0b2e46','--ts-teal':theme.accent||'#2fb5b2','--ts-font':theme.font||'Inter'};
  async function productionCreated(showId, warnings) {
    const nextShows = await loadShows();
    const created = nextShows.find(show => show.id === showId);
    if (created) { setActiveShow(created); setShowChooser(false); setActiveView('dashboard'); localStorage.setItem('ts-active-show-id', created.id); }
    if (warnings?.length) setError(`Production created. ${warnings.length} invitation${warnings.length===1?'':'s'} need attention: ${warnings.join(' · ')}`);
  }
  return <div className="app-shell" style={shellStyle}>
    <Header show={activeShow} onHome={()=>{ if (activeView!=='dashboard') return setActiveView('dashboard'); if (activeShow) return; const next=shows[0]; if(next){setActiveShow(next);setShowChooser(false);} }} onSignOut={()=>supabase.auth.signOut()}/>
    {error && <div className="error-banner">{error}</div>}
    {activeShow && !showChooser ? (activeView==='setlist' ? <SetListWorkspace show={activeShow} onBack={()=>setActiveView('dashboard')}/> : <Dashboard show={activeShow} onBack={()=>{setShowChooser(true);setActiveShow(null);setActiveView('dashboard');}} onOpenSetList={()=>setActiveView('setlist')}/>) : <Shows shows={shows} loading={loading} onCreated={productionCreated} onOpen={show=>{setActiveShow(show);setShowChooser(false);setActiveView('dashboard');localStorage.setItem('ts-active-show-id',show.id)}}/>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);