# Implementation decisions

## Browser-native modules

The application uses standard JavaScript modules, Canvas 2D, Web Workers, Web Audio, and IndexedDB. The planning documents recommended React/TypeScript as a starting option. This implementation chooses native modules because the workspace is primarily a canvas and a small set of controls, pure numerical code can run unchanged under Node, and the interface can ship without a UI framework or a bundler. A pinned, separately licensed WebAssembly decoder provides local MP3 support. Modules separate the project contract, signal math, renderer, transport, storage, exports, and interface.

Node 22 is the pinned development major. There are no npm runtime dependencies; the MP3 distribution is vendored with notices and pinned source references. Playwright 1.63.0 is pinned for CI browser checks. Its Chromium, Firefox, and WebKit tests do not substitute for actual Safari or a human usability study.

## Build and release

`npm ci`, `npm run check`, `npm test`, and `npm run build` validate and produce a static `dist/` directory. `npm run dev` serves the workspace at localhost:4173. CI runs on every PR and on main, and retains the static build artifact. The inherited Docker publishing workflow was removed because the application has no container deployment requirement. Release preparation is an explicit manual workflow; implementation merges do not publish releases or containers.

The foundation includes versioned bounds/validation, independent numerical fixtures, a custom radix-2 FFT, measured filter response, and maximum-workload profiling. See VALIDATION.md for evidence and remaining release acceptance checks.


## Bounded audio decoding
WAV is parsed directly with chunk, frame-layout, sample-rate, duration and byte limits.
MP3 frames are preflighted before a pinned local mpg123-decoder 1.0.3 WebAssembly
decoder receives each frame. Decoding runs in a dedicated worker that Cancel terminates.
No upload or runtime CDN is involved. Retained excerpts are at most ten seconds and
resampled to 44.1 or 48 kHz. The only vendored runtime dependency is the MP3 decoder;
its pinned sources and licenses are included in src/vendor/README.md.
Supported WAV inputs are integer PCM 8/16/24/32-bit or IEEE float32. Extensible/compressed
WAV, free-format MP3, changing MP3 format midstream, and unrecognized trailing metadata
are rejected with a clear error. These limits are deliberate first-release boundaries.


## Rendering and mathematical exports
The renderer is shared by preview, soundboard caching and exports. It runs in workers
at four times the destination sample rate, reconstructs clip samples with a 64-tap
windowed-sinc kernel, and applies a 257-tap Blackman low-pass before decimation.
The tested filter target is less than 0.5 dB loss at 0.4 × destination sample rate and
more than 60 dB rejection at 0.5 × destination sample rate. This is a measured filter
contract, not a promise that every arbitrarily discontinuous drawing is artifact-free.

Periodic carriers use bandwidth-limited harmonic tables. Drawn log-linear pitch uses
exact segment integrals; the regular render grid advances through geometric increments,
with an analytic reset every 1,024 samples or at a knot to bound floating-point drift.
Clip-driven pitch/readhead changes use trapezoidal integration. Carrier DC is removed
before drawn gain; generated post-modulation DC is reported, not subtracted afterward.
Headroom is one global attenuation over the completed finite clip. Monitor gain is
outside the cached render and applied once at playback or monitored export.

Finite clip edges use up to 5 ms fades, including loop restarts. This preserves duration
but can make a short dip at a repeated seam. Modulator availability has bounded ramps;
clip looping uses periodic sinc reconstruction, with no implied time stretching.
Band-limited table selection can change high-harmonic content during a pitch sweep.

Source function exports contain full source/model tables, coefficient arrays, envelope
knots and phase-prefix segments. They retain source DC and precede clip modulation.
Modulated and rendered function exports carry complete numerical result tables. This
is an intentional, stateless definition of the fixed result: arbitrary-time queries
interpolate those tables and need no hidden follower/readhead state. They do not
re-synthesize modified effect settings. The separate project bundle preserves all
PCM assets and editable routing for that purpose.

## Runtime and persistence boundaries
Worker cancellation terminates the current computation. Playback uses generation
checks and one shared AudioContext; a stopped or obsolete job cannot start audio later.
Saved clips retain pre-monitor PCM and an independent project snapshot atomically.
Immutable content-derived audio IDs preserve dependencies after source-pad updates
or removal. The in-memory prepared-pad cache is bounded to 8 MiB; library listing reads
metadata. Current-project buffers are pruned when their references change.

Browser storage is local to its origin/profile and can be cleared or exhaust quota.
Failed transactions preserve the previous saved state. Removed sounds retain recovery
data for Undo; this release favors preserving referenced audio over automatic garbage
collection, so repeated updates/removals can leave unused records until browser data
is cleared after backing up projects.

Archive format version 1 uses standard ZIP STORE entries only. Import validates
directory/header consistency, byte/entry limits, paths, CRCs, PCM hashes, versions,
finite sample bounds and complete project references before changing state.

## Automation and release scope
Each implementation slice was a separate reviewed diff/PR, merged only after its
required CI jobs passed. The repository does not enable GitHub's automatic-merge flag;
the authorized merge operation was performed directly after verifying each PR head.
No production deployment, package publication, or scheduled background task is implied.

Real Safari tests use Apple's bundled safaridriver on a macOS runner. This is separate
from Playwright WebKit. [Apple's setup](https://developer.apple.com/documentation/safari-developer-tools/macos-enabling-webdriver)
documents enabling WebDriver for this test environment. Human listening, screen-reader
sessions and the five-person formative study remain explicit release acceptance work.
