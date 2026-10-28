/**
 * ITIA STUDIO // SMART FLOOD FILL ENGINE
 * Pro-grade TypedArray BFS flood fill with adjustable tolerance,
 * anti-gap boundary expansion, leak gap closure, and Multi-Layer sampling.
 */

export class FloodFill {
  /**
   * Executes flood fill on targetLayerCtx.
   * @param {CanvasRenderingContext2D} targetCtx - Context of layer to receive paint
   * @param {CanvasRenderingContext2D|null} sampleCtx - Context to sample edges from (e.g. composite canvas), or null to use targetCtx
   * @param {number} startX - Canvas pixel X coordinate
   * @param {number} startY - Canvas pixel Y coordinate
   * @param {string} fillColorHex - Hex color to fill
   * @param {number} tolerance - Tolerance range (0 - 100)
   * @param {number} expansion - Pixel expansion under lineart (0 - 4)
   * @param {boolean} gapClosure - Whether to prevent leaking through 1-2px breaks in strokes
   */
  static fill(targetCtx, sampleCtx, startX, startY, fillColorHex, tolerance = 35, expansion = 1, gapClosure = true) {
    const width = targetCtx.canvas.width;
    const height = targetCtx.canvas.height;

    startX = Math.floor(startX);
    startY = Math.floor(startY);

    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return false;

    // Source context to read colors from (sampleCtx if sampling all layers, otherwise targetCtx)
    const readCtx = sampleCtx || targetCtx;
    const readImgData = readCtx.getImageData(0, 0, width, height);
    const readData32 = new Uint32Array(readImgData.data.buffer);

    // Target context to write colors into
    const writeImgData = targetCtx.getImageData(0, 0, width, height);
    const writeData32 = new Uint32Array(writeImgData.data.buffer);

    // Convert fillColorHex to 32-bit integer (ABGR in little-endian)
    const fillRgb = this.hexToRgb(fillColorHex);
    const fillPixel = (255 << 24) | (fillRgb.b << 16) | (fillRgb.g << 8) | fillRgb.r;

    const startIdx = startY * width + startX;
    const targetPixel = readData32[startIdx];

    // Read target pixel channels
    const tr = targetPixel & 0xff;
    const tg = (targetPixel >> 8) & 0xff;
    const tb = (targetPixel >> 16) & 0xff;
    const ta = (targetPixel >> 24) & 0xff;

    // Check if clicking same color already
    if (this.colorMatch(fillPixel, targetPixel, 2)) {
      return false;
    }

    const tolSq = Math.max(16, (tolerance * 2.55) ** 2);

    // Helper: is pixel a solid lineart boundary
    const isLineartBoundary = (pix) => {
      const a = (pix >> 24) & 0xff;
      if (a < 60) return false;
      const r = pix & 0xff;
      const g = (pix >> 8) & 0xff;
      const b = (pix >> 16) & 0xff;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      return lum < 85 && a > 140;
    };

    // Helper: gap closure leak detector
    const isLeakGap = (x, y) => {
      if (!gapClosure) return false;
      // Horizontal bottleneck check (walls left and right within 1-2px)
      const hasLeftWall = (x > 1 && isLineartBoundary(readData32[y * width + (x - 1)])) ||
                          (x > 2 && isLineartBoundary(readData32[y * width + (x - 2)]));
      const hasRightWall = (x < width - 2 && isLineartBoundary(readData32[y * width + (x + 1)])) ||
                           (x < width - 3 && isLineartBoundary(readData32[y * width + (x + 2)]));
      if (hasLeftWall && hasRightWall) return true;

      // Vertical bottleneck check (walls top and bottom within 1-2px)
      const hasTopWall = (y > 1 && isLineartBoundary(readData32[(y - 1) * width + x])) ||
                         (y > 2 && isLineartBoundary(readData32[(y - 2) * width + x]));
      const hasBottomWall = (y < height - 2 && isLineartBoundary(readData32[(y + 1) * width + x])) ||
                            (y < height - 3 && isLineartBoundary(readData32[(y + 2) * width + x]));
      if (hasTopWall && hasBottomWall) return true;

      return false;
    };

    // Bit array for visited pixels (width * height bits)
    const visited = new Uint8Array(Math.ceil((width * height) / 8));
    const isVisited = (idx) => (visited[idx >> 3] & (1 << (idx & 7))) !== 0;
    const setVisited = (idx) => { visited[idx >> 3] |= (1 << (idx & 7)); };

    // Queue for BFS
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;

    queue[tail++] = startIdx;
    setVisited(startIdx);

    const filledIndices = expansion > 0 ? [] : null;

    while (head < tail) {
      const idx = queue[head++];
      const x = idx % width;
      const y = Math.floor(idx / width);

      // Fill in write buffer
      writeData32[idx] = fillPixel;
      if (filledIndices) filledIndices.push(idx);

      // Check 4 cardinal neighbors
      // North
      if (y > 0) {
        const nIdx = idx - width;
        if (!isVisited(nIdx) && this.checkTolerance(readData32[nIdx], tr, tg, tb, ta, tolSq)) {
          if (!isLeakGap(x, y - 1)) {
            setVisited(nIdx);
            queue[tail++] = nIdx;
          }
        }
      }

      // South
      if (y < height - 1) {
        const sIdx = idx + width;
        if (!isVisited(sIdx) && this.checkTolerance(readData32[sIdx], tr, tg, tb, ta, tolSq)) {
          if (!isLeakGap(x, y + 1)) {
            setVisited(sIdx);
            queue[tail++] = sIdx;
          }
        }
      }

      // West
      if (x > 0) {
        const wIdx = idx - 1;
        if (!isVisited(wIdx) && this.checkTolerance(readData32[wIdx], tr, tg, tb, ta, tolSq)) {
          if (!isLeakGap(x - 1, y)) {
            setVisited(wIdx);
            queue[tail++] = wIdx;
          }
        }
      }

      // East
      if (x < width - 1) {
        const eIdx = idx + 1;
        if (!isVisited(eIdx) && this.checkTolerance(readData32[eIdx], tr, tg, tb, ta, tolSq)) {
          if (!isLeakGap(x + 1, y)) {
            setVisited(eIdx);
            queue[tail++] = eIdx;
          }
        }
      }
    }

    // Edge expansion: expand boundary by 1-4 pixels under lineart to eradicate white fringe
    if (expansion > 0 && filledIndices && filledIndices.length > 0) {
      const fillLen = filledIndices.length;
      for (let i = 0; i < fillLen; i++) {
        const idx = filledIndices[i];
        const x = idx % width;
        const y = Math.floor(idx / width);

        // Check if edge pixel (neighbor not filled)
        const isEdge = (x === 0 || !isVisited(idx - 1)) ||
                       (x === width - 1 || !isVisited(idx + 1)) ||
                       (y === 0 || !isVisited(idx - width)) ||
                       (y === height - 1 || !isVisited(idx + width));

        if (!isEdge) continue;

        for (let dy = -expansion; dy <= expansion; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -expansion; dx <= expansion; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            const expIdx = ny * width + nx;

            // If writing to a layer that contains solid black lineart, don't overwrite solid lineart
            const readPix = readData32[expIdx];
            if (!isLineartBoundary(readPix)) {
              writeData32[expIdx] = fillPixel;
            }
          }
        }
      }
    }

    targetCtx.putImageData(writeImgData, 0, 0);
    return true;
  }

  static checkTolerance(pixel, tr, tg, tb, ta, tolSq) {
    const r = pixel & 0xff;
    const g = (pixel >> 8) & 0xff;
    const b = (pixel >> 16) & 0xff;
    const a = (pixel >> 24) & 0xff;

    // Both transparent?
    if (ta < 15 && a < 15) return true;

    // Transparent target vs opaque sample:
    if (ta < 15 && a > 30) {
      // If we clicked empty background, stop at non-transparent lines
      return false;
    }

    const dr = r - tr;
    const dg = g - tg;
    const db = b - tb;
    const da = a - ta;

    return (dr * dr + dg * dg + db * db + da * da * 0.6) <= tolSq;
  }

  static colorMatch(p1, p2, tol = 5) {
    const r1 = p1 & 0xff, g1 = (p1 >> 8) & 0xff, b1 = (p1 >> 16) & 0xff;
    const r2 = p2 & 0xff, g2 = (p2 >> 8) & 0xff, b2 = (p2 >> 16) & 0xff;
    return Math.abs(r1 - r2) <= tol && Math.abs(g1 - g2) <= tol && Math.abs(b1 - b2) <= tol;
  }

  static hexToRgb(hex) {
    let clean = hex.replace("#", "");
    if (clean.length === 3) clean = clean.split("").map(c => c + c).join("");
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }
}
