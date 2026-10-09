# Texture engine

Jara Studio includes the MIT Jaramiyo texture engine from <https://github.com/JaramiyoSM/jara-texture-engine>. `renderer/lib/texture-codec.js` retains its SPDX, copyright and source attribution. The application MIT license includes the required permission notice; dependency notices accompany the installer.

The desktop worker is independently implemented in `toolbox-texture-worker.js`. It allows only inspection, recoding, dictionary writing, DDS pack export and mip previews. Closing the workspace terminates the worker and rejects pending operations. Object URLs are released when a texture is superseded, the workspace is cleared or the component closes.

See [toolbox.md](toolbox.md) for formats, memory limits and export behavior. A native dictionary roundtrip may relocate internal pointers; unselected encoded texture payloads remain exact. The tests compare those payloads and metadata fields independently from relocation addresses.
