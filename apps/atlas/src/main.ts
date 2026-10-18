// Fonts are bundled so the dashboard renders the same offline.
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/sora/300.css';
import '@fontsource/sora/400.css';
import '@fontsource/sora/600.css';
import './app.css';
import { mount } from 'svelte';

import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('#app is missing from index.html');

mount(App, { target });
