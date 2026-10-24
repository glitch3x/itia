/**
 * ITIA // RISK LADDER (THE MULTIPLIER TOWER)
 * High-stakes rung climbing with increasing multiplier rewards and failure probability.
 * Cash out to secure the bag or risk it all to reach 500x Art God ascension!
 */

class RiskLadder {
  constructor() {
    this.stake = 100;
    this.currentStep = 0; // 0 = Ground
    this.isPlaying = false;
    this.balance = 2500;

    // 15 Multiplier Rungs
    this.rungs = [
      { step: 15, mult: 500.0, failChance: 52, label: 'ART GOD // 500x' },
      { step: 14, mult: 250.0, failChance: 48, label: 'TITAN // 250x' },
      { step: 13, mult: 120.0, failChance: 44, label: 'GENESIS // 120x' },
      { step: 12, mult: 60.0, failChance: 40, label: 'ETHEREAL // 60x' },
      { step: 11, mult: 30.0, failChance: 36, label: 'IMMORTAL // 30x' },
      { step: 10, mult: 18.0, failChance: 32, label: 'APEX // 18x' },
      { step: 9, mult: 10.0, failChance: 28, label: 'DIAMOND // 10x' },
      { step: 8, mult: 6.5, failChance: 24, label: 'GOLDEN // 6.5x' },
      { step: 7, mult: 4.2, failChance: 20, label: 'HIGH ART // 4.2x' },
      { step: 6, mult: 2.8, failChance: 17, label: 'EXHIBIT // 2.8x' },
      { step: 5, mult: 2.0, failChance: 14, label: 'GALLERY // 2.0x' },
      { step: 4, mult: 1.6, failChance: 11, label: 'CURATOR // 1.6x' },
      { step: 3, mult: 1.35, failChance: 8, label: 'COLLECTOR // 1.35x' },
      { step: 2, mult: 1.2, failChance: 6, label: 'PATRON // 1.2x' },
      { step: 1, mult: 1.1, failChance: 4, label: 'ENTRANT // 1.1x' }
    ];

    this.init();
  }

  init() {
    this.renderLadderTrack();
    this.bindEvents();
    this.updateStatusDisplay();
  }

  bindEvents() {
    // Stake selector buttons
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isPlaying) return;
        document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.stake = parseInt(btn.dataset.stake, 10);
        window.soundFx.playClick();
        this.updateStatusDisplay();
      });
    });

    // Step Up button
    const stepBtn = document.getElementById('risk-step-btn');
    if (stepBtn) {
      stepBtn.addEventListener('click', () => this.stepUp());
    }

    // Cash Out button
    const cashBtn = document.getElementById('risk-cashout-btn');
    if (cashBtn) {
      cashBtn.addEventListener('click', () => this.cashOut());
    }
  }

  renderLadderTrack() {
    const track = document.getElementById('risk-ladder-track');
    if (!track) return;

    track.innerHTML = this.rungs.map(r => {
      let tierTag = 'A';
      if (r.step >= 13) tierTag = 'I';
      else if (r.step >= 9) tierTag = 'T';
      else if (r.step >= 5) tierTag = 'I';

      return `
        <div class="risk-rung ${r.step === 15 ? 'god-tier' : ''}" id="risk-rung-${r.step}" data-step="${r.step}">
          <span class="rung-level">[ ${tierTag} ] RUNG 0${r.step > 9 ? r.step : '0' + r.step}</span>
          <span class="rung-name">${r.label}</span>
          <span class="rung-mult">${r.mult}x</span>
        </div>
      `;
    }).join('');
  }

  stepUp() {
    if (!this.isPlaying) {
      // Begin new run
      this.isPlaying = true;
      this.currentStep = 0;
      this.log(`Started climb with stake of ${this.stake} ITIA Gems.`, 'step');
    }

    const nextStep = this.currentStep + 1;
    const targetRung = this.rungs.find(r => r.step === nextStep);

    if (!targetRung) {
      // Reached apex! Auto cashout
      this.cashOut();
      return;
    }

    // Step sound & tension riser
    window.soundFx.playStep(450 + nextStep * 35);
    window.soundFx.playTensionRiser(nextStep / 15);

    // Roll probability
    const roll = Math.random() * 100;
    const failed = roll < targetRung.failChance;

    if (failed) {
      // Rung snapped!
      this.triggerBreak(targetRung);
      return;
    }

    // Step succeeded!
    this.currentStep = nextStep;
    window.soundFx.playZap();
    if (window.fractalBg) window.fractalBg.pulse(0.6 + nextStep * 0.1);

    this.log(`✓ Ascended to Rung ${nextStep} (${targetRung.mult}x)!`, 'success');
    this.highlightRungs();
    this.updateStatusDisplay();

    // If reached peak rung (15)
    if (this.currentStep === 15) {
      this.log(`🏆 MAXIMUM ASCENSION REACHED! 500x JACKPOT!`, 'success');
      this.cashOut();
    }
  }

  triggerBreak(failedRung) {
    this.isPlaying = false;
    window.soundFx.playLoss();

    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 400);

    this.log(`✕ SNAP! Rung ${failedRung.step} broke under pressure! Stake lost.`, 'fail');

    // Visual crack on rung
    const el = document.getElementById(`risk-rung-${failedRung.step}`);
    if (el) {
      el.style.backgroundColor = 'rgba(255, 42, 95, 0.4)';
      el.style.borderColor = '#ff2a5f';
      setTimeout(() => {
        el.style.backgroundColor = '';
        el.style.borderColor = '';
      }, 1200);
    }

    this.currentStep = 0;
    this.highlightRungs();
    this.updateStatusDisplay();
  }

  cashOut() {
    if (!this.isPlaying || this.currentStep === 0) return;

    const currentRung = this.rungs.find(r => r.step === this.currentStep);
    const mult = currentRung ? currentRung.mult : 1.0;
    const payout = Math.floor(this.stake * mult);

    this.isPlaying = false;
    window.soundFx.playCashout();
    window.soundFx.playWin();

    if (window.fractalBg) window.fractalBg.pulse(2.0);

    this.log(`💰 CASHED OUT! Secured ${payout.toLocaleString()} ITIA Gems at ${mult}x!`, 'success');

    this.currentStep = 0;
    this.highlightRungs();
    this.updateStatusDisplay();
  }

  highlightRungs() {
    this.rungs.forEach(r => {
      const el = document.getElementById(`risk-rung-${r.step}`);
      if (!el) return;

      el.classList.remove('active', 'passed');

      if (r.step === this.currentStep) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (r.step < this.currentStep) {
        el.classList.add('passed');
      }
    });

    // Update ITIA Monolith Totem Pillar (A, I, T, I)
    const tA = document.getElementById('totem-A');
    const tI2 = document.getElementById('totem-I2');
    const tT = document.getElementById('totem-T');
    const tI1 = document.getElementById('totem-I1');

    if (tA && tI2 && tT && tI1) {
      [tA, tI2, tT, tI1].forEach(t => t.classList.remove('active', 'passed'));

      if (this.currentStep === 0) {
        tA.classList.add('active');
      } else if (this.currentStep <= 4) {
        tA.classList.add('active');
      } else if (this.currentStep <= 8) {
        tA.classList.add('passed');
        tI2.classList.add('active');
      } else if (this.currentStep <= 12) {
        tA.classList.add('passed');
        tI2.classList.add('passed');
        tT.classList.add('active');
      } else {
        tA.classList.add('passed');
        tI2.classList.add('passed');
        tT.classList.add('passed');
        tI1.classList.add('active');
      }
    }
  }

  updateStatusDisplay() {
    const stepEl = document.getElementById('risk-curr-step');
    const multEl = document.getElementById('risk-curr-mult');
    const valEl = document.getElementById('risk-curr-val');
    const failEl = document.getElementById('risk-fail-chance');
    const cashBtn = document.getElementById('risk-cashout-btn');
    const stepBtn = document.getElementById('risk-step-btn');

    const currRung = this.rungs.find(r => r.step === this.currentStep);
    const nextRung = this.rungs.find(r => r.step === this.currentStep + 1);

    if (this.currentStep === 0) {
      if (stepEl) stepEl.textContent = 'GROUND';
      if (multEl) multEl.textContent = '1.00x';
      if (valEl) valEl.textContent = `${this.stake} ITIA`;
      if (failEl) failEl.textContent = `${nextRung ? nextRung.failChance : 4}% (Next)`;
      if (cashBtn) cashBtn.classList.add('disabled');
      if (stepBtn) stepBtn.querySelector('.btn-text').textContent = '🪜 STEP ONTO LADDER';
    } else {
      const mult = currRung ? currRung.mult : 1.0;
      const currentVal = Math.floor(this.stake * mult);

      if (stepEl) stepEl.textContent = `RUNG ${this.currentStep} / 15`;
      if (multEl) multEl.textContent = `${mult}x`;
      if (valEl) valEl.textContent = `${currentVal.toLocaleString()} ITIA`;
      if (failEl) failEl.textContent = `${nextRung ? nextRung.failChance : 50}% (Next)`;
      if (cashBtn) cashBtn.classList.remove('disabled');
      if (stepBtn) stepBtn.querySelector('.btn-text').textContent = `🪜 CLIMB TO RUNG ${this.currentStep + 1}`;
    }
  }

  log(msg, type = 'system') {
    const feed = document.getElementById('risk-log-feed');
    if (!feed) return;

    const item = document.createElement('div');
    item.className = `log-item ${type}`;
    item.textContent = `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${msg}`;
    feed.insertBefore(item, feed.firstChild);

    // Keep max 20 entries
    while (feed.children.length > 20) {
      feed.removeChild(feed.lastChild);
    }
  }
}

// Global instance
window.riskLadder = new RiskLadder();
