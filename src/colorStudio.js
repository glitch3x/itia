/**
 * ITIA STUDIO // COLOR STUDIO
 * Advanced Color Management: HSV Color Wheel, Eyedropper Loupe, 
 * Dynamic Image Palette Extractor, and Swatch Palette strips.
 */

export class ColorStudio {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.currentColor = "#ff1244"; // Default vibrant crimson
    this.secondaryColor = "#ffffff";
    this.recentColors = [
      "#000000", "#ffffff", "#ff1244", "#0a58f6", 
      "#ff5a79", "#99ff00", "#ffcc00", "#00f0ff"
    ];
    this.extractedPalette = [];
    this.onColorChange = null;

    // HSV representation (H: 0-360, S: 0-1, V: 0-1)
    this.hsv = { h: 348, s: 0.93, v: 1.0 };
    this.updateHSVFromHex(this.currentColor);
  }

  setColor(hex, triggerCallback = true, playSound = false) {
    if (!hex || hex === this.currentColor) return;
    this.secondaryColor = this.currentColor;
    this.currentColor = hex.toLowerCase();
    this.updateHSVFromHex(this.currentColor);
    this.addRecentColor(this.currentColor);

    if (playSound && this.audio) {
      const freq = 400 + Math.round((this.hsv.h / 360) * 450);
      this.audio.playColorSelect(freq);
    }

    if (triggerCallback && this.onColorChange) {
      this.onColorChange(this.currentColor);
    }
  }

  addRecentColor(hex) {
    const cleanHex = hex.toLowerCase();
    this.recentColors = this.recentColors.filter(c => c !== cleanHex);
    this.recentColors.unshift(cleanHex);
    if (this.recentColors.length > 18) {
      this.recentColors.pop();
    }
  }

  updateHSVFromHex(hex) {
    const rgb = this.hexToRgb(hex);
    if (rgb) {
      this.hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    }
  }

  setHSV(h, s, v, triggerCallback = true) {
    this.hsv = { 
      h: Math.max(0, Math.min(360, h)), 
      s: Math.max(0, Math.min(1, s)), 
      v: Math.max(0, Math.min(1, v)) 
    };
    const rgb = this.hsvToRgb(this.hsv.h, this.hsv.s, this.hsv.v);
    this.currentColor = this.rgbToHex(rgb.r, rgb.g, rgb.b);

    if (triggerCallback && this.onColorChange) {
      this.onColorChange(this.currentColor);
    }
  }

  // Convert Hex string to RGB object {r, g, b}
  hexToRgb(hex) {
    let clean = hex.replace("#", "");
    if (clean.length === 3) {
      clean = clean.split("").map(c => c + c).join("");
    }
    const num = parseInt(clean, 16);
    if (isNaN(num)) return { r: 0, g: 0, b: 0 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  // Convert RGB to Hex string
  rgbToHex(r, g, b) {
    const toHex = (n) => {
      const val = Math.max(0, Math.min(255, Math.round(n)));
      return val.toString(16).padStart(2, "0");
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // RGB to HSV
  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max === min) {
      h = 0; // achromatic
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s, v };
  }

  // HSV to RGB
  hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor((h / 60) % 6);
    const f = (h / 60) - Math.floor(h / 60);
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  // Extract vibrant & dominant color palette from an image element
  extractPaletteFromImage(imgElement, maxColors = 8) {
    try {
      const offscreen = document.createElement("canvas");
      const ctx = offscreen.getContext("2d", { willReadFrequently: true });
      const sampleSize = 120; // scale down for speed
      offscreen.width = sampleSize;
      offscreen.height = sampleSize;

      ctx.drawImage(imgElement, 0, 0, sampleSize, sampleSize);
      const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

      // Color quantization map
      const colorBuckets = new Map();

      // Step by 4 pixels for performance
      for (let i = 0; i < imgData.length; i += 16) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];

        if (a < 128) continue;

        // Reduce color space to 32 steps per channel
        const qr = Math.round(r / 24) * 24;
        const qg = Math.round(g / 24) * 24;
        const qb = Math.round(b / 24) * 24;
        const key = `${qr},${qg},${qb}`;

        const entry = colorBuckets.get(key) || { count: 0, r: qr, g: qg, b: qb };
        entry.count++;
        colorBuckets.set(key, entry);
      }

      // Sort by frequency and filter distinct hues
      const sorted = Array.from(colorBuckets.values()).sort((a, b) => b.count - a.count);
      const chosen = [];

      for (const bucket of sorted) {
        const hex = this.rgbToHex(bucket.r, bucket.g, bucket.b);
        // Ensure color isn't too close to existing chosen colors
        const tooClose = chosen.some(c => {
          const rgb = this.hexToRgb(c);
          const dist = Math.hypot(bucket.r - rgb.r, bucket.g - rgb.g, bucket.b - rgb.b);
          return dist < 42; // distance threshold
        });

        if (!tooClose) {
          chosen.push(hex);
          if (chosen.length >= maxColors) break;
        }
      }

      this.extractedPalette = chosen;
      return chosen;
    } catch (e) {
      console.warn("Could not extract image palette", e);
      return [];
    }
  }
}
