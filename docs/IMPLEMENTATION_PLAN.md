# SIGINTTool implementation plan

**Status:** Proposed first-release backlog; implementation has not started in this planning change.  
**Date:** 2026-09-30  
**Tracking issue:** [#1 — Product delivery plan](https://github.com/CurtisTechSolutions/SIGINTTool/issues/1)  
**Requirements:** [PRD](PRD.md)  
**Engineering proposal:** [Technical design](TECHNICAL_DESIGN.md)

## Delivery objective

Build a browser signal sketchpad that turns drawn waveforms into mathematical functions and sound. The first release includes drawing pitch and volume envelopes, multiple oscillators identified by distinct persistent colors, a controlled mono mix, a named soundboard for replay and later editing, and modulation driven by local audio files or saved clips.

Start with one oscillator and support up to four under the proposed initial resource budget. Each voice has its own waveform, model, phase, pitch/gain lanes, mute/solo, name, and color. Keep a standalone direct-amplitude Timeline mode as well as periodic and envelope-driven oscillator output.

## How to use the backlog

Each issue has a user-visible outcome, bounded scope, measurable acceptance criteria, validation work, and explicit dependencies. F01–F18 map to the PRD sections. P0 establishes the core behavior; P1 completes the first release. Both priorities are release requirements.

The M0–M3 names below are delivery gates, not estimated dates or GitHub milestone objects. No assignees or release deadlines have been inferred.

| Requirement | GitHub issue | Priority | Gate | Depends on |
| --- | --- | --- | --- | --- |
| F01 | [#2](https://github.com/CurtisTechSolutions/SIGINTTool/issues/2) Establish the browser app, signal contracts, DSP spike, and CI | P0 | M0 | None |
| F02 | [#3](https://github.com/CurtisTechSolutions/SIGINTTool/issues/3) Build the waveform canvas, editing tools, and undo history | P0 | M1 | [#2](https://github.com/CurtisTechSolutions/SIGINTTool/issues/2) |
| F03 | [#4](https://github.com/CurtisTechSolutions/SIGINTTool/issues/4) Convert ordered drawing strokes into deterministic signal data | P0 | M1 | [#2](https://github.com/CurtisTechSolutions/SIGINTTool/issues/2) |
| F04 | [#5](https://github.com/CurtisTechSolutions/SIGINTTool/issues/5) Fit sine waves and report interpretable parameters and error | P0 | M1 | [#4](https://github.com/CurtisTechSolutions/SIGINTTool/issues/4) |
| F05 | [#6](https://github.com/CurtisTechSolutions/SIGINTTool/issues/6) Generate general signal functions and Fourier approximations | P0 | M1 | [#4](https://github.com/CurtisTechSolutions/SIGINTTool/issues/4) |
| F06 | [#7](https://github.com/CurtisTechSolutions/SIGINTTool/issues/7) Play periodic drawings with correct pitch, bandwidth, and transport behavior | P0 | M1 | [#4](https://github.com/CurtisTechSolutions/SIGINTTool/issues/4), [#6](https://github.com/CurtisTechSolutions/SIGINTTool/issues/6) |
| F07 | [#8](https://github.com/CurtisTechSolutions/SIGINTTool/issues/8) Render finite timeline signals with looping, progress, and cancellation | P0 | M2 | [#4](https://github.com/CurtisTechSolutions/SIGINTTool/issues/4), [#7](https://github.com/CurtisTechSolutions/SIGINTTool/issues/7) |
| F15 | [#9](https://github.com/CurtisTechSolutions/SIGINTTool/issues/9) Add distinct oscillator colors, independent voices, and mono mixing | P0 | M2 | [#2](https://github.com/CurtisTechSolutions/SIGINTTool/issues/2), [#3](https://github.com/CurtisTechSolutions/SIGINTTool/issues/3), [#7](https://github.com/CurtisTechSolutions/SIGINTTool/issues/7) |
| F13 | [#10](https://github.com/CurtisTechSolutions/SIGINTTool/issues/10) Draw synchronized pitch and volume envelopes for each oscillator | P0 | M2 | [#3](https://github.com/CurtisTechSolutions/SIGINTTool/issues/3), [#4](https://github.com/CurtisTechSolutions/SIGINTTool/issues/4), [#9](https://github.com/CurtisTechSolutions/SIGINTTool/issues/9) |
| F14 | [#11](https://github.com/CurtisTechSolutions/SIGINTTool/issues/11) Synthesize phase-continuous pitch and volume envelopes | P0 | M2 | [#7](https://github.com/CurtisTechSolutions/SIGINTTool/issues/7), [#8](https://github.com/CurtisTechSolutions/SIGINTTool/issues/8), [#10](https://github.com/CurtisTechSolutions/SIGINTTool/issues/10), [#9](https://github.com/CurtisTechSolutions/SIGINTTool/issues/9) |
| F08 | [#12](https://github.com/CurtisTechSolutions/SIGINTTool/issues/12) Inspect source, approximation, rendered audio, and spectrum | P1 | M2 | [#5](https://github.com/CurtisTechSolutions/SIGINTTool/issues/5), [#6](https://github.com/CurtisTechSolutions/SIGINTTool/issues/6), [#7](https://github.com/CurtisTechSolutions/SIGINTTool/issues/7), [#8](https://github.com/CurtisTechSolutions/SIGINTTool/issues/8), [#11](https://github.com/CurtisTechSolutions/SIGINTTool/issues/11), [#9](https://github.com/CurtisTechSolutions/SIGINTTool/issues/9) |
| F09 | [#13](https://github.com/CurtisTechSolutions/SIGINTTool/issues/13) Export WAV, samples, coefficients, and executable signal functions | P1 | M2 | [#5](https://github.com/CurtisTechSolutions/SIGINTTool/issues/5), [#6](https://github.com/CurtisTechSolutions/SIGINTTool/issues/6), [#7](https://github.com/CurtisTechSolutions/SIGINTTool/issues/7), [#8](https://github.com/CurtisTechSolutions/SIGINTTool/issues/8), [#11](https://github.com/CurtisTechSolutions/SIGINTTool/issues/11), [#9](https://github.com/CurtisTechSolutions/SIGINTTool/issues/9) |
| F10 | [#14](https://github.com/CurtisTechSolutions/SIGINTTool/issues/14) Save projects locally and validate portable project imports | P1 | M2 | [#2](https://github.com/CurtisTechSolutions/SIGINTTool/issues/2), [#3](https://github.com/CurtisTechSolutions/SIGINTTool/issues/3), [#4](https://github.com/CurtisTechSolutions/SIGINTTool/issues/4), [#10](https://github.com/CurtisTechSolutions/SIGINTTool/issues/10), [#11](https://github.com/CurtisTechSolutions/SIGINTTool/issues/11), [#9](https://github.com/CurtisTechSolutions/SIGINTTool/issues/9) |
| F16 | [#18](https://github.com/CurtisTechSolutions/SIGINTTool/issues/18) Save named sounds to a persistent soundboard and replay them | P1 | M2 | [#13](https://github.com/CurtisTechSolutions/SIGINTTool/issues/13), [#14](https://github.com/CurtisTechSolutions/SIGINTTool/issues/14) |
| F17 | [#19](https://github.com/CurtisTechSolutions/SIGINTTool/issues/19) Import audio and preserve reusable clip assets in portable projects | P1 | M2 | [#18](https://github.com/CurtisTechSolutions/SIGINTTool/issues/18) |
| F18 | [#20](https://github.com/CurtisTechSolutions/SIGINTTool/issues/20) Modulate sounds with imported audio or saved clips | P1 | M2 | [#19](https://github.com/CurtisTechSolutions/SIGINTTool/issues/19), [#11](https://github.com/CurtisTechSolutions/SIGINTTool/issues/11), [#12](https://github.com/CurtisTechSolutions/SIGINTTool/issues/12) |
| F11 | [#15](https://github.com/CurtisTechSolutions/SIGINTTool/issues/15) Complete accessible onboarding, explanations, and recovery states | P1 | M3 | [#3](https://github.com/CurtisTechSolutions/SIGINTTool/issues/3), [#12](https://github.com/CurtisTechSolutions/SIGINTTool/issues/12), [#13](https://github.com/CurtisTechSolutions/SIGINTTool/issues/13), [#14](https://github.com/CurtisTechSolutions/SIGINTTool/issues/14), [#18](https://github.com/CurtisTechSolutions/SIGINTTool/issues/18), [#19](https://github.com/CurtisTechSolutions/SIGINTTool/issues/19), [#20](https://github.com/CurtisTechSolutions/SIGINTTool/issues/20) |
| F12 | [#16](https://github.com/CurtisTechSolutions/SIGINTTool/issues/16) Validate numerical fidelity, browser audio, and release performance | P1 | M3 | [#2](https://github.com/CurtisTechSolutions/SIGINTTool/issues/2), [#3](https://github.com/CurtisTechSolutions/SIGINTTool/issues/3), [#4](https://github.com/CurtisTechSolutions/SIGINTTool/issues/4), [#5](https://github.com/CurtisTechSolutions/SIGINTTool/issues/5), [#6](https://github.com/CurtisTechSolutions/SIGINTTool/issues/6), [#7](https://github.com/CurtisTechSolutions/SIGINTTool/issues/7), [#8](https://github.com/CurtisTechSolutions/SIGINTTool/issues/8), [#12](https://github.com/CurtisTechSolutions/SIGINTTool/issues/12), [#13](https://github.com/CurtisTechSolutions/SIGINTTool/issues/13), [#14](https://github.com/CurtisTechSolutions/SIGINTTool/issues/14), [#15](https://github.com/CurtisTechSolutions/SIGINTTool/issues/15), [#10](https://github.com/CurtisTechSolutions/SIGINTTool/issues/10), [#11](https://github.com/CurtisTechSolutions/SIGINTTool/issues/11), [#9](https://github.com/CurtisTechSolutions/SIGINTTool/issues/9), [#18](https://github.com/CurtisTechSolutions/SIGINTTool/issues/18), [#19](https://github.com/CurtisTechSolutions/SIGINTTool/issues/19), [#20](https://github.com/CurtisTechSolutions/SIGINTTool/issues/20) |

## M0 — Foundation and technical evidence

Complete [#2](https://github.com/CurtisTechSolutions/SIGINTTool/issues/2). Produce the static app/CI skeleton, shared contracts, independent fixtures, and a measured DSP prototype before relying on an engine choice. The prototype must cover integrated pitch, gain envelopes, four voices, global headroom, clip-driven volume/ring/pitch modulation, varispeed readhead continuity, preview/offline consistency, bounded WAV/MP3 decoding, and the maximum resource budget.

Record the browser/hardware baseline and accepted numerical/spectral thresholds. Reconcile inherited release/container workflows with the actual app build; this documentation change does not modify those workflows.

## M1 — Draw, describe, and hear

Complete [#3](https://github.com/CurtisTechSolutions/SIGINTTool/issues/3), [#4](https://github.com/CurtisTechSolutions/SIGINTTool/issues/4), [#5](https://github.com/CurtisTechSolutions/SIGINTTool/issues/5), [#6](https://github.com/CurtisTechSolutions/SIGINTTool/issues/6), [#7](https://github.com/CurtisTechSolutions/SIGINTTool/issues/7). A user can draw/edit a waveform, inspect a sine fit or general numerical/Fourier representation, and intentionally play it at a chosen pitch. Raw source, approximation, and audio processing remain distinguishable.

This is an internal vertical slice; it does not reduce the first-release requirement for envelopes and multiple colored oscillators.

## M2 — Envelopes, oscillator identity, soundboard, and clip modulation

Complete [#8](https://github.com/CurtisTechSolutions/SIGINTTool/issues/8), [#9](https://github.com/CurtisTechSolutions/SIGINTTool/issues/9), [#10](https://github.com/CurtisTechSolutions/SIGINTTool/issues/10), [#11](https://github.com/CurtisTechSolutions/SIGINTTool/issues/11), [#12](https://github.com/CurtisTechSolutions/SIGINTTool/issues/12), [#13](https://github.com/CurtisTechSolutions/SIGINTTool/issues/13), [#14](https://github.com/CurtisTechSolutions/SIGINTTool/issues/14), [#18](https://github.com/CurtisTechSolutions/SIGINTTool/issues/18), [#19](https://github.com/CurtisTechSolutions/SIGINTTool/issues/19), [#20](https://github.com/CurtisTechSolutions/SIGINTTool/issues/20). Deliver finite signals; persistent colors and independent voice editing; synchronized pitch/gain drawing; phase-continuous synthesis; source/model/mix inspection; reproducible exports; local project round trips; named soundboard save/replay/edit workflows; audio imports/frozen clip assets; and volume-follow, ring, and pitch/varispeed modulation.

Oscillator colors are consistent across waveform, pitch, volume, controls, and legend. Labels and line cues supplement color. Plot visibility is independent of mute. Mixed audio and exported functions reflect the same included voices and envelope settings.

Saved sounds contain both the rendered clip and an independent project snapshot. Modulated snapshots also retain their immutable audio dependencies, timing, and effect settings. Portable bundles include every required asset and remain editable without the original file or source pad. Pad replay uses a pre-monitor cache and applies current master gain once. Save/update failures preserve prior entries; working-copy edits do not change saved sounds implicitly.

## M3 — Release candidate

Complete [#15](https://github.com/CurtisTechSolutions/SIGINTTool/issues/15), [#16](https://github.com/CurtisTechSolutions/SIGINTTool/issues/16) and attach acceptance evidence. Validate keyboard/numeric use, usability, actual-browser audio, export accuracy, spectral quality, cancellation, node cleanup, and maximum-size four-voice/one-route modulation performance.

Keep implementation issues open until their actual acceptance criteria pass. Merging the planning PR alone does not complete any feature or authorize a production deployment.

## Release evidence

- Analytic sine, phase, DC, Nyquist, and multi-harmonic fixtures validate coefficient conventions independently.
- General source evaluators and generated JavaScript/Python functions match reference samples and domain boundaries.
- Constant and log-linear pitch curves match integrated phase across knots/chunks; drawn gain dynamics and silence survive rendering.
- Multiple voices preserve phase/frequency independence; in-phase sums, phase cancellation, and mute/solo combinations match expected mixes.
- Source, approximation, and rendered views share revision/settings; stale jobs never restart stopped audio.
- WAV/CSV/JSON outputs identify their source, units, rate, duration, carrier/envelope data, inclusion state, and processing.
- Round-tripped projects preserve all workspaces, oscillator colors/IDs, and editable lane data.
- Soundboard entries survive reload, preserve saved versions during editing, replay without double gain, and support keyboard management and per-entry portable downloads.
- Prepared pad latency, cancellation, and bounded cache use are measured with 32 maximum-duration saved sounds.
- WAV/MP3 and bounded archive imports preserve work on failure; source-pad changes/deletion cannot break frozen clip dependencies.
- Zero-depth identity, amplitude-follow attack/release, ring sum/difference components, phase-integrated pitch, and varispeed readhead behavior match independent references.
- Timing/loop/EOF, bypass transitions, fresh-storage project/function reproduction, and modulated soundboard replay preserve the declared settings without double effects or monitor gain.
- The PRD's responsiveness, memory, bandwidth, browser, and five-person first-use targets have recorded evidence.

## Decisions intentionally left to the foundation spike

The recommended stack is React/TypeScript, Canvas 2D, a worker, Web Audio, and browser-local storage. Exact package versions, FFT adapter, native-node versus custom modulation rendering, bounded audio decoder, filter design, and benchmark environment must be chosen with evidence in [#2](https://github.com/CurtisTechSolutions/SIGINTTool/issues/2).

Four voices, one modulation route, and the stated numerical/resource limits are initial proposals. Changes to these limits must be explicit in the PRD and affected issue criteria; implementations must not silently discard drawing detail, envelopes, or voices to pass performance checks.
