# SIGINTTool

Draw a signal. See its function. Hear it.

SIGINTTool is a browser signal sketchpad with colored oscillators, drawn pitch and
volume envelopes, a persistent soundboard, and audio-clip modulation. Processing
and storage stay on your device. No account or server upload is required.

## Run it

Use Node.js 22, then:

~~~sh
npm ci
npm run dev
~~~

Open **http://localhost:4173**. Click **Play** to enable browser audio.

~~~sh
npm run check
npm test
npm run build
~~~

The build is a static site in **dist/**. Serve that directory from localhost or
HTTPS; opening index.html as a file will not provide the worker/audio environment.
GitHub Actions also saves a static-site artifact for each successful build.

## What you can do

- Draw with pencil, line, eraser, presets, snapping, zoom, numeric controls, and undo.
- Combine up to four named oscillators with persistent colors, phase, mute and solo.
- Draw pitch and volume independently, or create a finite amplitude timeline.
- Inspect sine fits, Fourier coefficients/errors, model overlays, output and spectrum.
- Save named soundboard pads with independent audio and editable snapshots.
- Import WAV/MP3, trim an excerpt, choose stereo conversion, and use it or a frozen
  saved clip for volume-follow, ring, or pitch/varispeed modulation.
- Export mono WAV, source/modulated/rendered CSV, full coefficient JSON, and complete
  standalone JavaScript/Python functions.
- Autosave locally; download JSON projects or self-contained asset-bearing ZIP bundles.

Waveform horizontal position is **time** and vertical position is **signed amplitude**.
A spectrum uses **frequency** horizontally. Pitch and volume are separate time lanes.
Complex drawings have complete numerical functions; a compact sine expression is
explicitly an approximation.

## Limits and behavior

Finite sounds and retained imported clips are 1 ms–10 seconds. Imports accept
mono/stereo WAV or MP3 up to 20 MiB and 60 seconds. Projects support eight audio assets
and 20,000 editable points. Export rates are 44.1 and 48 kHz. One modulation route is
active at a time; save its result as a clip to build another stage.

Saved clips contain audio before monitor volume. Playback and WAV export apply monitor
volume once. Modulation sources are immutable copies: editing or removing their original
soundboard pad does not change dependent sounds. Browser storage can be cleared or run
out of space; download project backups for portability.

Function exports include source evaluators and complete numerical tables for modulated
and rendered output. These tables reproduce the saved settings; editable changes to
effects require the project bundle and a new render. Clip varispeed changes timing as
well as pitch.

## Documentation and validation

- [User guide](docs/USER_GUIDE.md)
- [Implementation decisions](docs/ENGINEERING_DECISIONS.md)
- [Validation and measured limits](docs/VALIDATION.md)
- [Product requirements](docs/PRD.md)
- [Technical design](docs/TECHNICAL_DESIGN.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Delivery tracker](https://github.com/CurtisTechSolutions/SIGINTTool/issues/1)
- [Contributing and test setup](CONTRIBUTING.md)

The app uses native browser modules, Canvas, Web Workers, Web Audio, and IndexedDB.
Its local MP3 decoder is pinned and includes [third-party notices](src/vendor/README.md).
CI covers numerical tests, generated JS/Python, Chromium/Firefox/WebKit workflows, and
real Safari on macOS. See the validation report for measured scope and remaining human
acceptance checks.

## License

See [LICENSE](LICENSE). Vendored components retain their own licenses in src/vendor/.
