/**
 * ITIA STUDIO // BRUSH ENGINE
 * Pro Drawing Engines:
 * - Studio Fine Liner (Sharp anti-aliased inking)
 * - Sketch Pencil (Graphite texture)
 * - Copic Marker (Layered translucent)
 * - Soft Airbrush (Smooth gradients)
 * - Cyber Neon Glow (Luminous bloom)
 * - Sparkle Dust (Anime 4-point star flares)
 * - Sakura Petals (Scattered cherry blossoms)
 * - Manga Halftone (Screentone dots)
 * - Precision Eraser
 * Supports Catmull-Rom stabilization and multi-axis symmetry.
 */

export class BrushEngine {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.brushType = "studio_pen";
    this.size = 6;
    this.opacity = 1.0;
    this.stabilizer = 0.65;
    this.symmetryMode = "none"; // "none", "vertical", "horizontal", "radial4"
    
    // Stroke tracking
    this.points = [];
    this.smoothedPoint = null;
    this.lastDrawnPoint = null;
    this.isDrawing = false;
  }

  setBrushType(type) {
    this.brushType = type;
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

  /**
   * Generates mirrored points according to active symmetry mode
   */
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

    const step = Math.max(1, this.size * 0.22);

    if (dist >= step) {
      const steps = Math.ceil(dist / step);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const interpX = prevPt.x + (currentPt.x - prevPt.x) * t;
        const interpY = prevPt.y + (currentPt.y - prevPt.y) * t;
        const curInterp = { x: interpX, y: interpY };

        // Symmetry points for previous and current
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
      case "sparkle":
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = this.opacity * 0.85;
        this.drawSparkleStar(ctx, pt.x, pt.y, this.size * 1.8, color);
        break;

      case "sakura_petals":
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = this.opacity * 0.85;
        this.drawPetal(ctx, pt.x, pt.y, this.size * 1.4, Math.random() * Math.PI * 2, color);
        break;

      case "halftone":
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = this.opacity;
        this.drawHalftoneDab(ctx, pt.x, pt.y, this.size, color);
        break;

      case "neon_glow":
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = this.opacity * 0.35;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, this.size * 1.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = this.opacity * 0.7;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, this.size * 0.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = this.opacity * 0.95;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1, this.size * 0.3), 0, Math.PI * 2);
        ctx.fill();
        break;

      case "airbrush":
        ctx.globalCompositeOperation = "source-over";
        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, this.size / 2);
        grad.addColorStop(0, this.hexToRgba(color, this.opacity * 0.35));
        grad.addColorStop(0.6, this.hexToRgba(color, this.opacity * 0.1));
        grad.addColorStop(1, this.hexToRgba(color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "pencil":
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = this.opacity * 0.75;
        ctx.beginPath();
        ctx.arc(pt.x + (Math.random() - 0.5) * 1.5, pt.y + (Math.random() - 0.5) * 1.5, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "marker":
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = this.opacity * 0.45;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "studio_pen":
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
      ctx.globalAlpha = this.opacity;
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
      case "sparkle":
        // Randomly drop twinkling star flares
        if (Math.random() < 0.28) {
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = this.opacity * (0.6 + Math.random() * 0.4);
          const starSize = this.size * (0.8 + Math.random() * 1.2);
          this.drawSparkleStar(ctx, pt.x, pt.y, starSize, color);
        }
        break;

      case "sakura_petals":
        if (Math.random() < 0.24) {
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = this.opacity * (0.6 + Math.random() * 0.4);
          const petalSize = this.size * (0.7 + Math.random() * 0.8);
          this.drawPetal(ctx, pt.x, pt.y, petalSize, Math.random() * Math.PI * 2, color);
        }
        break;

      case "halftone":
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = this.opacity;
        this.drawHalftoneDab(ctx, pt.x, pt.y, this.size, color);
        break;

      case "neon_glow":
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = this.opacity * 0.25;
        ctx.lineWidth = this.size * 2.8;
        ctx.beginPath();
        ctx.moveTo(prevPt.x, prevPt.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();

        ctx.globalAlpha = this.opacity * 0.65;
        ctx.lineWidth = this.size * 1.2;
        ctx.beginPath();
        ctx.moveTo(prevPt.x, prevPt.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();

        ctx.globalAlpha = this.opacity * 0.95;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1.5, this.size * 0.35);
        ctx.beginPath();
        ctx.moveTo(prevPt.x, prevPt.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        break;

      case "airbrush":
        ctx.globalCompositeOperation = "source-over";
        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, this.size / 2);
        grad.addColorStop(0, this.hexToRgba(color, this.opacity * 0.22));
        grad.addColorStop(0.7, this.hexToRgba(color, this.opacity * 0.05));
        grad.addColorStop(1, this.hexToRgba(color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "pencil":
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = this.opacity * 0.55;
        ctx.lineWidth = this.size;
        const jx = (Math.random() - 0.5) * 1.2;
        const jy = (Math.random() - 0.5) * 1.2;
        ctx.beginPath();
        ctx.moveTo(prevPt.x + jx, prevPt.y + jy);
        ctx.lineTo(pt.x + jx, pt.y + jy);
        ctx.stroke();
        break;

      case "marker":
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = this.opacity * 0.45;
        ctx.lineWidth = this.size;
        ctx.beginPath();
        ctx.moveTo(prevPt.x, prevPt.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        break;

      case "studio_pen":
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

  // Draw 4-point anime sparkle star flare
  drawSparkleStar(ctx, cx, cy, radius, color) {
    ctx.save();
    ctx.fillStyle = color;
    
    // Outer colored glow
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.quadraticCurveTo(cx, cy, cx + radius, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + radius);
    ctx.quadraticCurveTo(cx, cy, cx - radius, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - radius);
    ctx.fill();

    // White hot core
    ctx.fillStyle = "#ffffff";
    const core = radius * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - core);
    ctx.quadraticCurveTo(cx, cy, cx + core, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + core);
    ctx.quadraticCurveTo(cx, cy, cx - core, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - core);
    ctx.fill();

    ctx.restore();
  }

  // Draw a stylized sakura cherry blossom petal
  drawPetal(ctx, cx, cy, size, angle, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.bezierCurveTo(size * 0.6, -size * 0.6, size * 0.7, size * 0.5, 0, size);
    ctx.bezierCurveTo(-size * 0.7, size * 0.5, -size * 0.6, -size * 0.6, 0, -size);
    ctx.fill();

    ctx.restore();
  }

  // Draw halftone dot cluster
  drawHalftoneDab(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    const dotSpacing = Math.max(4, Math.round(size * 0.35));
    const dotR = Math.max(1, dotSpacing * 0.3);

    const rad = size / 2;
    for (let dy = -rad; dy <= rad; dy += dotSpacing) {
      for (let dx = -rad; dx <= rad; dx += dotSpacing) {
        if (Math.hypot(dx, dy) <= rad) {
          ctx.beginPath();
          ctx.arc(cx + dx, cy + dy, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
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
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
