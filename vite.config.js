import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function enableWaypointTool() {
  return {
    name: 'enable-waypoint-tool',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/main.jsx')) return null;
      const before = "env: 'VITE_WAYPOINT_URL', fallback: '', status: 'Coming soon'";
      const after = "env: 'VITE_WAYPOINT_URL', fallback: '/waypoint', status: 'Open tool'";
      return code.includes(before) ? { code: code.replace(before, after), map: null } : null;
    }
  };
}

export default defineConfig({
  plugins: [enableWaypointTool(), react()]
});
