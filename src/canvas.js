import { saveImage, getAllImages, deleteImage, updateImage } from './storage.js';

let container;
let view;
let isPanning = false;
let startX = 0, startY = 0;
let panX = 0, panY = 0;

let eventsAttached = false;

export async function initCanvas() {
  view = document.getElementById('canvas-view');
  container = document.getElementById('canvas-container');

  if (!view || !container) return;

  // Render existing images
  const images = await getAllImages();
  images.forEach(imgData => renderImage(imgData));

  // Event Listeners for Panning
  view.addEventListener('pointerdown', onPointerDown);
  
  if (!eventsAttached) {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('paste', handlePaste);
    eventsAttached = true;
  }
  
  // Expose function for eraser
  window.addImageToCanvas = addImageToCanvas;
  
  // Set initial transform
  updateTransform();
}

function onPointerDown(e) {
  if (e.target.closest('.canvas-item')) return; // Ignore if clicking an item (unless we add dragging items later)
  if (e.button !== 0) return; // Only left click
  isPanning = true;
  startX = e.clientX - panX;
  startY = e.clientY - panY;
  view.style.cursor = 'grabbing';
}

function onPointerMove(e) {
  if (!isPanning) return;
  panX = e.clientX - startX;
  panY = e.clientY - startY;
  updateTransform();
}

function onPointerUp(e) {
  isPanning = false;
  view.style.cursor = 'grab';
}

function onWheel(e) {
  if (e.ctrlKey) {
    // Zoom handling could go here
    e.preventDefault();
  } else {
    // Scroll to pan
    panX -= e.deltaX;
    panY -= e.deltaY;
    updateTransform();
  }
}

function updateTransform() {
  if (container) {
    container.style.transform = `translate3d(${panX}px, ${panY}px, 0)`;
  }
  if (view) {
    view.style.backgroundPosition = `${panX}px ${panY}px`;
  }
}

function renderImage(imgData) {
  const el = document.createElement('div');
  el.className = 'canvas-item';
  el.dataset.id = imgData.id;
  // Center the image around its x,y coords. Adjust for the 360x225 size.
  el.style.left = `${imgData.x - 180}px`;
  el.style.top = `${imgData.y - 112.5}px`;

  if (imgData.w) el.style.width = `${imgData.w}px`;
  if (imgData.h) el.style.height = `${imgData.h}px`;

  // Inner wrapper for hover effect matching Godly
  const inner = document.createElement('div');
  inner.className = 'canvas-item-inner';

  const img = document.createElement('img');
  img.src = imgData.dataURL;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'label-input';
  input.value = imgData.label || '';
  input.placeholder = 'Add a label...';
  
  input.addEventListener('change', async (e) => {
    await updateImage(imgData.id, { label: e.target.value });
  });

  const menuBtn = document.createElement('button');
  menuBtn.className = 'menu-btn';
  menuBtn.innerHTML = '⋮';

  const menu = document.createElement('div');
  menu.className = 'card-menu';

  const btnRemove = document.createElement('button');
  btnRemove.innerText = 'Remove';
  btnRemove.onclick = async (e) => {
    e.stopPropagation();
    await deleteImage(imgData.id);
    el.remove();
  };

  const btnResize = document.createElement('button');
  btnResize.innerText = 'Resize';
  btnResize.onclick = (e) => {
    e.stopPropagation();
    el.classList.add('resize-mode');
    btnConfirmResize.style.display = 'block';
    menu.classList.remove('open');
  };

  const btnSwap = document.createElement('button');
  btnSwap.innerText = 'Swap';
  btnSwap.onclick = (e) => {
    e.stopPropagation();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (ev) => {
      if (ev.target.files && ev.target.files[0]) {
        const reader = new FileReader();
        reader.onload = async (re) => {
          imgData.dataURL = re.target.result;
          img.src = imgData.dataURL;
          await updateImage(imgData.id, { dataURL: imgData.dataURL });
        };
        reader.readAsDataURL(ev.target.files[0]);
      }
    };
    input.click();
    menu.classList.remove('open');
  };

  menu.appendChild(btnRemove);
  menu.appendChild(btnResize);
  menu.appendChild(btnSwap);

  menuBtn.onclick = (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  };

  // Close menu when clicking outside
  window.addEventListener('pointerdown', (e) => {
    if (!menu.contains(e.target) && e.target !== menuBtn) {
      menu.classList.remove('open');
    }
  });

  const btnConfirmResize = document.createElement('button');
  btnConfirmResize.className = 'confirm-resize-btn';
  btnConfirmResize.innerText = 'Save Size ✓';
  btnConfirmResize.style.display = 'none';
  btnConfirmResize.onclick = async (e) => {
    e.stopPropagation();
    el.classList.remove('resize-mode');
    btnConfirmResize.style.display = 'none';
    imgData.w = el.offsetWidth;
    imgData.h = el.offsetHeight;
    await updateImage(imgData.id, { w: imgData.w, h: imgData.h });
  };

  // Dragging the item itself
  let isDraggingItem = false;
  let itemStartX, itemStartY;
  
  const onCardMove = (e) => {
    if (!isDraggingItem) return;
    imgData.x = e.clientX - itemStartX;
    imgData.y = e.clientY - itemStartY;
    el.style.left = `${imgData.x - 180}px`;
    el.style.top = `${imgData.y - 112.5}px`;
  };

  const onCardUp = async () => {
    if (isDraggingItem) {
      isDraggingItem = false;
      await updateImage(imgData.id, { x: imgData.x, y: imgData.y });
      window.removeEventListener('pointermove', onCardMove);
      window.removeEventListener('pointerup', onCardUp);
    }
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.target === input || e.target === menuBtn || menu.contains(e.target) || e.target === btnConfirmResize) return;
    
    // Check if clicking near bottom right for resize handle (within 20px)
    const rect = el.getBoundingClientRect();
    if (el.classList.contains('resize-mode') && e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) {
      return; // Let native CSS resize happen
    }

    isDraggingItem = true;
    itemStartX = e.clientX - imgData.x;
    itemStartY = e.clientY - imgData.y;
    e.stopPropagation(); // Stop canvas from panning
    
    window.addEventListener('pointermove', onCardMove);
    window.addEventListener('pointerup', onCardUp);
  });

  inner.appendChild(img);
  inner.appendChild(input);
  inner.appendChild(menuBtn);
  inner.appendChild(menu);
  inner.appendChild(btnConfirmResize);
  el.appendChild(inner);
  container.appendChild(el);

  // Entry animation
  el.style.opacity = '0';
  el.style.transform = 'scale(0.8)';
  requestAnimationFrame(() => {
    el.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    el.style.opacity = '1';
    el.style.transform = 'scale(1)';
    // Remove transition after it completes to not interfere with hover scale
    setTimeout(() => {
        el.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
    }, 400);
  });
}

async function handlePaste(e) {
  // Only handle paste if we are on canvas view
  if (!document.getElementById('canvas-view')) return;

  const items = e.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      const reader = new FileReader();
      reader.onload = (event) => {
        addImageToCanvas(event.target.result);
      };
      reader.readAsDataURL(blob);
      break; // Only process the first image
    }
  }
}

async function addImageToCanvas(dataURL) {
  const id = crypto.randomUUID();
  // The canvas-container is already centered at 50% 50%.
  // To paste in the visual center, we just offset by the current pan.
  const x = -panX;
  const y = -panY;
  
  const newImg = {
    id,
    dataURL,
    x,
    y,
    label: ''
  };

  await saveImage(newImg);
  renderImage(newImg);
}
