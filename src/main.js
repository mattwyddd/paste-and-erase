import './style.css';
import { initDB } from './storage.js';
import { initCanvas } from './canvas.js';
import { initEraser } from './eraser.js';

const appContent = document.getElementById('app-content');
const btnCanvas = document.getElementById('nav-canvas');
const btnEraser = document.getElementById('nav-eraser');

let currentRoute = 'canvas'; // 'canvas' | 'eraser'

async function init() {
  await initDB();
  
  // Set up initial view
  appContent.innerHTML = getCanvasHTML();
  initCanvas();

  btnCanvas.addEventListener('click', () => navigateTo('canvas'));
  btnEraser.addEventListener('click', () => navigateTo('eraser'));
  
  // Initialize slider position
  setTimeout(updateSlider, 100);
  window.addEventListener('resize', () => requestAnimationFrame(updateSlider));
}

function updateSlider() {
  const slider = document.getElementById('nav-slider');
  const activeBtn = document.querySelector('.nav-btn.active');
  const navLinks = document.getElementById('nav-links');
  
  if (slider && activeBtn && navLinks) {
    const w = activeBtn.offsetWidth;
    if (w > 0) {
      slider.style.width = `${w}px`;
      slider.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    }
  }
}

function getCanvasHTML() {
  return `
    <div id="canvas-view" class="view active">
      <div id="canvas-container"></div>
      <div class="fab-container">
        <label for="canvas-upload" class="fab-btn" title="Upload Image">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </label>
        <input type="file" id="canvas-upload" accept="image/*" style="display: none;" />
      </div>
    </div>
  `;
}

function getEraserHTML() {
  return `
    <div id="eraser-view" class="view active">
      <div id="wip-container" class="wip-container">
        <h1 class="wip-title">WIP</h1>
        <p class="wip-subtitle">SORRY!</p>
      </div>
      <div id="eraser-tool-container" style="display: none; flex-direction: column; align-items: center; width: 100%; gap: 2rem;">
        <div class="upload-area" id="eraser-dropzone">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-plus" style="color: var(--accent);"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" x2="22" y1="5" y2="5"/><line x1="19" x2="19" y1="2" y2="8"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          <div class="upload-text">Drag & drop or click to upload photo</div>
          <input type="file" id="eraser-file-input" accept="image/*" />
        </div>
        <div class="preview-container">
          <div class="preview-box" id="preview-original">
            <div class="preview-label">Original</div>
            <img id="img-original" style="display: none;" />
          </div>
          <div class="preview-box" id="preview-result">
            <div class="preview-label">Result</div>
            <img id="img-result" style="display: none;" />
          </div>
        </div>
        <div class="eraser-actions">
          <button class="btn-primary" id="btn-erase" disabled>Erase Background</button>
          <button class="btn-primary" id="btn-send-to-canvas" style="display: none;">Send to Canvas</button>
          <button class="btn-primary" id="btn-copy" style="display: none;">Copy Image</button>
          <button class="btn-primary" id="btn-download" style="display: none;">Download</button>
          <button class="btn-secondary" id="btn-clear" style="display: none;">Clear</button>
        </div>
      </div>
    </div>
  `;
}

async function navigateTo(route) {
  if (route === currentRoute) return;

  // View Transitions API
  if (!document.startViewTransition) {
    updateDOM(route);
  } else {
    document.startViewTransition(() => updateDOM(route));
  }
}

function updateDOM(route) {
  currentRoute = route;
  
  if (route === 'canvas') {
    btnCanvas.classList.add('active');
    btnEraser.classList.remove('active');
    appContent.innerHTML = getCanvasHTML();
    initCanvas();
  } else {
    btnEraser.classList.add('active');
    btnCanvas.classList.remove('active');
    appContent.innerHTML = getEraserHTML();
    initEraser();
  }
  
  updateSlider();
}

export function showLoader(text) {
  const loader = document.getElementById('global-loader');
  const textEl = document.getElementById('loader-text');
  textEl.innerText = text;
  loader.classList.remove('hidden');
}

export function hideLoader() {
  const loader = document.getElementById('global-loader');
  loader.classList.add('hidden');
}

// Global functions for eraser to call to send image to canvas
window.sendImageToCanvas = async (dataURL) => {
  await navigateTo('canvas');
  // Need to wait for next frame to ensure canvas is initialized
  requestAnimationFrame(() => {
    window.addImageToCanvas(dataURL);
  });
};

// Setup Live Clock
function updateClock() {
  const clockEl = document.getElementById('live-clock');
  if (!clockEl) return;
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateString = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
  clockEl.textContent = `${dateString} - ${timeString}`;
}
setInterval(updateClock, 1000);
updateClock();

init();
