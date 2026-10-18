import React, { useState } from 'react';
import { Download, CheckCircle2, BarChart3 } from 'lucide-react';
import { SpectrumCanvas } from './SpectrumCanvas.tsx';
import { BAND_DEFINITIONS, GENRE_PROFILES } from '../audio/dspLogic.ts';
import type { AudioMetrics, Prescription } from '../audio/dspLogic.ts';

interface VerificationSectionProps {
  preMetrics: AudioMetrics;
  postMetrics: AudioMetrics;
  targetLufs: number;
  ceilingDb: number;
  prescription: Prescription | null;
  onDownloadWav: () => void;
}

export const VerificationSection: React.FC<VerificationSectionProps> = ({
  preMetrics,
  postMetrics,
  targetLufs,
  ceilingDb,
  prescription,
  onDownloadWav,
}) => {
  const [normalizeLufs, setNormalizeLufs] = useState(true);


  const lufsDiff = Math.abs(postMetrics.integratedLufs - targetLufs);
  const lufsPass = lufsDiff <= 0.6;
  const peakPass = postMetrics.truePeakDb <= ceilingDb + 0.05;
  const phasePass = postMetrics.phaseCorr >= 0.40;

  const allPassed = lufsPass && peakPass && phasePass;

  const rows = [
    {
      name: 'Integrated Loudness [BS.1770-4]',
      pre: `${preMetrics.integratedLufs.toFixed(1)} LUFS`,
      target: `${targetLufs.toFixed(1)} LUFS (±0.6)`,
      post: `${postMetrics.integratedLufs.toFixed(1)} LUFS`,
      pass: lufsPass,
      status: lufsPass ? '[PASS]' : '[FAIL]',
      color: lufsPass ? 'emerald' : 'rose'
    },
    {
      name: '4x Oversampled True Peak',
      pre: `${preMetrics.truePeakDb.toFixed(2)} dBTP`,
      target: `Max ${ceilingDb.toFixed(2)} dBTP`,
      post: `${postMetrics.truePeakDb.toFixed(2)} dBTP`,
      pass: peakPass,
      status: peakPass ? '[PASS]' : '[FAIL]',
      color: peakPass ? 'emerald' : 'rose'
    },
    {
      name: 'Mid/Side Phase Correlation',
      pre: `+${preMetrics.phaseCorr.toFixed(2)}`,
      target: 'Min +0.40 (Mono Compatible)',
      post: `+${postMetrics.phaseCorr.toFixed(2)}`,
      pass: phasePass,
      status: phasePass ? '[PASS]' : '[WARNING]',
      color: phasePass ? 'emerald' : 'amber'
    },
  ];


  const offsets = prescription ? prescription.targetOffsets : GENRE_PROFILES.reggaeton.offsets;
  // Tonal targets are guidance; large mismatches must not be hidden by technical PASS.
  const spectralRows = BAND_DEFINITIONS.map((b) => {
    const pre = preMetrics.bandDb[b.id] ?? 0;
    const post = postMetrics.bandDb[b.id] ?? 0;
    const target = offsets[b.id] ?? 0;
    const error = post - target;
    return { ...b, pre, post, target, delta: post - pre, error, pass: Math.abs(error) <= 3.0 };
  });
  const spectralPass = spectralRows.every((band) => band.pass);
  const technicalPass = lufsPass && peakPass && phasePass && crestPass;
  const overallPass = technicalPass && spectralPass;

  return (
    <section
      id="verificationSection"
      className="obsidian-card rounded-2xl p-5 space-y-5 border border-emerald-500/30 shadow-2xl"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>3. Superposición FFT Pre/Post y Auditoría [Dual Spectrum &amp; QA Audit]</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Verificación de lazo cerrado sobre el audio masterizado y escucha A/B igualada en LUFS
          </p>
        </div>
        {allPassed ? (
        <span
          id="qaGlobalBadge"
          className={`text-xs font-mono font-bold px-3 py-1 rounded border shadow-sm ${overallPass ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}
        >
          {overallPass ? '[TECHNICAL + TONAL QA PASS]' : !technicalPass ? '[TECHNICAL QA REVIEW]' : '[TONAL QA REVIEW]'}
        </span>
      ) : (
        <span
          id="qaGlobalBadge"
          className="text-xs font-mono font-bold px-3 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm flex items-center gap-1"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          [QA FAILED - SEE BELOW]
        </span>
      )}
      </div>

      {/* Dual 4096-Pt Spectrum Overlay */}
      <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2.5 shadow-inner">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 block">
              Superposición Espectral Pre vs Post [Dual 4096-Pt FFT Overlay]
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Compara la respuesta en frecuencia antes y después del procesado DSP
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="text-cyan-400 font-bold">━ PRE [Original]</span>
              <span className="text-emerald-400 font-bold">━ POST [MAIK MT Master]</span>
            </div>
            <label className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 hover:border-emerald-500/40 px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-200 cursor-pointer select-none transition">
              <input
                type="checkbox"
                id="fftNormalizeToggle"
                checked={normalizeLufs}
                onChange={(e) => setNormalizeLufs(e.target.checked)}
                className="accent-emerald-400"
              />
              <span>[LUFS-Normalized Tilt View]</span>
            </label>
          </div>
        </div>

        <SpectrumCanvas
          preMetrics={preMetrics}
          postMetrics={postMetrics}
          normalizeLufs={normalizeLufs}
          height={200}
          id="fftDualCanvas"
        />
      </div>

      {/* QA Audit Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
              <th className="py-2.5">PARAMETER</th>
              <th className="py-2.5">PRE-MASTER</th>
              <th className="py-2.5">TARGET SPEC</th>
              <th className="py-2.5">POST-MASTER</th>
              <th className="py-2.5 text-right">QA STATUS</th>
            </tr>
          </thead>
          <tbody id="qaTableBody" className="divide-y divide-slate-800/70">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-900/40 transition">
                <td className="py-2.5 font-semibold text-slate-200">{r.name}</td>
                <td className="py-2.5 text-slate-400">{r.pre}</td>
                <td className="py-2.5 text-cyan-400">{r.target}</td>
                <td className="py-2.5 font-bold text-white">{r.post}</td>
                <td className="py-2.5 text-right">

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold bg-${r.color}-500/20 text-${r.color}-300 border border-${r.color}-500/30`}
                  >
                    {r.status}
                  </span>

                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Spectral Balance Pre vs Post Delta Bars */}
      <div className="space-y-2 bg-slate-900/70 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 uppercase">
          <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Balance espectral: post vs objetivo [tolerancia ±3 dB]</span>
        </div>
        <div id="spectralComparisonBars" className="space-y-2 pt-1">
          {spectralRows.map((b) => (
            <div key={b.id} className="text-[11px] font-mono border-b border-slate-800/40 pb-1.5">
              <div className="flex flex-wrap justify-between items-center gap-x-3 text-slate-300 mb-0.5">
                <span className="font-semibold">{b.name}</span>
                <span className="text-slate-400">
                  Pre: {b.pre.toFixed(1)} dB → Post: <b className="text-white">{b.post.toFixed(1)} dB</b>
                  {' '}· Objetivo: {b.target.toFixed(1)} dB
                  <span className={`ml-1.5 font-bold ${b.pass ? 'text-emerald-400' : 'text-amber-400'}`}>
                    [{b.error >= 0 ? '+' : ''}{b.error.toFixed(1)} dB vs objetivo]
                  </span>
                  <span className={`ml-2 font-bold ${b.pass ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {b.pass ? '[IN RANGE]' : '[REVIEW]'}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WAV 24-Bit Export Button */}
      <button
        id="downloadMasterBtn"
        type="button"
        onClick={onDownloadWav}
        className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition cursor-pointer flex items-center justify-center gap-2"
      >
        <Download className="w-4 h-4" />
        <span>Descargar MAIK MT Master WAV 24-Bit [Export Studio WAV]</span>
      </button>
    </section>
  );
};
