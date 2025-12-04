// storage.js - save and load routes
import { toast } from './core.js';

const STORAGE_KEY = 'TT_SAVED_ROUTES_V2';
const MAX_ROUTES = 100;

export function saveCurrentRoute() {
  if (!window.routes || !window.multiRoute) {
    toast('No active route to save');
    return;
  }

  const active = window.multiRoute.getActiveRoute();
  if (!active) {
    toast('No active route selected');
    return;
  }

  const points = [
    window.routes.legacyWaypoints?.[0]?.request || 'Unknown',
    ...window.routes.viaPoints.map((_, i) => `Via ${i + 1}`),
    window.routes.legacyWaypoints?.[1]?.request || 'Unknown'
  ].join(' → ');

  const duration = active.properties.get('durationInTraffic') || active.properties.get('duration') || {};
  const distance = active.properties.get('distance') || {};

  const routeData = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    points,
    title: points,
    distance: distance.text || (distance.value ? (distance.value / 1000).toFixed(1) + ' km' : '?'),
    time: duration.text || (duration.value ? formatTime(duration.value) : '?'),
    state: getRouteState(),
    savedAt: new Date().toISOString()
  };

  try {
    const saved = loadRaw();
    saved.unshift(routeData);
    if (saved.length > MAX_ROUTES) saved.length = MAX_ROUTES;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    toast('Route saved');
    renderSavedRoutes();
  } catch (e) {
    console.error('Save failed:', e);
    toast('Failed to save route');
  }
}

function getRouteState() {
  return {
    from: $('#from')?.value || '',
    to:   $('#to')?.value || '',
    veh:  document.querySelector('input[name=veh]:checked')?.value || 'truck40',
    viaPoints: window.routes.viaPoints || [],
    truckParams: window.__TT_TRUCK_PARAMS || {}
  };
}

export function loadSavedRoutes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function renderSavedRoutes() {
  const list = $('#savedRoutesList');
  if (!list) return;

  const routes = loadSavedRoutes();
  list.innerHTML = '';

  if (routes.length === 0) {
    const li = document.createElement('li');
    li.className = 'tt-saved-item';
    li.style.fontSize = '12px';
    li.style.color = '#666';
    li.textContent = 'No saved routes';
    list.appendChild(li);
    return;
  }

  routes.forEach(route => {
    const li = document.createElement('li');
    li.className = 'tt-saved-item';
    li.style.marginBottom = '8px';
    li.innerHTML = `
      <div style="font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${route.title}
      </div>
      <div style="font-size:12px; color:#666; margin-top:2px;">
        ${route.distance} • ${route.time}
      </div>
    `;
    li.style.cursor = 'pointer';
    li.style.padding = '6px 8px';
    li.style.borderRadius = '4px';
    li.style.backgroundColor = '#f8f8f8';
    li.addEventListener('click', () => loadRoute(route));
    li.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      deleteRoute(route.id);
    });
    list.appendChild(li);
  });
}

function loadRoute(route) {
  try {
    $('#from').value = route.state.from;
    $('#to').value = route.state.to;

    const radio = document.querySelector(`input[name=veh][value="${route.state.veh}"]`);
    if (radio) radio.checked = true;

    window.__TT_TRUCK_PARAMS = route.state.truckParams;
    if ($('#truckWeight')) $('#truckWeight').value = route.state.truckParams.weight || 40;
    if ($('#truckHeight'))  $('#truckHeight').value  = route.state.truckParams.height  || 4.0;
    if ($('#truckWidth'))   $('#truckWidth').value   = route.state.truckParams.width   || 2.55;
    if ($('#truckLength'))  $('#truckLength').value  = route.state.truckParams.length  || 16;

    window.routes.viaPoints = route.state.viaPoints || [];
    window.routes.viaMarkers = [];

    // Rebuild markers
    window.routes.viaPoints.forEach(coords => {
      const mark = new ymaps.Placemark(coords, {
        hintContent: `Via point (${window.routes.viaPoints.indexOf(coords) + 1})`
      }, {
        preset: 'islands#darkGreenCircleDotIcon'
      });

      mark.events.add('click', () => {
        const index = window.routes.viaMarkers.indexOf(mark);
        if (index !== -1) {
          window.routes.viaPoints.splice(index, 1);
          window.routes.viaMarkers.splice(index, 1);
          window.map.geoObjects.remove(mark);
          if ($('#from')?.value.trim() && $('#to')?.value.trim()) {
            buildRouteWithState();
          }
        }
      });

      window.map.geoObjects.add(mark);
      window.routes.viaMarkers.push(mark);
    });

    buildRouteWithState();

    toast('Route loaded');
  } catch (e) {
    console.error('Load failed:', e);
    toast('Failed to load route');
  }
}

function deleteRoute(id) {
  try {
    const saved = loadSavedRoutes();
    const filtered = saved.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    renderSavedRoutes();
    toast('Route deleted');
  } catch {
    toast('Failed to delete');
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}
