// routes.js - route logic with export
import { toast, fmtDist, fmtTime } from './core.js';
import { YandexRouter } from './router.js';
import { map } from './map.js';

export let multiRoute = null;
export let viaPoints = [];
export let viaMarkers = [];
let activeRouteChangeHandler = null;
let isBuilding = false;

function addToMap(obj) {
  if (obj && map && !isOnMap(obj)) {
    map.geoObjects.add(obj);
    obj.__tt_onMap = true;
  }
}

function removeFromMap(obj) {
  if (obj && map && isOnMap(obj)) {
    map.geoObjects.remove(obj);
    obj.__tt_onMap = false;
  }
}

function isOnMap(obj) {
  return !!(obj && obj.__tt_onMap === true);
}

function getTruckParams() {
  const weight = parseFloat($('#truckWeight')?.value) || 0;
  const height = parseFloat($('#truckHeight')?.value) || 0;
  const width  = parseFloat($('#truckWidth')?.value)  || 0;
  const length = parseFloat($('#truckLength')?.value) || 0;
  return { weight, height, width, length };
}

function getCurrentVehMode() {
  return document.querySelector('input[name=veh]:checked')?.value || 'truck40';
}

function isCarMode() {
  return getCurrentVehMode() === 'car';
}

// === Экспортируем функцию построения маршрута ===
export async function buildRouteWithState() {
  if (isBuilding) {
    toast('Route building in progress, please wait...');
    return;
  }

  const fromVal = $('#from')?.value.trim();
  const toVal   = $('#to')?.value.trim();
  const buildBtn = $('#buildBtn');

  if (!fromVal || !toVal) {
    $('#from').style.borderColor = !fromVal ? '#ef4444' : '';
    $('#to').style.borderColor   = !toVal   ? '#ef4444' : '';
    toast('Fill "From" and "To"', 2000);
    return;
  } else {
    $('#from').style.borderColor = '';
    $('#to').style.borderColor = '';
  }

  const params = getTruckParams();
  if (params.weight > 100) {
    $('#truckWeight').style.borderColor = '#ef4444';
    toast('Weight must not exceed 100 tons', 2000);
    return;
  }
  $('#truckWeight').style.borderColor = '';

  if (params.height > 10) {
    $('#truckHeight').style.borderColor = '#ef4444';
    toast('Height must not exceed 10 m', 2000);
    return;
  }
  $('#truckHeight').style.borderColor = '';

  if (params.width > 5) {
    $('#truckWidth').style.borderColor = '#ef4444';
    toast('Width must not exceed 5 m', 2000);
    return;
  }
  $('#truckWidth').style.borderColor = '';

  if (params.length > 30) {
    $('#truckLength').style.borderColor = '#ef4444';
    toast('Length must not exceed 30 m', 2000);
    return;
  }
  $('#truckLength').style.borderColor = '';

  window.__TT_TRUCK_PARAMS = params;
  isBuilding = true;
  const oldText = buildBtn?.textContent;
  if (buildBtn) {
    buildBtn.disabled = true;
    buildBtn.textContent = 'Building...';
  }

  try {
    const vehMode = getCurrentVehMode();
    const opts = {
      mode: isCarMode() ? 'driving' : 'truck',
      alternatives: 3,
      weight: params.weight ? params.weight * 1000 : undefined,
      dimensions: {}
    };

    if (params.height)  opts.dimensions.height = params.height;
    if (params.width)   opts.dimensions.width  = params.width;
    if (params.length)  opts.dimensions.length = params.length;

    const A = await YandexRouter.geocode(fromVal);
    const B = await YandexRouter.geocode(toVal);
    const points = [A, ...viaPoints, B];

    const res = await YandexRouter.build(points, opts);
    const mr = res.multiRoute;

    if (multiRoute) {
      if (activeRouteChangeHandler && multiRoute.events?.remove) {
        multiRoute.events.remove('activeroutechange', activeRouteChangeHandler);
      }
      removeFromMap(multiRoute);
    }

    multiRoute = mr;
    addToMap(multiRoute);

    activeRouteChangeHandler = () => {
      if (typeof refreshFramesForActiveRoute === 'function') {
        refreshFramesForActiveRoute(points);
      }
      if (typeof highlightActiveRouteItem === 'function') {
        highlightActiveRouteItem();
      }
    };
    multiRoute.events.add('activeroutechange', activeRouteChangeHandler);

    if (typeof refreshFramesForActiveRoute === 'function') {
      refreshFramesForActiveRoute(points);
    }
    if (typeof renderRouteList === 'function') {
      renderRouteList(res.routes);
    }
    if (typeof highlightActiveRouteItem === 'function') {
      highlightActiveRouteItem();
    }

    toast('Route built', 1600);
  } catch (e) {
    console.error('Route build error:', e);
    const msg = e.message || 'Failed to build route';
    toast(msg.length > 100 ? msg.substring(0, 100) + '...' : msg, 4000);
  } finally {
    isBuilding = false;
    if (buildBtn) {
      buildBtn.disabled = false;
      buildBtn.textContent = oldText || 'Build route';
    }
  }
}

export function renderRouteList(routes) {
  const listEl = $('#routeList');
  if (!listEl || !routes || routes.getLength() <= 1) {
    if (listEl) listEl.style.display = 'none';
    return;
  }
  listEl.innerHTML = '';
  const arr = [];
  routes.each(r => {
    const tT = r.properties.get('durationInTraffic') || {};
    const t = r.properties.get('duration') || {};
    arr.push({ r, time: Number(tT.value || t.value || 0) });
  });
  arr.sort((a, b) => a.time - b.time);
  arr.forEach((o, index) => {
    const dist = fmtDist(o.r.properties.get('distance')?.value || 0);
    const dur = fmtTime(o.r.properties.get('durationInTraffic')?.value || o.r.properties.get('duration')?.value || 0);
    const div = document.createElement('div');
    div.className = 'tt-route-item';
    div.dataset.index = index;
    div.innerHTML = `<div><strong>Route ${index + 1}</strong></div><div>${dist}, ${dur}</div>`;
    div.addEventListener('click', () => {
      try { multiRoute.setActiveRoute(o.r); } catch (e) { console.warn(e); }
    });
    listEl.appendChild(div);
  });
  listEl.style.display = 'block';
  highlightActiveRouteItem();
}

export function highlightActiveRouteItem() {
  const listEl = $('#routeList');
  if (!listEl || !multiRoute?.getActiveRoute) return;
  const active = multiRoute.getActiveRoute();
  const routes = multiRoute.getRoutes?.();
  let activeIndex = -1;
  if (routes?.getLength) {
    routes.each((r, idx) => { if (r === active) activeIndex = idx; });
  }
  Array.from(listEl.children).forEach((el, idx) => {
    el.classList.toggle('active', idx === activeIndex);
  });
}

function normalizeBBox(rawBBox) {
  if (!Array.isArray(rawBBox) || rawBBox.length < 2) return null;
  const p1 = normalizeCoordPair(rawBBox[0]);
  const p2 = normalizeCoordPair(rawBBox[1]);
  if (!p1 || !p2) return null;
  const [lon1, lat1] = p1;
  const [lon2, lat2] = p2;
  return [
    [Math.min(lon1, lon2), Math.min(lat1, lat2)],
    [Math.max(lon1, lon2), Math.max(lat1, lat2)]
  ];
}

function expandBBox(bbox, margin = 0.02) {
  const norm = normalizeBBox(bbox);
  if (!norm) return null;
  const [[minLon, minLat], [maxLon, maxLat]] = norm;
  return [
    [minLon - margin, minLat - margin],
    [maxLon + margin, maxLat + margin]
  ];
}

function normalizeCoordPair(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return null;
  let [x, y] = pair;
  const absX = Math.abs(Number(x));
  const absY = Math.abs(Number(y));
  if (!Number.isFinite(absX) || !Number.isFinite(absY)) return null;
  if (absX <= 90 && absY > 90) [x, y] = [y, x];
  return [Number(x), Number(y)];
}

function collectRouteGeometryPoints(route) {
  const pts = [];
  try {
    route.getPaths?.().each(path => {
      path.getSegments?.().each(segment => {
        const coords = segment.getCoordinates?.();
        if (Array.isArray(coords)) coords.forEach(c => Array.isArray(c) && pts.push(c));
      });
    });
  } catch (e) {
    console.warn('Error collecting route geometry:', e);
  }
  return pts;
}

export function refreshFramesForActiveRoute(fallbackPoints) {
  if (isCarMode()) return;
  const framesToggle = $('#toggle-frames');
  if (!framesToggle?.checked) return;

  let bbox = null;
  const activeRoute = multiRoute?.getActiveRoute?.();
  if (activeRoute) {
    bbox = normalizeBBox(activeRoute.properties?.get?.('boundedBy'));
    if (!bbox) bbox = bboxFromPoints(collectRouteGeometryPoints(activeRoute));
  }
  if (!bbox && Array.isArray(fallbackPoints)) bbox = bboxFromPoints(fallbackPoints);
  applyFramesBBox(bbox);
}

function bboxFromPoints(points, margin = 0.05) {
  if (!Array.isArray(points) || points.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  points.forEach(pt => {
    const norm = normalizeCoordPair(pt);
    if (!norm) return;
    const [lon, lat] = norm;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  });
  if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;
  return [
    [minLon - margin, minLat - margin],
    [maxLon + margin, maxLat + margin]
  ];
}

export function applyFramesBBox(bbox) {
  if (!window.layers?.frames?.objects) return;
  if (!bbox) return window.layers.frames.objects.setFilter(null);
  const expanded = expandBBox(bbox);
  if (!expanded) return window.layers.frames.objects.setFilter(null);
  const [[minLon, minLat], [maxLon, maxLat]] = expanded;
  window.layers.frames.objects.setFilter(obj => {
    const coords = normalizeCoordPair(obj.geometry?.coordinates);
    if (!coords) return false;
    const [lon, lat] = coords;
    return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
  });
}