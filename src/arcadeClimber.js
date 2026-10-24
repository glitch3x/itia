/**
 * ITIA // THE MAD ASCENT (ARCADE REFLEX LADDER CLIMBER)
 * High-speed rhythm & reflex climb into the ITIA void.
 * Features rising thermal disintegrator, crumbling laser rungs, hyper-drive combos,
 * and high altitude scoring.
 */

class ArcadeClimber {
  constructor() {
    this.canvas = document.getElementById('ascent-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.container = this.canvas.parentElement;

    // Game State
    this.isPlaying = false;
    this.isGameOver = false;
    this.score = 0;
    this.altitude = 0; // In meters
    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;
    this.energy = 0; // 0 to 100 (Hyper Drive)
    this.highScore = parseInt(localStorage.getItem('itia_ascent_best') || '0', 10);

    // Player State
    this.player = {
      side: 'left', // 'left', 'right', 'jumping'
      rungIndex: 0,
      visualY: 0,
      targetY: 0,
      x: 0,
      targetX: 0,
      vy: 0,
      animFrame: 0
    };

    // Ladder Rungs Data
    // Rung structure: { index, side: 'left'|'right'|'both'|'hazard'|'broken', hasOrb: boolean, cracked: boolean }
    this.rungs = [];
    this.cameraY = 0;
    this.disintegratorY = -200; // Rising danger from bottom
    this.disintegratorSpeed = 1.2;

    this.rungHeight = 70;
    this.ladderWidth = 180;
    this.centerX = 0;

    // Particle FX
    this.particles = [];

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindControls();
    this.updateHUD();
  }

  resize() {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    this.width = rect.width;
    this.height = rect.height;
    this.centerX = this.width / 2;
  }

  bindControls() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      // Only process when ascent view is active
      const ascentView = document.getElementById('view-ascent');
      if (!ascentView || !ascentView.classList.contains('active')) return;

      if (!this.isPlaying) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          this.startGame();
        }
        return;
      }

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        this.step('left');
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        this.step('right');
      } else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.jump();
      }
    });

    // Touch / On-screen buttons
    const leftBtn = document.getElementById('touch-left-btn');
    const rightBtn = document.getElementById('touch-right-btn');
    const jumpBtn = document.getElementById('touch-jump-btn');
    const playBtn = document.getElementById('ascent-play-btn');
    const retryBtn = document.getElementById('ascent-retry-btn');

    if (leftBtn) leftBtn.addEventListener('click', () => this.step('left'));
    if (rightBtn) rightBtn.addEventListener('click', () => this.step('right'));
    if (jumpBtn) jumpBtn.addEventListener('click', () => this.jump());
    if (playBtn) playBtn.addEventListener('click', () => this.startGame());
    if (retryBtn) retryBtn.addEventListener('click', () => this.startGame());
  }

  startGame() {
    window.soundFx.playClick();
    this.isPlaying = true;
    this.isGameOver = false;
    this.score = 0;
    this.altitude = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 100;
    this.energy = 0;
    this.disintegratorY = -350;
    this.disintegratorSpeed = 1.0;
    this.particles = [];

    // Hide overlays
    const overlay = document.getElementById('ascent-overlay');
    const startCard = document.getElementById('ascent-start-card');
    const goCard = document.getElementById('ascent-gameover-card');
    if (overlay) overlay.classList.add('hidden');
    if (startCard) startCard.classList.add('hidden');
    if (goCard) goCard.classList.add('hidden');

    this.initLadder();

    this.player.rungIndex = 0;
    this.player.side = 'left';
    this.player.visualY = 0;
    this.player.targetY = 0;
    this.cameraY = 0;

    this.updateHUD();
    window.soundFx.startAmbientDrone();
    this.lastTime = performance.now();
    this.gameLoop();
  }

  initLadder() {
    this.rungs = [];
    // First 4 rungs are safe starter rungs
    for (let i = 0; i < 4; i++) {
      this.rungs.push({
        index: i,
        type: 'safe',
        leftValid: true,
        rightValid: true,
        hasOrb: false
      });
    }

    // Procedural generation of subsequent rungs
    for (let i = 4; i < 60; i++) {
      this.addNextRung(i);
    }
  }

  addNextRung(index) {
    const rand = Math.random();
    let type = 'safe';
    let leftValid = true;
    let rightValid = true;

    // Difficulty scales with index / altitude
    if (index > 8) {
      if (rand < 0.28) {
        // Left side trap / void gap
        leftValid = false;
        rightValid = true;
        type = 'left-gap';
      } else if (rand < 0.56) {
        // Right side trap / void gap
        leftValid = true;
        rightValid = false;
        type = 'right-gap';
      } else if (rand < 0.72) {
        // Hazard gap across both (must jump)
        leftValid = false;
        rightValid = false;
        type = 'hazard';
      } else {
        // Both sides valid
        type = 'safe';
      }
    }

    this.rungs.push({
      index,
      type,
      leftValid,
      rightValid,
      hasOrb: Math.random() < 0.35,
      cracked: Math.random() < 0.2
    });
  }

  step(direction) {
    if (!this.isPlaying || this.isGameOver) return;

    const nextIndex = this.player.rungIndex + 1;
    let nextRung = this.rungs[nextIndex];

    if (!nextRung) {
      this.addNextRung(nextIndex);
      nextRung = this.rungs[nextIndex];
    }

    // Validate step
    const isValid = direction === 'left' ? nextRung.leftValid : nextRung.rightValid;

    if (!isValid) {
      // Stepped into void trap / cracked gap!
      this.triggerDeath('Stepped into the void');
      return;
    }

    // Successful step!
    this.player.rungIndex = nextIndex;
    this.player.side = direction;
    this.altitude = nextIndex;

    // Points & Combo
    this.comboTimer = 100;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    const mult = Math.min(Math.floor(this.combo / 5) + 1, 8);
    let stepScore = 50 * mult;

    // Orb pickup
    if (nextRung.hasOrb) {
      nextRung.hasOrb = false;
      stepScore += 250 * mult;
      this.energy = Math.min(this.energy + 15, 100);
      this.spawnSparks(this.player.x, this.player.targetY, '#00f0ff', 12);
      window.soundFx.playZap();
    } else {
      window.soundFx.playStep(400 + (this.combo % 12) * 30);
    }

    this.score += stepScore;

    // Trigger Hyper Overdrive if energy maxed
    if (this.energy >= 100) {
      window.soundFx.playOverdrive();
      if (window.fractalBg) window.fractalBg.pulse(2.5);
      this.score += 1000;
      this.energy = 0;
      this.spawnSparks(this.centerX, this.player.targetY, '#ff2a5f', 30);
    }

    // Generate more rungs ahead
    if (this.rungs.length - nextIndex < 25) {
      for (let k = 0; k < 20; k++) {
        this.addNextRung(this.rungs.length);
      }
    }

    this.updateHUD();
  }

  jump() {
    if (!this.isPlaying || this.isGameOver) return;

    // Jump clears an entire hazard gap (skips 1 rung or leaps over gap)
    window.soundFx.playJump();
    const skipIndex = this.player.rungIndex + 2;
    let landingRung = this.rungs[skipIndex];

    if (!landingRung) {
      this.addNextRung(skipIndex);
      landingRung = this.rungs[skipIndex];
    }

    // Landing must have at least one valid rung
    if (!landingRung.leftValid && !landingRung.rightValid) {
      this.triggerDeath('Leaped into double hazard');
      return;
    }

    // Auto land on the valid side
    this.player.side = landingRung.leftValid ? 'left' : 'right';
    this.player.rungIndex = skipIndex;
    this.altitude = skipIndex;

    this.combo += 2;
    this.score += 200;
    this.spawnSparks(this.centerX, this.player.targetY, '#f59e0b', 16);

    this.updateHUD();
  }

  triggerDeath(cause) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isPlaying = false;

    window.soundFx.playLoss();
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 400);

    // Save High Score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('itia_ascent_best', this.highScore.toString());
    }

    // Calculate Grade
    let grade = 'D';
    if (this.altitude > 80) grade = 'S+ // ASCENDED';
    else if (this.altitude > 50) grade = 'A // MASTER';
    else if (this.altitude > 30) grade = 'B // ADEPT';
    else if (this.altitude > 15) grade = 'C // ROOKIE';

    // Show Game Over Modal
    const overlay = document.getElementById('ascent-overlay');
    const goCard = document.getElementById('ascent-gameover-card');
    const goAlt = document.getElementById('go-altitude');
    const goScore = document.getElementById('go-score');
    const goCombo = document.getElementById('go-combo');
    const goGrade = document.getElementById('go-grade');

    if (overlay && goCard) {
      if (goAlt) goAlt.textContent = `${this.altitude}M`;
      if (goScore) goScore.textContent = this.score.toLocaleString();
      if (goCombo) goCombo.textContent = `x${this.maxCombo}`;
      if (goGrade) goGrade.textContent = grade;

      overlay.classList.remove('hidden');
      goCard.classList.remove('hidden');
    }

    this.updateHUD();
  }

  spawnSparks(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.7) * 8,
        size: Math.random() * 3 + 1,
        color,
        alpha: 1.0
      });
    }
  }

  update(dt) {
    if (!this.isPlaying) return;

    // Player position interpolation
    const targetPlayerY = this.player.rungIndex * this.rungHeight;
    this.player.visualY += (targetPlayerY - this.player.visualY) * 0.25;

    const leftX = this.centerX - this.ladderWidth / 2;
    const rightX = this.centerX + this.ladderWidth / 2;
    const targetX = this.player.side === 'left' ? leftX : rightX;
    this.player.x += (targetX - this.player.x) * 0.25;

    // Camera tracks slightly above player
    const targetCamY = this.player.visualY - this.height * 0.45;
    this.cameraY += (targetCamY - this.cameraY) * 0.15;

    // Disintegrator Wall ascends from below
    this.disintegratorSpeed = 1.0 + Math.min(this.altitude * 0.03, 3.5);
    this.disintegratorY += this.disintegratorSpeed;

    // Check if disintegrator engulfed player
    if (this.disintegratorY >= this.player.visualY - 20) {
      this.triggerDeath('Vaporized by Thermal Disintegrator');
      return;
    }

    // Combo timer decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt * 0.08;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.updateHUD();
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    this.ctx.save();
    // Invert coordinate space so ascending moves camera up
    this.ctx.translate(0, this.height - (this.cameraY));

    const leftRailX = this.centerX - this.ladderWidth / 2;
    const rightRailX = this.centerX + this.ladderWidth / 2;

    // Vertical Ladder Rails
    const viewBottom = this.cameraY - this.height;
    const viewTop = this.cameraY + this.height * 2;

    this.ctx.beginPath();
    this.ctx.moveTo(leftRailX, -200);
    this.ctx.lineTo(leftRailX, viewTop);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(rightRailX, -200);
    this.ctx.lineTo(rightRailX, viewTop);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    this.ctx.lineWidth = 4;
    // Render Monumental ITIA Letters behind Ladder Rungs
    const letters = ['A', 'I', 'T', 'I'];
    const rungsPerLetter = 10;
    const rungsPerCycle = 40;

    // Determine range of letters in view
    const startCycle = Math.max(0, Math.floor((viewBottom / this.rungHeight) / rungsPerCycle));
    const endCycle = Math.ceil((viewTop / this.rungHeight) / rungsPerCycle) + 1;

    for (let c = startCycle; c <= endCycle; c++) {
      letters.forEach((char, lIdx) => {
        const centerRung = c * rungsPerCycle + lIdx * rungsPerLetter + 5;
        const letterY = centerRung * this.rungHeight;

        if (letterY >= viewBottom - 100 && letterY <= viewTop + 100) {
          this.ctx.save();
          this.ctx.font = '900 130px "Cinzel", serif';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          this.ctx.fillText(char, this.centerX, letterY);

          this.ctx.strokeStyle = lIdx % 2 === 0 ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 42, 95, 0.15)';
          this.ctx.lineWidth = 2;
          this.ctx.strokeText(char, this.centerX, letterY);

          // Tier Tag
          this.ctx.font = '700 10px "JetBrains Mono", monospace';
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          this.ctx.fillText(`ITIA [ ${char} ] // LEVEL ${c + 1}`, this.centerX, letterY + 65);
          this.ctx.restore();
        }
      });
    }

    // Render Rungs in view
    this.rungs.forEach(r => {
      const rungY = r.index * this.rungHeight;
      if (rungY < viewBottom - 100 || rungY > viewTop + 100) return;

      // Draw horizontal rung connectors
      if (r.type === 'hazard') {
        // Broken electrified void hazard
        this.ctx.beginPath();
        this.ctx.moveTo(leftRailX, rungY);
        this.ctx.lineTo(this.centerX - 20, rungY + 6);
        this.ctx.moveTo(this.centerX + 20, rungY - 6);
        this.ctx.lineTo(rightRailX, rungY);
        this.ctx.strokeStyle = '#ff2a5f';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Warning Hazard Icon
        this.ctx.fillStyle = '#ff2a5f';
        this.ctx.font = '10px JetBrains Mono';
        this.ctx.fillText('⚠ VOID', this.centerX - 18, rungY + 3);
        return;
      }

      // Left segment
      this.ctx.beginPath();
      this.ctx.moveTo(leftRailX, rungY);
      this.ctx.lineTo(this.centerX, rungY);
      this.ctx.strokeStyle = r.leftValid ? 'rgba(0, 240, 255, 0.7)' : 'rgba(255, 42, 95, 0.2)';
      this.ctx.lineWidth = r.leftValid ? 3 : 1;
      this.ctx.stroke();

      // Right segment
      this.ctx.beginPath();
      this.ctx.moveTo(this.centerX, rungY);
      this.ctx.lineTo(rightRailX, rungY);
      this.ctx.strokeStyle = r.rightValid ? 'rgba(0, 240, 255, 0.7)' : 'rgba(255, 42, 95, 0.2)';
      this.ctx.lineWidth = r.rightValid ? 3 : 1;
      this.ctx.stroke();

      // Rung Joint
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(this.centerX, rungY, 3, 0, Math.PI * 2);
      this.ctx.fill();

      // Art Orb Pickup
      if (r.hasOrb) {
        const orbX = r.leftValid ? leftRailX + 30 : rightRailX - 30;
        this.ctx.save();
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.beginPath();
        this.ctx.arc(orbX, rungY, 6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    });

    // Render Disintegrator Hazard Line
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 42, 95, 0.25)';
    this.ctx.fillRect(0, -500, this.width, this.disintegratorY + 500);

    this.ctx.beginPath();
    this.ctx.moveTo(0, this.disintegratorY);
    this.ctx.lineTo(this.width, this.disintegratorY);
    this.ctx.strokeStyle = '#ff2a5f';
    this.ctx.lineWidth = 6;
    this.ctx.shadowColor = '#ff2a5f';
    this.ctx.shadowBlur = 16;
    this.ctx.stroke();
    this.ctx.restore();

    // Render Player
    this.ctx.save();
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 14;

    // Cyber Avatar Core
    this.ctx.fillStyle = '#ff2a5f';
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.visualY, 12, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.visualY, 6, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();

    // Render Particles
    this.particles.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;
    });

    this.ctx.restore();
  }

  gameLoop(time = performance.now()) {
    const dt = time - this.lastTime;
    this.lastTime = time;

    this.update(dt);
    this.render();

    if (this.isPlaying) {
      requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  updateHUD() {
    const altEl = document.getElementById('ascent-altitude');
    const scoreEl = document.getElementById('ascent-score');
    const comboEl = document.getElementById('ascent-combo');
    const bestEl = document.getElementById('ascent-best');
    const energyFill = document.getElementById('ascent-energy-fill');

    if (altEl) altEl.innerHTML = `${this.altitude}<span class="unit">M</span>`;
    if (scoreEl) scoreEl.textContent = this.score.toLocaleString();
    if (comboEl) comboEl.textContent = `x${this.combo}`;
    if (bestEl) bestEl.innerHTML = `${this.highScore}<span class="unit">PTS</span>`;
    if (energyFill) energyFill.style.width = `${this.energy}%`;

    // Update ITIA Monolith Matrix in HUD
    const cyclePos = this.altitude % 40;
    const mI1 = document.getElementById('matrix-I1');
    const mT = document.getElementById('matrix-T');
    const mI2 = document.getElementById('matrix-I2');
    const mA = document.getElementById('matrix-A');

    if (mI1 && mT && mI2 && mA) {
      [mI1, mT, mI2, mA].forEach(el => el.classList.remove('active', 'passed'));

      if (cyclePos < 10) {
        mA.classList.add('active');
      } else if (cyclePos < 20) {
        mA.classList.add('passed');
        mI2.classList.add('active');
      } else if (cyclePos < 30) {
        mA.classList.add('passed');
        mI2.classList.add('passed');
        mT.classList.add('active');
      } else {
        mA.classList.add('passed');
        mI2.classList.add('passed');
        mT.classList.add('passed');
        mI1.classList.add('active');
      }
    }

    // Check for ITIA cycle milestone
    const currentCompletedCycles = Math.floor(this.altitude / 40);
    if (currentCompletedCycles > (this.lastCompletedCycles || 0)) {
      this.lastCompletedCycles = currentCompletedCycles;
      this.score += 2500;
      window.soundFx.playWin();
      if (window.fractalBg) window.fractalBg.pulse(2.5);
      if (window.ghostLeg) window.ghostLeg.showToast(`✦ ITIA MONOLITH ${currentCompletedCycles} ASCENDED! +2,500 PTS ✦`);
    }
  }
}

// Global instance
window.arcadeClimber = new ArcadeClimber();
