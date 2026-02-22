// ============================================================================
// LEARNING: This is the entry point of the React application
// 
// Every React app needs a root element where the entire application mounts
// This file finds that element and renders the App component into it
// 
// Think of it like the "starting line" - everything else builds from here
// ============================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Find the <div id="root"></div> in your HTML file and render the App there
const root = ReactDOM.createRoot(document.getElementById('root'));

// ============================================================================
// LEARNING: React.StrictMode is a development tool that highlights potential
// problems in the application. It runs additional checks and warnings but
// doesn't affect the production build.
// ============================================================================

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);