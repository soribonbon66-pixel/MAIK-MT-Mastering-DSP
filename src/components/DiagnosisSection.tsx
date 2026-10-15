import React from 'react';
import { RotateCcw, AlertCircle, Sparkles, SlidersHorizontal, ShieldAlert } from 'lucide-react';
import { SpectrumCanvas } from './SpectrumCanvas.tsx';
import { BAND_DEFINITIONS } from '../audio/dspLogic.ts';
import type { AudioMetrics, Prescription, ResonanceCandidate } from '../audio/dspLogic.ts';

interface DiagnosisSectionProps {
  metrics: AudioMetrics;
  prescription: Prescription;
  eqGains: Record<string, number>;
  onEqGainChange: (bandId: string, gain: number) => void;
  enableNotches: boolean;
  onToggleNotches: (enabled: boolean) => void;
  notchCuts: number[];
  onNotchCutChange: (index: number, cut: number) => void;
  onResetPrescription: () => void;
}

export const DiagnosisSection: React.FC<DiagnosisSectionProps> = ({
  metrics,
  prescription,
  eqGains,
  onEqGainChange,
  enableNotches,
  onToggleNotches,
  notchCuts,
  onNotchCutChange,
  onResetPrescription,
}) => {
  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <span>2. Diagnóstico Acústico y Cadena MAIK MT [Pre-Master Diagnosis]</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Revisa el espectro FFT, las resonancias detectadas y confirma o ajusta los parámetros
          </p>
        </div>
        <span id="activeGenreBadge" className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded">
          [{prescription.profileLabel}]
        </span>
      </div>

      {/* 4 Essential Master Diagnosis Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-mono">
        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-sm">
          <span className="text-[10px] text-slate-400 block tracking-tight">INTEGRATED LUFS</span>
          <span id="preLufs" className="text-base sm:text-lg font-bold text-white">
            {metrics.integratedLufs.toFixed(1)} LUFS
          </span>
        </div>
        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-sm">
          <span className="text-[10px] text-slate-400 block tracking-tight">4x TRUE PEAK</span>
          <span id="prePeak" className="text-base sm:text-lg font-bold text-white">
            {metrics.truePeakDb.toFixed(2)} dBTP
          </span>
        </div>
        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-sm">
          <span className="text-[10px] text-slate-400 block tracking-tight">CREST FACTOR</span>
          <span id="preCrest" className="text-base sm:text-lg font-bold text-white">
            {metrics.crestDb.toFixed(1)} dB
          </span>
        </div>
        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-sm">
          <span className="text-[10px] text-slate-400 block tracking-tight">M/S PHASE CORR</span>
          <span id="prePhase" className="text-base sm:text-lg font-bold text-white">
            {metrics.phaseCorr.toFixed(2)}
          </span>
        </div>
      </div>

      {/* FFT 4096-Pt Spectrum Display */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
        <div className="flex flex-wrap justify-between items-center gap-2 text-[11px] font-mono">
          <span className="text-cyan-400 font-bold tracking-tight">
            ANALIZADOR ESPECTRAL FFT 4096-PT [PRE-MASTER + NOTCH HUNTER]
          </span>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-cyan-300">━ Pre-Master</span>
            <span className="text-rose-400">● Surgical Notches</span>
          </div>
        </div>
        <SpectrumCanvas preMetrics={metrics} height={180} id="fftCanvas" />
      </div>

      {/* AI Surgical Notch Filter Hunter */}
      <div className="bg-slate-900/75 border border-rose-500/30 rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-400">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Supresor Quirúrgico de Resonancias IA [3x High-Q Notch Filters]</span>
          </div>
          <label className="flex items-center gap-1.5 text-xs font-mono text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              id="enableNotches"
              checked={enableNotches}
              onChange={(e) => onToggleNotches(e.target.checked)}
              className="accent-rose-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>[Active]</span>
          </label>
        </div>

        <div id="notchContainer" className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
          {prescription.resonances.map((r, idx) => (
            <div key={idx} className="bg-slate-950/90 p-2.5 rounded-lg border border-rose-500/20 shadow-inner">
              <div className="flex justify-between text-rose-300 font-bold mb-1.5 text-[11px]">
                <span>NOTCH #{idx + 1} [{r.freq} Hz]</span>
                <span className="text-slate-400 font-normal">Q = {r.q.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[10px] shrink-0">Cut [dB]:</span>
                <input
                  type="number"
                  step="0.1"
                  max="0"
                  min="-9"
                  value={notchCuts[idx] !== undefined ? notchCuts[idx] : r.cutDb}
                  onChange={(e) => onNotchCutChange(idx, parseFloat(e.target.value) || 0)}
                  disabled={!enableNotches}
                  className="w-full bg-slate-900 border border-slate-700 disabled:opacity-40 rounded px-2 py-0.5 text-white font-mono text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6-Band Parametric EQ */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ecualizador Tonal de 6 Bandas [Genre-Calibrated Parametric EQ]</span>
          </div>
          <button
            type="button"
            id="resetPrescriptionBtn"
            onClick={onResetPrescription}
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 underline font-mono transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>[Reset to Genre Curve]</span>
          </button>
        </div>

        <div id="eqSlidersContainer" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          {BAND_DEFINITIONS.map((b) => {
            const gain = eqGains[b.id] ?? 0;
            return (
              <div key={b.id} className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-300">{b.name}</span>
                  <span
                    id={`val_${b.id}`}
                    className={`font-bold font-mono ${
                      gain > 0 ? 'text-cyan-400' : gain < 0 ? 'text-amber-400' : 'text-slate-400'
                    }`}
                  >
                    {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)} dB
                  </span>
                </div>
                <input
                  type="range"
                  id={`slider_${b.id}`}
                  min="-6"
                  max="6"
                  step="0.2"
                  value={gain}
                  onChange={(e) => onEqGainChange(b.id, parseFloat(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
