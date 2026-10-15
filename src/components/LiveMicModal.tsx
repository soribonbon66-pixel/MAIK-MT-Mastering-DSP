import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, X, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';

interface LiveMicModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveMicModal: React.FC<LiveMicModalProps> = ({ isOpen, onClose }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [livePeakDb, setLivePeakDb] = useState<number>(-90);
  const [liveRmsDb, setLiveRmsDb] = useState<number>(-90);
  const [detectedRoomFreq, setDetectedRoomFreq] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number | null>(null);

  const startMic = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsStreaming(true);
    } catch (err) {
      console.error('getUserMedia error:', err);
      setErrorMsg((err as Error).message || 'No se pudo acceder al micrófono o dispositivo de entrada.');
      setIsStreaming(false);
    }
  };

  const stopMic = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    setIsStreaming(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopMic();
      return;
    }

    startMic();

    return () => {
      stopMic();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isStreaming) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    if (!analyser) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 500;
    const H = canvas.clientHeight || 180;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Float32Array(bufferLength);
    const timeData = new Float32Array(bufferLength);

    const render = () => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      analyser.getFloatFrequencyData(freqData);
      analyser.getFloatTimeDomainData(timeData);

      // Compute peak and rms
      let peak = 0;
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const val = Math.abs(timeData[i]);
        if (val > peak) peak = val;
        sumSq += val * val;
      }
      const peakDb = 20 * Math.log10(Math.max(peak, 1e-5));
      const rmsDb = 10 * Math.log10(Math.max(sumSq / timeData.length, 1e-5));
      setLivePeakDb(peakDb);
      setLiveRmsDb(rmsDb);

      // Frequency grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const sr = audioCtxRef.current?.sampleRate || 44100;
      const binHz = sr / analyser.fftSize;

      // Find highest peak resonance in vocal/room range (100Hz to 6000Hz)
      let maxDb = -120;
      let maxFreq = 0;

      ctx.beginPath();
      let started = false;
      for (let i = 0; i < bufferLength; i++) {
        const f = i * binHz;
        if (f < 30 || f > 18000) continue;

        const db = freqData[i];
        if (f > 120 && f < 6000 && db > maxDb) {
          maxDb = db;
          maxFreq = Math.round(f);
        }

        const x = (Math.log10(f / 30) / Math.log10(18000 / 30)) * W;
        const normY = Math.max(0, Math.min(1, (db + 95) / 80));
        const y = H - normY * (H - 20) - 10;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      if (maxDb > -50) {
        setDetectedRoomFreq(maxFreq);
      } else {
        setDetectedRoomFreq(null);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isStreaming]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="obsidian-card w-full max-w-xl rounded-2xl p-5 border border-cyan-500/40 shadow-2xl space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Mic className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Analizador de Entrada en Vivo [getUserMedia API]
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Captura micrófono / interfaz para medir resonancias acústicas de sala en tiempo real
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopMic();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Canvas Display */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-cyan-400 font-bold">FFT ESPECTRO DE SALA / MIC</span>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">
                Peak:{' '}
                <b className={livePeakDb > -3 ? 'text-rose-400' : 'text-slate-200'}>
                  {livePeakDb > -80 ? `${livePeakDb.toFixed(1)} dBFS` : '-inf'}
                </b>
              </span>
              <span className="text-slate-400">
                RMS: <b className="text-slate-200">{liveRmsDb > -80 ? `${liveRmsDb.toFixed(1)} dBFS` : '-inf'}</b>
              </span>
            </div>
          </div>
          <canvas
            ref={canvasRef}
            className="w-full h-40 bg-slate-950 rounded block"
          />
        </div>

        {/* Live Detected Resonance */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">RESONANCIA DOMINANTE SALA</span>
            <span className="text-sm font-bold text-amber-300">
              {detectedRoomFreq ? `${detectedRoomFreq} Hz` : 'Esperando señal...'}
            </span>
          </div>
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">ESTADO AUDIO CONTEXT</span>
            <span className="text-sm font-bold text-cyan-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>{isStreaming ? 'Streaming Activo' : 'Detenido'}</span>
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {isStreaming ? (
            <button
              onClick={stopMic}
              className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <MicOff className="w-4 h-4" />
              <span>Pausar Mic</span>
            </button>
          ) : (
            <button
              onClick={startMic}
              className="py-2.5 px-4 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Iniciar Mic</span>
            </button>
          )}

          <button
            onClick={() => {
              stopMic();
              onClose();
            }}
            className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-bold transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
