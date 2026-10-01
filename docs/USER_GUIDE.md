# Using SIGINTTool

## Draw and listen

1. Start in Waveform. Draw one repeating cycle with Pencil or Line. Eraser writes
   silence over the selected interval. Later strokes replace earlier strokes.
2. Set repetition frequency in Hz. The horizontal axis remains time: a 1,000 Hz
   cycle spans 1 ms. The selected oscillator defines the displayed cycle width;
   other oscillators overlay the same physical time range.
3. Press Play. Monitor changes listening volume; Escape or Stop stops playback.
   Start and end edges are faded over up to 5 ms to reduce clicks.
4. Give the sound a name and use Save as new sound.

Waveform height is signed amplitude, from −1 to +1. Moving the entire waveform up
adds a DC offset; it is not the same as increasing volume. Source math retains that
offset. The audio renderer removes oscillator DC before drawn gain and modulation.

Pencil and Line support pointer/touch input. Numeric point controls provide time/value
entry without drawing. Ctrl/Cmd+Z undoes; Shift+Ctrl/Cmd+Z redoes. Space on the page
background plays/stops. Controls and pads use native keyboard activation.

## Oscillators and envelopes

Each oscillator has a persistent color and name. The selected line is solid and thicker;
other lines are dashed. Plot Hide only changes visibility. Mute removes audio; if any
voice is soloed, only unmuted soloed voices are included.

Envelopes adds two independent lanes for the selected oscillator:
pitch in Hz on a logarithmic vertical scale, and volume as linear gain from 0 to 1.
Both horizontal axes show composition time. Frequency is integrated into phase, so
a pitch sweep does not reset the waveform at envelope knots.

Waveform mode plays fixed-frequency cycles. Timeline instead plays one finite amplitude
drawing directly. A slowly varying Timeline can be below hearing range. Its duration
stretches the whole drawing; it does not act as a pitch envelope.

## Functions and inspection

Drawing is a piecewise-linear sample table. Sine fit is the strongest candidate among
the supported first 64 harmonics, with an error score. Fourier approximation keeps the
chosen harmonic count. The source is preserved when either approximation is selected.

The white dotted model overlay compares the selected sine or Fourier model with the
original drawing. The error values compare against a dense 4× source grid. The audio
output and spectrum describe the last completed render. The spectrum uses a Hann
window, up to 8,192 samples, linear magnitude, and a horizontal frequency axis in Hz.

Audio can differ from the original drawing: harmonics above the playable bandwidth
are omitted, carrier DC is removed, the result is low-pass filtered, loud mixes receive
one global attenuation, and finite edges are faded. The inspector reports these steps.
Monitor is a separate final volume control.

## Soundboard and backups

Save as new sound renders a snapshot and stores both its editable project and its
pre-monitor audio in a single IndexedDB transaction. Open creates an editable copy.
Editing that copy leaves the saved pad intact until Update opened sound succeeds.

Pads play exclusively. Rename, reorder, Remove, and Undo remove manage the board.
Recover previous draft restores the working draft displaced by an Open operation.
Current edits autosave after a short delay; the status line shows when that succeeds.

Download project saves JSON when there are no audio assets, or a .sigint.zip bundle
with all required PCM when assets are present. Open project validates the whole file
before changing the editor. Opening and restoring never starts audio.

## Use one sound to shape another

Upload WAV or MP3, inspect the preview, choose a 1 ms–10 second excerpt, and choose
Average L+R, Left, or Right. Stereo averaging can intentionally cancel opposite channels.
Nothing is uploaded. Cancel terminates the decoder worker.

Choose an imported clip or a soundboard clip as the modulator. A saved clip is captured
by immutable audio identity, before monitor volume. It is independent of the original
pad's future updates/removal and does not recursively run that pad's project.

Select a carrier: current mix/Timeline, one named oscillator, or another audio clip.

- **Volume follower:** follows rectified sample amplitude with attack/release smoothing,
  then blends between unchanged carrier and that gain envelope.
- **Ring:** multiplies signed carrier and modulator samples, with dry/wet depth.
- **Pitch:** uses a semitone depth. For oscillators it integrates effective frequency.
  For clips/current rendered mix it integrates a readhead: varispeed changes pitch
  and timing together.

Offset delays the modulator. Its loop and the carrier's loop are separate controls.
Outside a finite modulator the effect depth returns to zero through bounded transitions;
silence inside the active clip still follows the chosen effect. A finite carrier is
zero after its end unless its loop is selected.

Audition modulator explicitly plays the source through the shared transport. Numeric
source statistics and pitch-rate bounds supplement the waveform. Compare without clip
modulation restarts from the same initial phase/readhead; it does not crossfade between
unrelated positions.

## Exports

Choose 44.1 or 48 kHz. The renderer recomputes output for that rate.

- WAV: mono 16-bit PCM, complete conditioned output with monitor gain applied once.
- CSV Source: source models plus drawn envelopes, before clip modulation/conditioning.
- CSV Modulated: numerical route output before final filter, attenuation and edge fades.
- CSV Rendered: conditioned, monitored output.
- JSON: complete source/model data, coefficients, units and settings.
- JavaScript/Python: complete data and source/oscillator/modulated/rendered functions;
  no packages or companion assets needed to evaluate the exported settings.

For JS, import signal and call signal(timeSeconds, "rendered"). For Python, import
signal from the downloaded module and use the same arguments. Default "source" retains
source DC and integrates pitch analytically. oscillator(t, voiceId) exposes an individual
periodic voice (including negative-time wrap in Waveform mode).

The modulated/rendered functions are full numerical tables with linear interpolation
and zero outside the finite interval. They do not claim a compact symbolic solution
or reconstruct audio above their sampling rate. The project bundle is the editable
definition for re-rendering changed effects.

Selected-oscillator exports isolate that voice and include an effect only when routed
to that oscillator. Mix and external-carrier effects belong to the Current sound scope.
Exports use a captured snapshot and never mutate the editor. Cancel export stops its worker.

## Recovery and boundaries

If browser audio cannot start, check the browser's audio permission and output device,
then activate Play again. Unsupported files show an error while keeping the current
project. WAV accepts uncompressed integer PCM or float32; some extensible WAV and unusual
MP3 metadata/format variants require conversion first.

If local storage is unavailable or full, keep the current work with Download project.
The app does not claim a successful save before the transaction completes. There is no
cloud synchronization, live microphone processing, multitrack sequencer, stereo output,
time-preserving pitch shift, or production deployment in this version.
