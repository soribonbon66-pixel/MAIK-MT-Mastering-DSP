/**
 * MAIK MT Studio DSP - Core Audio Math & Analysis Engine
 * Dual 4096-Pt FFT • BS.1770-4 LUFS • 4x Hermite True Peak • Resonance Hunter
 */

export const FFT_SIZE = 4096;

export interface ResonanceCandidate {
  bin: number;
  freq: number;
  prominenceDb: number;
  cutDb: number;
  q: number;
}

export interface AudioMetrics {
  sampleRate: number;
  duration: number;
  channels: number;
  integratedLufs: number;
  truePeakDb: number;
  rmsDb: number;
  crestDb: number;
  phaseCorr: number;
  bandDb: Record<string, number>;
  spectrumDb: Float32Array;
  binHz: number;
  resonances: ResonanceCandidate[];
}

export interface BandDef {
  id: string;
  name: string;
  freq: number;
  type: BiquadFilterType;
  q: number;
}

export const BAND_DEFINITIONS: BandDef[] = [
  { id: "sub",   name: "Sub Weight [20-60Hz]",      freq: 42,    type: "lowshelf",  q: 0.707 },
  { id: "bass",  name: "Bass Punch [60-180Hz]",     freq: 102,   type: "peaking",   q: 1.050 },
  { id: "mud",   name: "Suno Mud [180-480Hz]",      freq: 310,   type: "peaking",   q: 1.450 },
  { id: "mid",   name: "Vocal Core [500-2.5k]",     freq: 1300,  type: "peaking",   q: 0.950 },
  { id: "harsh", name: "AI Harshness [2.5-6kHz]",   freq: 3850,  type: "peaking",   q: 1.650 },
  { id: "air",   name: "Air & Brilliance [6-20k]",  freq: 12000, type: "highshelf", q: 0.707 }
];

export interface GenreProfile {
  label: string;
  desc: string;
  targetLufs: number;
  offsets: Record<string, number>;
  mb: {
    lowThr: number;
    midThr: number;
    highThr: number;
    lowRat: number;
    midRat: number;
    highRat: number;
  };
  msWidth: number;
  msMonoFreq: number;
  satDrive: number;
}

export const GENRE_PROFILES: Record<string, GenreProfile> = {
  reggaeton: {
    label: "REGGAETON / DEMBOW",
    desc: "[Reggaeton / Dembow: Deep sub weight, punchy 100Hz kick/bass, strong 310Hz mud cut, upfront vocals, -8.5 LUFS]",
    targetLufs: -8.5,
    offsets: { sub: -4.4, bass: -2.5, mud: -8.8, mid: -3.9, harsh: -9.8, air: -10.8 },
    mb: { lowThr: -18.5, midThr: -16.5, highThr: -18.5, lowRat: 3.2, midRat: 2.3, highRat: 2.4 },
    msWidth: 114,
    msMonoFreq: 120,
    satDrive: 13
  },
  techhouse: {
    label: "TECH HOUSE / CLUB",
    desc: "[Tech House / Bumping: Tight mono sub below 130Hz, driving low-end groove, scooped boxiness, crisp hats, -8.0 LUFS]",
    targetLufs: -8.0,
    offsets: { sub: -4.2, bass: -2.3, mud: -9.2, mid: -4.9, harsh: -9.6, air: -10.2 },
    mb: { lowThr: -19.0, midThr: -17.0, highThr: -18.0, lowRat: 3.5, midRat: 2.2, highRat: 2.5 },
    msWidth: 120,
    msMonoFreq: 130,
    satDrive: 11
  },
  hardstyle: {
    label: "HARDSTYLE / FESTIVAL",
    desc: "[Hardstyle / Harder Styles: Massive sub & reverse-bass density, tamed 3.8kHz screech harshness, wide stereo leads, -7.5 LUFS]",
    targetLufs: -7.5,
    offsets: { sub: -4.5, bass: -2.0, mud: -8.7, mid: -4.1, harsh: -9.4, air: -10.0 },
    mb: { lowThr: -20.0, midThr: -18.0, highThr: -19.0, lowRat: 3.8, midRat: 2.6, highRat: 2.8 },
    msWidth: 126,
    msMonoFreq: 110,
    satDrive: 18
  },
  streaming: {
    label: "MODERN STREAMING",
    desc: "[Modern Streaming: Balanced reference curve with preserved crest factor and dynamic punch, -10.5 LUFS]",
    targetLufs: -10.5,
    offsets: { sub: -5.2, bass: -3.0, mud: -8.2, mid: -4.4, harsh: -9.8, air: -11.2 },
    mb: { lowThr: -17.0, midThr: -15.5, highThr: -17.5, lowRat: 2.6, midRat: 2.0, highRat: 2.2 },
    msWidth: 110,
    msMonoFreq: 110,
    satDrive: 9
  },
  trap: {
    label: "TRAP / HIP HOP",
    desc: "[Trap / Urban: Ground-shaking 808 sub, crisp hi-hat air, crisp snare transients, controlled boxiness, -8.5 LUFS]",
    targetLufs: -8.5,
    offsets: { sub: -3.8, bass: -2.8, mud: -9.0, mid: -4.2, harsh: -9.5, air: -10.0 },
    mb: { lowThr: -19.5, midThr: -17.0, highThr: -18.0, lowRat: 3.4, midRat: 2.2, highRat: 2.6 },
    msWidth: 118,
    msMonoFreq: 125,
    satDrive: 14
  }
};

export interface Prescription {
  genreKey: string;
  profileLabel: string;
  eqGains: Record<string, number>;
  targetOffsets: Record<string, number>;
  resonances: ResonanceCandidate[];
  mbLowThr: number;
  mbMidThr: number;
  mbHighThr: number;
  mbLowRat: number;
  mbMidRat: number;
  mbHighRat: number;
  msWidth: number;
  msMonoFreq: number;
  satDrive: number;
  ceilingDb: number;
  targetLufs: number;
  notes: string[];
}

// 4-term Blackman-Harris window coefficients
export const BH_WINDOW = new Float32Array(FFT_SIZE);
(() => {
  const a0 = 0.35875, a1 = 0.48829, a2 = 0.14128, a3 = 0.01168;
  for (let i = 0; i < FFT_SIZE; i++) {
    const w = (2 * Math.PI * i) / (FFT_SIZE - 1);
    BH_WINDOW[i] = a0 - a1 * Math.cos(w) + a2 * Math.cos(2 * w) - a3 * Math.cos(3 * w);
  }
})();

/**
 * In-place Radix-2 Cooley-Tukey FFT
 */
export function radix2FFT(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) { j -= m; m >>= 1; }
    j += m;
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let uRe = 1.0, uIm = 0.0;
      for (let k = 0; k < half; k++) {
        const evenIdx = i + k;
        const oddIdx = i + k + half;
        const tRe = uRe * re[oddIdx] - uIm * im[oddIdx];
        const tIm = uRe * im[oddIdx] + uIm * re[oddIdx];
        re[oddIdx] = re[evenIdx] - tRe;
        im[oddIdx] = im[evenIdx] - tIm;
        re[evenIdx] += tRe;
        im[evenIdx] += tIm;
        const nextURe = uRe * wRe - uIm * wIm;
        uIm = uRe * wIm + uIm * wRe;
        uRe = nextURe;
      }
    }
  }
}



export const POLYPHASE_4X_TAPS = [
  // Phase 0: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0] (exact sample)
  new Float32Array([0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0]),
  // Phase 1 (+0.25)
  new Float32Array([-0.0117, 0.0163, -0.0267, 0.0468, -0.0989, 0.8901, 0.2312, -0.0718, 0.0385, -0.0229, 0.0142, -0.0094]),
  // Phase 2 (+0.50)
  new Float32Array([-0.0143, 0.0204, -0.0345, 0.0652, -0.1601, 0.6233, 0.6233, -0.1601, 0.0652, -0.0345, 0.0204, -0.0143]),
  // Phase 3 (+0.75)
  new Float32Array([-0.0094, 0.0142, -0.0229, 0.0385, -0.0718, 0.2312, 0.8901, -0.0989, 0.0468, -0.0267, 0.0163, -0.0117])
];

/**
 * Calculates max True Peak over a 12-sample history using 4x Polyphase Oversampling
 * @param hist Circular buffer of 12 samples (idx 0 is newest, idx 11 is oldest)
 */
export function evalTruePeakPolyphase4x(hist: Float32Array): number {
  // The processing pipeline stores newest samples at index 0, while FIR taps
  // are defined in chronological (oldest-to-newest) order. Reverse the history
  // when applying the taps; otherwise asymmetric phases are time-reversed.
  if (hist.length !== 12) throw new RangeError('True-peak history must contain 12 samples');
  let maxAbs = 0;
  for (let p = 0; p < 4; p++) {
    const phaseTaps = POLYPHASE_4X_TAPS[p];
    let val = 0;
    for (let i = 0; i < 12; i++) val += hist[11 - i] * phaseTaps[i];
    maxAbs = Math.max(maxAbs, Math.abs(val));
  }
  return maxAbs;
}



/**
 * Pure calculation of resonance frequencies from a spectrum
 */
export function detectResonances(spectrumDb: Float32Array, binHz: number): ResonanceCandidate[] {
  const halfBins = spectrumDb.length;
  const minBin = Math.max(3, Math.floor(240 / binHz));
  const maxBin = Math.min(halfBins - 12, Math.ceil(7800 / binHz));
  const candidates: ResonanceCandidate[] = [];

  for (let b = minBin; b <= maxBin; b++) {
    const val = spectrumDb[b];
    if (val > spectrumDb[b - 1] && val > spectrumDb[b + 1]) {
      let neighSum = 0, neighCount = 0;
      for (let k = -10; k <= 10; k++) {
        if (Math.abs(k) > 2 && b + k >= 0 && b + k < halfBins) {
          neighSum += spectrumDb[b + k];
          neighCount++;
        }
      }
      const localAvg = neighCount > 0 ? (neighSum / neighCount) : val;
      const prominence = val - localAvg;
      if (prominence > 2.2) {
        candidates.push({
          bin: b,
          freq: Math.round(b * binHz),
          prominenceDb: prominence,
          cutDb: -Math.min(4.5, Math.max(1.8, prominence * 0.65)),
          q: prominence > 4.0 ? 11.0 : 8.5
        });
      }
    }
  }


  candidates.sort((a, b) => b.prominenceDb - a.prominenceDb);
  const resonances: ResonanceCandidate[] = [];
  for (const cand of candidates) {
    if (resonances.length >= 3) break;
    if (!resonances.some(r => Math.abs(Math.log2(cand.freq / r.freq)) < 0.32)) {
      resonances.push(cand);
    }
  }

  // Remove default resonance fake frequencies
  return resonances;
}


/**
 * Compute Suno Mastering Chain Prescription
 */
export function computeSunoPrescription(metrics: AudioMetrics, genreKey: string): Prescription {
  const profile = GENRE_PROFILES[genreKey] || GENRE_PROFILES.reggaeton;
  const eqGains: Record<string, number> = {};
  const notes: string[] = [
    `Active MAIK MT Target Curve: [${profile.label}] calibrated for ${profile.targetLufs.toFixed(1)} LUFS.`
  ];

  BAND_DEFINITIONS.forEach(b => {
    const targetOffset = profile.offsets[b.id] ?? -6;
    const measuredRel = metrics.bandDb[b.id] ?? -10;
    const error = targetOffset - measuredRel;
    let suggestedGain = Math.max(-4.8, Math.min(4.8, error * 0.62));

    if (b.id === "mud") {
      if (suggestedGain > -1.8) suggestedGain = -1.8;
      notes.push(`Suno Low-Mid De-Mud [310Hz]: ${suggestedGain.toFixed(1)} dB cut for clean ${profile.label} punch.`);
    } else if (b.id === "harsh") {
      if (suggestedGain > -1.5) suggestedGain = -1.5;
      notes.push(`AI Metallic Upper-Mid Control [3.85kHz]: ${suggestedGain.toFixed(1)} dB cut.`);
    }
    eqGains[b.id] = Number(suggestedGain.toFixed(1));
  });

  metrics.resonances.forEach((r, idx) => {
    notes.push(`FFT Notch #${idx + 1} [${r.freq} Hz, Q=${r.q.toFixed(1)}]: ${r.cutDb.toFixed(1)} dB surgical attenuation.`);
  });

  let { lowThr, midThr, highThr, lowRat, midRat, highRat } = profile.mb;
  if (metrics.crestDb > 13.0) {
    lowThr -= 1.5;
    midThr -= 1.5;
    notes.push(`High Crest Factor [${metrics.crestDb.toFixed(1)} dB]: Tightened LR4 Multiband thresholds by -1.5 dB.`);
  }

  const msWidth = metrics.phaseCorr > 0.75 ? profile.msWidth : Math.max(104, profile.msWidth - 8);
  notes.push(`M/S Matrix: Sub-bass mono below ${profile.msMonoFreq} Hz, Stereo Width at ${msWidth}%, Tape Drive at ${profile.satDrive}%.`);

  return {
    genreKey,
    profileLabel: profile.label,
    eqGains,
    targetOffsets: profile.offsets,
    resonances: metrics.resonances,
    mbLowThr: lowThr,
    mbMidThr: midThr,
    mbHighThr: highThr,
    mbLowRat: lowRat,
    mbMidRat: midRat,
    mbHighRat: highRat,
    msWidth,
    msMonoFreq: profile.msMonoFreq,
    satDrive: profile.satDrive,
    ceilingDb: -1.0,
    targetLufs: profile.targetLufs,
    notes
  };
}

/**
 * Full audio buffer analysis with BS.1770 LUFS, True-Peak, Crest, and 4096-pt FFT
 */
export async function analyzeAudioBuffer(buffer: AudioBuffer): Promise<AudioMetrics> {
  const sr = buffer.sampleRate;
  const len = buffer.length;
  if (!Number.isFinite(sr) || sr <= 0 || len <= 0 || buffer.numberOfChannels < 1) {
    throw new RangeError('AudioBuffer must have a positive sample rate, at least one channel, and non-empty audio');
  }
  if (buffer.numberOfChannels > 2) {
    throw new RangeError('MAIK MT analysis currently supports mono or stereo audio only');
  }
  const chL = buffer.getChannelData(0);
  const chR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : chL;

  let maxTruePeak = 0;
  let sumSqChannels = 0, sumLR = 0, sumL2 = 0, sumR2 = 0;

  const histL = new Float32Array(12);
  const histR = new Float32Array(12);

  for (let i = 0; i < len; i++) {
    const l = chL[i];
    const r = chR[i];
    // RMS is the mean power across actual channels, not the mid signal (which
    // can cancel out-of-phase material and under-report level).
    sumSqChannels += l * l;
    if (chR !== chL) sumSqChannels += r * r;
    sumLR += l * r;
    sumL2 += l * l;
    sumR2 += r * r;

    // shift history
    for (let h = 11; h > 0; h--) {
       histL[h] = histL[h - 1];
       if (chR !== chL) histR[h] = histR[h - 1];
    }
    histL[0] = l;
    if (chR !== chL) histR[0] = r;

    if (i >= 11) {
      const tpL = evalTruePeakPolyphase4x(histL);
      const tpR = chR !== chL ? evalTruePeakPolyphase4x(histR) : tpL;
      if (tpL > maxTruePeak) maxTruePeak = tpL;
      if (tpR > maxTruePeak) maxTruePeak = tpR;
    } else {
      const absM = Math.max(Math.abs(l), Math.abs(r));
      if (absM > maxTruePeak) maxTruePeak = absM;
    }
  }

  const truePeakDb = 20 * Math.log10(Math.max(maxTruePeak, 1e-9));
  const channelCountForRms = buffer.numberOfChannels > 1 ? buffer.numberOfChannels : 1;
  const rmsDb = 10 * Math.log10(Math.max(sumSqChannels / (len * channelCountForRms), 1e-12));
  const crestDb = truePeakDb - rmsDb;
  const phaseCorr = (sumL2 > 0 && sumR2 > 0) ? (sumLR / Math.sqrt(sumL2 * sumR2)) : 1.0;


  // BS.1770-4 K-weighting native DSP simulation
  let integratedLufs = -18.0;
  // Stage 1: High-shelf filter (pre-filter)
  // Coefficients for 48kHz (approximate for any Fs but ideally calculated from analog proto)
  // Let's use direct biquad equations to calculate exact coeffs for the sample rate.
  // Stage 1: High shelf, f0 = 1681.9744509555319 Hz, Q = 0.7071752369554193, Gain = 4.0 dB
  const K = Math.tan(Math.PI * 1681.9744509555319 / sr);
  const Vh = Math.pow(10, 4.0 / 20.0);
  const Vb = Math.pow(Vh, 0.499666774155);
  const a0_1 = 1 + K / 0.7071752369554193 + K * K;
  const b0_1 = (Vh + Vb * K / 0.7071752369554193 + K * K) / a0_1;
  const b1_1 = 2 * (K * K - Vh) / a0_1;
  const b2_1 = (Vh - Vb * K / 0.7071752369554193 + K * K) / a0_1;
  const a1_1 = 2 * (K * K - 1) / a0_1;
  const a2_1 = (1 - K / 0.7071752369554193 + K * K) / a0_1;

  // Stage 2: High-pass filter, f0 = 38.13547087613982 Hz, Q = 0.5003270373253953
  const K2 = Math.tan(Math.PI * 38.13547087613982 / sr);
  const a0_2 = 1 + K2 / 0.5003270373253953 + K2 * K2;
  const b0_2 = 1 / a0_2;
  const b1_2 = -2 / a0_2;
  const b2_2 = 1 / a0_2;
  const a1_2 = 2 * (K2 * K2 - 1) / a0_2;
  const a2_2 = (1 - K2 / 0.5003270373253953 + K2 * K2) / a0_2;

  // Calculate blocked energies
  // BS.1770 uses 400 ms blocks. For shorter clips use the full available
  // duration so the analyser returns a finite short-clip estimate instead of
  // a fake -120 LUFS value. Such estimates are not strictly comparable to a
  // standards-compliant 400 ms integrated measurement.
  const blockSamples = Math.max(1, Math.min(len, Math.floor(sr * 0.4)));
  const stepSamples = Math.max(1, Math.min(blockSamples, Math.floor(sr * 0.1)));
  const blockEnergies: { meanSq: number; lufsBlock: number }[] = [];

  let z1_1L = 0, z2_1L = 0, z1_2L = 0, z2_2L = 0;
  let z1_1R = 0, z2_1R = 0, z1_2R = 0, z2_2R = 0;

  // Pre-process K-weighting
  const kL = new Float32Array(len);
  const kR = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    const l = chL[i];
    const r = chR !== chL ? chR[i] : l;

    // Stage 1 L
    let out1L = b0_1 * l + z1_1L;
    z1_1L = b1_1 * l - a1_1 * out1L + z2_1L;
    z2_1L = b2_1 * l - a2_1 * out1L;
    // Stage 2 L
    let out2L = b0_2 * out1L + z1_2L;
    z1_2L = b1_2 * out1L - a1_2 * out2L + z2_2L;
    z2_2L = b2_2 * out1L - a2_2 * out2L;
    kL[i] = out2L;

    if (chR !== chL) {
      // Stage 1 R
      let out1R = b0_1 * r + z1_1R;
      z1_1R = b1_1 * r - a1_1 * out1R + z2_1R;
      z2_1R = b2_1 * r - a2_1 * out1R;
      // Stage 2 R
      let out2R = b0_2 * out1R + z1_2R;
      z1_2R = b1_2 * out1R - a1_2 * out2R + z2_2R;
      z2_2R = b2_2 * out1R - a2_2 * out2R;
      kR[i] = out2R;
    } else {
      kR[i] = out2L;
    }
  }

  for (let start = 0; start + blockSamples <= len; start += stepSamples) {
    let bSumL = 0;
    let bSumR = 0;
    for (let i = start; i < start + blockSamples; i++) {
      bSumL += kL[i] * kL[i];
      bSumR += kR[i] * kR[i];
    }
    const meanSqL = bSumL / blockSamples;
    const meanSqR = bSumR / blockSamples;
    // BS.1770 channel weighting is 1.0 per active channel. A mono file has
    // one channel; do not duplicate its energy and add an artificial +3.01 dB.
    const meanSq = buffer.numberOfChannels > 1 ? (meanSqL + meanSqR) : meanSqL;

    if (meanSq > 0) {
       const lufsBlock = -0.691 + 10 * Math.log10(meanSq);
       if (lufsBlock >= -70) {
         blockEnergies.push({ meanSq, lufsBlock });
       }
    }
  }

  let integratedLufsResult = -120.0; // Default when empty
  if (blockEnergies.length > 0) {
    const absMean = blockEnergies.reduce((a, b) => a + b.meanSq, 0) / blockEnergies.length;
    const relGate = -0.691 + 10 * Math.log10(Math.max(absMean, 1e-12)) - 10;
    const relBlocks = blockEnergies.filter(b => b.lufsBlock >= relGate);
    if (relBlocks.length > 0) {
      const gatedMeanSq = relBlocks.reduce((a, b) => a + b.meanSq, 0) / relBlocks.length;
      integratedLufsResult = -0.691 + 10 * Math.log10(Math.max(gatedMeanSq, 1e-12));
    }
  }
  integratedLufs = integratedLufsResult;



  // 4096-Point FFT Power Spectrum
  const halfBins = FFT_SIZE >> 1;
  const avgPower = new Float64Array(halfBins);

  // Apply zero padding if length is less than FFT_SIZE
  const paddedLen = Math.max(len, FFT_SIZE);
  const numWindows = Math.max(1, Math.floor((paddedLen - FFT_SIZE) / FFT_SIZE) + 1);
  const hop = Math.max(FFT_SIZE, Math.floor((paddedLen - FFT_SIZE) / numWindows));

  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  let activeFrames = 0;

  for (let w = 0; w < numWindows; w++) {
    const offset = w * hop;
    let frameEnergy = 0;
    for (let i = 0; i < FFT_SIZE; i++) {
      const pIdx = offset + i;
      const sampleL = pIdx < len ? chL[pIdx] : 0;
      const sampleR = pIdx < len ? chR[pIdx] : 0;
      frameEnergy += sampleL * sampleL;
      if (chR !== chL) frameEnergy += sampleR * sampleR;
      re[i] = sampleL * BH_WINDOW[i];
      im[i] = 0.0;
    }
    const channelCount = chR !== chL ? 2 : 1;
    if (10 * Math.log10(Math.max(frameEnergy / (FFT_SIZE * channelCount), 1e-12)) > -80) {
      radix2FFT(re, im);
      for (let b = 0; b < halfBins; b++) {
        avgPower[b] += (re[b] * re[b] + im[b] * im[b]) / (FFT_SIZE * FFT_SIZE * channelCount);
      }
      if (chR !== chL) {
        for (let i = 0; i < FFT_SIZE; i++) {
          const pIdx = offset + i;
          re[i] = (pIdx < len ? chR[pIdx] : 0) * BH_WINDOW[i];
          im[i] = 0.0;
        }
        radix2FFT(re, im);
        for (let b = 0; b < halfBins; b++) {
          avgPower[b] += (re[b] * re[b] + im[b] * im[b]) / (FFT_SIZE * FFT_SIZE * channelCount);
        }
      }
      activeFrames++;
    }
  }


  const spectrumDb = new Float32Array(halfBins);
  const normFrames = Math.max(1, activeFrames);
  for (let b = 0; b < halfBins; b++) {
    spectrumDb[b] = 10 * Math.log10(Math.max(avgPower[b] / normFrames, 1e-15));
  }

  const binHz = sr / FFT_SIZE;
  const bandRanges: Record<string, [number, number]> = {
    sub:   [20, 60],
    bass:  [60, 180],
    mud:   [180, 480],
    mid:   [480, 2500],
    harsh: [2500, 6000],
    air:   [6000, 18000]
  };
  const bandDb: Record<string, number> = {};
  let totalSpecPower = 0;
  for (let b = 1; b < halfBins; b++) totalSpecPower += avgPower[b] / normFrames;
  const totalSpecDb = 10 * Math.log10(Math.max(totalSpecPower, 1e-15));

  for (const [id, [fLo, fHi]] of Object.entries(bandRanges)) {
    const bStart = Math.max(1, Math.floor(fLo / binHz));
    const bEnd = Math.min(halfBins - 1, Math.ceil(fHi / binHz));
    let sumP = 0;
    for (let b = bStart; b <= bEnd; b++) sumP += avgPower[b] / normFrames;
    bandDb[id] = 10 * Math.log10(Math.max(sumP, 1e-15)) - totalSpecDb;
  }

  const resonances = detectResonances(spectrumDb, binHz);

  return {
    sampleRate: sr,
    duration: buffer.duration,
    channels: buffer.numberOfChannels,
    integratedLufs,
    truePeakDb,
    rmsDb,
    crestDb,
    phaseCorr,
    bandDb,
    spectrumDb,
    binHz,
    resonances
  };
}

/**
 * 24-Bit WAV with Triangular Probability Density Function (TPDF) Dithering
 */
export function bufferToWav24BitTPDF(buffer: AudioBuffer, applyTPDF: boolean = true): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bytesPerSample = 3;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 24, true); // 24 bits
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const chData: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) chData.push(buffer.getChannelData(c));

  const scale = 8388607.0;
  let offset = 44;

  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1.0, Math.min(1.0, chData[c][i]));
      const tpdf = applyTPDF ? ((Math.random() - Math.random()) * 0.5) : 0.0;
      let intVal = Math.round(s * scale + tpdf);
      if (intVal > 8388607) intVal = 8388607;
      if (intVal < -8388608) intVal = -8388608;
      view.setUint8(offset, intVal & 0xff);
      view.setUint8(offset + 1, (intVal >> 8) & 0xff);
      view.setUint8(offset + 2, (intVal >> 16) & 0xff);
      offset += 3;
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * Synthesizes a high-fidelity test track simulating a raw Suno AI music bounce:
 * - Dembow / Urban kick and sub-bass (55 Hz)
 * - Layered snare & hats with stereo width
 * - Synthesizer lead with characteristic boxy mud around 310 Hz and metallic artifact around 3.8 kHz
 * Allows instant testing of the entire DSP chain!
 */
export function generateSunoDemoBuffer(ctx: AudioContext | OfflineAudioContext, durationSec: number = 8): AudioBuffer {
  const sr = ctx.sampleRate;
  const numSamples = Math.floor(sr * durationSec);
  const buffer = ctx.createBuffer(2, numSamples, sr);
  const chL = buffer.getChannelData(0);
  const chR = buffer.getChannelData(1);

  const bpm = 96;
  const beatSec = 60 / bpm;
  const stepSec = beatSec / 4;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sr;
    const beatPos = (t % beatSec) / beatSec;
    const stepIdx = Math.floor(t / stepSec) % 16;
    const subStep = (t % stepSec) / stepSec;

    // 1. Kick & Sub Bass on beats 0, 4, 8, 12 + Dembow off-snare on steps 3, 6, 11, 14
    let kick = 0;
    if (stepIdx % 4 === 0) {
      const kEnv = Math.exp(-subStep * 14);
      const fKick = 45 + 110 * Math.exp(-subStep * 24);
      kick = Math.sin(2 * Math.PI * fKick * subStep * stepSec) * kEnv * 0.75;
    }

    // Dembow Snare
    let snare = 0;
    if (stepIdx === 3 || stepIdx === 6 || stepIdx === 11 || stepIdx === 14) {
      const sEnv = Math.exp(-subStep * 18);
      const noise = (Math.random() * 2 - 1) * 0.4;
      const tone = Math.sin(2 * Math.PI * 220 * subStep * stepSec) * 0.6;
      snare = (noise + tone) * sEnv * 0.55;
    }

    // Hi-hats on 16th steps
    const hatEnv = Math.exp(-subStep * 32);
    const hat = (Math.random() * 2 - 1) * hatEnv * 0.18;

    // 2. Synth chord / lead with Suno AI boxiness (310 Hz resonance) and metallic resonance (3850 Hz)
    const chordNotes = [220, 261.63, 329.63, 440];
    let lead = 0;
    for (const freq of chordNotes) {
      lead += Math.sin(2 * Math.PI * freq * t) * 0.08;
    }
    // Suno AI mud spike around 310 Hz
    const sunoMud = Math.sin(2 * Math.PI * 310 * t) * 0.14 * (0.8 + 0.2 * Math.sin(2 * Math.PI * 2 * t));
    // Suno AI metallic artifact around 3850 Hz
    const sunoHarsh = Math.sin(2 * Math.PI * 3850 * t) * 0.09 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t));

    // Stereo panning
    const stereoSpread = Math.sin(2 * Math.PI * 0.5 * t) * 0.25;
    const monoBase = kick + snare * 0.8 + sunoMud;
    const stereoContent = lead + hat + sunoHarsh;

    const left = (monoBase + stereoContent * (0.5 - stereoSpread)) * 0.75;
    const right = (monoBase + stereoContent * (0.5 + stereoSpread)) * 0.75;

    chL[i] = Math.max(-0.95, Math.min(0.95, left));
    chR[i] = Math.max(-0.95, Math.min(0.95, right));
  }

  return buffer;
}
