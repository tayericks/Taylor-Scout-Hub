import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import WaypointWorkspace from './waypoint/WaypointWorkspace';
import { configured, fetchShows, supabase } from './supabase';

const isWaypointRoute = window.location.pathname === '/waypoint' || window.location.pathname.startsWith('/waypoint/');

function WaypointGate() {
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
        if (!cancelled) setState({ loading: false, show, error: show ? '' : 'No accessible show is available for Waypoint.' });
      } catch (error) {
        if (!cancelled) setState({ loading: false, show: null, error: error?.message || String(error) });
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (state.loading) return <div style={{height:'100vh',display:'grid',placeItems:'center',background:'#0b0f12',color:'#dfe5e3',fontFamily:'system-ui'}}>Loading Waypoint…</div>;
  if (state.error) return <div style={{height:'100vh',display:'grid',placeItems:'center',background:'#0b0f12',color:'#dfe5e3',fontFamily:'system-ui'}}><div><h2>Waypoint</h2><p>{state.error}</p><button onClick={()=>window.location.assign('/')}>Return to Taylor Scout</button></div></div>;
  return <WaypointWorkspace show={state.show} onBack={() => window.location.assign(`/?show=${encodeURIComponent(state.show.id)}&showId=${encodeURIComponent(state.show.id)}&showName=${encodeURIComponent(state.show.name || '')}`)} />;
}

if (isWaypointRoute) {
  createRoot(document.getElementById('root')).render(<WaypointGate />);
} else {
  import('./main.jsx');
}
