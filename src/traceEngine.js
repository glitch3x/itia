/**
 * ITIA STUDIO // TRACE ENGINE
 * Light-Table Tracing System: Reference opacity, Real-time Edge-Detection Lineart,
 * Cyanotype Manga Blueprint, Curtain Wipe comparison, and Outline Baking.
 */

export class TraceEngine {
  constructor(canvasWidth, canvasHeight) {
    this.width = canvasWidth;
    this.height = canvasHeight;

    this.referenceImg = null;
    this.referenceLoaded = false;
    this.opacity = 0.5;
    this.visible = true;
    this.mode = "normal"; // normal, lineart, blueprint, high_contrast, inverted
    this.splitWipe = null; // null = off, or 0.0 - 1.0 position

    // Offscreen canvas for processed reference effects
    this.processedCanvas = document.createElement("canvas");
    this.processedCanvas.width = canvasWidth;
    this.processedCanvas.height = canvasHeight;
    this.processedCtx = this.processedCanvas.getContext("2d", { willReadFrequently: true });

    // Raw cached canvas of current image
    this.rawCanvas = document.createElement("canvas");
    this.rawCanvas.width = canvasWidth;
    this.rawCanvas.height = canvasHeight;
    this.rawCtx = this.rawCanvas.getContext("2d", { willReadFrequently: true });

    this.onUpdate = null;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.processedCanvas.width = w;
    this.processedCanvas.height = h;
    this.rawCanvas.width = w;
    this.rawCanvas.height = h;
    if (this.referenceImg) {
      this.cacheRawImage();
      this.reprocess();
    }
  }

  loadReference(imgOrUrl, callback = null) {
    if (typeof imgOrUrl === "string") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        this.referenceImg = img;
        this.referenceLoaded = true;
        this.cacheRawImage();
        this.reprocess();
        if (callback) callback(img);
        if (this.onUpdate) this.onUpdate();
      };
      img.src = imgOrUrl;
    } else if (imgOrUrl instanceof HTMLImageElement) {
      this.referenceImg = imgOrUrl;
      this.referenceLoaded = true;
      this.cacheRawImage();
      this.reprocess();
      if (callback) callback(imgOrUrl);
      if (this.onUpdate) this.onUpdate();
    }
  }

  cacheRawImage() {
    if (!this.referenceImg) return;
    this.rawCtx.clearRect(0, 0, this.width, this.height);

    // Contain / Fit image aspect ratio within canvas
    const imgRatio = this.referenceImg.width / this.referenceImg.height;
    const canvasRatio = this.width / this.height;

    let dw = this.width;
    let dh = this.height;
    let dx = 0;
    let dy = 0;

    if (imgRatio > canvasRatio) {
      dh = this.width / imgRatio;
      dy = (this.height - dh) / 2;
    } else {
      dw = this.height * imgRatio;
      dx = (this.width - dw) / 2;
    }

    this.drawBounds = { x: dx, y: dy, w: dw, h: dh };
    this.rawCtx.drawImage(this.referenceImg, dx, dy, dw, dh);
  }

  clearReference() {
    this.referenceImg = null;
    this.referenceLoaded = false;
    this.processedCtx.clearRect(0, 0, this.width, this.height);
    this.rawCtx.clearRect(0, 0, this.width, this.height);
    if (this.onUpdate) this.onUpdate();
  }

  setOpacity(val) {
    this.opacity = Math.max(0, Math.min(1, val));
    if (this.onUpdate) this.onUpdate();
  }

  toggleVisible() {
    this.visible = !this.visible;
    if (this.onUpdate) this.onUpdate();
    return this.visible;
  }

  setMode(mode) {
    this.mode = mode;
    this.reprocess();
    if (this.onUpdate) this.onUpdate();
  }

  setWipe(ratio) {
    this.splitWipe = ratio !== null ? Math.max(0, Math.min(1, ratio)) : null;
    if (this.onUpdate) this.onUpdate();
  }

  /**
   * Reprocess reference image according to active trace mode
   */
  reprocess() {
    if (!this.referenceLoaded) return;
    const ctx = this.processedCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.mode === "normal") {
      ctx.drawImage(this.rawCanvas, 0, 0);
      return;
    }

    const imgData = this.rawCtx.getImageData(0, 0, this.width, this.height);
    const data = imgData.data;
    const outData = ctx.createImageData(this.width, this.height);
    const out = outData.data;
    const w = this.width;
    const h = this.height;

    if (this.mode === "blueprint") {
      // Manga cyanotype / blue pencil sketch
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue;
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const inv = 255 - gray;

        // Soft cyan pencil line
        out[i] = Math.round(20 + inv * 0.1);      // Red low
        out[i + 1] = Math.round(150 + inv * 0.3); // Green mid
        out[i + 2] = 255;                         // Blue high
        out[i + 3] = Math.round(inv * (a / 255) * 0.85);
      }
      ctx.putImageData(outData, 0, 0);
    } 
    else if (this.mode === "high_contrast") {
      // High contrast grayscale
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue;
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const val = gray < 120 ? 10 : 245;
        out[i] = val;
        out[i + 1] = val;
        out[i + 2] = val;
        out[i + 3] = a;
      }
      ctx.putImageData(outData, 0, 0);
    } 
    else if (this.mode === "inverted") {
      for (let i = 0; i < data.length; i += 4) {
        out[i] = 255 - data[i];
        out[i + 1] = 255 - data[i + 1];
        out[i + 2] = 255 - data[i + 2];
        out[i + 3] = data[i + 3];
      }
      ctx.putImageData(outData, 0, 0);
    }
    else if (this.mode === "lineart") {
      // Sobel Edge Detection filter for clean coloring book lineart
      // Convert to grayscale first in temp buffer
      const gray = new Float32Array(w * h);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          // Sobel Gx
          const gx = 
            -1 * gray[idx - w - 1] + 1 * gray[idx - w + 1] +
            -2 * gray[idx - 1]     + 2 * gray[idx + 1] +
            -1 * gray[idx + w - 1] + 1 * gray[idx + w + 1];

          // Sobel Gy
          const gy = 
            -1 * gray[idx - w - 1] - 2 * gray[idx - w] - 1 * gray[idx - w + 1] +
             1 * gray[idx + w - 1] + 2 * gray[idx + w] + 1 * gray[idx + w + 1];

          const edge = Math.hypot(gx, gy);
          const pIdx = idx * 4;

          // Strong crisp edge threshold
          if (edge > 42) {
            const edgeStrength = Math.min(255, (edge - 35) * 3);
            out[pIdx] = 18;       // Dark line
            out[pIdx + 1] = 20;
            out[pIdx + 2] = 25;
            out[pIdx + 3] = edgeStrength;
          }
        }
      }
      ctx.putImageData(outData, 0, 0);
    }
  }

  /**
   * Bakes the extracted lineart directly into the provided layer context!
   * Creates an instant coloring sheet on the user's lineart layer.
   */
  bakeLineartToLayer(targetLayerCtx) {
    if (!this.referenceLoaded) return false;

    // Force lineart extraction
    const currentMode = this.mode;
    this.mode = "lineart";
    this.reprocess();

    targetLayerCtx.save();
    targetLayerCtx.globalAlpha = 1.0;
    targetLayerCtx.globalCompositeOperation = "source-over";
    targetLayerCtx.drawImage(this.processedCanvas, 0, 0);
    targetLayerCtx.restore();

    this.mode = currentMode;
    this.reprocess();
    return true;
  }

  /**
   * Render reference overlay onto target context
   */
  render(targetCtx) {
    if (!this.referenceLoaded || !this.visible || this.opacity <= 0) return;

    targetCtx.save();
    targetCtx.globalAlpha = this.opacity;

    if (this.splitWipe !== null) {
      // Split view curtain: clip to left side
      const wipeX = this.width * this.splitWipe;
      targetCtx.beginPath();
      targetCtx.rect(0, 0, wipeX, this.height);
      targetCtx.clip();
    }

    targetCtx.drawImage(this.processedCanvas, 0, 0);
    targetCtx.restore();

    // Draw wipe divider line if active
    if (this.splitWipe !== null) {
      const wipeX = this.width * this.splitWipe;
      targetCtx.save();
      targetCtx.strokeStyle = "#00f0ff";
      targetCtx.lineWidth = 2;
      targetCtx.setLineDash([6, 6]);
      targetCtx.beginPath();
      targetCtx.moveTo(wipeX, 0);
      targetCtx.lineTo(wipeX, this.height);
      targetCtx.stroke();
      targetCtx.restore();
    }
  }
}
