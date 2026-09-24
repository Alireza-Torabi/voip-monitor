# Dependency license review

Reviewed 2026-09-23 for the exact versions in the root lockfile. License identifiers below come from the published npm package metadata and were cross-checked with upstream project licenses. These direct dependencies permit public distribution and commercial use alongside Apache-2.0, subject to their notice terms.

| Role | Direct package | Version | License |
| --- | --- | --- | --- |
| Frontend runtime | [react](https://registry.npmjs.org/react/19.3.0) | 19.3.0 | MIT |
| Frontend runtime | [react-dom](https://registry.npmjs.org/react-dom/19.3.0) | 19.3.0 | MIT |
| Development | [typescript](https://registry.npmjs.org/typescript/6.0.3) | 6.0.3 | Apache-2.0 |
| Development | [eslint](https://registry.npmjs.org/eslint/10.11.0) | 10.11.0 | MIT |
| Development | [@eslint/js](https://registry.npmjs.org/@eslint/js/10.0.1) | 10.0.1 | MIT |
| Development | [typescript-eslint](https://registry.npmjs.org/typescript-eslint/8.70.1) | 8.70.1 | MIT |
| Development | [prettier](https://registry.npmjs.org/prettier/3.9.9) | 3.9.9 | MIT |
| Development | [vite](https://registry.npmjs.org/vite/8.3.0) | 8.3.0 | MIT |
| Development | [vitest](https://registry.npmjs.org/vitest/5.0.1) | 5.0.1 | MIT |
| Development | [@types/node](https://registry.npmjs.org/@types/node/24.13.6) | 24.13.6 | MIT |
| Development | [@types/react](https://registry.npmjs.org/@types/react/19.3.0) | 19.3.0 | MIT |
| Development | [@types/react-dom](https://registry.npmjs.org/@types/react-dom/19.3.0) | 19.3.0 | MIT |

The backend has no third-party runtime dependency. The local development runtime is [Node.js 24.21.0](https://nodejs.org/download/release/v24.21.0/) (Node core MIT with separately licensed bundled components). npm 11.19.0 is bundled with that archive.

## Resolved transitive licenses

The lockfile currently records MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, and BlueOak-1.0.0 identifiers. The MPL-2.0 entries are [Lightning CSS](https://github.com/parcel-bundler/lightningcss), brought by Vite. The BlueOak-1.0.0 entry is minimatch, brought by lint tooling. Both are development/build dependencies, not declared application runtime dependencies. [Mozilla describes MPL-2.0 as compatible with Apache-2.0](https://www.mozilla.org/en-US/MPL/2.0/Revision-FAQ/); its file-level source and notice obligations still apply if Lightning CSS is redistributed. The [Blue Oak Model License](https://blueoakcouncil.org/license/1.0.0) permits broad use but requires its license text or link to accompany redistributed copies. Neither is a non-commercial or source-available-only license.

`scripts/check_licenses.py` rejects new, unreviewed lockfile license identifiers in CI. This metadata check is not a full legal or per-file audit. Future Docker images and distribution bundles need a separate third-party notice review. Do not ship the development `node_modules` tree as an application artifact.

## Planned, not installed

Apache ECharts (Apache-2.0), better-sqlite3 (MIT), ws (MIT), and NGINX Open Source (2-clause BSD-like) remain candidates for later phases. Recheck exact versions and their complete dependency trees before adding them.
