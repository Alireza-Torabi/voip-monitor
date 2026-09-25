# Dependency license review

Reviewed 2026-09-24 for the exact versions in the root lockfile. License identifiers below come from the published npm package metadata and were cross-checked with upstream project licenses. These direct dependencies permit public distribution and commercial use alongside Apache-2.0, subject to their notice terms.

| Role | Direct package | Version | License |
| --- | --- | --- | --- |
| Backend runtime validation | [zod](https://registry.npmjs.org/zod/4.6.5) | 4.6.5 | MIT |
| Frontend runtime | [react](https://registry.npmjs.org/react/19.3.0) | 19.3.0 | MIT |
| Frontend runtime | [react-dom](https://registry.npmjs.org/react-dom/19.3.0) | 19.3.0 | MIT |
| Development | [typescript](https://registry.npmjs.org/typescript/6.0.3) | 6.0.3 | Apache-2.0 |
| Development | [eslint](https://registry.npmjs.org/eslint/10.11.0) | 10.11.0 | MIT |
| Development | [@eslint/js](https://registry.npmjs.org/@eslint/js/10.0.1) | 10.0.1 | MIT |
| Development | [typescript-eslint](https://registry.npmjs.org/typescript-eslint/8.70.1) | 8.70.1 | MIT |
| Development | [prettier](https://registry.npmjs.org/prettier/3.9.9) | 3.9.9 | MIT |
| Development | [vite](https://registry.npmjs.org/vite/8.3.0) | 8.3.0 | MIT |
| Development | [vitest](https://registry.npmjs.org/vitest/5.0.1) | 5.0.1 | MIT |
| Frontend DOM tests | [jsdom](https://registry.npmjs.org/jsdom/30.1.1) | 30.1.1 | MIT |
| Development | [@types/node](https://registry.npmjs.org/@types/node/24.13.6) | 24.13.6 | MIT |
| Development | [@types/react](https://registry.npmjs.org/@types/react/19.3.0) | 19.3.0 | MIT |
| Development | [@types/react-dom](https://registry.npmjs.org/@types/react-dom/19.3.0) | 19.3.0 | MIT |

Zod is the backend's only third-party runtime dependency. Its published package metadata and [upstream license](https://github.com/colinhacks/zod/blob/main/LICENSE) identify MIT; it declares no runtime dependencies. The local development runtime is [Node.js 24.21.0](https://nodejs.org/download/release/v24.21.0/) (Node core MIT with separately licensed bundled components). npm 11.19.0 is bundled with that archive.

## Resolved transitive licenses

The lockfile currently records MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, BlueOak-1.0.0, MIT-0, and CC0-1.0 identifiers. The MPL-2.0 entries are [Lightning CSS](https://github.com/parcel-bundler/lightningcss), brought by Vite. The BlueOak-1.0.0 entry is minimatch, brought by lint tooling. Both are development/build dependencies, not declared application runtime dependencies. [Mozilla describes MPL-2.0 as compatible with Apache-2.0](https://www.mozilla.org/en-US/MPL/2.0/Revision-FAQ/); its file-level source and notice obligations still apply if Lightning CSS is redistributed. The [Blue Oak Model License](https://blueoakcouncil.org/license/1.0.0) permits broad use but requires its license text or link to accompany redistributed copies. Neither is a non-commercial or source-available-only license.

`scripts/check_licenses.py` rejects new, unreviewed lockfile license identifiers in CI. This metadata check is not a full legal or per-file audit. Future Docker images and distribution bundles need a separate third-party notice review. Do not ship the development `node_modules` tree as an application artifact.

## Planned, not installed

Apache ECharts (Apache-2.0), better-sqlite3 (MIT), ws (MIT), and NGINX Open Source (2-clause BSD-like) remain candidates for later phases. Recheck exact versions and their complete dependency trees before adding them.

## Phase 2 Task 3 SQLite review

No direct dependency was added. Node.js 24.21.0 provides `node:sqlite` as a release candidate API (stability 1.2), with prepared statements, transactions through SQL, and backup support. Node's distribution license and bundled component terms apply; the existing Node runtime review remains relevant. The alternative `better-sqlite3` is actively maintained, MIT licensed, and suitable for commercial redistribution with its notice, but its native addon and platform builds would complicate installation and Docker images. See the [Node API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [package metadata](https://github.com/WiseLibs/better-sqlite3/blob/master/package.json), and [license](https://github.com/WiseLibs/better-sqlite3/blob/master/LICENSE).

## Phase 2 Task 4 cryptography review

No crypto dependency was added. The implementation uses Node.js 24.21.0 built-in `node:crypto` for CSPRNG key and nonce generation and AES-256-GCM authenticated encryption. Node's existing runtime and bundled component licensing applies; lockfile contents and direct dependency licenses are unchanged. The API and authentication-tag behavior were checked against the [Node crypto documentation](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html).

## Phase 2 Task 5 authentication review

No direct dependency was added. Password hashing uses Node.js 24.21.0 `node:crypto` scrypt; randomness and token digests use the same built-in module. This preserves the existing Node runtime license and avoids native addon/install-script and Docker portability work. Argon2id remains a valid future choice: the maintained [node-argon2 package](https://github.com/ranisalt/node-argon2) is MIT licensed and supports Node 24, but uses a native addon and install script, which conflicts with this project's currently verified `npm ci --ignore-scripts` workflow. [Node's crypto documentation](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html) documents scrypt and its memory settings. No lockfile or redistributable dependency changed.

## Phase 2 Task 6 onboarding review

The development-only `jsdom` 30.1.1 (MIT) dependency was added to test interactive clearing of browser credential fields without a browser. Its Node engine includes Node 24.21.0, and it is not bundled into the production frontend. Newly resolved `@csstools/color-helpers` 6.1.1 and `@csstools/css-syntax-patches-for-csstree` 1.1.14 use MIT-0; `mdn-data` 2.27.1 uses CC0-1.0. Both identifiers permit public and commercial use with Apache-2.0; MIT-0 has no attribution condition and CC0 is a public-domain dedication. These identifiers were added to the lockfile license gate only after review. [jsdom license](https://github.com/jsdom/jsdom/blob/main/LICENSE.txt), [SPDX MIT-0](https://spdx.org/licenses/MIT-0.html), [MDN data](https://github.com/mdn/data), [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Backend payload validation reuses the pinned Zod 4.6.5 (MIT) dependency; frontend forms use React 19.3.0 (MIT) and existing Vite tooling. Node's built-in `node:net` is used only for address syntax classification with `isIP`; onboarding does not call DNS or socket APIs. The production runtime dependency set is unchanged.
