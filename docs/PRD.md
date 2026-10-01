# SIGINTTool — Draw a signal, see its function, hear its sound

> Implementation is now available on `main`. These documents retain the agreed requirements and original design recommendations. Actual choices, supported boundaries and evidence are in [ENGINEERING_DECISIONS.md](ENGINEERING_DECISIONS.md) and [VALIDATION.md](VALIDATION.md); use [USER_GUIDE.md](USER_GUIDE.md) to run the app.

**Status:** Proposed product requirements; no application has been implemented.  
**Date:** 2026-09-30  
**Repository:** [CurtisTechSolutions/SIGINTTool](https://github.com/CurtisTechSolutions/SIGINTTool)  
**Audience:** Product, design, engineering, and QA.  
**Delivery plan:** [Implementation plan and GitHub backlog](IMPLEMENTATION_PLAN.md).  
**Engineering proposal:** [Technical design](TECHNICAL_DESIGN.md).

## 1. Product intent

SIGINTTool is a browser-based signal sketchpad with the immediacy of Microsoft Paint. A user draws a waveform, sees a mathematical representation of it, and plays the corresponding audio. The first release also lets the user draw pitch and volume envelopes over time and combine multiple oscillators, with a distinct color identifying each oscillator and its curves. Drawing a sine-like wave should produce a sine equation and a recognizable tone. Irregular, jagged, or highly detailed drawings must also produce usable functions and sound.

The product connects three views of the same signal: **drawing → mathematics → audio**. Users can compare them, change parameters, export the result, save finished sounds to a named soundboard, and use a locally imported audio file or saved clip to modulate another sound. The workflow supports replay and later editing without writing code or installing a desktop audio application.

An arbitrary drawing does not uniquely identify a simple symbolic equation. The product must distinguish a fitted model from the sampled drawing, report approximation error, and always provide a numerical or piecewise function even when no familiar formula fits.

## 2. Users and desired outcomes

| User | Job to be done | Successful outcome |
| --- | --- | --- |
| Curious learner or educator | Understand how a waveform's shape changes its sound and equation | Draw, hear, and compare a sine and a more complex wave in one session |
| Sound designer or musician | Create unusual single-cycle timbres and short sound effects | Refine a shape and export reproducible audio |
| Engineer or developer | Sketch a test signal and reuse its mathematical representation | Export samples, coefficients, and executable functions with explicit units |

The initial product is a single-user, desktop-first tool. Waveform, pitch, and volume drawing, distinct colors for multiple oscillators, a soundboard, and modulation driven by imported audio or another clip are required for the first release. Other proposed defaults below are product decisions, not confirmed user research or measured performance.

## 3. First-use experience

1. Open the app to a labeled waveform canvas, a short hint, and a visible Play button.
2. Draw a wave, or load a sine, triangle, square, or sawtooth example.
3. See the original stroke, the resolved signal, and the function panel update after the edit.
4. Press Play to enable audio. Adjust pitch in One-cycle mode or duration in Timeline mode; open Envelope mode to draw synchronized pitch and volume curves for the periodic carrier.
5. Inspect the waveform, spectrum, and approximation error. Explicitly choose Drawing or Approximation for playback.
6. Optionally select a carrier, choose an imported audio file or saved clip as its modulator, and compare volume-follow, ring, or pitch modulation with bypass.
7. Save the current sound to the soundboard, name it, and replay it from its button; reopen it for editing when needed.
8. Export audio, a project, samples, or functions, including the audio assets required by a saved sound's portable backup.

Default mode is **One-cycle**, with one oscillator at **440 Hz**; users can add up to four oscillators in the proposed initial limit. Audio remains stopped until the user starts it. The example 0.8 sin(2π·440t + π/6) + 0.1 is a source function in seconds; its DC offset and playback processing are separately identified.

## 4. Scope and signal semantics

### Display axes

The primary drawing canvas is a waveform view: **left to right is time; up/down is signed amplitude**. Time and frequency are different quantities and must have separate, explicitly labeled views.

| View or lane | Horizontal axis | Vertical axis |
| --- | --- | --- |
| Waveform drawing / rendered waveform | Time, in seconds or milliseconds | Signed amplitude, centered at zero |
| Spectrum inspection | Frequency, in Hz | Magnitude/level of each frequency component, with scale/reference shown |
| Volume envelope | Time, in seconds or milliseconds | Linear gain, 0–1 |
| Pitch envelope | Time, in seconds or milliseconds | Pitch frequency, in Hz |

Within a fixed time window, closer waveform cycles indicate higher frequency and wider cycles indicate lower frequency. Increasing the waveform's excursion on both sides of zero increases amplitude; moving the entire waveform upward adds a DC offset instead. Amplitude influences loudness, but signed sample height is not itself a volume reading.

Each oscillator keeps its assigned color in every applicable view. The spectrum is an explicitly selected inspection view; frequency-axis drawing is not required for this release. Pitch and volume remain separate, clearly labeled envelope lanes.

### One-cycle mode

The primary One-cycle editor labels its horizontal axis as elapsed time across the selected oscillator's period [0,1/f0), in milliseconds or seconds. At 440 Hz, one period spans approximately 2.273 ms. Internally the shape remains normalized phase u in [0,1), with t = u/f0; the vertical axis is signed amplitude in [-1,1]. Each oscillator has a repetition frequency f0 and source x(t) = p(frac(f0·t)). Multiple oscillators retain independent frequencies and phases and are summed for the output. An optional phase-normalized shape-comparison view must be explicitly labeled as such; time-domain overlays use a common physical time window.

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
| Browser-local projects, named soundboard saves/replay, and per-sound audio/project downloads | Accounts, cloud storage, sharing services, image tracing imports |
| Local WAV/MP3 imports and saved clips as modulation sources; volume follow, ring, and pitch modulation | Live microphone input, vocoding, convolution, time-preserving pitch shifting, recursive modulation graphs |

"Complex" means arbitrary supported shapes within explicit resolution, duration, and bandwidth limits. It does not mean infinite detail or a guaranteed compact closed-form equation.

## 5. Functional requirements

### F01 — Browser foundation and a shared signal model

Use a versioned data contract shared by editing, analysis, rendering, persistence, and export. Separate original stroke data, resolved source samples, approximation coefficients, and conditioned audio. Every derived result carries the source revision and settings used to generate it; stale results cannot replace current work.

The app must work from static hosting with client-side processing and without login or a runtime backend. Include oscillator IDs/names/colors, waveform/pitch/gain lane contracts, mute/solo, per-oscillator phase and model selection, units, bounds, interpolation, and shared timing. Keep signal math independent of UI and audio APIs. Select and document the UI framework and build tools during foundation work rather than treating the template as an existing application.

### F02 — Paint-like waveform editor

Provide a visible zero line, a horizontal time axis in seconds/milliseconds, a vertical signed-amplitude axis, pencil, line, eraser, clear, zoom/pan, grid snapping, and at least 50 reversible edits within a documented memory budget. Keep axis meaning explicit when changing views or zoom; do not use an ambiguous combined Time/Frequency axis label. Mouse and pen must work; basic touch drawing must not scroll the page during a stroke. Pointer Events provide a common input model for mouse, pen, and touch. [API reference](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).

For each oscillator's waveform lane, the editor creates one amplitude per horizontal position. Only the selected oscillator is edited; other oscillator curves remain visible in their own colors. Envelope lanes use the distinct defaults and eraser rules in F13. A later stroke replaces values only over the horizontal positions it touches. Traversing backward also follows event order: the latest segment wins. Vertical segments resolve to their final value at that position. Untouched regions remain zero; erasing sets the affected region to zero. Brush thickness and pressure are visual aids and do not encode extra amplitude.

Store coordinates independently of screen pixels so resizing, zooming, and display density do not change the signal. Show the resolved curve immediately so overlap behavior is visible. Clear and preset replacement are undoable. Provide editable numeric points and keyboard controls as an alternative to freehand drawing.

### F03 — Deterministic drawing-to-signal conversion

Map the visible time coordinates and signed amplitude into the signal domain; for the One-cycle source convert elapsed time to internal phase with u = f0·t. A spectrum's frequency coordinate is not a source-sample time coordinate. Resolve stroke order before uniformly resampling; use documented piecewise-linear interpolation by default. Retain the original drawing when resampling or applying optional smoothing.

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

For direct periodic/timeline signals, apply a documented output path: selected source → band limiting → DC removal → peak attenuation if necessary → transport envelope → monitor gain. Envelope compositions use the carrier/modulation ordering in F14; clip-driven effects use F18 and must not have their finite mean subtracted afterward. Preserve source values and formulas. Report removed DC, attenuated peaks, and omitted frequency content in the output view. Do not boost quiet signals automatically. Set default monitor gain to 0.1, maximum 1, and bound conditioned peaks to 0.95 before monitor gain. These are digital levels, not a guarantee about a user's listening volume.

Use 5 ms start/stop ramps, bounded by half the duration for short signals; source changes crossfade over at least 5 ms. Account for envelope and boundary processing in exported rendered audio. Harmonics at or above Nyquist must not be naively folded into the audible band. Show periodic seam discontinuities; optional seam repair is explicit and undoable.

### F07 — Finite audio, looping, and asynchronous rendering

Render finite Timeline signals at the target sample rate with an explicit low-pass/resampling strategy. Support one-shot playback and an optional loop. Expose duration and playhead in seconds. Preserve pitch/time meaning when changing duration.

Condition discontinuous boundaries consistently with F06. An enabled loop uses a documented seam treatment and displays its effect. Keep rendering responsive, show progress for long jobs, allow cancellation, and ignore obsolete results after new edits. Empty or DC-only output results in a clear silent state.

### F08 — Signal and output inspection

Show source, selected approximation, and rendered output as distinguishable views with matching units and a clear legend. In Envelope mode, show synchronized pitch/gain lanes and rendered audio, and identify all active carriers. Individual oscillator traces retain their colors; the combined output uses a distinct neutral style. Include spectrum, sample rate, duration or repetition frequency, peak, RMS, DC offset, harmonic count where relevant, and approximation error.

A "What you hear" summary identifies playback source and active processing. Changing pitch can remove previously playable harmonics; explain this without changing the source equation. DC is displayed in the source analysis even when excluded from audio. The spectrum has a horizontal Hz axis and vertical component magnitude/level; it must state its analysis window, scaling, and any dB reference. Waveform views retain time horizontally and signed amplitude vertically. On a common fixed time window, higher frequency shows more closely spaced cycles; amplitude scaling expands both positive and negative excursions around zero.

### F09 — Reproducible exports

Support mono 16-bit PCM WAV at 44.1 or 48 kHz for the current mix or an explicitly selected oscillator; periodic audio exports require a finite duration, default 2 seconds and maximum 10 seconds. Default WAV export follows the selected audio source and output settings, including monitor gain and start/end envelopes.

Provide CSV samples with time in seconds and an explicit Source or Rendered output choice. Envelope-mode exports also include pitch_Hz, gain, carrier selection, interpolation rules, and initial phase. Export JSON projects and coefficients with schema/algorithm versions, units, resolution, sample rate, duration, and all processing settings needed to reproduce results.

Export complete JavaScript and Python source evaluators, including required data and usage examples. For Envelope mode, include pitch/gain evaluators and a phase-integrated composition function; never approximate changing pitch as f(t) multiplied by t. Identify source, sine fit, and Fourier approximation explicitly. Offer a numerical rendered-output evaluator when the user wants the conditioned waveform; do not present the unconditioned source equation as the exact played audio.

Projects with F17 audio assets use a self-contained project bundle; asset-free JSON remains supported. F18 exports retain the carrier/modulator data, timing, mode, depth, and phase/readhead rules. Code exports include complete sample data or companion files and loaders; browser-local asset IDs alone are not portable functions.

Preview and export share the same DSP contract. When sample rates differ, show that fact and recompute the output at the requested rate. Do not promise bit-identical behavior across operating-system audio hardware.

### F10 — Local project persistence

Autosave the current project locally after edits and restore it after reload with playback stopped. Show save status and a recoverable quota/unavailable-storage error. Support named project JSON download/upload, with schema validation, finite-number/range checks, a 10 MiB file-size limit, and atomic replacement only after validation succeeds.

Projects retain all three mode workspaces, oscillator IDs/names/colors, original drawings, per-oscillator pitch/gain lanes, mute/solo, shared duration, carrier linkage, initial phase, interpolation settings, and selected approximations. A schema round trip reproduces source samples and functions. The current editable project and F16 soundboard entries have separate identities; autosaving the current project must never overwrite a saved sound. Browser-local data can be cleared by the browser; downloadable project files are the portable backup. F17 adds immutable audio assets and self-contained bundles; F18 adds modulation routing/settings. Required assets belong to the saved snapshot even if the original imported file or source soundboard pad disappears.

### F11 — Accessible onboarding and failure states

Ship labeled controls, visible keyboard focus, shortcuts, numeric point editing, text versions of equations/metrics, and status announcements. Color must not be the only way to distinguish curves. Respect reduced motion for decorative animation.

Explain time versus frequency views, internal phase versus displayed time, signed amplitude versus volume gain, DC offset versus amplitude scaling, waveform versus envelope drawing, source versus rendered audio, and low-frequency silence in context. Provide useful recovery for invalid imports, unsupported audio, renderer failures, exhausted limits, and unavailable storage. Test the core create → edit → hear → export path using keyboard and numeric editing. Include file selection, numeric trim/offset, carrier/modulator selection, effect controls, bypass, and save/reopen. Explain that volume follow, bipolar ring modulation, and pitch/varispeed are different effects; a modulator is not automatically mixed into the audible output.

### F12 — Validation and release readiness

Maintain deterministic fixtures for sine (offset/phase/harmonics), triangle, square, sawtooth, silence, DC, irregular multi-harmonic drawings, repeated x positions, discontinuities, and finite pulses/chirps. Include maximum-size projects, corrupt imports, and rapid edit/play/stop sequences. Add constant/ramped pitch, logarithmic frequency sweeps, attack/decay gain, silent gain intervals, and combined envelope fixtures. F17/F18 additionally require decoder/asset round trips, modulation identities and sidebands, varispeed readhead checks, route timing, asset isolation, and maximum-resource modulation renders.

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

### F16 — Save sounds to a soundboard

Provide a **Save to soundboard** action for the current audible output: the included oscillator mix with its pitch/volume envelopes, the standalone Timeline signal, or the F18 modulated result. Let the user name the sound and see its duration before saving. One-cycle sounds use a finite capture duration, default 2 seconds and maximum 10 seconds; finite modes use their selected duration within the existing limits. Saving does not autoplay or replace the working project.

Each entry stores an independent editable project snapshot and a rendered mono clip, plus name, persistent ID, order, timestamps, source mode, duration, sample rate, and schema/algorithm versions. Modulated sounds include their F17/F18 asset dependencies, routing, and settings; the rendered clip captures the resulting effect. Freeze the source revision/settings when Save is invoked so concurrent edits cannot mix old and new data. Show success only after the clip and snapshot are durably committed together. Repeated activation while a save is pending creates one entry.

Show saved sounds as named buttons/pads with duration and ready/loading/playing/error states. Clicking or pressing Enter/Space on a focused ready pad plays it from the beginning. Provide Stop, rename, reorder, remove with an undo opportunity, and Open in editor. The initial playback policy is one active saved clip at a time: a new trigger replaces the old clip with short complementary ramps and stops editor preview. Re-triggering the same pad restarts it. All sounds restore stopped after reload.

Opening a saved sound loads a working copy and preserves the current draft for recovery. Subsequent editor changes do not alter the saved entry. **Update saved sound** explicitly replaces that entry after a successful render and storage transaction; **Save as new sound** creates another entry.

Use the shared renderer at the chosen 44.1/48 kHz save rate. Cache audio after mixing, headroom, and finite clip envelopes but before master monitor gain; apply the current monitor gain exactly once during pad playback. Store the saved monitor setting in the editable snapshot, without baking it into the cache a second time. At matched settings/rates, pad playback must reproduce the saved render within the existing numerical tolerance.

Persist the board locally across reloads, keep unavailable/quota errors recoverable, and never evict saved entries silently to free space. List pad metadata without loading every full audio buffer; prepare clips on demand with a bounded cache. Offer each entry's WAV and editable project downloads through F09/F10 as portable backups. Whole-board cloud sync remains deferred. F17 adds local audio imports and frozen saved clips for F18 modulation; removing a source pad must not delete assets still needed by another saved sound or project.

### F17 — Import audio and reuse frozen clips

Let users choose or drop a local audio file, or select a soundboard clip, as a reusable audio source. Required initial file formats are mono/stereo PCM 16-bit WAV and MP3, verified on the supported browser matrix; other formats are optional and must report unsupported/corrupt input clearly. File selection never sends audio to a server and never starts playback.

Show source name, duration, channel choice, trim region, and sample rate. Proposed limits are 20 MiB per input file, 60 seconds of decoded input, and a retained excerpt of 1 ms–10 seconds. Preflight and validate decoded channel/frame counts before accepting an asset; never rely on compressed file size alone. Default stereo conversion is (L+R)/2, with explicit left/right choices when averaging cancels content. Store the selected mono excerpt at 44.1 or 48 kHz, with at most 480,000 samples. Imported audio samples have a separate asset budget and do not count as drawing points.

A soundboard source is a frozen copy/reference to its saved rendered clip **before monitor gain**. It does not trigger the pad, re-evaluate the source recipe recursively, or change when that pad is edited. Retain every referenced immutable asset until all project/snapshot/undo references are released. Deleting the original file or source pad must not break a saved result.

Add a self-contained project bundle (proposed `.sigint.zip`) containing versioned project JSON and all required trimmed PCM assets. Proposed limits are 32 MiB compressed, 64 MiB extracted, 32 archive entries, and eight retained audio assets per project. Enforce entry/count/byte/sample limits while extracting; validate paths, hashes, schemas, and finite samples before atomically replacing state. Keep the existing 10 MiB asset-free JSON import supported. Missing/corrupt assets fail with the current project intact. A bare JSON containing unresolved asset IDs is not a complete portable backup.

Acceptance includes WAV/MP3 fixtures, resampling, stereo cancellation/selection, unsupported and corrupt files, decode cancellation/stale results, quota failures, source deletion/update isolation, and bundle round trips without access to the original file or browser database.

### F18 — Modulate a sound with imported audio or another clip

Provide a clearly labeled **Carrier / sound to change** and **Modulator / sound that controls it**. The carrier can be one selected oscillator, the current finite sound/mix, or a saved/imported clip. The modulator can be an F17 imported excerpt or frozen soundboard clip. A proposed initial limit is one active route and one effect mode per project; repeated stages can be rendered and saved as new clips. Preserve oscillator colors and add separate labeled source/result styles. Route selection does not erase the drawing workspaces.

| Mode | Behavior and controls |
| --- | --- |
| Volume follow | Extract a nonnegative amplitude envelope from the modulator and apply it to the carrier; depth 0–100%, proposed attack 5 ms/release 50 ms |
| Ring modulation | Multiply the carrier by the signed modulator waveform; depth blends dry carrier and multiplied result |
| Pitch modulation | Modulate an oscillator's frequency by a signed semitone amount and integrate phase; for finite recorded/mixed clips, use explicitly labeled varispeed |

For bounded modulator m(t) in [-1,1], follower e(t) in [0,1], carrier c(t), and depth d in [0,1], volume follow is c(t)·[(1−d)+d·e(t)] and ring modulation is (1−d)·c(t)+d·c(t)·m(t). Proposed pitch depth D is 0–24 semitones: f_eff(t)=f_base(t)·2^(D·m(t)/12). Use the effective frequency in the existing phase integral. A recorded clip instead advances its source readhead at rate 2^(D·m(t)/12); this changes pitch and source timing together and does not preserve word/beat duration.

Expose mode, depth, bypass/A–B, modulator trim/start offset, optional loop, and output duration (1 ms–10 seconds; initially 2 seconds for a periodic carrier). Clip carrier looping is a separate explicit option. Do not automatically stretch the modulator to fill the carrier. Before the source starts or after a non-looping source ends, ramp effect depth to zero so the carrier continues unaffected by further modulation; do not confuse an absent source with silence inside an active clip. Pitch phase/readhead remains continuous when returning to the base rate. A–B comparison restarts both versions from matching initial state.

The modulator is not directly audible unless the user intentionally auditions it. A zero-depth render matches bypass within numerical tolerance. During active full-depth ring modulation, a silent source gives silence; volume-follow silence decays according to its release setting. Pitch silence means the base pitch/rate. If a non-looping carrier reaches its end, output becomes silent; pitch processing never invents missing clip samples.

Show carrier, modulator/envelope, and rendered result with time/amplitude or correctly labeled gain/pitch axes, plus spectrum and the effective pitch/rate range. Preserve the entered pitch settings but display any effective-frequency limiting required by 20–20,000 Hz and actual Nyquist/bandwidth bounds. Use measured resampling/antialias processing for modulation sidebands. Keep intentional gain dynamics, report generated DC/processing, and apply monitor gain once.

A modulated sound can be previewed, exported, saved to the soundboard, reloaded, and reopened with all source assets and effect settings. Mathematical exports include the composition formula and complete numerical data/evaluators; arbitrary recorded audio is not promised a compact symbolic formula. Required evidence includes zero-depth identity, a 440 Hz × 100 Hz full-ring fixture with 340/540 Hz sidebands, constant +12-semitone doubling, phase/readhead continuity, timing/loop/EOF behavior, and repeatable asset-bearing project/function/audio exports.

## 6. Performance and quality targets

These are acceptance targets to validate, not claims about an existing implementation. Establish a representative desktop baseline in F01.

| Measure | Initial target |
| --- | --- |
| New-user activation | At least 4 of 5 formative-test users draw a wave, hear it, and find its function within 2 minutes without coaching |
| Drawing feedback | p95 input-to-visible-update ≤ 50 ms in the baseline environment |
| Periodic conversion and analysis | p95 ≤ 150 ms per edited oscillator after stroke end at 16,384 samples |
| Maximum finite render, including four oscillators and one clip-driven modulation route | p95 ≤ 2 seconds for 10 seconds at 48 kHz; progress and cancellation available |
| Stop interaction | Control responds ≤ 100 ms; audio stops after the scheduled short ramp, allowing documented device latency |
| Numerical function export | Source evaluators match canonical source values within 10^-6 absolute error at fixture evaluation points |
| WAV correctness | Header, duration, channels, sample rate, bounds, and samples agree with the rendered fixture within 1 PCM quantization step |
| Playback stability | No stuck sound or accumulating audio nodes across 100 start/stop/edit or soundboard trigger/stop cycles |
| Prepared soundboard pad | p95 user action to source scheduling ≤ 100 ms on the baseline, plus device latency; cold loads show progress |

For bandwidth handling, include spectral tests of high-pitch discontinuous waves against an oversampled, low-pass reference. Set a measurable stop-band target in the foundation spike and document it before audio implementation is accepted. Do not use "no aliasing" as an unmeasurable promise.

Collect usability results through a small documented pilot. Remote behavioral analytics and sending drawings/audio to a server are outside the initial scope. The Upload audio control reads a local file into the browser; F17 imports do not transmit it.

## 7. Suggested implementation boundaries

The implementation should separate editor state, a pure TypeScript signal/DSP library, a worker for expensive analysis/rendering, Web Audio adapters, and import/export/persistence adapters. UI state and derived analysis use revision identifiers.

Prefer established Web Audio nodes initially; introduce an AudioWorklet only if the measured rendering/interaction requirements justify it. OfflineAudioContext can render an audio graph into a buffer without playing it. [API reference](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext). Browser audio behavior should be tested against the [Web Audio Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/), without depending on new draft-only APIs.

Keep raw/source data and audio processing metadata together so every view and export can explain its relationship to the drawing.

## 8. Repository baseline and delivery

Before this planning effort, the default branch contained a template README, empty CONTRIBUTING.md, a license, a template changelog, and two GitHub Actions workflows, with no application source, dependency manifest, tests, or issue backlog.

The existing Docker workflow builds on version tags but the repository has no Dockerfile. The release-please workflow references a configured secret whose availability has not been checked. Foundation work must reconcile these inherited workflows with the chosen static-app build and add pull-request validation before relying on releases. This planning change does not alter those workflows.

Delivery proceeds through four gates; the linked implementation plan maps each requirement to an issue:

1. **M0 — Foundation:** contracts, fixtures, baseline hardware, technical spike, and app/CI skeleton.
2. **M1 — Draw, describe, hear:** editor, conversion, sine fit, complex periodic functions, and periodic audio.
3. **M2 — Complex workflows and reuse:** timeline audio, pitch/volume lanes and synthesis, distinct oscillator colors and mixing, inspection, exports, local persistence, a named soundboard, local audio assets, and clip-driven modulation.
4. **M3 — Release candidate:** onboarding/accessibility and integrated numerical, browser, performance, and usability evidence.

All F01–F18 are required for the first complete release. P0 issues establish the core path; P1 issues complete the release. Priorities are sequencing aids, not permission to omit release requirements.

## 9. Risks and decisions to revisit

| Risk or uncertainty | Initial decision / validation |
| --- | --- |
| Freehand paths can contain multiple y values at one x | Latest stroke/segment wins; expose the resolved signal and test it with users |
| Users expect every drawing to have a short equation | Always supply numerical functions; label and quantify approximations |
| Drawn discontinuities and limited samples alter sound | Band-limit explicitly, show rendered output, retain source and processing metadata |
| Long timelines and overlapping curves hide details | Zoom, numeric editing, distinct oscillator colors/labels, and selected-only views; region sequencing later |
| Browser/hardware audio differences | Actual-rate reporting, shared DSP, browser matrix, fixture-based comparisons |
| Initial resolution and recognition thresholds may not fit real use | Pilot with learners and sound designers; record changes to this PRD before expanding scope |
| Local browser storage is not durable backup | Visible save status and portable project bundles containing required audio |
| Audio-rate modulation creates sidebands or changes clip timing | Measure an oversampled renderer; label recorded-clip pitch as varispeed; retain explicit timing and source data |
| Compressed files expand or depend on unavailable codecs | Bounded preflight/decode, format fixtures on the browser matrix, and recoverable errors |

Open product follow-ups are audience emphasis (learning versus sound design), demand for mobile editing, and whether to raise the proposed four-oscillator limit or add region sequencing next. Pitch/volume drawing and distinct oscillator colors are first-release requirements. They do not block the proposed first-release scope.
