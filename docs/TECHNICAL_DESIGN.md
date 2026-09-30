# SIGINTTool technical design

**Status:** Proposed architecture for discussion, not implemented or benchmarked.  
**Date:** 2026-09-30  
**Product contract:** [PRD](PRD.md)  
**Delivery and tracking:** [Implementation plan](IMPLEMENTATION_PLAN.md)

## 1. Recommended architecture

Build a client-side TypeScript application with React for controls, Canvas 2D for the editor, a Web Worker for numerical work, and Web Audio for playback. Use Vite for development and static production assets. React documents this client-only setup and its tradeoffs; Vite documents its static build pipeline. [React guidance](https://react.dev/learn/build-a-react-app-from-scratch), [Vite guide](https://vite.dev/guide/).

This is a recommendation based on the current scope: one interactive workspace, local files, no accounts, and no shared server state. Server rendering, a database service, and an API server do not solve a first-release requirement. A future collaboration or cloud library feature would change that decision.

Use Vitest for numerical/unit tests and Playwright for browser flows, plus real-browser audio checks. Pin compatible versions and the runtime during implementation. [Vitest guide](https://vitest.dev/guide/), [Playwright guide](https://playwright.dev/docs/intro).

Choose the FFT dependency in the foundation spike using numerical fixtures, bundle size, maintenance, and compatibility with the repository's existing license. Keep the FFT behind a small adapter; WASM is an option if measurement justifies it, not a prerequisite.

~~~mermaid
flowchart LR
    A[Pointer or numeric edits] --> B[Versioned drawing state]
    B --> C[Worker: resolve and sample]
    C --> D[Canonical signal data]
    D --> E[Models: sine, Fourier, piecewise]
    D --> F[Audio rendering and conditioning]
    E --> F
    E --> G[Equation and reconstruction views]
    F --> H[Playback and rendered-output view]
    D --> I[Exports and local projects]
    E --> I
    F --> I
~~~

Keep four things distinct: the original drawing, numerical source data, an approximation, and the audio sent to the device. A diagram, equation, and exported file must identify which representation they describe.

## 2. Coordinates, strokes, and the source of truth

Screen coordinates are presentation only. Normalize horizontal coordinates into u ∈ [0,1] and vertical coordinates into amplitude a ∈ [-1,1]. For a canvas-local point (px,py), the basic mapping is u = px/width and a = 1 − 2py/height; apply the inverse viewport transform first when zoomed or panned.

Store strokes in pointer-event order with a tool and normalized points. Do not use pointer travel time as signal time: drawing slowly or quickly must produce the same waveform. Pressure and brush thickness do not alter signal values in v1.

Resolve strokes using the PRD's latest-segment-wins rule. Pencil and line segments overwrite their horizontal interval. Erasing writes zero. A vertical segment writes its final amplitude at that position; at discrete resolution, use a deterministic nearest-bin rule. Clamp coordinates at the domain boundary and keep intermediate segments finite.

Preserve untouched zero-valued regions. Reverse strokes and crossings are edits to one amplitude trace, not simultaneous channels. This is the key restriction that lets a paint-like gesture become a scalar function y = f(x).

Resample only after applying edit semantics. A canonical signal is finite numerical data plus a declared reconstruction rule; it cannot recover detail absent from the drawing. Keep raw strokes so a later resolution change can resample again instead of repeatedly degrading previous samples.

For a periodic signal, do not store both u = 0 and a duplicate u = 1 sample in the transform input. Record visible endpoint/seam information separately. For finite signals, specify the half-open interval [0,T) and a sample count round(T·Fs); show the resulting quantized duration when it differs from T.

## 3. Data model and module boundaries

Suggested modules:

| Module | Responsibility |
| --- | --- |
| editor | Pointer capture, viewport, tools, history, numeric editing |
| signal | Coordinates, stroke resolution, sampling, interpolation, validation |
| analysis | FFT adapter, fitting, error metrics, spectrum |
| audio | Audio context lifecycle, source graph, conditioning, transitions |
| worker | Revisioned jobs, cancellation, progress, transfer ownership |
| export | WAV, CSV, JSON, coefficient and function generation |
| storage | IndexedDB persistence, schema migrations, atomic imports |
| ui | Controls, view selection, accessible status and explanations |

Proposed persisted project fields:

~~~text
schemaVersion, algorithmVersion, projectId, name
activeMode
oneCycle: { strokes, sourceResolution, repetitionHz, smoothing, seamPolicy }
timeline: { strokes, durationSeconds, smoothing, loop, seamPolicy }
model: { kind, harmonicCount, fitSettings }
playback: { selectedSource, monitorGain, conditioningSettings }
exportDefaults: { sampleRate, durationSeconds, format }
~~~

Store both mode workspaces and restore transport as stopped. Persist editable inputs; derived results can be cached but must be recomputed when algorithm versions change. Runtime typed arrays are not serialized as browser-specific objects in portable JSON.

Use Float64Array for coefficient fitting and error analysis, Float32Array at Web Audio boundaries, and signed 16-bit PCM only at WAV encoding. Source data remains unquantized by PCM export. Enforce the PRD's 20,000-point project limit, periodic grid cap, and import-size limit before allocation.

A derived result includes project ID, source revision, settings hash, algorithm version, mode, units, and any applicable sample rate. A cache key must include all of these; pitch and sample rate affect the audio bandwidth even when the drawing has not changed.

## 4. The three mathematical outputs

### A. General source function

Every source has a piecewise-linear evaluator, including shapes with no useful compact formula. For a uniform periodic table, use j = floor(N·u), α = N·u − j, and p(u) = (1−α)·y[j] + α·y[(j+1) mod N]. Wrap phase before lookup.

For finite sample tables, interpolate within [0,T), use a documented final-interval rule, and return zero outside. The initial proposal holds the last sample over its final sample interval; boundary conditioning is part of rendering, not a hidden source edit. Handle exact boundaries and negative t deliberately in exported evaluators.

The evaluator plus its table is a complete function definition. A long array is acceptable when the input is complex; summarize it in the UI and include full data in downloads.

### B. Sine fit

For each candidate integer harmonic m, fit C + a cos(2πm·u) + b sin(2πm·u) against the uniform source samples. In a full periodic grid, the corresponding DFT coefficients provide this least-squares fit.

Convert to the user-facing form A sin(2π·f·t + φ) + C using:

- A = sqrt(a² + b²)
- φ = atan2(a,b)
- f = m·f0

The order in atan2 matters because the displayed convention uses sine. Positive amplitude and a wrapped phase provide a consistent canonical form.

Compare normalized RMS residuals, reject near-flat signals, and report the actual error. Recognition is a model proposal; only an explicit Approximation selection changes playback. Limit the first release to periodic sine recognition. General timelines still have valid numerical functions.

### C. Fourier approximation

For real samples y[n], adopt this transform convention:

X[k] = Σ[n=0…N−1] y[n] exp(−i·2πkn/N).

Then C = Re(X[0])/N. For interior positive-frequency bins, ak = 2·Re(X[k])/N and bk = −2·Im(X[k])/N. For even N, the Nyquist bin is special: aN/2 = Re(X[N/2])/N and bN/2 = 0; do not double it. Libraries may use different normalization, so adapt and fixture-test the convention. [DFT reference](https://numpy.org/doc/stable/reference/routines.fft.html).

Truncating to K terms produces a controllable approximation. The source-resolution limit and audio Nyquist limit are different: mathematical coefficients can exist even when they cannot be played at a chosen pitch.

A complete discrete transform reconstructs the source grid to numerical precision, but does not establish a unique continuous signal between samples. Piecewise-linear and trigonometric interpolation can differ between knots. Compute UI reconstruction error on a shared dense grid (initially at least 4N for periodic data), state the grid, and separately test transform round trips on the original grid. Discontinuities can exhibit ringing; show this instead of concealing it.

## 5. Audio synthesis and sample-rate handling

### Periodic path

Prototype OscillatorNode with PeriodicWave. Keep the repetition rate independent of source-table length; looping an integer-length buffer at the device rate can quantize the desired frequency if used carelessly.

For a requested f0 and sample rate Fs, retain only harmonic k satisfying k·f0 < Fs/2. The audio path may apply a documented transition band below Nyquist. Rebuild the playable coefficients when f0 or Fs changes, and report the number removed.

Drawing playback uses the full resolved sample representation before audio bandwidth limits; Approximation playback uses the chosen sine/Fourier model. Its model coefficient cap must not silently become a source-data cap.

Set and test the PeriodicWave normalization policy explicitly. The native API maps real coefficients to cosine terms and imaginary coefficients to sine terms; convert from the FFT sign convention above. Keep DC out of the audible oscillator and preserve it in source analysis. [API reference](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createPeriodicWave).

### Finite path

Evaluate the resolved timeline, apply a measured low-pass/resampling method, and produce a mono buffer for AudioBufferSourceNode. Recreate source nodes for each playback; own their cleanup in one transport controller.

Start the technical spike with oversampled evaluation plus a low-pass filter and decimation. Compare a polyphase FIR or FFT-convolution implementation against a high-quality reference. Choose filter length, transition band, and oversampling factor from the quality/performance result; do not assume interpolation alone prevents aliasing.

Proposed spike targets are pass-band ripple ≤ 0.5 dB below 0.4·Fs and stop-band attenuation ≥ 60 dB from 0.5·Fs in the oversampled filter response. Add rendered-signal tests because a good filter response alone does not prove the complete pipeline is free of folded artifacts. Record the accepted spectral thresholds before closing F01.

Loop boundaries need an explicit policy. Preserve the source, show the seam, and store whether a short seam blend was selected. If a blend changes effective period or sample count, reflect that change in timing and metadata.

### Shared output contract

Apply band limiting, DC removal, peak attenuation, a playback envelope, and monitor gain in a versioned order. Define DC removal as subtracting the rendered steady-state mean before envelopes; do not use an undocumented high-pass filter that would change low frequencies and phase.

Choose attenuation g = min(1, 0.95/P), with g = 1 for silence. P must bound the rendered waveform at the chosen rate, not just the input table. The periodic prototype must validate peak estimates on dense/offline renders and include a conservative bound if required to meet the output ceiling. Never silently normalize quiet signals upward.

Preview and offline export must construct the same source and processing graph. Start/stop ramps are transport behavior; exporting a finite duration includes its own documented start/end ramps. Formula exports identify the unconditioned model, while rendered-output exports reproduce conditioning numerically.

Read Fs from the audio context. WAV exports explicitly request 44.1 or 48 kHz and recompute at that rate. The 480,000-sample cap applies to 10-second, 48 kHz exports; preview allocation uses actual Fs and an explicit memory budget. If an unusual device rate exceeds the budget, report the supported limit rather than silently altering time.

Do not use wall-clock JavaScript timers to generate samples. Schedule audio changes with the audio clock. An AudioWorklet remains a fallback for requirements the native-node prototype cannot satisfy; worker analysis does not run on the real-time audio thread.

## 6. Responsiveness, lifecycle, and failure recovery

Batch visual drawing updates with requestAnimationFrame. Avoid a complete React state update for every high-rate pointer event. Keep history as edit commands/deltas rather than unlimited full audio-buffer snapshots.

Post analysis jobs with increasing revisions. A worker response is accepted only if the source revision and settings still match. Cancellation must interrupt or chunk expensive work; ignoring a result alone does not stop CPU or memory consumption. Transfer large buffers only when the sender relinquishes ownership, or copy deliberately.

Use a small transport state machine: stopped, preparing, playing, stopping, unavailable. Play creates/resumes the audio context from a user action; Stop wins over pending render completion. A late job must never restart playback. Clean up source nodes and ramps when replacing a source, closing a project, or unloading.

For a 10-second, 48 kHz mono buffer, Float32 samples occupy 1,920,000 bytes (about 1.83 MiB). Oversampling, Float64 analysis, history, and temporary FFT buffers multiply that cost; account for the whole working set. Target at most 128 MiB of app-owned signal buffers on the baseline desktop and benchmark the worst case.

Show an immediate pending/progress state for slow jobs. On a renderer failure, keep the drawing and last valid analysis; stop unsafe or stale playback and provide a retry action. Storage failure must not prevent in-memory editing or downloading the project.

## 7. Inspection and portable outputs

For a periodic coefficient view, use the same unwindowed cycle as synthesis. For a finite spectrum display, use a documented window such as Hann and report FFT length, frequency spacing Fs/N, and amplitude scaling. A visualization window must not accidentally multiply the actual audio or source data.

Define the WAV format explicitly: RIFF/WAVE, PCM format 1, one channel, signed 16-bit little-endian samples, with duration derived from sample count. Clamp only as a final encoding guard; any clipping indicates a renderer validation failure and must be reported. Specify rounding/saturation and verify positive and negative extremes with decoded fixtures.

CSV headers identify time_seconds and amplitude plus source/rendered selection in accompanying metadata. JSON uses finite numbers and a versioned schema. Generated JavaScript and Python include constants/tables, source evaluation, and a small sample-generation example with units.

Use round-trippable numeric serialization where possible. Export coefficients at full computational precision; UI decimal formatting must not reduce the saved precision. Formula display is for readability; coefficient/data exports are the reproducibility contract.

Project uploads are data only. Reject unexpected schema versions, invalid ranges, oversized arrays/files, and non-finite values before replacing active state. Do not evaluate uploaded expressions or executable code.

## 8. Test strategy and delivery decisions

Unit tests cover coordinate transforms, overlap order, boundary rules, coefficient signs/scales, Nyquist handling, fitting rejection, metrics, sample-rate conversion, and PCM encoding. Independent analytic fixtures prevent tests from merely repeating the implementation.

Browser tests cover drawing/undo, mode separation, source selection, suspended audio, cancellation, import/export, and reload restoration. Test on actual Safari as well as automated browser engines. Manual listening checks complement numerical tests; listening alone cannot validate frequency or fidelity.

The foundation spike must answer these implementation questions before audio work is accepted:

1. Can native periodic nodes meet coefficient fidelity, peak limits, transitions, and offline/live consistency?
2. Which timeline filter meets the spectral target and maximum-render budget?
3. Which FFT adapter preserves the declared conventions and handles the maximum source grid?
4. What baseline OS, browser versions, hardware, sample rates, and memory measurements define the performance gates?

If the prototype requires a different engine, update this document and the affected issues with evidence. Avoid adding a backend merely to move manageable browser work elsewhere.

## 9. How pitch and volume drawing would extend this design

Direct waveform drawing is the proposed v1. An envelope is a different signal applied to a carrier:

s(t) = A(t) · p(frac(θ(t))), with θ(t) = θ0 + ∫[0…t] f(τ) dτ.

A(t) is a gain envelope and f(t) is instantaneous frequency in Hz. Multiplying t by a changing f(t) is generally incorrect; integrating frequency maintains the intended phase. Fast changes introduce additional bandwidth and require smoothing/band limiting.

Adding envelope lanes would require units and bounds per lane, a phase-continuous renderer, interpolation rules for automation, synchronized editing, and new project/export schemas. Layering adds mixing and headroom decisions. These are useful next steps, but should be separately scoped if included in the first release.
