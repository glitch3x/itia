# ITIA STUDIO // TRACE & PAINT DIGITAL ART SUITE
> *I Think It's Art* — Interactive Trace, Lineart & Color Studio

An avant-garde digital art studio web app where you can trace, ink, and color artworks with pro brushes, flood fill, multi-layer canvas, and smart trace filters.

---

## 🎨 Features

### 1. ✏️ Interactive Trace & Light Table
- **Reference Opacity Slider**: Smooth 0% to 100% transparency control with quick presets (15%, 35%, 50%, 75%, 100%).
- **5 Trace Filter Modes**:
  - `True Color`: Original reference image.
  - `Manga Blueprint`: Cyanotype blue sketch lines, classic for manga/comic pencil tracing.
  - `Lineart Outlines`: Real-time Sobel edge-detection filter creating instant lineart contours.
  - `High Contrast`: Crisp black-and-white silhouettes.
  - `Inverted`: Negative glow for tracing on dark canvas backdrops.
- **✨ One-Click "Bake Lines & Start Coloring"**:
  - Automatically extracts crisp lineart outlines from the reference image directly onto your Lineart layer, creating an instant coloring book sheet ready for the Paint Bucket and brushes!
- **Split-View / Wipe Curtain**:
  - Interactive slider dividing the canvas to compare original reference art with your drawing side-by-side.

### 2. 🖌️ Pro Brush Engines
- **Studio Fine-Liner**: Crisp, anti-aliased inking pen with pressure/velocity variation.
- **Sketch Pencil**: Analog textured graphite for construction lines.
- **Copic Marker**: Semi-translucent layered tonal shading.
- **Soft Airbrush**: Radial gradient spray for buttery smooth shadows, blush, and skin tones.
- **Cyber Neon Glow**: Luminous multi-pass bloom brush (wide ambient aura + pure white core) for glowing tears, sparks, and eyes.
- **Precision Eraser**: Fast, clean eraser.
- **Line Smoothing / Stabilizer**: Exponential moving average (Off, Smooth, Pro Inker, Maximum).
- **Straight Line Guide**: Hold `Shift` while dragging or select the Line tool.

### 3. 🪣 Smart Flood Fill (Paint Bucket)
- Fast BFS TypedArray flood fill with configurable tolerance.
- **Multi-Layer Sampling**: Color on the *Colors & Fill* layer while sampling line boundaries from the *Lineart* layer without bleeding or overwriting!
- **Anti-Gap Bleed Expansion**: Expands fill 1-2 pixels under lineart edges to eliminate uncolored white halos.

### 4. 📚 Multi-Layer Canvas Architecture
- Default stack:
  - `Layer 3`: Highlights & Glow (Screen / Add)
  - `Layer 2`: Lineart & Inking
  - `Layer 1`: Colors & Fill
  - `Layer 0`: Canvas Background (White Paper, Dark Slate, Warm Cream, Transparent)
- Add, Duplicate, Merge Down, Delete, Clear, Lock, and Hide/Show layers.

### 5. 🖼️ Masterpiece Gallery & Custom Upload
- Includes 9 curated reference artworks ready to trace & color:
  1. **Iridescent Hydrangea**: Prismatic holographic rainbow bangs & blooming hydrangeas.
  2. **Noir Blinds**: Cinematic venetian blind light slashes with vivid amber eye and tangerine lips.
  3. **Cloud Specter**: Surrealist entity enveloped in cumulus cloud bands with sprouting green trees.
  4. **Zebra Huntress**: Tribal couture monochrome zebra warpaint & piercing cyan-emerald eyes.
  5. **Neon Reverie**: Cyber vaporwave crying silhouette with scarlet smoke & glowing teardrop.
  6. **Sakura Twilight**: Luminous anime couple under blossoming cherry canopy with dappled sun.
  7. **Peony Noir**: High-fashion upward gaze with black & radioactive-lime peonies.
  8. **Fractal Monolith**: Avant-Garde organic branching tendrils & high-contrast profile.
  9. **Chiseled Gaze**: Fractured marble visage with piercing glowing amber iris.
- **Custom Image Upload**: Drag and drop any image or photo from your computer to trace and color!
- **Dynamic Palette Extractor**: Automatically quantizes and extracts vibrant color swatches from whichever image is loaded.

### 6. 🔊 Tactile Sound Engine (Web Audio API)
- Procedural acoustic feedback for brush strokes, bucket fills, color selection, undo/redo, and exports. Zero external audio dependencies.

---

## 🚀 Running Locally

No build tools or heavy installations required! Simply open `index.html` in any web browser, or run a local HTTP server:

```bash
# Python
python -m http.server 5173

# Node.js
npx -y serve .
```

Open `http://localhost:5173` in your browser.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `B` | Brush / Inker Tool |
| `E` | Precision Eraser |
| `G` | Smart Paint Bucket (Flood Fill) |
| `I` | Color Eyedropper |
| `Space + Drag` | Pan / Move Canvas |
| `Mouse Wheel` | Zoom In / Out |
| `Shift + Drag` | Draw Straight Line Guide |
| `T` | Toggle Reference Visibility |
| `F` | Fit Canvas to Screen |
| `H` | Flip Canvas Horizontally |
| `[` / `]` | Decrease / Increase Brush Size |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
