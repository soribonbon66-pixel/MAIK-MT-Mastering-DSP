import React from 'react';
import { Play, Pause, Volume2, ShieldCheck, Headphones } from 'lucide-react';
import { LiveGoniometer } from './LiveGoniometer.tsx';

interface ABDeckProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  activeMode: 'A' | 'B';
  onSwitchMode: (mode: 'A' | 'B') => void;
  loudnessMatch: boolean;
  onToggleLoudnessMatch: (enabled: boolean) => void;
  currentTime: number;
  duration: number;
  onSeek: (timeSec: number) => void;
  compensationInfo: { text: string; color: string };
  analyserL: AnalyserNode | null;
  analyserR: AnalyserNode | null;
}

export const ABDeck: React.FC<ABDeckProps> = ({
  isPlaying,
  onTogglePlay,
  activeMode,
  onSwitchMode,
  loudnessMatch,
  onToggleLoudnessMatch,
  currentTime,
  duration,
  onSeek,
  compensationInfo,
  analyserL,
  analyserR,
}) => {
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1).padStart(4, '0');
    return `${String(m).padStart(2, '0')}:${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-slate-950/95 border border-cyan-500/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
      {/* Deck Header & Loudness Match Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Headphones className="w-4 h-4 text-cyan-400" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-300">
              Consola de Escucha A/B en Tiempo Real [Phase-Locked A/B Deck]
            </span>
          </div>
          <span id="abCompensationInfo" className={`text-[11px] font-mono mt-0.5 block ${compensationInfo.color}`}>
            {compensationInfo.text}
          </span>
        </div>

        <label className="flex items-center gap-2 bg-slate-900 border border-slate-700 hover:border-cyan-500/50 px-3 py-1.5 rounded-xl cursor-pointer select-none transition">
          <input
            type="checkbox"
            id="abLoudnessMatchToggle"
            checked={loudnessMatch}
            onChange={(e) => onToggleLoudnessMatch(e.target.checked)}
            className="accent-emerald-400 w-4 h-4 cursor-pointer"
          />
          <span className="text-xs font-mono font-semibold text-slate-200">
            Igualar Volumen [LUFS Match]
          </span>
        </label>
      </div>

      {/* Main Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
        {/* Buttons Row */}
        <div className="lg:col-span-2 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Play / Pause */}
            <button
              id="abPlayPauseBtn"
              type="button"
              onClick={onTogglePlay}
              className="py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs font-mono uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'Pause Audition' : 'Play Audition [Sync]'}</span>
            </button>

            {/* Stream A Button */}
            <button
              id="abBtnA"
              type="button"
              onClick={() => onSwitchMode('A')}
              className={`py-3 px-4 rounded-xl border font-mono text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                activeMode === 'A'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              A: Original [Source WAV]
            </button>

            {/* Stream B Button */}
            <button
              id="abBtnB"
              type="button"
              onClick={() => onSwitchMode('B')}
              className={`py-3 px-4 rounded-xl border font-mono text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                activeMode === 'B'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              B: MAIK MT Master [Active]
            </button>
          </div>

          {/* Scrub Slider & Time readout */}
          <div className="space-y-1.5 pt-1">
            <input
              type="range"
              id="abSeekSlider"
              min="0"
              max="100"
              step="0.1"
              value={progressPercent}
              onChange={(e) => onSeek((parseFloat(e.target.value) / 100) * duration)}
              className="w-full cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none accent-cyan-400"
            />
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span id="abCurrentTime">{formatTime(currentTime)}</span>
              <span
                id="abActiveStreamLabel"
                className={`font-bold ${activeMode === 'B' ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                {activeMode === 'B'
                  ? '[AUDITIONING: B - MAIK MT MASTER]'
                  : '[AUDITIONING: A - ORIGINAL SOURCE]'}
              </span>
              <span id="abTotalTime">{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Real-time Goniometer Vector Scope */}
        <div className="w-full">
          <LiveGoniometer
            analyserL={analyserL}
            analyserR={analyserR}
            isPlaying={isPlaying}
            activeMode={activeMode}
          />
        </div>
      </div>
    </div>
  );
};
