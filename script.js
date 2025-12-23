// Éléments DOM
const video = document.getElementById('video');
const switchCameraBtn = document.getElementById('switch-camera');
const statusText = document.getElementById('status-text');
const statusDot = document.querySelector('.status-dot');

// Éléments du popup
const linkPopup = document.getElementById('link-popup');
const popupUrl = document.getElementById('popup-url');
const countdownNumber = document.getElementById('countdown-number');
const countdownSeconds = document.getElementById('countdown-seconds');
const openNowBtn = document.getElementById('open-now');
const cancelBtn = document.getElementById('cancel-open');

// Audio
const scanSound = document.getElementById('scan-sound');

// Variables globales
let stream = null;
let cameras = [];
let currentCameraIndex = 0;
let scanning = false;
let scanInterval = null;
let countdownInterval = null;
let currentCountdown = 3;
let pendingLink = null;

// Initialisation automatique au chargement
window.addEventListener('DOMContentLoaded', async () => {
    await initCamera();
    updateStatus('Scan en cours...', '#3b82f6');
});

// Initialisation de la caméra
async function initCamera() {
    try {
        // Démarrer automatiquement avec la caméra arrière
        await startCamera('environment');
        startScanning();
    } catch (error) {
        console.error('Erreur d\'initialisation:', error);
        updateStatus('Erreur de caméra', '#ef4444');
    }
}

// Démarrer la caméra
async function startCamera(facingMode = 'environment') {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    scanning = true;
}

// Commencer le scanning
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
            
            // Décoder le QR code
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (code) {
                handleQRCodeDetected(code.data);
            }
            
        } catch (error) {
            console.error('Erreur de scan:', error);
        }
    }, 300); // Scan toutes les 300ms
}

// Gérer le QR code détecté
function handleQRCodeDetected(data) {
    if (!data) return;
    
    // Jouer le son de scan
    playScanSound();
    
    // Mettre à jour le statut
    updateStatus('QR détecté!', '#10b981');
    
    // Vérifier si c'est une URL
    if (isValidUrl(data)) {
        handleLinkDetected(data);
    }
    
    // Revenir au scanning après 1 seconde
    setTimeout(() => {
        if (!linkPopup.classList.contains('active')) {
            updateStatus('Scan en cours...', '#3b82f6');
        }
    }, 1000);
}

// Gérer un lien détecté
function handleLinkDetected(url) {
    pendingLink = url;
    showLinkPopup(url);
}

// Afficher le popup de lien
function showLinkPopup(url) {
    popupUrl.textContent = url;
    currentCountdown = 3;
    countdownNumber.textContent = currentCountdown;
    countdownSeconds.textContent = currentCountdown;
    
    linkPopup.classList.add('active');
    updateStatus('Ouverture du lien...', '#f59e0b');
    
    // Démarrer le décompte
    startCountdown();
}

// Démarrer le décompte
function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
        currentCountdown--;
        countdownNumber.textContent = currentCountdown;
        countdownSeconds.textContent = currentCountdown;
        
        if (currentCountdown <= 0) {
            clearInterval(countdownInterval);
            openLink(pendingLink);
        }
    }, 1000);
}

// Ouvrir le lien
function openLink(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
    closeLinkPopup();
    updateStatus('Lien ouvert!', '#10b981');
    
    // Revenir au scanning après 2 secondes
    setTimeout(() => {
        updateStatus('Scan en cours...', '#3b82f6');
    }, 2000);
}

// Fermer le popup
function closeLinkPopup() {
    linkPopup.classList.remove('active');
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    pendingLink = null;
}

// Basculer entre caméra avant/arrière
async function switchCamera() {
    try {
        currentCameraIndex = (currentCameraIndex + 1) % 2;
        const facingMode = currentCameraIndex === 0 ? 'environment' : 'user';
        
        updateStatus('Changement de caméra...', '#f59e0b');
        await startCamera(facingMode);
        updateStatus('Scan en cours...', '#3b82f6');
        
    } catch (error) {
        console.error('Erreur de changement de caméra:', error);
        updateStatus('Erreur de caméra', '#ef4444');
    }
}

// Mettre à jour le statut
function updateStatus(text, color) {
    statusText.textContent = text;
    statusDot.style.backgroundColor = color;
}

// Jouer le son de scan
function playScanSound() {
    try {
        scanSound.currentTime = 0;
        scanSound.play().catch(e => console.log('Audio non joué'));
    } catch (error) {
        console.log('Erreur audio:', error);
    }
}

// Vérifier si c'est une URL valide
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// Événements
switchCameraBtn.addEventListener('click', switchCamera);
openNowBtn.addEventListener('click', () => {
    if (pendingLink) {
        openLink(pendingLink);
    }
});
cancelBtn.addEventListener('click', closeLinkPopup);

// Événements clavier
document.addEventListener('keydown', (e) => {
    // Espace pour basculer la caméra
    if (e.code === 'Space') {
        e.preventDefault();
        switchCamera();
    }
    
    // Échap pour fermer le popup
    if (e.code === 'Escape' && linkPopup.classList.contains('active')) {
        closeLinkPopup();
    }
});
