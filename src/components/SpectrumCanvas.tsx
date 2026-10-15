import React, { useRef, useEffect } from 'react';
import type { AudioMetrics } from '../audio/dspLogic.ts';

interface SpectrumCanvasProps {
  preMetrics: AudioMetrics | null;
  postMetrics?: AudioMetrics | null;
  normalizeLufs?: boolean;
  height?: number;
  id?: string;
}

export const SpectrumCanvas: React.FC<SpectrumCanvasProps> = ({
  preMetrics,
  postMetrics = null,
  normalizeLufs = true,
  height = 190,
  id = 'fftCanvas',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !preMetrics) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width || 800;
    const H = height;

    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // 1. Draw Background grid & DB levels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let gy = 25; gy < H - 20; gy += 32) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    // Frequency markers
    const freqMarkers = [40, 100, 250, 500, 1000, 2500, 5000, 10000, 16000];
    freqMarkers.forEach(f => {
      const x = (Math.log10(f / 20) / Math.log10(20000 / 20)) * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();

      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.font = '9px monospace';
      ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x + 3, H - 6);
    });

    const halfBins = preMetrics.spectrumDb.length;
    const mapFreqToX = (freq: number) => (Math.log10(freq / 20) / Math.log10(20000 / 20)) * W;
    const mapDbToY = (db: number) => {
      const normY = Math.max(0, Math.min(1, (db + 90) / 74));
      return H - normY * (H - 26) - 16;
    };

    // 2. Pre-Master Curve (Cyan)
    ctx.beginPath();
    let started = false;
    for (let b = 1; b < halfBins; b++) {
      const freq = b * preMetrics.binHz;
      if (freq < 20 || freq > 20000) continue;
      const x = mapFreqToX(freq);
      const y = mapDbToY(preMetrics.spectrumDb[b]);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = postMetrics ? 'rgba(34, 211, 238, 0.72)' : '#22d3ee';
    ctx.lineWidth = postMetrics ? 1.5 : 2.0;
    ctx.stroke();

    // 3. Post-Master Curve (Emerald)
    if (postMetrics) {
      const lufsOffset = normalizeLufs
        ? (postMetrics.integratedLufs - preMetrics.integratedLufs)
        : 0.0;

      ctx.beginPath();
      let pStarted = false;
      for (let b = 1; b < halfBins; b++) {
        const freq = b * postMetrics.binHz;
        if (freq < 20 || freq > 20000) continue;
        const x = mapFreqToX(freq);
        const y = mapDbToY(postMetrics.spectrumDb[b] - lufsOffset);
        if (!pStarted) {
          ctx.moveTo(x, y);
          pStarted = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.1;
      ctx.stroke();
    }

    // 4. Surgical Notch Markers
    preMetrics.resonances.forEach((r, i) => {
      const x = mapFreqToX(r.freq);
      const bin = Math.min(halfBins - 1, Math.round(r.freq / preMetrics.binHz));
      const y = mapDbToY(preMetrics.spectrumDb[bin]);

      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fda4af';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(
        `N${i + 1}:${r.freq}Hz`,
        Math.min(W - 75, Math.max(4, x - 20)),
        Math.max(14, y - 8)
      );
    });

    ctx.restore();
  }, [preMetrics, postMetrics, normalizeLufs, height]);

  return (
    <div className="w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 shadow-inner">
      <canvas
        id={id}
        ref={canvasRef}
        style={{ width: '100%', height: `${height}px` }}
        className="block"
      />
    </div>
  );
};
