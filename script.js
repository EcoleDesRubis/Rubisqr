// DOM Elements
const video = document.getElementById('video');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const toggleCameraBtn = document.getElementById('toggle-camera');
const flashToggleBtn = document.getElementById('flash-toggle');
const cameraSelect = document.getElementById('camera-select');
const resultText = document.getElementById('result-text');
const scanTime = document.getElementById('scan-time');
const scanType = document.getElementById('scan-type');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');
const toast = document.getElementById('toast');

// Popup elements
const linkPopup = document.getElementById('link-popup');
const popupUrl = document.getElementById('popup-url');
const popupOpenBtn = document.getElementById('popup-open');
const popupCopyBtn = document.getElementById('popup-copy');
const popupCloseBtn = document.getElementById('popup-close');
const closePopupBtn = document.querySelector('.close-popup');

// Global variables
let stream = null;
let cameras = [];
let currentCameraIndex = 0;
let scanning = false;
let scanInterval = null;
let flashEnabled = false;
let currentQRData = null;
let scanHistory = JSON.parse(localStorage.getItem('qrScanHistory')) || [];

// Initialize
function init() {
    loadCameras();
    updateHistoryDisplay();
    updateStatus('ready');
    setupEventListeners();
}

// Load available cameras
async function loadCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameras = devices.filter(device => device.kind === 'videoinput');
        
        cameraSelect.innerHTML = '<option value="">Sélectionner une caméra</option>';
        cameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = index;
            // Clean up camera label for privacy
            const label = camera.label.replace(/\(.*?\)/g, '').trim();
            option.text = label || `Caméra ${index + 1}`;
            cameraSelect.appendChild(option);
        });
        
        if (cameras.length > 0) {
            cameraSelect.value = currentCameraIndex;
        }
    } catch (error) {
        console.error('Error loading cameras:', error);
        showToast('Erreur de chargement des caméras', 'error');
    }
}

// Update status indicator
function updateStatus(status) {
    statusDot.className = 'status-dot';
    switch(status) {
        case 'ready':
            statusDot.classList.add('inactive');
            statusText.textContent = 'Prêt';
            break;
        case 'scanning':
            statusDot.classList.add('scanning');
            statusText.textContent = 'Scan en cours...';
            break;
        case 'success':
            statusDot.classList.add('success');
            statusText.textContent = 'QR détecté!';
            setTimeout(() => updateStatus('scanning'), 2000);
            break;
        case 'error':
            statusDot.classList.add('error');
            statusText.textContent = 'Erreur';
            break;
    }
}
