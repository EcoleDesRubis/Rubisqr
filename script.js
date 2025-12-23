// DOM Elements
const video = document.getElementById('video');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const toggleCameraBtn = document.getElementById('toggle-camera');
const flashToggleBtn = document.getElementById('flash-toggle');
const cameraSelect = document.getElementById('camera-select');
const resultText = document.getElementById('result-text');
const scanTime = document.getElementById('scan-time');
const resultActions = document.getElementById('result-actions');
const openLink = document.getElementById('open-link');
const copyBtn = document.getElementById('copy-btn');
const historyList = document.getElementById('history-list');
const toast = document.getElementById('toast');

// Global variables
let stream = null;
let cameras = [];
let currentCameraIndex = 0;
let scanning = false;
let scanInterval = null;
let flashEnabled = false;
let scanHistory = JSON.parse(localStorage.getItem('qrScanHistory')) || [];

// Initialize
function init() {
    loadCameras();
    updateHistoryDisplay();
    setupEventListeners();
}

// Load available cameras
async function loadCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameras = devices.filter(device => device.kind === 'videoinput');
        
        cameraSelect.innerHTML = '<option value="">Select Camera...</option>';
        cameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = camera.label || `Camera ${index + 1}`;
            cameraSelect.appendChild(option);
        });
        
        if (cameras.length > 0) {
            cameraSelect.value = currentCameraIndex;
        }
    } catch (error) {
        console.error('Error loading cameras:', error);
        showToast('Error loading cameras', 'error');
    }
}

// Start camera
async function startCamera(cameraIndex = 0) {
    try {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: {
                deviceId: cameras[cameraIndex]?.deviceId ? { exact: cameras[cameraIndex].deviceId } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: cameraIndex === 0 ? { ideal: 'environment' } : 'user'
            }
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        // Try to enable flash if available
        if (stream.getVideoTracks()[0]) {
            const track = stream.getVideoTracks()[0];
            try {
                await track.applyConstraints({
                    advanced: [{ torch: flashEnabled }]
                });
            } catch (e) {
                console.log('Flash not supported');
            }
        }
        
        scanning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        toggleCameraBtn.disabled = false;
        flashToggleBtn.disabled = false;
        
        showToast('Camera started successfully', 'success');
        startScanning();
        
    } catch (error) {
        console.error('Error starting camera:', error);
        showToast(`Error: ${error.message}`, 'error');
        resultText.textContent = `Error: ${error.message}. Please allow camera access.`;
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
            
            // Use jsQR library to decode
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (code) {
                handleQRCodeDetected(code.data);
            }
            
        } catch (error) {
            console.error('Error scanning:', error);
        }
    }, 500); // Scan every 500ms
}

// Handle detected QR code
function handleQRCodeDetected(data) {
    if (!data) return;
    
    // Update result display
    resultText.textContent = data;
    scanTime.textContent = new Date().toLocaleTimeString();
    
    // Determine result type
    let resultType = 'TEXT';
    if (isValidUrl(data)) {
        resultType = 'URL';
        openLink.href = data;
        openLink.style.display = 'inline-flex';
    } else {
        openLink.style.display = 'none';
    }
    
    document.querySelector('.result-type').textContent = resultType;
    resultActions.style.display = 'flex';
    
    // Add to history
    addToHistory(data, resultType);
    
    // Show success notification
    showToast('QR Code detected!', 'success');
    
    // Optional: Stop scanning after detection
    // stopCamera();
}

// Add scan to history
function addToHistory(data, type) {
    const scan = {
        data: data,
        type: type,
        time: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    
    // Remove duplicates and keep only last 10 scans
    scanHistory = scanHistory.filter(item => item.data !== data);
    scanHistory.unshift(scan);
    scanHistory = scanHistory.slice(0, 10);
    
    // Save to localStorage
    localStorage.setItem('qrScanHistory', JSON.stringify(scanHistory));
    updateHistoryDisplay();
}

// Update history display
function updateHistoryDisplay() {
    historyList.innerHTML = '';
    
    if (scanHistory.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #666;">No scans yet</p>';
        return;
    }
    
    scanHistory.forEach(scan => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-content">${scan.data}</div>
            <div class="history-time">
                <span class="history-type">${scan.type}</span> • ${scan.time}
            </div>
        `;
        
        item.addEventListener('click', () => {
            resultText.textContent = scan.data;
            scanTime.textContent = scan.time;
            
            if (scan.type === 'URL' && isValidUrl(scan.data)) {
                openLink.href = scan.data;
                openLink.style.display = 'inline-flex';
            } else {
                openLink.style.display = 'none';
            }
            
            document.querySelector('.result-type').textContent = scan.type;
            resultActions.style.display = 'flex';
            
            showToast('Scan loaded from history', 'info');
        });
        
        historyList.appendChild(item);
    });
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
    
    showToast('Camera stopped', 'info');
}

// Toggle between front/back camera
function toggleCamera() {
    currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
    cameraSelect.value = currentCameraIndex;
    startCamera(currentCameraIndex);
}

// Toggle flash
async function toggleFlash() {
    if (!stream) return;
    
    flashEnabled = !flashEnabled;
    flashToggleBtn.innerHTML = `<i class="fas fa-lightbulb"></i> Flash ${flashEnabled ? 'On' : 'Off'}`;
    
    try {
        const track = stream.getVideoTracks()[0];
        await track.applyConstraints({
            advanced: [{ torch: flashEnabled }]
        });
    } catch (error) {
        console.log('Flash toggle not supported');
        showToast('Flash not supported on this device', 'warning');
    }
}

// Copy text to clipboard
async function copyToClipboard() {
    try {
        await navigator.clipboard.writeText(resultText.textContent);
        showToast('Copied to clipboard!', 'success');
    } catch (error) {
        console.error('Copy failed:', error);
        showToast('Failed to copy', 'error');
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = 'toast';
    
    // Set color based on type
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };
    
    toast.style.background = colors[type] || colors.info;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Check if string is a valid URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Setup event listeners
function setupEventListeners() {
    startBtn.addEventListener('click', () => startCamera(currentCameraIndex));
    stopBtn.addEventListener('click', stopCamera);
    toggleCameraBtn.addEventListener('click', toggleCamera);
    flashToggleBtn.addEventListener('click', toggleFlash);
    copyBtn.addEventListener('click', copyToClipboard);
    
    cameraSelect.addEventListener('change', (e) => {
        if (e.target.value !== '') {
            currentCameraIndex = parseInt(e.target.value);
            startCamera(currentCameraIndex);
        }
    });
    
    openLink.addEventListener('click', (e) => {
        if (!isValidUrl(resultText.textContent)) {
            e.preventDefault();
            showToast('Invalid URL', 'error');
        }
    });
    
    // Handle visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && scanning) {
            // Pause scanning when tab is hidden
            if (scanInterval) {
                clearInterval(scanInterval);
                scanInterval = null;
            }
        } else if (!document.hidden && scanning) {
            // Resume scanning when tab becomes visible
            startScanning();
        }
    });
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Space to start/stop
    if (e.code === 'Space' && !e.target.matches('input, select, textarea')) {
        e.preventDefault();
        if (scanning) {
            stopCamera();
        } else {
            startCamera(currentCameraIndex);
        }
    }
    
    // Escape to stop
    if (e.code === 'Escape' && scanning) {
        stopCamera();
    }
    
    // C to copy
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC' && resultText.textContent) {
        e.preventDefault();
        copyToClipboard();
    }
});