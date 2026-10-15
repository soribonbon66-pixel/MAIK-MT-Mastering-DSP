import React from 'react';
import { Mic, Waves, Compass, Activity } from 'lucide-react';

interface HeaderProps {
  status: string;
  statusColor: 'slate' | 'cyan' | 'amber' | 'emerald' | 'rose';
  onOpenLiveMic: () => void;
  tiltActive: boolean;
  onToggleTilt: () => void;
  hasDeviceTilt: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  statusColor,
  onOpenLiveMic,
  tiltActive,
  onToggleTilt,
  hasDeviceTilt,
}) => {
  const colorClasses = {
    slate: 'bg-slate-900 text-slate-300 border-slate-700',
    cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    rose: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  }[statusColor];

  return (
    <header className="border-b border-slate-800/90 bg-slate-950/95 sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="obsidian-badge w-10 h-10 rounded-full flex items-center justify-center shrink-0">
          <span className="text-[11px] font-black tracking-tighter text-cyan-300">MMT</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-black tracking-widest uppercase text-white flex items-center gap-1.5">
              MAIK MT <span className="text-cyan-400 font-mono font-bold">STUDIO DSP</span>
            </h1>
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              [OBSIDIAN PRO]
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
            Suno AI Mastering • Dual 4096-FFT • LR4 Multiband • M/S Matrix • 4x True-Peak
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Live Mic / Audio Input Modal Trigger */}
        <button
          onClick={onOpenLiveMic}
          className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700/80 transition"
          title="Analizador en vivo mediante getUserMedia"
        >
          <Mic className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Mic / Live In</span>
        </button>

        {/* Gyro Tilt toggle */}
        {hasDeviceTilt && (
          <button
            onClick={onToggleTilt}
            className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
              tiltActive
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Activar o desactivar reacción háptica del giroscopio (DeviceOrientation)"
          >
            <Compass className={`w-3.5 h-3.5 ${tiltActive ? 'text-cyan-400' : 'text-slate-500'}`} />
            <span className="hidden md:inline">Giroscopio: {tiltActive ? 'ON' : 'OFF'}</span>
          </button>
        )}

        {/* Status Pill */}
        <span
          id="statusBadge"
          className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded border transition-colors ${colorClasses}`}
        >
          {status}
        </span>
      </div>
    </header>
  );
};
