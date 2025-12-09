import { CONFIG, FILE_TYPES } from './config.js';
const SUPPORTED_FILE_MIMES = FILE_TYPES.MIMES;
const SUPPORTED_FILE_EXTENSIONS = FILE_TYPES.EXTENSIONS;
const SUPPORTED_FILES_STRING = SUPPORTED_FILE_EXTENSIONS.join(', ');
function displayError(message) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}
let storedFiles = null;
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
function updateFolderStats(files, validFiles) {
    const folderStats = document.getElementById('folder-stats');
    const totalFiles = document.getElementById('total-files');
    const validFilesEl = document.getElementById('valid-files');
    const totalSize = document.getElementById('total-size');
    const fileTypes = document.getElementById('file-types');
    let size = 0;
    for (const file of validFiles) {
        size += file.size;
    }
    const types = new Set();
    for (const file of validFiles) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        types.add(ext);
    }
    totalFiles.textContent = files.length;
    validFilesEl.textContent = validFiles.length;
    totalSize.textContent = formatFileSize(size);
    fileTypes.textContent = Array.from(types).join(', ') || 'None';
    folderStats.classList.add('hidden');
}
async function processFiles(files) {
    const fileInput = document.getElementById('upload-input');
    const dropzonePrompt = document.getElementById('dropzone-prompt');
    const fileListContainer = document.getElementById('file-list-container');
    const fileList = document.getElementById('file-list');
    document.getElementById('error-message').style.display = 'none';
    if (files.length === 0) {
        dropzonePrompt.classList.remove('hidden');
        fileListContainer.classList.add('hidden');
        return;
    }
    if (files.length > 100) {
        dropzonePrompt.textContent = '';
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'flex flex-col items-center justify-center';
        const spinner = document.createElement('div');
        spinner.className = 'spinner w-12 h-12 border-3 border-gray-200 border-t-custom-button rounded-full animate-spin mb-4';
        const text = document.createElement('p');
        text.className = 'text-xl';
        text.textContent = `Processing ${files.length} files...`;
        loadingDiv.appendChild(spinner);
        loadingDiv.appendChild(text);
        dropzonePrompt.appendChild(loadingDiv);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
    const filesArray = Array.from(files);
    let validFiles = [];
    let invalidFiles = [];
    for (const file of filesArray) {
        const isValidMime = SUPPORTED_FILE_MIMES.includes(file.type);
        const isValidExtension = SUPPORTED_FILE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(`.${ext}`));
        if (isValidMime || isValidExtension) {
            validFiles.push(file);
        } else {
            invalidFiles.push(file.name);
        }
    }
    if (invalidFiles.length > 0) {
        const warningMsg = `Skipping ${invalidFiles.length} unsupported file(s). Only ${SUPPORTED_FILES_STRING} files will be processed.`;
        displayError(warningMsg);
    }
    if (validFiles.length === 0) {
        const errorMsg = `No valid files found. Please upload ${SUPPORTED_FILES_STRING} files.`;
        displayError(errorMsg);
        fileInput.value = '';
        dropzonePrompt.textContent = ''; // Clear existing content
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'w-20 h-20 opacity-80');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('stroke-width', '1.5');
        svg.setAttribute('stroke', 'currentColor');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('d', 'M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z');
        svg.appendChild(path);
        const title = document.createElement('p');
        title.id = 'dropzone-title';
        title.className = 'text-2xl md:text-3xl font-medium mt-6';
        title.textContent = 'Drop files here or click to browse';
        const subtitle = document.createElement('p');
        subtitle.className = 'text-lg md:text-xl opacity-60 mt-3';
        subtitle.textContent = 'Supports .docx, .md, .txt, .pdf';
        dropzonePrompt.appendChild(svg);
        dropzonePrompt.appendChild(title);
        dropzonePrompt.appendChild(subtitle);
        dropzonePrompt.classList.remove('hidden');
        fileListContainer.classList.add('hidden');
        return;
    }
    updateFolderStats(filesArray, validFiles);
    fileList.innerHTML = ''; // Clear previous list
    const displayLimit = 50;
    const displayFiles = validFiles.slice(0, displayLimit);
    const fragment = document.createDocumentFragment();
    for (const file of displayFiles) {
        const li = document.createElement('li');
        li.className = 'break-words py-1.5 px-2 rounded hover:bg-gray-700 transition-colors';
        const filenameSpan = document.createElement('span');
        filenameSpan.className = 'font-medium text-white text-xs';
        const displayName = file.webkitRelativePath || file.name;
        const ext = displayName.split('.').pop().toLowerCase();
        let icon = '📄';
        if (ext === 'md') icon = '📝';
        else if (ext === 'txt') icon = '📃';
        else if (ext === 'docx' || ext === 'doc') icon = '📘';
        else if (ext === 'pdf') icon = '📕';
        filenameSpan.textContent = `${icon} ${displayName}`;
        li.appendChild(filenameSpan);
        if (file.size) {
            const sizeSpan = document.createElement('span');
            sizeSpan.className = 'ml-2 text-xs text-gray-400';
            sizeSpan.textContent = `(${formatFileSize(file.size)})`;
            li.appendChild(sizeSpan);
        }
        li.title = displayName; // Show full name on hover
        fragment.appendChild(li);
    }
    if (validFiles.length > displayLimit) {
        const li = document.createElement('li');
        li.className = 'font-semibold text-custom-button text-xs';
        li.textContent = `... and ${validFiles.length - displayLimit} more file(s)`;
        fragment.appendChild(li);
    }
    fileList.appendChild(fragment);
    const dataTransfer = new DataTransfer();
    for (const file of validFiles) {
        dataTransfer.items.add(file);
    }
    storedFiles = dataTransfer.files;
    dropzonePrompt.classList.add('hidden');
    fileListContainer.classList.remove('hidden');
}
document.addEventListener("DOMContentLoaded", () => {
  const ganttForm = document.getElementById('gantt-form');
  const uploadInput = document.getElementById('upload-input');
  const dropzoneLabel = document.querySelector('.dropzone-glass');
  if (!ganttForm || !uploadInput || !dropzoneLabel) {
    console.error('Missing elements:', {
      ganttForm: !!ganttForm,
      uploadInput: !!uploadInput,
      dropzoneLabel: !!dropzoneLabel
    });
    alert('Error: Page elements not loaded correctly. Please clear your browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete) and reload the page.');
    return;
  }
  ganttForm.addEventListener('submit', handleChartGenerate);
  uploadInput.addEventListener('change', (e) => {
    processFiles(e.target.files);
  });
  ['dragenter', 'dragover', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });
  dropzoneLabel.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }
    dropzoneLabel.classList.remove('border-white');
    dropzoneLabel.classList.add('border-custom-outline');
  }, false);
  dropzoneLabel.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzoneLabel.classList.add('border-white');
    dropzoneLabel.classList.remove('border-custom-outline');
  });
  dropzoneLabel.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  dropzoneLabel.addEventListener('dragleave', (event) => {
    if (!dropzoneLabel.contains(document.elementFromPoint(event.clientX, event.clientY))) {
        dropzoneLabel.classList.remove('border-white');
        dropzoneLabel.classList.add('border-custom-outline');
    }
  });
});
async function pollForPhase2Content(sessionId, viewType, generateBtn) {
  const POLL_INTERVAL = 2000; // Poll every 2 seconds
  const MAX_ATTEMPTS = 300; // 5 minutes maximum (300 seconds)
  let attempts = 0;
  let isPolling = false; // Prevent concurrent polls
  const poll = async () => {
    if (isPolling) {
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      throw new Error('Content generation timed out after 5 minutes. Please try again.');
    }
    isPolling = true;
    attempts++;
    try {
      const response = await fetch(`/api/content/${sessionId}/${viewType}`);
      if (!response.ok) {
        let errorText = `Server error: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const err = await response.json();
            errorText = err.message || err.error || errorText;
            if (err.hint) {
            }
          } else {
            const text = await response.text();
            errorText = text.substring(0, 200) || errorText;
          }
        } catch (parseError) {
        }
        throw new Error(errorText);
      }
      const content = await response.json();
      if (generateBtn) {
        generateBtn.textContent = `Generating ${viewType}... (${attempts}s)`;
      }
      if (content.status === 'completed') {
        return content.data; // Return the content data
      } else if (content.status === 'error' || content.status === 'failed') {
        throw new Error(content.error || `${viewType} generation failed with unknown error`);
      } else if (content.status === 'processing' || content.status === 'pending') {
        isPolling = false;
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        return await poll(); // Recursive call
      } else {
        throw new Error(`Unknown content status: ${content.status}`);
      }
    } catch (error) {
      isPolling = false;
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        return await poll(); // Retry
      }
      throw error;
    }
  };
  return await poll();
}
async function handleChartGenerate(event) {
  event.preventDefault(); // Stop form from reloading page
  const generateBtn = document.getElementById('generate-btn');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorMessage = document.getElementById('error-message');
  const chartOutput = document.getElementById('chart-output');
  if (generateBtn.disabled) return; // Already processing
  generateBtn.disabled = true;
  const originalBtnText = generateBtn.textContent;
  generateBtn.textContent = 'Generating...';
  let elapsedSeconds = 0;
  let progressInterval = null;
  const formatElapsed = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };
  const startProgressTimer = () => {
    progressInterval = setInterval(() => {
      elapsedSeconds++;
      generateBtn.textContent = `Generating... (${formatElapsed(elapsedSeconds)})`;
    }, 1000);
  };
  const stopProgressTimer = () => {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  };
  try {
    const promptInput = document.getElementById('prompt-input');
    const uploadInput = document.getElementById('upload-input');
    if (!uploadInput || !promptInput) {
      displayError('Error: Page not loaded correctly. Please clear your browser cache and reload.');
      return;
    }
    const filesToProcess = storedFiles || uploadInput.files;
    if (filesToProcess.length === 0) {
      displayError('Error: Please upload at least one research document.');
      return; // Will re-enable button in finally block
    }
    if (!promptInput.value.trim()) {
      displayError('Error: Please provide project instructions in the prompt.');
      return; // Will re-enable button in finally block
    }
    const validFiles = [];
    for (const file of filesToProcess) {
      const isValidMime = SUPPORTED_FILE_MIMES.includes(file.type);
      const isValidExtension = SUPPORTED_FILE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(`.${ext}`));
      if (isValidMime || isValidExtension) {
        validFiles.push(file);
      }
    }
    if (validFiles.length === 0) {
      displayError(`Error: No valid files to process. Please upload ${SUPPORTED_FILES_STRING} files.`);
      return; // Will re-enable button in finally block
    }
    const formData = new FormData();
    formData.append('prompt', promptInput.value);
    for (const file of validFiles) {
      formData.append('researchFiles', file);
    }
    loadingIndicator.style.display = 'flex';
    errorMessage.style.display = 'none';
    chartOutput.innerHTML = ''; // Clear old chart
    startProgressTimer();
    const response = await fetch('/api/content/generate', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      let errorText = `Server error: ${response.status}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const err = await response.json();
          errorText = err.error || errorText;
        } else {
          const text = await response.text();
          errorText = text.substring(0, 200) || errorText; // Limit error length
        }
      } catch (parseError) {
      }
      throw new Error(errorText);
    }
    const generationResponse = await response.json();
    const sessionId = generationResponse.sessionId;
    if (!sessionId) {
      throw new Error('Server did not return a session ID');
    }
    const ganttData = await pollForPhase2Content(sessionId, 'roadmap', generateBtn);
    if (!ganttData || typeof ganttData !== 'object') {
      throw new Error('Invalid chart data structure: Expected object, received ' + typeof ganttData);
    }
    if (!ganttData.timeColumns) {
      throw new Error('Invalid chart data structure: Missing timeColumns field');
    }
    if (!Array.isArray(ganttData.timeColumns)) {
      throw new Error('Invalid chart data structure: timeColumns is not an array (type: ' + typeof ganttData.timeColumns + ')');
    }
    if (!ganttData.data) {
      throw new Error('Invalid chart data structure: Missing data field');
    }
    if (!Array.isArray(ganttData.data)) {
      throw new Error('Invalid chart data structure: data is not an array (type: ' + typeof ganttData.data + ')');
    }
    if (ganttData.timeColumns.length === 0 || ganttData.data.length === 0) {
      throw new Error('The AI was unable to find any tasks or time columns in the provided documents. Please check your files or try a different prompt.');
    }
    window.open(`/viewer.html?sessionId=${sessionId}#roadmap`, '_blank');
  } catch (error) {
    errorMessage.textContent = `Error: ${error.message}`;
    errorMessage.style.display = 'block';
  } finally {
    stopProgressTimer();
    generateBtn.disabled = false;
    generateBtn.textContent = originalBtnText;
    loadingIndicator.style.display = 'none';
  }
}