import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { SourceLoader } from './components/SourceLoader.tsx';
import { DiagnosisSection } from './components/DiagnosisSection.tsx';
import { DynamicsMatrixSection } from './components/DynamicsMatrixSection.tsx';
import { VerificationSection } from './components/VerificationSection.tsx';
import { ABDeck } from './components/ABDeck.tsx';
import { LiveMicModal } from './components/LiveMicModal.tsx';
import { PresetManager } from './components/PresetManager.tsx';
import { useDeviceTilt } from './hooks/useDeviceTilt.ts';
import {
  GENRE_PROFILES,
  BAND_DEFINITIONS,
  analyzeAudioBuffer,
  computeSunoPrescription,
  bufferToWav24BitTPDF,
  generateSunoDemoBuffer,
  evalTruePeakPolyphase4x,
} from './audio/dspLogic.ts';
import type { AudioMetrics, Prescription } from './audio/dspLogic.ts';
import {
  getStoredPresets,
  savePreset,
  deletePreset,
} from './audio/presetStorage.ts';
import type { MasteringPreset } from './audio/presetStorage.ts';

export default function App() {
  // Global Audio Buffers & Metrics
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [masteredBuffer, setMasteredBuffer] = useState<AudioBuffer | null>(null);
  const [preMetrics, setPreMetrics] = useState<AudioMetrics | null>(null);
  const [postMetrics, setPostMetrics] = useState<AudioMetrics | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);

  // File metadata
  const [fileName, setFileName] = useState<string | null>(null);
  const [sampleRate, setSampleRate] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [channels, setChannels] = useState<number | null>(null);

  // Status & Logs
  const [status, setStatus] = useState<string>('[IDLE]');
  const [statusColor, setStatusColor] = useState<'slate' | 'cyan' | 'amber' | 'emerald' | 'rose'>('slate');
  const [logs, setLogs] = useState<string[]>(['[System Log Initialized]']);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Settings State
  const [selectedGenre, setSelectedGenre] = useState<string>('reggaeton');
  const [eqGains, setEqGains] = useState<Record<string, number>>({});
  const [enableNotches, setEnableNotches] = useState(true);
  const [notchCuts, setNotchCuts] = useState<number[]>([]);

  // Dynamics & Limiter State
  const [dynamicsParams, setDynamicsParams] = useState({
    mbLowThr: -18.5,
    mbMidThr: -16.5,
    mbHighThr: -18.5,
    mbLowRat: 3.2,
    mbMidRat: 2.3,
    mbHighRat: 2.4,
    targetLufs: -8.5,
    msWidth: 114,
    msMonoFreq: 120,
    satDrive: 13,
    ceilingDb: -1.0,
  });

  // A/B Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeMode, setActiveMode] = useState<'A' | 'B'>('B');
  const [loudnessMatch, setLoudnessMatch] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  // Presets State
  const [presets, setPresets] = useState<MasteringPreset[]>(() => getStoredPresets());
  const [activePresetId, setActivePresetId] = useState<string | null>('factory_reggaeton_signature');

  // Modals & Tilt
  const [isMicModalOpen, setIsMicModalOpen] = useState(false);
  const { tilt, toggleTilt } = useDeviceTilt();

  // Invalidate master and QA if parameters change after a render
  useEffect(() => {
    if (masteredBuffer) {
      setMasteredBuffer(null);
      setPostMetrics(null);
      updateStatus('[PARAMS CHANGED - RE-RENDER REQUIRED]', 'amber');
      logMobile('Parameters modified. Previous master invalidated.');
    }
  }, [eqGains, enableNotches, notchCuts, dynamicsParams]);


  // Web Audio Contexts & References
  const globalAudioCtxRef = useRef<AudioContext | null>(null);
  const abCtxRef = useRef<AudioContext | null>(null);
  const abSrcARef = useRef<AudioBufferSourceNode | null>(null);
  const abSrcBRef = useRef<AudioBufferSourceNode | null>(null);
  const abGainARef = useRef<GainNode | null>(null);
  const abGainBRef = useRef<GainNode | null>(null);
  const abAnalyserLRef = useRef<AnalyserNode | null>(null);
  const abAnalyserRRef = useRef<AnalyserNode | null>(null);
  const abStartTimeRef = useRef(0);
  const abPauseOffsetRef = useRef(0);
  const abAnimIdRef = useRef<number | null>(null);

  const logMobile = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
    console.log(msg);
  }, []);

  const updateStatus = useCallback(
    (text: string, color: 'slate' | 'cyan' | 'amber' | 'emerald' | 'rose' = 'slate') => {
      setStatus(text);
      setStatusColor(color);
    },
    []
  );

  // Ensure AudioContext is ready and resumed
  const getAudioContext = useCallback(() => {
    if (!globalAudioCtxRef.current) {
      globalAudioCtxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (globalAudioCtxRef.current.state === 'suspended') {
      globalAudioCtxRef.current.resume();
    }
    return globalAudioCtxRef.current;
  }, []);

  // Sync Prescription with UI Controls
  const applyPrescriptionToUI = useCallback(
    (presc: Prescription) => {
      setPrescription(presc);
      setEqGains({ ...presc.eqGains });
      setNotchCuts(presc.resonances.map((r) => r.cutDb));
      setDynamicsParams({
        mbLowThr: presc.mbLowThr,
        mbMidThr: presc.mbMidThr,
        mbHighThr: presc.mbHighThr,
        mbLowRat: presc.mbLowRat,
        mbMidRat: presc.mbMidRat,
        mbHighRat: presc.mbHighRat,
        targetLufs: presc.targetLufs,
        msWidth: presc.msWidth,
        msMonoFreq: presc.msMonoFreq,
        satDrive: presc.satDrive,
        ceilingDb: presc.ceilingDb,
      });
    },
    []
  );

  // Handle Genre Change
  const handleGenreChange = useCallback(
    (genreKey: string) => {
      setSelectedGenre(genreKey);
      if (preMetrics) {
        const newPresc = computeSunoPrescription(preMetrics, genreKey);
        applyPrescriptionToUI(newPresc);
      }
    },
    [preMetrics, applyPrescriptionToUI]
  );

  // Reset to active genre curve
  const handleResetPrescription = useCallback(() => {
    if (preMetrics) {
      const newPresc = computeSunoPrescription(preMetrics, selectedGenre);
      applyPrescriptionToUI(newPresc);
    }
  }, [preMetrics, selectedGenre, applyPrescriptionToUI]);

  // Apply a signature preset
  const handleApplyPreset = useCallback(
    (preset: MasteringPreset) => {
      setActivePresetId(preset.id);
      setSelectedGenre(preset.genreKey);
      setEqGains({ ...preset.eqGains });
      setEnableNotches(preset.enableNotches);
      if (preset.notchCuts && preset.notchCuts.length > 0) {
        setNotchCuts([...preset.notchCuts]);
      }
      setDynamicsParams({ ...preset.dynamics });

      logMobile(`Preset aplicado: "${preset.name}" (${preset.dynamics.targetLufs} LUFS)`);
      updateStatus(`[PRESET: ${preset.name.slice(0, 15).toUpperCase()}]`, 'cyan');
    },
    [logMobile, updateStatus]
  );

  // Save current settings as a new custom preset
  const handleSavePreset = useCallback(
    (name: string, description: string) => {
      const newPreset: MasteringPreset = {
        id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        genreKey: selectedGenre,
        description,
        isFactory: false,
        createdAt: Date.now(),
        eqGains: { ...eqGains },
        enableNotches,
        notchCuts: [...notchCuts],
        dynamics: { ...dynamicsParams },
      };

      const updated = savePreset(newPreset);
      setPresets(updated);
      setActivePresetId(newPreset.id);
      logMobile(`Preset de firma guardado: "${name}"`);
    },
    [selectedGenre, eqGains, enableNotches, notchCuts, dynamicsParams, logMobile]
  );

  // Delete a user preset
  const handleDeletePreset = useCallback(
    (presetId: string) => {
      const updated = deletePreset(presetId);
      setPresets(updated);
      if (activePresetId === presetId) {
        setActivePresetId(null);
      }
      logMobile(`Preset eliminado de la biblioteca.`);
    },
    [activePresetId, logMobile]
  );

  // Reload presets from storage
  const handleRefreshPresets = useCallback(() => {
    setPresets(getStoredPresets());
  }, []);

  // Decode and analyze audio buffer
  const handleBufferLoaded = useCallback(
    async (buffer: AudioBuffer, name: string) => {
      stopPlayback(true);
      setOriginalBuffer(buffer);
      setMasteredBuffer(null);
      setPostMetrics(null);
      setFileName(name);
      setSampleRate(buffer.sampleRate);
      setDuration(buffer.duration);
      setChannels(buffer.numberOfChannels);

      updateStatus('[RUNNING 4096-PT FFT...]', 'amber');
      logMobile(`Audio buffer loaded: ${buffer.numberOfChannels}ch, ${buffer.sampleRate}Hz, ${buffer.duration.toFixed(1)}s`);

      try {
        const metrics = await analyzeAudioBuffer(buffer);
        setPreMetrics(metrics);
        logMobile(`FFT complete. Integrated LUFS: ${metrics.integratedLufs.toFixed(1)}, Peak: ${metrics.truePeakDb.toFixed(2)} dBTP`);

        const presc = computeSunoPrescription(metrics, selectedGenre);
        applyPrescriptionToUI(presc);

        updateStatus('[READY FOR APPROVAL]', 'emerald');
      } catch (err) {
        console.error('Error analyzing audio:', err);
        updateStatus('[ANALYSIS ERROR]', 'rose');
        logMobile(`Analysis Error: ${(err as Error).message}`);
      }
    },
    [selectedGenre, applyPrescriptionToUI, logMobile, updateStatus]
  );

  // File Upload Handler
  const handleFileLoaded = useCallback(
    async (file: File) => {
      setIsLoading(true);
      updateStatus('[DECODING AUDIO...]', 'cyan');
      logMobile(`Reading file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);

      try {
        const ctx = getAudioContext();
        const arrayBuf = await file.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuf);
        await handleBufferLoaded(decoded, file.name.replace(/\.[^/.]+$/, ''));
      } catch (err) {
        console.error('Decode error:', err);
        updateStatus('[DECODE ERROR]', 'rose');
        logMobile(`Decode Error: ${(err as Error).message}`);
        alert(`Error al decodificar el archivo: ${(err as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [getAudioContext, handleBufferLoaded, logMobile, updateStatus]
  );

  // Load Synthesized Suno Demo Track
  const handleLoadDemoTrack = useCallback(async () => {
    setIsLoading(true);
    updateStatus('[SYNTHESIZING DEMO...]', 'cyan');
    logMobile('Synthesizing Suno AI Dembow demo track with 310Hz boxiness and 3850Hz resonance...');

    try {
      const ctx = getAudioContext();
      const demoBuffer = generateSunoDemoBuffer(ctx, 8);
      await handleBufferLoaded(demoBuffer, 'suno_ai_dembow_demo');
    } catch (err) {
      console.error('Demo error:', err);
      updateStatus('[SYNTH ERROR]', 'rose');
    } finally {
      setIsLoading(false);
    }
  }, [getAudioContext, handleBufferLoaded, logMobile, updateStatus]);

  // A/B Player Audio Routing & Loudness Gain Calculation
  const computeABGains = useCallback(() => {
    if (!preMetrics || !postMetrics) return { gA: 1.0, gB: 1.0 };

    if (!loudnessMatch) {
      return { gA: 1.0, gB: 1.0 };
    }

    const diffDb = postMetrics.integratedLufs - preMetrics.integratedLufs;
    if (diffDb >= 0) {
      const attenDb = -diffDb;
      return { gA: 1.0, gB: Math.pow(10, attenDb / 20.0) };
    } else {
      const attenDb = diffDb;
      return { gA: Math.pow(10, attenDb / 20.0), gB: 1.0 };
    }
  }, [preMetrics, postMetrics, loudnessMatch]);

  const updateABRoutingGains = useCallback(() => {
    const { gA, gB } = computeABGains();
    if (abCtxRef.current && abGainARef.current && abGainBRef.current) {
      const now = abCtxRef.current.currentTime;
      abGainARef.current.gain.setTargetAtTime(activeMode === 'A' ? gA : 0.0, now, 0.012);
      abGainBRef.current.gain.setTargetAtTime(activeMode === 'B' ? gB : 0.0, now, 0.012);
    }
  }, [computeABGains, activeMode]);

  useEffect(() => {
    updateABRoutingGains();
  }, [activeMode, loudnessMatch, updateABRoutingGains]);

  const stopPlayback = useCallback((resetOffset = false) => {
    if (abSrcARef.current) {
      try {
        abSrcARef.current.stop();
        abSrcARef.current.disconnect();
      } catch {}
      abSrcARef.current = null;
    }
    if (abSrcBRef.current) {
      try {
        abSrcBRef.current.stop();
        abSrcBRef.current.disconnect();
      } catch {}
      abSrcBRef.current = null;
    }
    if (abAnimIdRef.current) {
      cancelAnimationFrame(abAnimIdRef.current);
      abAnimIdRef.current = null;
    }
    if (abCtxRef.current && !resetOffset) {
      abPauseOffsetRef.current = Math.min(
        duration || 0,
        abPauseOffsetRef.current + (abCtxRef.current.currentTime - abStartTimeRef.current)
      );
    }
    if (resetOffset) {
      abPauseOffsetRef.current = 0;
      setCurrentTime(0);
    }
    setIsPlaying(false);
  }, [duration]);

  const startPlayback = useCallback(
    (offsetSec = abPauseOffsetRef.current) => {
      if (!originalBuffer || !masteredBuffer) return;
      stopPlayback(false);

      if (!abCtxRef.current) {
        abCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = abCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const dur = originalBuffer.duration;
      const safeOffset = Math.max(0, Math.min(dur - 0.05, offsetSec));
      abPauseOffsetRef.current = safeOffset;

      const srcA = ctx.createBufferSource();
      const srcB = ctx.createBufferSource();
      srcA.buffer = originalBuffer;
      srcB.buffer = masteredBuffer;

      const gainA = ctx.createGain();
      const gainB = ctx.createGain();

      const { gA, gB } = computeABGains();
      gainA.gain.value = activeMode === 'A' ? gA : 0.0;
      gainB.gain.value = activeMode === 'B' ? gB : 0.0;

      // Master output bus for analyser
      const masterBus = ctx.createGain();
      masterBus.gain.value = 1.0;

      // Stereo splitter for Goniometer
      const splitter = ctx.createChannelSplitter(2);
      const anL = ctx.createAnalyser();
      const anR = ctx.createAnalyser();
      anL.fftSize = 512;
      anR.fftSize = 512;

      srcA.connect(gainA);
      srcB.connect(gainB);
      gainA.connect(masterBus);
      gainB.connect(masterBus);

      masterBus.connect(ctx.destination);
      masterBus.connect(splitter);
      splitter.connect(anL, 0);
      splitter.connect(anR, 1);

      abSrcARef.current = srcA;
      abSrcBRef.current = srcB;
      abGainARef.current = gainA;
      abGainBRef.current = gainB;
      abAnalyserLRef.current = anL;
      abAnalyserRRef.current = anR;

      abStartTimeRef.current = ctx.currentTime;
      srcA.start(0, safeOffset);
      srcB.start(0, safeOffset);
      setIsPlaying(true);

      const tick = () => {
        if (!abCtxRef.current) return;
        const cur = abPauseOffsetRef.current + (abCtxRef.current.currentTime - abStartTimeRef.current);
        if (cur >= dur) {
          stopPlayback(true);
          return;
        }
        setCurrentTime(cur);
        abAnimIdRef.current = requestAnimationFrame(tick);
      };
      abAnimIdRef.current = requestAnimationFrame(tick);
    },
    [originalBuffer, masteredBuffer, computeABGains, activeMode, stopPlayback]
  );

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      stopPlayback(false);
    } else {
      startPlayback(abPauseOffsetRef.current);
    }
  }, [isPlaying, stopPlayback, startPlayback]);

  const handleSeek = useCallback(
    (timeSec: number) => {
      setCurrentTime(timeSec);
      abPauseOffsetRef.current = timeSec;
      if (isPlaying) {
        startPlayback(timeSec);
      }
    },
    [isPlaying, startPlayback]
  );

  // Full MAIK MT Mastering Processing Pipeline
  const processMasterAndVerify = async () => {
    if (!originalBuffer) return;
    stopPlayback(true);
    setIsProcessing(true);
    updateStatus('[RENDERING MAIK MT DSP...]', 'cyan');
    logMobile('Starting full 32-bit float offline mastering render...');

    await new Promise((r) => setTimeout(r, 60));

    try {
      const sr = originalBuffer.sampleRate;
      const len = originalBuffer.length;
      const chCount = originalBuffer.numberOfChannels;

      const {
        mbLowThr,
        mbMidThr,
        mbHighThr,
        mbLowRat,
        mbMidRat,
        mbHighRat,
        targetLufs,
        msWidth,
        msMonoFreq,
        satDrive,
        ceilingDb,
      } = dynamicsParams;

      const offCtx = new OfflineAudioContext(chCount, len, sr);
      const src = offCtx.createBufferSource();
      src.buffer = originalBuffer;

      // 1. High-Pass Clean (30Hz Butterworth)
      const subHpf = offCtx.createBiquadFilter();
      subHpf.type = 'highpass';
      subHpf.frequency.value = 30;
      subHpf.Q.value = 0.7071;
      src.connect(subHpf);
      let lastNode: AudioNode = subHpf;

      // 2. 6-Band Parametric EQ
      BAND_DEFINITIONS.forEach((b) => {
        const eq = offCtx.createBiquadFilter();
        eq.type = b.type;
        eq.frequency.value = b.freq;
        eq.Q.value = b.q;
        eq.gain.value = eqGains[b.id] ?? 0;
        lastNode.connect(eq);
        lastNode = eq;
      });

      // 3. 3x High-Q Surgical Notches
      if (enableNotches && prescription && prescription.resonances) {
        prescription.resonances.forEach((r, idx) => {
          const cut = notchCuts[idx] !== undefined ? notchCuts[idx] : r.cutDb;
          const notch = offCtx.createBiquadFilter();
          notch.type = 'peaking';
          notch.frequency.value = r.freq;
          notch.Q.value = r.q;
          notch.gain.value = cut;
          lastNode.connect(notch);
          lastNode = notch;
        });
      }


      // 4. Linkwitz-Riley LR4 3-Band Multiband Compressor
      const createLR4 = (type: BiquadFilterType, freq: number) => {
        const f1 = offCtx.createBiquadFilter();
        const f2 = offCtx.createBiquadFilter();
        f1.type = type;
        f1.frequency.value = freq;
        f1.Q.value = 0.7071; // Butterworth * 2 = LR4
        f2.type = type;
        f2.frequency.value = freq;
        f2.Q.value = 0.7071;
        f1.connect(f2);
        return { input: f1, output: f2 };
      };

      // Correct 3-Way LR4 Crossover Topology
      // Low Band: LP1(180Hz) -> AP2(3200Hz) to match phase of upper split
      // Mid Band: HP1(180Hz) -> LP2(3200Hz)
      // High Band: HP1(180Hz) -> HP2(3200Hz)

      const split1LP = createLR4('lowpass', 180);
      const split1HP = createLR4('highpass', 180);

      const split2AP = createLR4('allpass', 3200); // Phase compensation for low band
      const split2LP = createLR4('lowpass', 3200);
      const split2HP = createLR4('highpass', 3200);

      lastNode.connect(split1LP.input);
      lastNode.connect(split1HP.input);

      split1LP.output.connect(split2AP.input);
      split1HP.output.connect(split2LP.input);
      split1HP.output.connect(split2HP.input);

      const compLow = offCtx.createDynamicsCompressor();
      compLow.threshold.value = mbLowThr;
      compLow.ratio.value = mbLowRat;
      compLow.knee.value = 5;
      compLow.attack.value = 0.025;
      compLow.release.value = 0.16;

      const compMid = offCtx.createDynamicsCompressor();
      compMid.threshold.value = mbMidThr;
      compMid.ratio.value = mbMidRat;
      compMid.knee.value = 6;
      compMid.attack.value = 0.012;
      compMid.release.value = 0.11;

      const compHigh = offCtx.createDynamicsCompressor();
      compHigh.threshold.value = mbHighThr;
      compHigh.ratio.value = mbHighRat;
      compHigh.knee.value = 6;
      compHigh.attack.value = 0.005;
      compHigh.release.value = 0.075;

      const sumBus = offCtx.createGain();
      sumBus.gain.value = 1.0;

      split2AP.output.connect(compLow);
      compLow.connect(sumBus);

      split2LP.output.connect(compMid);
      compMid.connect(sumBus);

      split2HP.output.connect(compHigh);
      compHigh.connect(sumBus);


      sumBus.connect(offCtx.destination);
      src.start(0);

      const stageBuffer = await offCtx.startRendering();


      // 5. Mid/Side Matrix & Tape Warmth Saturation
      const driveK = (satDrive / 100.0) * 2.2;
      const tanhNorm = driveK > 0 ? Math.tanh(1 + driveK) : 1.0;
      const saturate = (x: number) => (driveK > 0 ? Math.tanh(x * (1 + driveK)) / tanhNorm : x);

      if (chCount > 1) {
        const L = stageBuffer.getChannelData(0);
        const R = stageBuffer.getChannelData(1);
        const rc = 1.0 / (2.0 * Math.PI * msMonoFreq);
        const dt = 1.0 / sr;
        const alpha = rc / (rc + dt);
        let sIn1 = 0, sOut1 = 0;
        let sIn2 = 0, sOut2 = 0;
        const widthCoeff = msWidth / 100.0;

        for (let i = 0; i < len; i++) {
          let mid = 0.5 * (L[i] + R[i]);
          let side = 0.5 * (L[i] - R[i]);

          // 2-pole 12dB/octave highpass on Side channel for Sub Mono cutoff
          const hp1 = alpha * (sOut1 + side - sIn1);
          sIn1 = side;
          sOut1 = hp1;

          const hp2 = alpha * (sOut2 + hp1 - sIn2);
          sIn2 = hp1;
          sOut2 = hp2;

          side = hp2 * widthCoeff;

          // Reconstruct to L/R *before* saturation to preserve natural stereo image correlation
          let l = mid + side;
          let r = mid - side;

          L[i] = saturate(l);
          R[i] = saturate(r);
        }
      } else {
        const M = stageBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) M[i] = saturate(M[i]);
      }



      // 6. Loudness Calibration & Lookahead 4x Polyphase True Peak Limiter
      const midMetrics = await analyzeAudioBuffer(stageBuffer);
      const neededGainDb = Math.min(14.0, Math.max(-14.0, targetLufs - midMetrics.integratedLufs));
      const linearGain = Math.pow(10, neededGainDb / 20.0);
      const ceilingLin = Math.pow(10, ceilingDb / 20.0);

      const finalCtx = getAudioContext();
      const finalBuffer = finalCtx.createBuffer(chCount, len, sr);
      const channelsArray: Float32Array[] = [];
      for (let c = 0; c < chCount; c++) {
        const inD = stageBuffer.getChannelData(c);
        const outD = finalBuffer.getChannelData(c);
        for (let i = 0; i < len; i++) outD[i] = inD[i] * linearGain;
        channelsArray.push(outD);
      }


      // Calculate True Peak required gain envelope using Polyphase filter
      const reqGain = new Float32Array(len);
      const histBuffer = new Float32Array(12 * chCount); // history per channel

      for (let i = 0; i < len; i++) {
        let maxISP = 0;
        for (let c = 0; c < chCount; c++) {
          const ch = channelsArray[c];
          const cOffset = c * 12;

          // shift history manually
          histBuffer[cOffset + 11] = histBuffer[cOffset + 10];
          histBuffer[cOffset + 10] = histBuffer[cOffset + 9];
          histBuffer[cOffset + 9] = histBuffer[cOffset + 8];
          histBuffer[cOffset + 8] = histBuffer[cOffset + 7];
          histBuffer[cOffset + 7] = histBuffer[cOffset + 6];
          histBuffer[cOffset + 6] = histBuffer[cOffset + 5];
          histBuffer[cOffset + 5] = histBuffer[cOffset + 4];
          histBuffer[cOffset + 4] = histBuffer[cOffset + 3];
          histBuffer[cOffset + 3] = histBuffer[cOffset + 2];
          histBuffer[cOffset + 2] = histBuffer[cOffset + 1];
          histBuffer[cOffset + 1] = histBuffer[cOffset + 0];
          histBuffer[cOffset + 0] = ch[i]; // Insert newest

          let tp = 0;
          if (i >= 11) {
              // Instead of creating a view, we do the polyphase filter inline or extract the buffer manually
              const chHist = histBuffer.subarray(cOffset, cOffset + 12);
              tp = evalTruePeakPolyphase4x(chHist);
          } else {
              tp = Math.abs(ch[i]);
          }
          if (tp > maxISP) maxISP = tp;
        }
        reqGain[i] = maxISP > ceilingLin * 0.992 ? (ceilingLin * 0.992) / maxISP : 1.0;
      }

      // O(N) Sliding Window Minimum Filter for Lookahead + Exponential Release
      const lookahead = Math.max(2, Math.floor(sr * 0.003));
      const relCoeff = Math.exp(-1.0 / (sr * 0.065));
      const envBuffer = new Float32Array(len);

      // We process backwards or use a deque for true O(N) sliding minimum.
      // We will use a fast 2-pass approach:
      // Pass 1: O(N) backward sliding min for lookahead
      const windowMin = new Float32Array(len);
      // Pre-allocate deque arrays to avoid GC thrashing
      const dqIdx = new Int32Array(len);
      const dqVal = new Float32Array(len);
      let dqHead = 0;
      let dqTail = 0;

      for (let i = len - 1; i >= 0; i--) {
         const val = reqGain[i];
         while (dqTail > dqHead && dqVal[dqTail - 1] >= val) {
            dqTail--;
         }
         dqIdx[dqTail] = i;
         dqVal[dqTail] = val;
         dqTail++;

         while (dqTail > dqHead && dqIdx[dqHead] >= i + lookahead) {
            dqHead++;
         }
         windowMin[i] = dqVal[dqHead];
      }

      // Pass 2: Forward Exponential Attack/Release Envelope
      let env = 1.0;


      for (let i = 0; i < len; i++) {
        const target = windowMin[i];
        if (target < env) {
          env = target; // Instant attack to sliding minimum
        } else {
          env = relCoeff * env + (1.0 - relCoeff) * target; // Smooth release
        }
        envBuffer[i] = env;
        for (let c = 0; c < chCount; c++) {
          let s = channelsArray[c][i] * env;
          if (s > ceilingLin) s = ceilingLin;
          if (s < -ceilingLin) s = -ceilingLin;
          channelsArray[c][i] = s;
        }
      }


      updateStatus('[AUDITING MASTER QA...]', 'amber');
      const auditedMetrics = await analyzeAudioBuffer(finalBuffer);
      setMasteredBuffer(finalBuffer);
      setPostMetrics(auditedMetrics);
      setActiveMode('B');

      // Never claim QA passed merely because processing completed. Verify the
      // rendered buffer against the actual selected loudness and peak ceiling.
      const lufsPass = Math.abs(auditedMetrics.integratedLufs - targetLufs) <= 0.6;
      const peakPass = auditedMetrics.truePeakDb <= ceilingDb + 0.05;
      if (lufsPass && peakPass) {
        updateStatus('[MASTER QA PASS]', 'emerald');
      } else {
        updateStatus('[MASTER QA FAILED - REVIEW METRICS]', 'rose');
      }
      logMobile(`Master QA ${lufsPass && peakPass ? 'PASS' : 'FAIL'} — LUFS ${auditedMetrics.integratedLufs.toFixed(1)} (${lufsPass ? 'PASS' : 'FAIL'}), true peak ${auditedMetrics.truePeakDb.toFixed(2)} dBTP (${peakPass ? 'PASS' : 'FAIL'}).`);
    } catch (err) {
      console.error('Mastering error:', err);
      updateStatus('[DSP ERROR]', 'rose');
      logMobile(`Mastering Error: ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };


  // WAV Download Handler
  const handleDownloadWav = async () => {
    if (!masteredBuffer) return;

    updateStatus('[ENCODING 24-BIT WAV...]', 'cyan');
    setIsProcessing(true);

    try {
      const genreTag = selectedGenre.toUpperCase();
      const wavBlob = bufferToWav24BitTPDF(masteredBuffer, true);

      updateStatus('[VERIFYING EXPORTED WAV...]', 'amber');
      logMobile('Re-decoding generated WAV to verify export integrity...');

      const arrayBuf = await wavBlob.arrayBuffer();
      const ctx = getAudioContext();
      const decodedBuf = await ctx.decodeAudioData(arrayBuf);

      const expMetrics = await analyzeAudioBuffer(decodedBuf);

      // Verification rules
      const tpPass = expMetrics.truePeakDb <= dynamicsParams.ceilingDb + 0.05;
      const lufsPass = Math.abs(expMetrics.integratedLufs - dynamicsParams.targetLufs) <= 0.6;

      if (!tpPass || !lufsPass) {
         logMobile(`Export Verification FAILED: LUFS ${expMetrics.integratedLufs.toFixed(1)}, Peak ${expMetrics.truePeakDb.toFixed(2)} dBTP`);
         updateStatus('[EXPORT VERIFICATION FAILED]', 'rose');
         alert(`El archivo exportado no cumple con el techo configurado o LUFS. True Peak: ${expMetrics.truePeakDb.toFixed(2)} dBTP.`);
         setIsProcessing(false);
         return;
      }

      logMobile(`Export Verified [PASS] - LUFS: ${expMetrics.integratedLufs.toFixed(1)}, Peak: ${expMetrics.truePeakDb.toFixed(2)} dBTP`);
      updateStatus('[MAIK MT QA VERIFIED]', 'emerald');

      const a = document.createElement('a');
      a.href = URL.createObjectURL(wavBlob);
      a.download = `${fileName || 'track'}_MAIK_MT_${genreTag}_24BIT.wav`;
      a.click();

      // Cleanup to prevent memory leaks
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);

    } catch(err) {
      logMobile(`Export Error: ${(err as Error).message}`);
      updateStatus('[EXPORT ERROR]', 'rose');
    } finally {
      setIsProcessing(false);
    }
  };


  // Compensation text for A/B console
  const getCompensationInfo = () => {
    if (!preMetrics || !postMetrics) {
      return { text: '[Loudness Match: Waiting for master processing...]', color: 'text-slate-400' };
    }
    if (!loudnessMatch) {
      return {
        text: `[Loudness Match OFF: Playing true master level (${postMetrics.integratedLufs.toFixed(1)} LUFS)]`,
        color: 'text-amber-400',
      };
    }
    const diffDb = postMetrics.integratedLufs - preMetrics.integratedLufs;
    if (diffDb >= 0) {
      const attenDb = -diffDb;
      return {
        text: `[LUFS Match ON: Master B attenuated by ${attenDb.toFixed(1)} dB to match Original (${preMetrics.integratedLufs.toFixed(1)} LUFS)]`,
        color: 'text-emerald-400',
      };
    } else {
      const attenDb = diffDb;
      return {
        text: `[LUFS Match ON: Original A attenuated by ${attenDb.toFixed(1)} dB to match Master (${postMetrics.integratedLufs.toFixed(1)} LUFS)]`,
        color: 'text-emerald-400',
      };
    }
  };

  // DeviceOrientation reactive perspective tilt style (subtle and disabled by default)
  const tiltStyle: React.CSSProperties =
    tilt.enabled && tilt.supported
      ? {
          transform: `perspective(1200px) rotateX(${tilt.beta * 0.05}deg) rotateY(${tilt.gamma * 0.05}deg)`,
          transition: 'transform 0.15s ease-out',
        }
      : {};

  return (
    <div className="min-h-screen pb-16 text-slate-100 select-none">
      {/* Header */}
      <Header
        status={status}
        statusColor={statusColor}
        onOpenLiveMic={() => setIsMicModalOpen(true)}
        tiltActive={tilt.enabled}
        onToggleTilt={toggleTilt}
        hasDeviceTilt={tilt.supported}
      />

      <main className="max-w-4xl mx-auto px-4 pt-5 space-y-5" style={tiltStyle}>
        {/* Step 1: File Loader & Demo Generator */}
        <SourceLoader
          selectedGenre={selectedGenre}
          onGenreChange={handleGenreChange}
          onFileLoaded={handleFileLoaded}
          onLoadDemoTrack={handleLoadDemoTrack}
          fileName={fileName}
          sampleRate={sampleRate}
          duration={duration}
          channels={channels}
          logs={logs}
          isLoading={isLoading}
        />

        {/* Signature Sound Presets Manager */}
        <PresetManager
          presets={presets}
          activePresetId={activePresetId}
          currentEqGains={eqGains}
          currentDynamics={dynamicsParams}
          currentEnableNotches={enableNotches}
          currentNotchCuts={notchCuts}
          selectedGenre={selectedGenre}
          onApplyPreset={handleApplyPreset}
          onSavePreset={handleSavePreset}
          onDeletePreset={handleDeletePreset}
          onRefreshPresets={handleRefreshPresets}
        />

        {/* Step 2: Acoustic Diagnosis & Dynamics Section */}
        {preMetrics && prescription && (
          <section id="analysisSection" className="obsidian-card rounded-2xl p-5 space-y-5 shadow-2xl">
            <DiagnosisSection
              metrics={preMetrics}
              prescription={prescription}
              eqGains={eqGains}
              onEqGainChange={(bandId, gain) => setEqGains((prev) => ({ ...prev, [bandId]: gain }))}
              enableNotches={enableNotches}
              onToggleNotches={setEnableNotches}
              notchCuts={notchCuts}
              onNotchCutChange={(index, cut) =>
                setNotchCuts((prev) => {
                  const copy = [...prev];
                  copy[index] = cut;
                  return copy;
                })
              }
              onResetPrescription={handleResetPrescription}
            />

            <DynamicsMatrixSection
              params={dynamicsParams}
              onChange={(key, val) => setDynamicsParams((prev) => ({ ...prev, [key]: val }))}
              notes={prescription.notes}
              onApplyMaster={processMasterAndVerify}
              isProcessing={isProcessing}
            />
          </section>
        )}

        {/* Step 3: Closed-Loop QA Verification & Synchronized A/B Player */}
        {preMetrics && postMetrics && (
          <div className="space-y-5">
            <ABDeck
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              activeMode={activeMode}
              onSwitchMode={(mode) => setActiveMode(mode)}
              loudnessMatch={loudnessMatch}
              onToggleLoudnessMatch={setLoudnessMatch}
              currentTime={currentTime}
              duration={duration || 0}
              onSeek={handleSeek}
              compensationInfo={getCompensationInfo()}
              analyserL={abAnalyserLRef.current}
              analyserR={abAnalyserRRef.current}
            />

            <VerificationSection
              preMetrics={preMetrics}
              postMetrics={postMetrics}
              targetLufs={dynamicsParams.targetLufs}
              ceilingDb={dynamicsParams.ceilingDb}
              prescription={prescription}
              onDownloadWav={handleDownloadWav}
            />
          </div>
        )}
      </main>

      {/* Live Microphone / Line-in Modal (getUserMedia API) */}
      <LiveMicModal
        isOpen={isMicModalOpen}
        onClose={() => setIsMicModalOpen(false)}
      />
    </div>
  );
}
