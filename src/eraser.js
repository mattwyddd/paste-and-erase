import { removeBackground } from '@imgly/background-removal';
import { showLoader, hideLoader } from './main.js';

let currentFile = null;
let resultDataURL = null;

export function initEraser() {
  const dropzone = document.getElementById('eraser-dropzone');
  const fileInput = document.getElementById('eraser-file-input');
  const btnErase = document.getElementById('btn-erase');
  const btnSend = document.getElementById('btn-send-to-canvas');
  const btnCopy = document.getElementById('btn-copy');
  const btnDownload = document.getElementById('btn-download');
  const btnClear = document.getElementById('btn-clear');

  if (!dropzone) return;

  // Drag & Drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // Click to upload
  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  // Easter egg
  window.addEventListener('keydown', handleEasterEgg);
  
  // Eraser Undo
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      const eraserView = document.getElementById('eraser-view');
      const wip = document.getElementById('wip-container');
      
      // If we are on eraser tab, and the tool is visible
      if (eraserView && wip && wip.style.display === 'none') {
        const btnClear = document.getElementById('btn-clear');
        if (btnClear && btnClear.style.display !== 'none') {
          btnClear.click();
        }
      }
    }
  });

  // Paste support in eraser page
  window.addEventListener('paste', handleEraserPaste);

  // Erase button
  btnErase.addEventListener('click', processImage);

  // Send to canvas button
  btnSend.addEventListener('click', () => {
    if (resultDataURL) {
      window.sendImageToCanvas(resultDataURL);
    }
  });

  btnDownload.addEventListener('click', () => {
    if (!resultDataURL) return;
    const a = document.createElement('a');
    a.href = resultDataURL;
    a.download = 'erased_background.png';
    a.click();
  });

  btnCopy.addEventListener('click', async () => {
    if (!resultDataURL) return;
    try {
      const res = await fetch(resultDataURL);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      const oldText = btnCopy.innerText;
      btnCopy.innerText = 'Copied!';
      setTimeout(() => btnCopy.innerText = oldText, 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      alert('Could not copy image. Your browser might not support copying images directly.');
    }
  });

  btnClear.addEventListener('click', () => {
    currentFile = null;
    resultDataURL = null;
    document.getElementById('img-original').style.display = 'none';
    document.getElementById('img-result').style.display = 'none';
    document.getElementById('btn-erase').disabled = true;
    btnSend.style.display = 'none';
    btnCopy.style.display = 'none';
    btnDownload.style.display = 'none';
    btnClear.style.display = 'none';
    fileInput.value = ''; // Reset file input
  });
}

function handleEraserPaste(e) {
  if (!document.getElementById('eraser-view')) return; // Ensure we are on the eraser view
  
  const items = e.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile();
      handleFile(file);
      break;
    }
  }
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file.');
    return;
  }
  currentFile = file;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const imgOriginal = document.getElementById('img-original');
    imgOriginal.src = e.target.result;
    imgOriginal.style.display = 'block';
    
    // Reset result
    document.getElementById('img-result').style.display = 'none';
    document.getElementById('btn-send-to-canvas').style.display = 'none';
    document.getElementById('btn-copy').style.display = 'none';
    document.getElementById('btn-download').style.display = 'none';
    document.getElementById('btn-clear').style.display = 'inline-block';
    
    // Enable erase button
    document.getElementById('btn-erase').disabled = false;
  };
  reader.readAsDataURL(file);
}

async function processImage() {
  if (!currentFile) return;

  showLoader('Erasing your image... this may take a moment.');
  document.getElementById('btn-erase').disabled = true;

  // iOS strict memory limit workaround: use 'small' on iOS, 'medium' everywhere else
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const selectedModel = isIOS ? 'small' : 'medium';

  try {
    const imageBlob = await removeBackground(currentFile, {
      model: selectedModel,
      progress: (key, current, total) => {
        // Silent progress
      }
    });

    const reader = new FileReader();
    reader.onload = (e) => {
      resultDataURL = e.target.result;
      const imgResult = document.getElementById('img-result');
      imgResult.src = resultDataURL;
      imgResult.style.display = 'block';
      
      document.getElementById('btn-send-to-canvas').style.display = 'inline-block';
      document.getElementById('btn-copy').style.display = 'inline-block';
      document.getElementById('btn-download').style.display = 'inline-block';
    };
    reader.readAsDataURL(imageBlob);

  } catch (err) {
    console.error('Error removing background:', err);
    alert('Failed to remove background. See console for details.');
  } finally {
    hideLoader();
    document.getElementById('btn-erase').disabled = false;
  }
}

function handleEasterEgg(e) {
  if (!document.getElementById('eraser-view')) return;
  
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    const wip = document.getElementById('wip-container');
    const tool = document.getElementById('eraser-tool-container');
    if (wip && tool && wip.style.display !== 'none') {
      wip.style.display = 'none';
      tool.style.display = 'flex';
      // Optional: Prevent default copy behavior just for the trigger
      e.preventDefault(); 
    }
  }
}

// Cleanup global event listener when unmounting (not strictly necessary for SPA, but good practice)
export function destroyEraser() {
  window.removeEventListener('paste', handleEraserPaste);
  window.removeEventListener('keydown', handleEasterEgg);
}
