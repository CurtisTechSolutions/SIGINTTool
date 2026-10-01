# Contributing

Use Node 22. Run `npm ci`, `npm run dev`, then open http://localhost:4173.

Before proposing a change, run `npm run check`, `npm test`, and `npm run build`. For browser checks, install the pinned test tool with `npm install --no-save --package-lock=false playwright@1.63.0`, run `npx playwright install --with-deps`, and run `npm run test:browser`.

Keep signal math independent of the DOM. Include an independent analytic or behavioral regression test for numerical changes. Never execute imported project code or send user audio to a server. Use small focused branches and PRs. Feature issues close only when their acceptance evidence exists.

See [the PRD](docs/PRD.md), [technical design](docs/TECHNICAL_DESIGN.md), and [implementation decisions](docs/ENGINEERING_DECISIONS.md).
