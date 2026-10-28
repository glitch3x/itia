/**
 * ITIA STUDIO // REAL ART STUDIO BRUSH ENGINE
 * Authentic Natural Media Simulation:
 * - Technical Inking Pen (Crowquill / G-Pen)
 * - 2B / 4B Graphite Sketch Pencil (Organic paper tooth texture)
 * - Vine & Willow Charcoal (Velvety, powdery matte finish)
 * - Master Oil & Gouache Brush (Opaque body with bristle texture)
 * - Botanical Watercolor Wash (Translucent pigment flow & wet edges)
 * - Alcohol Chisel Marker (Layered tonal shading)
 * - Fine Mist Airbrush (Chiaroscuro gradients)
 * - Blending Stump / Tortillon (Pigment softening & smudging)
 * - Studio Kneaded Eraser
 */

export class BrushEngine {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.brushType = "charcoal"; // Default to Charcoal or Technical Pen
    this.size = 8;
    this.opacity = 0.9;
    this.stabilizer = 0.55;
    this.symmetryMode = "none"; // "none", "vertical", "horizontal", "radial4"
    
    // Stroke tracking
    this.points = [];
    this.smoothedPoint = null;
    this.lastDrawnPoint = null;
    this.isDrawing = false;

    // Pencil Grade & Shading mode
    this.pencilGrade = "2B"; // "2H", "HB", "2B", "4B", "6B"
    this.pencilMode = "tip"; // "tip" (sharp contour) or "shade" (flat lead tilt)
  }

  setBrushType(type) {
    this.brushType = type;
  }

  setPencilGrade(grade) {
    if (["2H", "HB", "2B", "4B", "6B"].includes(grade)) {
      this.pencilGrade = grade;
    }
  }

  setPencilMode(mode) {
    if (["tip", "shade"].includes(mode)) {
      this.pencilMode = mode;
    }
  }

  setSize(size) {
    this.size = Math.max(1, Math.min(180, size));
  }

  setOpacity(opacity) {
    this.opacity = Math.max(0.01, Math.min(1.0, opacity));
  }

  setStabilizer(level) {
    this.stabilizer = Math.max(0, Math.min(0.9, level));
  }

  setSymmetryMode(mode) {
    this.symmetryMode = mode;
  }

  getSymmetryPoints(pt, canvasW, canvasH) {
    const pts = [pt];
    const cx = canvasW / 2;
    const cy = canvasH / 2;

    if (this.symmetryMode === "vertical") {
      pts.push({ x: cx * 2 - pt.x, y: pt.y });
    } else if (this.symmetryMode === "horizontal") {
      pts.push({ x: pt.x, y: cy * 2 - pt.y });
    } else if (this.symmetryMode === "radial4") {
      pts.push({ x: cx * 2 - pt.x, y: pt.y });
      pts.push({ x: pt.x, y: cy * 2 - pt.y });
      pts.push({ x: cx * 2 - pt.x, y: cy * 2 - pt.y });
    }

    return pts;
  }

  startStroke(ctx, pt, color, canvasW = 1000, canvasH = 1333) {
    this.isDrawing = true;
    this.points = [pt];
    this.smoothedPoint = { ...pt };
    this.lastDrawnPoint = { ...pt };

    if (this.audio) {
      this.audio.playStrokeStart();
    }

    const symPts = this.getSymmetryPoints(pt, canvasW, canvasH);
    for (const p of symPts) {
      this.renderSingleDab(ctx, p, color);
    }
  }

  continueStroke(ctx, rawPt, color, canvasW = 1000, canvasH = 1333) {
    if (!this.isDrawing) return;

    // Apply exponential smoothing / stabilizer
    if (this.stabilizer > 0 && this.smoothedPoint) {
      const alpha = 1 - this.stabilizer;
      this.smoothedPoint.x += (rawPt.x - this.smoothedPoint.x) * alpha;
      this.smoothedPoint.y += (rawPt.y - this.smoothedPoint.y) * alpha;
    } else {
      this.smoothedPoint = { ...rawPt };
    }

    const currentPt = { ...this.smoothedPoint };
    this.points.push(currentPt);

    const prevPt = this.lastDrawnPoint;
    const dist = Math.hypot(currentPt.x - prevPt.x, currentPt.y - prevPt.y);

    const step = Math.max(1, this.size * 0.18);

    if (dist >= step) {
      const steps = Math.ceil(dist / step);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const interpX = prevPt.x + (currentPt.x - prevPt.x) * t;
        const interpY = prevPt.y + (currentPt.y - prevPt.y) * t;
        const curInterp = { x: interpX, y: interpY };

        const curSym = this.getSymmetryPoints(curInterp, canvasW, canvasH);
        const prevSym = this.getSymmetryPoints(prevPt, canvasW, canvasH);

        for (let s = 0; s < curSym.length; s++) {
          this.renderStrokeSegment(ctx, curSym[s], color, prevSym[s] || curSym[s]);
        }
      }
      this.lastDrawnPoint = currentPt;
    }
  }

  endStroke(ctx, color) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.points = [];
    this.smoothedPoint = null;
    this.lastDrawnPoint = null;
  }

  renderSingleDab(ctx, pt, color) {
    ctx.save();

    if (this.brushType === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = this.opacity;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    switch (this.brushType) {
      case "charcoal":
        this.renderCharcoalDab(ctx, pt.x, pt.y, this.size, color);
        break;

      case "pencil":
        this.renderPencilDab(ctx, pt.x, pt.y, this.size, color);
        break;

      case "oil_brush":
        this.renderOilDab(ctx, pt.x, pt.y, this.size, color);
        break;

      case "watercolor":
        this.renderWatercolorDab(ctx, pt.x, pt.y, this.size, color);
        break;

      case "airbrush":
        this.renderAirbrushDab(ctx, pt.x, pt.y, this.size, color);
        break;

      case "marker":
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = this.opacity * 0.4;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "smudge":
        this.renderSmudgeDab(ctx, pt.x, pt.y, this.size);
        break;

      case "technical_pen":
      default:
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  }

  renderStrokeSegment(ctx, pt, color, prevPt) {
    ctx.save();

    if (this.brushType === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = this.opacity * 0.95;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = this.size;
      ctx.beginPath();
      ctx.moveTo(prevPt.x, prevPt.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (this.brushType) {
      case "charcoal":
        this.renderCharcoalSegment(ctx, pt, prevPt, color);
        break;

      case "pencil":
        this.renderPencilSegment(ctx, pt, prevPt, color);
        break;

      case "oil_brush":
        this.renderOilSegment(ctx, pt, prevPt, color);
        break;

      case "watercolor":
        this.renderWatercolorSegment(ctx, pt, prevPt, color);
        break;

      case "airbrush":
        this.renderAirbrushDab(ctx, pt.x, pt.y, this.size, color);
        break;

      case "marker":
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = this.opacity * 0.35;
        ctx.lineWidth = this.size;
        ctx.lineCap = "square";
        ctx.beginPath();
        ctx.moveTo(prevPt.x, prevPt.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        break;

      case "smudge":
        this.renderSmudgeSegment(ctx, pt, prevPt);
        break;

      case "technical_pen":
      default:
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = this.opacity;
        ctx.lineWidth = this.size;
        ctx.beginPath();
        ctx.moveTo(prevPt.x, prevPt.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        break;
    }

    ctx.restore();
  }

  // --- NATURAL MEDIA ENGINES ---

  // 1. Vine & Willow Charcoal
  renderCharcoalDab(ctx, x, y, size, color) {
    ctx.globalCompositeOperation = "source-over";
    const rad = size / 2;
    const grains = Math.max(8, Math.round(size * 1.6));
    for (let i = 0; i < grains; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.6) * rad;
      const gx = x + Math.cos(angle) * r;
      const gy = y + Math.sin(angle) * r;
      const gAlpha = this.opacity * (0.35 + Math.random() * 0.55);
      const dotSize = 0.8 + Math.random() * (size * 0.18);
      
      ctx.fillStyle = this.hexToRgba(color, gAlpha);
      ctx.beginPath();
      ctx.arc(gx, gy, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderCharcoalSegment(ctx, pt, prevPt, color) {
    ctx.globalCompositeOperation = "source-over";
    // Soft core
    ctx.lineWidth = this.size * 0.75;
    ctx.strokeStyle = this.hexToRgba(color, this.opacity * 0.65);
    ctx.beginPath();
    ctx.moveTo(prevPt.x, prevPt.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    // Grainy dry edge dispersion
    const rad = this.size / 2;
    const grains = Math.max(4, Math.round(this.size * 0.9));
    for (let i = 0; i < grains; i++) {
      const offset = (Math.random() - 0.5) * rad * 1.8;
      const gAlpha = this.opacity * (0.2 + Math.random() * 0.4);
      ctx.fillStyle = this.hexToRgba(color, gAlpha);
      const gx = pt.x + offset + (Math.random() - 0.5) * 2;
      const gy = pt.y + offset + (Math.random() - 0.5) * 2;
      ctx.fillRect(gx, gy, 1.2, 1.2);
    }
  }

  // 2. Graphite Sketch Pencil (2H, HB, 2B, 4B, 6B) with Shading & Tilt
  getPencilGradeConfig() {
    const grades = {
      "2H": { opacityFactor: 0.38, widthFactor: 0.75, grainDensity: 0.35, coreAlpha: 0.35, paperTooth: 0.25, jitter: 0.5 },
      "HB": { opacityFactor: 0.58, widthFactor: 0.90, grainDensity: 0.50, coreAlpha: 0.55, paperTooth: 0.45, jitter: 0.8 },
      "2B": { opacityFactor: 0.74, widthFactor: 1.00, grainDensity: 0.75, coreAlpha: 0.70, paperTooth: 0.65, jitter: 1.1 },
      "4B": { opacityFactor: 0.88, widthFactor: 1.18, grainDensity: 1.05, coreAlpha: 0.84, paperTooth: 0.85, jitter: 1.5 },
      "6B": { opacityFactor: 0.98, widthFactor: 1.35, grainDensity: 1.35, coreAlpha: 0.95, paperTooth: 1.00, jitter: 1.8 }
    };
    return grades[this.pencilGrade] || grades["2B"];
  }

  renderPencilDab(ctx, x, y, size, color) {
    ctx.globalCompositeOperation = "source-over";
    const cfg = this.getPencilGradeConfig();
    const isShade = this.pencilMode === "shade";

    if (isShade) {
      // Broad tilted graphite dab
      const shadeRadius = Math.max(2, size * cfg.widthFactor * 1.25);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, shadeRadius);
      grad.addColorStop(0, this.hexToRgba(color, this.opacity * cfg.opacityFactor * 0.45));
      grad.addColorStop(0.7, this.hexToRgba(color, this.opacity * cfg.opacityFactor * 0.25));
      grad.addColorStop(1, this.hexToRgba(color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, shadeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Paper tooth micro stippling across shading zone
      const grains = Math.max(3, Math.round(shadeRadius * 0.4 * cfg.grainDensity));
      for (let i = 0; i < grains; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * shadeRadius * 0.95;
        const gx = x + Math.cos(angle) * dist;
        const gy = y + Math.sin(angle) * dist;
        const toothAlpha = this.opacity * (0.2 + Math.random() * 0.35) * cfg.opacityFactor;
        ctx.fillStyle = this.hexToRgba(color, toothAlpha);
        ctx.fillRect(gx, gy, 1.1, 1.1);
      }
    } else {
      // Precision point dab
      const pointRad = Math.max(1, (size * cfg.widthFactor) / 2);
      ctx.fillStyle = this.hexToRgba(color, this.opacity * cfg.coreAlpha);
      ctx.beginPath();
      ctx.arc(x + (Math.random() - 0.5) * cfg.jitter, y + (Math.random() - 0.5) * cfg.jitter, pointRad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderPencilSegment(ctx, pt, prevPt, color) {
    ctx.globalCompositeOperation = "source-over";
    const cfg = this.getPencilGradeConfig();
    const isShade = this.pencilMode === "shade";

    if (isShade) {
      // Tilted Flat Shading: Wide, soft-edged graphite wash with natural paper tooth
      const shadeWidth = Math.max(3, this.size * cfg.widthFactor * 2.3);
      const angle = Math.atan2(pt.y - prevPt.y, pt.x - prevPt.x) + Math.PI / 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Multi-strip feathering for smooth gradient transition
      const passes = 3;
      for (let p = -passes; p <= passes; p++) {
        const factor = p / passes; // -1 to 1
        const offset = factor * (shadeWidth * 0.45);
        const stripAlpha = this.opacity * cfg.opacityFactor * 0.18 * (1 - Math.abs(factor) * 0.5);

        ctx.lineWidth = Math.max(1.5, shadeWidth * 0.3);
        ctx.lineCap = "round";
        ctx.strokeStyle = this.hexToRgba(color, stripAlpha);
        ctx.beginPath();
        ctx.moveTo(prevPt.x + cosA * offset, prevPt.y + sinA * offset);
        ctx.lineTo(pt.x + cosA * offset, pt.y + sinA * offset);
        ctx.stroke();
      }

      // Organic paper tooth grain scattering
      const grainCount = Math.max(2, Math.round(shadeWidth * 0.25 * cfg.grainDensity));
      for (let g = 0; g < grainCount; g++) {
        const rOffset = (Math.random() - 0.5) * shadeWidth * 0.85;
        const gx = pt.x + cosA * rOffset + (Math.random() - 0.5) * 2;
        const gy = pt.y + sinA * rOffset + (Math.random() - 0.5) * 2;
        const gAlpha = this.opacity * cfg.opacityFactor * (0.2 + Math.random() * 0.35);
        ctx.fillStyle = this.hexToRgba(color, gAlpha);
        ctx.fillRect(gx, gy, 1.1, 1.1);
      }
    } else {
      // Precision Point Linework: Jittered natural graphite stroke with paper tooth micro-gaps
      ctx.lineWidth = Math.max(1, this.size * cfg.widthFactor);
      ctx.strokeStyle = this.hexToRgba(color, this.opacity * cfg.coreAlpha);
      ctx.lineCap = "round";

      const jx = (Math.random() - 0.5) * cfg.jitter;
      const jy = (Math.random() - 0.5) * cfg.jitter;
      ctx.beginPath();
      ctx.moveTo(prevPt.x + jx, prevPt.y + jy);
      ctx.lineTo(pt.x + jx, pt.y + jy);
      ctx.stroke();

      // Paper tooth micro speckling
      if (Math.random() < (0.25 + cfg.paperTooth * 0.4)) {
        const toothAlpha = this.opacity * cfg.coreAlpha * (0.7 + Math.random() * 0.3);
        ctx.fillStyle = this.hexToRgba(color, toothAlpha);
        const stx = pt.x + (Math.random() - 0.5) * (this.size * cfg.widthFactor * 1.2);
        const sty = pt.y + (Math.random() - 0.5) * (this.size * cfg.widthFactor * 1.2);
        ctx.fillRect(stx, sty, 1.1, 1.1);
      }
    }
  }

  // 3. Master Oil & Gouache Brush
  renderOilDab(ctx, x, y, size, color) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = color;
    ctx.globalAlpha = this.opacity;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  renderOilSegment(ctx, pt, prevPt, color) {
    ctx.globalCompositeOperation = "source-over";
    // Thick creamy body
    ctx.lineWidth = this.size;
    ctx.lineCap = "round";
    ctx.strokeStyle = this.hexToRgba(color, this.opacity * 0.88);
    ctx.beginPath();
    ctx.moveTo(prevPt.x, prevPt.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    // Subtle bristle striations
    const bristles = Math.max(2, Math.round(this.size * 0.25));
    ctx.lineWidth = Math.max(1, this.size * 0.15);
    const angle = Math.atan2(pt.y - prevPt.y, pt.x - prevPt.x) + Math.PI / 2;
    for (let b = -bristles; b <= bristles; b++) {
      const offset = (b / bristles) * (this.size * 0.35);
      const ox = Math.cos(angle) * offset;
      const oy = Math.sin(angle) * offset;
      const bAlpha = this.opacity * (0.15 + (Math.abs(b) % 2) * 0.2);
      ctx.strokeStyle = this.hexToRgba(color, bAlpha);
      ctx.beginPath();
      ctx.moveTo(prevPt.x + ox, prevPt.y + oy);
      ctx.lineTo(pt.x + ox, pt.y + oy);
      ctx.stroke();
    }
  }

  // 4. Botanical Watercolor Wash
  renderWatercolorDab(ctx, x, y, size, color) {
    ctx.globalCompositeOperation = "source-over";
    const rad = size / 2;
    const grad = ctx.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    grad.addColorStop(0, this.hexToRgba(color, this.opacity * 0.2));
    grad.addColorStop(0.75, this.hexToRgba(color, this.opacity * 0.15));
    grad.addColorStop(1, this.hexToRgba(color, this.opacity * 0.45)); // wet pooled edge
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  renderWatercolorSegment(ctx, pt, prevPt, color) {
    ctx.globalCompositeOperation = "source-over";
    const rad = this.size / 2;
    // Translucent wash with soft wet outer ring
    const grad = ctx.createRadialGradient(pt.x, pt.y, rad * 0.3, pt.x, pt.y, rad);
    grad.addColorStop(0, this.hexToRgba(color, this.opacity * 0.12));
    grad.addColorStop(0.7, this.hexToRgba(color, this.opacity * 0.16));
    grad.addColorStop(1, this.hexToRgba(color, this.opacity * 0.38));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Fine Mist Airbrush
  renderAirbrushDab(ctx, x, y, size, color) {
    ctx.globalCompositeOperation = "source-over";
    const rad = size / 2;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, this.hexToRgba(color, this.opacity * 0.28));
    grad.addColorStop(0.55, this.hexToRgba(color, this.opacity * 0.08));
    grad.addColorStop(1, this.hexToRgba(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Blending Stump / Tortillon Smudge
  renderSmudgeDab(ctx, x, y, size) {
    const rad = Math.round(size / 2);
    const sx = Math.max(0, Math.round(x - rad));
    const sy = Math.max(0, Math.round(y - rad));
    const sw = Math.min(ctx.canvas.width - sx, rad * 2);
    const sh = Math.min(ctx.canvas.height - sy, rad * 2);
    if (sw <= 2 || sh <= 2) return;

    try {
      const imgData = ctx.getImageData(sx, sy, sw, sh);
      const data = imgData.data;
      // Soft box blur on active pixels
      for (let py = 1; py < sh - 1; py += 2) {
        for (let px = 1; px < sw - 1; px += 2) {
          const idx = (py * sw + px) * 4;
          const up = ((py - 1) * sw + px) * 4;
          const dn = ((py + 1) * sw + px) * 4;
          data[idx] = (data[idx] + data[up] + data[dn]) / 3;
          data[idx + 1] = (data[idx + 1] + data[up + 1] + data[dn + 1]) / 3;
          data[idx + 2] = (data[idx + 2] + data[up + 2] + data[dn + 2]) / 3;
        }
      }
      ctx.putImageData(imgData, sx, sy);
    } catch (e) {}
  }

  renderSmudgeSegment(ctx, pt, prevPt) {
    this.renderSmudgeDab(ctx, pt.x, pt.y, this.size);
  }

  drawStraightLine(ctx, startPt, endPt, color) {
    ctx.save();
    if (this.brushType === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = this.opacity;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = this.opacity;
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = this.size;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(startPt.x, startPt.y);
    ctx.lineTo(endPt.x, endPt.y);
    ctx.stroke();
    ctx.restore();
  }

  hexToRgba(hex, alpha) {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map(x => x + x).join("");
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }
}
