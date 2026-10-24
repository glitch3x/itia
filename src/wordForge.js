/**
 * ITIA // WORD FORGE: SUIKA PHYSICS DROP
 * The Ultimate "Make the Word ITIA" Game.
 * Drop glowing letter spheres into the containment vessel.
 * Merge identical runes on impact:
 *   [ I ] + [ I ]       ➔ [ T ] (Crossbeam)
 *   [ T ] + [ T ]       ➔ [ I ] (Golden Pillar)
 *   [ I ] + [ I ]       ➔ [ A ] (Genesis Apex)
 *   [ A ] + [ A ]       ➔ [ ITIA ] (THE ART SINGULARITY!)
 *   [ ITIA ] + [ ITIA ] ➔ ✦ COSMIC TRANSCENDENCE ✦
 */

class WordForge {
  constructor() {
    this.canvas = document.getElementById('forge-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.container = document.getElementById('forge-canvas-container');

    // High Score Persistence
    this.highScore = parseInt(localStorage.getItem('itia_forge_best') || '0', 10);
    this.score = 0;
    this.wordsMade = 0; // Number of ITIA Singularities synthesized
    this.combo = 1;
    this.unlockedArtCount = 0;
    this.isPlaying = true;
    this.isGameOver = false;

    // Dropper State
    this.dropperX = 300;
    this.canDrop = true;
    this.dropCooldown = 400; // ms
    this.nextTier = 1; // 1 = I, 2 = T
    this.currentDropTier = 1;

    // Physics World Configuration
    this.gravity = 0.28;
    this.friction = 0.985;
    this.bounce = 0.35;
    this.spheres = [];
    this.particles = [];

    // Vessel / Container Bounds (calculated in resize)
    this.vessel = {
      x: 0,
      y: 0,
      width: 440,
      height: 520,
      dangerY: 0
    };

    // Tier Definitions
    this.tiers = [
      { tier: 1, label: 'I', name: 'CYAN RUNE', radius: 18, color: '#00f0ff', points: 10, mass: 1 },
      { tier: 2, label: 'T', name: 'CROSSBEAM', radius: 26, color: '#ff2a5f', points: 30, mass: 1.6 },
      { tier: 3, label: 'I', name: 'GOLDEN PILLAR', radius: 36, color: '#f59e0b', points: 90, mass: 2.4 },
      { tier: 4, label: 'A', name: 'GENESIS APEX', radius: 48, color: '#10b981', points: 250, mass: 3.5 },
      { tier: 5, label: 'ITIA', name: 'ART SINGULARITY', radius: 64, color: '#a855f7', points: 1000, mass: 5.5, isSingularity: true },
      { tier: 6, label: '✦ ITIA ✦', name: 'TRANSCENDENCE', radius: 82, color: '#ffffff', points: 5000, mass: 8.5, isSuper: true }
    ];

    // Generative Fine Art Archive
    this.artworks = [
      { title: 'GENESIS SINGULARITY', subtitle: 'Fractal Tendril Synthesis', palette: ['#07070a', '#ffffff', '#ff2a5f'] },
      { title: 'VERMILION BLOSSOM', subtitle: 'Chromatic Sakura Eclipse', palette: ['#0d0208', '#ff2a5f', '#00f0ff'] },
      { title: 'OBSIDIAN APEX', subtitle: 'Geometric Monolith Architecture', palette: ['#050508', '#f59e0b', '#ffffff'] },
      { title: 'CYBER FLEUR', subtitle: 'Bio-Digital Organic Ink', palette: ['#040a08', '#10b981', '#a855f7'] },
      { title: 'ETHEREAL DRIFT', subtitle: 'Subconscious Wave Matrix', palette: ['#060714', '#00f0ff', '#f43f5e'] },
      { title: 'TITAN OF ART', subtitle: 'Transcendence Opus No. 1', palette: ['#0e0a05', '#f59e0b', '#ff2a5f'] }
    ];

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindEvents();
    this.pickNextDrop();
    this.updateHUD();
    this.startRenderLoop();
  }

  resize() {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    if (this.ctx.resetTransform) {
      this.ctx.resetTransform();
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.ctx.scale(dpr, dpr);

    // Center the Vessel
    this.vessel.width = Math.min(460, this.width - 40);
    this.vessel.height = Math.min(540, this.height - 120);
    this.vessel.x = (this.width - this.vessel.width) / 2;
    this.vessel.y = 80;
    this.vessel.dangerY = this.vessel.y + 40;

    this.dropperX = this.width / 2;
  }

  pickNextDrop() {
    this.currentDropTier = this.nextTier;
    // Next drop can be Tier 1 (I) 70% or Tier 2 (T) 30%
    this.nextTier = Math.random() < 0.35 ? 2 : 1;
    this.updateHUD();
  }

  bindEvents() {
    // Mouse / Touch movement controls dropper
    const updateDropperPos = (clientX) => {
      if (!this.isPlaying || this.isGameOver) return;
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const minX = this.vessel.x + 30;
      const maxX = this.vessel.x + this.vessel.width - 30;
      this.dropperX = Math.max(minX, Math.min(maxX, mouseX));
    };

    this.canvas.addEventListener('mousemove', (e) => updateDropperPos(e.clientX));
    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) updateDropperPos(e.touches[0].clientX);
    }, { passive: true });

    // Click / Tap drops sphere
    this.canvas.addEventListener('click', (e) => {
      updateDropperPos(e.clientX);
      this.dropCurrentSphere();
    });

    // Keyboard controls: Arrow Left/Right to aim, Space or ArrowDown to drop
    window.addEventListener('keydown', (e) => {
      const forgeView = document.getElementById('view-forge');
      if (!forgeView || !forgeView.classList.contains('active')) return;
      if (e.target.tagName === 'INPUT') return;

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        this.dropperX = Math.max(this.vessel.x + 30, this.dropperX - 25);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        this.dropperX = Math.min(this.vessel.x + this.vessel.width - 30, this.dropperX + 25);
      } else if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        this.dropCurrentSphere();
      }
    });

    // Start / Restart button
    const startBtn = document.getElementById('forge-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resetGame();
      });
    }

    // Reset Slots / Vessel button
    const resetBtn = document.getElementById('forge-reset-slots-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.soundFx.playClick();
        this.resetGame();
      });
    }

    // Gallery Modal buttons
    const galleryBtn = document.getElementById('forge-gallery-btn');
    const galleryModal = document.getElementById('forge-gallery-modal');
    const galleryClose = document.getElementById('forge-gallery-close');
    if (galleryBtn && galleryModal) {
      galleryBtn.addEventListener('click', () => {
        window.soundFx.playClick();
        this.renderGalleryModal();
        galleryModal.classList.remove('hidden');
      });
    }
    if (galleryClose && galleryModal) {
      galleryClose.addEventListener('click', () => {
        window.soundFx.playClick();
        galleryModal.classList.add('hidden');
      });
    }
  }

  resetGame() {
    this.score = 0;
    this.wordsMade = 0;
    this.combo = 1;
    this.spheres = [];
    this.particles = [];
    this.isGameOver = false;
    this.isPlaying = true;
    this.canDrop = true;
    this.pickNextDrop();

    const overlay = document.getElementById('forge-start-overlay');
    if (overlay) overlay.classList.add('hidden');

    this.updateHUD();
    window.soundFx.playClick();
    window.soundFx.startAmbientDrone();
    if (window.ghostLeg) window.ghostLeg.showToast('✦ DROP & MERGE TO MAKE ITIA! ✦');
  }

  dropCurrentSphere() {
    if (!this.canDrop || !this.isPlaying || this.isGameOver) return;

    this.canDrop = false;
    window.soundFx.playStep(360 + this.currentDropTier * 80);

    const tierData = this.tiers[this.currentDropTier - 1];

    this.spheres.push({
      id: `sphere-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      x: this.dropperX,
      y: this.vessel.y - 15,
      vx: (Math.random() - 0.5) * 0.4,
      vy: 2.0,
      tier: this.currentDropTier,
      radius: tierData.radius,
      mass: tierData.mass,
      color: tierData.color,
      label: tierData.label,
      pulse: 0,
      merging: false
    });

    this.pickNextDrop();

    // Cooldown before next drop
    setTimeout(() => {
      this.canDrop = true;
    }, this.dropCooldown);
  }

  // Physics Update Loop
  updatePhysics() {
    const leftWall = this.vessel.x;
    const rightWall = this.vessel.x + this.vessel.width;
    const floor = this.vessel.y + this.vessel.height;

    // 1. Apply gravity & velocities
    this.spheres.forEach(s => {
      s.vy += this.gravity;
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= this.friction;
      s.vy *= this.friction;
      s.pulse += 0.05;

      // Wall bounds collision
      if (s.x - s.radius < leftWall) {
        s.x = leftWall + s.radius;
        s.vx = -s.vx * this.bounce;
      } else if (s.x + s.radius > rightWall) {
        s.x = rightWall - s.radius;
        s.vx = -s.vx * this.bounce;
      }

      // Floor collision
      if (s.y + s.radius > floor) {
        s.y = floor - s.radius;
        s.vy = -s.vy * this.bounce;
        if (Math.abs(s.vy) < 0.2) s.vy = 0;
      }
    });

    // 2. Collision detection & Merging
    const mergesToPerform = [];

    for (let i = 0; i < this.spheres.length; i++) {
      for (let j = i + 1; j < this.spheres.length; j++) {
        const s1 = this.spheres[i];
        const s2 = this.spheres[j];
        if (s1.merging || s2.merging) return;

        const dx = s2.x - s1.x;
        const dy = s2.y - s1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = s1.radius + s2.radius;

        if (dist < minDist && dist > 0) {
          // Check if identical tier: MERGE!
          if (s1.tier === s2.tier && s1.tier < this.tiers.length) {
            mergesToPerform.push({ s1, s2, nextTier: s1.tier + 1 });
            s1.merging = true;
            s2.merging = true;
          } else {
            // Elastic collision push-back
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;

            // Separate spheres
            const totalMass = s1.mass + s2.mass;
            s1.x -= nx * overlap * (s2.mass / totalMass);
            s1.y -= ny * overlap * (s2.mass / totalMass);
            s2.x += nx * overlap * (s1.mass / totalMass);
            s2.y += ny * overlap * (s1.mass / totalMass);

            // Relative velocity
            const kx = s1.vx - s2.vx;
            const ky = s1.vy - s2.vy;
            const p = 2 * (nx * kx + ny * ky) / totalMass;

            s1.vx -= p * s2.mass * nx * this.bounce;
            s1.vy -= p * s2.mass * ny * this.bounce;
            s2.vx += p * s1.mass * nx * this.bounce;
            s2.vy += p * s1.mass * ny * this.bounce;
          }
        }
      }
    }

    // 3. Process Merges
    mergesToPerform.forEach(({ s1, s2, nextTier }) => {
      const midX = (s1.x + s2.x) / 2;
      const midY = (s1.y + s2.y) / 2;
      const tierData = this.tiers[nextTier - 1];

      // Remove s1 and s2
      this.spheres = this.spheres.filter(s => s !== s1 && s !== s2);

      // Create new upgraded sphere
      this.spheres.push({
        id: `sphere-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        x: midX,
        y: midY,
        vx: (s1.vx + s2.vx) * 0.5,
        vy: -1.2, // Small upward pop
        tier: nextTier,
        radius: tierData.radius,
        mass: tierData.mass,
        color: tierData.color,
        label: tierData.label,
        pulse: 0,
        merging: false
      });

      // Sound & Sparks
      window.soundFx.playZap();
      this.spawnSparks(midX, midY, tierData.color, 20);
      if (window.fractalBg) window.fractalBg.pulse(0.6 + nextTier * 0.2);

      // Score
      this.score += tierData.points * this.combo;

      // Check if forged ITIA Singularity (Tier 5 or 6)!
      if (tierData.isSingularity || tierData.isSuper) {
        this.triggerSingularityCelebration(tierData);
      }

      this.updateHUD();
    });

    // 4. Danger / Overflow check
    if (this.spheres.length > 3) {
      let overflowCount = 0;
      this.spheres.forEach(s => {
        if (s.y - s.radius < this.vessel.dangerY && Math.abs(s.vy) < 0.5) {
          overflowCount++;
        }
      });

      if (overflowCount >= 2 && !this.isGameOver) {
        this.triggerGameOver();
      }
    }

    // 5. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.025;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  triggerSingularityCelebration(tierData) {
    this.wordsMade++;
    this.combo++;
    window.soundFx.playWin();
    window.soundFx.playOverdrive();

    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 400);

    if (window.fractalBg) window.fractalBg.pulse(2.5);

    // Unlock next fine art piece
    const artIndex = (this.wordsMade - 1) % this.artworks.length;
    const art = this.artworks[artIndex];
    this.unlockedArtCount = Math.min(this.unlockedArtCount + 1, this.artworks.length);

    // Show celebration banner
    const banner = document.getElementById('forge-synthesis-banner');
    const titleEl = document.getElementById('forged-art-title');
    const subEl = document.getElementById('forged-art-sub');

    if (banner && titleEl && subEl) {
      titleEl.textContent = `${tierData.label} // ${art.title}`;
      subEl.textContent = `✦ SYNTHESIZED: ${art.subtitle} (+${tierData.points * this.combo} PTS)`;
      banner.classList.remove('hidden');

      setTimeout(() => {
        banner.classList.add('hidden');
      }, 3500);
    }

    if (window.ghostLeg) {
      window.ghostLeg.showToast(`✦ THE WORD ITIA HAS BEEN FORGED! "${art.title}" UNLOCKED! ✦`);
    }
  }

  triggerGameOver() {
    this.isGameOver = true;
    this.isPlaying = false;
    window.soundFx.playLoss();

    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 400);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('itia_forge_best', this.highScore.toString());
    }

    const overlay = document.getElementById('forge-start-overlay');
    const startTitle = document.getElementById('forge-overlay-title');
    const startDesc = document.getElementById('forge-overlay-desc');
    const startBtn = document.getElementById('forge-start-btn');

    if (overlay && startTitle && startDesc && startBtn) {
      startTitle.textContent = 'VESSEL OVERFLOW';
      startDesc.innerHTML = `You synthesized <strong>${this.wordsMade} ITIA Singularities</strong> and scored <strong>${this.score.toLocaleString()} points</strong>!`;
      startBtn.querySelector('.btn-text').textContent = 'RE-IGNITE THE FORGE';
      overlay.classList.remove('hidden');
    }

    this.updateHUD();
  }

  spawnSparks(x, y, color, count = 15) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        size: Math.random() * 3.5 + 1.2,
        color,
        alpha: 1.0
      });
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    const v = this.vessel;

    // ========================================================
    // RENDER MONUMENTAL ITIA WATERMARK IN CENTER OF VESSEL
    // ========================================================
    this.ctx.save();
    this.ctx.font = '900 130px "Cinzel", serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    this.ctx.fillText('ITIA', v.x + v.width / 2, v.y + v.height / 2);
    this.ctx.restore();

    // ========================================================
    // RENDER CONTAINMENT VESSEL (GLASS & NEON BORDERS)
    // ========================================================
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(8, 10, 18, 0.65)';
    this.ctx.fillRect(v.x, v.y, v.width, v.height);

    // Vessel Glass Border
    this.ctx.beginPath();
    this.ctx.moveTo(v.x, v.y);
    this.ctx.lineTo(v.x, v.y + v.height);
    this.ctx.lineTo(v.x + v.width, v.y + v.height);
    this.ctx.lineTo(v.x + v.width, v.y);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    // Danger Overflow Threshold Line
    this.ctx.beginPath();
    this.ctx.moveTo(v.x + 8, v.dangerY);
    this.ctx.lineTo(v.x + v.width - 8, v.dangerY);
    this.ctx.strokeStyle = 'rgba(255, 42, 95, 0.45)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([8, 8]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    this.ctx.font = '700 9px "JetBrains Mono", monospace';
    this.ctx.fillStyle = 'rgba(255, 42, 95, 0.6)';
    this.ctx.fillText('⚠ OVERFLOW THRESHOLD', v.x + 14, v.dangerY - 6);
    this.ctx.restore();

    // ========================================================
    // RENDER DROPPER & AIMING LASER LINE
    // ========================================================
    if (this.isPlaying && !this.isGameOver) {
      this.ctx.save();

      // Dashed Aiming Line
      this.ctx.beginPath();
      this.ctx.moveTo(this.dropperX, 20);
      this.ctx.lineTo(this.dropperX, v.y + v.height);
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([4, 6]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Dropper Sphere Indicator at Top
      const currentTierData = this.tiers[this.currentDropTier - 1];
      this.ctx.shadowColor = currentTierData.color;
      this.ctx.shadowBlur = 16;
      this.ctx.beginPath();
      this.ctx.arc(this.dropperX, 35, currentTierData.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = currentTierData.color;
      this.ctx.fill();

      // Letter label
      this.ctx.font = '900 18px "Cinzel", serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(currentTierData.label, this.dropperX, 35);

      this.ctx.restore();
    }

    // ========================================================
    // RENDER SPHERES
    // ========================================================
    this.spheres.forEach(s => {
      this.ctx.save();
      this.ctx.shadowColor = s.color;
      this.ctx.shadowBlur = s.tier >= 4 ? 22 : 12;

      // Sphere Body with gradient
      const grad = this.ctx.createRadialGradient(
        s.x - s.radius * 0.3, s.y - s.radius * 0.3, s.radius * 0.1,
        s.x, s.y, s.radius
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, s.color);
      grad.addColorStop(1, '#05070a');

      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      this.ctx.strokeStyle = s.color;
      this.ctx.lineWidth = s.tier >= 4 ? 3 : 1.5;
      this.ctx.stroke();

      // Serif Letter Rune
      const fontSize = Math.max(14, s.radius * 0.7);
      this.ctx.font = `900 ${fontSize}px "Cinzel", serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowBlur = 0;
      this.ctx.fillText(s.label, s.x, s.y + 1);

      this.ctx.restore();
    });

    // ========================================================
    // RENDER PARTICLES
    // ========================================================
    this.particles.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;
    });
  }

  startRenderLoop() {
    const loop = () => {
      if (this.isPlaying && !this.isGameOver) {
        this.updatePhysics();
      }
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  updateHUD() {
    const wordsEl = document.getElementById('forge-words-count');
    const scoreEl = document.getElementById('forge-score-count');
    const comboEl = document.getElementById('forge-combo-count');
    const artCountEl = document.getElementById('forge-art-unlocked-badge');
    const nextTierData = this.tiers[this.nextTier - 1];

    if (wordsEl) wordsEl.textContent = this.wordsMade;
    if (scoreEl) scoreEl.textContent = this.score.toLocaleString();
    if (comboEl) comboEl.textContent = `x${this.combo}`;
    if (artCountEl) artCountEl.textContent = `${this.unlockedArtCount}/${this.artworks.length}`;

    const timerEl = document.getElementById('forge-timer-count');
    if (timerEl && nextTierData) {
      timerEl.textContent = `NEXT: [ ${nextTierData.label} ]`;
      timerEl.style.color = nextTierData.color;
    }
  }

  renderGalleryModal() {
    const grid = document.getElementById('forge-gallery-grid');
    if (!grid) return;

    grid.innerHTML = this.artworks.map((art, idx) => {
      const isUnlocked = idx < this.unlockedArtCount;
      return `
        <div class="art-card glass-panel ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="art-card-canvas" style="background: radial-gradient(circle at center, ${art.palette[1]}44 0%, ${art.palette[0]} 100%);">
            <span class="art-char">${isUnlocked ? 'ITIA' : '🔒'}</span>
          </div>
          <div class="art-card-info">
            <div class="art-title">${art.title}</div>
            <div class="art-sub">${art.subtitle}</div>
            <div class="art-status">${isUnlocked ? '✦ UNLOCKED' : 'FORGE ITIA TO UNLOCK'}</div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// Global instance
window.wordForge = new WordForge();
