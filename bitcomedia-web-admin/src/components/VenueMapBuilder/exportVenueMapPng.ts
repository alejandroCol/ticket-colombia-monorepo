import type { VenueMapDecoration, VenueMapVisualConfig } from '@services/types';

function safeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
}

function lighten(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  if (n.length !== 6) return hex;
  const r = Math.min(255, parseInt(n.slice(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(n.slice(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(n.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function drawDecoration(
  ctx: CanvasRenderingContext2D,
  d: VenueMapDecoration,
  w: number,
  h: number
): void {
  const fill = d.color || '#4a4a5c';
  const stroke = 'rgba(255,255,255,0.18)';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.025);

  switch (d.type) {
    case 'stage': {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, lighten(fill, 25));
      g.addColorStop(1, fill);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(w * 0.06, 0);
      ctx.lineTo(w * 0.94, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'palco_tier': {
      ctx.fillStyle = fill;
      const rows = 4;
      const gap = h * 0.04;
      const rowH = (h - gap * (rows - 1)) / rows;
      for (let i = 0; i < rows; i++) {
        const y0 = i * (rowH + gap);
        const inset = (i / rows) * w * 0.12;
        ctx.fillRect(inset, y0, w - inset * 2, rowH * 0.85);
        ctx.strokeRect(inset, y0, w - inset * 2, rowH * 0.85);
      }
      break;
    }
    case 'dance_floor': {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      const step = Math.max(10, w / 10);
      for (let i = step; i < w; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
      }
      for (let j = step; j < h; j += step) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(w, j);
        ctx.stroke();
      }
      break;
    }
    case 'bar_counter': {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, lighten(fill, -10));
      g.addColorStop(0.5, fill);
      g.addColorStop(1, lighten(fill, -15));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = stroke;
      ctx.strokeRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(w * 0.1, h * 0.15, w * 0.8, h * 0.12);
      break;
    }
    case 'dj_booth': {
      ctx.fillStyle = fill;
      ctx.fillRect(0, h * 0.35, w, h * 0.65);
      ctx.strokeRect(0, h * 0.35, w, h * 0.65);
      const deckR = Math.min(w, h) * 0.28;
      ctx.fillStyle = '#1a1a24';
      ctx.beginPath();
      ctx.arc(w * 0.28, h * 0.22, deckR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w * 0.72, h * 0.22, deckR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'theater_fan': {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.92);
      ctx.lineTo(w * 0.02, h * 0.92);
      ctx.quadraticCurveTo(w * 0.02, h * 0.15, w / 2, h * 0.08);
      ctx.quadraticCurveTo(w * 0.98, h * 0.15, w * 0.98, h * 0.92);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      const rows = 6;
      const cols = 10;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ty = h * 0.2 + (r / rows) * h * 0.65;
          const spread = 0.15 + (r / rows) * 0.35;
          const tx = w * (0.5 - spread + (c / (cols - 1)) * spread * 2);
          ctx.beginPath();
          ctx.arc(tx, ty, Math.min(w, h) * 0.022, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'vip_box': {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.04);
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
      break;
    }
    case 'lounge_sofa': {
      ctx.fillStyle = fill;
      const rad = Math.min(h * 0.35, w * 0.2, w / 2, h / 2);
      ctx.beginPath();
      safeRoundRect(ctx, 0, 0, w, h, rad);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'high_table': {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.15);
      ctx.lineTo(w / 2, h * 0.85);
      ctx.stroke();
      break;
    }
    case 'entrance_arch': {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.35);
      ctx.quadraticCurveTo(0, 0, w / 2, 0);
      ctx.quadraticCurveTo(w, 0, w, h * 0.35);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'stairs': {
      const steps = 6;
      const sh = h / steps;
      for (let i = 0; i < steps; i++) {
        const shade = lighten(fill, -i * 4);
        ctx.fillStyle = shade;
        ctx.fillRect(0, i * sh, w, sh * 0.92);
        ctx.strokeRect(0, i * sh, w, sh * 0.92);
      }
      break;
    }
    case 'balcony': {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, w, h * 0.65);
      ctx.strokeRect(0, 0, w, h * 0.65);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 12; i++) {
        const x = (i / 11) * w;
        ctx.beginPath();
        ctx.moveTo(x, h * 0.55);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      break;
    }
    case 'pillar': {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, lighten(fill, -20));
      g.addColorStop(0.5, lighten(fill, 15));
      g.addColorStop(1, lighten(fill, -20));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.stroke();
      break;
    }
    case 'light_rig': {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, w, h * 0.45);
      ctx.strokeRect(0, 0, w, h * 0.45);
      ctx.fillStyle = 'rgba(255,220,100,0.5)';
      for (let i = 0; i < 8; i++) {
        const x = ((i + 0.5) / 8) * w;
        ctx.beginPath();
        ctx.moveTo(x, h * 0.45);
        ctx.lineTo(x - w * 0.03, h);
        ctx.lineTo(x + w * 0.03, h);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'pool_ring': {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth *= 1.5;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w * 0.28, h * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    default:
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);
  }

  if (d.label) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const fs = Math.max(11, Math.min(w, h) * 0.11);
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 4;
    ctx.fillText(d.label, w / 2, h / 2);
    ctx.restore();
  }
}

function loadImageCover(
  ctx: CanvasRenderingContext2D,
  url: string,
  cw: number,
  ch: number
): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw || !ih) {
        resolve();
        return;
      }
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}

function exportDimensions(visual: VenueMapVisualConfig): { width: number; height: number } {
  if (visual.frame_aspect === 'portrait') {
    /** Mismo 4∶5 que flyers / mapas tipo boletería vertical (p. ej. material KOЯΛ). */
    return { width: 1080, height: 1350 };
  }
  return { width: 1280, height: 720 };
}

export async function exportVenueMapToBlob(visual: VenueMapVisualConfig): Promise<Blob | null> {
  const { width, height } = exportDimensions(visual);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = visual.background;
  ctx.fillRect(0, 0, width, height);

  const bgUrl = visual.backgroundImageUrl?.trim();
  if (bgUrl) {
    await loadImageCover(ctx, bgUrl, width, height);
  }

  const sorted = [...visual.decorations].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  for (const d of sorted) {
    const x = (d.x / 100) * width;
    const y = (d.y / 100) * height;
    const w = (d.w / 100) * width;
    const h = (d.h / 100) * height;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rot = ((d.rotation || 0) * Math.PI) / 180;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-w / 2, -h / 2);
    drawDecoration(ctx, d, w, h);
    ctx.restore();
  }

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 0.92);
  });
}
