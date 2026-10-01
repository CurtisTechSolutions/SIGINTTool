# Implementation decisions

## Browser-native modules

The application uses standard JavaScript modules, Canvas 2D, Web Workers, Web Audio, and IndexedDB. The planning documents recommended React/TypeScript as a starting option. This implementation chooses native modules because the workspace is primarily a canvas and a small set of controls, pure numerical code can run unchanged under Node, and the app can ship without third-party runtime code or a bundler. Modules separate the project contract, signal math, renderer, transport, storage, exports, and interface.

Node 22 is the pinned development major. There are no application dependencies; the lockfile records this deliberately. Playwright 1.63.0 is pinned for CI browser checks. Its Chromium, Firefox, and WebKit tests do not substitute for actual Safari or a human usability study.

## Build and release

`npm ci`, `npm run check`, `npm test`, and `npm run build` validate and produce a static `dist/` directory. `npm run dev` serves the workspace at localhost:4173. CI runs on every PR and on main, and retains the static build artifact. The inherited Docker publishing workflow was removed because the application has no container deployment requirement. Release preparation is an explicit manual workflow; implementation merges do not publish releases or containers.

The initial foundation includes versioned bounds/validation and independent model fixtures. DSP quality and maximum-resource evidence are added with the renderer; foundation issue #2 stays open until that evidence exists.
