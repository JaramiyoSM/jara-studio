import { spawn } from 'node:child_process';
import { preview } from 'vite';

const server = await preview({ preview: { host: '127.0.0.1', port: 5187, strictPort: true } });
try {
  const result = await new Promise((resolve, reject) => {
    const runner = spawn(process.execPath, ['--test', '--test-concurrency=2', 'tests/*.test.*'], {
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, JARA_STUDIO_URL: 'http://127.0.0.1:5187' },
    });
    runner.on('error', reject);
    runner.on('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = result;
} finally {
  await new Promise((resolve) => server.httpServer.close(resolve));
}
