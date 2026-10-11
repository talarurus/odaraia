# Third-party notices for the isolated experiment

Original Odaraia source uses MPL-2.0 with explicit MIT and artwork exceptions; see the repository LICENSING.md and THIRD_PARTY_NOTICES.md. No research/reference artwork or Actual implementation is included in this source release.

Current inventories derive from package-lock.json and release/cargo-licenses.json at the repository root. Run `node tools/dependency-audit.mjs` there to regenerate the ignored dependency-license-inventory.json report. Runtime React/React DOM/Recharts are MIT; development esbuild is MIT, Playwright Apache-2.0 and axe-core MPL-2.0. Complete target-specific binary notice/source-access compliance and live vulnerability checks remain separate gates.

Full available local notice/license texts are copied unchanged below this directory for review. Some packages declare licenses without shipping a root text; that is recorded as needing release review.

| Package | Version | Declared license | Copied text |
| --- | --- | --- | --- |
| @esbuild/darwin-arm64 | 0.27.3 | MIT | No root text found; verify before release |
| immer | 11.1.18 | MIT | [LICENSE](notices/third-party/immer-11.1.18-LICENSE) |
| @reduxjs/toolkit | 2.12.0 | MIT | [LICENSE](notices/third-party/reduxjs__toolkit-2.12.0-LICENSE) |
| @reduxjs/toolkit-query | 1.0.0 | MIT | No root text found; verify before release |
| @reduxjs/toolkit-query-react | 1.0.0 | MIT | No root text found; verify before release |
| @reduxjs/toolkit-react | 1.0.0 | MIT | No root text found; verify before release |
| @standard-schema/spec | 1.1.0 | MIT | [LICENSE](notices/third-party/standard-schema__spec-1.1.0-LICENSE) |
| @standard-schema/utils | 0.3.0 | MIT | [LICENSE](notices/third-party/standard-schema__utils-0.3.0-LICENSE) |
| @types/d3-array | 3.2.2 | MIT | [LICENSE](notices/third-party/types__d3-array-3.2.2-LICENSE) |
| @types/d3-color | 3.1.3 | MIT | [LICENSE](notices/third-party/types__d3-color-3.1.3-LICENSE) |
| @types/d3-ease | 3.0.2 | MIT | [LICENSE](notices/third-party/types__d3-ease-3.0.2-LICENSE) |
| @types/d3-interpolate | 3.0.4 | MIT | [LICENSE](notices/third-party/types__d3-interpolate-3.0.4-LICENSE) |
| @types/d3-path | 3.1.1 | MIT | [LICENSE](notices/third-party/types__d3-path-3.1.1-LICENSE) |
| @types/d3-scale | 4.0.9 | MIT | [LICENSE](notices/third-party/types__d3-scale-4.0.9-LICENSE) |
| @types/d3-shape | 3.2.0 | MIT | [LICENSE](notices/third-party/types__d3-shape-3.2.0-LICENSE) |
| @types/d3-time | 3.0.4 | MIT | [LICENSE](notices/third-party/types__d3-time-3.0.4-LICENSE) |
| @types/d3-timer | 3.0.2 | MIT | [LICENSE](notices/third-party/types__d3-timer-3.0.2-LICENSE) |
| @types/use-sync-external-store | 0.0.6 | MIT | [LICENSE](notices/third-party/types__use-sync-external-store-0.0.6-LICENSE) |
| axe-core | 4.13.0 | MPL-2.0 | [LICENSE](notices/third-party/axe-core-4.13.0-LICENSE), [LICENSE-3RD-PARTY.txt](notices/third-party/axe-core-4.13.0-LICENSE-3RD-PARTY.txt) |
| clsx | 2.1.1 | MIT | [license](notices/third-party/clsx-2.1.1-license) |
| d3-array | 3.2.4 | ISC | [LICENSE](notices/third-party/d3-array-3.2.4-LICENSE) |
| d3-color | 3.1.0 | ISC | [LICENSE](notices/third-party/d3-color-3.1.0-LICENSE) |
| d3-ease | 3.0.1 | BSD-3-Clause | [LICENSE](notices/third-party/d3-ease-3.0.1-LICENSE) |
| d3-format | 3.1.2 | ISC | [LICENSE](notices/third-party/d3-format-3.1.2-LICENSE) |
| d3-interpolate | 3.0.1 | ISC | [LICENSE](notices/third-party/d3-interpolate-3.0.1-LICENSE) |
| d3-path | 3.1.0 | ISC | [LICENSE](notices/third-party/d3-path-3.1.0-LICENSE) |
| d3-scale | 4.0.2 | ISC | [LICENSE](notices/third-party/d3-scale-4.0.2-LICENSE) |
| d3-shape | 3.2.0 | ISC | [LICENSE](notices/third-party/d3-shape-3.2.0-LICENSE) |
| d3-time | 3.1.0 | ISC | [LICENSE](notices/third-party/d3-time-3.1.0-LICENSE) |
| d3-time-format | 4.1.0 | ISC | [LICENSE](notices/third-party/d3-time-format-4.1.0-LICENSE) |
| d3-timer | 3.0.1 | ISC | [LICENSE](notices/third-party/d3-timer-3.0.1-LICENSE) |
| decimal.js-light | 2.5.1 | MIT | [LICENCE.md](notices/third-party/decimal.js-light-2.5.1-LICENCE.md) |
| es-toolkit | 1.52.0 | MIT | [LICENSE](notices/third-party/es-toolkit-1.52.0-LICENSE), [NOTICE](notices/third-party/es-toolkit-1.52.0-NOTICE) |
| esbuild | 0.27.3 | MIT | [LICENSE.md](notices/third-party/esbuild-0.27.3-LICENSE.md) |
| eventemitter3 | 5.0.4 | MIT | [LICENSE](notices/third-party/eventemitter3-5.0.4-LICENSE) |
| immer | 10.2.0 | MIT | [LICENSE](notices/third-party/immer-10.2.0-LICENSE) |
| internmap | 2.0.3 | ISC | [LICENSE](notices/third-party/internmap-2.0.3-LICENSE) |
| playwright | 1.63.0 | Apache-2.0 | [LICENSE](notices/third-party/playwright-1.63.0-LICENSE), [NOTICE](notices/third-party/playwright-1.63.0-NOTICE) |
| playwright-core | 1.63.0 | Apache-2.0 | [LICENSE](notices/third-party/playwright-core-1.63.0-LICENSE), [NOTICE](notices/third-party/playwright-core-1.63.0-NOTICE) |
| react | 19.2.6 | MIT | [LICENSE](notices/third-party/react-19.2.6-LICENSE) |
| react-dom | 19.2.6 | MIT | [LICENSE](notices/third-party/react-dom-19.2.6-LICENSE) |
| react-is | 19.3.0 | MIT | [LICENSE](notices/third-party/react-is-19.3.0-LICENSE) |
| react-redux | 9.3.0 | MIT | [LICENSE.md](notices/third-party/react-redux-9.3.0-LICENSE.md) |
| recharts | 3.8.0 | MIT | [LICENSE](notices/third-party/recharts-3.8.0-LICENSE) |
| redux | 5.0.1 | MIT | [LICENSE.md](notices/third-party/redux-5.0.1-LICENSE.md) |
| redux-thunk | 3.1.0 | MIT | [LICENSE.md](notices/third-party/redux-thunk-3.1.0-LICENSE.md) |
| reselect | 5.1.1 | MIT | [LICENSE](notices/third-party/reselect-5.1.1-LICENSE) |
| scheduler | 0.27.0 | MIT | [LICENSE](notices/third-party/scheduler-0.27.0-LICENSE) |
| tiny-invariant | 1.3.3 | MIT | [LICENSE](notices/third-party/tiny-invariant-1.3.3-LICENSE) |
| use-sync-external-store | 1.7.0 | MIT | [LICENSE](notices/third-party/use-sync-external-store-1.7.0-LICENSE) |
| victory-vendor | 37.3.6 | MIT AND ISC | No root text found; verify before release |
