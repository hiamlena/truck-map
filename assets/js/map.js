// map.js - initialize Yandex Map
import { toast } from './core.js';

export let map = null;
export let trafficControl = null;

export function init() {
  if (window.ymaps && ymaps.ready) {
    ymaps.ready(setup);
    return;
  }

  if (window.__TT_YA_LOADING__) return;
  window.__TT_YA_LOADING__ = true;

  const cfg = window.TRANSTIME_CONFIG?.yandex;
  if (!cfg?.apiKey) {
    console.error('Error: no API key');
    toast('Map config is invalid');
    return;
  }

  const script = document.createElement('script');
  script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(cfg.apiKey)}&lang=ru_RU&coordorder=longlat`;
  script.async = true;

  script.onload = () => {
    if (window.ymaps && typeof ymaps.ready === 'function') {
      ymaps.ready(setup);
    } else {
      toast('Yandex Maps API loaded but not initialized');
    }
  };

  script.onerror = () => {
    toast('Failed to load Yandex Maps');
  };

  document.head.appendChild(script);
}

function setup() {
  const cfg = window.TRANSTIME_CONFIG || {};
  const center = (cfg.map && cfg.map.center) || [55.751244, 37.618423];
  const zoom = (cfg.map && cfg.map.zoom) || 8;

  const container = document.getElementById('map');
  if (!container) return toast('Map container #map not found', 2500);

  map = new ymaps.Map(container, {
    center,
    zoom,
    controls: ['zoomControl', 'typeSelector']
  }, {
    suppressMapOpenBlock: true
  });

  if (ymaps.SuggestView) {
    setTimeout(() => {
      try {
        new ymaps.SuggestView('from');
        new ymaps.SuggestView('to');
      } catch (e) {
        console.warn('SuggestView failed:', e);
      }
    }, 0);
  }

  try {
    trafficControl = new ymaps.control.TrafficControl({
      state: { providerKey: 'traffic#actual', trafficShown: true, infoLayerShown: true }
    });
    map.controls.add(trafficControl, { float: 'right' });
  } catch (e) {
    console.warn('TrafficControl failed:', e);
  }

  try {
    const saved = localStorage.getItem('TT_MAP_VIEW');
    if (saved) {
      const v = JSON.parse(saved);
      if (Array.isArray(v.center) && typeof v.zoom === 'number') {
        map.setCenter(v.center, v.zoom);
      }
    }
    map.events.add('boundschange', () => {
      try {
        localStorage.setItem('TT_MAP_VIEW', JSON.stringify({
          center: map.getCenter(),
          zoom: map.getZoom()
        }));
      } catch {}
    });
  } catch {}
}