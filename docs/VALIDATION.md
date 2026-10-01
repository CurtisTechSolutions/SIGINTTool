# Validation report

Implementation evidence is attached to [PR #29](https://github.com/CurtisTechSolutions/SIGINTTool/pull/29)
at commit f14b36b1fcf0691280d0ba45da027312eaa90e2b, from
[CI run 36814330501](https://github.com/CurtisTechSolutions/SIGINTTool/actions/runs/36814330501).
Later PRs rerun the same suite. This report distinguishes implemented behavior,
automated evidence, measured performance and remaining human release acceptance.

## Reproduce

~~~sh
npm ci
npm run check
node scripts/fixtures.mjs
npm test
node --expose-gc scripts/benchmark.mjs
npm run build
npm install --no-save --package-lock=false playwright@1.63.0 axe-core@4.10.3
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
~~~

Codec fixture generation requires ffmpeg. Linux browser tests need an audio device;
CI starts a PulseAudio null sink. Real Safari uses a macOS runner:

~~~sh
sudo safaridriver --enable
python3 tests/safari.py
~~~

The collaboration host could not start shell processes, so builds and tests ran in
GitHub Actions from committed branches. No local test execution or production
deployment is claimed.

## Numerical and export coverage

35 tests passed with no skipped tests in the recorded run. Fixtures cover:

- Ordered drawing strokes, backward/vertical strokes, erase, half-open sampling,
  periodic wrap, finite ends, smoothing/resolution contracts and malformed projects.
- FFT normalization, signs, DC and Nyquist scaling, sine fitting, Fourier error,
  known-frequency spectra and stable log-linear pitch integration.
- Independent oscillator phase cancellation, mute/solo, zero gain, global headroom,
  ring sum/difference tones, high-frequency rejection, constant octave pitch,
  varispeed carrier EOF/looping and volume-follower timing.
- Maximum source resolution, an independent analytic logarithmic sweep, sinc rate
  conversion and FIR pass/stop bands.
- WAV headers/quantization, ZIP CRC/path/bounds, immutable PCM bundle round trips,
  stereo conversion, truncated codec input, actual generated WAV/MP3 decoding.
- Standalone JavaScript and Python source/modulated/rendered evaluation, including
  negative-time periodic wrap, finite out-of-domain behavior, phase prefixes,
  monitor applied once and selected-voice isolation.

The decimator has less than 0.5 dB loss at 0.4 times destination sample rate and more
than 60 dB rejection at 0.5 times destination sample rate. A 14 kHz carrier multiplied
by 13 kHz retains the 1 kHz difference while rejecting the aliased 21 kHz sum.
These are explicit fixtures, not a claim of exhaustive alias-free arbitrary modulation.

## Browser and storage coverage

| Environment | Recorded coverage |
| --- | --- |
| Chrome for Testing / headless Chromium 153.0.8010.12, Linux | Full integrated browser suite, axe WCAG 2 A/AA and 2.1 AA tags, 390 px responsive layout, soundboard stress |
| Firefox 155.0, Linux | Full integrated browser suite |
| Playwright WebKit 26.6, Linux | Full integrated browser suite |
| Safari 26.6.2, macOS 26.6.2 arm64 | Actual Safari WebDriver: WAV/MP3 workers, trim/conversion, ring audio at 48 kHz, Stop, soundboard snapshot isolation |

The integrated suite draws and edits voices/envelopes, exercises undo/redo, renders
and stops audio, saves/reloads independent snapshots, imports both codecs, routes
effects to a voice distinct from editor selection, downloads WAV/functions, deletes
an original source pad, saves the dependent sound, and reopens its asset-bearing bundle
in a fresh browser context. Reload/Open never starts audio automatically.

Recovery tests verify that malformed project import and simulated quota failure
preserve work, import cancellation terminates its worker, and a stopped pending render
cannot start later. No axe violations were reported for the tagged rules. This does not
replace manual screen-reader or human keyboard/usability review.

The capacity fixture stores 31 distinct ten-second clips alongside a saved sound.
Listing 32 pads performs **zero audio-buffer reads**. After 100 prepared pad play/Stop
cycles and a stopped pending editor render, **zero source nodes remain**. Measured
prepared-pad p95 latency was **8.4 ms**, including the tested UI path.

## Performance and memory

Recorded baseline: Node 22.23.3, Linux 6.17.0-1022-azure, a shared GitHub-hosted
2-vCPU AMD EPYC 7763 runner with approximately 7.8 GiB memory.

The workload uses four 16,384-sample saw carriers, drawn pitch/gain, ten seconds at
48 kHz, a full-length clip, mix-target pitch modulation at ±24 semitones, and both
source/carrier looping. Each result has 480,000 samples with peak at or below 0.95.

| Measurement | Result |
| --- | --- |
| Periodic analysis p95, 20 runs | 40.24 ms |
| Render minimum / maximum, 10 runs | 1.51 s / 2.74 s |
| Render median | 1.55 s |
| Render empirical p95 (nearest rank, 10 runs) | 2.74 s |
| Sampled post-render typed-array memory maximum | 42.94 MiB |
| Whole Node process RSS maximum | 175.18 MiB |

Optimizations retained the 4× render and filter quality: contiguous sinc reads avoid
per-tap wrapping, exact kernel phases avoid redundant interpolation, geometric pitch
increments avoid per-sample exponentials, symmetric FIR evaluation shares work, and
workers avoid unnecessary timer clamping. Direct AbortSignal callers still yield.

**The original proposed two-second p95 render target is not met on this shared runner.**
It remains an open release qualification item in #16; it has not been silently weakened
or treated as a passing performance assertion. The worker keeps the interface usable
and can be canceled while a larger sound prepares.

Post-render array-buffer sampling is not a peak browser-heap measurement. The renderer
checks an owned-scratch estimate before allocation, prepared pad PCM is capped at
8 MiB, imports preflight decoded frames/bytes, and projects cap asset counts/sizes.
The 128 MiB application-wide budget still needs a full browser/decoder peak-memory
profile; whole-process RSS includes Node/runtime memory and is not equated with that
budget. Arbitrary heavy recordings and unbounded modulation are outside this version.

## Remaining release acceptance

Implementation and automated checks are available on main. The following have not
been represented as completed:

- A stable-hardware full-browser profile of maximum rendering and peak memory,
  plus drawing-event latency and decoder-internal peak overhead.
- Branded stable Chrome/Edge checks with ordinary hardware audio devices, and human
  listening across devices. Playwright Chromium is identified by its actual build.
- Manual keyboard and screen-reader sessions, and the planned five-person formative
  test (four of five complete draw → hear → find function within two minutes).

Track these in [#15](https://github.com/CurtisTechSolutions/SIGINTTool/issues/15) and
[#16](https://github.com/CurtisTechSolutions/SIGINTTool/issues/16).
The parent release tracker remains open until the acceptance evidence is complete.
