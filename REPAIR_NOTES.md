# MAIK MT DSP repair notes

## Changes
- Corrected the channel order used by the 4x polyphase true-peak evaluator (history is newest-first; FIR taps are chronological).
- Fixed integrated loudness channel weighting so mono input is not counted as duplicated stereo energy.
- Made short-file loudness estimates use the available samples rather than silently returning the default -120 LUFS when no 400 ms block fits. These estimates are explicitly not equivalent to a full BS.1770 400 ms measurement.
- Corrected RMS measurement to use actual channel powers rather than the stereo mid signal, which can cancel anti-phase content.
- Corrected FFT power analysis to average per-channel powers instead of collapsing L/R to mono before the FFT.
- Added an explicit guard against multichannel files above stereo so QA cannot silently ignore surround channels.
- Removed the unconditional “QA VERIFIED” status after processing; status now depends on the measured post-render LUFS and true-peak ceiling.
- Added regression tests for mono loudness weighting, anti-phase RMS/spectrum, empty buffers, and the 24-bit WAV header.
- Added an npm test script, pinned TypeScript to 5.8.3 for Termux compatibility, aligned the lockfile's TypeScript entry, and added a CI workflow for tests, type checking, and production build.

## Validation status
The source and package metadata were reviewed and JSON/ZIP integrity checks are performed when packaging. A local dependency install could not be completed in this environment, so automated tests, type checking, and build are **not claimed as passing for this repaired archive**. CI is configured to run these checks on GitHub. Passing the existing tests is not by itself a certification of mastering accuracy; listening tests and comparison against a trusted BS.1770/true-peak meter remain necessary.
