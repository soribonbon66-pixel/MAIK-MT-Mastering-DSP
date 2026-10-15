import React from 'react';
import { Layers, Disc, FileText, Cpu, ArrowRight } from 'lucide-react';
import type { Prescription } from '../audio/dspLogic.ts';

interface DynamicsMatrixParams {
  mbLowThr: number;
  mbMidThr: number;
  mbHighThr: number;
  mbLowRat: number;
  mbMidRat: number;
  mbHighRat: number;
  targetLufs: number;
  msWidth: number;
  msMonoFreq: number;
  satDrive: number;
  ceilingDb: number;
}

interface DynamicsMatrixSectionProps {
  params: DynamicsMatrixParams;
  onChange: <K extends keyof DynamicsMatrixParams>(key: K, val: DynamicsMatrixParams[K]) => void;
  notes: string[];
  onApplyMaster: () => void;
  isProcessing: boolean;
}

export const DynamicsMatrixSection: React.FC<DynamicsMatrixSectionProps> = ({
  params,
  onChange,
  notes,
  onApplyMaster,
  isProcessing,
}) => {
  return (
    <div className="space-y-4">
      {/* 2 Dynamics Submodules: LR4 Multiband + M/S Limiter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* LR4 Multiband Dynamics */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-amber-300 font-bold uppercase text-[11px]">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Compresor Multibanda Linkwitz-Riley [LR4 3-Band]</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block truncate">LOW THR [&lt;180Hz]</label>
              <input
                id="mbLowThr"
                type="number"
                step="0.5"
                value={params.mbLowThr}
                onChange={(e) => onChange('mbLowThr', parseFloat(e.target.value) || 0)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block truncate">MID THR [180-3.2k]</label>
              <input
                id="mbMidThr"
                type="number"
                step="0.5"
                value={params.mbMidThr}
                onChange={(e) => onChange('mbMidThr', parseFloat(e.target.value) || 0)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block truncate">HIGH THR [&gt;3.2k]</label>
              <input
                id="mbHighThr"
                type="number"
                step="0.5"
                value={params.mbHighThr}
                onChange={(e) => onChange('mbHighThr', parseFloat(e.target.value) || 0)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block truncate">LOW RATIO</label>
              <input
                id="mbLowRat"
                type="number"
                step="0.1"
                min="1.0"
                max="8.0"
                value={params.mbLowRat}
                onChange={(e) => onChange('mbLowRat', parseFloat(e.target.value) || 1)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block truncate">MID RATIO</label>
              <input
                id="mbMidRat"
                type="number"
                step="0.1"
                min="1.0"
                max="8.0"
                value={params.mbMidRat}
                onChange={(e) => onChange('mbMidRat', parseFloat(e.target.value) || 1)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block truncate">HIGH RATIO</label>
              <input
                id="mbHighRat"
                type="number"
                step="0.1"
                min="1.0"
                max="8.0"
                value={params.mbHighRat}
                onChange={(e) => onChange('mbHighRat', parseFloat(e.target.value) || 1)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* M/S Matrix & True-Peak Limiter */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-purple-300 font-bold uppercase text-[11px]">
            <Disc className="w-3.5 h-3.5 text-purple-400" />
            <span>Matriz Mid/Side &amp; Limitador 4x True-Peak [M/S + ISP]</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block truncate">TARGET [LUFS]</label>
              <input
                id="targetLufsInput"
                type="number"
                step="0.5"
                min="-16"
                max="-6"
                value={params.targetLufs}
                onChange={(e) => onChange('targetLufs', parseFloat(e.target.value) || -9)}
                className="w-full mt-1 bg-slate-950 border border-cyan-500/50 rounded px-2 py-1 text-cyan-300 font-bold font-mono text-xs focus:ring-1 focus:ring-cyan-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block truncate">STEREO WIDTH [%]</label>
              <input
                id="msWidth"
                type="number"
                step="2"
                min="80"
                max="160"
                value={params.msWidth}
                onChange={(e) => onChange('msWidth', parseFloat(e.target.value) || 100)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block truncate">SUB MONO [Hz]</label>
              <input
                id="msMonoFreq"
                type="number"
                step="5"
                min="60"
                max="160"
                value={params.msMonoFreq}
                onChange={(e) => onChange('msMonoFreq', parseFloat(e.target.value) || 120)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block truncate">TAPE WARMTH [%]</label>
              <input
                id="satDrive"
                type="number"
                step="1"
                min="0"
                max="35"
                value={params.satDrive}
                onChange={(e) => onChange('satDrive', parseFloat(e.target.value) || 0)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block truncate">4x TP CEILING [dBTP]</label>
              <input
                id="ceilingDb"
                type="number"
                step="0.1"
                value={params.ceilingDb}
                onChange={(e) => onChange('ceilingDb', parseFloat(e.target.value) || -1.0)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Automated Diagnostic Log */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
          <span>Informe de Ingeniería MAIK MT [Automated Diagnostic Log]:</span>
        </div>
        <ul id="diagnosticList" className="text-xs text-slate-300 space-y-1 list-disc list-inside font-mono">
          {notes.map((note, idx) => (
            <li key={idx} className="leading-relaxed">{note}</li>
          ))}
        </ul>
      </div>

      {/* Primary Action Button */}
      <button
        id="applyMasterBtn"
        type="button"
        onClick={onApplyMaster}
        disabled={isProcessing}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition cursor-pointer flex items-center justify-center gap-2"
      >
        <Cpu className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
        <span>
          {isProcessing
            ? 'Procesando FFT Notches + LR4 Multiband + M/S + 4x True-Peak...'
            : 'Aceptar Cadena, Masterizar y Auditar [Run MAIK MT Studio DSP & QA]'}
        </span>
        {!isProcessing && <ArrowRight className="w-4 h-4" />}
      </button>
    </div>
  );
};
