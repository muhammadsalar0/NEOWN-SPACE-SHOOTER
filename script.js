const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- Config ---
const PLAYER_ACCEL = 0.5;
const PLAYER_MAX_SPEED = 6;
const PLAYER_FRICTION = 0.94;
const BULLET_SPEED = 12;
const ENEMY_BULLET_SPEED = 5;
const PARTICLE_FRICTION = 0.95;
let ENEMY_SPAWN_RATE = 999;

// --- State ---
let gameRunning = false;
let score = 0;
let animationId;
let frames = 0;
let mouseX = 0;
let mouseY = 0;
let screenShake = 0;

// --- Elements ---
const scoreEl = document.getElementById('score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const healthBarEl = document.getElementById('health-bar');
const missileCountEl = document.getElementById('missile-count');

// --- Classes ---

class BackgroundStar {
    constructor() {
        this.reset();
        this.y = Math.random() * canvas.height; // Start randomly on screen
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = 0;
        this.depth = Math.random() * 3 + 1; // 1 (close) to 4 (far)
        this.radius = Math.random() * 1.5 / (this.depth * 0.5);
        this.baseAlpha = Math.random() * 0.5 + 0.3;
        this.alpha = this.baseAlpha;
        this.velocity = (Math.random() * 0.5 + 0.1) / (this.depth * 0.5);
        this.twinkleSpeed = Math.random() * 0.05 + 0.01;
        this.twinkleDir = 1;
        
        // Slight tint
        const tint = Math.random();
        if (tint > 0.8) this.color = '#cceeff'; // blueish
        else if (tint < 0.2) this.color = '#ffffee'; // yellowish
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
        // Twinkle
        this.alpha += this.twinkleSpeed * this.twinkleDir;
        if (this.alpha > this.baseAlpha + 0.2 || this.alpha < this.baseAlpha - 0.2) {
            this.twinkleDir *= -1;
        }

        this.draw();
        this.y += this.velocity;
        if (this.y > canvas.height) {
            this.reset();
            this.y = 0; // Ensure it starts at top
        }
    }
}

class Planet {
    constructor(yStart) {
        this.resize(yStart);
    }

    resize(yStart) {
        this.radius = Math.random() * 50 + 30; // 30 to 80 radius
        
        // Anti-overlap logic
        let safe = false;
        let attempts = 0;
        
        while (!safe && attempts < 50) {
            this.x = Math.random() * (canvas.width - this.radius * 2) + this.radius;
            this.y = yStart !== undefined ? yStart : -this.radius - 50; 
            
            // Check collision with other planets
            safe = true;
            for (let other of planets) {
                if (other === this) continue;
                const dist = Math.hypot(this.x - other.x, this.y - other.y);
                if (dist < this.radius + other.radius + 50) { // 50px buffer
                    safe = false;
                    break;
                }
            }
            if(yStart !== undefined) break; // Don't retry Y for initial spawn, just X
            attempts++;
        }
        
        this.velocity = Math.random() * 0.1 + 0.02; // Slow drift
        this.type = Math.random(); 
        this.features = [];

        // Colors & Features (Same as before)
        if (this.type < 0.4) { // Gas Giant
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
             
        } else if (this.type < 0.7) { // Ice World
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

        } else { // Terrestrial
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
            this.resize(); // Will find new safe spot at top
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
        this.radius = 20; // Slightly larger hitbox for visual alignment
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
        
        // Engine Glow
        this.enginePulse += 0.1;
        const glowSize = Math.sin(this.enginePulse) * 5 + 15;
        
        // Thrusters (Moving)
        if (gameRunning && (keys.w || keys.a || keys.s || keys.d)) {
             ctx.shadowBlur = 20;
             ctx.shadowColor = '#0aff00';
             
             // Main Thruster
             ctx.beginPath();
             ctx.fillStyle = '#0aff00';
             ctx.moveTo(-8, 25);
             ctx.lineTo(8, 25);
             ctx.lineTo(0, 25 + Math.random() * 20 + 10);
             ctx.fill();
             
             // Side Thrusters
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

        // Ship Body Design
        // Main Fuselage
        ctx.beginPath();
        ctx.moveTo(0, -25); // Nose
        ctx.quadraticCurveTo(10, -5, 12, 15); // Right Side
        ctx.lineTo(8, 25); // Right Engine
        ctx.lineTo(-8, 25); // Left Engine
        ctx.lineTo(-12, 15); // Left Side
        ctx.quadraticCurveTo(-10, -5, 0, -25); // Left Curve to Nose
        
        const gradBody = ctx.createLinearGradient(0, -25, 0, 25);
        gradBody.addColorStop(0, '#00f3ff');
        gradBody.addColorStop(0.5, '#0055aa');
        gradBody.addColorStop(1, '#002244');
        ctx.fillStyle = gradBody;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00f3ff';
        ctx.stroke();
        
        // Wings
        ctx.beginPath();
        ctx.moveTo(12, 5);
        ctx.lineTo(35, 20); // Wing Tip
        ctx.lineTo(12, 18); // Wing Back
        ctx.closePath();
        ctx.fillStyle = '#003366';
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(-12, 5);
        ctx.lineTo(-35, 20); // Wing Tip
        ctx.lineTo(-12, 18); // Wing Back
        ctx.closePath();
        ctx.fillStyle = '#003366';
        ctx.fill();
        ctx.stroke();
        
        // Detail Lines
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 20);
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)';
        ctx.stroke();
        
        // Cockpit
        ctx.beginPath();
        ctx.ellipse(0, -5, 4, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
        
        // Shield Visual
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
        this.angle = Math.atan2(mouseY - this.y, mouseX - this.x);
        this.draw();
        
        // Movement Physics
        if (keys.w && this.y > this.radius) this.velocity.y -= PLAYER_ACCEL;
        if (keys.s && this.y < canvas.height - this.radius) this.velocity.y += PLAYER_ACCEL;
        if (keys.a && this.x > this.radius) this.velocity.x -= PLAYER_ACCEL;
        if (keys.d && this.x < canvas.width - this.radius) this.velocity.x += PLAYER_ACCEL;
        
        this.velocity.x *= PLAYER_FRICTION;
        this.velocity.y *= PLAYER_FRICTION;
        
        const speed = Math.hypot(this.velocity.x, this.velocity.y);
        if (speed > PLAYER_MAX_SPEED) {
            this.velocity.x = (this.velocity.x / speed) * PLAYER_MAX_SPEED;
            this.velocity.y = (this.velocity.y / speed) * PLAYER_MAX_SPEED;
        }

        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        // Bounds
        if (this.x < this.radius) { this.x = this.radius; this.velocity.x *= -0.5; }
        if (this.x > canvas.width - this.radius) { this.x = canvas.width - this.radius; this.velocity.x *= -0.5; }
        if (this.y < this.radius) { this.y = this.radius; this.velocity.y *= -0.5; }
        if (this.y > canvas.height - this.radius) { this.y = canvas.height - this.radius; this.velocity.y *= -0.5; }
        
        // Reload Missiles
        if (this.missiles < 3) {
            this.missileTimer++;
            if (this.missileTimer > 300) {
                this.missiles++;
                this.missileTimer = 0;
                if(missileCountEl) missileCountEl.innerText = this.missiles;
            }
        }
        
        // PowerUp Timers
        if (this.powerUps.spread > 0) this.powerUps.spread--;
        if (this.powerUps.rapid > 0) this.powerUps.rapid--;
        if (this.powerUps.shield > 0) this.powerUps.shield--;
        
        // Auto Fire if Rapid or Mouse Held
        if (keys.space || keys.mouseLeft) {
             this.shoot();
        }
        if (this.fireCooldown > 0) this.fireCooldown--;
    }
    
    shoot() {
        if (this.fireCooldown > 0) return;
        
        // Bullet spread logic
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
        
        // Rapid Fire Cooldown
        this.fireCooldown = (this.powerUps.rapid > 0) ? 5 : 15;
    }
    
    activatePowerUp(type) {
        if (type === 'SPREAD') this.powerUps.spread = 600; // 10s
        if (type === 'RAPID') this.powerUps.rapid = 600; // 10s
        if (type === 'SHIELD') {
            this.powerUps.shield = 600; // 10s
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
        if (this.powerUps.shield > 0) {
            return;
        }
        
        this.hp -= amount;
        screenShake = 5; 
        if (this.hp < 0) this.hp = 0;
        
        this.updateHealthUI();
        
        if (this.hp <= 0) {
            endGame();
        }
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
            this.shootTimer = Math.random() * 150 + 100; // Reset timer
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

// --- Global Arrays ---
let player;
let projectiles = [];
let enemies = [];
let particles = [];
let powerUps = [];
let stars = [];
let planets = [];
let keys = { w: false, a: false, s: false, d: false, space: false, mouseLeft: false };

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
    ENEMY_SPAWN_RATE = 1000;
    scoreEl.innerText = score;
    if (healthBarEl) healthBarEl.style.width = '100%';
    if (missileCountEl) missileCountEl.innerText = 3;
    
    for(let i=0; i<150; i++) {
        stars.push(new BackgroundStar());
    }
    
    // Create Planets
    planets.push(new Planet(Math.random() * canvas.height)); 
    planets.push(new Planet(Math.random() * canvas.height));
    planets.push(new Planet(Math.random() * canvas.height));
    planets.push(new Planet(Math.random() * canvas.height - canvas.height)); // Off-screen
}

function spawnEnemies() {
    let currentSpawnRate = Math.max(400, 1000 - score / 5);
    
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
    
    // Screen Shake
    let shakeX = 0;
    let shakeY = 0;
    if (screenShake > 0) {
        shakeX = Math.random() * screenShake - screenShake/2;
        shakeY = Math.random() * screenShake - screenShake/2;
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }
    
    // Clear screen
    ctx.save();
    ctx.translate(shakeX, shakeY); 
    
    ctx.fillStyle = 'rgba(5, 5, 16, 0.4)'; 
    ctx.fillRect(-shakeX, -shakeY, canvas.width, canvas.height);
    
    stars.forEach(star => star.update());
    planets.forEach(planet => planet.update());
    
    player.update();
    
    // Projectiles & Missiles
    projectiles.forEach((projectile, index) => {
        projectile.update();
        
        let remove = false;
        
        // Remove off-screen including margin
        if (
            projectile.x + projectile.radius < -50 ||
            projectile.x - projectile.radius > canvas.width + 50 ||
            projectile.y + projectile.radius < -50 ||
            projectile.y - projectile.radius > canvas.height + 50
        ) {
            remove = true;
        } else if (projectile instanceof Missile) {
            // Missile Collision Logic
            enemies.forEach((enemy, eIndex) => {
                const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
                if (dist - enemy.radius - projectile.radius < 5) {
                    for (let i = 0; i < 20; i++) {
                        particles.push(new Particle(enemy.x, enemy.y, '#ff00ff'));
                    }
                    screenShake = 10;
                    enemies.splice(eIndex, 1);
                    remove = true;
                    score += 500;
                    scoreEl.innerText = score;
                }
            });
        } else if (projectile.isEnemy) {
            const dist = Math.hypot(projectile.x - player.x, projectile.y - player.y);
            if (dist - projectile.radius - player.radius < 1) {
                player.takeDamage(10);
                for (let i = 0; i < 3; i++) {
                    particles.push(new Particle(projectile.x, projectile.y, projectile.color));
                }
                remove = true;
            }
        }
        
        if (remove) {
            projectiles.splice(index, 1);
        }
    });
    
    // PowerUps
    powerUps.forEach((pup, index) => {
        pup.update();
        if (Math.hypot(player.x - pup.x, player.y - pup.y) - player.radius - pup.radius < 1) {
            player.activatePowerUp(pup.type);
            powerUps.splice(index, 1);
            score += 50;
            scoreEl.innerText = score;
        }
        if (pup.y > canvas.height) powerUps.splice(index, 1);
    });
    
    // Particles
    particles.forEach((particle, index) => {
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        } else {
            particle.update();
        }
    });

    // Enemies
    spawnEnemies();
    enemies.forEach((enemy, index) => {
        enemy.update();
        
        // Collision: Projectile hit Enemy
        projectiles.forEach((projectile, pIndex) => {
            if (projectile.isEnemy || projectile instanceof Missile) return; 
            
            const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
            
            if (dist - enemy.radius - projectile.radius < 1) {
                for (let i = 0; i < 8; i++) {
                    particles.push(new Particle(projectile.x, projectile.y, enemy.color));
                }
                
                if (Math.random() < 0.15) {
                    powerUps.push(new PowerUp(enemy.x, enemy.y));
                }
                screenShake = 2;
                score += 100;
                scoreEl.innerText = score;
                
                enemies.splice(index, 1);
                projectiles.splice(pIndex, 1);
            }
        });
        
        // Collision: Enemy hit Player
        const distPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distPlayer - enemy.radius - player.radius < 1) {
             player.takeDamage(20); 
             for (let i = 0; i < 8; i++) {
                particles.push(new Particle(enemy.x, enemy.y, enemy.color));
             }
             enemies.splice(index, 1);
        }
    });
    
    ctx.restore();
}

function startGame() {
    init();
    gameRunning = true;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    animate();
}

function endGame() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    finalScoreEl.innerText = score;
    gameOverScreen.classList.remove('hidden');
}

// --- Event Listeners ---
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
        player.shoot(); // First shot instant
    } else if (e.button === 2) { 
        player.fireMissile();
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 0) keys.mouseLeft = false;
});

window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
