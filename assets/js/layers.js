// map/assets/js/layers.js
import { toast, escapeHtml } from './core.js';

export const layers = {
  frames: null,
  hgvAllowed: null,
  hgvForbidden: null,
  hgvConditional: null,
  federal: null,
  clearance: null
};

const layerConfigs = {
  frames: {
    filename: 'frames_ready.geojson',
    friendlyName: 'Весовые рамки',
    options: { preset: 'islands#blueCircleDotIcon', zIndex: 220 }
  },
  hgvAllowed: {
    filename: 'hgv_allowed.geojson',
    friendlyName: 'Разрешено для грузовиков',
    options: { preset: 'islands#darkGreenCircleDotIcon', zIndex: 210 }
  },
  hgvForbidden: {
    filename: 'hgv_forbidden.geojson',
    friendlyName: 'Запрещено для грузовиков',
    options: { preset: 'islands#redCircleDotIcon', zIndex: 208 }
  },
  hgvConditional: {
    filename: 'hgv_conditional.geojson',
    friendlyName: 'Ограничения для грузовиков',
    options: { preset: 'islands#yellowCircleDotIcon', zIndex: 205 }
  },
  federal: {
    filename: 'federal.geojson',
    friendlyName: 'Федеральные трассы',
    options: { preset: 'islands#grayCircleDotIcon', zIndex: 200 }
  },
  clearance: {
    filename: 'clearance.geojson',
    friendlyName: 'Ограничения (высота/ширина)',
    options: { preset: 'islands#orangeCircleDotIcon', zIndex: 202 }
  }
};

const LAYERS_BASE = window.TRANSTIME_CONFIG?.layersBase || (location.pathname.replace(/\/[^/]*$/, '') + '/data');

function urlFromBase(name) {
  return `${LAYERS_BASE}/${name}`;
}

async function loadGeoJSON(filename, friendlyName) {
  const url = urlFromBase(filename);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 404) {
      toast(`Нет данных слоя: ${friendlyName || filename}`);
      return { type: 'FeatureCollection', features: [], __tt_httpStatus: 404 };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && typeof data === 'object') data.__tt_httpStatus = res.status;
    return data;
  } catch (e) {
    toast(`Ошибка загрузки ${friendlyName || filename}: ${e.message}`);
    return { type: 'FeatureCollection', features: [], __tt_httpStatus: -1 };
  }
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

function normalizeGeomCoords(geom) {
  if (!geom || !geom.type) return geom;
  const swap = c => normalizeCoordPair(c);
  const normLine = line => Array.isArray(line) ? line.map(swap).filter(Boolean) : line;
  const normRing = ring => Array.isArray(ring) ? ring.map(swap).filter(Boolean) : ring;
  switch (geom.type) {
    case 'Point':
      geom.coordinates = swap(geom.coordinates);
      break;
    case 'MultiPoint':
      geom.coordinates = Array.isArray(geom.coordinates) ? geom.coordinates.map(swap).filter(Boolean) : geom.coordinates;
      break;
    case 'LineString':
      geom.coordinates = normLine(geom.coordinates);
      break;
    case 'MultiLineString':
      geom.coordinates = Array.isArray(geom.coordinates) ? geom.coordinates.map(normLine) : geom.coordinates;
      break;
    case 'Polygon':
      geom.coordinates = Array.isArray(geom.coordinates) ? geom.coordinates.map(normRing) : geom.coordinates;
      break;
    case 'MultiPolygon':
      geom.coordinates = Array.isArray(geom.coordinates)
        ? geom.coordinates.map(poly => Array.isArray(poly) ? poly.map(normRing) : poly)
        : geom.coordinates;
      break;
    case 'GeometryCollection':
      if (Array.isArray(geom.geometries)) geom.geometries.forEach(g => normalizeGeomCoords(g));
      break;
  }
  return geom;
}

function normalizeFeatureCollectionCoords(fc) {
  if (!fc || !Array.isArray(fc.features)) return fc;
  fc.features.forEach(f => { if (f && f.geometry) normalizeGeomCoords(f.geometry); });
  return fc;
}

function decorateFeatureCollection(fc, layerName) {
  if (!fc?.features) return;
  fc.features.forEach(f => {
    if (!f) return;
    const p = f.properties || {};
    const g = f.geometry || {};

    const title = p.name || p.title || p.comment_human || (p.object_type === 'frame' ? 'Весовая рамка' : 'Объект');
    const comment = p.comment_human || p.comment || '';
    const extra = [];
    if (p.frame_state) extra.push('Состояние: ' + p.frame_state);
    if (p.frame_id)    extra.push('ID: ' + p.frame_id);

    f.properties = {
      ...p,
      hintContent: title,
      balloonContent:
        `<b>${escapeHtml(title)}</b>` +
        (comment ? `<div class="mt6">${escapeHtml(comment)}</div>` : '') +
        (extra.length ? `<div class="small mt6">${extra.map(escapeHtml).join('<br>')}</div>` : '')
    };

    if (f.properties.object_type === 'segment' && (g.type === 'LineString' || g.type === 'MultiLineString')) {
      let color = '#9ca3af';
      if (f.properties.hgv_access === 'allowed') color = '#16a34a';
      else if (f.properties.hgv_access === 'conditional') color = '#eab308';
      else if (f.properties.hgv_access === 'forbidden') color = '#dc2626';
      else if (f.properties.height_limit && parseFloat(f.properties.height_limit) < window.__TT_TRUCK_PARAMS?.height) color = '#ef4444';
      else if (f.properties.width_limit && parseFloat(f.properties.width_limit) < window.__TT_TRUCK_PARAMS?.width) color = '#f97316';

      f.options = f.options || {};
      f.options.strokeColor = color;
      f.options.strokeWidth = 3;
      f.options.strokeOpacity = 0.9;
    }
  });
}

function ensureFeatureIds(fc, prefix = 'fc') {
  if (!fc?.features) return;
  let i = 0;
  fc.features.forEach(f => {
    if (f && (f.id === undefined || f.id === null)) f.id = `${prefix}_${i++}`;
  });
}

export function applyLayerOptions(manager, options = {}) {
  if (!manager?.objects?.options) return;
  Object.entries(options).forEach(([key, value]) => manager.objects.options.set(key, value));
  manager.objects.options.set({ strokeColor: '#60a5fa', strokeWidth: 3, strokeOpacity: 0.9, fillOpacity: 0.3 });
}

export async function toggleLayer(name, on, checkbox) {
  if (!window.map) return;
  const cfg = layerConfigs[name];
  const manager = layers[name];
  if (!cfg || !manager) return;

  if (on) {
    const fc = await loadGeoJSON(cfg.filename, cfg.friendlyName);
    if (!Array.isArray(fc.features) || fc.features.length === 0) {
      if (fc.__tt_httpStatus !== 404) toast(`Нет данных слоя: ${cfg.friendlyName}`);
      if (checkbox) checkbox.checked = false;
      manager.removeAll?.();
      removeFromMap(manager);
      return;
    }
    normalizeFeatureCollectionCoords(fc);
    ensureFeatureIds(fc, name);
    decorateFeatureCollection(fc, name);
    delete fc.__tt_httpStatus;
    manager.removeAll?.();
    manager.add(fc);
    addToMap(manager);
  } else {
    removeFromMap(manager);
  }

  // Сохраняем состояние
  try {
    const state = JSON.parse(localStorage.getItem('TT_LAYERS_STATE') || '{}');
    state[name] = !!on;
    localStorage.setItem('TT_LAYERS_STATE', JSON.stringify(state));
  } catch {}
}

export function initLayers() {
  Object.entries(layerConfigs).forEach(([name, cfg]) => {
    const manager = new ymaps.ObjectManager({ clusterize: false });
    layers[name] = manager;
    applyLayerOptions(manager, cfg.options);
  });
}

// --- Утилиты ---
function addToMap(obj) {
  if (obj && window.map && !isOnMap(obj)) {
    window.map.geoObjects.add(obj);
    obj.__tt_onMap = true;
  }
}
function removeFromMap(obj) {
  if (obj && window.map && isOnMap(obj)) {
    window.map.geoObjects.remove(obj);
    obj.__tt_onMap = false;
  }
}
function isOnMap(obj) {
  return !!(obj && obj.__tt_onMap === true);
}