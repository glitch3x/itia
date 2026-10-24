/**
 * ITIA // THE LADDER SUITE - MAIN APPLICATION CONTROLLER
 * Orchestrates mode switching, global audio state, modals, clipboard sharing, and keybindings.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Mode tabs & views
  const tabs = document.querySelectorAll('.mode-tab');
  const views = {
    forge: document.getElementById('view-forge'),
    destiny: document.getElementById('view-destiny'),
    ascent: document.getElementById('view-ascent'),
    risk: document.getElementById('view-risk')
  };

  function switchMode(mode) {
    window.soundFx.playClick();

    // Update active tab
    tabs.forEach(tab => {
      const isActive = tab.dataset.mode === mode;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update active view
    Object.keys(views).forEach(k => {
      if (views[k]) {
        views[k].classList.toggle('active', k === mode);
      }
    });

    // Trigger canvas resizing on switch
    setTimeout(() => {
      if (mode === 'forge' && window.wordForge) {
        window.wordForge.resize();
      } else if (mode === 'destiny' && window.ghostLeg) {
        window.ghostLeg.resizeCanvas();
        window.ghostLeg.render();
      } else if (mode === 'ascent' && window.arcadeClimber) {
        window.arcadeClimber.resize();
        window.arcadeClimber.render();
      }
    }, 50);

    if (window.fractalBg) window.fractalBg.pulse(1.0);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      switchMode(mode);
    });
  });

  // Audio Toggle
  const audioBtn = document.getElementById('audio-toggle-btn');
  const audioIcon = document.getElementById('audio-icon');
  if (audioBtn && audioIcon) {
    audioBtn.addEventListener('click', () => {
      const isSoundOn = window.soundFx.toggleMute();
      audioIcon.textContent = isSoundOn ? '🔊' : '🔇';
      window.ghostLeg.showToast(isSoundOn ? 'Sound Activated' : 'Audio Muted');
    });
  }

  // Help & Documentation Modal
  const rulesBtn = document.getElementById('rules-btn');
  const rulesModal = document.getElementById('rules-modal');
  const rulesCloseBtn = document.getElementById('rules-close-btn');

  if (rulesBtn && rulesModal) {
    rulesBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      rulesModal.classList.remove('hidden');
    });
  }

  if (rulesCloseBtn && rulesModal) {
    rulesCloseBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      rulesModal.classList.add('hidden');
    });
  }

  // Destiny Ceremony Modal Actions
  const winnerModal = document.getElementById('destiny-winner-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCopyBtn = document.getElementById('modal-copy-summary-btn');

  if (modalCloseBtn && winnerModal) {
    modalCloseBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      winnerModal.classList.add('hidden');
    });
  }

  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', () => {
      copyDestinyResults();
    });
  }

  // Export History Button
  const exportHistoryBtn = document.getElementById('export-history-btn');
  if (exportHistoryBtn) {
    exportHistoryBtn.addEventListener('click', () => {
      copyDestinyResults();
    });
  }

  function copyDestinyResults() {
    if (!window.ghostLeg) return;
    const completed = window.ghostLeg.players.filter(p => p.completed);

    if (completed.length === 0) {
      window.ghostLeg.showToast('No completed rounds to copy yet!');
      return;
    }

    let summaryText = `⚡ ITIA // LADDER OF DESTINY RESULTS ⚡\n`;
    summaryText += `═══════════════════════════════\n`;

    completed.forEach((p, idx) => {
      const prz = window.ghostLeg.prizes[p.endPrizeIndex];
      summaryText += `${idx + 1}. ${p.name} ➔ ${prz.icon} ${prz.name}\n`;
    });

    summaryText += `═══════════════════════════════\n`;
    summaryText += `I Think It's Art (@IThinkItsArt)\n`;

    navigator.clipboard.writeText(summaryText).then(() => {
      window.soundFx.playZap();
      window.ghostLeg.showToast('✓ Destiny results copied to clipboard!');
    }).catch(() => {
      window.ghostLeg.showToast('Failed to copy to clipboard');
    });
  }

  // Share Arcade Record Button
  const shareScoreBtn = document.getElementById('ascent-share-score-btn');
  if (shareScoreBtn && window.arcadeClimber) {
    shareScoreBtn.addEventListener('click', () => {
      const text = `▲ ITIA // THE MAD ASCENT RECORD ▲\nAltitude: ${window.arcadeClimber.altitude}M | Score: ${window.arcadeClimber.score.toLocaleString()} | Max Combo: x${window.arcadeClimber.maxCombo}\nClimb the void with @IThinkItsArt!`;
      navigator.clipboard.writeText(text).then(() => {
        window.soundFx.playZap();
        window.ghostLeg.showToast('✓ Score record copied!');
      });
    });
  }

  // Scenario Presets Buttons
  document.querySelectorAll('.preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      window.soundFx.playClick();
      const presetKey = pill.dataset.preset;
      window.ghostLeg.setupPresets(presetKey);
      window.ghostLeg.resetRunners();
      window.ghostLeg.render();
      window.ghostLeg.showToast(`Switched scenario to: ${pill.textContent.trim()}`);
    });
  });

  // Sub-tabs in Roster sidebar
  const subTabs = document.querySelectorAll('.tab-sub');
  const subContents = {
    players: document.getElementById('subtab-players'),
    prizes: document.getElementById('subtab-prizes'),
    history: document.getElementById('subtab-history')
  };

  subTabs.forEach(st => {
    st.addEventListener('click', () => {
      window.soundFx.playClick();
      subTabs.forEach(t => t.classList.remove('active'));
      st.classList.add('active');

      const target = st.dataset.sub;
      Object.keys(subContents).forEach(k => {
        if (subContents[k]) {
          subContents[k].classList.toggle('active', k === target);
        }
      });
    });
  });

  // Randomize & Batch Name Buttons
  const randomNamesBtn = document.getElementById('randomize-names-btn');
  if (randomNamesBtn) {
    randomNamesBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      const randomPool = [
        'Neo', 'Trinity', 'Morpheus', 'Cypher', 'Akira', 'Kaneda', 'Tetsuo', 'Motoko',
        'Batou', 'Spike', 'Faye', 'Jet', 'Zero', 'Guts', 'Griffith', 'Casca', 'Vash'
      ];
      window.ghostLeg.players.forEach(p => {
        p.name = randomPool[Math.floor(Math.random() * randomPool.length)];
      });
      window.ghostLeg.renderUI();
      window.ghostLeg.showToast('Contenders randomized!');
    });
  }

  const pasteNamesBtn = document.getElementById('paste-names-btn');
  if (pasteNamesBtn) {
    pasteNamesBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      const input = prompt("Paste contenders / Twitter handles / wallets (separated by lines or commas):", "Satoshi, Vitalik, Banksy, Beeple, Cipher, Ghost");
      if (!input) return;
      const parsed = input.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      if (parsed.length === 0) return;

      const count = Math.min(Math.max(parsed.length, 2), 10);
      const slider = document.getElementById('ladder-count-slider');
      const valEl = document.getElementById('ladder-count-val');
      if (slider) {
        slider.value = count;
        if (valEl) valEl.textContent = count;
      }

      window.ghostLeg.setLineCount(count);
      for (let i = 0; i < count; i++) {
        if (parsed[i]) window.ghostLeg.players[i].name = parsed[i];
      }
      window.ghostLeg.renderUI();
      window.ghostLeg.showToast(`✓ Imported ${count} contenders into ITIA Ladder!`);
    });
  }

  const clearNamesBtn = document.getElementById('clear-names-btn');
  if (clearNamesBtn) {
    clearNamesBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      window.ghostLeg.players.forEach((p, idx) => {
        p.name = `Player ${idx + 1}`;
      });
      window.ghostLeg.renderUI();
    });
  }

  const shufflePrizesBtn = document.getElementById('shuffle-prizes-btn');
  if (shufflePrizesBtn) {
    shufflePrizesBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      window.ghostLeg.prizes.sort(() => Math.random() - 0.5);
      window.ghostLeg.renderUI();
      window.ghostLeg.showToast('Rewards shuffled!');
    });
  }

  const presetPrizesBtn = document.getElementById('preset-prizes-btn');
  if (presetPrizesBtn) {
    presetPrizesBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      window.ghostLeg.setupPresets(window.ghostLeg.currentPresetKey || 'giveaway');
      window.ghostLeg.renderUI();
      window.ghostLeg.showToast('Reset to standard presets.');
    });
  }

  // Global Keyboard Navigation
  window.addEventListener('keydown', (e) => {
    // Mode switches
    if (e.target.tagName === 'INPUT') return;

    if (e.key === '1') switchMode('forge');
    if (e.key === '2') switchMode('destiny');
    if (e.key === '3') switchMode('ascent');
    if (e.key === '4') switchMode('risk');

    if (e.key.toLowerCase() === 'm') {
      const isSoundOn = window.soundFx.toggleMute();
      if (audioIcon) audioIcon.textContent = isSoundOn ? '🔊' : '🔇';
      window.ghostLeg.showToast(isSoundOn ? 'Sound On' : 'Muted');
    }

    if (e.key === 'Escape') {
      if (winnerModal) winnerModal.classList.add('hidden');
      if (rulesModal) rulesModal.classList.add('hidden');
    }
  });

  // Welcome Toast & Initial Sizing
  setTimeout(() => {
    if (window.wordForge) window.wordForge.resize();
    window.ghostLeg.showToast('✦ ITIA WORD FORGE READY ✦');
  }, 200);
});
