import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft, BookOpen, Calculator, ChevronRight, Clock3, LogOut,
  Map, MapPin, Route, ShieldCheck, Users, WalletCards
} from 'lucide-react';
import { configured, fetchShows, supabase } from './supabase';
import './styles.css';

const APPS = [
  {
    key: 'scout', title: 'Scout Route', icon: Route,
    description: 'Build, optimize, print, and share scout itineraries.',
    env: 'VITE_SCOUT_ROUTE_URL', fallback: 'https://app.taylorscout.com', status: 'Open tool'
  },
  {
    key: 'budget', title: 'Budget', icon: WalletCards,
    description: 'Create episode and set budgets, estimates, POs, and actuals.',
    env: 'VITE_BUDGET_URL', fallback: '', status: 'Connect app'
  },
  {
    key: 'waypoint', title: 'Waypoint', icon: Map,
    description: 'Create professional logistics maps and set schematics.',
    env: 'VITE_WAYPOINT_URL', fallback: '', status: 'Connect app'
  },
  {
    key: 'bible', title: 'Location Bible', icon: BookOpen,
    description: 'Centralize locations, contacts, vendors, parking, access, and permits.',
    env: 'VITE_BIBLE_URL', fallback: '', status: 'Coming soon'
  }
];

function envUrl(name, fallback) {
  const map = {
    VITE_SCOUT_ROUTE_URL: import.meta.env.VITE_SCOUT_ROUTE_URL,
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
      <div className="brand-lockup"><span className="brand-pin"><MapPin size={22}/></span><div><b>TAYLOR SCOUT</b><small>PRODUCTION TOOLS</small></div></div>
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
    <button className="brand-button" onClick={onHome}><span className="brand-pin"><MapPin size={19}/></span><span><b>TAYLOR SCOUT</b><small>PRODUCTION TOOLS</small></span></button>
    <div className="crumb">{show ? show.name : 'Your Shows'}</div>
    <button className="icon-button" onClick={onSignOut} title="Sign out"><LogOut size={18}/></button>
  </header>;
}

function Shows({ shows, loading, onOpen }) {
  return <main className="page">
    <div className="page-heading"><div><p className="eyebrow">PRODUCTIONS</p><h1>Your Shows</h1><p>Select a show to open its connected production workspace.</p></div></div>
    {loading ? <div className="empty">Loading shows…</div> : shows.length === 0 ? <div className="empty"><h2>No shows available</h2><p>Create your first show in Scout Route. It will appear here automatically.</p><a className="primary link" href={envUrl('VITE_SCOUT_ROUTE_URL','https://app.taylorscout.com')}>Open Scout Route</a></div> :
      <div className="show-list">{shows.map(show => {
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
  </main>;
}

function Dashboard({ show, onBack }) {
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
    window.location.href = target.toString();
  }

  return <main className="page dashboard-page">
    <button className="back" onClick={onBack}><ArrowLeft size={17}/> All Shows</button>
    <section className="show-hero">
      <div className="hero-logo">{show.logo ? <img src={show.logo} alt=""/> : <MapPin size={34}/>}</div>
      <div><p className="eyebrow">{show.season || 'SHOW DASHBOARD'}</p><h1>{show.name}</h1><p>{show.company || show.productionOffice?.address || 'Connected production workspace'}</p></div>
      <div className="hero-stats"><span><b>{counts.episodes}</b> Episodes</span><span><b>{counts.itineraries}</b> Itineraries</span><span><b>{counts.locations}</b> Saved locations</span></div>
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
      <div><Clock3 size={18}/><span><b>One show record</b><small>Episodes, locations, and collaborators stay attached to {show.name}.</small></span></div>
      <div><Calculator size={18}/><span><b>Connected over time</b><small>Budget, Waypoint, and Bible can share this show without replacing existing data.</small></span></div>
    </section>
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
