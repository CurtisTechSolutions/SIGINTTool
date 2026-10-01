# SIGINTTool

A browser-based signal sketchpad: draw a waveform, see its mathematical function, and hear the result. Shape sounds with drawn pitch and volume envelopes, and distinguish each oscillator by its own consistent color.

**Project status:** Product and technical planning. The application described below is not implemented yet.

## Project documents

- [Product requirements](docs/PRD.md)
- [Technical design](docs/TECHNICAL_DESIGN.md)
- [Implementation plan and issue dependencies](docs/IMPLEMENTATION_PLAN.md)
- [Delivery tracker #1](https://github.com/CurtisTechSolutions/SIGINTTool/issues/1)

## Planned first release

- Paint-like waveform editing, numeric controls, presets, and undo/redo.
- Periodic oscillators and direct finite-duration signals.
- Drawn pitch and volume envelopes with phase-continuous synthesis.
- Up to four independently editable oscillators with persistent colors, labels, mute/solo, and mono mixing.
- Readable sine fits, Fourier approximations with measured error, and general numerical functions for complex shapes.
- Browser audio, signal/spectrum inspection, WAV and data/function exports, and local project files.
- A named soundboard for saving sounds, replaying them from buttons, and reopening editable copies.

Simple shapes may have compact formulas. Complex drawings retain complete numerical representations; the product will identify approximation and audio-processing differences explicitly.

Implementation setup and build commands will be added as part of [foundation issue #2](https://github.com/CurtisTechSolutions/SIGINTTool/issues/2).

## License

See [LICENSE](LICENSE).
