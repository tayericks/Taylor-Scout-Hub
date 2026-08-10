import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import WaypointWorkspace from './waypoint/WaypointWorkspace';
import CrewMapsWorkspace from './crew-maps/CrewMapsDesignBoard';
import './crew-maps/crew-maps-locked-hybrid.js';
import './crew-maps/crew-maps-shell-viewport-fix.js';
import './crew-maps/crew-maps-canonical-shell.css';
import { configured, fetchShows, supabase } from './supabase';

const pathname = window.location.pathname;
const isWaypointRoute = pathname === '/waypoint' || pathname.startsWith('/waypoint/');
const isCrewMapsRoute = pathname === '/crew-maps' || pathname.startsWith('/crew-maps/');

function ToolGate({tool}) {
  const [state, setState] = useState({ loading: true, show: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!configured) {
        if (!cancelled) setState({ loading: false, show: null, error: 'Taylor Scout Supabase is not configured.' });
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.replace('/');
        return;
      }
      try {
        const shows = await fetchShows();
        const params = new URLSearchParams(window.location.search);
        const showId = params.get('showId') || params.get('show');
        const show = shows.find(item => item.id === showId) || shows[0] || null;
        if (!cancelled) setState({ loading: false, show, error: show ? '' : `No accessible show is available for ${tool === 'crew-maps' ? 'Crew Maps' : 'Waypoint'}.` });
      } catch (error) {
        if (!cancelled) setState({ loading: false, show: null, error: error?.message || String(error) });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tool]);

  const label = tool === 'crew-maps' ? 'Crew Maps' : 'Waypoint';
  if (state.loading) return <div style={{height:'100vh',display:'grid',placeItems:'center',background:tool==='crew-maps'?'#f3f6f8':'#0b0f12',color:tool==='crew-maps'?'#203247':'#dfe5e3',fontFamily:'system-ui'}}>Loading {label}…</div>;
  if (state.error) return <div style={{height:'100vh',display:'grid',placeItems:'center',background:tool==='crew-maps'?'#f3f6f8':'#0b0f12',color:tool==='crew-maps'?'#203247':'#dfe5e3',fontFamily:'system-ui'}}><div><h2>{label}</h2><p>{state.error}</p><button onClick={()=>window.location.assign('/')}>Return to Taylor Scout</button></div></div>;
  const back = () => window.location.assign(`/?show=${encodeURIComponent(state.show.id)}&showId=${encodeURIComponent(state.show.id)}&showName=${encodeURIComponent(state.show.name || '')}`);
  return tool === 'crew-maps' ? <CrewMapsWorkspace show={state.show} onBack={back}/> : <WaypointWorkspace show={state.show} onBack={back}/>;
}

if (isWaypointRoute) {
  createRoot(document.getElementById('root')).render(<ToolGate tool="waypoint" />);
} else if (isCrewMapsRoute) {
  createRoot(document.getElementById('root')).render(<ToolGate tool="crew-maps" />);
} else {
  import('./main.jsx');
}