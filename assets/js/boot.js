// boot.js - app entry point
import './core.js';
import { init } from './map.js';
import { initUI } from './ui.js';
import { loadSavedRoutes, renderSavedRoutes } from './storage.js';

window.routes = {};
init();