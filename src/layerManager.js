/**
 * ITIA STUDIO // LAYER MANAGER
 * Pro-grade multi-layer architecture with blend modes, opacity, 
 * visibility toggling, layer ordering, and composition.
 */

export class Layer {
  constructor(id, name, width, height, options = {}) {
    this.id = id;
    this.name = name;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    
    this.visible = options.visible !== undefined ? options.visible : true;
    this.locked = options.locked || false;
    this.opacity = options.opacity !== undefined ? options.opacity : 1.0;
    this.blendMode = options.blendMode || "source-over"; // normal, multiply, screen, overlay
    this.isBackground = options.isBackground || false;

    if (options.initialFill) {
      this.ctx.fillStyle = options.initialFill;
      this.ctx.fillRect(0, 0, width, height);
    }
  }

  resize(width, height) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    tempCanvas.getContext("2d").drawImage(this.canvas, 0, 0);

    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.ctx.drawImage(tempCanvas, 0, 0, width, height);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  clone(newId, newName) {
    const l = new Layer(newId, newName, this.canvas.width, this.canvas.height, {
      visible: this.visible,
      locked: this.locked,
      opacity: this.opacity,
      blendMode: this.blendMode,
      isBackground: this.isBackground
    });
    l.ctx.drawImage(this.canvas, 0, 0);
    return l;
  }
}

export class LayerManager {
  constructor(width, height, audioEngine) {
    this.width = width;
    this.height = height;
    this.audio = audioEngine;
    this.layers = [];
    this.activeLayerIndex = 2; // Default to Lineart layer
    this.nextLayerId = 1;
    this.onLayersChange = null;

    this.initDefaultLayers();
  }

  initDefaultLayers() {
    this.layers = [];
    // 0: Background
    const bg = new Layer(this.nextLayerId++, "Background", this.width, this.height, {
      isBackground: true,
      initialFill: "#ffffff"
    });
    // 1: Base Colors
    const col = new Layer(this.nextLayerId++, "Colors & Fill", this.width, this.height, {
      blendMode: "source-over"
    });
    // 2: Lineart & Inking
    const line = new Layer(this.nextLayerId++, "Lineart & Inking", this.width, this.height, {
      blendMode: "source-over"
    });
    // 3: Highlights & Glow
    const glow = new Layer(this.nextLayerId++, "Highlights & Glow", this.width, this.height, {
      blendMode: "source-over"
    });

    this.layers = [bg, col, line, glow];
    this.activeLayerIndex = 2; // Lineart by default
  }

  resizeAll(width, height) {
    this.width = width;
    this.height = height;
    this.layers.forEach(layer => layer.resize(width, height));
  }

  getActiveLayer() {
    return this.layers[this.activeLayerIndex] || this.layers[0];
  }

  getActiveContext() {
    const l = this.getActiveLayer();
    return l ? l.ctx : null;
  }

  setActiveLayer(index) {
    if (index >= 0 && index < this.layers.length) {
      this.activeLayerIndex = index;
      if (this.audio) this.audio.playLayer();
      if (this.onLayersChange) this.onLayersChange();
    }
  }

  addLayer(name = null) {
    const id = this.nextLayerId++;
    const layerName = name || `Layer ${this.layers.length}`;
    const newLayer = new Layer(id, layerName, this.width, this.height);
    
    // Insert above active layer
    const insertIdx = Math.min(this.layers.length, this.activeLayerIndex + 1);
    this.layers.splice(insertIdx, 0, newLayer);
    this.activeLayerIndex = insertIdx;

    if (this.audio) this.audio.playLayer();
    if (this.onLayersChange) this.onLayersChange();
    return newLayer;
  }

  duplicateActiveLayer() {
    const active = this.getActiveLayer();
    if (!active) return;
    const dup = active.clone(this.nextLayerId++, `${active.name} (Copy)`);
    dup.isBackground = false;
    this.layers.splice(this.activeLayerIndex + 1, 0, dup);
    this.activeLayerIndex++;

    if (this.audio) this.audio.playLayer();
    if (this.onLayersChange) this.onLayersChange();
  }

  deleteActiveLayer() {
    if (this.layers.length <= 1) return; // Keep at least one layer
    const active = this.getActiveLayer();
    if (active.isBackground && this.layers.length === 1) return;

    this.layers.splice(this.activeLayerIndex, 1);
    if (this.activeLayerIndex >= this.layers.length) {
      this.activeLayerIndex = this.layers.length - 1;
    }

    if (this.audio) this.audio.playClick();
    if (this.onLayersChange) this.onLayersChange();
  }

  moveActiveLayer(delta) {
    const newIdx = this.activeLayerIndex + delta;
    if (newIdx < 0 || newIdx >= this.layers.length) return;
    
    const [moved] = this.layers.splice(this.activeLayerIndex, 1);
    this.layers.splice(newIdx, 0, moved);
    this.activeLayerIndex = newIdx;

    if (this.audio) this.audio.playLayer();
    if (this.onLayersChange) this.onLayersChange();
  }

  mergeDown() {
    if (this.activeLayerIndex <= 0) return;
    const upper = this.layers[this.activeLayerIndex];
    const lower = this.layers[this.activeLayerIndex - 1];

    lower.ctx.save();
    lower.ctx.globalAlpha = upper.opacity;
    lower.ctx.globalCompositeOperation = upper.blendMode;
    lower.ctx.drawImage(upper.canvas, 0, 0);
    lower.ctx.restore();

    this.layers.splice(this.activeLayerIndex, 1);
    this.activeLayerIndex--;

    if (this.audio) this.audio.playLayer();
    if (this.onLayersChange) this.onLayersChange();
  }

  clearActiveLayer() {
    const active = this.getActiveLayer();
    if (!active || active.locked) return;
    active.clear();
    if (active.isBackground) {
      active.ctx.fillStyle = "#ffffff";
      active.ctx.fillRect(0, 0, this.width, this.height);
    }
    if (this.onLayersChange) this.onLayersChange();
  }

  toggleVisibility(index) {
    if (this.layers[index]) {
      this.layers[index].visible = !this.layers[index].visible;
      if (this.onLayersChange) this.onLayersChange();
    }
  }

  toggleLock(index) {
    if (this.layers[index]) {
      this.layers[index].locked = !this.layers[index].locked;
      if (this.onLayersChange) this.onLayersChange();
    }
  }

  setLayerOpacity(index, opacity) {
    if (this.layers[index]) {
      this.layers[index].opacity = Math.max(0, Math.min(1, opacity));
      if (this.onLayersChange) this.onLayersChange();
    }
  }

  setLayerBlendMode(index, mode) {
    if (this.layers[index]) {
      this.layers[index].blendMode = mode;
      if (this.onLayersChange) this.onLayersChange();
    }
  }

  setBackgroundColor(colorHex) {
    const bg = this.layers.find(l => l.isBackground);
    if (bg) {
      bg.clear();
      if (colorHex !== "transparent") {
        bg.ctx.fillStyle = colorHex;
        bg.ctx.fillRect(0, 0, this.width, this.height);
      }
      if (this.onLayersChange) this.onLayersChange();
    }
  }

  /**
   * Composite all visible layers onto targetCtx
   */
  renderComposite(targetCtx, includeBackground = true) {
    targetCtx.clearRect(0, 0, this.width, this.height);

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!layer.visible) continue;
      if (!includeBackground && layer.isBackground) continue;

      targetCtx.save();
      targetCtx.globalAlpha = layer.opacity;
      targetCtx.globalCompositeOperation = layer.blendMode;
      targetCtx.drawImage(layer.canvas, 0, 0);
      targetCtx.restore();
    }
  }
}
