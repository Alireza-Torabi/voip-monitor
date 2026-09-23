# Planned dependency license review

Reviewed 2026-09-23 against upstream project declarations. This covers planned direct dependencies only; no packages have been installed, and exact versions/transitive licenses still need a lockfile audit before the first dependency commit and release.

| Planned component | Upstream declared license | Source |
| --- | --- | --- |
| Node.js 24 LTS runtime | MIT, with separately licensed bundled components | https://github.com/nodejs/node/blob/main/README.md |
| React | MIT | https://github.com/facebook/react/blob/main/packages/react/package.json |
| TypeScript | Apache-2.0 | https://github.com/microsoft/TypeScript/blob/main/package.json |
| Vite | MIT; bundled notices require review | https://github.com/vitejs/vite/blob/main/packages/vite/LICENSE.md |
| Fastify | MIT | https://github.com/fastify/fastify |
| Apache ECharts | Apache-2.0 | https://github.com/apache/echarts/blob/master/LICENSE |
| better-sqlite3 | MIT | https://github.com/WiseLibs/better-sqlite3 |
| ws | MIT | https://github.com/websockets/ws |
| NGINX Open Source | 2-clause BSD-like | https://github.com/nginx/nginx/blob/master/LICENSE |

These declared licenses permit public redistribution and commercial use alongside Apache-2.0, subject to their notice requirements. No unusual or restrictive direct dependency was found in this proposed set. `better-sqlite3` is a candidate rather than a final choice. Container base image licenses, complete transitive dependencies, and exact pinned versions remain to be audited before integration. NGINX binary distribution also requires its license notice; include it when an image is selected.

Node.js 24 is the proposed runtime because the official release schedule lists it as active LTS on this review date: https://github.com/nodejs/Release/blob/main/README.md. Pin an exact maintained patch release when the toolchain is established.
