const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const winScreen = document.getElementById('winScreen');
const settingsScreen = document.getElementById('settingsScreen');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const winScoreEl = document.getElementById('winScore');
const sensitivitySlider = document.getElementById('sensitivitySlider');
const sensitivityValue = document.getElementById('sensitivityValue');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettings');
const musicToggle = document.getElementById('musicToggle');
const sfxToggle = document.getElementById('sfxToggle');

// Set canvas size
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game states
const GameState = {
    IDLE: 'IDLE',
    PLAYING: 'PLAYING',
    DEAD: 'DEAD'
};

// Device detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

// Game configuration
const config = {
    gravity: isMobile ? 0.35 : 0.4,
    baseFlapVelocity: isMobile ? -6.5 : -7, // Reduced for easier control
    maxFallSpeed: isMobile ? 9 : 10,
    basePipeSpeed: isMobile ? 2.5 : 3,
    pipeSpeed: isMobile ? 2.5 : 3,
    speedIncrement: 0.2,
    maxPipeSpeed: isMobile ? 6 : 8,
    pipeGap: isMobile ? 180 : 160,
    pipeWidth: 60,
    pipeSpawnInterval: isMobile ? 2000 : 1800,
    groundHeight: 60,
    birdRadius: isMobile ? 18 : 15,
    beakLength: 8
};

// Game state
let gameState = GameState.IDLE;
let score = 0;
let bestScore = parseInt(localStorage.getItem('flappyBestScore')) || 0;
let frameCount = 0;
let lastPipeSpawn = 0;
let flashOpacity = 0;
let isLegitimateWin = false;

// Settings
let flapSensitivity = parseFloat(localStorage.getItem('flapSensitivity')) || 1.0; // 0.7 (Easy) to 1.3 (Hard)
let musicEnabled = localStorage.getItem('musicEnabled') !== 'false'; // Default ON
let sfxEnabled = localStorage.getItem('sfxEnabled') !== 'false'; // Default ON

// Audio Context (Web Audio API for procedural sounds)
let AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

// Initialize AudioContext on first user interaction
function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
}

// Background Music (looping ambient track)
let bgMusic = null;
let bgMusicGain = null;

// Create simple background music using oscillators
function createBackgroundMusic() {
    if (!audioCtx) initAudio();
    if (bgMusic) return; // Already created
    
    // Create gain node for volume control
    bgMusicGain = audioCtx.createGain();
    bgMusicGain.gain.value = 0.15; // Low volume for background
    bgMusicGain.connect(audioCtx.destination);
    
    // Create a simple melody loop
    bgMusic = {
        oscillators: [],
        gainNodes: [],
        isPlaying: false
    };
}

function playBackgroundMusic() {
    if (!audioCtx) initAudio();
    if (!musicEnabled || !bgMusic) return;
    if (bgMusic.isPlaying) return;
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    // Simple melody notes (frequencies in Hz)
    const melody = [
        { freq: 523.25, duration: 0.3 }, // C5
        { freq: 587.33, duration: 0.3 }, // D5
        { freq: 659.25, duration: 0.3 }, // E5
        { freq: 587.33, duration: 0.3 }, // D5
        { freq: 523.25, duration: 0.6 }, // C5
        { freq: 440.00, duration: 0.3 }, // A4
        { freq: 493.88, duration: 0.3 }, // B4
        { freq: 523.25, duration: 0.6 }  // C5
    ];
    
    let time = audioCtx.currentTime;
    
    function playMelodyLoop() {
        if (!musicEnabled || gameState === GameState.IDLE) {
            bgMusic.isPlaying = false;
            return;
        }
        
        melody.forEach((note, index) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = note.freq;
            
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(0.1, time + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, time + note.duration);
            
            osc.connect(gainNode);
            gainNode.connect(bgMusicGain);
            
            osc.start(time);
            osc.stop(time + note.duration);
            
            time += note.duration;
        });
        
        // Loop after melody completes
        setTimeout(playMelodyLoop, melody.reduce((sum, note) => sum + note.duration, 0) * 1000);
    }
    
    bgMusic.isPlaying = true;
    playMelodyLoop();
}

function stopBackgroundMusic() {
    if (bgMusic) {
        bgMusic.isPlaying = false;
    }
}

// Sound Effects
function playFlapSound() {
    if (!audioCtx) initAudio();
    if (!sfxEnabled || !audioCtx) return;
    
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'square';
        osc.frequency.value = 800;
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        // Silently fail if audio not ready
    }
}

function playScoreSound() {
    if (!audioCtx) initAudio();
    if (!sfxEnabled || !audioCtx) return;
    
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = 1000;
        
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
        // Silently fail if audio not ready
    }
}

function playDieSound() {
    if (!audioCtx) initAudio();
    if (!sfxEnabled || !audioCtx) return;
    
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
        
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
        // Silently fail if audio not ready
    }
}

function playWinSound() {
    if (!audioCtx) initAudio();
    if (!sfxEnabled || !audioCtx) return;
    
    try {
        // Victory fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C (major chord)
        
        notes.forEach((freq, index) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = audioCtx.currentTime + index * 0.1;
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(startTime);
            osc.stop(startTime + 0.5);
        });
    } catch (e) {
        // Silently fail if audio not ready
    }
}

// Secret cheat code
const keysPressed = new Set();
let lastCheatCheck = 0;

// Bird object
const bird = {
    x: 0,
    y: 0,
    velocity: 0,
    rotation: 0,
    scale: 1,
    bobOffset: 0,
    bobSpeed: 0.05,
    
    init() {
        this.x = canvas.width * 0.25;
        this.y = canvas.height * 0.5;
        this.velocity = 0;
        this.rotation = 0;
        this.scale = 1;
        this.bobOffset = 0;
    },
    
    flap() {
        this.velocity = config.baseFlapVelocity * flapSensitivity;
        this.scale = 0.85;
        playFlapSound();
    },
    
    update() {
        if (gameState === GameState.IDLE) {
            this.bobOffset += this.bobSpeed;
            this.y = canvas.height * 0.5 + Math.sin(this.bobOffset) * 15;
            this.rotation = 0;
        } else if (gameState === GameState.PLAYING) {
            this.velocity += config.gravity;
            if (this.velocity > config.maxFallSpeed) {
                this.velocity = config.maxFallSpeed;
            }
            this.y += this.velocity;
            
            // Rotation based on velocity
            if (this.velocity < 0) {
                this.rotation = Math.max(-25, this.velocity * 2);
            } else {
                this.rotation = Math.min(90, this.velocity * 3);
            }
            
            // Check ground collision
            if (this.y + config.birdRadius >= canvas.height - config.groundHeight) {
                this.y = canvas.height - config.groundHeight - config.birdRadius;
                die();
            }
            
            // Check ceiling collision
            if (this.y - config.birdRadius <= 0) {
                this.y = config.birdRadius;
                this.velocity = 0;
            }
        }
        
        // Scale animation
        if (this.scale < 1) {
            this.scale += 0.05;
            if (this.scale > 1) this.scale = 1;
        }
    },
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.scale(this.scale, this.scale);
        
        // Bird body (yellow circle)
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, config.birdRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Beak (orange triangle)
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.moveTo(config.birdRadius - 2, -3);
        ctx.lineTo(config.birdRadius + config.beakLength, 0);
        ctx.lineTo(config.birdRadius - 2, 3);
        ctx.closePath();
        ctx.fill();
        
        // Eye (small white circle with black pupil)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(5, -5, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(6, -5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
};

// Pipes array
const pipes = [];

class Pipe {
    constructor() {
        this.x = canvas.width;
        this.topHeight = Math.random() * (canvas.height - config.groundHeight - config.pipeGap - 100) + 50;
        this.bottomY = this.topHeight + config.pipeGap;
        this.scored = false;
        this.capHeight = 30;
    }
    
    update() {
        this.x -= config.pipeSpeed;
    }
    
    draw() {
        const capOverhang = 5;
        
        // Top pipe
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(this.x, 0, config.pipeWidth, this.topHeight - this.capHeight);
        
        // Top pipe cap
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(this.x - capOverhang, this.topHeight - this.capHeight, config.pipeWidth + capOverhang * 2, this.capHeight);
        
        // Bottom pipe
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(this.x, this.bottomY + this.capHeight, config.pipeWidth, canvas.height - config.groundHeight - this.bottomY - this.capHeight);
        
        // Bottom pipe cap
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(this.x - capOverhang, this.bottomY, config.pipeWidth + capOverhang * 2, this.capHeight);
    }
    
    collidesWith(bird) {
        const birdLeft = bird.x - config.birdRadius;
        const birdRight = bird.x + config.birdRadius;
        const birdTop = bird.y - config.birdRadius;
        const birdBottom = bird.y + config.birdRadius;
        
        const pipeLeft = this.x;
        const pipeRight = this.x + config.pipeWidth;
        
        if (birdRight > pipeLeft && birdLeft < pipeRight) {
            if (birdTop < this.topHeight || birdBottom > this.bottomY) {
                return true;
            }
        }
        return false;
    }
    
    isOffscreen() {
        return this.x + config.pipeWidth < 0;
    }
    
    isPassed(bird) {
        return !this.scored && bird.x > this.x + config.pipeWidth;
    }
}

function spawnPipe() {
    pipes.push(new Pipe());
    lastPipeSpawn = frameCount;
}

function updatePipes() {
    // Don't update if won
    if (gameState === GameState.DEAD && isLegitimateWin) return;
    
    if (frameCount - lastPipeSpawn > config.pipeSpawnInterval / (1000 / 60)) {
        spawnPipe();
    }
    
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].update();
        
        if (pipes[i].collidesWith(bird)) {
            die();
        }
        
        if (pipes[i].isPassed(bird)) {
            pipes[i].scored = true;
            score++;
            playScoreSound();
            
            // Increase speed every 10 points
            if (score % 10 === 0 && config.pipeSpeed < config.maxPipeSpeed) {
                config.pipeSpeed += config.speedIncrement;
            }
            
            // Check for legitimate win at score 999
            if (score >= 999 && gameState === GameState.PLAYING) {
                legitimateWin();
                return; // Stop updating pipes
            }
        }
        
        if (pipes[i].isOffscreen()) {
            pipes.splice(i, 1);
        }
    }
}

function drawPipes() {
    pipes.forEach(pipe => pipe.draw());
}

function drawGround() {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, canvas.height - config.groundHeight, canvas.width, config.groundHeight);
}

function drawScore() {
    if (gameState === GameState.PLAYING) {
        // Main score - responsive sizing
        ctx.fillStyle = 'white';
        const fontSize = isMobile ? Math.min(canvas.height * 0.08, 56) : Math.min(canvas.height * 0.06, 64);
        ctx.font = `bold ${fontSize}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const scoreY = isMobile ? canvas.height * 0.08 : canvas.height * 0.05;
        ctx.fillText(score, canvas.width / 2, scoreY);
        
        // Speed indicator (small text) - responsive
        const speedLevel = Math.floor(score / 10);
        if (speedLevel > 0) {
            ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
            const smallFontSize = isMobile ? Math.min(canvas.height * 0.025, 20) : Math.min(canvas.height * 0.02, 18);
            ctx.font = `bold ${smallFontSize}px "Courier New", monospace`;
            const speedY = scoreY + fontSize + 10;
            ctx.fillText(`SPEED x${(1 + speedLevel * 0.067).toFixed(1)}`, canvas.width / 2, speedY);
        }
    }
}

function drawFlash() {
    if (flashOpacity > 0) {
        ctx.fillStyle = `rgba(239, 68, 68, ${flashOpacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flashOpacity -= 0.05;
        if (flashOpacity < 0) flashOpacity = 0;
    }
}

function start() {
    gameState = GameState.PLAYING;
    score = 0;
    frameCount = 0;
    lastPipeSpawn = 0;
    pipes.length = 0;
    isLegitimateWin = false;
    
    // Reset speed to base
    config.pipeSpeed = config.basePipeSpeed;
    
    bird.init();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    winScreen.classList.add('hidden');
    
    // Initialize and start background music
    initAudio();
    createBackgroundMusic();
    playBackgroundMusic();
}

function die() {
    if (gameState === GameState.DEAD) return;
    
    gameState = GameState.DEAD;
    flashOpacity = 0.4;
    
    playDieSound();
    stopBackgroundMusic();
    
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('flappyBestScore', bestScore);
    }
    
    finalScoreEl.textContent = score;
    bestScoreEl.textContent = bestScore;
    gameOverScreen.classList.remove('hidden');
}

function instantWin() {
    if (gameState !== GameState.PLAYING) return;
    
    // Set winning score
    score = 999;
    isLegitimateWin = false;
    gameState = GameState.DEAD; // Stop game immediately
    flashOpacity = 0.8;
    
    stopBackgroundMusic();
    playWinSound();
    
    // Victory effect - golden flash with particles
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            ctx.fillStyle = `rgba(251, 191, 36, ${Math.random() * 0.5 + 0.3})`;
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 20 + 10;
            ctx.fillRect(x, y, size, size);
        }, i * 20);
    }
    
    setTimeout(() => {
        // Don't save cheat score to best score
        
        showWinScreen();
        
        // Play celebration sound effect (visual)
        canvas.style.animation = 'shake 0.5s';
        setTimeout(() => {
            canvas.style.animation = '';
        }, 500);
    }, 1000);
}

function legitimateWin() {
    if (gameState !== GameState.PLAYING) return;
    
    isLegitimateWin = true;
    gameState = GameState.DEAD; // Stop game immediately
    flashOpacity = 0.8;
    
    stopBackgroundMusic();
    playWinSound();
    
    // Epic victory effect - rainbow particles
    for (let i = 0; i < 100; i++) {
        setTimeout(() => {
            const colors = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7'];
            ctx.fillStyle = `${colors[Math.floor(Math.random() * colors.length)]}`;
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 30 + 15;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }, i * 15);
    }
    
    setTimeout(() => {
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('flappyBestScore', bestScore);
        }
        
        showWinScreen();
        
        // Epic shake
        canvas.style.animation = 'epicShake 0.8s';
        setTimeout(() => {
            canvas.style.animation = '';
        }, 800);
    }, 1500);
}

function showWinScreen() {
    winScoreEl.textContent = score;
    
    if (isLegitimateWin) {
        document.getElementById('winTitle').textContent = 'LEGENDARY!';
        document.getElementById('winMessage').textContent = 'You are a TRUE master!';
        document.getElementById('winTrophy').textContent = '👑';
        winScreen.classList.add('legitimate');
        winScreen.classList.remove('cheat');
    } else {
        document.getElementById('winTitle').textContent = 'CONGRATULATIONS!';
        document.getElementById('winMessage').textContent = 'You discovered the secret!';
        document.getElementById('winTrophy').textContent = '★';
        winScreen.classList.add('cheat');
        winScreen.classList.remove('legitimate');
    }
    
    winScreen.classList.remove('hidden');
}

function checkCheatCode() {
    const now = Date.now();
    
    // Cheat code: W + I + N pressed simultaneously (instant win with cheat)
    if (keysPressed.has('KeyW') && keysPressed.has('KeyI') && keysPressed.has('KeyN')) {
        if (now - lastCheatCheck > 1000) {
            lastCheatCheck = now;
            instantWin();
        }
    }
    
    // Dev secret: G + O + D pressed simultaneously (legitimate win for testing)
    if (keysPressed.has('KeyG') && keysPressed.has('KeyO') && keysPressed.has('KeyD')) {
        if (now - lastCheatCheck > 1000) {
            lastCheatCheck = now;
            score = 999; // Set to winning score
            legitimateWin();
        }
    }
}

// Debug: Log when handleInput is called
function handleInput() {
    console.log('handleInput called, gameState:', gameState);
    
    // Initialize and resume AudioContext on first user interaction (for mobile)
    if (!audioCtx) {
        initAudio();
        console.log('AudioContext initialized');
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
        console.log('AudioContext resumed');
    }
    
    if (gameState === GameState.IDLE) {
        console.log('Starting game...');
        start();
    } else if (gameState === GameState.PLAYING) {
        console.log('Bird flap');
        bird.flap();
    } else if (gameState === GameState.DEAD) {
        console.log('Restarting game...');
        start();
    }
}

// Input listeners
document.addEventListener('keydown', (e) => {
    // Don't handle if settings is open
    if (!settingsScreen.classList.contains('hidden')) {
        return;
    }
    
    // Track keys for cheat code
    keysPressed.add(e.code);
    checkCheatCode();
    
    if (e.code === 'Space') {
        e.preventDefault();
        handleInput();
    }
});

document.addEventListener('keyup', (e) => {
    keysPressed.delete(e.code);
});

// Touch cheat code: 4 finger tap
let touchCount = 0;
let lastTouchTime = 0;

canvas.addEventListener('click', (e) => {
    // Don't handle if settings is open
    if (!settingsScreen.classList.contains('hidden')) {
        return;
    }
    handleInput();
});

canvas.addEventListener('touchstart', (e) => {
    // Don't handle if settings is open
    if (!settingsScreen.classList.contains('hidden')) {
        return;
    }
    
    e.preventDefault();
    
    const now = Date.now();
    const fingers = e.touches.length;
    
    // Secret: 4 finger tap for instant win (cheat)
    if (fingers >= 4 && gameState === GameState.PLAYING) {
        if (now - lastTouchTime > 1000) {
            lastTouchTime = now;
            instantWin();
            return;
        }
    }
    
    // Dev secret: 5 finger tap for legitimate win (testing)
    if (fingers >= 5 && gameState === GameState.PLAYING) {
        if (now - lastTouchTime > 1000) {
            lastTouchTime = now;
            score = 999;
            legitimateWin();
            return;
        }
    }
    
    handleInput();
});

// Additional fallback for mobile - tap on start screen directly
startScreen.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState === GameState.IDLE) {
        handleInput();
    }
});

startScreen.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (gameState === GameState.IDLE) {
        handleInput();
    }
});

// Fallback for game over screen
gameOverScreen.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState === GameState.DEAD) {
        handleInput();
    }
});

gameOverScreen.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (gameState === GameState.DEAD) {
        handleInput();
    }
});

// Game loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    bird.update();
    
    if (gameState === GameState.PLAYING) {
        updatePipes();
        frameCount++;
    }
    
    drawPipes();
    drawGround();
    bird.draw();
    drawScore();
    drawFlash();
    
    requestAnimationFrame(gameLoop);
}

// Initialize
bird.init();
bestScoreEl.textContent = bestScore;

// Settings
sensitivitySlider.value = flapSensitivity;
updateSensitivityDisplay();

// Update toggle button states
musicToggle.classList.toggle('active', musicEnabled);
musicToggle.querySelector('.toggle-status').textContent = musicEnabled ? 'ON' : 'OFF';
sfxToggle.classList.toggle('active', sfxEnabled);
sfxToggle.querySelector('.toggle-status').textContent = sfxEnabled ? 'ON' : 'OFF';

settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsScreen.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsScreen.classList.add('hidden');
});

sensitivitySlider.addEventListener('input', (e) => {
    e.stopPropagation();
    flapSensitivity = parseFloat(e.target.value);
    localStorage.setItem('flapSensitivity', flapSensitivity);
    updateSensitivityDisplay();
});

sensitivitySlider.addEventListener('change', (e) => {
    e.stopPropagation();
});

musicToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    musicEnabled = !musicEnabled;
    localStorage.setItem('musicEnabled', musicEnabled);
    musicToggle.classList.toggle('active', musicEnabled);
    musicToggle.querySelector('.toggle-status').textContent = musicEnabled ? 'ON' : 'OFF';
    
    if (!musicEnabled) {
        stopBackgroundMusic();
    } else if (gameState === GameState.PLAYING) {
        createBackgroundMusic();
        playBackgroundMusic();
    }
});

sfxToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    sfxEnabled = !sfxEnabled;
    localStorage.setItem('sfxEnabled', sfxEnabled);
    sfxToggle.classList.toggle('active', sfxEnabled);
    sfxToggle.querySelector('.toggle-status').textContent = sfxEnabled ? 'ON' : 'OFF';
});

// Prevent settings screen from triggering game actions
settingsScreen.addEventListener('click', (e) => {
    e.stopPropagation();
});

settingsScreen.addEventListener('touchstart', (e) => {
    e.stopPropagation();
});

function updateSensitivityDisplay() {
    let label = 'Normal';
    if (flapSensitivity <= 0.8) label = 'Easy';
    else if (flapSensitivity <= 0.95) label = 'Medium';
    else if (flapSensitivity >= 1.15) label = 'Hard';
    
    sensitivityValue.textContent = label;
}

gameLoop();
