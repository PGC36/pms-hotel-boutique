import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// Base de la API relativa, como en la imagen Docker de producción
// (Dockerfile, ARG VITE_API_BASE_URL=/api/v1).
await mkdir('.cache', { recursive: true });
await build({
  entryPoints: ['tests/http-client.test.js'],
  outfile: '.cache/http-client.test.cjs',
  bundle: true,
  sourcemap: 'inline',
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  tsconfig: 'tsconfig.app.json',
  define: {
    'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: '/api/v1' }),
  },
});
const result = spawnSync(process.execPath, ['--test', '.cache/http-client.test.cjs'], {
  stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
