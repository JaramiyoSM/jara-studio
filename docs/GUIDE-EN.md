# Jara Studio guide

## Install and start

Download the Windows x64 installer or portable build from [official Releases](https://github.com/JaramiyoSM/jara-studio/releases). Choose **Español** or **English** when the installer opens, then choose the folder and follow the shortcut installation steps. No Jara-tools account is required; model processing stays on your computer.

The first release is unsigned. Windows may report an unknown publisher. Review the source, release origin and published SHA-256 before deciding to run it. Disabling Windows protection is not required.

Use Windows x64 with updated graphics drivers and WebGL2 support. Import limits are 128 files, 128 MiB per file and 256 MiB total; large scenes can still exceed GPU memory. A new installation uses the language selected in the installer; an existing saved preference takes priority. Portable builds initially follow the first supported Spanish or English system language. Change it in the toolbar selector or **View → Language**; the choice persists for the next launch. F1 opens the quick workflow guide.

## Build your first scene

1. Open a sample: rigged human, clothing, car, box or stylized weapon. Credits and CC0 licenses accompany the files in `public/samples`.
2. Select an object in the tree and expand it to select an individual mesh.
3. Drag to orbit, scroll to zoom and press F to frame the selection.
4. Use W/E/R to move, rotate and scale with the gizmo, or enter exact values in the inspector.
5. Enable snapping for stepped movements. Choose local or world axes. Position units are meters; rotations are shown in degrees.
6. Save a `.jara` project with Ctrl+S.

Clothing, Vehicles, Peds, Props and Weapons are work categories with suitable samples. They share one scene. Selecting a category does not convert an imported mesh into a GTA model.

## Import models

Supported working formats are GLB, glTF, OBJ with MTL, FBX and STL. Select the model and its referenced images/binaries together. Embedded-texture GLB is the easiest option. OBJ materials need their MTL and texture files; STL normally contains geometry only.

Internet references are not loaded. Local dependency names must match the model references. If a texture is missing, import the complete set or assign it in Material. Each model becomes an object in the scene. You can combine models with primitives, duplicate objects, hide them and lock transforms. Session undo/redo covers the available editing operations.

The 3D loader caps individual models/dependencies at 96 MiB and models at five million vertices. Original units are preserved: check centimeter-based FBX scale against the meter-based workspace.

## Materials, UVs and clothing

Select the mesh and material slot before editing color, roughness, metalness or opacity. Color texture assigns an image to that slot. Open UV map to inspect coordinates and export a PNG template. **Design clothing / livery** opens the Surface workshop with real mesh UVs, a live 3D design preview and paint, text, color and image layers. Applying isolates the selected mesh material so other objects and slots retain their appearance.

1. Select the garment or bodywork, mesh and material slot containing the color texture. Existing UV coordinates are required; the workshop does not automatically unwrap meshes.
2. Paint in the selected paint layer with your chosen color, size and opacity. Eraser removes only that layer's paint, revealing the original texture underneath.
3. Add text or import a PNG, JPG or WebP layer. Move drags a text/image layer on the canvas. Fine-tune position, dimensions, rotation and opacity in the panel. Enable **Paint / place in 3D** to paint directly on the surface or place a text/image layer by clicking the model. Only the selected mesh and material slot respond. Turn this mode off to orbit again. Hide, reorder or delete layers to compare versions and use Undo design / Redo design to recover changes.
4. The UV guide respects texture orientation and transforms and filters the selected material slot. Shared, mirrored or repeated islands receive the same design: unique livery panels require unique UVs from your modeler. Untinted material colors previews without multiplying by the original material color.
5. Export texture PNG saves only the pixels, without UV or selection lines. Apply to model combines the layers into a color texture. Save `.jara` or export GLB to embed it; OBJ does not contain textures. Layer history belongs to the current workshop session: reopening edits the flattened final texture.

Editing uses 512, 1024 or 2048 px based on the input texture. Resolution resamples the design and resets workshop history, confirming when changes exist. Designs support up to 16 layers; paint/image layers have memory limits and history evicts older states to respect a pixel memory budget. Images used in the final design are kept as originals when applying. Close without applying discards the draft without changing the scene material. The workshop edits color textures; normal maps, sewing, topology and rigging require a dedicated modeler.

Clothing samples have real meshes and UVs but still need native GTA preparation. A DDS image alone does not create a clothing YDD. Check component, variation and texture names in Blender/Sollumz.

## Skeletons and animation

Skeleton displays existing bones. Choose an included animation clip, play/pause it or scrub the timeline. The human sample lets you inspect a weighted rigged mesh. The application does not manufacture missing animations, automatically assign GTA-compatible weights or retarget arbitrary skeletons to GTA peds. Check bones, weights and names in Blender/Sollumz before compilation.

## Cameras and measurements

Use Perspective for free inspection and Front/Right/Top for orthographic comparisons. Grid and wireframe help inspect shapes. Measure two points reports the distance between two surface clicks. Confirm the imported scale before interpreting that distance.

## Save, open and recover

`.jara` is a versioned ZIP containing a manifest, an embedded scene GLB and available original imports. It differs from the web tools' `.jara.json`. Open a project with Ctrl+O; opening replaces the current scene, so save changes first. Archive paths, entry counts and expanded size are checked before parsing.

When an edited scene contains objects, the desktop saves a local recovery approximately every 45 seconds. Use File → Recover session after an unexpected shutdown. Recovery does not replace manual saves or backups. Browser preview does not offer the same native persistence.

Project archives and their expanded contents are capped at 256 MiB; recovery files are capped at 128 MiB. Oversized recovery attempts report an error: save manually. Utility exports may reach 512 MiB within each workspace's limits.

`.jara` saves the 3D scene. Utilities have separate exports and are not included in that scene project. Export handling, textures and maps before closing. Switching workspaces preserves their data during the session.

Closing with unsaved changes or open utility data shows a Go back / Discard prompt. This prompt does not automatically save utility tables: return and export them first if you need to keep them.

## Exports

| Format  | Contains                                          | Intended use                                        |
| ------- | ------------------------------------------------- | --------------------------------------------------- |
| GLB     | Geometry, materials, textures and supported clips | Continue native preparation in Blender/Sollumz      |
| OBJ     | Geometry and UV coordinates                       | Other modeling tools; no bundled materials/textures |
| PNG     | Viewport screenshot or UV template                | Presentations or texture painting                   |
| JSON    | Names, transforms and visibility                  | Placement reference; not YMAP                       |
| `.jara` | Editable project and original imports             | Continue in Jara Studio                             |

GLB and OBJ are not YDR/YDD/YFT files. The application does not contain a native GTA compiler. Verify externally compiled models on a real FiveM test server.

## Resource utilities

**Handling:** import `handling.meta`, select a vehicle and edit its values while preserving other fields. Export XML or a resource package. Keep the original and compare changes before installation.

**Textures:** inspect images, DDS and compatible Legacy YTD dictionaries, including channels and mipmaps. Unsupported formats are rejected. Replacing a supported entry preserves the others. Not every game-version YTD layout is supported; validate exports before installing them.

**Resources:** choose native models and metadata for header/XML/reference checks and manifest packaging. Header validity does not prove correct geometry compilation. A real server test remains necessary.

**Minimap:** use the included original roadmap or your own image with zone/postal data. Match coordinate bounds to your map. These exports help prepare a resource; they do not automatically replace native radar textures.

## Complete workflow

1. Keep originals and their licenses.
2. Inspect scale, materials, UVs, bones and animation in Jara Studio.
3. Save `.jara` and export GLB.
4. Use Blender/Sollumz for native shaders, collisions, LODs, skeletons and GTA exports.
5. Organize and validate the native files in Utilities, then export the resource package.
6. Install it on a FiveM test server, add it to `server.cfg` and check console output, visuals, physics and performance.
7. Document usage, dependencies and distribution rights before sharing.

## Privacy and support

No OAuth, Supabase account, secret key, analytics or file upload is required by the desktop app. Help/community links open your browser and are subject to those services' policies. Application source is MIT; dependency, font and sample licenses are retained in the notices.

Report reproducible bugs in [Issues](https://github.com/JaramiyoSM/jara-studio/issues) with your version, steps and a minimal shareable file. Do not include secrets, private assets or personal information. [Jaramiyo's Discord](https://discord.gg/TvDYptEDAj) is also available.
