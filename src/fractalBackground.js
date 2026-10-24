/**
 * ITIA // GENERATIVE FRACTAL INK BACKGROUND
 * Procedural monochrome & crimson fractal tendrils and atmospheric ink embers.
 * Inspired by avant-garde surrealist organic fine art.
 */

class FractalBackground {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.width = 0;
    this.height = 0;
    this.particles = [];
    this.branches = [];
    this.pulseEnergy = 0;
    this.time = 0;
    
    this.mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000 };

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('mousemove', (e) => {
      this.mouse.targetX = e.clientX;
      this.mouse.targetY = e.clientY;
    });

    this.createBranches();
    this.createParticles(40);
    this.animate();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.createBranches();
  }

  createBranches() {
    this.branches = [];
    // Anchor branches at corners and edges, curling into center
    const anchors = [
      { x: 0, y: this.height * 0.15, angle: 0.15, depth: 7, len: 140 },
      { x: this.width, y: this.height * 0.85, angle: Math.PI + 0.2, depth: 7, len: 150 },
      { x: this.width * 0.1, y: this.height, angle: -Math.PI / 2.3, depth: 6, len: 120 },
      { x: this.width * 0.9, y: 0, angle: Math.PI / 2.2, depth: 6, len: 130 }
    ];

    anchors.forEach(a => {
      this.branches.push(a);
    });
  }

  createParticles(count) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.8) * 0.6,
        size: Math.random() * 2.2 + 0.6,
        alpha: Math.random() * 0.4 + 0.1,
        color: Math.random() > 0.8 ? '#ff2a5f' : '#ffffff'
      });
    }
  }

  pulse(intensity = 1.0) {
    this.pulseEnergy = Math.min(this.pulseEnergy + intensity, 2.0);
  }

  drawFractalBranch(x, y, len, angle, depth, stroke) {
    if (depth <= 0) return;

    const sway = Math.sin(this.time * 0.0015 + depth) * 0.08 * (1 + this.pulseEnergy * 0.5);
    const endX = x + Math.cos(angle + sway) * len;
    const endY = y + Math.sin(angle + sway) * len;

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(endX, endY);
    
    // Monochrome ink style with occasional crimson glow
    const alpha = Math.min(0.25 * (depth / 7) + this.pulseEnergy * 0.15, 0.7);
    this.ctx.strokeStyle = depth === 1 && Math.random() > 0.7 
      ? `rgba(255, 42, 95, ${alpha})`
      : `rgba(255, 255, 255, ${alpha})`;
    this.ctx.lineWidth = stroke;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    // Branching logic (recursive fractal)
    const nextLen = len * 0.72;
    const nextStroke = Math.max(stroke * 0.68, 0.6);

    this.drawFractalBranch(endX, endY, nextLen, angle - 0.42 + sway, depth - 1, nextStroke);
    this.drawFractalBranch(endX, endY, nextLen, angle + 0.38 - sway, depth - 1, nextStroke);
    
    if (depth > 4) {
      this.drawFractalBranch(endX, endY, nextLen * 0.5, angle + 0.05, depth - 2, nextStroke * 0.8);
    }
  }

  animate() {
    this.time += 16;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Mouse smoothing
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

    // Decay pulse
    if (this.pulseEnergy > 0) {
      this.pulseEnergy *= 0.96;
      if (this.pulseEnergy < 0.01) this.pulseEnergy = 0;
    }

    // Subtle dark gradient vignette
    const grad = this.ctx.createRadialGradient(
      this.width * 0.5, this.height * 0.5, 50,
      this.width * 0.5, this.height * 0.5, this.width * 0.8
    );
    grad.addColorStop(0, 'rgba(12, 14, 22, 0.4)');
    grad.addColorStop(1, 'rgba(4, 5, 8, 0.85)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw ink fractal branches
    this.branches.forEach(b => {
      this.drawFractalBranch(b.x, b.y, b.len, b.angle, b.depth, 4.5);
    });

    // Draw floating embers & cyber dust
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * (1 + this.pulseEnergy * 0.3), 0, Math.PI * 2);
      this.ctx.fillStyle = p.color === '#ff2a5f' 
        ? `rgba(255, 42, 95, ${p.alpha * 1.5})` 
        : `rgba(255, 255, 255, ${p.alpha})`;
      this.ctx.fill();
    });

    requestAnimationFrame(() => this.animate());
  }
}

// Global instance
window.fractalBg = new FractalBackground('fractal-bg-canvas');
