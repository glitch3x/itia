/**
 * ITIA STUDIO // CANVAS ENGINE
 * Core viewport coordinator: Pan/Zoom, View Transform, High-DPI rendering,
 * Pointer input, History Undo/Redo stack, Symmetry, and Timelapse Playback.
 */

import { LayerManager } from "./layerManager.js";
import { TraceEngine } from "./traceEngine.js";
import { BrushEngine } from "./brushEngine.js";
import { FloodFill } from "./floodFill.js";
import { ColorStudio } from "./colorStudio.js";

export class CanvasEngine {
  constructor(viewportCanvas, options = {}) {
    this.viewportCanvas = viewportCanvas;
    this.viewportCtx = viewportCanvas.getContext("2d", { alpha: false });

    this.artWidth = options.width || 1000;
    this.artHeight = options.height || 1333;
    this.audio = options.audio || null;

    // Viewport transform
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isFlippedH = false;
    this.isSpacePressed = false;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // Sub-systems
    this.layerManager = new LayerManager(this.artWidth, this.artHeight, this.audio);
    this.traceEngine = new TraceEngine(this.artWidth, this.artHeight);
    this.brushEngine = new BrushEngine(this.audio);
    this.colorStudio = new ColorStudio(this.audio);

    // Active tool: "brush", "bucket", "eyedropper", "line", "hand", "eraser"
    this.activeTool = "brush";
    this.sampleAllLayersForFill = true;
    this.bucketTolerance = 35;
    this.bucketExpansion = 1;
    this.bucketGapClosure = true;
    this.onToolChange = null;

    // Composite canvas
    this.compositeCanvas = document.createElement("canvas");
    this.compositeCanvas.width = this.artWidth;
    this.compositeCanvas.height = this.artHeight;
    this.compositeCtx = this.compositeCanvas.getContext("2d", { willReadFrequently: true });

    // History stack for Undo/Redo
    this.historyStack = [];
    this.redoStack = [];
    this.maxHistory = 24;

    // Timelapse Stroke Recorder
    this.timelapseLog = [];
    this.currentStrokeLog = null;
    this.isReplayingTimelapse = false;
    this.timelapseAnimId = null;

    // Callbacks
    this.onEyedropperPreview = null;
    this.onCursorMove = null;
    this.onViewChange = null;

    // Physical Studio Substrate: "cold_press", "linen_canvas", "toned_kraft", "smooth_bristol", "none"
    this.paperTexture = "cold_press";
    this.paperPattern = null;
    this.gridGuide = "none"; // "none", "rule_of_thirds", "academic_3x3"

    this.initEvents();
    this.initPaperTexture();
    this.saveState();
    this.fitToScreen();
    this.requestRender();
  }

  initPaperTexture() {
    if (this.paperTexture === "none") {
      this.paperPattern = null;
      return;
    }
    const patternCanvas = document.createElement("canvas");
    patternCanvas.width = 160;
    patternCanvas.height = 160;
    const pCtx = patternCanvas.getContext("2d");

    if (this.paperTexture === "cold_press") {
      const imgData = pCtx.createImageData(160, 160);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = (Math.random() - 0.5) * 26;
        const v = Math.min(255, Math.max(0, 246 + noise));
        d[i] = v;
        d[i+1] = Math.max(0, v - 3);
        d[i+2] = Math.max(0, v - 9);
        d[i+3] = 48; // tooth
      }
      pCtx.putImageData(imgData, 0, 0);
      pCtx.strokeStyle = "rgba(100, 75, 55, 0.14)";
      pCtx.lineWidth = 0.8;
      for (let j = 0; j < 14; j++) {
        pCtx.beginPath();
        const fx = Math.random() * 160;
        const fy = Math.random() * 160;
        pCtx.moveTo(fx, fy);
        pCtx.lineTo(fx + (Math.random() - 0.5) * 16, fy + (Math.random() - 0.5) * 16);
        pCtx.stroke();
      }
    } else if (this.paperTexture === "linen_canvas") {
      pCtx.fillStyle = "rgba(240, 235, 222, 0.28)";
      pCtx.fillRect(0, 0, 160, 160);
      pCtx.strokeStyle = "rgba(70, 55, 40, 0.1)";
      pCtx.lineWidth = 1;
      for (let x = 0; x < 160; x += 4) {
        pCtx.beginPath(); pCtx.moveTo(x, 0); pCtx.lineTo(x, 160); pCtx.stroke();
      }
      for (let y = 0; y < 160; y += 4) {
        pCtx.beginPath(); pCtx.moveTo(0, y); pCtx.lineTo(160, y); pCtx.stroke();
      }
    } else if (this.paperTexture === "toned_kraft") {
      pCtx.fillStyle = "rgba(195, 168, 134, 0.38)";
      pCtx.fillRect(0, 0, 160, 160);
      pCtx.fillStyle = "rgba(80, 55, 30, 0.08)";
      for (let i = 0; i < 220; i++) {
        pCtx.fillRect(Math.random() * 160, Math.random() * 160, 1.2, 1.2);
      }
    }

    try {
      this.paperPattern = this.viewportCtx.createPattern(patternCanvas, "repeat");
    } catch(e) {
      this.paperPattern = null;
    }
  }

  setPaperTexture(textureType) {
    this.paperTexture = textureType;
    this.initPaperTexture();
    this.requestRender();
  }

  setGridGuide(gridType) {
    this.gridGuide = gridType;
    this.requestRender();
  }

  setDimensions(w, h) {
    this.artWidth = w;
    this.artHeight = h;
    this.compositeCanvas.width = w;
    this.compositeCanvas.height = h;
    this.layerManager.resizeAll(w, h);
    this.traceEngine.resize(w, h);
    this.historyStack = [];
    this.redoStack = [];
    this.timelapseLog = [];
    this.saveState();
    this.fitToScreen();
    this.requestRender();
  }

  saveState() {
    const state = {
      layers: this.layerManager.layers.map(l => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        blendMode: l.blendMode,
        isBackground: l.isBackground,
        data: l.ctx.getImageData(0, 0, this.artWidth, this.artHeight)
      })),
      activeLayerIndex: this.layerManager.activeLayerIndex
    };

    this.historyStack.push(state);
    if (this.historyStack.length > this.maxHistory) {
      this.historyStack.shift();
    }
    this.redoStack = [];
  }

  undo() {
    if (this.isReplayingTimelapse) this.stopTimelapse();
    if (this.historyStack.length <= 1) return false;
    const currentState = this.historyStack.pop();
    this.redoStack.push(currentState);

    const prevState = this.historyStack[this.historyStack.length - 1];
    this.restoreState(prevState);

    if (this.audio) this.audio.playUndo(false);
    this.requestRender();
    return true;
  }

  redo() {
    if (this.isReplayingTimelapse) this.stopTimelapse();
    if (this.redoStack.length === 0) return false;
    const nextState = this.redoStack.pop();
    this.historyStack.push(nextState);
    this.restoreState(nextState);

    if (this.audio) this.audio.playUndo(true);
    this.requestRender();
    return true;
  }

  restoreState(state) {
    for (let i = 0; i < state.layers.length; i++) {
      const saved = state.layers[i];
      let target = this.layerManager.layers[i];
      if (!target) {
        target = this.layerManager.addLayer(saved.name);
      }
      target.name = saved.name;
      target.visible = saved.visible;
      target.locked = saved.locked;
      target.opacity = saved.opacity;
      target.blendMode = saved.blendMode;
      target.isBackground = saved.isBackground;
      target.ctx.putImageData(saved.data, 0, 0);
    }

    while (this.layerManager.layers.length > state.layers.length) {
      this.layerManager.layers.pop();
    }

    this.layerManager.activeLayerIndex = Math.min(state.activeLayerIndex, this.layerManager.layers.length - 1);
    if (this.layerManager.onLayersChange) this.layerManager.onLayersChange();
  }

  fitToScreen() {
    const vpW = this.viewportCanvas.clientWidth || window.innerWidth;
    const vpH = this.viewportCanvas.clientHeight || window.innerHeight;

    const pad = 60;
    const availW = Math.max(200, vpW - pad);
    const availH = Math.max(200, vpH - pad);

    const scaleX = availW / this.artWidth;
    const scaleY = availH / this.artHeight;
    this.zoom = Math.min(scaleX, scaleY, 1.2);

    this.panX = (vpW - this.artWidth * this.zoom) / 2;
    this.panY = (vpH - this.artHeight * this.zoom) / 2;

    if (this.onViewChange) this.onViewChange(this.zoom);
    this.requestRender();
  }

  setZoom(newZoom, centerX = null, centerY = null) {
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.2, Math.min(5.0, newZoom));

    if (centerX === null) {
      centerX = (this.viewportCanvas.clientWidth || window.innerWidth) / 2;
      centerY = (this.viewportCanvas.clientHeight || window.innerHeight) / 2;
    }

    this.panX = centerX - (centerX - this.panX) * (this.zoom / oldZoom);
    this.panY = centerY - (centerY - this.panY) * (this.zoom / oldZoom);

    if (this.onViewChange) this.onViewChange(this.zoom);
    this.requestRender();
  }

  toggleFlipH() {
    this.isFlippedH = !this.isFlippedH;
    this.requestRender();
  }

  viewportToCanvasCoord(clientX, clientY) {
    const rect = this.viewportCanvas.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;

    let x = (vx - this.panX) / this.zoom;
    let y = (vy - this.panY) / this.zoom;

    if (this.isFlippedH) {
      x = this.artWidth - x;
    }

    return { x, y };
  }

  initEvents() {
    const cv = this.viewportCanvas;

    cv.addEventListener("pointerdown", (e) => this.handlePointerDown(e));
    window.addEventListener("pointermove", (e) => this.handlePointerMove(e));
    window.addEventListener("pointerup", (e) => this.handlePointerUp(e));

    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const rect = cv.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      this.setZoom(this.zoom * zoomFactor, mouseX, mouseY);
    }, { passive: false });

    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.code === "Space" && !this.isSpacePressed) {
        this.isSpacePressed = true;
        cv.style.cursor = "grab";
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        this.redo();
      }

      const k = e.key.toLowerCase();
      if (k === "b") this.activeTool = "brush";
      if (k === "e") {
        this.activeTool = "brush";
        this.brushEngine.setBrushType("eraser");
      }
      if (k === "g") this.activeTool = "bucket";
      if (k === "i") this.activeTool = "eyedropper";
      if (k === "t") this.traceEngine.toggleVisible();
      if (k === "f") this.fitToScreen();
      if (k === "h") this.toggleFlipH();
      if (k === "[") this.brushEngine.setSize(this.brushEngine.size - 2);
      if (k === "]") this.brushEngine.setSize(this.brushEngine.size + 2);

      this.requestRender();
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        this.isSpacePressed = false;
        if (!this.isPanning) {
          cv.style.cursor = "crosshair";
        }
      }
    });

    this.traceEngine.onUpdate = () => this.requestRender();
    this.layerManager.onLayersChange = () => this.requestRender();
  }

  handlePointerDown(e) {
    if (this.isReplayingTimelapse) this.stopTimelapse();

    if (e.button === 1 || this.isSpacePressed || this.activeTool === "hand") {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
      this.viewportCanvas.style.cursor = "grabbing";
      return;
    }

    if (e.button !== 0) return;

    const pt = this.viewportToCanvasCoord(e.clientX, e.clientY);
    const activeLayer = this.layerManager.getActiveLayer();

    if (!activeLayer || activeLayer.locked || !activeLayer.visible) {
      return;
    }

    if (this.activeTool === "eyedropper") {
      this.sampleColorAt(pt.x, pt.y);
      return;
    }

    if (this.activeTool === "bucket") {
      this.executeFloodFill(pt.x, pt.y);
      return;
    }

    if (this.activeTool === "line" || e.shiftKey) {
      this.shiftStart = { ...pt };
    }

    if (this.activeTool === "brush" || this.activeTool === "eraser") {
      if (this.activeTool === "eraser") {
        this.brushEngine.setBrushType("eraser");
      }
      this.currentStrokeLog = {
        tool: this.activeTool,
        layerIdx: this.layerManager.activeLayerIndex,
        brushType: this.brushEngine.brushType,
        size: this.brushEngine.size,
        opacity: this.brushEngine.opacity,
        color: this.colorStudio.currentColor,
        points: [{ x: pt.x, y: pt.y }]
      };

      this.brushEngine.startStroke(activeLayer.ctx, pt, this.colorStudio.currentColor, this.artWidth, this.artHeight);
      this.requestRender();
    }
  }

  handlePointerMove(e) {
    if (this.isPanning) {
      this.panX = e.clientX - this.panStart.x;
      this.panY = e.clientY - this.panStart.y;
      this.requestRender();
      return;
    }

    const pt = this.viewportToCanvasCoord(e.clientX, e.clientY);
    this.currentPointerPos = pt;

    if (this.onCursorMove) {
      this.onCursorMove(Math.round(pt.x), Math.round(pt.y));
    }

    if (this.activeTool === "eyedropper" && e.buttons === 1) {
      this.sampleColorAt(pt.x, pt.y);
    }

    if (this.brushEngine.isDrawing && (this.activeTool === "brush" || this.activeTool === "eraser")) {
      const activeLayer = this.layerManager.getActiveLayer();
      if (activeLayer && !activeLayer.locked) {
        if (this.currentStrokeLog) {
          this.currentStrokeLog.points.push({ x: pt.x, y: pt.y });
        }
        this.brushEngine.continueStroke(activeLayer.ctx, pt, this.colorStudio.currentColor, this.artWidth, this.artHeight);
        this.requestRender();
      }
    } else if (this.shiftStart) {
      this.requestRender();
    }
  }

  handlePointerUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.viewportCanvas.style.cursor = this.isSpacePressed ? "grab" : "crosshair";
      return;
    }

    const activeLayer = this.layerManager.getActiveLayer();

    if (this.shiftStart && activeLayer && !activeLayer.locked) {
      const pt = this.viewportToCanvasCoord(e.clientX, e.clientY);
      this.brushEngine.drawStraightLine(activeLayer.ctx, this.shiftStart, pt, this.colorStudio.currentColor);
      
      this.timelapseLog.push({
        tool: "line",
        layerIdx: this.layerManager.activeLayerIndex,
        brushType: this.brushEngine.brushType,
        size: this.brushEngine.size,
        opacity: this.brushEngine.opacity,
        color: this.colorStudio.currentColor,
        start: this.shiftStart,
        end: pt
      });

      this.shiftStart = null;
      this.saveState();
      this.requestRender();
      return;
    }

    if (this.brushEngine.isDrawing) {
      this.brushEngine.endStroke(activeLayer.ctx, this.colorStudio.currentColor);
      if (this.currentStrokeLog) {
        this.timelapseLog.push(this.currentStrokeLog);
        this.currentStrokeLog = null;
      }
      this.saveState();
      this.requestRender();
    }
  }

  setActiveTool(tool) {
    this.activeTool = tool;
    if (tool === "eraser") {
      this.brushEngine.setBrushType("eraser");
    } else if (tool === "brush" && this.brushEngine.brushType === "eraser") {
      this.brushEngine.setBrushType("technical_pen");
    }
    if (this.onToolChange) {
      this.onToolChange(this.activeTool, this.brushEngine.brushType);
    }
    this.requestRender();
  }

  executeFloodFill(x, y) {
    let activeLayer = this.layerManager.getActiveLayer();
    if (!activeLayer || activeLayer.locked || !activeLayer.visible || activeLayer.isBackground) {
      // Find the first unlocked non-background drawing layer
      const validIdx = this.layerManager.layers.findIndex(l => !l.locked && l.visible && !l.isBackground);
      if (validIdx !== -1) {
        this.layerManager.setActiveLayer(validIdx);
        activeLayer = this.layerManager.getActiveLayer();
      } else {
        return;
      }
    }

    this.layerManager.renderComposite(this.compositeCtx, false);
    const sampleCtx = this.sampleAllLayersForFill ? this.compositeCtx : activeLayer.ctx;

    const filled = FloodFill.fill(
      activeLayer.ctx,
      sampleCtx,
      x,
      y,
      this.colorStudio.currentColor,
      this.bucketTolerance,
      this.bucketExpansion,
      this.bucketGapClosure
    );

    if (filled) {
      this.timelapseLog.push({
        tool: "bucket",
        layerIdx: this.layerManager.activeLayerIndex,
        x, y,
        color: this.colorStudio.currentColor,
        tolerance: this.bucketTolerance,
        expansion: this.bucketExpansion
      });

      if (this.audio) this.audio.playBucketFill();
      this.saveState();
      this.requestRender();
    }
  }

  sampleColorAt(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= this.artWidth || y < 0 || y >= this.artHeight) return;

    this.layerManager.renderComposite(this.compositeCtx, true);

    const p = this.compositeCtx.getImageData(x, y, 1, 1).data;
    if (p[3] > 10) {
      const hex = this.colorStudio.rgbToHex(p[0], p[1], p[2]);
      this.colorStudio.setColor(hex, true, true);
    } else if (this.traceEngine.referenceLoaded) {
      const refP = this.traceEngine.rawCtx.getImageData(x, y, 1, 1).data;
      const hex = this.colorStudio.rgbToHex(refP[0], refP[1], refP[2]);
      this.colorStudio.setColor(hex, true, true);
    }
  }

  // --- Timelapse Playback System ---
  playTimelapse(speed = 2, onProgress = null, onComplete = null) {
    if (this.timelapseLog.length === 0) return false;
    this.isReplayingTimelapse = true;

    // Cache current canvas state to restore after playback
    const savedState = this.historyStack[this.historyStack.length - 1];

    // Clear all drawing layers
    for (const layer of this.layerManager.layers) {
      if (!layer.isBackground) {
        layer.clear();
      }
    }
    this.requestRender();

    let strokeIdx = 0;
    let stepCount = Math.max(1, Math.round(speed * 2));

    const step = () => {
      if (!this.isReplayingTimelapse) return;

      for (let s = 0; s < stepCount && strokeIdx < this.timelapseLog.length; s++, strokeIdx++) {
        const item = this.timelapseLog[strokeIdx];
        const layer = this.layerManager.layers[item.layerIdx] || this.layerManager.getActiveLayer();

        if (item.tool === "brush") {
          const origType = this.brushEngine.brushType;
          const origSize = this.brushEngine.size;
          const origOp = this.brushEngine.opacity;

          this.brushEngine.brushType = item.brushType;
          this.brushEngine.size = item.size;
          this.brushEngine.opacity = item.opacity;

          if (item.points.length > 0) {
            this.brushEngine.startStroke(layer.ctx, item.points[0], item.color, this.artWidth, this.artHeight);
            for (let p = 1; p < item.points.length; p++) {
              this.brushEngine.renderStrokeSegment(layer.ctx, item.points[p], item.color, item.points[p - 1]);
            }
            this.brushEngine.endStroke(layer.ctx, item.color);
          }

          this.brushEngine.brushType = origType;
          this.brushEngine.size = origSize;
          this.brushEngine.opacity = origOp;
        } else if (item.tool === "bucket") {
          FloodFill.fill(layer.ctx, null, item.x, item.y, item.color, 28, 1);
        } else if (item.tool === "line") {
          this.brushEngine.drawStraightLine(layer.ctx, item.start, item.end, item.color);
        }
      }

      this.requestRender();

      if (onProgress) {
        onProgress(Math.min(1.0, strokeIdx / this.timelapseLog.length));
      }

      if (strokeIdx < this.timelapseLog.length && this.isReplayingTimelapse) {
        this.timelapseAnimId = requestAnimationFrame(step);
      } else {
        this.isReplayingTimelapse = false;
        if (onComplete) onComplete();
      }
    };

    this.timelapseAnimId = requestAnimationFrame(step);
    return true;
  }

  stopTimelapse() {
    this.isReplayingTimelapse = false;
    if (this.timelapseAnimId) {
      cancelAnimationFrame(this.timelapseAnimId);
      this.timelapseAnimId = null;
    }
    // Restore latest saved history snapshot
    if (this.historyStack.length > 0) {
      this.restoreState(this.historyStack[this.historyStack.length - 1]);
    }
    this.requestRender();
  }

  requestRender() {
    if (this._renderPending) return;
    this._renderPending = true;
    requestAnimationFrame(() => {
      this._renderPending = false;
      this.render();
    });
  }

  render() {
    const vp = this.viewportCanvas;
    const ctx = this.viewportCtx;
    const dpr = window.devicePixelRatio || 1;

    const displayW = vp.clientWidth;
    const displayH = vp.clientHeight;
    if (vp.width !== displayW * dpr || vp.height !== displayH * dpr) {
      vp.width = displayW * dpr;
      vp.height = displayH * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#0c0d12";
    ctx.fillRect(0, 0, displayW, displayH);

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    if (this.isFlippedH) {
      ctx.translate(this.artWidth, 0);
      ctx.scale(-1, 1);
    }

    // Shadow
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.artWidth, this.artHeight);
    ctx.restore();

    // 1. Background Layer
    const bgLayer = this.layerManager.layers.find(l => l.isBackground);
    if (bgLayer && bgLayer.visible) {
      ctx.save();
      ctx.globalAlpha = bgLayer.opacity;
      ctx.drawImage(bgLayer.canvas, 0, 0);
      ctx.restore();
    }

    // 1b. Physical Paper Tooth & Texture Overlay
    if (this.paperPattern) {
      ctx.save();
      ctx.fillStyle = this.paperPattern;
      ctx.globalCompositeOperation = "multiply";
      ctx.fillRect(0, 0, this.artWidth, this.artHeight);
      ctx.restore();
    }

    // 2. Reference Trace Overlay
    if (this.traceEngine.referenceLoaded && this.traceEngine.visible) {
      this.traceEngine.render(ctx);
    }

    // 3. User Layers
    for (const layer of this.layerManager.layers) {
      if (layer.isBackground || !layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;
      ctx.drawImage(layer.canvas, 0, 0);
      ctx.restore();
    }

    // 4. Straight line preview
    if (this.shiftStart && this.currentPointerPos) {
      ctx.save();
      ctx.strokeStyle = this.colorStudio.currentColor;
      ctx.lineWidth = this.brushEngine.size;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(this.shiftStart.x, this.shiftStart.y);
      ctx.lineTo(this.currentPointerPos.x, this.currentPointerPos.y);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Symmetry Guides (if active)
    if (this.brushEngine.symmetryMode !== "none") {
      ctx.save();
      ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);

      const cx = this.artWidth / 2;
      const cy = this.artHeight / 2;

      if (this.brushEngine.symmetryMode === "vertical" || this.brushEngine.symmetryMode === "radial4") {
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, this.artHeight);
        ctx.stroke();
      }
      if (this.brushEngine.symmetryMode === "horizontal" || this.brushEngine.symmetryMode === "radial4") {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(this.artWidth, cy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5b. Academic Proportional Grid Guides
    if (this.gridGuide && this.gridGuide !== "none") {
      ctx.save();
      ctx.strokeStyle = "rgba(180, 130, 80, 0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      if (this.gridGuide === "rule_of_thirds" || this.gridGuide === "academic_3x3") {
        for (let i = 1; i <= 2; i++) {
          const gx = (this.artWidth / 3) * i;
          const gy = (this.artHeight / 3) * i;
          ctx.beginPath();
          ctx.moveTo(gx, 0); ctx.lineTo(gx, this.artHeight);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, gy); ctx.lineTo(this.artWidth, gy);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Canvas boundary
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, this.artWidth, this.artHeight);

    ctx.restore();
    ctx.restore();
  }

  exportImage(format = "png", quality = 0.95, includeReference = false) {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = this.artWidth;
    exportCanvas.height = this.artHeight;
    const eCtx = exportCanvas.getContext("2d");

    const bgLayer = this.layerManager.layers.find(l => l.isBackground);
    if (bgLayer && bgLayer.visible) {
      eCtx.drawImage(bgLayer.canvas, 0, 0);
    }

    if (includeReference && this.traceEngine.referenceLoaded) {
      this.traceEngine.render(eCtx);
    }

    for (const layer of this.layerManager.layers) {
      if (layer.isBackground || !layer.visible) continue;
      eCtx.save();
      eCtx.globalAlpha = layer.opacity;
      eCtx.globalCompositeOperation = layer.blendMode;
      eCtx.drawImage(layer.canvas, 0, 0);
      eCtx.restore();
    }

    if (this.audio) this.audio.playExport();

    const mime = format === "jpeg" ? "image/jpeg" : "image/png";
    return exportCanvas.toDataURL(mime, quality);
  }

  /**
   * Generates a sleek Side-by-Side Comparison graphic for social media
   */
  exportSideBySideCard() {
    const cardW = 1600;
    const cardH = 1100;
    const pad = 40;
    const panelW = (cardW - pad * 3) / 2;
    const panelH = cardH - 140;

    const canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    const ctx = canvas.getContext("2d");

    // Luxury dark backdrop
    ctx.fillStyle = "#090a0f";
    ctx.fillRect(0, 0, cardW, cardH);

    // Left Panel: Reference Artwork
    ctx.save();
    ctx.fillStyle = "#12141c";
    ctx.fillRect(pad, 80, panelW, panelH);
    if (this.traceEngine.referenceLoaded) {
      ctx.drawImage(this.traceEngine.rawCanvas, pad, 80, panelW, panelH);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.strokeRect(pad, 80, panelW, panelH);
    ctx.restore();

    // Right Panel: User Hand-Drawn Artwork
    ctx.save();
    ctx.fillStyle = "#12141c";
    ctx.fillRect(pad * 2 + panelW, 80, panelW, panelH);
    this.layerManager.renderComposite(this.compositeCtx, true);
    ctx.drawImage(this.compositeCanvas, pad * 2 + panelW, 80, panelW, panelH);
    ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(pad * 2 + panelW, 80, panelW, panelH);
    ctx.restore();

    // Header labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 20px Outfit, sans-serif";
    ctx.fillText("ORIGINAL MASTERPIECE", pad + 10, 55);

    ctx.fillStyle = "#00f0ff";
    ctx.fillText("✦ MY TRACE & COLOR CREATION", pad * 2 + panelW + 10, 55);

    // Footer branding
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Space Grotesk, sans-serif";
    ctx.fillText("ITIA STUDIO // I THINK IT'S ART", pad, cardH - 24);

    ctx.fillStyle = "#64748b";
    ctx.font = "16px JetBrains Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("Created with ITIA Digital Art Suite", cardW - pad, cardH - 24);

    return canvas.toDataURL("image/png");
  }

  /**
   * Export full ITIA Project document (.itia JSON)
   */
  exportProjectJSON(meta = {}) {
    const projectData = {
      format: "ITIA_PROJECT",
      version: "2.0",
      createdAt: new Date().toISOString(),
      width: this.artWidth,
      height: this.artHeight,
      paperTexture: this.paperTexture,
      meta: {
        title: meta.title || "Untitled Masterpiece",
        genre: meta.genre || "Digital Art",
        ...meta
      },
      layers: this.layerManager.layers.map(l => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        blendMode: l.blendMode,
        isBackground: l.isBackground,
        dataUrl: l.canvas.toDataURL("image/png")
      })),
      activeLayerIndex: this.layerManager.activeLayerIndex,
      timelapseLog: this.timelapseLog.slice(0, 500)
    };

    return JSON.stringify(projectData);
  }

  /**
   * Restore full ITIA Project document from parsed JSON
   */
  async importProjectJSON(projectData) {
    if (!projectData || projectData.format !== "ITIA_PROJECT") {
      throw new Error("Invalid ITIA project file format.");
    }

    if (projectData.width && projectData.height) {
      this.resizeCanvas(projectData.width, projectData.height);
    }

    if (projectData.paperTexture) {
      this.setPaperTexture(projectData.paperTexture);
    }

    if (Array.isArray(projectData.layers)) {
      this.layerManager.layers = [];
      for (const saved of projectData.layers) {
        const layer = this.layerManager.addLayer(saved.name);
        layer.visible = saved.visible;
        layer.locked = saved.locked;
        layer.opacity = saved.opacity;
        layer.blendMode = saved.blendMode || "source-over";
        layer.isBackground = saved.isBackground || false;

        if (saved.dataUrl) {
          await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              layer.clear();
              layer.ctx.drawImage(img, 0, 0);
              resolve();
            };
            img.onerror = resolve;
            img.src = saved.dataUrl;
          });
        }
      }

      this.layerManager.activeLayerIndex = Math.min(
        projectData.activeLayerIndex || 0,
        this.layerManager.layers.length - 1
      );
    }

    if (Array.isArray(projectData.timelapseLog)) {
      this.timelapseLog = projectData.timelapseLog;
    }

    if (this.layerManager.onLayersChange) {
      this.layerManager.onLayersChange();
    }

    this.saveState();
    this.fitToScreen();
    this.requestRender();
    return true;
  }
}

