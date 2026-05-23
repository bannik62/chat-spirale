import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { logAction } from './lib/debugLog.js';

logAction('App', 'bootstrap');
mount(App, { target: document.getElementById('app') });
