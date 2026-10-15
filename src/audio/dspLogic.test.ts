import test from 'node:test';
import assert from 'node:assert/strict';
import {
  radix2FFT,
  evalHermite4xPeak,
  detectResonances,
  computeSunoPrescription,
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

test('evalHermite4xPeak detects inter-sample peaks exceeding sample grid', () => {
  // Peak between s1 and s2 where analog waveform overshoots
  const s0 = 0.5;
  const s1 = 0.95;
  const s2 = 0.95;
  const s3 = 0.5;
  const isp = evalHermite4xPeak(s0, s1, s2, s3);
  assert.ok(isp >= 0.95, 'Interpolated peak must be at least as large as sampled points');
  assert.ok(isp > 0.95, 'True peak must detect inter-sample overshoots');
});

test('detectResonances identifies prominent spectral spikes', () => {
  const halfBins = FFT_SIZE >> 1;
  const spectrumDb = new Float32Array(halfBins);
  spectrumDb.fill(-40);

  const binHz = 44100 / FFT_SIZE; // ~10.76 Hz per bin
  const targetBin = Math.round(310 / binHz);
  spectrumDb[targetBin] = -22; // +18 dB spike at 310 Hz

  const resonances = detectResonances(spectrumDb, binHz);
  assert.equal(resonances.length, 3);
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
  assert.equal(presc.targetLufs, -8.5);
  assert.ok(presc.eqGains.mud <= -1.8, 'Mud band should receive a negative corrective cut');
  assert.ok(presc.mbLowThr < GENRE_PROFILES.reggaeton.mb.lowThr, 'High crest factor should tighten threshold');
  assert.ok(presc.notes.length >= 3, 'Prescription should produce diagnostic engineering notes');
});
