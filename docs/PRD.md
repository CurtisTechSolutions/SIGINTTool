# SIGINTTool — Draw a signal, see its function, hear its sound

**Status:** Proposed product requirements; no application has been implemented.  
**Date:** 2026-09-30  
**Repository:** [CurtisTechSolutions/SIGINTTool](https://github.com/CurtisTechSolutions/SIGINTTool)  
**Audience:** Product, design, engineering, and QA.  
**Delivery plan:** [Implementation plan and GitHub backlog](IMPLEMENTATION_PLAN.md).  
**Engineering proposal:** [Technical design](TECHNICAL_DESIGN.md).

## 1. Product intent

SIGINTTool is a browser-based signal sketchpad with the immediacy of Microsoft Paint. A user draws a waveform, sees a mathematical representation of it, and plays the corresponding audio. The first release also lets the user draw pitch and volume envelopes over time and combine multiple oscillators, with a distinct color identifying each oscillator and its curves. Drawing a sine-like wave should produce a sine equation and a recognizable tone. Irregular, jagged, or highly detailed drawings must also produce usable functions and sound.

The product connects three views of the same signal: **drawing → mathematics → audio**. Users can compare them, change parameters, and export the result without writing code or installing a desktop audio application.

An arbitrary drawing does not uniquely identify a simple symbolic equation. The product must distinguish a fitted model from the sampled drawing, report approximation error, and always provide a numerical or piecewise function even when no familiar formula fits.

## 2. Users and desired outcomes

| User | Job to be done | Successful outcome |
| --- | --- | --- |
| Curious learner or educator | Understand how a waveform's shape changes its sound and equation | Draw, hear, and compare a sine and a more complex wave in one session |
| Sound designer or musician | Create unusual single-cycle timbres and short sound effects | Refine a shape and export reproducible audio |
| Engineer or developer | Sketch a test signal and reuse its mathematical representation | Export samples, coefficients, and executable functions with explicit units |

The initial product is a single-user, desktop-first tool. Waveform, pitch, and volume drawing, plus distinct colors for multiple oscillators, are explicitly required for the first release. Other proposed defaults below are product decisions, not confirmed user research or measured performance.

## 3. First-use experience

1. Open the app to a labeled waveform canvas, a short hint, and a visible Play button.
2. Draw a wave, or load a sine, triangle, square, or sawtooth example.
3. See the original stroke, the resolved signal, and the function panel update after the edit.
4. Press Play to enable audio. Adjust pitch in One-cycle mode or duration in Timeline mode; open Envelope mode to draw synchronized pitch and volume curves for the periodic carrier.
5. Inspect the waveform, spectrum, and approximation error. Explicitly choose Drawing or Approximation for playback.
6. Export audio, a project, samples, or functions.

Default mode is **One-cycle**, with one oscillator at **440 Hz**; users can add up to four oscillators in the proposed initial limit. Audio remains stopped until the user starts it. The example 0.8 sin(2π·440t + π/6) + 0.1 is a source function in seconds; its DC offset and playback processing are separately identified.

## 4. Scope and signal semantics

### One-cycle mode

The horizontal axis spans one repeating period, represented internally by phase u in [0,1). The vertical axis is normalized amplitude in [-1,1]. Each oscillator has a repetition frequency f0; its source is x(t) = p(frac(f0·t)). Multiple oscillators retain independent frequencies and phases and are summed for the output.

One sine cycle at f0 = 440 Hz produces a 440 Hz tone. Two equal sine cycles across the canvas produce a dominant tone at 880 Hz, even though the canvas repeats 440 times per second. The UI must distinguish repetition frequency from detected tone frequency.

### Timeline mode

The horizontal axis is actual time t in [0,T). Drawing height is the instantaneous signal amplitude, not a loudness envelope applied to an undisclosed carrier. Duration defaults to 100 ms and can range from 1 ms to 10 seconds. The signal plays once or repeats only when Loop is selected. Values outside the finite signal are zero for numerical exports.

A single slow curve over several seconds may be mostly sub-audible. Explain this in context; never silently reinterpret it as a pitched oscillator. Changing duration stretches the drawing and therefore changes its frequency content.

### Envelope mode

A finite composition combines up to four One-cycle waveforms as carriers. Each oscillator has two synchronized time lanes: pitch in Hz and volume as linear gain from 0 to 1. Duration defaults to 2 seconds, supports 1 ms to 10 seconds, and is shared by both lanes. Pitch defaults to a constant 440 Hz and volume to a constant gain of 1. The pitch lane uses a logarithmic vertical scale with Hz labels; interpolation is linear in log-frequency. Volume interpolation is linear in amplitude.

The source composition is s(t) = g(t) · p(frac(θ(t))), where θ(t) = θ0 + ∫₀ᵗ f(τ) dτ in cycles. Frequency must be integrated so the carrier phase remains continuous during pitch changes. The original source and the conditioned audio remain distinguishable.

Each carrier shape is linked to that oscillator's current One-cycle drawing or selected approximation. An oscillator keeps the same color and label in its waveform, pitch lane, volume lane, legend, and controls. Its shape edits update the composition; One-cycle's scalar pitch does not overwrite an already edited pitch lane. Timeline mode remains direct amplitude drawing. Mode changes preserve all three workspaces; reinterpretation or copying shows the new axis units explicitly.

### Release boundaries

| In the first release | Deferred |
| --- | --- |
| Up to four color-coded oscillators into a mono mix, or a standalone direct signal; freehand/numeric editing | Unlimited tracks, stereo authoring, collaboration |
| Periodic and finite-duration signals, irregular shapes, synchronized pitch/volume envelopes | Very long recordings, streaming synthesis projects |
| Sine fitting, periodic Fourier approximations, general piecewise functions | General symbolic regression, automatic identification of every waveform family |
| Browser playback, spectrum, WAV/CSV/JSON and JavaScript/Python exports | MIDI, plugins, hardware signal generators, RF transmission or capture |
| Browser-local projects and project-file import/export | Accounts, cloud storage, sharing services, audio/image tracing imports |

"Complex" means arbitrary supported shapes within explicit resolution, duration, and bandwidth limits. It does not mean infinite detail or a guaranteed compact closed-form equation.

## 5. Functional requirements

### F01 — Browser foundation and a shared signal model

Use a versioned data contract shared by editing, analysis, rendering, persistence, and export. Separate original stroke data, resolved source samples, approximation coefficients, and conditioned audio. Every derived result carries the source revision and settings used to generate it; stale results cannot replace current work.

The app must work from static hosting with client-side processing and without login or a runtime backend. Include oscillator IDs/names/colors, waveform/pitch/gain lane contracts, mute/solo, per-oscillator phase and model selection, units, bounds, interpolation, and shared timing. Keep signal math independent of UI and audio APIs. Select and document the UI framework and build tools during foundation work rather than treating the template as an existing application.

### F02 — Paint-like waveform editor

Provide a visible zero line, labeled axes, pencil, line, eraser, clear, zoom/pan, grid snapping, and at least 50 reversible edits within a documented memory budget. Mouse and pen must work; basic touch drawing must not scroll the page during a stroke. Pointer Events provide a common input model for mouse, pen, and touch. [API reference](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).

For each oscillator's waveform lane, the editor creates one amplitude per horizontal position. Only the selected oscillator is edited; other oscillator curves remain visible in their own colors. Envelope lanes use the distinct defaults and eraser rules in F13. A later stroke replaces values only over the horizontal positions it touches. Traversing backward also follows event order: the latest segment wins. Vertical segments resolve to their final value at that position. Untouched regions remain zero; erasing sets the affected region to zero. Brush thickness and pressure are visual aids and do not encode extra amplitude.

Store coordinates independently of screen pixels so resizing, zooming, and display density do not change the signal. Show the resolved curve immediately so overlap behavior is visible. Clear and preset replacement are undoable. Provide editable numeric points and keyboard controls as an alternative to freehand drawing.

### F03 — Deterministic drawing-to-signal conversion

Map canvas geometry into the declared phase/time and amplitude domain. Resolve stroke order before uniformly resampling; use documented piecewise-linear interpolation by default. Retain the original drawing when resampling or applying optional smoothing.

Each oscillator's One-cycle sampling defaults to 4,096 samples and supports up to 16,384. Sample phase at n/N for n = 0…N−1, without duplicating the period endpoint. Timeline audio supports 44,100 and 48,000 samples/second for exports, with at most 480,000 output samples. Limit original input to 20,000 points per project and report limits before destructive changes.

Handle empty canvases, flat/DC signals, gaps, duplicate positions, non-finite values, clipping, and out-of-bounds input deterministically. Distinguish sample rate from canvas resolution; a higher audio sample rate cannot recover missing drawing detail.

### F04 — Readable sine recognition

For each periodic oscillator, offer a best-fit single sinusoid with offset:

x_fit(t) = C + A sin(2π·f·t + φ).

Report A, C, f in Hz, φ in radians, and reconstruction error. Search supported integer harmonics of the canvas repetition rate, rather than forcing f = f0. A proposed initial search covers harmonics 1…64, bounded by source resolution.

Use normalized RMS error (NRMSE) = RMS(source − model) / max(RMS(source − mean(source)), 10^-6). Initially label a non-flat signal "Sine fit" when NRMSE ≤ 10%; show the measured value, not a fabricated probability. Treat near-flat signals as constant/silence and exclude them from recognition. Tune the threshold using hand-drawn fixtures before release.

Always keep the drawing available. Recognition never silently replaces it. Generated clean sine fixtures must recover amplitude and frequency within 1% and phase within 0.01 radians modulo 2π; noisy and non-sine fixtures exercise rejection.

### F05 — Mathematical functions for arbitrary shapes

Every valid drawing produces a reusable piecewise-linear source evaluator with explicit domain, interpolation, and boundary rules. For adjacent distinct knots (ti,yi), use x(t) = yi + (yi+1 − yi)·(t − ti)/(ti+1 − ti). Export the knots or samples required to evaluate it. Periodic evaluators wrap phase; finite evaluators return zero outside their domain.

Each periodic oscillator additionally supports a Fourier approximation:

x_K(t) = C + Σ[k=1…K] { ak cos(2πk f0 t) + bk sin(2πk f0 t) }.

Expose a harmonic-count control, initially 64 with a maximum of 1,024 and further bounds from source resolution. Report NRMSE and maximum absolute error against the source on the same evaluation grid. Show coefficients and a reconstruction overlay. A full numerical representation remains available when a compact approximation is poor.

Specify FFT scaling, sign, DC, and the special even-length Nyquist coefficient in the DSP contract. A transform library's normalization must be accounted for; the [NumPy DFT reference](https://numpy.org/doc/stable/reference/routines.fft.html) is a useful independent convention reference, not a requirement to use Python in the app.

A mix retains a sum of its per-oscillator functions; do not assume different oscillator frequencies share a useful single period. Do not label a finite timeline's Fourier transform as a globally periodic formula. Its general output remains the finite piecewise/numerical function. Generated functions are exports; imported project files never execute code.

### F06 — Periodic audio and playback controls

Provide shared Play/Stop/master volume, per-oscillator mute/solo and repetition frequency, and an explicit Drawing/Approximation source selector for each oscillator. Frequency defaults to 440 Hz and allows 20–20,000 Hz subject to being strictly below half the actual audio sample rate. Changing the fit or harmonic slider must not change the selected playback source implicitly.

Use the browser's actual audio-context sample rate for preview. Web Audio supports custom periodic signals through PeriodicWave and OscillatorNode; account for its coefficient conventions and optional normalization explicitly. [PeriodicWave reference](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createPeriodicWave).

Playback requires an intentional user action and must handle suspended or unavailable audio gracefully. Browser autoplay restrictions make this a required interaction. [Autoplay reference](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

For direct periodic/timeline signals, apply a documented output path: selected source → band limiting → DC removal → peak attenuation if necessary → transport envelope → monitor gain. Envelope compositions use the carrier/modulation ordering in F14. Preserve source values and formulas. Report removed DC, attenuated peaks, and omitted frequency content in the output view. Do not boost quiet signals automatically. Set default monitor gain to 0.1, maximum 1, and bound conditioned peaks to 0.95 before monitor gain. These are digital levels, not a guarantee about a user's listening volume.

Use 5 ms start/stop ramps, bounded by half the duration for short signals; source changes crossfade over at least 5 ms. Account for envelope and boundary processing in exported rendered audio. Harmonics at or above Nyquist must not be naively folded into the audible band. Show periodic seam discontinuities; optional seam repair is explicit and undoable.

### F07 — Finite audio, looping, and asynchronous rendering

Render finite Timeline signals at the target sample rate with an explicit low-pass/resampling strategy. Support one-shot playback and an optional loop. Expose duration and playhead in seconds. Preserve pitch/time meaning when changing duration.

Condition discontinuous boundaries consistently with F06. An enabled loop uses a documented seam treatment and displays its effect. Keep rendering responsive, show progress for long jobs, allow cancellation, and ignore obsolete results after new edits. Empty or DC-only output results in a clear silent state.

### F08 — Signal and output inspection

Show source, selected approximation, and rendered output as distinguishable views with matching units and a clear legend. In Envelope mode, show synchronized pitch/gain lanes and rendered audio, and identify all active carriers. Individual oscillator traces retain their colors; the combined output uses a distinct neutral style. Include spectrum, sample rate, duration or repetition frequency, peak, RMS, DC offset, harmonic count where relevant, and approximation error.

A "What you hear" summary identifies playback source and active processing. Changing pitch can remove previously playable harmonics; explain this without changing the source equation. DC is displayed in the source analysis even when excluded from audio. The spectrum must state its analysis window and scaling.

### F09 — Reproducible exports

Support mono 16-bit PCM WAV at 44.1 or 48 kHz for the current mix or an explicitly selected oscillator; periodic audio exports require a finite duration, default 2 seconds and maximum 10 seconds. Default WAV export follows the selected audio source and output settings, including monitor gain and start/end envelopes.

Provide CSV samples with time in seconds and an explicit Source or Rendered output choice. Envelope-mode exports also include pitch_Hz, gain, carrier selection, interpolation rules, and initial phase. Export JSON projects and coefficients with schema/algorithm versions, units, resolution, sample rate, duration, and all processing settings needed to reproduce results.

Export complete JavaScript and Python source evaluators, including required data and usage examples. For Envelope mode, include pitch/gain evaluators and a phase-integrated composition function; never approximate changing pitch as f(t) multiplied by t. Identify source, sine fit, and Fourier approximation explicitly. Offer a numerical rendered-output evaluator when the user wants the conditioned waveform; do not present the unconditioned source equation as the exact played audio.

Preview and export share the same DSP contract. When sample rates differ, show that fact and recompute the output at the requested rate. Do not promise bit-identical behavior across operating-system audio hardware.

### F10 — Local project persistence

Autosave the current project locally after edits and restore it after reload with playback stopped. Show save status and a recoverable quota/unavailable-storage error. Support named project JSON download/upload, with schema validation, finite-number/range checks, a 10 MiB file-size limit, and atomic replacement only after validation succeeds.

Projects retain all three mode workspaces, oscillator IDs/names/colors, original drawings, per-oscillator pitch/gain lanes, mute/solo, shared duration, carrier linkage, initial phase, interpolation settings, and selected approximations. A schema round trip reproduces source samples and functions. Browser-local data can be cleared by the browser; downloadable project files are the portable backup.

### F11 — Accessible onboarding and failure states

Ship labeled controls, visible keyboard focus, shortcuts, numeric point editing, text versions of equations/metrics, and status announcements. Color must not be the only way to distinguish curves. Respect reduced motion for decorative animation.

Explain phase versus time, waveform versus envelope drawing, Hz versus linear gain, source versus rendered audio, and low-frequency silence in context. Provide useful recovery for invalid imports, unsupported audio, renderer failures, exhausted limits, and unavailable storage. Test the core create → edit → hear → export path using keyboard and numeric editing.

### F12 — Validation and release readiness

Maintain deterministic fixtures for sine (offset/phase/harmonics), triangle, square, sawtooth, silence, DC, irregular multi-harmonic drawings, repeated x positions, discontinuities, and finite pulses/chirps. Include maximum-size projects, corrupt imports, and rapid edit/play/stop sequences. Add constant/ramped pitch, logarithmic frequency sweeps, attack/decay gain, silent gain intervals, and combined envelope fixtures.

Test unit-level math, browser integration, export round trips, and manually audible behavior. Use current stable Chrome/Edge, Firefox, and Safari at release; record exact versions, OS, hardware, and sample rates. A headless WebKit pass alone is not a Safari audio sign-off.

### F13 — Synchronized pitch and volume drawing

Add pitch and volume lanes per oscillator under a shared timeline, with pencil, line, numeric knots, selection, eraser, and undo/redo. Reuse the editor's ordering and viewport rules with lane-specific units and validation. Pitch is bounded to 20–20,000 Hz, further restricted for playback by actual sample rate; it never takes zero or negative values. The initial logarithmic axis and interpolation are explicit in the UI and exports.

Untouched pitch remains the lane's base pitch, initially 440 Hz, and pitch erasure resets to that value. Untouched gain is 1; gain erasure writes 0 to mute. Existing lane values outside an edited interval are preserved. All lanes share cursor, zoom, duration, and playhead; editing one lane or oscillator must not change another. Use the oscillator's same color across its waveform, pitch, and volume curves, with labels and line-style/selection cues.

Provide an editable pitch sweep and an attack/decay gain example. Limit total original points across all workspaces/lanes to 20,000. Changing duration stretches both envelopes consistently. Numeric editing and keyboard interaction must support both lanes.

### F14 — Phase-continuous envelope synthesis

Render each selected periodic carrier using its own integrated pitch and time-varying gain, then combine active oscillator signals according to F15. Preserve accumulated phase at pitch-knot boundaries and when evaluating arbitrary times; a constant envelope must reproduce the equivalent unmodulated carrier. In finite exports, initialize phase explicitly, default θ0 = 0 cycles, and return zero outside the composition interval.

Remove the carrier's DC component before modulation; preserve that component in source mathematics. Do not subtract the composition's finite mean afterward, which would refill zero-gain intervals. Generate the modulated signal with a measured bandwidth strategy that considers modulation sidebands, not only a static harmonic cutoff. Report any boundary/antialias filtering that changes the rendered signal.

Apply one attenuation factor for the whole rendered mix if required for headroom, then the transport envelope and monitor gain. Do not normalize per frame or cancel intentional gain changes. Preserve zero-gain spans except for explicitly documented finite filter/transition tails at their boundaries; constant-zero gain renders exact silence.

Playback, WAV, numerical exports, source/approximation comparisons, and persistence must share the same carrier, pitch curve, gain curve, initial phase, duration, interpolation, and processing settings. Envelope edits use the same revision/cancellation rules as other rendering. Finite looping follows the documented seam policy; arbitrary total phase advance does not imply a seamless loop.

### F15 — Distinct oscillator colors and a controlled mix

Support one to four oscillator voices in the proposed initial release. Each has a persistent ID, editable name, distinct color, waveform/model, base pitch, initial phase, pitch/gain envelopes, and mute/solo state. Add, duplicate, remove, reorder, and restore operations are undoable. Reordering or selecting a voice must not change its identity or color; duplicating assigns a new ID and a different available color.

Use consistent colors across every line/drawing and control belonging to that oscillator. Show a legend, labels, and distinguishable line/selection styles so color is not the sole identifier. Check contrast against the canvas and allow a selected-oscillator-only view for crowded drawings. Toggling plot visibility must not mute sound.

Only the selected oscillator receives drawing edits. A shared transport starts all included oscillators on the same audio clock. Mute excludes a voice; when any Solo is enabled, include only soloed voices that are not muted. All-muted or no-included-voice states produce exact silence. The standalone Timeline workspace is an alternative output mode and is not silently added to the oscillator mix.

The source mix is s_mix(t) = Σ_j s_j(t) over included voices. Preserve per-oscillator functions and export a complete sum/evaluator for the mix. Apply global headroom control without per-voice/per-frame normalization that would erase relative volumes or envelopes. Display the applied attenuation, and use short ramps for live mute/solo/source changes. A mix of different frequencies must not be labeled a single periodic waveform unless that relationship is actually established.

## 6. Performance and quality targets

These are acceptance targets to validate, not claims about an existing implementation. Establish a representative desktop baseline in F01.

| Measure | Initial target |
| --- | --- |
| New-user activation | At least 4 of 5 formative-test users draw a wave, hear it, and find its function within 2 minutes without coaching |
| Drawing feedback | p95 input-to-visible-update ≤ 50 ms in the baseline environment |
| Periodic conversion and analysis | p95 ≤ 150 ms per edited oscillator after stroke end at 16,384 samples |
| Maximum finite render, including a four-oscillator envelope mix | p95 ≤ 2 seconds for 10 seconds at 48 kHz; progress and cancellation available |
| Stop interaction | Control responds ≤ 100 ms; audio stops after the scheduled short ramp, allowing documented device latency |
| Numerical function export | Source evaluators match canonical source values within 10^-6 absolute error at fixture evaluation points |
| WAV correctness | Header, duration, channels, sample rate, bounds, and samples agree with the rendered fixture within 1 PCM quantization step |
| Playback stability | No stuck sound or accumulating audio nodes across 100 start/stop/edit cycles |

For bandwidth handling, include spectral tests of high-pitch discontinuous waves against an oversampled, low-pass reference. Set a measurable stop-band target in the foundation spike and document it before audio implementation is accepted. Do not use "no aliasing" as an unmeasurable promise.

Collect usability results through a small documented pilot. Remote behavioral analytics and uploading drawings/audio are outside the initial scope.

## 7. Suggested implementation boundaries

The implementation should separate editor state, a pure TypeScript signal/DSP library, a worker for expensive analysis/rendering, Web Audio adapters, and import/export/persistence adapters. UI state and derived analysis use revision identifiers.

Prefer established Web Audio nodes initially; introduce an AudioWorklet only if the measured rendering/interaction requirements justify it. OfflineAudioContext can render an audio graph into a buffer without playing it. [API reference](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext). Browser audio behavior should be tested against the [Web Audio Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/), without depending on new draft-only APIs.

Keep raw/source data and audio processing metadata together so every view and export can explain its relationship to the drawing.

## 8. Repository baseline and delivery

At review, the default branch contains a template README, empty CONTRIBUTING.md, a license, a template changelog, and two GitHub Actions workflows. It has no application source, dependency manifest, tests, or issue backlog.

The existing Docker workflow builds on version tags but the repository has no Dockerfile. The release-please workflow references a configured secret whose availability has not been checked. Foundation work must reconcile these inherited workflows with the chosen static-app build and add pull-request validation before relying on releases. This planning change does not alter those workflows.

Delivery proceeds through four gates; the linked implementation plan maps each requirement to an issue:

1. **M0 — Foundation:** contracts, fixtures, baseline hardware, technical spike, and app/CI skeleton.
2. **M1 — Draw, describe, hear:** editor, conversion, sine fit, complex periodic functions, and periodic audio.
3. **M2 — Complex workflows and reuse:** timeline audio, pitch/volume lanes and synthesis, distinct oscillator colors and mixing, inspection, exports, and local persistence.
4. **M3 — Release candidate:** onboarding/accessibility and integrated numerical, browser, performance, and usability evidence.

All F01–F15 are required for the first complete release. P0 issues establish the core path; P1 issues complete the release. Priorities are sequencing aids, not permission to omit release requirements.

## 9. Risks and decisions to revisit

| Risk or uncertainty | Initial decision / validation |
| --- | --- |
| Freehand paths can contain multiple y values at one x | Latest stroke/segment wins; expose the resolved signal and test it with users |
| Users expect every drawing to have a short equation | Always supply numerical functions; label and quantify approximations |
| Drawn discontinuities and limited samples alter sound | Band-limit explicitly, show rendered output, retain source and processing metadata |
| Long timelines and overlapping curves hide details | Zoom, numeric editing, distinct oscillator colors/labels, and selected-only views; region sequencing later |
| Browser/hardware audio differences | Actual-rate reporting, shared DSP, browser matrix, fixture-based comparisons |
| Initial resolution and recognition thresholds may not fit real use | Pilot with learners and sound designers; record changes to this PRD before expanding scope |
| Local browser storage is not durable backup | Visible save status and portable project export |

Open product follow-ups are audience emphasis (learning versus sound design), demand for mobile editing, and whether to raise the proposed four-oscillator limit or add region sequencing next. Pitch/volume drawing and distinct oscillator colors are first-release requirements. They do not block the proposed first-release scope.
