# Release verification

Windows x64 release 0.2.0 is built from this repository using the pinned lockfile. Local validation covers archive integrity, resource preservation, renderer workflows and the native Electron file broker. Release binaries and SHA-256 checksums are published separately in GitHub Releases.

The final suite passed **58 tests, zero failures, zero skips**, including the native host test. The per-user NSIS installer exited successfully and wrote its selected language for first launch. The installed application opened the textured clothing sample, composed a text layer in the Surface workshop, exported a 1024×1024 texture PNG and a 2048×2048 map PNG, changed ES/EN without losing the scene and inspected an actual YTD dictionary with no renderer errors. Product metadata identifies Jara Studio 0.2.0 and Jaramiyo. The portable launcher was run independently and opened the vehicle sample.

## Checks

- Build with source maps disabled and local-only renderer content policy.
- Unit checks for project manifests, ZIP paths/CRC/decompression budgets, transform validation, scene limits and independent animation targets.
- Browser workflows for real textured model roundtrips, OBJ/MTL local dependencies, skeleton playback, editing history, ES/EN preferences and WebGL failure recovery.
- Handling XML preservation, selective YTD byte preservation, real mip/channel inspection, minimap PNG/XY exports and matching resource manifests.
- Native file dialogs exercised against temporary local paths; saved `.jara`, GLB and recovery data reopened and checked.
- Native renderer has no Node.js access; context isolation, sandbox, external-link restrictions and remote-request blocking are checked.
- Canceling the native unsaved-work close prompt preserves the open scene.
- Surface brush and eraser pixel changes, undo, resolution resampling, 3D raycast UV placement, image originals, clean PNG export and embedded GLB/.jara texture roundtrips.
- Resource preset requirements, target dictionary and dependencies, exact native-byte preservation, real YTD entries and blocked export after failed dictionary inspection.
- Installer language configuration, first-run preference order, native translated menus/dialogs and saved locale switching while retaining scene objects.

Run `npm test` for unit/browser checks, or on Windows set `JARA_NATIVE_TESTS=1` before running it to include the native host test. The runner starts its own built-app preview. CI uses the downloaded Playwright Chromium browser; local tests use installed Microsoft Edge by default.

## Dependency audit

The runtime dependency audit reports **zero known advisories** at release validation. fflate is pinned to patched 0.8.3. npm's full development audit also reports a moderate advisory through the build-time `sprintf-js` dependency tree; no patched `sprintf-js` release was available at validation. This dependency is used by packaging tools and is not part of the application runtime. The lockfile retains the reviewed build versions rather than applying an unrelated forced downgrade.

## Limits of verification

No GTA/FiveM game runtime is included in this repository or the test environment. Tests verify generated structures and preserved data, not in-game physics or native model compatibility. YDR/YDD/YFT compilation, GTA rigging and advanced mesh modeling are external workflows. Included CC0 GLB examples are interchange models.

The first Windows build has no publisher signature. Checksums establish whether a download matches the published build; they do not provide a verified-publisher identity. Windows warnings can vary by machine and reputation.
