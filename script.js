// Éléments DOM
const video = document.getElementById('video');
const switchCameraBtn = document.getElementById('switch-camera');
const stopScannerBtn = document.getElementById('stop-scanner');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
const guideText = document.getElementById('guide-text');

// Écrans
const startScreen = document.getElementById('start-screen');
const scannerContainer = document.querySelector('.scanner-container');
const startScannerBtn = document.getElementById('start-scanner');

// Éléments du popup
const linkPopup = document.getElementById('link-popup');
const popupUrl = document.getElementById('popup-url');
const countdownNumber = document.getElementById('countdown-number');
const countdownSeconds = document.getElementById('countdown-seconds');
const openNowBtn = document.getElementById('open-now');
const cancelBtn = document.getElementById('cancel-open');

// Message d'erreur
const errorMessage = document.getElementById('error-message');
const errorDetails = document.getElementById('error-details');
const retryBtn = document.getElementById('retry-btn');
const backToStartBtn = document.getElementById('back-to-start');

// Audio
const scanSound = document.getElementById('scan-sound');

// Variables globales
let stream = null;
let scanning = false;
let scanInterval = null;
let countdownInterval = null;
let currentCountdown = 3;
let pendingLink = null;
let isFrontCamera = false;
let cameraPermissionGranted = false;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    console.log('Application prête');
    updateStatus('Prêt à scanner', '#10b981');
    
    // Configuration initiale
    setupEventListeners();
});

// Configurer les événements
function setupEventListeners() {
    // Bouton de démarrage
    startScannerBtn.addEventListener('click', startScanner);
    
    // Bouton d'arrêt
    stopScannerBtn.addEventListener('click', stopScanner);
    
    // Bouton switch caméra
    switchCameraBtn.addEventListener('click', switchCamera);
    
    // Boutons popup
    openNowBtn.addEventListener('click', () => {
        if (pendingLink) {
            openLink(pendingLink);
        }
    });
    
    cancelBtn.addEventListener('click', closeLinkPopup);
    
    // Boutons d'erreur
    retryBtn.addEventListener('click', () => {
        hideError();
        startScanner();
    });
    
    backToStartBtn.addEventListener('click', () => {
        hideError();
        showStartScreen();
    });
    
    // Événements clavier
    document.addEventListener('keydown', handleKeyPress);
    
    // Gérer le changement de visibilité
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Démarrer le scanner
async function startScanner() {
    try {
        // Cacher l'écran de démarrage
        hideStartScreen();
        
        // Montrer le scanner
        scannerContainer.classList.add('active');
        
        // Mettre à jour le statut
        updateStatus('Démarrage de la caméra...', '#f59e0b');
        guideText.textContent = 'Démarrage de la caméra...';
        
        // Vérifier si l'API est disponible
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showError('Votre navigateur ne supporte pas l\'accès à la caméra');
            return;
        }
        
        // Démarrer la caméra
        await startCamera();
        
    } catch (error) {
        console.error('Erreur de démarrage du scanner:', error);
        handleCameraError(error);
    }
}

// Démarrer la caméra
async function startCamera() {
    try {
        // Arrêter le flux précédent s'il existe
        if (stream) {
            stopStream();
        }
        
        // Constraintes pour la caméra
        const constraints = {
            video: {
                facingMode: isFrontCamera ? 'user' : 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            },
            audio: false
        };
        
        console.log('Demande d\'accès à la caméra...');
        
        // Demander l'accès à la caméra
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Accès à la caméra accordé');
        
        // Attacher le flux à la vidéo
        video.srcObject = stream;
        
        // Attendre que la vidéo soit prête
        video.onloadedmetadata = () => {
            console.log('Métadonnées de la vidéo chargées');
            video.play().then(() => {
                console.log('Vidéo en lecture');
                cameraPermissionGranted = true;
                scanning = true;
                switchCameraBtn.disabled = false;
                stopScannerBtn.disabled = false;
                updateStatus('Scan en cours...', '#3b82f6');
                guideText.textContent = 'Placez le QR code dans le cadre';
                startScanning();
            }).catch(err => {
                console.error('Erreur de lecture vidéo:', err);
                showError('Erreur de lecture vidéo: ' + err.message);
            });
        };
        
        video.onerror = (err) => {
            console.error('Erreur vidéo:', err);
            showError('Erreur vidéo');
        };
        
    } catch (error) {
        console.error('Erreur d\'accès à la caméra:', error);
        throw error;
    }
}

// Arrêter le scanner
function stopScanner() {
    // Arrêter le flux vidéo
    stopStream();
    
    // Mettre à jour le statut
    updateStatus('Scanner arrêté', '#6b7280');
    guideText.textContent = 'Scanner arrêté';
    
    // Désactiver les boutons
    switchCameraBtn.disabled = true;
    stopScannerBtn.disabled = true;
    
    // Cacher le scanner
    scannerContainer.classList.remove('active');
    
    // Remonter l'écran de démarrage
    showStartScreen();
    
    console.log('Scanner arrêté');
}

// Arrêter le flux vidéo
function stopStream() {
    if (stream) {
        stream.getTracks().forEach(track => {
            track.stop();
        });
        stream = null;
    }
    scanning = false;
    cameraPermissionGranted = false;
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    if (linkPopup.classList.contains('active')) {
        closeLinkPopup();
    }
}

// Commencer le scanning
function startScanning() {
    if (scanInterval) clearInterval(scanInterval);
    
    scanInterval = setInterval(() => {
        if (!scanning || !video.videoWidth || !cameraPermissionGranted) return;
        
        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            // Dessiner l'image de la vidéo sur le canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Récupérer les données d'image
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Décoder le QR code
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (code && code.data) {
                console.log('QR code détecté:', code.data.substring(0, 50) + '...');
                handleQRCodeDetected(code.data);
            }
            
        } catch (error) {
            console.error('Erreur lors du scan:', error);
        }
    }, 500); // Scan toutes les 500ms
}

// Gérer le QR code détecté
function handleQRCodeDetected(data) {
    if (!data) return;
    
    console.log('QR code traité:', data);
    
    // Jouer le son de scan
    playScanSound();
    
    // Mettre à jour le statut
    updateStatus('QR détecté!', '#10b981');
    
    // Vérifier si c'est une URL
    if (isValidUrl(data)) {
        handleLinkDetected(data);
    } else {
        // Si ce n'est pas une URL, afficher un message
        updateStatus('Texte détecté', '#8b5cf6');
        setTimeout(() => {
            if (scanning) {
                updateStatus('Scan en cours...', '#3b82f6');
            }
        }, 1500);
    }
}

// Gérer un lien détecté
function handleLinkDetected(url) {
    console.log('Lien détecté:', url);
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
    console.log('Ouverture du lien:', url);
    window.open(url, '_blank', 'noopener,noreferrer');
    closeLinkPopup();
    updateStatus('Lien ouvert!', '#10b981');
    
    // Revenir au scanning après 2 secondes
    setTimeout(() => {
        if (scanning && !linkPopup.classList.contains('active')) {
            updateStatus('Scan en cours...', '#3b82f6');
        }
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
        isFrontCamera = !isFrontCamera;
        updateStatus('Changement de caméra...', '#f59e0b');
        guideText.textContent = 'Changement de caméra...';
        
        await startCamera();
        updateStatus('Scan en cours...', '#3b82f6');
        guideText.textContent = 'Placez le QR code dans le cadre';
        
    } catch (error) {
        console.error('Erreur de changement de caméra:', error);
        handleCameraError(error);
    }
}

// Gérer les erreurs de caméra
function handleCameraError(error) {
    let errorMsg = 'Erreur d\'accès à la caméra';
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMsg = 'Permission de la caméra refusée. Veuillez autoriser l\'accès à la caméra.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMsg = 'Aucune caméra trouvée sur cet appareil.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMsg = 'La caméra est déjà utilisée par une autre application.';
    } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        errorMsg = 'Aucune caméra ne correspond aux contraintes.';
    } else if (error.name === 'SecurityError') {
        errorMsg = 'L\'accès à la caméra est bloqué pour des raisons de sécurité.';
    } else if (error.name === 'AbortError') {
        errorMsg = 'L\'accès à la caméra a été interrompu.';
    } else {
        errorMsg = `Erreur: ${error.message || error.name || 'Erreur inconnue'}`;
    }
    
    showError(errorMsg);
}

// Afficher le message d'erreur
function showError(message) {
    errorDetails.textContent = message;
    errorMessage.classList.add('active');
    updateStatus('Erreur', '#ef4444');
    switchCameraBtn.disabled = true;
    stopScannerBtn.disabled = true;
    cameraPermissionGranted = false;
    scanning = false;
    
    // Arrêter le flux si nécessaire
    stopStream();
    
    // Cacher le scanner
    scannerContainer.classList.remove('active');
}

// Cacher le message d'erreur
function hideError() {
    errorMessage.classList.remove('active');
}

// Afficher l'écran de démarrage
function showStartScreen() {
    startScreen.classList.remove('hidden');
    startScreen.classList.add('active');
    updateStatus('Prêt à scanner', '#10b981');
}

// Cacher l'écran de démarrage
function hideStartScreen() {
    startScreen.classList.remove('active');
    startScreen.classList.add('hidden');
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
        scanSound.play().catch(e => console.log('Audio non joué:', e));
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

// Gérer les touches clavier
function handleKeyPress(e) {
    // Espace pour basculer la caméra
    if (e.code === 'Space' && cameraPermissionGranted) {
        e.preventDefault();
        switchCamera();
    }
    
    // Échap pour fermer le popup
    if (e.code === 'Escape' && linkPopup.classList.contains('active')) {
        closeLinkPopup();
    }
    
    // S pour arrêter le scanner
    if (e.code === 'KeyS' && cameraPermissionGranted) {
        e.preventDefault();
        stopScanner();
    }
    
    // R pour réessayer en cas d'erreur
    if (e.code === 'KeyR' && errorMessage.classList.contains('active')) {
        e.preventDefault();
        hideError();
        startScanner();
    }
}

// Gérer le changement de visibilité
function handleVisibilityChange() {
    if (document.hidden) {
        // Page cachée, arrêter temporairement le scanning
        if (scanning) {
            scanning = false;
        }
    } else if (cameraPermissionGranted) {
        // Page visible, redémarrer le scanning
        scanning = true;
        if (scanInterval) {
            clearInterval(scanInterval);
        }
        startScanning();
    }
}
