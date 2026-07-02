const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const winScreen = document.getElementById('winScreen');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const winScoreEl = document.getElementById('winScore');

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
    flapVelocity: isMobile ? -7 : -7.5,
    maxFallSpeed: isMobile ? 9 : 10,
    pipeSpeed: isMobile ? 2.5 : 3,
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
        this.velocity = config.flapVelocity;
        this.scale = 0.85;
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
            
            // Check for legitimate win at score 50
            if (score >= 50) {
                legitimateWin();
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
        ctx.fillStyle = 'white';
        const fontSize = isMobile ? 56 : 48;
        ctx.font = `bold ${fontSize}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(score, canvas.width / 2, isMobile ? 60 : 50);
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
    bird.init();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    winScreen.classList.add('hidden');
}

function die() {
    if (gameState === GameState.DEAD) return;
    
    gameState = GameState.DEAD;
    flashOpacity = 0.4;
    
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
    flashOpacity = 0.8;
    
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
        gameState = GameState.DEAD;
        
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
    flashOpacity = 0.8;
    
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
        gameState = GameState.DEAD;
        
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
            score = 50; // Set to winning score
            legitimateWin();
        }
    }
}

function handleInput() {
    if (gameState === GameState.IDLE) {
        start();
    } else if (gameState === GameState.PLAYING) {
        bird.flap();
    } else if (gameState === GameState.DEAD) {
        start();
    }
}

// Input listeners
document.addEventListener('keydown', (e) => {
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

canvas.addEventListener('click', handleInput);
canvas.addEventListener('touchstart', (e) => {
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
            score = 50;
            legitimateWin();
            return;
        }
    }
    
    handleInput();
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
gameLoop();
