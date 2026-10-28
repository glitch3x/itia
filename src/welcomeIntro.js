/**
 * ITIA STUDIO // WELCOME & MOTION GRAPHIC CONTROLLER
 * Orchestrates the luxury motion graphic intro (vertical ITIA typography),
 * the welcome presentation, and the immersive Canvas Chooser setup.
 */

import { ART_TEMPLATES } from "./templates.js";

export class WelcomeIntroController {
  constructor(app, audioEngine) {
    this.app = app;
    this.audio = audioEngine;

    this.overlay = null;
    this.particleCanvas = null;
    this.particleCtx = null;
    this.particleAnimId = null;
    this.particles = [];

    this.currentStage = "motion"; // "motion", "welcome", "choose_canvas"
    this.motionTimer = null;
    this.hasUserInteracted = false;
    this.activeGalleryCategory = "all";

    // Blank canvas draft state
    this.blankState = {
      preset: "portrait_3x4",
      width: 1000,
      height: 1333,
      paper: "cold_press",
      bg: "#f7f4ed",
      brush: "technical_pen"
    };

    this.init();
  }

  init() {
    this.overlay = document.getElementById("itia-intro-overlay");
    if (!this.overlay) return;

    this.initParticleBackground();
    this.bindEvents();
    this.startMotionGraphic();
  }

  /**
   * Ambient particle dust canvas effect for cinematic depth
   */
  initParticleBackground() {
    this.particleCanvas = document.getElementById("intro-particles-canvas");
    if (!this.particleCanvas) return;
    this.particleCtx = this.particleCanvas.getContext("2d");

    const resize = () => {
      this.particleCanvas.width = window.innerWidth;
      this.particleCanvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize 55 subtle glowing dust particles
    this.particles = [];
    const count = Math.min(65, Math.floor(window.innerWidth / 24));
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.45,
        vy: -0.2 - Math.random() * 0.55, // gentle upward drift
        radius: Math.random() * 1.8 + 0.6,
        alpha: Math.random() * 0.6 + 0.2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        pulseVal: Math.random() * Math.PI,
        color: Math.random() > 0.4 ? "255, 255, 255" : (Math.random() > 0.5 ? "0, 240, 255" : "255, 183, 3")
      });
    }

    const loop = () => {
      if (!this.particleCtx || !this.overlay || this.overlay.classList.contains("hidden")) {
        this.particleAnimId = requestAnimationFrame(loop);
        return;
      }

      const w = this.particleCanvas.width;
      const h = this.particleCanvas.height;
      this.particleCtx.clearRect(0, 0, w, h);

      for (let p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.pulseVal += p.pulseSpeed;

        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        const currentAlpha = p.alpha * (0.6 + 0.4 * Math.sin(p.pulseVal));
        this.particleCtx.beginPath();
        this.particleCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.particleCtx.fillStyle = `rgba(${p.color}, ${currentAlpha})`;
        this.particleCtx.shadowBlur = p.radius * 3;
        this.particleCtx.shadowColor = `rgba(${p.color}, 0.8)`;
        this.particleCtx.fill();
      }

      this.particleAnimId = requestAnimationFrame(loop);
    };

    loop();
  }

  /**
   * Stage 1: Play the vertical ITIA serif motion graphic
   */
  startMotionGraphic() {
    this.currentStage = "motion";
    this.overlay.className = "itia-intro-overlay stage-motion";

    const letters = this.overlay.querySelectorAll(".intro-letter");
    letters.forEach((el, idx) => {
      el.classList.remove("revealed");
      el.style.animationDelay = `${0.35 + idx * 0.38}s`;
    });

    // Sound effect on start
    try {
      this.audio.ensureContext();
      this.audio.playIntroChord();
      letters.forEach((_, idx) => {
        setTimeout(() => {
          if (this.currentStage === "motion") {
            this.audio.playLetterChime(idx);
          }
        }, (350 + idx * 380));
      });
    } catch (e) {
      // Audio context might require initial interaction
    }

    // Auto-advance to Welcome after motion graphic completes (~3.4s)
    clearTimeout(this.motionTimer);
    this.motionTimer = setTimeout(() => {
      if (this.currentStage === "motion") {
        this.goToStage("welcome");
      }
    }, 3600);
  }

  /**
   * Switch between stages: "motion" -> "welcome" -> "choose_canvas"
   */
  goToStage(stageName) {
    clearTimeout(this.motionTimer);
    this.currentStage = stageName;
    this.overlay.className = `itia-intro-overlay stage-${stageName}`;

    this.audio.playClick();

    if (stageName === "choose_canvas") {
      this.renderMasterpieceCards();
      this.updateBlankCanvasSummary();
    }
  }

  bindEvents() {
    // Click on motion screen advances to welcome
    const motionSection = document.getElementById("intro-motion-view");
    if (motionSection) {
      motionSection.addEventListener("click", (e) => {
        if (e.target.closest("#btn-skip-intro")) return;
        if (this.currentStage === "motion") {
          this.goToStage("welcome");
        }
      });
    }

    // Skip Button (instant jump to Canvas Chooser)
    const btnSkip = document.getElementById("btn-skip-intro");
    if (btnSkip) {
      btnSkip.addEventListener("click", (e) => {
        e.stopPropagation();
        this.goToStage("choose_canvas");
      });
    }

    // Welcome screen buttons
    const btnWelcomeProceed = document.getElementById("btn-welcome-choose-canvas");
    if (btnWelcomeProceed) {
      btnWelcomeProceed.addEventListener("click", () => {
        this.goToStage("choose_canvas");
      });
    }

    const btnWelcomeQuick = document.getElementById("btn-welcome-quick-start");
    if (btnWelcomeQuick) {
      btnWelcomeQuick.addEventListener("click", () => {
        // Quick launch with first master study (or Iridescent Hydrangea)
        const template = ART_TEMPLATES.find(t => t.id === "iridescent_hydrangea") || ART_TEMPLATES[0];
        this.launchWithTemplate(template, false);
      });
    }

    // Canvas Chooser Tab Switchers (Masterpiece vs Blank vs Custom)
    const navTabs = this.overlay.querySelectorAll(".chooser-tab-btn");
    navTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        navTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        const targetPanel = tab.dataset.target;
        const panels = this.overlay.querySelectorAll(".chooser-panel");
        panels.forEach(p => p.classList.remove("active"));
        const activePanel = document.getElementById(targetPanel);
        if (activePanel) activePanel.classList.add("active");

        this.audio.playClick();
      });
    });

    // Masterpiece Category Filters
    const catPills = this.overlay.querySelectorAll(".category-pill");
    catPills.forEach(pill => {
      pill.addEventListener("click", () => {
        catPills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        this.activeGalleryCategory = pill.dataset.category;
        this.renderMasterpieceCards();
        this.audio.playClick();
      });
    });

    // Blank Canvas Preset Dimensions
    const sizePresets = this.overlay.querySelectorAll(".size-preset-card");
    const widthInput = document.getElementById("blank-canvas-width");
    const heightInput = document.getElementById("blank-canvas-height");

    sizePresets.forEach(preset => {
      preset.addEventListener("click", () => {
        sizePresets.forEach(p => p.classList.remove("active"));
        preset.classList.add("active");

        const w = parseInt(preset.dataset.w, 10);
        const h = parseInt(preset.dataset.h, 10);
        this.blankState.preset = preset.dataset.preset;
        this.blankState.width = w;
        this.blankState.height = h;

        if (widthInput) widthInput.value = w;
        if (heightInput) heightInput.value = h;

        this.updateBlankCanvasSummary();
        this.audio.playClick();
      });
    });

    if (widthInput && heightInput) {
      const onCustomDimChange = () => {
        const w = Math.max(400, Math.min(4000, parseInt(widthInput.value, 10) || 1000));
        const h = Math.max(400, Math.min(4000, parseInt(heightInput.value, 10) || 1000));
        this.blankState.width = w;
        this.blankState.height = h;
        sizePresets.forEach(p => p.classList.remove("active"));
        this.updateBlankCanvasSummary();
      };
      widthInput.addEventListener("input", onCustomDimChange);
      heightInput.addEventListener("input", onCustomDimChange);
    }

    // Paper Substrate Choice in Blank Canvas
    const paperCards = this.overlay.querySelectorAll(".paper-option-card");
    paperCards.forEach(card => {
      card.addEventListener("click", () => {
        paperCards.forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        this.blankState.paper = card.dataset.paper;
        this.updateBlankCanvasSummary();
        this.audio.playClick();
      });
    });

    // Background Shade Choice in Blank Canvas
    const bgBtns = this.overlay.querySelectorAll(".blank-bg-btn");
    bgBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        bgBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.blankState.bg = btn.dataset.bg;
        this.updateBlankCanvasSummary();
        this.audio.playClick();
      });
    });

    // Initial Brush Choice in Blank Canvas
    const brushBtns = this.overlay.querySelectorAll(".blank-brush-btn");
    brushBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        brushBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.blankState.brush = btn.dataset.brush;
        this.updateBlankCanvasSummary();
        this.audio.playClick();
      });
    });

    // Launch Blank Canvas CTA
    const btnLaunchBlank = document.getElementById("btn-launch-blank-canvas");
    if (btnLaunchBlank) {
      btnLaunchBlank.addEventListener("click", () => {
        this.launchBlankCanvas();
      });
    }

    // Custom Upload dropzone in Canvas Chooser
    const chooserDropzone = document.getElementById("chooser-upload-dropzone");
    const chooserFileInput = document.getElementById("chooser-file-input");
    const chooserUploadBtn = document.getElementById("btn-chooser-browse");

    if (chooserUploadBtn && chooserFileInput) {
      chooserUploadBtn.addEventListener("click", () => chooserFileInput.click());
    }

    if (chooserFileInput) {
      chooserFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleCustomFileChosen(e.target.files[0]);
        }
      });
    }

    if (chooserDropzone) {
      chooserDropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        chooserDropzone.classList.add("dragover");
      });
      chooserDropzone.addEventListener("dragleave", () => {
        chooserDropzone.classList.remove("dragover");
      });
      chooserDropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        chooserDropzone.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleCustomFileChosen(e.dataTransfer.files[0]);
        }
      });
    }

    // Global Key shortcuts
    window.addEventListener("keydown", (e) => {
      if (this.overlay && !this.overlay.classList.contains("hidden")) {
        if (e.key === "Escape") {
          // Esc skips motion or closes to default if already inside studio
          if (this.currentStage === "motion") {
            this.goToStage("choose_canvas");
          } else if (this.currentStage === "welcome") {
            this.goToStage("choose_canvas");
          }
        } else if (e.key === "Enter" || e.key === " ") {
          if (this.currentStage === "motion") {
            this.goToStage("welcome");
          }
        }
      }
    });

    // Sound toggle on intro screen
    const soundToggle = document.getElementById("btn-intro-sound-toggle");
    if (soundToggle) {
      soundToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const unmuted = this.audio.toggleMute();
        soundToggle.classList.toggle("muted", !unmuted);
        soundToggle.title = unmuted ? "Mute Tactile Audio" : "Unmute Tactile Audio";
      });
    }

    // Close button on Canvas Chooser (if re-opened from studio)
    const btnCloseChooser = document.getElementById("btn-close-chooser-modal");
    if (btnCloseChooser) {
      btnCloseChooser.addEventListener("click", () => {
        this.closeOverlay();
      });
    }
  }

  /**
   * Render Masterpiece Cards Grid in the Canvas Chooser
   */
  renderMasterpieceCards() {
    const grid = document.getElementById("chooser-masterpiece-grid");
    if (!grid) return;

    grid.innerHTML = "";

    const filtered = ART_TEMPLATES.filter(tmpl => {
      if (this.activeGalleryCategory === "all") return true;
      if (this.activeGalleryCategory === "anime") {
        return tmpl.genre.toLowerCase().includes("anime") ||
               tmpl.genre.toLowerCase().includes("holographic") ||
               tmpl.genre.toLowerCase().includes("hero");
      }
      if (this.activeGalleryCategory === "noir") {
        return tmpl.genre.toLowerCase().includes("noir") ||
               tmpl.genre.toLowerCase().includes("cyber") ||
               tmpl.genre.toLowerCase().includes("neon") ||
               tmpl.genre.toLowerCase().includes("chiaroscuro");
      }
      if (this.activeGalleryCategory === "couture") {
        return tmpl.genre.toLowerCase().includes("couture") ||
               tmpl.genre.toLowerCase().includes("pop") ||
               tmpl.genre.toLowerCase().includes("surreal") ||
               tmpl.genre.toLowerCase().includes("fracture") ||
               tmpl.genre.toLowerCase().includes("organic");
      }
      return true;
    });

    filtered.forEach(tmpl => {
      const card = document.createElement("div");
      card.className = "chooser-art-card";

      // Palette swatches preview
      let swatchesHtml = "";
      if (tmpl.palette && tmpl.palette.length) {
        swatchesHtml = `
          <div class="card-palette-strip" title="Authentic Master Pigment Palette">
            ${tmpl.palette.slice(0, 6).map(p => `
              <span class="card-palette-dot" style="background-color: ${p.hex};" title="${p.name} (${p.hex})"></span>
            `).join("")}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="card-image-wrap">
          <img src="${tmpl.image}" alt="${tmpl.title}" loading="lazy" class="card-preview-thumb">
          <div class="card-badge-row">
            <span class="card-genre-badge">${tmpl.genre}</span>
            <span class="card-diff-badge">${tmpl.difficulty || "Master Study"}</span>
          </div>
          <div class="card-quick-overlay">
            <button class="card-cta-btn primary btn-trace-card" title="Open as semi-transparent reference on the Light Table">
              <span>✏️ Trace Study</span>
            </button>
            <button class="card-cta-btn secondary btn-colorbook-card" title="Extract clean ink contours and start coloring immediately">
              <span>🪣 Coloring Book</span>
            </button>
          </div>
        </div>
        <div class="card-meta">
          <h4 class="card-title">${tmpl.title}</h4>
          <p class="card-subtitle">${tmpl.subtitle || tmpl.description}</p>
          ${swatchesHtml}
        </div>
      `;

      // Event handlers for actions
      const btnTrace = card.querySelector(".btn-trace-card");
      btnTrace.addEventListener("click", (e) => {
        e.stopPropagation();
        this.launchWithTemplate(tmpl, false);
      });

      const btnColorBook = card.querySelector(".btn-colorbook-card");
      btnColorBook.addEventListener("click", (e) => {
        e.stopPropagation();
        this.launchWithTemplate(tmpl, true);
      });

      // Clicking card body also triggers trace
      card.addEventListener("click", () => {
        this.launchWithTemplate(tmpl, false);
      });

      grid.appendChild(card);
    });
  }

  updateBlankCanvasSummary() {
    const summaryDimensions = document.getElementById("blank-summary-dimensions");
    const summaryPaper = document.getElementById("blank-summary-paper");
    const summaryBg = document.getElementById("blank-summary-bg");

    if (summaryDimensions) {
      summaryDimensions.textContent = `${this.blankState.width} × ${this.blankState.height} px`;
    }
    if (summaryPaper) {
      const paperNames = {
        cold_press: "Cold-Press Watercolor",
        linen_canvas: "Fine Linen Canvas",
        toned_kraft: "Toned Kraft Paper",
        none: "Smooth Bristol (Flat)"
      };
      summaryPaper.textContent = paperNames[this.blankState.paper] || this.blankState.paper;
    }
    if (summaryBg) {
      const bgNames = {
        "#f7f4ed": "Rag Paper (Ivory)",
        "#f5efe6": "Warm Cream",
        "#181a20": "Dark Slate",
        "transparent": "Transparent (Alpha)"
      };
      summaryBg.textContent = bgNames[this.blankState.bg] || this.blankState.bg;
    }
  }

  /**
   * Launch Studio with a chosen Masterpiece Template
   */
  launchWithTemplate(template, asColoringBook = false) {
    this.audio.playCanvasEnter();

    // Load template in StudioApp
    this.app.loadTemplate(template, asColoringBook);

    this.closeOverlay();
  }

  /**
   * Launch Studio with a Pristine Blank Canvas
   */
  launchBlankCanvas() {
    this.audio.playCanvasEnter();

    const { width, height, paper, bg, brush } = this.blankState;

    // Set dimensions & reset
    this.app.engine.setDimensions(width, height);
    this.app.engine.setPaperTexture(paper);

    // Sync paper texture selector in topbar
    const paperSelect = document.getElementById("paper-texture-select");
    if (paperSelect) paperSelect.value = paper;

    // Set background color on Layer 0
    const bgLayer = this.app.engine.layerManager.layers[0];
    if (bgLayer) {
      bgLayer.clear();
      if (bg !== "transparent") {
        bgLayer.ctx.fillStyle = bg;
        bgLayer.ctx.fillRect(0, 0, width, height);
      }
    }

    // Clear all upper drawing layers for pristine blank canvas
    for (let i = 1; i < this.app.engine.layerManager.layers.length; i++) {
      this.app.engine.layerManager.layers[i].clear();
    }

    // Set active layer to Inking Layer (Layer 2) or Colors Layer (Layer 1)
    this.app.engine.layerManager.setActiveLayer(2);

    // Clear trace reference
    this.app.engine.traceEngine.clearReference();
    this.app.activeTemplate = {
      id: "blank_canvas",
      title: "Pristine Blank Canvas",
      genre: "Original Artwork",
      image: ""
    };

    const titleEl = document.getElementById("active-artwork-title");
    if (titleEl) titleEl.textContent = "Bespoke Blank Canvas";
    const genreEl = document.getElementById("active-artwork-genre");
    if (genreEl) genreEl.textContent = `${width}×${height} · ${paper}`;

    // Select initial brush
    this.app.selectBrushType(brush || "technical_pen");
    this.app.selectTool("brush");

    this.app.engine.requestRender();
    this.app.renderLayersList();

    this.closeOverlay();
    this.app.showToast(`✨ Blank Canvas ready (${width} × ${height} px). Begin your masterpiece!`, 4000);
  }

  /**
   * Handle user uploaded image file
   */
  handleCustomFileChosen(file) {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    this.audio.playCanvasEnter();
    this.app.loadCustomImageFile(file);
    this.closeOverlay();
  }

  /**
   * Smooth animated dissolve transition to the main canvas
   */
  closeOverlay() {
    this.overlay.classList.add("exiting");
    setTimeout(() => {
      this.overlay.classList.add("hidden");
      this.overlay.classList.remove("exiting");
      // Trigger canvas fit to screen to guarantee crisp alignment
      this.app.engine.fitToScreen();
      this.app.engine.requestRender();
    }, 600);
  }

  /**
   * Reopen the Canvas Chooser launcher from topbar or logo
   */
  openCanvasChooser() {
    this.overlay.classList.remove("hidden", "exiting");
    this.goToStage("choose_canvas");
  }

  /**
   * Replay the full motion graphic intro
   */
  replayIntro() {
    this.overlay.classList.remove("hidden", "exiting");
    this.startMotionGraphic();
  }
}
