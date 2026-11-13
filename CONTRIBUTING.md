# Development conventions

Use Node 24 and install from `package-lock.json` with `npm ci`. Keep changes focused and run `npm run check` before review. For changes to storage, messaging, import/export, or manifest behavior, run the browser tests too.

TypeScript is strict. Validate unknown data at message and persistence boundaries. Preserve prompt bodies verbatim, use React text rendering, and avoid introducing HTML/Markdown interpreters. Include accessible labels, keyboard behavior, and visible errors in new flows.

Domain code should remain independent of React and browser APIs. All storage mutations go through the background service and its serialized queue. Keep tests near domain or feature code, use shared fixtures under `tests`, and use `tests/e2e` for real extension integration. Test observable behavior, data preservation, and failure cases.

Use Prettier and ESLint. Do not commit `node_modules`, `dist`, `build`, generated `safari-project`, release packages, test artifacts, private backups, or environment files. Runtime dependencies must be bundled locally. Never add a new permission, remote connection, content script, or data collection feature incidentally.

The project is private and does not yet declare a distribution license. Confirm licensing before sharing it publicly.

The `minimatch` override pins the patched version for [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) in the development lint toolchain. Linting and tests verify compatibility on Node 24. Remove the override when upstream dependencies require patched versions themselves.
