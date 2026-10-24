/**
 * ITIA // LADDER OF DESTINY (GHOST LEG / AMIDAKUJI / 사다리타기)
 * Interactive procedural fate labyrinth with dynamic camera, interactive rung builder,
 * suspense mechanics, and particle trails.
 */

class GhostLegGame {
  constructor() {
    this.canvas = document.getElementById('destiny-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.container = document.getElementById('destiny-canvas-container');

    // Configuration
    this.lineCount = 6;
    this.rungCount = 18;
    this.fogOfWar = false;
    this.cinematicCamera = true;

    // Data State
    this.players = [];
    this.prizes = [];
    this.rungs = []; // Array of { lineIndex: number, yRatio: number, revealed: boolean, id: string }
    this.history = [];

    // Animation & Runners State
    this.runners = []; // Active runners: { playerIndex, currLine, x, y, targetY, targetLine, pathIndex, isCrossing, progress, color, completed }
    this.isAnimating = false;
    this.mode = 'idle'; // 'idle', 'running-single', 'running-all'
    this.selectedPlayerIndex = 0;
    
    // Geometry Cache
    this.lineCoords = []; // Array of X positions
    this.topY = 24;
    this.bottomY = 0;
    this.hoverRung = null; // Mouse hover preview

    this.init();
  }

  init() {
    this.setupPresets('giveaway');
    this.renderUI();
    this.resizeCanvas();
    this.generateRungs();
    this.bindEvents();
    this.startRenderLoop();

    // Re-check alignment after fonts & DOM layout settle
    setTimeout(() => {
      this.resizeCanvas();
      this.render();
    }, 150);
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.render();
    });

    // Interactive canvas rung click / hover
    this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoverRung = null;
    });
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

    // Sliders
    const countSlider = document.getElementById('ladder-count-slider');
    const countVal = document.getElementById('ladder-count-val');
    if (countSlider) {
      countSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        countVal.textContent = val;
        this.setLineCount(val);
      });
    }

    const densitySlider = document.getElementById('rung-density-slider');
    const densityVal = document.getElementById('rung-density-val');
    if (densitySlider) {
      densitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.rungCount = val;
        densityVal.textContent = val > 26 ? `Mad (${val})` : val > 14 ? `Standard (${val})` : `Chill (${val})`;
        this.generateRungs();
        this.render();
      });
    }

    // Toggles
    const fogToggle = document.getElementById('fog-of-war-toggle');
    if (fogToggle) {
      fogToggle.addEventListener('change', (e) => {
        this.fogOfWar = e.target.checked;
        this.render();
      });
    }

    const camToggle = document.getElementById('cinematic-zoom-toggle');
    if (camToggle) {
      camToggle.addEventListener('change', (e) => {
        this.cinematicCamera = e.target.checked;
      });
    }

    // Launch Buttons
    const launchSingleBtn = document.getElementById('start-destiny-btn');
    if (launchSingleBtn) {
      launchSingleBtn.addEventListener('click', () => {
        this.launchRunner(this.selectedPlayerIndex);
      });
    }

    const launchAllBtn = document.getElementById('simultaneous-race-btn');
    if (launchAllBtn) {
      launchAllBtn.addEventListener('click', () => {
        this.launchAllRunners();
      });
    }

    const rerollBtn = document.getElementById('reroll-rungs-btn');
    if (rerollBtn) {
      rerollBtn.addEventListener('click', () => {
        window.soundFx.playClick();
        this.generateRungs();
        this.resetRunners();
        this.render();
        this.showToast('Labyrinth rungs regenerated!');
      });
    }

    const clearBtn = document.getElementById('clear-rungs-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        window.soundFx.playClick();
        this.rungs = [];
        this.resetRunners();
        this.render();
        this.showToast('All rungs cleared. Click anywhere to build your own!');
      });
    }
  }

  resizeCanvas() {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    if (this.ctx.resetTransform) {
      this.ctx.resetTransform();
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.ctx.scale(dpr, dpr);

    this.topY = 6;
    this.bottomY = rect.height - 6;

    this.calculateLineCoords(rect.width);
  }

  calculateLineCoords(totalWidth) {
    this.lineCoords = [];

    // Dynamically match exact center of top runner cards if present
    const cards = document.querySelectorAll('#destiny-top-header .runner-card');
    const containerRect = this.container ? this.container.getBoundingClientRect() : null;

    if (cards.length === this.lineCount && containerRect && containerRect.width > 0) {
      cards.forEach(card => {
        const cRect = card.getBoundingClientRect();
        const centerX = (cRect.left + cRect.width / 2) - containerRect.left;
        this.lineCoords.push(centerX);
      });
      return;
    }

    // Precise mathematical fallback
    const margin = Math.min(80, totalWidth * 0.12);
    const usableWidth = totalWidth - margin * 2;
    const step = usableWidth / (this.lineCount - 1);

    for (let i = 0; i < this.lineCount; i++) {
      this.lineCoords.push(margin + i * step);
    }
  }

  setLineCount(newCount) {
    this.lineCount = newCount;
    this.setupPresetData(this.currentPresetKey || 'giveaway');
    this.resizeCanvas();
    this.generateRungs();
    this.resetRunners();
    this.renderUI();
    this.render();
  }

  setupPresets(key) {
    this.currentPresetKey = key;
    this.setupPresetData(key);
    this.renderUI();
  }

  setupPresetData(key) {
    const colorPalette = [
      '#ff2a5f', '#00f0ff', '#f59e0b', '#10b981', '#a855f7',
      '#ec4899', '#3b82f6', '#14b8a6', '#f43f5e', '#8b5cf6'
    ];

    const presets = {
      giveaway: {
        players: ['Satoshi', 'Vitalic', 'Banksy', 'Beeple', 'Cipher', 'Ghost', 'Oracle', 'Drifter', 'Nova', 'Sol'],
        prizes: [
          { name: '🏆 ITIA 1/1 NFT', icon: '🏆', type: 'jackpot' },
          { name: '⚡ WL Pass', icon: '⚡', type: 'whitelist' },
          { name: '💎 500 $ITIA', icon: '💎', type: 'gem' },
          { name: '🎁 Mystery Canvas', icon: '🎁', type: 'mystery' },
          { name: '💀 Void Dust', icon: '💀', type: 'skull' },
          { name: '🖤 Blank Fate', icon: '🖤', type: 'blank' },
          { name: '👑 Genesis Access', icon: '👑', type: 'jackpot' },
          { name: '🎟️ Presale Ticket', icon: '🎟️', type: 'whitelist' },
          { name: '🔥 Floor Sweep', icon: '🔥', type: 'gem' },
          { name: '💀 Liquidated', icon: '💀', type: 'skull' }
        ]
      },
      royale: {
        players: ['Player 01', 'Player 02', 'Player 03', 'Player 04', 'Player 05', 'Player 06', 'Player 07', 'Player 08', 'Player 09', 'Player 10'],
        prizes: [
          { name: '👑 SURVIVOR', icon: '👑', type: 'jackpot' },
          { name: '💀 ELIMINATED', icon: '💀', type: 'skull' },
          { name: '📦 AIRDROP LOOT', icon: '📦', type: 'mystery' },
          { name: '💀 ELIMINATED', icon: '💀', type: 'skull' },
          { name: '🛡️ SHIELD PASS', icon: '🛡️', type: 'whitelist' },
          { name: '💀 ELIMINATED', icon: '💀', type: 'skull' },
          { name: '👑 SURVIVOR #2', icon: '👑', type: 'jackpot' },
          { name: '💀 ELIMINATED', icon: '💀', type: 'skull' },
          { name: '⚡ POWER SURGE', icon: '⚡', type: 'gem' },
          { name: '💀 ELIMINATED', icon: '💀', type: 'skull' }
        ]
      },
      crypto: {
        players: ['Whale_0x', 'DegenArt', 'Collector_A', 'DaoVoter', 'AlphaSeeker', 'Hodler_7', 'MintBot', 'GigaChad', 'PixelBaron', 'Lurker'],
        prizes: [
          { name: '💎 1.0 ETH BID', icon: '💎', type: 'jackpot' },
          { name: '🎟️ TIER 1 WL', icon: '🎟️', type: 'whitelist' },
          { name: '💸 GAS REBATE', icon: '💸', type: 'gem' },
          { name: '💀 RUG PULL', icon: '💀', type: 'skull' },
          { name: '🖼️ ITIA EDITION', icon: '🖼️', type: 'mystery' },
          { name: '💀 PAPER HANDS', icon: '💀', type: 'skull' },
          { name: '👑 FOUNDER MINT', icon: '👑', type: 'jackpot' },
          { name: '🎟️ TIER 2 WL', icon: '🎟️', type: 'whitelist' },
          { name: '🖤 NO ALLOCATION', icon: '🖤', type: 'blank' },
          { name: '💀 REKT', icon: '💀', type: 'skull' }
        ]
      },
      roulette: {
        players: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'],
        prizes: [
          { name: '👑 IMMUNITY', icon: '👑', type: 'jackpot' },
          { name: '⚡ BUY FLOOR', icon: '⚡', type: 'mystery' },
          { name: '💀 ROAST LIVE', icon: '💀', type: 'skull' },
          { name: '🎤 SING A SONG', icon: '🎤', type: 'mystery' },
          { name: '💎 SHILL ITIA', icon: '💎', type: 'gem' },
          { name: '💀 DRINK SHOT', icon: '💀', type: 'skull' },
          { name: '👑 SAFE HARBOR', icon: '👑', type: 'jackpot' },
          { name: '⚡ CONFESS ALPHA', icon: '⚡', type: 'mystery' },
          { name: '💀 AVATAR CHANGE', icon: '💀', type: 'skull' },
          { name: '🖤 SAFE PASS', icon: '🖤', type: 'blank' }
        ]
      }
    };

    const chosen = presets[key] || presets.giveaway;

    this.players = [];
    this.prizes = [];

    for (let i = 0; i < this.lineCount; i++) {
      this.players.push({
        id: `p-${i}`,
        name: chosen.players[i] || `Contender ${i + 1}`,
        color: colorPalette[i % colorPalette.length],
        avatar: ['✦', '▲', '◈', '★', '◆', '●', '■', '▼', '⚡', '✿'][i % 10],
        completed: false,
        endPrizeIndex: null
      });

      this.prizes.push({
        id: `prz-${i}`,
        name: chosen.prizes[i]?.name || `Fate ${i + 1}`,
        icon: chosen.prizes[i]?.icon || '🎁',
        type: chosen.prizes[i]?.type || 'mystery',
        wonBy: null
      });
    }
  }

  generateRungs() {
    this.rungs = [];
    const minDistance = 0.04; // Minimum vertical distance between rungs on adjacent lines
    const availableLines = this.lineCount - 1;
    let attempts = 0;
    const maxAttempts = this.rungCount * 25;

    while (this.rungs.length < this.rungCount && attempts < maxAttempts) {
      attempts++;
      const lineIndex = Math.floor(Math.random() * availableLines);
      // Normalized vertical height between 0.08 and 0.92
      const yRatio = parseFloat((Math.random() * 0.84 + 0.08).toFixed(3));

      // Prevent rungs from colliding too closely with adjacent lines
      const collision = this.rungs.some(r => {
        const lineDiff = Math.abs(r.lineIndex - lineIndex);
        const yDiff = Math.abs(r.yRatio - yRatio);
        return lineDiff <= 1 && yDiff < minDistance;
      });

      if (!collision) {
        this.rungs.push({
          id: `rung-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          lineIndex,
          yRatio,
          revealed: !this.fogOfWar
        });
      }
    }

    // Sort rungs by vertical position
    this.rungs.sort((a, b) => a.yRatio - b.yRatio);
  }

  // Calculate destination path for a given start line
  solvePath(startLine) {
    let currLine = startLine;
    const segments = []; // { x1, y1, x2, y2, isRung }
    let currY = 0; // Normalized 0 to 1

    // Sort rungs top to bottom
    const sorted = [...this.rungs].sort((a, b) => a.yRatio - b.yRatio);

    sorted.forEach(rung => {
      if (rung.yRatio <= currY) return;

      if (rung.lineIndex === currLine) {
        // Rung goes to right (currLine -> currLine + 1)
        segments.push({
          fromLine: currLine,
          toLine: currLine,
          fromY: currY,
          toY: rung.yRatio,
          isRung: false
        });
        segments.push({
          fromLine: currLine,
          toLine: currLine + 1,
          fromY: rung.yRatio,
          toY: rung.yRatio,
          isRung: true,
          rungId: rung.id
        });
        currLine = currLine + 1;
        currY = rung.yRatio;
      } else if (rung.lineIndex === currLine - 1) {
        // Rung goes to left (currLine -> currLine - 1)
        segments.push({
          fromLine: currLine,
          toLine: currLine,
          fromY: currY,
          toY: rung.yRatio,
          isRung: false
        });
        segments.push({
          fromLine: currLine,
          toLine: currLine - 1,
          fromY: rung.yRatio,
          toY: rung.yRatio,
          isRung: true,
          rungId: rung.id
        });
        currLine = currLine - 1;
        currY = rung.yRatio;
      }
    });

    // Final stretch to bottom
    segments.push({
      fromLine: currLine,
      toLine: currLine,
      fromY: currY,
      toY: 1.0,
      isRung: false
    });

    return {
      endLine: currLine,
      segments
    };
  }

  // Interactive rung placement on canvas
  handleCanvasHover(e) {
    if (this.isAnimating) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check which vertical line gap mouse is in
    for (let i = 0; i < this.lineCount - 1; i++) {
      const x1 = this.lineCoords[i];
      const x2 = this.lineCoords[i + 1];

      if (mouseX >= x1 && mouseX <= x2) {
        const height = this.bottomY - this.topY;
        const yRatio = (mouseY - this.topY) / height;

        if (yRatio >= 0.05 && yRatio <= 0.95) {
          this.hoverRung = {
            lineIndex: i,
            yRatio,
            x1,
            x2,
            y: this.topY + yRatio * height
          };
          this.render();
          return;
        }
      }
    }

    if (this.hoverRung) {
      this.hoverRung = null;
      this.render();
    }
  }

  handleCanvasClick(e) {
    if (this.isAnimating) return;
    if (!this.hoverRung) return;

    window.soundFx.playClick();
    const { lineIndex, yRatio } = this.hoverRung;

    // Check if clicking near an existing rung (to delete it)
    const existingIndex = this.rungs.findIndex(r => 
      r.lineIndex === lineIndex && Math.abs(r.yRatio - yRatio) < 0.035
    );

    if (existingIndex !== -1) {
      this.rungs.splice(existingIndex, 1);
      this.showToast('Rung removed');
    } else {
      this.rungs.push({
        id: `rung-custom-${Date.now()}`,
        lineIndex,
        yRatio,
        revealed: !this.fogOfWar
      });
      this.rungs.sort((a, b) => a.yRatio - b.yRatio);
      this.showToast('Custom rung created!');
    }

    this.resetRunners();
    this.render();
  }

  // Launch a single runner descent
  launchRunner(playerIndex) {
    if (this.isAnimating) return;
    const player = this.players[playerIndex];
    if (!player) return;

    this.isAnimating = true;
    this.mode = 'running-single';

    const solution = this.solvePath(playerIndex);
    this.runners = [{
      playerIndex,
      name: player.name,
      color: player.color,
      avatar: player.avatar,
      segments: solution.segments,
      currentSegmentIndex: 0,
      segmentProgress: 0,
      speed: 0.024,
      endLine: solution.endLine,
      trail: [],
      x: this.lineCoords[playerIndex],
      y: this.topY
    }];

    this.updateStatusText(`DESCENDING: ${player.name.toUpperCase()}...`);
    window.soundFx.startAmbientDrone();
    if (window.fractalBg) window.fractalBg.pulse(1.2);
  }

  // Launch all runners in simultaneous high-octane battle
  launchAllRunners() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.mode = 'running-all';
    this.runners = [];

    this.players.forEach((p, idx) => {
      const solution = this.solvePath(idx);
      this.runners.push({
        playerIndex: idx,
        name: p.name,
        color: p.color,
        avatar: p.avatar,
        segments: solution.segments,
        currentSegmentIndex: 0,
        segmentProgress: 0,
        speed: 0.018 + Math.random() * 0.006, // Slight variety for dramatic crossings
        endLine: solution.endLine,
        trail: [],
        x: this.lineCoords[idx],
        y: this.topY,
        completed: false
      });
    });

    this.updateStatusText('⚡ ALL-OUT CHAOS RACING DOWN THE LABYRINTH!');
    window.soundFx.startAmbientDrone();
    if (window.fractalBg) window.fractalBg.pulse(2.0);
  }

  resetRunners() {
    this.runners = [];
    this.isAnimating = false;
    this.mode = 'idle';
    this.players.forEach(p => {
      p.completed = false;
      p.endPrizeIndex = null;
    });
    this.prizes.forEach(prz => {
      prz.wonBy = null;
    });
    this.updateStatusText('CLICK A RUNNER OR HIT LAUNCH');
    this.renderUI();
  }

  updateRunners() {
    if (!this.isAnimating || this.runners.length === 0) return;

    const totalHeight = this.bottomY - this.topY;
    let allCompleted = true;

    this.runners.forEach(runner => {
      if (runner.completed) return;
      allCompleted = false;

      const seg = runner.segments[runner.currentSegmentIndex];
      if (!seg) {
        this.completeRunner(runner);
        return;
      }

      runner.segmentProgress += runner.speed;

      // Tension riser sound build-up
      if (Math.random() < 0.15) {
        const overallProgress = (runner.y - this.topY) / totalHeight;
        window.soundFx.playTensionRiser(overallProgress);
      }

      if (runner.segmentProgress >= 1.0) {
        runner.segmentProgress = 0;
        runner.currentSegmentIndex++;

        // If crossed a rung, trigger electric zap sound & reveal rung in Fog of War
        if (seg.isRung) {
          window.soundFx.playZap();
          if (window.fractalBg) window.fractalBg.pulse(0.4);

          // Fog of War reveal
          if (this.fogOfWar && seg.rungId) {
            const rungObj = this.rungs.find(r => r.id === seg.rungId);
            if (rungObj) rungObj.revealed = true;
          }
        } else {
          window.soundFx.playStep(350 + runner.currentSegmentIndex * 20);
        }

        // Check if finished all segments
        if (runner.currentSegmentIndex >= runner.segments.length) {
          this.completeRunner(runner);
          return;
        }
      }

      // Interpolate runner coordinates
      const currentSeg = runner.segments[runner.currentSegmentIndex];
      if (currentSeg) {
        const x1 = this.lineCoords[currentSeg.fromLine];
        const x2 = this.lineCoords[currentSeg.toLine];
        const y1 = this.topY + currentSeg.fromY * totalHeight;
        const y2 = this.topY + currentSeg.toY * totalHeight;

        runner.x = x1 + (x2 - x1) * runner.segmentProgress;
        runner.y = y1 + (y2 - y1) * runner.segmentProgress;

        // Store trail particles
        runner.trail.push({ x: runner.x, y: runner.y, alpha: 1.0, color: runner.color });
        if (runner.trail.length > 25) runner.trail.shift();

        // Track ITIA Monolith Letter Tier Progression
        if (this.mode === 'running-single') {
          const normY = (runner.y - this.topY) / totalHeight;
          let tierChar = 'I';
          let tierName = 'APEX CROWN';
          if (normY < 0.25) {
            tierChar = 'I';
            tierName = 'APEX CROWN';
          } else if (normY < 0.50) {
            tierChar = 'T';
            tierName = 'CROSSBEAM';
          } else if (normY < 0.75) {
            tierChar = 'I';
            tierName = 'VOID PILLAR';
          } else {
            tierChar = 'A';
            tierName = 'GENESIS GATE';
          }

          if (runner.lastTierChar !== tierChar) {
            runner.lastTierChar = tierChar;
            this.updateStatusText(`DESCENDING [ ${tierChar} ] ${tierName} // ${runner.name.toUpperCase()}`);
            if (window.fractalBg) window.fractalBg.pulse(0.4);
          }
        }
      }
    });

    if (allCompleted) {
      this.isAnimating = false;
      this.mode = 'idle';
      this.celebrateResults();
    }
  }

  completeRunner(runner) {
    runner.completed = true;
    runner.x = this.lineCoords[runner.endLine];
    runner.y = this.bottomY;

    const prize = this.prizes[runner.endLine];
    const player = this.players[runner.playerIndex];

    if (prize && player) {
      player.completed = true;
      player.endPrizeIndex = runner.endLine;
      prize.wonBy = player.name;

      // Audio climax
      if (prize.type === 'skull') {
        window.soundFx.playLoss();
      } else {
        window.soundFx.playWin();
      }

      // Screen shake
      document.body.classList.add('screen-shake');
      setTimeout(() => document.body.classList.remove('screen-shake'), 300);

      // Record in history
      this.history.unshift({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        player: player.name,
        prize: prize.name,
        icon: prize.icon,
        type: prize.type
      });

      this.updateStatusText(`DESTINY: ${player.name} → ${prize.icon} ${prize.name}`);
      this.renderUI();
    }
  }

  celebrateResults() {
    this.renderUI();
    // Show ceremony modal after slight delay
    setTimeout(() => {
      this.showCeremonyModal();
    }, 600);
  }

  showCeremonyModal() {
    const modal = document.getElementById('destiny-winner-modal');
    const heroBox = document.getElementById('winner-hero-box');
    const summaryList = document.getElementById('modal-all-results-summary');
    if (!modal || !heroBox || !summaryList) return;

    // Build Hero Box for prominent winner
    const completedPlayers = this.players.filter(p => p.completed);
    if (completedPlayers.length === 0) return;

    const latest = completedPlayers[completedPlayers.length - 1];
    const prize = this.prizes[latest.endPrizeIndex];

    heroBox.innerHTML = `
      <div style="font-size: 38px; filter: drop-shadow(0 0 16px ${prize.type === 'skull' ? '#ff2a5f' : '#f59e0b'})">
        ${prize.icon}
      </div>
      <div style="font-family: var(--font-display); font-size: 20px; font-weight: 800; color: #fff;">
        ${latest.name}
      </div>
      <div style="font-family: var(--font-mono); font-size: 13px; color: ${prize.type === 'skull' ? '#ff2a5f' : '#f59e0b'}; font-weight: 700;">
        CLAIMED: ${prize.name}
      </div>
    `;

    // Summary list for all contenders
    summaryList.innerHTML = completedPlayers.map(p => {
      const prz = this.prizes[p.endPrizeIndex];
      return `
        <div class="history-item">
          <span class="winner" style="color: ${p.color}">${p.avatar} ${p.name}</span>
          <span class="prize">${prz.icon} ${prz.name}</span>
        </div>
      `;
    }).join('');

    modal.classList.remove('hidden');
  }

  // Render Canvas Graphics
  render() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    const totalHeight = Math.max(10, this.bottomY - this.topY);

    // ========================================================
    // RENDER MONUMENTAL ITIA LADDER ARCHITECTURE (I - T - I - A)
    // ========================================================
    const midX = rect.width / 2;
    const tierHeight = totalHeight / 4;

    const tiers = [
      { char: 'I', name: 'APEX CROWN', yStart: this.topY, yEnd: this.topY + tierHeight },
      { char: 'T', name: 'CROSSBEAM OF FATE', yStart: this.topY + tierHeight, yEnd: this.topY + tierHeight * 2 },
      { char: 'I', name: 'VOID PILLAR', yStart: this.topY + tierHeight * 2, yEnd: this.topY + tierHeight * 3 },
      { char: 'A', name: 'GENESIS GATE', yStart: this.topY + tierHeight * 3, yEnd: this.bottomY }
    ];

    // Draw Architectural Tier Markers & Colossal Serif Glyphs
    tiers.forEach((tier, tIdx) => {
      const centerY = (tier.yStart + tier.yEnd) / 2;

      // Draw subtle horizontal architectural divider
      if (tIdx > 0 && this.lineCoords.length > 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(this.lineCoords[0] - 20, tier.yStart);
        this.ctx.lineTo(this.lineCoords[this.lineCount - 1] + 20, tier.yStart);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([6, 8]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }

      // Draw Colossal Serif Glyph in Center of Arena (Didot/Cinzel style)
      this.ctx.save();
      this.ctx.font = '900 120px "Cinzel", serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      this.ctx.fillText(tier.char, midX, centerY);

      // Subtle glowing stroke
      this.ctx.strokeStyle = tIdx % 2 === 0 ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 42, 95, 0.12)';
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeText(tier.char, midX, centerY);
      this.ctx.restore();

      // Side Tier Indicator Tags (Left and Right margins)
      this.ctx.save();
      this.ctx.font = '700 9px "JetBrains Mono", monospace';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`[ ${tier.char} ] ${tier.name}`, 14, centerY);

      this.ctx.textAlign = 'right';
      this.ctx.fillText(`TIER 0${4 - tIdx}`, rect.width - 14, centerY);
      this.ctx.restore();
    });

    // Draw Vertical Ladder Guides
    for (let i = 0; i < this.lineCount; i++) {
      const x = this.lineCoords[i];

      // Vertical line glow
      this.ctx.beginPath();
      this.ctx.moveTo(x, this.topY);
      this.ctx.lineTo(x, this.bottomY);
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      this.ctx.lineWidth = 4;
      this.ctx.stroke();

      // Main crisp line
      this.ctx.beginPath();
      this.ctx.moveTo(x, this.topY);
      this.ctx.lineTo(x, this.bottomY);
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // Vertical path coordinate dot at top & bottom
      this.ctx.fillStyle = this.players[i]?.color || '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(x, this.topY, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Draw Horizontal Rungs
    this.rungs.forEach(rung => {
      const x1 = this.lineCoords[rung.lineIndex];
      const x2 = this.lineCoords[rung.lineIndex + 1];
      const y = this.topY + rung.yRatio * totalHeight;

      if (this.fogOfWar && !rung.revealed) {
        // Fog of War: barely perceptible shadow rung
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y);
        this.ctx.lineTo(x2, y);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        return;
      }

      // Neon cyber rung
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y);
      this.ctx.lineTo(x2, y);
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      this.ctx.lineWidth = 5;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y);
      this.ctx.lineTo(x2, y);
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Joint connector bolts
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.beginPath();
      this.ctx.arc(x1, y, 2.5, 0, Math.PI * 2);
      this.ctx.arc(x2, y, 2.5, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Draw Hover Preview Rung
    if (this.hoverRung && !this.isAnimating) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.hoverRung.x1, this.hoverRung.y);
      this.ctx.lineTo(this.hoverRung.x2, this.hoverRung.y);
      this.ctx.strokeStyle = 'rgba(255, 42, 95, 0.8)';
      this.ctx.lineWidth = 2.5;
      this.ctx.setLineDash([6, 3]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // Draw Runners & Trails
    this.runners.forEach(runner => {
      // Draw smooth laser trails
      if (runner.trail && runner.trail.length > 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(runner.trail[0].x, runner.trail[0].y);
        for (let t = 1; t < runner.trail.length; t++) {
          this.ctx.lineTo(runner.trail[t].x, runner.trail[t].y);
        }
        this.ctx.strokeStyle = runner.color;
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = runner.color;
        this.ctx.shadowBlur = 12;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
      }

      // Runner Glowing Plasma Orb
      this.ctx.save();
      this.ctx.shadowColor = runner.color;
      this.ctx.shadowBlur = 18;

      this.ctx.beginPath();
      this.ctx.arc(runner.x, runner.y, 8, 0, Math.PI * 2);
      this.ctx.fillStyle = runner.color;
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(runner.x, runner.y, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fill();

      this.ctx.restore();
    });
  }

  startRenderLoop() {
    const loop = () => {
      this.updateRunners();
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Update DOM UI elements (cards, editors, history)
  renderUI() {
    this.renderTopRunnerCards();
    this.renderBottomPrizeCards();
    this.renderRosterEditors();
    this.renderHistory();
  }

  renderTopRunnerCards() {
    const header = document.getElementById('destiny-top-header');
    if (!header) return;

    header.innerHTML = this.players.map((p, idx) => `
      <div class="runner-card ${this.selectedPlayerIndex === idx ? 'selected' : ''} ${p.completed ? 'completed' : ''}" data-player-idx="${idx}">
        <div class="runner-avatar" style="background: ${p.color}33; color: ${p.color}; border: 1px solid ${p.color}">
          ${p.avatar}
        </div>
        <span class="runner-name">${p.name}</span>
        <span class="runner-num-badge">LANE 0${idx + 1}</span>
      </div>
    `).join('');

    // Runner card click selects player to launch
    header.querySelectorAll('.runner-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.playerIdx, 10);
        this.selectedPlayerIndex = idx;
        window.soundFx.playClick();
        this.renderTopRunnerCards();
        this.updateStatusText(`READY: ${this.players[idx].name.toUpperCase()} (HIT LAUNCH OR DOUBLE CLICK)`);
        
        const launchBtn = document.getElementById('start-destiny-btn');
        if (launchBtn) {
          const btnText = launchBtn.querySelector('.btn-text');
          if (btnText) btnText.textContent = `⚡ LAUNCH: ${this.players[idx].name.toUpperCase()}`;
        }
      });

      card.addEventListener('dblclick', () => {
        const idx = parseInt(card.dataset.playerIdx, 10);
        this.selectedPlayerIndex = idx;
        this.launchRunner(idx);
      });
    });

    // Re-align canvas lines to runner card centers
    if (this.canvas) {
      this.calculateLineCoords(this.canvas.getBoundingClientRect().width);
    }
  }

  renderBottomPrizeCards() {
    const footer = document.getElementById('destiny-bottom-footer');
    if (!footer) return;

    footer.innerHTML = this.prizes.map((prz, idx) => `
      <div class="prize-card ${prz.wonBy ? (prz.type === 'skull' ? 'eliminated' : 'won') : ''}" data-prize-idx="${idx}">
        <span class="prize-icon">${prz.icon}</span>
        <span class="prize-label">${prz.name}</span>
        ${prz.wonBy ? `<span class="prize-winner-tag">WON BY: ${prz.wonBy}</span>` : ''}
      </div>
    `).join('');
  }

  renderRosterEditors() {
    const pList = document.getElementById('players-editor-list');
    const badge = document.getElementById('player-count-badge');
    if (badge) badge.textContent = this.players.length;

    if (pList) {
      pList.innerHTML = this.players.map((p, idx) => `
        <div class="editor-row">
          <span class="editor-index">#${idx + 1}</span>
          <span class="editor-color-dot" style="background: ${p.color}"></span>
          <input type="text" class="editor-input player-name-input" data-idx="${idx}" value="${p.name}" maxlength="20">
        </div>
      `).join('');

      pList.querySelectorAll('.player-name-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          this.players[idx].name = e.target.value.trim() || `Contender ${idx + 1}`;
          this.renderTopRunnerCards();
        });
      });
    }

    const przList = document.getElementById('prizes-editor-list');
    if (przList) {
      przList.innerHTML = this.prizes.map((prz, idx) => `
        <div class="editor-row">
          <span class="editor-index">#${idx + 1}</span>
          <span style="font-size: 13px;">${prz.icon}</span>
          <input type="text" class="editor-input prize-name-input" data-idx="${idx}" value="${prz.name}" maxlength="24">
        </div>
      `).join('');

      przList.querySelectorAll('.prize-name-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          this.prizes[idx].name = e.target.value.trim() || `Fate ${idx + 1}`;
          this.renderBottomPrizeCards();
        });
      });
    }
  }

  renderHistory() {
    const historyContainer = document.getElementById('destiny-history-list');
    if (!historyContainer) return;

    if (this.history.length === 0) {
      historyContainer.innerHTML = '<div class="history-empty">No rounds played yet. Launch a fate descent!</div>';
      return;
    }

    historyContainer.innerHTML = this.history.map(item => `
      <div class="history-item">
        <span class="winner">${item.player}</span>
        <span class="prize">${item.icon} ${item.prize}</span>
      </div>
    `).join('');
  }

  updateStatusText(text) {
    const status = document.getElementById('destiny-status-text');
    if (status) status.textContent = text;
  }

  showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'cyber-toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2500);
  }
}

// Global instance
window.ghostLeg = new GhostLegGame();
