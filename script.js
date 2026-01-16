window.onerror = function(msg, url, line, col, error) {
    const errorStr = `Error: ${msg}\nLine: ${line}\nCol: ${col}\nURL: ${url}`;
    console.error(errorStr);
    alert(errorStr);
    const debugDiv = document.getElementById('debug-log');
    if (debugDiv) {
        debugDiv.classList.remove('hidden');
        debugDiv.innerHTML += `<div>${errorStr}</div>`;
    }
};

function debugLog(message) {
    console.log(message);
    const debugDiv = document.getElementById('debug-log');
    if (debugDiv) {
        debugDiv.innerHTML += `<div>LOG: ${message}</div>`;
    }
}

// Variables that need to be accessible globally or in the game loop
let canvas, ctx;
let player;
let projectiles = [];
let enemies = [];
let particles = [];
let powerUps = [];
let stars = [];
let planets = [];
let keys = { w: false, a: false, s: false, d: false, space: false, mouseLeft: false };
let joystickInput = { x: 0, y: 0, active: false };
let mobileMode = false;
let gameRunning = false;
let score = 0;
let animationId;
let frames = 0;
let mouseX = 0;
let mouseY = 0;
let screenShake = 0;

// Config
const PLAYER_ACCEL = 0.5;
const PLAYER_MAX_SPEED = 6;
const PLAYER_FRICTION = 0.94;
const BULLET_SPEED = 12;
const ENEMY_BULLET_SPEED = 5;
const PARTICLE_FRICTION = 0.95;
let ENEMY_SPAWN_RATE = 2000;

// UI Elements (assigned later)
let scoreEl, startScreen, gameOverScreen, finalScoreEl, startBtnKeyboard, startBtnTouch, restartBtn, healthBarEl, missileCountEl, mobileControls, joystickZone, joystickKnob, fireBtn, missileBtn;

window.addEventListener('load', () => {
    debugLog("Initializing game...");
    try {
        canvas = document.getElementById('gameCanvas');
        if (!canvas) throw new Error("Canvas element not found");
        ctx = canvas.getContext('2d');
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        scoreEl = document.getElementById('score');
        startScreen = document.getElementById('start-screen');
        gameOverScreen = document.getElementById('game-over-screen');
        finalScoreEl = document.getElementById('final-score');
        startBtnKeyboard = document.getElementById('start-btn-keyboard');
        startBtnTouch = document.getElementById('start-btn-touch');
        restartBtn = document.getElementById('restart-btn');
        healthBarEl = document.getElementById('health-bar');
        missileCountEl = document.getElementById('missile-count');
        mobileControls = document.getElementById('mobile-controls');
        joystickZone = document.getElementById('joystick-zone');
        joystickKnob = document.getElementById('joystick-knob');
        fireBtn = document.getElementById('fire-btn');
        missileBtn = document.getElementById('missile-btn');

        setupEventListeners();
        debugLog("Initialization complete.");
    } catch (e) {
        debugLog("CRITICAL ERROR during init: " + e.message);
    }
});

// --- Classes ---

class BackgroundStar {
    constructor() {
        this.reset();
        this.y = Math.random() * canvas.height;
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = 0;
        this.depth = Math.random() * 3 + 1;
        this.radius = Math.random() * 1.5 / (this.depth * 0.5);
        this.baseAlpha = Math.random() * 0.5 + 0.3;
        this.alpha = this.baseAlpha;
        this.velocity = (Math.random() * 0.5 + 0.1) / (this.depth * 0.5);
        this.twinkleSpeed = Math.random() * 0.05 + 0.01;
        this.twinkleDir = 1;
        
        const tint = Math.random();
        if (tint > 0.8) this.color = '#cceeff';
        else if (tint < 0.2) this.color = '#ffffee';
        else this.color = 'white';
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha / (this.depth * 0.5);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.alpha += this.twinkleSpeed * this.twinkleDir;
        if (this.alpha > this.baseAlpha + 0.2 || this.alpha < this.baseAlpha - 0.2) {
            this.twinkleDir *= -1;
        }

        this.draw();
        this.y += this.velocity;
        if (this.y > canvas.height) {
            this.reset();
            this.y = 0;
        }
    }
}

class Planet {
    constructor(yStart) {
        this.resize(yStart);
    }

    resize(yStart) {
        this.radius = Math.random() * 50 + 30;
        let safe = false;
        let attempts = 0;
        
        while (!safe && attempts < 50) {
            this.x = Math.random() * (canvas.width - this.radius * 2) + this.radius;
            this.y = yStart !== undefined ? yStart : -this.radius - 50; 
            
            safe = true;
            for (let other of planets) {
                if (other === this) continue;
                const dist = Math.hypot(this.x - other.x, this.y - other.y);
                if (dist < this.radius + other.radius + 50) {
                    safe = false;
                    break;
                }
            }
            if(yStart !== undefined) break;
            attempts++;
        }
        
        this.velocity = Math.random() * 0.1 + 0.02;
        this.type = Math.random(); 
        this.features = [];

        if (this.type < 0.4) {
             this.planetType = 'GAS';
             const hue = Math.random() * 40 + 10; 
             this.colorBase = `hsl(${hue}, 70%, 50%)`;
             this.hasRing = Math.random() > 0.4;
             
             const numBands = Math.floor(Math.random() * 5 + 3);
             for(let i=0; i<numBands; i++) {
                 this.features.push({
                     y: (Math.random() - 0.5) * 2 * this.radius, 
                     h: Math.random() * 10 + 5,
                     color: `hsla(${hue}, ${60 + Math.random()*20}%, ${40 + Math.random()*20}%, 0.6)`
                 });
             }
        } else if (this.type < 0.7) {
             this.planetType = 'ICE';
             const hue = Math.random() * 40 + 180; 
             this.colorBase = `hsl(${hue}, 70%, 70%)`;
             this.hasRing = Math.random() > 0.8;
             
             const numCraters = Math.floor(Math.random() * 5 + 2);
             for(let i=0; i<numCraters; i++) {
                 this.features.push({
                     x: (Math.random() - 0.5) * 1.5 * this.radius,
                     y: (Math.random() - 0.5) * 1.5 * this.radius,
                     r: Math.random() * 10 + 2,
                     color: `hsla(${hue}, 80%, 90%, 0.4)`
                 });
             }
        } else {
             this.planetType = 'TERRA';
             const hue = Math.random() * 60 + 90; 
             this.colorBase = `hsl(${hue}, 50%, 40%)`;
             this.hasRing = false;
             
             const numContinents = Math.floor(Math.random() * 6 + 3);
             for(let i=0; i<numContinents; i++) {
                 this.features.push({
                     x: (Math.random() - 0.5) * 1.5 * this.radius,
                     y: (Math.random() - 0.5) * 1.5 * this.radius,
                     r: Math.random() * 15 + 5,
                     color: `hsla(${hue + 20}, 60%, 30%, 0.5)`
                 });
             }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowBlur = 30;
        ctx.shadowColor = this.colorBase;
        
        if (this.hasRing) {
             ctx.beginPath();
             ctx.ellipse(0, 0, this.radius * 2.2, this.radius * 0.6, 0.2, Math.PI, Math.PI * 2);
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
             ctx.lineWidth = this.radius * 0.1;
             ctx.stroke();
        }
        ctx.shadowBlur = 0; 

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.colorBase;
        ctx.fill();
        
        ctx.save();
        ctx.clip();
        
        if (this.planetType === 'GAS') {
            this.features.forEach(band => {
                ctx.fillStyle = band.color;
                ctx.fillRect(-this.radius, band.y, this.radius * 2, band.h);
            });
        } else {
            this.features.forEach(feat => {
                ctx.beginPath();
                ctx.arc(feat.x, feat.y, feat.r, 0, Math.PI * 2);
                ctx.fillStyle = feat.color;
                ctx.fill();
            });
        }
        
        const grad = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.2, 0, 0, this.radius);
        grad.addColorStop(0, 'rgba(255,255,255,0.1)');
        grad.addColorStop(0.5, 'transparent');
        grad.addColorStop(1, 'rgba(0,0,0,0.7)');
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore(); 
        
        if (this.hasRing) {
             ctx.beginPath();
             ctx.ellipse(0, 0, this.radius * 2.2, this.radius * 0.6, 0.2, 0, Math.PI);
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
             ctx.lineWidth = this.radius * 0.1;
             ctx.stroke();
        }
        ctx.restore();
    }

    update() {
        this.draw();
        this.y += this.velocity;
        if (this.y > canvas.height + this.radius + 50) {
            this.resize();
        }
    }
}

class PowerUp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.velocity = { x: 0, y: 2 };
        
        const rand = Math.random();
        if (rand < 0.33) {
            this.type = 'SPREAD';
            this.color = '#ffff00'; 
            this.label = 'S';
        } else if (rand < 0.66) {
            this.type = 'RAPID';
            this.color = '#ff003c'; 
            this.label = 'R';
        } else {
            this.type = 'SHIELD';
            this.color = '#00f3ff'; 
            this.label = 'H';
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = 'black';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.label, this.x, this.y);
    }

    update() {
        this.draw();
        this.y += this.velocity.y;
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20; 
        this.color = '#00f3ff';
        this.velocity = { x: 0, y: 0 };
        this.maxHp = 100;
        this.hp = 100;
        this.angle = 0;
        this.missiles = 3;
        this.missileTimer = 0;
        
        this.powerUps = {
            spread: 0,
            rapid: 0,
            shield: 0
        };
        this.fireCooldown = 0;
        this.enginePulse = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2); 
        
        this.enginePulse += 0.1;
        const glowSize = Math.sin(this.enginePulse) * 5 + 15;
        
        if (gameRunning && (keys.w || keys.a || keys.s || keys.d || joystickInput.active)) {
             ctx.shadowBlur = 20;
             ctx.shadowColor = '#0aff00';
             
             ctx.beginPath();
             ctx.fillStyle = '#0aff00';
             ctx.moveTo(-8, 25);
             ctx.lineTo(8, 25);
             ctx.lineTo(0, 25 + Math.random() * 20 + 10);
             ctx.fill();
             
             ctx.beginPath();
             ctx.moveTo(-15, 20);
             ctx.lineTo(-10, 20);
             ctx.lineTo(-12.5, 20 + Math.random() * 10);
             ctx.fill();
             
             ctx.beginPath();
             ctx.moveTo(15, 20);
             ctx.lineTo(10, 20);
             ctx.lineTo(12.5, 20 + Math.random() * 10);
             ctx.fill();
             
             ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.quadraticCurveTo(10, -5, 12, 15);
        ctx.lineTo(8, 25);
        ctx.lineTo(-8, 25);
        ctx.lineTo(-12, 15);
        ctx.quadraticCurveTo(-10, -5, 0, -25);
        
        const gradBody = ctx.createLinearGradient(0, -25, 0, 25);
        gradBody.addColorStop(0, '#00f3ff');
        gradBody.addColorStop(0.5, '#0055aa');
        gradBody.addColorStop(1, '#002244');
        ctx.fillStyle = gradBody;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00f3ff';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(12, 5);
        ctx.lineTo(35, 20);
        ctx.lineTo(12, 18);
        ctx.closePath();
        ctx.fillStyle = '#003366';
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(-12, 5);
        ctx.lineTo(-35, 20);
        ctx.lineTo(-12, 18);
        ctx.closePath();
        ctx.fillStyle = '#003366';
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 20);
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.ellipse(0, -5, 4, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
        
        if (this.powerUps.shield > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, 40, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 243, 255, ${Math.random() * 0.5 + 0.2})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = `rgba(0, 243, 255, 0.1)`;
            ctx.fill();
        }

        ctx.restore();
    }

    update() {
        if (mobileMode && joystickInput.active) {
             this.angle = Math.atan2(joystickInput.y, joystickInput.x);
        } else if (!mobileMode) {
             this.angle = Math.atan2(mouseY - this.y, mouseX - this.x);
        }
        
        this.draw();
        
        let moveX = 0;
        let moveY = 0;

        if (keys.w) moveY -= 1;
        if (keys.s) moveY += 1;
        if (keys.a) moveX -= 1;
        if (keys.d) moveX += 1;

        if (joystickInput.active) {
            moveX = joystickInput.x;
            moveY = joystickInput.y;
        }

        if (moveY < 0 && this.y > this.radius) this.velocity.y += moveY * PLAYER_ACCEL;
        if (moveY > 0 && this.y < canvas.height - this.radius) this.velocity.y += moveY * PLAYER_ACCEL;
        if (moveX < 0 && this.x > this.radius) this.velocity.x += moveX * PLAYER_ACCEL;
        if (moveX > 0 && this.x < canvas.width - this.radius) this.velocity.x += moveX * PLAYER_ACCEL;
        
        this.velocity.x *= PLAYER_FRICTION;
        this.velocity.y *= PLAYER_FRICTION;
        
        const speed = Math.hypot(this.velocity.x, this.velocity.y);
        if (speed > PLAYER_MAX_SPEED) {
            this.velocity.x = (this.velocity.x / speed) * PLAYER_MAX_SPEED;
            this.velocity.y = (this.velocity.y / speed) * PLAYER_MAX_SPEED;
        }

        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        if (this.x < this.radius) { this.x = this.radius; this.velocity.x *= -0.5; }
        if (this.x > canvas.width - this.radius) { this.x = canvas.width - this.radius; this.velocity.x *= -0.5; }
        if (this.y < this.radius) { this.y = this.radius; this.velocity.y *= -0.5; }
        if (this.y > canvas.height - this.radius) { this.y = canvas.height - this.radius; this.velocity.y *= -0.5; }
        
        if (this.missiles < 3) {
            this.missileTimer++;
            if (this.missileTimer > 300) {
                this.missiles++;
                this.missileTimer = 0;
                if(missileCountEl) missileCountEl.innerText = this.missiles;
            }
        }
        
        if (this.powerUps.spread > 0) this.powerUps.spread--;
        if (this.powerUps.rapid > 0) this.powerUps.rapid--;
        if (this.powerUps.shield > 0) this.powerUps.shield--;
        
        if (keys.space || keys.mouseLeft) {
             this.shoot();
        }
        if (this.fireCooldown > 0) this.fireCooldown--;
    }
    
    shoot() {
        if (this.fireCooldown > 0) return;
        
        const velocity = {
            x: Math.cos(this.angle) * BULLET_SPEED,
            y: Math.sin(this.angle) * BULLET_SPEED
        };

        if (this.powerUps.spread > 0) {
             projectiles.push(new Projectile(this.x, this.y, velocity, false));
             const angleLeft = this.angle - 0.2;
             const angleRight = this.angle + 0.2;
             projectiles.push(new Projectile(this.x, this.y, {
                 x: Math.cos(angleLeft) * BULLET_SPEED,
                 y: Math.sin(angleLeft) * BULLET_SPEED
             }, false));
             projectiles.push(new Projectile(this.x, this.y, {
                 x: Math.cos(angleRight) * BULLET_SPEED,
                 y: Math.sin(angleRight) * BULLET_SPEED
             }, false));
        } else {
             projectiles.push(new Projectile(this.x, this.y, velocity, false));
        }
        
        this.fireCooldown = (this.powerUps.rapid > 0) ? 5 : 15;
    }
    
    activatePowerUp(type) {
        if (type === 'SPREAD') this.powerUps.spread = 600;
        if (type === 'RAPID') this.powerUps.rapid = 600;
        if (type === 'SHIELD') {
            this.powerUps.shield = 600;
            this.hp = Math.min(this.hp + 20, this.maxHp); 
            this.updateHealthUI();
        }
    }
    
    fireMissile() {
        if (this.missiles > 0) {
            this.missiles--;
            if(missileCountEl) missileCountEl.innerText = this.missiles;
            projectiles.push(new Missile(this.x, this.y));
        }
    }
    
    takeDamage(amount) {
        if (this.powerUps.shield > 0) return;
        this.hp -= amount;
        screenShake = 5; 
        if (this.hp < 0) this.hp = 0;
        this.updateHealthUI();
        if (this.hp <= 0) endGame();
    }
    
    updateHealthUI() {
        const percent = (this.hp / this.maxHp) * 100;
        if(healthBarEl) healthBarEl.style.width = percent + '%';
    }
}

class Projectile {
    constructor(x, y, velocity, isEnemy) {
        this.x = x;
        this.y = y;
        this.velocity = velocity;
        this.radius = 3;
        this.isEnemy = isEnemy;
        this.color = isEnemy ? '#ff003c' : '#fff'; 
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.isEnemy ? '#ff003c' : '#00f3ff'; 
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    update() {
        this.draw();
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Missile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.velocity = { x: 0, y: 0 };
        this.radius = 6;
        this.color = '#ff00ff';
        this.target = null;
        this.speed = 0;
        this.maxSpeed = 10;
        this.accel = 0.5;
        this.angle = Math.random() * Math.PI * 2;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, 5);
        ctx.lineTo(-5, -5);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
        
        if (frames % 2 === 0) {
            particles.push(new Particle(this.x, this.y, '#ff00ff', true));
        }
    }
    
    update() {
        this.draw();
        if (!this.target || enemies.indexOf(this.target) === -1) {
            let minDist = Infinity;
            enemies.forEach(enemy => {
                const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (dist < minDist) {
                    minDist = dist;
                    this.target = enemy;
                }
            });
        }
        
        if (this.target) {
            const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            const deltaAngle = angleToTarget - this.angle;
            let da = deltaAngle;
            if (da > Math.PI) da -= Math.PI * 2;
            if (da < -Math.PI) da += Math.PI * 2;
            this.angle += da * 0.1; 
        }
        
        this.speed = Math.min(this.speed + this.accel, this.maxSpeed);
        this.velocity.x = Math.cos(this.angle) * this.speed;
        this.velocity.y = Math.sin(this.angle) * this.speed;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Enemy {
    constructor(x, y) {
        this.radius = Math.random() * 10 + 10;
        this.x = x;
        this.y = y;
        const colorHue = Math.random() * 60 + 300;
        this.color = `hsl(${colorHue}, 100%, 50%)`;
        this.speed = Math.random() * 1 + 1 + (score / 2000); 
        this.velocity = { x: 0, y: 0 };
        this.spin = 0;
        this.spinSpeed = Math.random() * 0.1 - 0.05;
        this.hp = Math.floor(this.radius / 10) + Math.floor(score / 3000); 
        this.shootTimer = Math.random() * 100 + 50; 
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.spin);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            ctx.lineTo(this.radius * Math.cos(i * Math.PI / 3), this.radius * Math.sin(i * Math.PI / 3));
        }
        ctx.closePath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.velocity.x = Math.cos(angle) * this.speed;
        this.velocity.y = Math.sin(angle) * this.speed;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.spin += this.spinSpeed;
        this.draw();
        this.shootTimer--;
        if (this.shootTimer <= 0) {
            this.shoot();
            this.shootTimer = Math.random() * 150 + 100;
        }
    }
    
    shoot() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        const velocity = {
            x: Math.cos(angle) * ENEMY_BULLET_SPEED,
            y: Math.sin(angle) * ENEMY_BULLET_SPEED
        };
        projectiles.push(new Projectile(this.x, this.y, velocity, true));
    }
}

class Particle {
    constructor(x, y, color, isTrail) {
        this.x = x;
        this.y = y;
        this.radius = isTrail ? Math.random() * 2 : Math.random() * 3;
        this.color = color;
        this.velocity = isTrail ? { x: 0, y: 0 } : {
            x: (Math.random() - 0.5) * 8,
            y: (Math.random() - 0.5) * 8
        };
        this.alpha = 1;
        this.isTrail = isTrail;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.draw();
        if (!this.isTrail) {
            this.velocity.x *= PARTICLE_FRICTION;
            this.velocity.y *= PARTICLE_FRICTION;
            this.x += this.velocity.x;
            this.y += this.velocity.y;
        }
        this.alpha -= this.isTrail ? 0.05 : 0.02;
    }
}

// --- Initialization ---
function init() {
    player = new Player(canvas.width / 2, canvas.height / 2);
    projectiles = [];
    enemies = [];
    particles = [];
    powerUps = [];
    stars = [];
    planets = [];
    score = 0;
    frames = 0;
    ENEMY_SPAWN_RATE = 2000;
    if (scoreEl) scoreEl.innerText = score;
    if (healthBarEl) healthBarEl.style.width = '100%';
    if (missileCountEl) missileCountEl.innerText = 3;
    
    for(let i=0; i<150; i++) {
        stars.push(new BackgroundStar());
    }
    
    planets.push(new Planet(Math.random() * canvas.height)); 
    planets.push(new Planet(Math.random() * canvas.height));
    planets.push(new Planet(Math.random() * canvas.height));
    planets.push(new Planet(Math.random() * canvas.height - canvas.height));
}

function spawnEnemies() {
    let currentSpawnRate = Math.max(800, 2000 - score / 10);
    if (frames % Math.floor(currentSpawnRate / 16) === 0) {
       const radius = 30;
       let x, y;
       if (Math.random() < 0.5) {
           x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius;
           y = Math.random() * canvas.height;
       } else {
           x = Math.random() * canvas.width;
           y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius;
       }
       enemies.push(new Enemy(x, y));
    }
}

// --- Game Loop ---
function animate() {
    if (!gameRunning) return;
    animationId = requestAnimationFrame(animate);
    frames++;
    
    let shakeX = 0;
    let shakeY = 0;
    if (screenShake > 0) {
        shakeX = Math.random() * screenShake - screenShake/2;
        shakeY = Math.random() * screenShake - screenShake/2;
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }
    
    ctx.save();
    ctx.translate(shakeX, shakeY); 
    ctx.fillStyle = 'rgba(5, 5, 16, 0.4)'; 
    ctx.fillRect(-shakeX, -shakeY, canvas.width, canvas.height);
    
    stars.forEach(star => star.update());
    planets.forEach(planet => planet.update());
    player.update();
    
    projectiles.forEach((projectile, index) => {
        projectile.update();
        let remove = false;
        if (
            projectile.x + projectile.radius < -50 ||
            projectile.x - projectile.radius > canvas.width + 50 ||
            projectile.y + projectile.radius < -50 ||
            projectile.y - projectile.radius > canvas.height + 50
        ) {
            remove = true;
        } else if (projectile instanceof Missile) {
            enemies.forEach((enemy, eIndex) => {
                const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
                if (dist - enemy.radius - projectile.radius < 5) {
                    for (let i = 0; i < 20; i++) particles.push(new Particle(enemy.x, enemy.y, '#ff00ff'));
                    screenShake = 10;
                    enemies.splice(eIndex, 1);
                    remove = true;
                    score += 500;
                    if (scoreEl) scoreEl.innerText = score;
                }
            });
        } else if (projectile.isEnemy) {
            const dist = Math.hypot(projectile.x - player.x, projectile.y - player.y);
            if (dist - projectile.radius - player.radius < 1) {
                player.takeDamage(10);
                for (let i = 0; i < 3; i++) particles.push(new Particle(projectile.x, projectile.y, projectile.color));
                remove = true;
            }
        }
        if (remove) projectiles.splice(index, 1);
    });
    
    powerUps.forEach((pup, index) => {
        pup.update();
        if (Math.hypot(player.x - pup.x, player.y - pup.y) - player.radius - pup.radius < 1) {
            player.activatePowerUp(pup.type);
            powerUps.splice(index, 1);
            score += 50;
            if (scoreEl) scoreEl.innerText = score;
        }
        if (pup.y > canvas.height) powerUps.splice(index, 1);
    });
    
    particles.forEach((particle, index) => {
        if (particle.alpha <= 0) particles.splice(index, 1);
        else particle.update();
    });

    spawnEnemies();
    enemies.forEach((enemy, index) => {
        enemy.update();
        projectiles.forEach((projectile, pIndex) => {
            if (projectile.isEnemy || projectile instanceof Missile) return; 
            const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
            if (dist - enemy.radius - projectile.radius < 1) {
                for (let i = 0; i < 8; i++) particles.push(new Particle(projectile.x, projectile.y, enemy.color));
                if (Math.random() < 0.15) powerUps.push(new PowerUp(enemy.x, enemy.y));
                screenShake = 2;
                score += 100;
                if (scoreEl) scoreEl.innerText = score;
                enemies.splice(index, 1);
                projectiles.splice(pIndex, 1);
            }
        });
        
        const distPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distPlayer - enemy.radius - player.radius < 1) {
             player.takeDamage(20); 
             for (let i = 0; i < 8; i++) particles.push(new Particle(enemy.x, enemy.y, enemy.color));
             enemies.splice(index, 1);
        }
    });
    ctx.restore();
}

function startGame(isMobile) {
    debugLog("Starting game: " + (isMobile ? "Mobile" : "Keyboard"));
    mobileMode = isMobile;
    init();
    gameRunning = true;
    if (startScreen) startScreen.classList.add('hidden');
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    
    if (mobileMode) {
        if (mobileControls) mobileControls.classList.remove('hidden');
    } else {
        if (mobileControls) mobileControls.classList.add('hidden');
    }
    
    animate();
}

function endGame() {
    debugLog("Game Over");
    gameRunning = false;
    cancelAnimationFrame(animationId);
    if (finalScoreEl) finalScoreEl.innerText = score;
    if (gameOverScreen) gameOverScreen.classList.remove('hidden');
    if (mobileControls) mobileControls.classList.add('hidden');
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (keys.hasOwnProperty(k)) keys[k] = true;
        if (e.key === 'ArrowUp') keys.w = true;
        if (e.key === 'ArrowDown') keys.s = true;
        if (e.key === 'ArrowLeft') keys.a = true;
        if (e.key === 'ArrowRight') keys.d = true;
        if (e.key === ' ') keys.space = true;
    });

    window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (keys.hasOwnProperty(k)) keys[k] = false;
        if (e.key === 'ArrowUp') keys.w = false;
        if (e.key === 'ArrowDown') keys.s = false;
        if (e.key === 'ArrowLeft') keys.a = false;
        if (e.key === 'ArrowRight') keys.d = false;
        if (e.key === ' ') keys.space = false;
    });

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
        if (!gameRunning) return;
        if (e.button === 0) { 
            keys.mouseLeft = true;
            if (player) player.shoot(); 
        } else if (e.button === 2) { 
            if (player) player.fireMissile();
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) keys.mouseLeft = false;
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    if (startBtnKeyboard) startBtnKeyboard.addEventListener('click', () => startGame(false));
    if (startBtnTouch) startBtnTouch.addEventListener('click', () => startGame(true));
    if (restartBtn) restartBtn.addEventListener('click', () => {
        if (startScreen) startScreen.classList.remove('hidden');
        if (gameOverScreen) gameOverScreen.classList.add('hidden');
        startGame(mobileMode);
    });

    window.addEventListener('resize', () => {
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
    });

    // --- Joystick & Button Logic ---
    if(joystickZone) {
        joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            handleJoystickStart(touch.clientX, touch.clientY);
        }, {passive: false});

        joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            handleJoystickMove(touch.clientX, touch.clientY);
        }, {passive: false});

        joystickZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleJoystickEnd();
        });

        joystickZone.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handleJoystickStart(e.clientX, e.clientY);
        });

        window.addEventListener('mousemove', (e) => {
            if (joystickInput.active) {
                e.preventDefault();
                handleJoystickMove(e.clientX, e.clientY);
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (joystickInput.active) {
                e.preventDefault();
                handleJoystickEnd();
            }
        });
    }

    function handleJoystickStart(clientX, clientY) {
        joystickInput.active = true;
        const rect = joystickZone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        updateJoystick(clientX, clientY, centerX, centerY);
    }

    function handleJoystickMove(clientX, clientY) {
        const rect = joystickZone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        updateJoystick(clientX, clientY, centerX, centerY);
    }

    function handleJoystickEnd() {
        joystickInput.active = false;
        joystickInput.x = 0;
        joystickInput.y = 0;
        if (joystickKnob) joystickKnob.style.transform = `translate(-50%, -50%)`;
    }
    
    function updateJoystick(touchX, touchY, centerX, centerY) {
        let dx = touchX - centerX;
        let dy = touchY - centerY;
        const dist = Math.hypot(dx, dy);
        const maxDist = 40; 
        if (dist > maxDist) {
            const angle = Math.atan2(dy, dx);
            dx = Math.cos(angle) * maxDist;
            dy = Math.sin(angle) * maxDist;
        }
        if (joystickKnob) joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        joystickInput.x = dx / maxDist;
        joystickInput.y = dy / maxDist;
    }

    if (fireBtn) {
        fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.mouseLeft = true; if(player) player.shoot(); }, {passive: false});
        fireBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys.mouseLeft = false; });
        fireBtn.addEventListener('mousedown', (e) => { e.preventDefault(); keys.mouseLeft = true; if(player) player.shoot(); });
        fireBtn.addEventListener('mouseup', (e) => { e.preventDefault(); keys.mouseLeft = false; });
        fireBtn.addEventListener('mouseleave', (e) => { e.preventDefault(); keys.mouseLeft = false; });
    }

    if (missileBtn) {
        missileBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if(player) player.fireMissile(); }, {passive: false});
        missileBtn.addEventListener('mousedown', (e) => { e.preventDefault(); if(player) player.fireMissile(); });
    }
}
