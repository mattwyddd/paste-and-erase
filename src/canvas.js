import { saveImage, getAllImages, deleteImage, updateImage } from './storage.js';

let undoStack = [];

let container;
let view;
let isDragging = false;
let startX = 0, startY = 0;
let panX = 0, panY = 0;
let zoomScale = 1;

// Multi-touch variables
const activePointers = new Map();
let initialDistance = null;
let initialScale = 1;
let initialPanX = 0, initialPanY = 0;
let initialPinchCenter = { x: 0, y: 0 };

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
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('paste', handlePaste);
    eventsAttached = true;
  }
  
  // Attach Canvas Upload Listener
  const canvasUpload = document.getElementById('canvas-upload');
  if (canvasUpload) {
    canvasUpload.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        Array.from(e.target.files).forEach((file, index) => {
          const reader = new FileReader();
          const offset = index * 20;
          reader.onload = (event) => {
            addImageToCanvas(event.target.result, offset);
          };
          reader.readAsDataURL(file);
        });
      }
      e.target.value = ''; // Reset input
    });
  }

  // Expose function for eraser
  window.addImageToCanvas = addImageToCanvas;
  
  // Set initial transform
  updateTransform();
}

// Global Cmd+Z for canvas
window.addEventListener('keydown', async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    const activeBtn = document.querySelector('.nav-btn.active');
    if (activeBtn && activeBtn.innerText.toLowerCase().includes('ideas gallery')) {
      const lastId = undoStack.pop();
      if (lastId) {
        await deleteImage(lastId);
        const el = document.querySelector(`.canvas-item[data-id="${lastId}"]`);
        if (el) el.remove();
      }
    }
  }
});

function onPointerDown(e) {
  if (e.target !== view) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (activePointers.size === 1) {
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    view.style.cursor = 'grabbing';
  } else if (activePointers.size === 2) {
    isDragging = false; // Stop panning when pinching starts
    const pts = Array.from(activePointers.values());
    initialDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    initialScale = zoomScale;
    initialPinchCenter = {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2
    };
    initialPanX = panX;
    initialPanY = panY;
  }
}

function onPointerMove(e) {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (activePointers.size === 1 && isDragging) {
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateTransform();
  } else if (activePointers.size === 2) {
    const pts = Array.from(activePointers.values());
    const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    
    if (initialDistance && currentDist > 0) {
      const newScale = Math.min(Math.max(0.1, initialScale * (currentDist / initialDistance)), 5);
      
      const currentCenter = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2
      };

      const rect = view.getBoundingClientRect();
      const centerX = initialPinchCenter.x - rect.left;
      const centerY = initialPinchCenter.y - rect.top;

      const dx = (centerX - rect.width / 2) - initialPanX;
      const dy = (centerY - rect.height / 2) - initialPanY;

      // Calculate new pan to keep the pinch center anchored
      panX = initialPanX - dx * (newScale / initialScale - 1) + (currentCenter.x - initialPinchCenter.x);
      panY = initialPanY - dy * (newScale / initialScale - 1) + (currentCenter.y - initialPinchCenter.y);
      
      zoomScale = newScale;
      updateTransform();
    }
  }
}

function onPointerUp(e) {
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) {
    initialDistance = null;
  }
  if (activePointers.size === 1) {
    // Resume panning with the remaining finger
    const p = Array.from(activePointers.values())[0];
    startX = p.x - panX;
    startY = p.y - panY;
    isDragging = true;
  } else if (activePointers.size === 0) {
    isDragging = false;
  }
  view.style.cursor = 'grab';
}

function onWheel(e) {
  if (e.ctrlKey) {
    e.preventDefault();
    const zoomFactor = 1 - Math.sign(e.deltaY) * 0.1;
    const newScale = Math.min(Math.max(0.1, zoomScale * zoomFactor), 5);

    const rect = view.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Viewport center
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate dx and dy from the center, then adjust pan
    const dx = (mouseX - centerX) - panX;
    const dy = (mouseY - centerY) - panY;

    panX -= dx * (newScale / zoomScale - 1);
    panY -= dy * (newScale / zoomScale - 1);

    zoomScale = newScale;
    updateTransform();
  } else {
    // Scroll to pan
    panX -= e.deltaX;
    panY -= e.deltaY;
    updateTransform();
  }
}

function updateTransform() {
  if (container) {
    container.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoomScale})`;
  }
  if (view) {
    view.style.backgroundPosition = `calc(50% + ${panX}px) calc(50% + ${panY}px)`;
    const bgSize = 40 * zoomScale;
    view.style.backgroundSize = `${bgSize}px ${bgSize}px`;
  }
}

function renderImage(imgData) {
  const el = document.createElement('div');
  el.className = 'canvas-item';
  el.dataset.id = imgData.id;
  imgData.w = imgData.w || 360;
  imgData.h = imgData.h || 225;
  
  el.style.width = `${imgData.w}px`;
  el.style.height = `${imgData.h}px`;

  const updatePosition = () => {
    el.style.left = `${imgData.x - imgData.w / 2}px`;
    el.style.top = `${imgData.y - imgData.h / 2}px`;
  };
  updatePosition();

  // Custom Resize Handle logic
  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  
  let isMouseResizing = false;
  let startMouseW, startMouseH, startMouseX, startMouseY;
  
  const onMouseResizeMove = (e) => {
    if (!isMouseResizing) return;
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;
    
    // Scale symmetrically (multiply delta by 2 since center is anchored)
    imgData.w = Math.max(150, startMouseW + dx * 2);
    imgData.h = Math.max(100, startMouseH + dy * 2);
    
    el.style.width = `${imgData.w}px`;
    el.style.height = `${imgData.h}px`;
    updatePosition();
  };
  
  const onMouseResizeUp = async () => {
    if (isMouseResizing) {
      isMouseResizing = false;
      window.removeEventListener('pointermove', onMouseResizeMove);
      window.removeEventListener('pointerup', onMouseResizeUp);
      await updateImage(imgData.id, { w: imgData.w, h: imgData.h });
    }
  };
  
  handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    isMouseResizing = true;
    startMouseW = imgData.w;
    startMouseH = imgData.h;
    startMouseX = e.clientX;
    startMouseY = e.clientY;
    
    window.addEventListener('pointermove', onMouseResizeMove);
    window.addEventListener('pointerup', onMouseResizeUp);
  });
  
  el.appendChild(handle);

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
  };

  // Dragging or Resizing the item itself
  const itemPointers = new Map();
  let isDraggingItem = false;
  let isResizingItem = false;
  let itemStartX, itemStartY;
  let initialItemDist = null;
  let initialItemW = 0, initialItemH = 0;
  
  const onCardMove = (e) => {
    if (!itemPointers.has(e.pointerId)) return;
    itemPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (itemPointers.size === 1 && isDraggingItem) {
      imgData.x = e.clientX - itemStartX;
      imgData.y = e.clientY - itemStartY;
      updatePosition();
    } else if (itemPointers.size === 2 && isResizingItem) {
      const pts = Array.from(itemPointers.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (initialItemDist && currentDist > 0) {
        const scale = currentDist / initialItemDist;
        imgData.w = Math.max(150, initialItemW * scale);
        imgData.h = Math.max(100, initialItemH * scale);
        el.style.width = `${imgData.w}px`;
        el.style.height = `${imgData.h}px`;
        updatePosition(); // Keep image perfectly centered under fingers
      }
    }
  };

  const onCardUp = async (e) => {
    itemPointers.delete(e.pointerId);
    if (itemPointers.size < 2) {
      initialItemDist = null;
      if (isResizingItem) {
        isResizingItem = false;
        // Save the new size automatically
        await updateImage(imgData.id, { w: imgData.w, h: imgData.h });
      }
    }
    if (itemPointers.size === 1) {
      // Resume dragging with the remaining finger
      const p = Array.from(itemPointers.values())[0];
      itemStartX = p.x - imgData.x;
      itemStartY = p.y - imgData.y;
      isDraggingItem = true;
    } else if (itemPointers.size === 0) {
      if (isDraggingItem) {
        isDraggingItem = false;
        await updateImage(imgData.id, { x: imgData.x, y: imgData.y });
      }
      window.removeEventListener('pointermove', onCardMove);
      window.removeEventListener('pointerup', onCardUp);
      window.removeEventListener('pointercancel', onCardUp);
    }
  };

  el.addEventListener('pointerdown', (e) => {
    // Let our custom resize handle deal with it, do NOT block it
    if (e.target === handle || e.target === input || e.target === menuBtn || menu.contains(e.target) || e.target === btnConfirmResize) return;

    e.stopPropagation(); // Stop canvas from panning
    itemPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (itemPointers.size === 1) {
      isDraggingItem = true;
      itemStartX = e.clientX - imgData.x;
      itemStartY = e.clientY - imgData.y;
      
      window.addEventListener('pointermove', onCardMove);
      window.addEventListener('pointerup', onCardUp);
      window.addEventListener('pointercancel', onCardUp);
    } else if (itemPointers.size === 2) {
      isDraggingItem = false;
      isResizingItem = true;
      const pts = Array.from(itemPointers.values());
      initialItemDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialItemW = el.offsetWidth;
      initialItemH = el.offsetHeight;
    }
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
  let pasteOffsetCount = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      const reader = new FileReader();
      const offset = pasteOffsetCount * 20;
      pasteOffsetCount++;
      reader.onload = (event) => {
        addImageToCanvas(event.target.result, offset);
      };
      reader.readAsDataURL(blob);
    }
  }
}

async function addImageToCanvas(dataURL, offset = 0) {
  const id = crypto.randomUUID();
  // The canvas-container is already centered at 50% 50%.
  // To paste in the visual center, we just offset by the current pan, plus any cascading offset for multiple images
  const x = -panX + offset;
  const y = -panY + offset;
  
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
