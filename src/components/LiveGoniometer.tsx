import React, { useRef, useEffect } from 'react';

interface LiveGoniometerProps {
  analyserL: AnalyserNode | null;
  analyserR: AnalyserNode | null;
  isPlaying: boolean;
  activeMode: 'A' | 'B';
}

export const LiveGoniometer: React.FC<LiveGoniometerProps> = ({
  analyserL,
  analyserR,
  isPlaying,
  activeMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 240;
    const H = canvas.clientHeight || 120;

    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const timeDataL = new Float32Array(512);
    const timeDataR = new Float32Array(512);

    const render = () => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      // Background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;

      const cx = W / 2;
      const cy = H / 2;
      const radius = Math.min(W, H) * 0.42;

      // Draw Lissajous reference circles & 45-degree axis (M/S)
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.stroke();

      // 45 degree crosshair for L and R
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.7, cy + radius * 0.7);
      ctx.lineTo(cx + radius * 0.7, cy - radius * 0.7);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)';
      ctx.stroke();

      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.font = '8px monospace';
      ctx.fillText('L', cx - radius * 0.75, cy - radius * 0.75 + 4);
      ctx.fillText('R', cx + radius * 0.75 - 6, cy - radius * 0.75 + 4);
      ctx.fillText('M', cx - 3, cy - radius - 2);
      ctx.fillText('S', cx + radius + 3, cy + 3);

      if (isPlaying && analyserL && analyserR) {
        analyserL.getFloatTimeDomainData(timeDataL);
        analyserR.getFloatTimeDomainData(timeDataR);

        ctx.strokeStyle = activeMode === 'B' ? '#10b981' : '#f59e0b';
        ctx.lineWidth = 1.3;
        ctx.beginPath();

        const step = 2;
        let drawn = false;

        for (let i = 0; i < timeDataL.length; i += step) {
          const l = timeDataL[i];
          const r = timeDataR[i];

          // 45-degree rotation for Mid/Side representation:
          // X = (L - R) * scale [Side]
          // Y = (L + R) * scale [Mid]
          const x = cx + (l - r) * radius * 0.9;
          const y = cy - (l + r) * radius * 0.9;

          if (!drawn) {
            ctx.moveTo(x, y);
            drawn = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      } else {
        // Idle line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius * 0.6);
        ctx.lineTo(cx, cy + radius * 0.6);
        ctx.stroke();
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, analyserL, analyserR, activeMode]);

  return (
    <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950 border border-slate-800">
      <div className="flex items-center justify-between w-full px-1 text-[9px] font-mono text-slate-400 mb-1">
        <span>GONIOMETER [PHASE SCOPE]</span>
        <span className={activeMode === 'B' ? 'text-emerald-400' : 'text-amber-400'}>
          {isPlaying ? (activeMode === 'B' ? '● Master Stereo' : '● Source Stereo') : '○ Idle'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-24 block"
      />
    </div>
  );
};
