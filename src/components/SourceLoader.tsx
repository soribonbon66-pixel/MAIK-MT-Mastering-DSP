import React, { useRef, useState } from 'react';
import { UploadCloud, Music, Sparkles, Terminal, CheckCircle2 } from 'lucide-react';
import { GENRE_PROFILES } from '../audio/dspLogic.ts';

interface SourceLoaderProps {
  selectedGenre: string;
  onGenreChange: (genreKey: string) => void;
  onFileLoaded: (file: File) => void;
  onLoadDemoTrack: () => void;
  fileName: string | null;
  sampleRate: number | null;
  duration: number | null;
  channels: number | null;
  logs: string[];
  isLoading: boolean;
}

export const SourceLoader: React.FC<SourceLoaderProps> = ({
  selectedGenre,
  onGenreChange,
  onFileLoaded,
  onLoadDemoTrack,
  fileName,
  sampleRate,
  duration,
  channels,
  logs,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const activeProfile = GENRE_PROFILES[selectedGenre] || GENRE_PROFILES.reggaeton;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileLoaded(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileLoaded(e.target.files[0]);
    }
  };

  return (
    <section className="obsidian-card rounded-2xl p-5 space-y-4">
      {/* Genre profile header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-400">
              1. Cargar Pista y Perfil [Source WAV &amp; Genre Curve]
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              {activeProfile.targetLufs.toFixed(1)} LUFS
            </span>
          </div>
          <p id="genreDescLabel" className="text-[11px] text-slate-400 font-mono mt-1">
            {activeProfile.desc}
          </p>
        </div>

        <select
          id="genreSelect"
          value={selectedGenre}
          onChange={(e) => onGenreChange(e.target.value)}
          className="bg-slate-900 border border-cyan-500/40 text-xs rounded-xl px-3 py-2 text-cyan-200 font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer shadow-md"
        >
          {Object.entries(GENRE_PROFILES).map(([key, prof]) => (
            <option key={key} value={key} className="bg-slate-950 text-slate-200">
              {prof.label} [{prof.targetLufs.toFixed(1)} LUFS]
            </option>
          ))}
        </select>
      </div>

      {/* Upload Zone & Demo Button Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`md:col-span-2 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-5 cursor-pointer transition select-none ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/20'
              : 'border-slate-700/80 hover:border-cyan-400/80 bg-slate-900/40'
          }`}
        >
          <UploadCloud className="w-8 h-8 text-cyan-400 mb-2" />
          <span className="text-sm font-semibold text-white text-center" id="fileNameLabel">
            {fileName ? `Cargado: ${fileName}` : 'Toca aquí o arrastra tu archivo WAV / MP3 de Suno'}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 font-mono text-center">
            [Android Safe Touch Loader • 32-Bit Float Decoded Audio]
          </span>
          <input
            ref={fileInputRef}
            type="file"
            id="audioInput"
            accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Instant Suno Demo Generator */}
        <div className="flex flex-col justify-between bg-gradient-to-br from-slate-900/90 to-slate-950 p-4 rounded-xl border border-cyan-500/30">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-cyan-300 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Suno AI Synth Demo</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Genera una pista de prueba con dembow, mud en 310Hz y asperezas en 3.8kHz para auditar el DSP al instante.
            </p>
          </div>

          <button
            type="button"
            onClick={onLoadDemoTrack}
            disabled={isLoading}
            className="mt-3 w-full py-2 px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 font-mono text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <Music className="w-3.5 h-3.5" />
            <span>Cargar Pista Demo</span>
          </button>
        </div>
      </div>

      {/* Metadata Chips */}
      {sampleRate && duration && (
        <div id="sourceMeta" className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <div>
            <span className="text-slate-500 block text-[10px]">SAMPLE RATE</span>
            <span id="metaSR" className="text-white font-bold">{sampleRate} Hz</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">DURATION</span>
            <span id="metaDur" className="text-white font-bold">{duration.toFixed(1)} s</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">CHANNELS</span>
            <span id="metaCh" className="text-white font-bold">
              {channels === 2 ? 'Stereo [M/S Ready]' : 'Mono [1ch]'}
            </span>
          </div>
        </div>
      )}

      {/* Collapsible Mobile Debug Console */}
      <div className="pt-1">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 hover:text-slate-200 transition"
        >
          <Terminal className="w-3 h-3 text-cyan-400" />
          <span>{showLogs ? 'Ocultar Terminal de Sistema' : 'Ver Registro de Eventos [System Log]'}</span>
          <span className="text-slate-600">({logs.length} eventos)</span>
        </button>

        {showLogs && (
          <div
            id="mobileLogBox"
            className="mt-2 p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-mono text-cyan-300 max-h-24 overflow-y-auto"
          >
            {logs.map((log, idx) => (
              <div key={idx} className="leading-tight">{log}</div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
