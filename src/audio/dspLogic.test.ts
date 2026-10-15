import test from 'node:test';
import assert from 'node:assert/strict';
import {
  radix2FFT,
  evalTruePeakPolyphase4x,
  detectResonances,
  computeSunoPrescription,
  analyzeAudioBuffer,
  bufferToWav24BitTPDF,
  GENRE_PROFILES,
  BAND_DEFINITIONS,
  FFT_SIZE
} from './dspLogic.ts';
import type { AudioMetrics } from './dspLogic.ts';

test('radix2FFT computes spectrum for pure sine', () => {
  const n = 64;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const bin = 4;
  for (let i = 0; i < n; i++) {
    re[i] = Math.cos((2 * Math.PI * bin * i) / n);
  }

  radix2FFT(re, im);

  // Peak should be at bin 4 and symmetric at bin 60
  const mag4 = Math.hypot(re[4], im[4]);
  const mag2 = Math.hypot(re[2], im[2]);
  assert.ok(mag4 > 10, 'Expected peak at target frequency bin');
  assert.ok(mag4 > mag2 * 10, 'Target bin magnitude significantly higher than off-bins');
});

test('evalTruePeakPolyphase4x detects inter-sample peaks exceeding sample grid', () => {
  const hist = new Float32Array([0, 0, 0, 0, 0, 1.0, 1.0, 0, 0, 0, 0, 0]);
  const isp = evalTruePeakPolyphase4x(hist);
  assert.ok(isp > 1.0, 'Interpolated peak must be larger than 1.0 for two consecutive 1.0 samples');
});

test('detectResonances identifies prominent spectral spikes', () => {
  const halfBins = FFT_SIZE >> 1;
  const spectrumDb = new Float32Array(halfBins);
  spectrumDb.fill(-40);

  const binHz = 44100 / FFT_SIZE; // ~10.76 Hz per bin
  const targetBin = Math.round(310 / binHz);
  spectrumDb[targetBin] = -22; // +18 dB spike at 310 Hz

  const resonances = detectResonances(spectrumDb, binHz);
  const found310 = resonances.some(r => Math.abs(r.freq - 310) < 30);
  assert.ok(found310, 'Should locate resonance near 310 Hz');
});

test('computeSunoPrescription enforces Suno mud cut and genre parameters', () => {
  const mockMetrics: AudioMetrics = {
    sampleRate: 44100,
    duration: 10,
    channels: 2,
    integratedLufs: -14.2,
    truePeakDb: -0.5,
    rmsDb: -16.0,
    crestDb: 15.5,
    phaseCorr: 0.88,
    bandDb: {
      sub: -6.0,
      bass: -3.0,
      mud: -6.5, // Excessive mud compared to target -8.8
      mid: -4.0,
      harsh: -8.0,
      air: -12.0
    },
    spectrumDb: new Float32Array(2048).fill(-30),
    binHz: 10.76,
    resonances: [
      { bin: 30, freq: 310, prominenceDb: 5.0, cutDb: -3.2, q: 11.0 }
    ]
  };

  const presc = computeSunoPrescription(mockMetrics, 'reggaeton');
  assert.equal(presc.targetLufs, -12);
  assert.ok(presc.eqGains.mud <= -1.8, 'Mud band should receive a negative corrective cut');
  assert.equal(presc.mbLowThr, GENRE_PROFILES.reggaeton.mb.lowThr, 'High crest factor should not force extra compression');
  assert.ok(presc.notes.length >= 3, 'Prescription should produce diagnostic engineering notes');
});

// We need a minimal mock AudioBuffer for node since there is no OfflineAudioContext natively.
// analyzeAudioBuffer uses Web Audio API (OfflineAudioContext) internally to compute BS.1770 LUFS.
// In tests without a real browser environment, it falls back to RMS.
class MockAudioBuffer {
  length: number;
  sampleRate: number;
  numberOfChannels: number;
  duration: number;
  private _data: Float32Array[];

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._data = [];
    for (let i = 0; i < numberOfChannels; i++) {
      this._data.push(new Float32Array(length));
    }
  }

  getChannelData(channel: number) {
    return this._data[channel];
  }
}

// Regression: a mono file is one weighted channel in BS.1770, not an implicit
// dual-mono stereo file (which would be 3.01 dB louder).
test('LUFS: mono energy is not double-counted', async () => {
  const mono = new MockAudioBuffer(1, 44100, 44100) as any as AudioBuffer;
  const stereo = new MockAudioBuffer(2, 44100, 44100) as any as AudioBuffer;
  for (let i = 0; i < mono.length; i++) {
    const sample = 0.2 * Math.sin(2 * Math.PI * 1000 * i / mono.sampleRate);
    mono.getChannelData(0)[i] = sample;
    stereo.getChannelData(0)[i] = sample;
    stereo.getChannelData(1)[i] = sample;
  }
  const monoMetrics = await analyzeAudioBuffer(mono);
  const stereoMetrics = await analyzeAudioBuffer(stereo);
  assert.ok(Math.abs((stereoMetrics.integratedLufs - monoMetrics.integratedLufs) - 3.0103) < 0.15,
    `Expected stereo dual-mono to be about 3.01 LU above mono; got ${stereoMetrics.integratedLufs - monoMetrics.integratedLufs}`);
});

test('RMS: anti-phase stereo must not disappear in the mid signal', async () => {
  const buf = new MockAudioBuffer(2, 44100, 44100) as any as AudioBuffer;
  for (let i = 0; i < buf.length; i++) {
    const sample = 0.25 * Math.sin(2 * Math.PI * 1000 * i / buf.sampleRate);
    buf.getChannelData(0)[i] = sample;
    buf.getChannelData(1)[i] = -sample;
  }
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(metrics.rmsDb > -16 && metrics.rmsDb < -14, `Unexpected anti-phase RMS: ${metrics.rmsDb} dBFS`);
  assert.ok(metrics.phaseCorr < -0.99);
  assert.ok(metrics.bandDb.mid > -20, 'Anti-phase content should remain visible in the power spectrum');
});

test('an empty audio buffer is rejected with a clear error', async () => {
  const buf = new MockAudioBuffer(1, 0, 44100) as any as AudioBuffer;
  await assert.rejects(() => analyzeAudioBuffer(buf), /non-empty audio/);
});

// 1. Digital silence
test('Scenario 1: Digital Silence', async () => {
  const buf = new MockAudioBuffer(2, 44100, 44100) as any as AudioBuffer;
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(!Number.isNaN(metrics.integratedLufs));
  assert.ok(!Number.isNaN(metrics.truePeakDb));
  assert.ok(!Number.isNaN(metrics.rmsDb));
  assert.equal(metrics.truePeakDb, -180); // very low db limit
});

// 2. Sine waves at different frequencies
test('Scenario 2: Sine Waves', async () => {
  const buf = new MockAudioBuffer(2, 44100, 44100) as any as AudioBuffer;
  for (let c = 0; c < 2; c++) {
    const arr = buf.getChannelData(c);
    for (let i = 0; i < buf.length; i++) {
      arr[i] = Math.sin(2 * Math.PI * 1000 * i / 44100) * 0.5;
    }
  }
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(metrics.truePeakDb > -10 && metrics.truePeakDb < 0);
});

// 3. Signals near 0 dBFS
test('Scenario 3: Signals near 0 dBFS', async () => {
  const buf = new MockAudioBuffer(2, 44100, 44100) as any as AudioBuffer;
  const arr = buf.getChannelData(0);
  arr[10] = 0.99;
  arr[11] = 0.99;
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(metrics.truePeakDb > -0.5);
});

// 4. Fast Transients/Impulses
test('Scenario 4: Impulses and transients', async () => {
  const buf = new MockAudioBuffer(1, 44100, 44100) as any as AudioBuffer;
  const arr = buf.getChannelData(0);
  arr[100] = 1.0;
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(metrics.crestDb > 40); // High crest factor for impulse
});

// 5. Bass Dominant
test('Scenario 5: Bass Dominant', async () => {
  const buf = new MockAudioBuffer(2, 44100, 44100) as any as AudioBuffer;
  const arr = buf.getChannelData(0);
  for (let i = 0; i < buf.length; i++) {
    arr[i] = Math.sin(2 * Math.PI * 50 * i / 44100);
  }
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(metrics.bandDb['sub'] > metrics.bandDb['air']);
});

// 6. Mids and Treble Dominant
test('Scenario 6: Highs Dominant', async () => {
  const buf = new MockAudioBuffer(2, 44100, 44100) as any as AudioBuffer;
  const arr = buf.getChannelData(0);
  for (let i = 0; i < buf.length; i++) {
    arr[i] = Math.sin(2 * Math.PI * 8000 * i / 44100);
  }
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(metrics.bandDb['air'] > metrics.bandDb['sub']);
});

// 7. Pink Noise (Simulated with Random)
test('Scenario 7: Noise', async () => {
  const buf = new MockAudioBuffer(2, 44100, 44100) as any as AudioBuffer;
  const arr = buf.getChannelData(0);
  for (let i = 0; i < buf.length; i++) {
    arr[i] = (Math.random() - 0.5) * 0.5;
  }
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(metrics.rmsDb > -30);
});

// 8. Mono and Stereo
test('Scenario 8: Mono and Stereo', async () => {
  const monoBuf = new MockAudioBuffer(1, 44100, 44100) as any as AudioBuffer;
  monoBuf.getChannelData(0)[0] = 0.5;
  const monoMet = await analyzeAudioBuffer(monoBuf);
  assert.equal(monoMet.phaseCorr, 1.0);

  const stBuf = new MockAudioBuffer(2, 44100, 44100) as any as AudioBuffer;
  const chL = stBuf.getChannelData(0);
  const chR = stBuf.getChannelData(1);
  for (let i = 0; i < stBuf.length; i++) {
    chL[i] = Math.random();
    chR[i] = Math.random();
  }
  const stMet = await analyzeAudioBuffer(stBuf);
  assert.ok(stMet.phaseCorr < 1.0);
});

// 9. Out of phase channels
test('Scenario 9: Out of phase', async () => {
  const buf = new MockAudioBuffer(2, 44100, 44100) as any as AudioBuffer;
  const l = buf.getChannelData(0);
  const r = buf.getChannelData(1);
  for (let i = 0; i < buf.length; i++) {
    const val = Math.random();
    l[i] = val;
    r[i] = -val;
  }
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(metrics.phaseCorr < 0);
});

// 10. Short files (< 4096 samples)
test('Scenario 10: Files shorter than 4096', async () => {
  const buf = new MockAudioBuffer(2, 1000, 44100) as any as AudioBuffer;
  buf.getChannelData(0)[500] = 0.5;
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(!Number.isNaN(metrics.integratedLufs));
});

// 11. Multi-minute files
test('Scenario 11: Multi-minute files', async () => {
  const buf = new MockAudioBuffer(2, 44100 * 65, 44100) as any as AudioBuffer;
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(!Number.isNaN(metrics.integratedLufs));
});

// 12. Different sample rates
test('Scenario 12: Different Sample Rates', async () => {
  const buf = new MockAudioBuffer(2, 48000, 48000) as any as AudioBuffer;
  const arr = buf.getChannelData(0);
  for (let i = 0; i < buf.length; i++) {
    arr[i] = Math.sin(2 * Math.PI * 1000 * i / 48000) * 0.5;
  }
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(!Number.isNaN(metrics.spectrumDb[10]));
});

// 13. Crest factor variance
test('Scenario 13: Crest factor variance', async () => {
  const buf = new MockAudioBuffer(2, 44100, 44100) as any as AudioBuffer;
  const arr = buf.getChannelData(0);
  arr[0] = 1.0; // high peak
  for (let i = 1; i < buf.length; i++) arr[i] = 0.01; // low rms
  const metrics = await analyzeAudioBuffer(buf);
  assert.ok(metrics.crestDb > 20);
});

// 14. Export formats correctly
test('Scenario 14: Export correctly to WAV', async () => {
  const buf = new MockAudioBuffer(2, 44100, 44100) as any as AudioBuffer;
  const blob = bufferToWav24BitTPDF(buf, false);
  assert.equal(blob.type, "audio/wav");
  assert.equal(blob.size, 44 + buf.length * buf.numberOfChannels * 3);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'WAVE');
  assert.equal(new TextDecoder().decode(bytes.slice(36, 40)), 'data');
  assert.equal(new DataView(bytes.buffer).getUint16(34, true), 24);
});
