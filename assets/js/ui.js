// ui.js - user interface logic
import { toast } from './core.js';
import { buildRouteWithState } from './routes.js';
import { initLayers, toggleLayer } from './layers.js';
import { map } from './map.js';

export function initUI() {
  const from = $('#from');
  const to = $('#to');
  const buildBtn = $('#buildBtn');
  const clearWaypoints = $('#clearWaypoints');
  const waypointModeBtn = $('#waypointModeBtn');
  const vehRadios = $$('input[name=veh]');
  const saveRouteBtn = $('#saveRouteBtn');
  const shareRouteBtn = $('#shareRouteBtn');
  const openNavBtn = $('#openNavBtn');

  initLayers();

  let waypointMode = false;

  function updateUI() {
    $('#from').style.borderColor = '';
    $('#to').style.borderColor = '';
    if (buildBtn) {
      buildBtn.disabled = !(from?.value.trim() && to?.value.trim());
    }
    if (clearWaypoints) {
      clearWaypoints.disabled = window.routes?.viaPoints.length === 0;
    }
    if (waypointModeBtn) {
      waypointModeBtn.classList.toggle('active', waypointMode);
      waypointModeBtn.textContent = waypointMode ? 'Via points (active)' : 'Via points';
    }
  }

  function updateVehGroup() {
    vehRadios.forEach(r => {
      r.parentElement.classList.toggle('active', r.checked);
    });
    if (typeof syncFramesLayerVisibility === 'function') {
      syncFramesLayerVisibility();
    }
  }

  [from, to].forEach(inp => {
    inp?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        buildRouteWithState();
      }
    });
    inp?.addEventListener('input', updateUI);
  });

  vehRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateVehGroup();
      if (from?.value.trim() && to?.value.trim()) {
        buildRouteWithState();
      }
    });
  });

  buildBtn?.addEventListener('click', () => {
    buildRouteWithState();
  });

  if (waypointModeBtn) {
    waypointModeBtn.addEventListener('click', () => {
      waypointMode = !waypointMode;
      updateUI();
      toast(waypointMode
        ? 'Click on map to add via point. Max 5.'
        : 'Via point mode deactivated');
    });
  }

  map.events.add('click', e => {
    if (!waypointMode) return;
    if (window.routes?.viaPoints.length >= 5) {
      toast('Max 5 via points');
      return;
    }

    const coords = e.get('coords');
    window.routes.viaPoints.push(coords);

    const mark = new ymaps.Placemark(coords, {
      hintContent: `Via point (${window.routes.viaPoints.length})`
    }, {
      preset: 'islands#darkGreenCircleDotIcon'
    });

    mark.events.add('click', () => {
      const index = window.routes.viaMarkers.indexOf(mark);
      if (index !== -1) {
        window.routes.viaPoints.splice(index, 1);
        window.routes.viaMarkers.splice(index, 1);
        map.geoObjects.remove(mark);
        updateUI();
        if (from?.value.trim() && to?.value.trim()) {
          buildRouteWithState();
        }
      }
    });

    map.geoObjects.add(mark);
    window.routes.viaMarkers.push(mark);
    updateUI();
    if (from?.value.trim() && to?.value.trim()) {
      buildRouteWithState();
    }
  });

  clearWaypoints?.addEventListener('click', () => {
    window.routes.viaPoints = [];
    window.routes.viaMarkers.forEach(m => map.geoObjects.remove(m));
    window.routes.viaMarkers = [];
    updateUI();
    if (from?.value.trim() && to?.value.trim()) {
      buildRouteWithState();
    }
  });

  saveRouteBtn?.addEventListener('click', () => {
    if (typeof saveCurrentRoute === 'function') {
      saveCurrentRoute();
    }
  });

  shareRouteBtn?.addEventListener('click', () => {
    if (typeof shareCurrentRoute === 'function') {
      shareCurrentRoute();
    }
  });

  openNavBtn?.addEventListener('click', () => {
    if (typeof openInNavigator === 'function') {
      openInNavigator();
    }
  });

  const cFrames = $('#toggle-frames');
  const cTruckAllowed = $('#toggle-truck-allowed');
  const cTruckForbidden = $('#toggle-truck-forbidden');
  const cTruckConditional = $('#toggle-truck-conditional');
  const cFed = $('#toggle-federal');
  const cClearance = $('#toggle-clearance');
  const cTraffic = $('#toggle-traffic');
  const cEvents = $('#toggle-events');

  cFrames?.addEventListener('change', e => toggleLayer('frames', e.target.checked, cFrames));
  cTruckAllowed?.addEventListener('change', e => toggleLayer('hgvAllowed', e.target.checked, cTruckAllowed));
  cTruckForbidden?.addEventListener('change', e => toggleLayer('hgvForbidden', e.target.checked, cTruckForbidden));
  cTruckConditional?.addEventListener('change', e => toggleLayer('hgvConditional', e.target.checked, cTruckConditional));
  cFed?.addEventListener('change', e => toggleLayer('federal', e.target.checked, cFed));
  cClearance?.addEventListener('change', e => toggleLayer('clearance', e.target.checked, cClearance));

  if (cTraffic) {
    window.__tt_setTraffic = on => { try { window.map.trafficControl?.state.set('trafficShown', !!on); } catch (e) { console.warn(e); } };
    cTraffic.addEventListener('change', () => window.__tt_setTraffic(cTraffic.checked));
    window.__tt_setTraffic(cTraffic.checked);
  }

  if (cEvents) {
    window.__tt_setEvents = on => { try { window.map.trafficControl?.state.set('infoLayerShown', !!on); } catch (e) { console.warn(e); } };
    cEvents.addEventListener('change', () => window.__tt_setEvents(cEvents.checked));
    window.__tt_setEvents(cEvents.checked);
  }

  try {
    const saved = JSON.parse(localStorage.getItem('TT_LAYERS_STATE') || '{}');
    if (cFrames)          cFrames.checked          = !!saved.frames;
    if (cTruckAllowed)    cTruckAllowed.checked    = !!saved.hgvAllowed;
    if (cTruckForbidden)  cTruckForbidden.checked  = !!saved.hgvForbidden;
    if (cTruckConditional) cTruckConditional.checked = !!saved.hgvConditional;
    if (cFed)             cFed.checked             = !!saved.federal;
    if (cClearance)       cClearance.checked       = !!saved.clearance;
  } catch {}

  if (cFrames?.checked)          toggleLayer('frames', cFrames.checked, cFrames);
  if (cTruckAllowed?.checked)    toggleLayer('hgvAllowed', cTruckAllowed.checked, cTruckAllowed);
  if (cTruckForbidden?.checked)  toggleLayer('hgvForbidden', cTruckForbidden.checked, cTruckForbidden);
  if (cTruckConditional?.checked) toggleLayer('hgvConditional', cTruckConditional.checked, cTruckConditional);
  if (cFed?.checked)             toggleLayer('federal', cFed.checked, cFed);
  if (cClearance?.checked)       toggleLayer('clearance', cClearance.checked, cClearance);

  updateUI();
  updateVehGroup();

  const details = document.querySelectorAll('.tt-details');
  details.forEach(el => {
    const key = 'DETAILS_' + (el.id || 'unknown');
    if (!key.includes('DETAILS_')) return;

    try {
      const saved = localStorage.getItem(key);
      if (saved === 'true') el.setAttribute('open', '');
      if (saved === 'false') el.removeAttribute('open');

      el.addEventListener('toggle', () => {
        localStorage.setItem(key, el.open);
      });
    } catch {}
  });
}