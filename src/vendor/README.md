# Vendored audio decoder

The unmodified UMD distribution in mpg123-decoder.js is mpg123-decoder 1.0.3.
It is loaded only by the audio import worker. It makes no network requests.
The application uses its synchronous per-frame decoder inside a cancelable worker.

- Distribution and wrapper source: https://github.com/eshaz/wasm-audio-decoders/tree/73581c683a04af37b70b08081b51eec25d37ce66
- Exact distribution: https://github.com/eshaz/wasm-audio-decoders/blob/73581c683a04af37b70b08081b51eec25d37ce66/src/mpg123-decoder/dist/mpg123-decoder.js
- Build instructions and Makefile are in that source tree. Clone recursively, check out the pinned commit, update submodules, and follow the upstream configure/build instructions to rebuild or replace this file.
- Linked libmpg123 source: https://github.com/madebr/mpg123/tree/08247b317163175e62035893af3ff9e71a5dfefd
- libmpg123 license: LGPL 2.1; see MPG123-COPYING.txt (upstream complete COPYING, including notices for other components).
- Wrapper/common code: MIT, copyright Ethan Halsall. See MIT-LICENSE.txt.
- Embedded puff decompressor: copyright 2002–2013 Mark Adler. See PUFF-LICENSE.txt.
- The separate decoder can be replaced with a modified build exposing the same MPEGDecoder API. SIGINT does not restrict debugging or reverse engineering of this component.

The static build preserves this directory and all notices. Dependency upgrades must
update the pinned source references and run both generated-codec and browser tests.
