// DOM Elements
const video = document.getElementById('video');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const toggleCameraBtn = document.getElementById('toggle-camera');
const flashToggleBtn = document.getElementById('flash-toggle');
const cameraSelect = document.getElementById('camera-select');
const currentResult = document.getElementById('current-result');
const resultStatus = document.getElementById('result-status');
const currentTime = document.getElementById('current-time');
const scanCounter = document.getElementById('scan-counter');
const linkCounter = document.getElementById('link-counter');
const linksCount = document.getElementById('links-count');
const scanIndicator = document.getElementById('scan-indicator');
const autoOpenStatus = document.getElementById('auto-open-status');
const resultsList = document.getElementById('results-list');

// Popup elements
const linkConfirmPopup = document.getElementById('link-confirm-popup');
const confirmUrl = document.getElementById('confirm-url');
const countdownNumber = document.getElementById('countdown-number');
const confirmOpenNowBtn = document.getElementById('confirm-open-now');
const confirmCancelBtn = document.getElementById('confirm-cancel');

// Auto-open settings
const openDelaySlider = document.getElementById('open-delay');
const delayValue = document.getElementById('delay-value');
const soundToggle = document.getElementById('sound-toggle');
const toggleAutoOpenBtn = document.getElementById('toggle-auto-open');

// Audio elements
const scanSound = document.getElementById('scan-sound');
const linkSound = document.getElementById('link-sound');

// Global variables
let stream = null;
let cameras = [];
let currentCameraIndex = 0;
let scanning = false;
let scanInterval = null;
let flashEnabled = false;
let autoOpenEnabled = true;
let countdownInterval = null;
let currentCountdown = 3;
let pendingLink = null;
let scanHistory = JSON.parse(localStorage.getItem('qrScanHistory')) || [];
let linkHistory = JSON.parse(localStorage.getItem('qrLinkHistory')) || [];

// Initialize
function init() {
    loadCameras();
    updateStats();
    setupEventListeners();
    updateAutoOpenSettings();
}

// Load available cameras
async function loadCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameras = devices.filter(device => device.kind === 'videoinput');
        
        cameraSelect.innerHTML = '<option value="">Choisir une caméra...</option>';
        cameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = index;
            const label = camera.label.replace(/\(.*?\)/g, '').trim();
            option.text = label || `Caméra ${index + 1}`;
            cameraSelect.appendChild(option);
        });
        
        if (cameras.length > 0) {
            cameraSelect.value = currentCameraIndex;
        }
    } catch (error) {
        console.error('Erreur de chargement des caméras:', error);
    }
}

// Start camera
async function startCamera() {
    try {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: {
                deviceId: cameras[currentCameraIndex]?.deviceId ? 
                    { exact: cameras[currentCameraIndex].deviceId } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment'
            }
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        // Enable flash if available
        if (stream.getVideoTracks()[0]) {
            const track = stream.getVideoTracks()[0];
            try {
                await track.applyConstraints({
                    advanced: [{ torch: flashEnabled }]
                });
            } catch (e) {
                console.log('Flash non supporté');
            }
        }
        
        scanning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        toggleCameraBtn.disabled = false;
        flashToggleBtn.disabled = false;
        
        scanIndicator.style.backgroundColor = '#10b981';
        resultStatus.textContent = 'Scan en cours...';
        
        startScanning();
        
    } catch (error) {
        console.error('Erreur de démarrage de la caméra:', error);
        currentResult.textContent = `Erreur: ${error.message}`;
        resultStatus.textContent = 'Échec du démarrage';
        scanIndicator.style.backgroundColor = '#ef4444';
    }
}

// Start scanning for QR codes
function startScanning() {
    if (scanInterval) clearInterval(scanInterval);
    
    scanInterval = setInterval(async () => {
        if (!scanning || !video.videoWidth) return;
        
        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Decode QR code
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (code) {
                handleQRCodeDetected(code.data);
            }
            
        } catch (error) {
            console.error('Erreur de scan:', error);
        }
    }, 300); // Scan every 300ms
}

// Handle detected QR code
function handleQRCodeDetected(data) {
    if (!data) return;
    
    // Play scan sound
    if (soundToggle.checked) {
        scanSound.currentTime = 0;
        scanSound.play().catch(e => console.log('Audio non joué:', e));
    }
    
    // Update display
    currentResult.textContent = data;
    currentTime.textContent = new Date().toLocaleTimeString();
    scanIndicator.style.backgroundColor = '#f59e0b';
    
    // Add to history
    addToHistory(data);
    
    // Check if it's a URL
    if (isValidUrl(data)) {
        handleLinkDetected(data);
    } else {
        resultStatus.textContent = 'Texte détecté';
        scanIndicator.style.backgroundColor = '#10b981';
    }
}

// Handle detected link
function handleLinkDetected(url) {
    // Add to link history
    addToLinkHistory(url);
    
    // Update stats
    updateStats();
    
    // Play link sound
    if (soundToggle.checked) {
        linkSound.currentTime = 0;
        linkSound.play().catch(e => console.log('Audio non joué:', e));
    }
    
    resultStatus.textContent = 'Lien détecté!';
    scanIndicator.style.backgroundColor = '#3b82f6';
    
    // Auto-open if enabled
    if (autoOpenEnabled) {
        showLinkConfirmPopup(url);
    }
}

// Show link confirmation popup with countdown
function showLinkConfirmPopup(url) {
    pendingLink = url;
    confirmUrl.textContent = url;
    currentCountdown = parseInt(openDelaySlider.value);
    countdownNumber.textContent = currentCountdown;
    
    linkConfirmPopup.classList.add('active');
    
    // Start countdown
    countdownInterval = setInterval(() => {
        currentCountdown--;
        countdownNumber.textContent = currentCountdown;
        
        if (currentCountdown <= 0) {
            clearInterval(countdownInterval);
            openLink(url);
        }
    }, 1000);
}

// Open link in new tab
function openLink(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
    linkConfirmPopup.classList.remove('active');
    clearInterval(countdownInterval);
    
    // Update status
    resultStatus.textContent = 'Lien ouvert!';
    scanIndicator.style.backgroundColor = '#10b981';
}

// Close confirmation popup
function closeLinkConfirmPopup() {
    linkConfirmPopup.classList.remove('active');
    clearInterval(countdownInterval);
    pendingLink = null;
    resultStatus.textContent = 'Scan en cours...';
}

// Add scan to history
function addToHistory(data) {
    const scan = {
        data: data,
        time: new Date().toLocaleTimeString(),
        type: isValidUrl(data) ? 'link' : 'text',
        timestamp: Date.now()
    };
    
    // Keep only last 20 scans
    scanHistory.unshift(scan);
    scanHistory = scanHistory.slice(0, 20);
    
    localStorage.setItem('qrScanHistory', JSON.stringify(scanHistory));
    updateResultsDisplay();
}

// Add link to link history
function addToLinkHistory(url) {
    const link = {
        url: url,
        time: new Date().toLocaleTimeString(),
        timestamp: Date.now()
    };
    
    // Keep only last 10 links
    linkHistory.unshift(link);
    linkHistory = linkHistory.slice(0, 10);
    
    localStorage.setItem('qrLinkHistory', JSON.stringify(linkHistory));
}

// Update results display
function updateResultsDisplay() {
    resultsList.innerHTML = '';
    
    if (scanHistory.length === 0) {
        resultsList.innerHTML = `
            <div class="empty-results">
                <i class="fas fa-qrcode"></i>
                <p>Scannez votre premier QR code</p>
                <small>Les liens s'ouvriront automatiquement</small>
            </div>
        `;
        return;
    }
    
    scanHistory.forEach(scan => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.innerHTML = `
            <div class="result-item-content">
                <div class="result-type ${scan.type}">
                    <i class="fas fa-${scan.type === 'link' ? 'link' : 'font'}"></i>
                </div>
                <div class="result-details">
                    <p class="result-data">${scan.data}</p>
                    <span class="result-meta">${scan.time}</span>
                </div>
            </div>
        `;
        
        resultsList.appendChild(resultItem);
    });
}

// Update statistics
function updateStats() {
    scanCounter.textContent = `${scanHistory.length} scans`;
    linkCounter.textContent = `${linkHistory.length} liens`;
    linksCount.textContent = `${linkHistory.length} liens`;
}

// Update auto-open settings display
function updateAutoOpenSettings() {
    delayValue.textContent = openDelaySlider.value;
    autoOpenStatus.textContent = autoOpenEnabled ? 'Activée' : 'Désactivée';
    toggleAutoOpenBtn.classList.toggle('active', autoOpenEnabled);
}

// Check if string is a valid URL
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// Stop camera
function stopCamera() {
    scanning = false;
    
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    toggleCameraBtn.disabled = true;
    flashToggleBtn.disabled = true;
    
    scanIndicator.style.backgroundColor = '#6b7280';
    resultStatus.textContent = 'Caméra arrêtée';
}

// Toggle between cameras
function toggleCamera() {
    currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
    cameraSelect.value = currentCameraIndex;
    startCamera();
}

// Toggle flash
async function toggleFlash() {
    if (!stream) return;
    
    flashEnabled = !flashEnabled;
    flashToggleBtn.innerHTML = `<i class="fas fa-lightbulb"></i>`;
    flashToggleBtn.style.color = flashEnabled ? '#f59e0b' : '';
    
    try {
        const track = stream.getVideoTracks()[0];
        await track.applyConstraints({
            advanced: [{ torch: flashEnabled }]
        });
    } catch (error) {
        console.log('Flash non supporté');
    }
}

// Toggle auto-open
function toggleAutoOpen() {
    autoOpenEnabled = !autoOpenEnabled;
    updateAutoOpenSettings();
}

// Setup event listeners
function setupEventListeners() {
    startBtn.addEventListener('click', startCamera);
    stopBtn.addEventListener('click', stopCamera);
    toggleCameraBtn.addEventListener('click', toggleCamera);
    flashToggleBtn.addEventListener('click', toggleFlash);
    
    cameraSelect.addEventListener('change', (e) => {
        if (e.target.value !== '') {
            currentCameraIndex = parseInt(e.target.value);
            startCamera();
        }
    });
    
    // Auto-open settings
    openDelaySlider.addEventListener('input', () => {
        delayValue.textContent = openDelaySlider.value;
    });
    
    toggleAutoOpenBtn.addEventListener('click', toggleAutoOpen);
    
    // Popup buttons
    confirmOpenNowBtn.addEventListener('click', () => {
        if (pendingLink) {
            openLink(pendingLink);
        }
    });
    
    confirmCancelBtn.addEventListener('click', closeLinkConfirmPopup);
    
    // Sound test button
    document.getElementById('sound-test').addEventListener('click', () => {
        scanSound.currentTime = 0;
        scanSound.play().catch(e => console.log('Audio non joué:', e));
    });
    
    // Clear all button
    document.getElementById('clear-all').addEventListener('click', () => {
        if (confirm('Effacer tout l\'historique?')) {
            scanHistory = [];
            linkHistory = [];
            localStorage.removeItem('qrScanHistory');
            localStorage.removeItem('qrLinkHistory');
            updateResultsDisplay();
            updateStats();
            resultsList.innerHTML = `
                <div class="empty-results">
                    <i class="fas fa-check-circle"></i>
                    <p>Historique effacé</p>
                </div>
            `;
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Space to start/stop
        if (e.code === 'Space' && !e.target.matches('input, select, textarea')) {
            e.preventDefault();
            if (scanning) {
                stopCamera();
            } else {
                startCamera();
            }
        }
        
        // Escape to close popup
        if (e.code === 'Escape' && linkConfirmPopup.classList.contains('active')) {
            closeLinkConfirmPopup();
        }
    });
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
