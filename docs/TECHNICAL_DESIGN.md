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
    D --> I[Exports, local projects, and soundboard]
    E --> I
    F --> I
~~~

Keep four things distinct: the original drawing, numerical source data, an approximation, and the audio sent to the device. A diagram, equation, and exported file must identify which representation they describe.

## 2. Coordinates, strokes, and the source of truth

The main waveform view uses physical time horizontally and signed amplitude vertically. A separately selected spectrum uses frequency horizontally and component magnitude/level vertically. Gain envelopes use time/gain axes; pitch envelopes use time/Hz axes. Give each view a name, units, and its own axis contract rather than a combined Time/Frequency label.

Screen coordinates are presentation only. After applying the inverse viewport transform, let r = px/width and t = t_start + r·visible_duration_seconds. For the selected one-cycle source, convert elapsed time to phase u = f0·t, with the template interval [0,1/f0); internal phase storage is not the primary user-facing time axis. The basic waveform vertical mapping is a = 1 − 2py/height. Envelope axes use different mappings: gain = 1 − py/height; a logarithmic pitch view maps f = f_min · (f_max/f_min)^(1 − py/height). Store values in the appropriate seconds, Hz, normalized phase, or linear-amplitude/gain units.

At 440 Hz, the single-cycle template spans approximately 2.273 ms. A fixed-time rendered view shows twice as many cycles at 880 Hz. Changing a template's period changes its displayed time extent; do not hide that change through unlabeled normalization. Time-domain overlays align all oscillators to the same physical time window. Phase-normalized shape comparison is a separately labeled optional view.

Amplitude scaling multiplies both positive and negative excursions around zero. A vertical translation adds a DC offset; it is not a volume control. Negative waveform samples are not negative volume. The gain lane is a separate nonnegative multiplier; avoid treating signed sample height as perceived loudness.

Store strokes in pointer-event order with a tool and normalized points. Do not use pointer travel time as signal time: drawing slowly or quickly must produce the same waveform. Pressure and brush thickness do not alter signal values in v1.

Resolve strokes using the PRD's latest-segment-wins rule. Pencil and line segments overwrite their horizontal interval. Erasing writes zero. A vertical segment writes its final amplitude at that position; at discrete resolution, use a deterministic nearest-bin rule. Clamp coordinates at the domain boundary and keep intermediate segments finite.

Preserve untouched zero-valued regions. Reverse strokes and crossings are edits to one amplitude trace, not simultaneous channels. This is the key restriction that lets a paint-like gesture become a scalar function y = f(x).

Resample only after applying edit semantics. A canonical signal is finite numerical data plus a declared reconstruction rule; it cannot recover detail absent from the drawing. Keep raw strokes so a later resolution change can resample again instead of repeatedly degrading previous samples.

For a periodic signal, do not store both u = 0 and a duplicate u = 1 sample in the transform input. Record visible endpoint/seam information separately. For finite signals, specify the half-open interval [0,T) and a sample count round(T·Fs); show the resulting quantized duration when it differs from T.

## 3. Data model and module boundaries

Suggested modules:

| Module | Responsibility |
| --- | --- |
| editor | Pointer capture, viewport, oscillator selection/colors, waveform/pitch/gain lanes, history, numeric editing |
| signal | Coordinates, stroke resolution, sampling, interpolation, validation |
| analysis | FFT adapter, fitting, error metrics, spectrum |
| audio | Audio context lifecycle, source graph, conditioning, transitions |
| worker | Revisioned jobs, cancellation, progress, transfer ownership |
| export | WAV, CSV, JSON, coefficient and function generation |
| storage | IndexedDB persistence, schema migrations, atomic imports and saved-sound transactions |
| soundboard | Named snapshot/clip entries, pad controls, playback coordination, bounded prepared-audio cache |
| ui | Controls, view selection, accessible status and explanations |

Proposed persisted project fields:

~~~text
schemaVersion, algorithmVersion, projectId, name
activeMode
oscillators: [{
  id, name, colorKey, lineStyle, muted, soloed,
  waveform: { strokes, sourceResolution, smoothing, seamPolicy },
  baseHz, initialPhaseCycles,
  model: { kind, harmonicCount, fitSettings }, selectedSource,
  pitch: { points, baseHz, axis: "logHz", interpolation: "log-linear" },
  gain: { points, interpolation: "linear", initialGain: 1 }
}]
selectedOscillatorId
composition: { durationSeconds, loop, seamPolicy }
timeline: { strokes, durationSeconds, smoothing, loop, seamPolicy }
playback: { monitorGain, conditioningSettings }
exportDefaults: { sampleRate, durationSeconds, format, target }
~~~

Store all three mode workspaces and restore transport as stopped. Each Envelope carrier links to its oscillator's current One-cycle drawing/model; its pitch curve remains independent of that oscillator's scalar base frequency once edited. Persist editable inputs; derived results can be cached but must be recomputed when algorithm versions change. Runtime typed arrays are not serialized as browser-specific objects in portable JSON.

Use Float64Array for coefficient fitting and error analysis, Float32Array at Web Audio boundaries, and signed 16-bit PCM only at WAV encoding. Source data remains unquantized by PCM export. The proposed initial cap is four oscillator voices; the 20,000-point limit is shared across all workspaces and lanes. Enforce the PRD's 20,000-point project limit, periodic grid cap, and import-size limit before allocation.

A derived result includes project ID, relevant oscillator IDs, source revision, settings hash, algorithm version, mode, units, and any applicable sample rate. A cache key must include all of these; pitch and sample rate affect the audio bandwidth even when the drawing has not changed.

## 4. The three mathematical outputs

### A. General source function

Every source has a piecewise-linear evaluator, including shapes with no useful compact formula. For a uniform periodic table, use j = floor(N·u), α = N·u − j, and p(u) = (1−α)·y[j] + α·y[(j+1) mod N]. Wrap phase before lookup.

For finite sample tables, interpolate within [0,T), use a documented final-interval rule, and return zero outside. The initial proposal holds the last sample over its final sample interval; boundary conditioning is part of rendering, not a hidden source edit. Handle exact boundaries and negative t deliberately in exported evaluators.

The evaluator plus its table is a complete function definition. A long array is acceptable when the input is complex; summarize it in the UI and include full data in downloads.

### B. Sine fit

For each candidate integer harmonic m, fit C + a cos(2πm·u) + b sin(2πm·u) against the uniform source samples. In a full periodic grid, the corresponding DFT coefficients provide this least-squares fit. Fit each oscillator independently; an arbitrary multi-oscillator mix is not assumed to be one tone.

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

For each oscillator at a requested f0 and sample rate Fs, retain only harmonic k satisfying k·f0 < Fs/2. The audio path may apply a documented transition band below Nyquist. Rebuild the playable coefficients when f0 or Fs changes, and report the number removed.

Drawing playback uses the full resolved sample representation before audio bandwidth limits; Approximation playback uses the chosen sine/Fourier model. Its model coefficient cap must not silently become a source-data cap.

Set and test the PeriodicWave normalization policy explicitly. The native API maps real coefficients to cosine terms and imaginary coefficients to sine terms; convert from the FFT sign convention above. Keep DC out of the audible oscillator and preserve it in source analysis. [API reference](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createPeriodicWave).

### Finite path

Evaluate the resolved timeline, apply a measured low-pass/resampling method, and produce a mono buffer for AudioBufferSourceNode. Recreate source nodes for each playback; own their cleanup in one transport controller.

Start the technical spike with oversampled evaluation plus a low-pass filter and decimation. Compare a polyphase FIR or FFT-convolution implementation against a high-quality reference. Choose filter length, transition band, and oversampling factor from the quality/performance result; do not assume interpolation alone prevents aliasing.

Proposed spike targets are pass-band ripple ≤ 0.5 dB below 0.4·Fs and stop-band attenuation ≥ 60 dB from 0.5·Fs in the oversampled filter response. Add rendered-signal tests because a good filter response alone does not prove the complete pipeline is free of folded artifacts. Record the accepted spectral thresholds before closing F01.

Loop boundaries need an explicit policy. Preserve the source, show the seam, and store whether a short seam blend was selected. If a blend changes effective period or sample count, reflect that change in timing and metadata.

### Shared output contract

For direct periodic/timeline signals, apply band limiting, DC removal, peak attenuation, a transport envelope, and monitor gain in a versioned order. Envelope composition uses the per-carrier DC/modulation ordering below; mixing applies headroom once to the included voices. For direct signals, define DC removal explicitly from their source/rendered mean rather than introducing an undocumented high-pass filter. For envelope voices, subtract carrier DC before modulation, not the finite mixed-output mean afterward.

Choose attenuation g = min(1, 0.95/P), with g = 1 for silence. P must bound the rendered waveform at the chosen rate, not just the input table. The periodic prototype must validate peak estimates on dense/offline renders and include a conservative bound if required to meet the output ceiling. Never silently normalize quiet signals upward.

Preview and offline export must construct the same source and processing graph, including per-oscillator envelopes, phase, mute/solo, and global mix attenuation. Start/stop ramps are transport behavior; exporting a finite duration includes its own documented start/end ramps. Formula exports identify the unconditioned model, while rendered-output exports reproduce conditioning numerically.

Read Fs from the audio context. WAV exports explicitly request 44.1 or 48 kHz and recompute at that rate. The 480,000-sample cap applies to 10-second, 48 kHz exports; preview allocation uses actual Fs and an explicit memory budget. If an unusual device rate exceeds the budget, report the supported limit rather than silently altering time.

Do not use wall-clock JavaScript timers to generate samples. Schedule audio changes with the audio clock. An AudioWorklet remains a fallback for requirements the native-node prototype cannot satisfy; worker analysis does not run on the real-time audio thread.

## 6. Responsiveness, lifecycle, and failure recovery

Batch visual drawing updates with requestAnimationFrame. Avoid a complete React state update for every high-rate pointer event. Keep history as edit commands/deltas rather than unlimited full audio-buffer snapshots.

Post analysis jobs with increasing revisions. A worker response is accepted only if the source revision and settings still match. Cancellation must interrupt or chunk expensive work; ignoring a result alone does not stop CPU or memory consumption. Transfer large buffers only when the sender relinquishes ownership, or copy deliberately.

Use a small transport state machine: stopped, preparing, playing, stopping, unavailable. Play creates/resumes the audio context from a user action; Stop wins over pending render completion. A late job must never restart playback. Clean up source nodes and ramps when replacing a source, closing a project, or unloading.

For a 10-second, 48 kHz mono buffer, Float32 samples occupy 1,920,000 bytes (about 1.83 MiB). Four oscillator buffers plus a mix occupy about 9.16 MiB before oversampling/analysis overhead; avoid keeping every intermediate buffer alive. Oversampling, Float64 analysis, history, and temporary FFT buffers multiply that cost; account for the whole working set. Target at most 128 MiB of app-owned signal buffers on the baseline desktop and benchmark the worst case.

Show an immediate pending/progress state for slow jobs. On a renderer failure, keep the drawing and last valid analysis; stop unsafe or stale playback and provide a retry action. Storage failure must not prevent in-memory editing or downloading the project.

## 7. Inspection and portable outputs

For a spectrum view, label the horizontal axis in Hz and the vertical axis as component magnitude/level; specify any decibel reference. A spectrum's x coordinate cannot be fed into the waveform's time-coordinate conversion. For a periodic coefficient view, use the same unwindowed cycle as synthesis. For a finite spectrum display, use a documented window such as Hann and report FFT length, frequency spacing Fs/N, and amplitude scaling. A visualization window must not accidentally multiply the actual audio or source data.

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

## 9. Pitch and volume drawing — first-release requirements

The user explicitly included both pitch and volume envelopes in v1. Each oscillator combines its waveform with synchronized gain and pitch curves:

s_j(t) = g_j(t) · p_j(frac(θ_j(t))),  
θ_j(t) = θ0,j + ∫[0…t] f_j(τ) dτ.

Phase θ is in cycles; a sine carrier uses sin(2πθ + φ). Multiplying t by a changing f(t) is generally incorrect: its derivative adds an unintended t·f′(t) term to instantaneous frequency. Preserve phase across knots and rendering chunks.

Pitch is positive, stored in Hz, and drawn on a logarithmic vertical axis. Between knots (ti,fi) and (ti+1,fi+1), use log-linear interpolation. Let τ = t−ti and q = ln(fi+1/fi)/(ti+1−ti):

- f(t) = fi·exp(qτ).
- Integrated phase increment is fi·expm1(qτ)/q.
- In the q → 0 limit, use fi·τ to avoid numerical instability.

Precompute phase increments at knot boundaries, then evaluate arbitrary times from the appropriate prefix plus within-segment integral. This supports exact phase handling for the declared interpolation and reproducible offline/code exports. Validate constant frequency, octave sweeps, near-equal endpoints, split versus unsplit rendering, and exact knot boundaries.

Gain uses linear interpolation between values in [0,1]. It starts at 1; erasing gain writes zero. Untouched pitch retains its base value (initially 440 Hz), and pitch erasure resets to that base, never zero. Editing one oscillator/lane must not modify the others. Shared duration changes stretch every envelope together. Original point limits include all lanes.

The UI should show waveform, pitch, and gain with a shared oscillator identity, common time cursor for envelope views, and visible units. Numeric editing provides exact values when freehand precision is insufficient.

### Rendering implications

Remove each carrier's DC before applying modulation to its audible signal. Retain the original DC in the source function. Do not subtract a finite composition's mean afterward, because that would inject nonzero values into intentionally silent gain intervals.

A native prototype can schedule OscillatorNode frequency automation and GainNode gain automation using the declared interpolation. Compare it against the analytic phase-integrated reference. A custom oversampled buffer renderer or AudioWorklet is warranted if native scheduling, bandwidth handling, or cross-browser fidelity fails the measured criteria.

Pitch and amplitude modulation introduce sidebands. A cutoff derived only from one fixed f0 is insufficient to establish modulation quality. Test fast pitch sweeps, fast gain transitions, high harmonics, and near-Nyquist carriers against an oversampled reference; report the accepted bandwidth/transition policy and any altered output.

Zero gain must not be undone by normalization. Use one attenuation factor for the complete active mix; preserve relative oscillator levels and within-clip dynamics. Document finite filter/transition tails at gain boundaries; an all-zero envelope must render exact silence.

For finite clips, initial phase defaults to zero cycles per oscillator. Looping a clip with a non-integer phase advance can create a seam even when envelope endpoints match. Use the finite-loop seam policy and show any boundary processing rather than claiming phase continuity across an arbitrary loop reset.

Export per-oscillator pitch/gain evaluators, integrated phase, carrier data/model, and complete composition/mix evaluators. Project files must carry all interpolation, phase, timing, carrier-selection, and processing settings.

## 10. Distinct oscillator colors, identity, and mixing

The first release supports multiple oscillators, with a proposed cap of four. A new project starts with one. Each voice has a persistent ID, name, color key, line-style cue, waveform, model selection, base frequency, initial phase, envelopes, mute, and solo.

Assign distinct palette colors to active oscillators. Use the same color for its waveform drawing, pitch curve, gain curve, legend chip, and selection/control accents. Keep colors stable on reorder, save, and reload. Duplication creates a new ID and a different available color; importing a conflicting/invalid palette assignment resolves it deterministically with a visible legend.

Provide labels and line patterns/selection weight alongside color and verify contrast on supported backgrounds. Only the selected oscillator accepts strokes; the others remain inspectable. A selected-only view reduces overlap. Plot visibility is independent of mute, so hiding a curve does not change sound.

The raw mix is s_mix(t) = Σ_j s_j(t) over included voices. Mute always excludes a voice; if any Solo is enabled, include only soloed, unmuted voices. With no included voices, return exact silence. Start included oscillators using one scheduled audio time and preserve their declared relative phases.

Apply global headroom attenuation after mixing and before the shared transport ramp/master monitor gain. Keep it fixed over each rendered clip; per-frame or per-voice loudness normalization would change the requested balance or envelopes. Show any applied attenuation. Crossfade/ramp live mute/solo and model changes so state changes do not create avoidable discontinuities.

Expose colored individual oscillator traces and the final mix in a neutral, heavier line. The primary overlay compares actual signals on a shared time axis, with amplitude vertically. A separately labeled optional phase-domain overlay compares normalized shapes. Higher-frequency cycles become more closely spaced within the same physical time window; a spectrum view instead places their components farther along its frequency axis.

Keep the standalone direct-amplitude Timeline workspace separate from the oscillator bank's output mode. Preserve it while switching modes; do not silently add it as another mixer channel.

Test two identical in-phase oscillators, opposite-phase cancellation, different-frequency beating, muted/soloed combinations, independent envelope edits, all-zero gain, and maximum four-voice renders. Function exports must retain the sum of independent phase functions rather than inventing a shared fundamental.

## 11. First-release decisions to confirm through implementation evidence

The product requirements now include waveform/pitch/volume drawing and distinct oscillator colors. The four-voice limit, resource budgets, browser baseline, palette, and exact renderer/filter remain proposed engineering decisions.

The foundation spike must cover the full four-voice envelope case before its engine choice is considered settled. If performance requires a lower resolution, a different renderer, or a different limit, document the measurement and update the PRD and issues explicitly instead of silently discarding drawing detail or envelope behavior.


## 12. Named soundboard snapshots and replay

Save the currently included mix or standalone Timeline output as a finite, named sound. Capture the source revision, all oscillator/lane settings, inclusion state, active mode, render rate/duration, and algorithm version before the render begins. A saved entry is independent of the live autosaved project.

Suggested entry contract:

~~~text
SoundboardEntry {
  id, name, order, createdAt, updatedAt,
  schemaVersion, algorithmVersion, sourceMode,
  projectSnapshot, renderSettings,
  durationSeconds, sampleRate, channelCount: 1, frameCount,
  audioAssetId, gainStage: "pre-monitor"
}
~~~

Persist metadata/project snapshots and rendered Float32 audio in IndexedDB object stores joined by entry/asset IDs. IndexedDB supports structured data, binary assets, and transactions; this makes it a suitable proposed store for saved sounds. [IndexedDB reference](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

Complete rendering/validation first, then use a short transaction to commit the snapshot, audio asset, and entry metadata together. Do not keep a transaction open while waiting for a worker render. On a failed create/update, preserve the previous board state and current project. Use a pending-save token to prevent accidental duplicate entries; names are editable labels, not primary keys.

The cached clip includes voice selection, phase, envelopes, mixing, bandwidth processing, headroom, and finite boundary treatment. It excludes monitor gain. Pad playback applies the current shared monitor gain once; the saved project's monitor setting remains editable metadata. WAV downloads follow F09's rendered-output convention and apply the selected monitor setting once. This avoids the quieter-than-preview result caused by multiplying monitor gain into both cache and playback.

Use a shared AudioContext and transport arbiter for editor and board playback. A pad plays the prepared buffer using a fresh AudioBufferSourceNode per trigger while reusing the AudioBuffer; source nodes are one-use playback objects. [AudioBufferSourceNode reference](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode). The initial policy is exclusive one-shot playback: a new pad stops editor preview and replaces any active pad. Use short complementary linear ramps for transitions; their summed gain must not introduce a new mix peak above the established ceiling.

Give async load/prepare requests a trigger generation ID. Only the newest still-active trigger may start; Stop, a newer trigger, or navigation cancels the previous intent. Rendering or storage completion alone must never start audio. Reload restores metadata and stopped pads, not previous playback.

Load the board's metadata list first. Keep a byte-bounded least-recently-used cache of prepared buffers within the existing working-set budget; releasing cached buffers must not delete persisted clips. A missing/corrupt asset shows a recoverable error and can be regenerated from its snapshot after explicit action; never silently replace a saved render using a different DSP version.

Open in editor clones the saved snapshot into a working project and retains the displaced draft for recovery. Keep the saved entry unchanged until an explicit Update saved sound succeeds. Save as new sound assigns a new entry ID. Rename/reorder preserve audio identity; remove offers undo and manages both metadata and its audio asset.

Per-entry project and WAV downloads provide portable backup through the existing adapters. Test at least 32 maximum-duration saved sounds without eagerly loading all full audio buffers; this is a validation workload, not a promised unlimited-storage guarantee. Browser quota failures remain recoverable and never justify silent deletion of other sounds.

Validation covers snapshot isolation during concurrent editing, atomic save/update failure, rename/reorder/remove/undo, editor restoration, one-time monitor gain, prepared-pad latency, repeated trigger/Stop races, keyboard activation, and persistence across reload. A sound saved from the four-oscillator envelope mix is part of the integration fixtures.
