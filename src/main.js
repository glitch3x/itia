/**
 * ITIA STUDIO // MAIN APPLICATION CONTROLLER
 * Orchestrates UI interactions, artwork gallery templates, trace controls,
 * color studio, layer panel, symmetry, timelapse replay, and export card.
 */

import { studioAudio } from "./audio.js";
import { ART_TEMPLATES } from "./templates.js";
import { CanvasEngine } from "./canvasEngine.js";
import { WelcomeIntroController } from "./welcomeIntro.js";

class StudioApp {
  constructor() {
    this.audio = studioAudio;
    this.engine = null;
    this.activeTemplate = null;
    this.welcomeIntro = null;

    // UI state
    this.activeRightTab = "trace"; // trace, color, layers
    this.isWipeActive = false;
    this.wipeValue = 0.5;
    this.isZenMode = false;
    this.timelapseSpeed = 2;
    this.isPipVisible = false;

    this.init();
  }

  init() {
    const viewportCanvas = document.getElementById("studio-viewport");
    if (!viewportCanvas) return;

    this.engine = new CanvasEngine(viewportCanvas, {
      width: 1000,
      height: 1333,
      audio: this.audio
    });

    this.engine.onCursorMove = (x, y) => this.updateCursorStatus(x, y);
    this.engine.onViewChange = (zoom) => this.updateZoomStatus(zoom);
    this.engine.colorStudio.onColorChange = (hex) => this.onColorChanged(hex);
    this.engine.layerManager.onLayersChange = () => this.renderLayersList();

    this.bindToolbar();
    this.bindRightPanel();
    this.bindModals();
    this.bindShortcutsAndWindow();

    // Default template: Iridescent Hydrangea or Hellenistic Muse
    const defaultTemplate = ART_TEMPLATES.find(t => t.id === "iridescent_hydrangea") || ART_TEMPLATES[0];
    this.loadTemplate(defaultTemplate);
    this.renderGalleryGrid();
    this.renderLayersList();
    this.renderPaletteSwatches();

    // Initialize full-screen welcome & motion graphic flow
    this.welcomeIntro = new WelcomeIntroController(this, this.audio);
  }

  loadTemplate(template, asColoringBook = false) {
    this.activeTemplate = template;
    const titleEl = document.getElementById("active-artwork-title");
    if (titleEl) titleEl.textContent = template.title;

    const genreEl = document.getElementById("active-artwork-genre");
    if (genreEl) genreEl.textContent = template.genre;

    if (template.recommendedBrush) {
      this.selectBrushType(template.recommendedBrush);
    }

    const pipImage = document.getElementById("pip-image");
    if (pipImage) pipImage.src = template.image;

    const quickArtSelect = document.getElementById("quick-art-select");
    if (quickArtSelect && template) {
      quickArtSelect.value = template.id;
    }

    if (!template.image) {
      this.engine.traceEngine.clearReference();
      this.updateTraceControlsUI();
      this.engine.requestRender();
      return;
    }

    this.engine.traceEngine.loadReference(template.image, (img) => {
      this.engine.colorStudio.extractPaletteFromImage(img, 8);
      this.renderPaletteSwatches();

      if (asColoringBook) {
        const lineartLayer = this.engine.layerManager.layers[2];
        if (lineartLayer) {
          this.engine.traceEngine.bakeLineartToLayer(lineartLayer.ctx);
          this.engine.traceEngine.setOpacity(0.15);
          this.engine.layerManager.setActiveLayer(1);
          this.selectTool("bucket");
          this.showToast(`✨ Generated Coloring Book outlines for "${template.title}"! Switched to Paint Bucket.`, 4000);
        }
      } else {
        this.engine.traceEngine.setMode(template.defaultTraceMode || "normal");
        this.engine.traceEngine.setOpacity(0.5);
        this.showToast(`Loaded "${template.title}" reference. Opacity at 50%. Ready to trace!`, 3000);
      }

      this.updateTraceControlsUI();
      this.engine.requestRender();
    });
  }

  loadCustomImageFile(file) {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const customTemplate = {
          id: "custom_" + Date.now(),
          title: file.name.replace(/\.[^/.]+$/, ""),
          genre: "Custom Reference",
          image: e.target.result,
          palette: [
            { name: "Color 1", hex: "#ff1244" },
            { name: "Color 2", hex: "#0a58f6" },
            { name: "Color 3", hex: "#99ff00" },
            { name: "Color 4", hex: "#000000" },
            { name: "Color 5", hex: "#ffffff" }
          ]
        };
        this.loadTemplate(customTemplate, false);
        this.closeModal("gallery-modal");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  bindToolbar() {
    // Tool buttons
    document.querySelectorAll(".tool-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tool = btn.dataset.tool;
        this.selectTool(tool);
      });
    });

    // Brush Engine selectors
    document.querySelectorAll(".brush-type-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const brush = btn.dataset.brush;
        this.selectBrushType(brush);
      });
    });

    // Size Slider
    const sizeSlider = document.getElementById("brush-size-slider");
    const sizeVal = document.getElementById("brush-size-val");
    if (sizeSlider && sizeVal) {
      sizeSlider.addEventListener("input", (e) => {
        const s = parseInt(e.target.value, 10);
        sizeVal.textContent = `${s}px`;
        this.engine.brushEngine.setSize(s);
      });
    }

    // Opacity Slider
    const opacitySlider = document.getElementById("brush-opacity-slider");
    const opacityVal = document.getElementById("brush-opacity-val");
    if (opacitySlider && opacityVal) {
      opacitySlider.addEventListener("input", (e) => {
        const o = parseInt(e.target.value, 10) / 100;
        opacityVal.textContent = `${Math.round(o * 100)}%`;
        this.engine.brushEngine.setOpacity(o);
      });
    }

    // Quick Size Presets
    document.querySelectorAll(".size-preset-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        const s = parseInt(pill.dataset.size, 10);
        this.engine.brushEngine.setSize(s);
        const sizeSlider = document.getElementById("brush-size-slider");
        const sizeVal = document.getElementById("brush-size-val");
        if (sizeSlider) sizeSlider.value = s;
        if (sizeVal) sizeVal.textContent = `${s}px`;
        document.querySelectorAll(".size-preset-pill").forEach(p => p.classList.toggle("active", p === pill));
        this.audio.playClick();
      });
    });

    // Pencil Studio Grades & Modes
    document.querySelectorAll(".pencil-grade-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const grade = btn.dataset.grade;
        this.engine.brushEngine.setPencilGrade(grade);
        document.querySelectorAll(".pencil-grade-btn").forEach(b => b.classList.toggle("active", b === btn));
        this.audio.playClick();
        const desc = {
          "2H": "2H: Hard, silver-gray precision lines",
          "HB": "HB: Balanced sketching graphite",
          "2B": "2B: Soft, rich expressive graphite",
          "4B": "4B: Dark, velvety shading depth",
          "6B": "6B: Deep matte chiaroscuro darks"
        };
        this.showToast(desc[grade] || `Pencil Grade: ${grade}`, 2000);
      });
    });

    document.querySelectorAll(".pencil-mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.pmode;
        this.engine.brushEngine.setPencilMode(mode);
        document.querySelectorAll(".pencil-mode-btn").forEach(b => b.classList.toggle("active", b === btn));
        this.audio.playClick();
        this.showToast(mode === "shade" ? "📐 Flat Lead Tilt: Smooth Broad Shading" : "✏️ Pointed Tip: Precision Contours", 2000);
      });
    });

    // Colour Pouring / Bucket Studio Controls
    const bucketTolSlider = document.getElementById("bucket-tol-slider");
    const bucketTolVal = document.getElementById("bucket-tol-val");
    if (bucketTolSlider && bucketTolVal) {
      bucketTolSlider.addEventListener("input", (e) => {
        const tol = parseInt(e.target.value, 10);
        bucketTolVal.textContent = `${tol}%`;
        this.engine.bucketTolerance = tol;
      });
    }

    const bucketExpSlider = document.getElementById("bucket-exp-slider");
    const bucketExpVal = document.getElementById("bucket-exp-val");
    if (bucketExpSlider && bucketExpVal) {
      bucketExpSlider.addEventListener("input", (e) => {
        const exp = parseInt(e.target.value, 10);
        bucketExpVal.textContent = `${exp}px`;
        this.engine.bucketExpansion = exp;
      });
    }

    const gapToggleBtn = document.getElementById("btn-toggle-gap-closure");
    if (gapToggleBtn) {
      gapToggleBtn.addEventListener("click", () => {
        this.engine.bucketGapClosure = !this.engine.bucketGapClosure;
        gapToggleBtn.classList.toggle("active", this.engine.bucketGapClosure);
        const textSpan = gapToggleBtn.querySelector(".gap-text");
        if (textSpan) {
          textSpan.textContent = this.engine.bucketGapClosure ? "Gap Protect: ON" : "Gap Protect: OFF";
        }
        this.audio.playClick();
        this.showToast(this.engine.bucketGapClosure ? "🛡️ Gap Protection Enabled (blocks leaks)" : "Gap Protection Disabled", 2000);
      });
    }

    // Stabilizer Selector
    const stabSelect = document.getElementById("stabilizer-select");
    if (stabSelect) {
      stabSelect.addEventListener("change", (e) => {
        const val = parseFloat(e.target.value);
        this.engine.brushEngine.setStabilizer(val);
        this.audio.playClick();
      });
    }

    // Symmetry Selector
    const symSelect = document.getElementById("symmetry-select");
    if (symSelect) {
      symSelect.addEventListener("change", (e) => {
        this.engine.brushEngine.setSymmetryMode(e.target.value);
        this.audio.playClick();
        this.engine.requestRender();
        this.showToast(`Symmetry mode: ${e.target.options[e.target.selectedIndex].text}`, 2200);
      });
    }

    // Undo / Redo
    const undoBtn = document.getElementById("btn-undo");
    const redoBtn = document.getElementById("btn-redo");
    if (undoBtn) undoBtn.addEventListener("click", () => this.engine.undo());
    if (redoBtn) redoBtn.addEventListener("click", () => this.engine.redo());

    // Fit to Screen & Flip
    const fitBtn = document.getElementById("btn-fit-screen");
    const flipBtn = document.getElementById("btn-flip-h");
    if (fitBtn) fitBtn.addEventListener("click", () => this.engine.fitToScreen());
    if (flipBtn) flipBtn.addEventListener("click", () => {
      this.engine.toggleFlipH();
      this.audio.playClick();
    });

    // Sound toggle
    const soundBtn = document.getElementById("btn-sound-toggle");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        const unmuted = this.audio.toggleMute();
        soundBtn.classList.toggle("muted", !unmuted);
        soundBtn.setAttribute("title", unmuted ? "Mute Sound" : "Unmute Sound");
        this.showToast(unmuted ? "Sound Effects Enabled" : "Sound Effects Muted", 1800);
      });
    }

    // Zen Mode Toggle
    const zenBtn = document.getElementById("btn-zen-mode");
    const exitZenBtn = document.getElementById("btn-exit-zen");
    const toggleZen = () => {
      this.isZenMode = !this.isZenMode;
      document.body.classList.toggle("zen-mode-active", this.isZenMode);
      if (exitZenBtn) exitZenBtn.style.display = this.isZenMode ? "block" : "none";
      this.audio.playClick();
      this.showToast(this.isZenMode ? "Zen Mode: Press Tab to restore UI" : "Zen Mode exited", 2000);
      setTimeout(() => this.engine.fitToScreen(), 100);
    };
    if (zenBtn) zenBtn.addEventListener("click", toggleZen);
    if (exitZenBtn) exitZenBtn.addEventListener("click", toggleZen);
    this.toggleZen = toggleZen;

    // Floating Picture-in-Picture Reference Loupe
    const pipBtn = document.getElementById("btn-toggle-pip");
    const pipWindow = document.getElementById("pip-window");
    const pipImage = document.getElementById("pip-image");
    const pipCloseBtn = document.getElementById("btn-close-pip");
    const pipHeader = document.getElementById("pip-header");

    const togglePip = () => {
      this.isPipVisible = !this.isPipVisible;
      pipWindow.style.display = this.isPipVisible ? "flex" : "none";
      if (this.isPipVisible && this.activeTemplate) {
        pipImage.src = this.activeTemplate.image;
      }
      this.audio.playClick();
    };

    if (pipBtn) pipBtn.addEventListener("click", togglePip);
    if (pipCloseBtn) pipCloseBtn.addEventListener("click", togglePip);

    // Draggable PiP
    if (pipHeader && pipWindow) {
      let isDraggingPip = false;
      let pipOffset = { x: 0, y: 0 };
      pipHeader.addEventListener("mousedown", (e) => {
        isDraggingPip = true;
        pipOffset.x = e.clientX - pipWindow.offsetLeft;
        pipOffset.y = e.clientY - pipWindow.offsetTop;
      });
      window.addEventListener("mousemove", (e) => {
        if (isDraggingPip) {
          pipWindow.style.left = `${Math.max(10, e.clientX - pipOffset.x)}px`;
          pipWindow.style.top = `${Math.max(60, e.clientY - pipOffset.y)}px`;
          pipWindow.style.right = "auto";
          pipWindow.style.bottom = "auto";
        }
      });
      window.addEventListener("mouseup", () => { isDraggingPip = false; });
    }

    // Speedpaint Timelapse Replay
    const playTimelapseBtn = document.getElementById("btn-play-timelapse");
    const timelapseBar = document.getElementById("timelapse-bar");
    const timelapseProgress = document.getElementById("timelapse-progress");
    const stopTimelapseBtn = document.getElementById("btn-stop-timelapse");

    if (playTimelapseBtn) {
      playTimelapseBtn.addEventListener("click", () => {
        if (this.engine.timelapseLog.length === 0) {
          this.showToast("Draw a few strokes first to watch your speedpaint replay!", 3000);
          return;
        }
        timelapseBar.style.display = "flex";
        timelapseProgress.style.width = "0%";
        this.audio.playUndo(true);

        this.engine.playTimelapse(this.timelapseSpeed, (prog) => {
          timelapseProgress.style.width = `${Math.round(prog * 100)}%`;
        }, () => {
          this.showToast("✨ Speedpaint replay complete!", 2500);
          setTimeout(() => {
            timelapseBar.style.display = "none";
          }, 1200);
        });
      });
    }

    if (stopTimelapseBtn) {
      stopTimelapseBtn.addEventListener("click", () => {
        this.engine.stopTimelapse();
        timelapseBar.style.display = "none";
        this.showToast("Speedpaint replay stopped", 1800);
      });
    }

    document.querySelectorAll(".speed-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".speed-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.timelapseSpeed = parseFloat(btn.dataset.speed);
        this.audio.playClick();
      });
    });
  }

  selectTool(tool) {
    this.engine.setActiveTool(tool);
    document.querySelectorAll(".tool-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.tool === tool);
    });
    this.audio.playClick();

    const brushSubmenu = document.getElementById("brush-engines-submenu");
    const pencilWidget = document.getElementById("pencil-studio-widget");
    const bucketWidget = document.getElementById("bucket-studio-widget");

    if (brushSubmenu) {
      brushSubmenu.style.display = (tool === "brush" || tool === "line") ? "flex" : "none";
    }

    if (bucketWidget) {
      bucketWidget.style.display = (tool === "bucket") ? "flex" : "none";
    }

    if (pencilWidget) {
      const isPencil = (tool === "brush" || tool === "line") && this.engine.brushEngine.brushType === "pencil";
      pencilWidget.style.display = isPencil ? "flex" : "none";
    }
  }

  selectBrushType(type) {
    this.engine.brushEngine.setBrushType(type);
    document.querySelectorAll(".brush-type-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.brush === type);
    });
    this.audio.playClick();

    const pencilWidget = document.getElementById("pencil-studio-widget");
    if (pencilWidget) {
      const isPencil = type === "pencil" && (this.engine.activeTool === "brush" || this.engine.activeTool === "line");
      pencilWidget.style.display = isPencil ? "flex" : "none";
    }
  }

  bindRightPanel() {
    document.querySelectorAll(".dock-tab-btn").forEach(tab => {
      tab.addEventListener("click", () => {
        const targetTab = tab.dataset.tab;
        this.activeRightTab = targetTab;
        document.querySelectorAll(".dock-tab-btn").forEach(t => t.classList.toggle("active", t === tab));
        document.querySelectorAll(".dock-panel-content").forEach(p => {
          p.classList.toggle("active", p.dataset.panel === targetTab);
        });
        this.audio.playClick();
      });
    });

    // Quick Artwork Dropdown Switcher
    const quickArtSelect = document.getElementById("quick-art-select");
    if (quickArtSelect) {
      quickArtSelect.innerHTML = ART_TEMPLATES.map(t => `<option value="${t.id}">${t.title} (${t.genre})</option>`).join("");
      quickArtSelect.value = this.activeTemplate?.id || "";
      quickArtSelect.addEventListener("change", (e) => {
        const chosen = ART_TEMPLATES.find(t => t.id === e.target.value);
        if (chosen) {
          this.loadTemplate(chosen, false);
          this.renderGalleryGrid();
        }
      });
    }

    const traceOpacitySlider = document.getElementById("trace-opacity-slider");
    const traceOpacityVal = document.getElementById("trace-opacity-val");
    if (traceOpacitySlider && traceOpacityVal) {
      traceOpacitySlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10) / 100;
        traceOpacityVal.textContent = `${Math.round(val * 100)}%`;
        this.engine.traceEngine.setOpacity(val);
      });
    }

    document.querySelectorAll(".opacity-preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const pct = parseInt(btn.dataset.pct, 10);
        if (traceOpacitySlider) traceOpacitySlider.value = pct;
        if (traceOpacityVal) traceOpacityVal.textContent = `${pct}%`;
        this.engine.traceEngine.setOpacity(pct / 100);
        this.audio.playClick();
      });
    });

    document.querySelectorAll(".trace-mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        this.engine.traceEngine.setMode(mode);
        document.querySelectorAll(".trace-mode-btn").forEach(b => b.classList.toggle("active", b === btn));
        this.audio.playClick();
        this.showToast(`Trace filter: ${btn.textContent.trim()}`, 2000);
      });
    });

    const refVisBtn = document.getElementById("btn-toggle-ref-vis");
    if (refVisBtn) {
      refVisBtn.addEventListener("click", () => {
        const vis = this.engine.traceEngine.toggleVisible();
        refVisBtn.classList.toggle("active", vis);
        refVisBtn.innerHTML = vis ? "<span>👁️ Reference Visible</span>" : "<span>👁️‍🗨️ Reference Hidden</span>";
        this.audio.playClick();
      });
    }

    const bakeBtn = document.getElementById("btn-bake-outlines");
    if (bakeBtn) {
      bakeBtn.addEventListener("click", () => {
        const lineartLayer = this.engine.layerManager.layers[2];
        if (lineartLayer) {
          this.engine.traceEngine.bakeLineartToLayer(lineartLayer.ctx);
          this.engine.layerManager.setActiveLayer(1);
          this.selectTool("bucket");
          this.engine.saveState();
          this.engine.requestRender();
          this.audio.playBucketFill();
          this.showToast("🎨 Lines baked onto Lineart Layer! Now choose colors and use Paint Bucket to fill.", 4500);
        }
      });
    }

    const wipeToggle = document.getElementById("wipe-toggle-check");
    const wipeSliderContainer = document.getElementById("wipe-slider-container");
    const wipeSlider = document.getElementById("wipe-slider");
    if (wipeToggle && wipeSlider) {
      wipeToggle.addEventListener("change", (e) => {
        this.isWipeActive = e.target.checked;
        if (wipeSliderContainer) wipeSliderContainer.style.display = this.isWipeActive ? "block" : "none";
        this.engine.traceEngine.setWipe(this.isWipeActive ? parseFloat(wipeSlider.value) : null);
        this.audio.playClick();
      });

      wipeSlider.addEventListener("input", (e) => {
        if (this.isWipeActive) {
          this.engine.traceEngine.setWipe(parseFloat(e.target.value));
        }
      });
    }

    const hexInput = document.getElementById("hex-color-input");
    const colorPickerNative = document.getElementById("native-color-picker");

    if (hexInput) {
      hexInput.addEventListener("change", (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith("#")) val = "#" + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          this.engine.colorStudio.setColor(val, true, true);
        }
      });
    }

    if (colorPickerNative) {
      colorPickerNative.addEventListener("input", (e) => {
        this.engine.colorStudio.setColor(e.target.value, true, false);
      });
    }

    const quickDropperBtn = document.getElementById("btn-quick-eyedropper");
    if (quickDropperBtn) {
      quickDropperBtn.addEventListener("click", () => {
        this.selectTool("eyedropper");
        this.showToast("Eyedropper active: Click anywhere on canvas or reference to pick color", 3000);
      });
    }

    const addLayerBtn = document.getElementById("btn-add-layer");
    const dupLayerBtn = document.getElementById("btn-duplicate-layer");
    const mergeDownBtn = document.getElementById("btn-merge-down");
    const deleteLayerBtn = document.getElementById("btn-delete-layer");
    const clearLayerBtn = document.getElementById("btn-clear-layer");

    if (addLayerBtn) addLayerBtn.addEventListener("click", () => {
      this.engine.layerManager.addLayer();
      this.engine.saveState();
    });
    if (dupLayerBtn) dupLayerBtn.addEventListener("click", () => {
      this.engine.layerManager.duplicateActiveLayer();
      this.engine.saveState();
    });
    if (mergeDownBtn) mergeDownBtn.addEventListener("click", () => {
      this.engine.layerManager.mergeDown();
      this.engine.saveState();
    });
    if (deleteLayerBtn) deleteLayerBtn.addEventListener("click", () => {
      this.engine.layerManager.deleteActiveLayer();
      this.engine.saveState();
    });
    if (clearLayerBtn) clearLayerBtn.addEventListener("click", () => {
      if (confirm("Clear all content on the active layer?")) {
        this.engine.layerManager.clearActiveLayer();
        this.engine.saveState();
      }
    });

    document.querySelectorAll(".bg-color-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const c = btn.dataset.color;
        this.engine.layerManager.setBackgroundColor(c);
        this.audio.playClick();
        this.showToast(`Background set to: ${btn.textContent.trim()}`, 1800);
      });
    });

    const multiLayerFillCheck = document.getElementById("fill-multi-layer-check");
    if (multiLayerFillCheck) {
      multiLayerFillCheck.addEventListener("change", (e) => {
        this.engine.sampleAllLayersForFill = e.target.checked;
        this.audio.playClick();
        this.showToast(e.target.checked ? "Bucket samples lineart from ALL layers" : "Bucket fills within current layer only", 2500);
      });
    }
  }

  updateTraceControlsUI() {
    const traceOpacitySlider = document.getElementById("trace-opacity-slider");
    const traceOpacityVal = document.getElementById("trace-opacity-val");
    if (traceOpacitySlider && traceOpacityVal) {
      const pct = Math.round(this.engine.traceEngine.opacity * 100);
      traceOpacitySlider.value = pct;
      traceOpacityVal.textContent = `${pct}%`;
    }

    const currentMode = this.engine.traceEngine.mode;
    document.querySelectorAll(".trace-mode-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === currentMode);
    });

    const refThumb = document.getElementById("reference-dock-thumb");
    if (refThumb && this.activeTemplate) {
      refThumb.src = this.activeTemplate.image;
    }
  }

  onColorChanged(hex) {
    const previewDot = document.getElementById("active-color-preview-dot");
    const hexInput = document.getElementById("hex-color-input");
    const nativePicker = document.getElementById("native-color-picker");

    if (previewDot) previewDot.style.backgroundColor = hex;
    if (hexInput) hexInput.value = hex.toUpperCase();
    if (nativePicker) nativePicker.value = hex;

    this.renderRecentColors();
  }

  renderPaletteSwatches() {
    const container = document.getElementById("curated-palette-container");
    if (!container) return;
    container.innerHTML = "";

    const swatches = this.activeTemplate ? this.activeTemplate.palette : [];
    swatches.forEach(sw => {
      const btn = document.createElement("button");
      btn.className = "color-swatch-btn";
      btn.style.backgroundColor = sw.hex;
      btn.title = `${sw.name} (${sw.hex})`;
      btn.addEventListener("click", () => {
        this.engine.colorStudio.setColor(sw.hex, true, true);
      });
      container.appendChild(btn);
    });

    const extractedContainer = document.getElementById("extracted-palette-container");
    if (extractedContainer && this.engine.colorStudio.extractedPalette.length > 0) {
      extractedContainer.innerHTML = "";
      this.engine.colorStudio.extractedPalette.forEach(hex => {
        const btn = document.createElement("button");
        btn.className = "color-swatch-btn extracted";
        btn.style.backgroundColor = hex;
        btn.title = `Sampled (${hex})`;
        btn.addEventListener("click", () => {
          this.engine.colorStudio.setColor(hex, true, true);
        });
        extractedContainer.appendChild(btn);
      });
    }

    this.renderRecentColors();
  }

  renderRecentColors() {
    const container = document.getElementById("recent-colors-container");
    if (!container) return;
    container.innerHTML = "";

    this.engine.colorStudio.recentColors.slice(0, 14).forEach(hex => {
      const btn = document.createElement("button");
      btn.className = "color-swatch-btn mini";
      btn.style.backgroundColor = hex;
      btn.title = hex;
      btn.addEventListener("click", () => {
        this.engine.colorStudio.setColor(hex, true, true);
      });
      container.appendChild(btn);
    });
  }

  renderLayersList() {
    const list = document.getElementById("layers-list-container");
    if (!list) return;
    list.innerHTML = "";

    const lm = this.engine.layerManager;
    for (let i = lm.layers.length - 1; i >= 0; i--) {
      const layer = lm.layers[i];
      const isActive = i === lm.activeLayerIndex;

      const item = document.createElement("div");
      item.className = `layer-item ${isActive ? "active" : ""}`;

      const visBtn = document.createElement("button");
      visBtn.className = `layer-action-icon ${layer.visible ? "visible" : "hidden"}`;
      visBtn.innerHTML = layer.visible ? "👁️" : "✕";
      visBtn.title = layer.visible ? "Hide Layer" : "Show Layer";
      visBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        lm.toggleVisibility(i);
      });

      const info = document.createElement("div");
      info.className = "layer-info";
      info.innerHTML = `
        <span class="layer-name">${layer.name}</span>
        <span class="layer-meta">${Math.round(layer.opacity * 100)}% · ${layer.blendMode}</span>
      `;

      const lockBtn = document.createElement("button");
      lockBtn.className = `layer-action-icon ${layer.locked ? "locked" : ""}`;
      lockBtn.innerHTML = layer.locked ? "🔒" : "🔓";
      lockBtn.title = layer.locked ? "Unlock Layer" : "Lock Layer";
      lockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        lm.toggleLock(i);
      });

      item.appendChild(visBtn);
      item.appendChild(info);
      item.appendChild(lockBtn);

      item.addEventListener("click", () => {
        lm.setActiveLayer(i);
      });

      list.appendChild(item);
    }
  }

  renderGalleryGrid() {
    const grid = document.getElementById("gallery-cards-grid");
    if (!grid) return;
    grid.innerHTML = "";

    ART_TEMPLATES.forEach(tpl => {
      const isCurrent = this.activeTemplate && this.activeTemplate.id === tpl.id;
      const card = document.createElement("div");
      card.className = `gallery-card ${isCurrent ? "active-artwork-card" : ""}`;
      card.setAttribute("title", `Click to load "${tpl.title}"`);
      card.innerHTML = `
        <div class="gallery-card-thumb-wrap">
          <img src="${tpl.image}" alt="${tpl.title}" class="gallery-card-img" />
          <span class="gallery-card-badge">${tpl.genre}</span>
          ${isCurrent ? '<span class="current-badge">✓ ACTIVE</span>' : ''}
        </div>
        <div class="gallery-card-body">
          <div class="card-title-row">
            <h3 class="gallery-card-title">${tpl.title}</h3>
            <span class="card-difficulty">${tpl.difficulty}</span>
          </div>
          <p class="gallery-card-desc">${tpl.description}</p>
          <div class="gallery-card-swatches">
            ${tpl.palette.slice(0, 6).map(s => `<span class="mini-swatch" style="background-color: ${s.hex}" title="${s.name}"></span>`).join("")}
          </div>
          <div class="gallery-card-actions">
            <button class="gallery-btn trace-btn" data-id="${tpl.id}" title="Trace over reference with light table">
              <span>✏️ Trace Art</span>
            </button>
            <button class="gallery-btn colorbook-btn" data-id="${tpl.id}" title="Auto-extract lineart and start coloring with bucket">
              <span>🎨 Color Book</span>
            </button>
          </div>
        </div>
      `;

      // Clicking anywhere on the card loads the artwork!
      card.addEventListener("click", (e) => {
        if (e.target.closest(".colorbook-btn")) {
          e.stopPropagation();
          this.loadTemplate(tpl, true);
        } else {
          this.loadTemplate(tpl, false);
        }
        this.closeModal("gallery-modal");
        this.renderGalleryGrid();
      });

      grid.appendChild(card);
    });
  }

  bindModals() {
    const headerNewCanvasBtn = document.getElementById("btn-header-new-canvas");
    if (headerNewCanvasBtn) {
      headerNewCanvasBtn.addEventListener("click", () => {
        if (this.welcomeIntro) {
          this.welcomeIntro.openCanvasChooser();
        }
      });
    }

    const logoBranding = document.getElementById("logo-branding");
    if (logoBranding) {
      logoBranding.addEventListener("click", () => {
        if (this.welcomeIntro) {
          this.welcomeIntro.openCanvasChooser();
        }
      });
    }

    const openGalleryBtn = document.getElementById("btn-open-gallery");
    const headerGalleryBtn = document.getElementById("btn-header-gallery");
    if (openGalleryBtn) {
      openGalleryBtn.addEventListener("click", () => this.openModal("gallery-modal"));
    }
    if (headerGalleryBtn) {
      headerGalleryBtn.addEventListener("click", () => this.openModal("gallery-modal"));
    }

    const uploadInput = document.getElementById("custom-upload-input");
    const uploadBtnHeader = document.getElementById("btn-header-upload");
    if (uploadBtnHeader && uploadInput) {
      uploadBtnHeader.addEventListener("click", () => uploadInput.click());
    }

    if (uploadInput) {
      uploadInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          this.loadCustomImageFile(e.target.files[0]);
        }
      });
    }

    const dropzone = document.getElementById("gallery-dropzone");
    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
      dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("dragover");
      });
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.loadCustomImageFile(e.dataTransfer.files[0]);
        }
      });
    }

    const exportBtnHeader = document.getElementById("btn-header-export");
    if (exportBtnHeader) {
      exportBtnHeader.addEventListener("click", () => {
        this.prepareExportModal();
        this.openModal("export-modal");
      });
    }

    document.querySelectorAll(".modal-close-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const modal = e.target.closest(".modal-backdrop");
        if (modal) modal.classList.remove("open");
      });
    });

    document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove("open");
        }
      });
    });

    // Quick Download Button (Topbar)
    const quickDownloadBtn = document.getElementById("btn-quick-download");
    const doQuickDownload = () => {
      const cleanTitle = (this.activeTemplate?.title || "Masterpiece").replace(/\s+/g, "_");
      const incRef = document.getElementById("export-include-ref")?.checked || false;
      const dataUrl = this.engine.exportImage("png", 1.0, incRef);
      const filename = `ITIA_${cleanTitle}_${Date.now()}.png`;
      this.triggerDownload(dataUrl, filename);
      this.showToast(`⚡ Quick Downloaded "${this.activeTemplate?.title || "Masterpiece"}"!`, 3000);
    };

    if (quickDownloadBtn) {
      quickDownloadBtn.addEventListener("click", doQuickDownload);
    }
    this.doQuickDownload = doQuickDownload;

    // Side-by-Side Comparison Card Download
    const downloadCardBtn = document.getElementById("btn-download-side-by-side");
    if (downloadCardBtn) {
      downloadCardBtn.addEventListener("click", () => {
        const cleanTitle = (this.activeTemplate?.title || "Masterpiece").replace(/\s+/g, "_");
        const cardUrl = this.engine.exportSideBySideCard();
        this.triggerDownload(cardUrl, `ITIA_${cleanTitle}_Comparison_Card_${Date.now()}.png`);
        this.showToast("✨ Downloaded Side-by-Side Comparison Card!", 3000);
      });
    }

    const downloadPngBtn = document.getElementById("btn-download-png");
    const downloadJpgBtn = document.getElementById("btn-download-jpg");
    const copyClipboardBtn = document.getElementById("btn-copy-clipboard");

    if (downloadPngBtn) {
      downloadPngBtn.addEventListener("click", () => {
        const cleanTitle = (this.activeTemplate?.title || "Masterpiece").replace(/\s+/g, "_");
        const incRef = document.getElementById("export-include-ref")?.checked || false;
        const dataUrl = this.engine.exportImage("png", 1.0, incRef);
        this.triggerDownload(dataUrl, `ITIA_${cleanTitle}_${Date.now()}.png`);
        this.showToast("Artwork downloaded as lossless PNG!", 2500);
      });
    }

    if (downloadJpgBtn) {
      downloadJpgBtn.addEventListener("click", () => {
        const cleanTitle = (this.activeTemplate?.title || "Masterpiece").replace(/\s+/g, "_");
        const incRef = document.getElementById("export-include-ref")?.checked || false;
        const dataUrl = this.engine.exportImage("jpeg", 0.95, incRef);
        this.triggerDownload(dataUrl, `ITIA_${cleanTitle}_${Date.now()}.jpg`);
        this.showToast("Artwork downloaded as JPG!", 2500);
      });
    }

    // ITIA Project Document (.itia) Export & Import
    const downloadProjectBtn = document.getElementById("btn-download-project");
    if (downloadProjectBtn) {
      downloadProjectBtn.addEventListener("click", () => {
        const cleanTitle = (this.activeTemplate?.title || "Masterpiece").replace(/\s+/g, "_");
        const jsonStr = this.engine.exportProjectJSON({
          title: this.activeTemplate?.title || "Masterpiece",
          genre: this.activeTemplate?.genre || "Digital Art"
        });
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        this.triggerDownload(url, `ITIA_${cleanTitle}_${Date.now()}.itia`);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        this.showToast("📦 Saved ITIA Multi-Layer Project Document (.itia)!", 3000);
      });
    }

    const projectFileInput = document.getElementById("project-file-input");
    if (projectFileInput) {
      projectFileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const parsed = JSON.parse(evt.target.result);
            await this.engine.importProjectJSON(parsed);
            this.closeModal("export-modal");
            this.showToast(`✨ Restored ITIA Project Document "${parsed.meta?.title || file.name}"!`, 3500);
          } catch (err) {
            console.error("Project file import error:", err);
            this.showToast("Failed to restore project file. Ensure it is a valid .itia document.", 3000);
          }
        };
        reader.readAsText(file);
      });
    }

    if (copyClipboardBtn) {
      copyClipboardBtn.addEventListener("click", async () => {
        try {
          const incRef = document.getElementById("export-include-ref")?.checked || false;
          const dataUrl = this.engine.exportImage("png", 1.0, incRef);
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          this.showToast("Copied artwork image to clipboard!", 3000);
        } catch (err) {
          console.warn("Clipboard copy failed", err);
          this.showToast("Clipboard copy not supported by browser. Use Download instead.", 3000);
        }
      });
    }

    const shortcutsBtn = document.getElementById("btn-open-shortcuts");
    if (shortcutsBtn) {
      shortcutsBtn.addEventListener("click", () => this.openModal("shortcuts-modal"));
    }
  }

  prepareExportModal() {
    const previewImg = document.getElementById("export-preview-img");
    const incRef = document.getElementById("export-include-ref")?.checked || false;
    if (previewImg) {
      previewImg.src = this.engine.exportImage("png", 0.9, incRef);
    }
  }

  triggerDownload(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) {
      m.classList.add("open");
      this.audio.playClick();
    }
  }

  closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove("open");
  }

  bindShortcutsAndWindow() {
    window.addEventListener("resize", () => {
      this.engine.fitToScreen();
    });

    const zoomInBtn = document.getElementById("btn-zoom-in");
    const zoomOutBtn = document.getElementById("btn-zoom-out");
    if (zoomInBtn) zoomInBtn.addEventListener("click", () => this.engine.setZoom(this.engine.zoom * 1.2));
    if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => this.engine.setZoom(this.engine.zoom * 0.83));

    // Global Keybindings
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      // Ctrl+S / Cmd+S: Quick Download
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (this.doQuickDownload) this.doQuickDownload();
        return;
      }

      // Tab key toggles Zen Mode
      if (e.code === "Tab") {
        e.preventDefault();
        if (this.toggleZen) this.toggleZen();
        return;
      }

      const k = e.key.toLowerCase();
      if (k === "b") {
        this.selectTool("brush");
      } else if (k === "p") {
        this.selectTool("brush");
        this.selectBrushType("pencil");
      } else if (k === "e") {
        this.selectTool("eraser");
      } else if (k === "g") {
        this.selectTool("bucket");
      } else if (k === "i") {
        this.selectTool("eyedropper");
      } else if (k === "l") {
        this.selectTool("line");
      } else if (k === "[") {
        const s = Math.max(1, this.engine.brushEngine.size - 2);
        this.engine.brushEngine.setSize(s);
        const slider = document.getElementById("brush-size-slider");
        const val = document.getElementById("brush-size-val");
        if (slider) slider.value = s;
        if (val) val.textContent = `${s}px`;
      } else if (k === "]") {
        const s = Math.min(180, this.engine.brushEngine.size + 2);
        this.engine.brushEngine.setSize(s);
        const slider = document.getElementById("brush-size-slider");
        const val = document.getElementById("brush-size-val");
        if (slider) slider.value = s;
        if (val) val.textContent = `${s}px`;
      }
    });
  }

  updateCursorStatus(x, y) {
    const posEl = document.getElementById("status-cursor-pos");
    if (posEl) posEl.textContent = `X: ${x}  Y: ${y}`;
  }

  updateZoomStatus(zoom) {
    const zoomEl = document.getElementById("status-zoom-level");
    const topZoomEl = document.getElementById("top-zoom-display");
    const text = `${Math.round(zoom * 100)}%`;
    if (zoomEl) zoomEl.textContent = text;
    if (topZoomEl) topZoomEl.textContent = text;
  }

  showToast(message, duration = 2800) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "studio-toast";
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add("visible"), 20);

    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => container.removeChild(toast), 300);
    }, duration);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new StudioApp();
});
