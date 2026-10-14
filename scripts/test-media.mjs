import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// Imágenes de catálogo (#146): servicio, lógica de galería, componentes y
// vistas públicas con fetch simulado. Mismo patrón que test-public-booking.mjs.
await mkdir('.cache', { recursive: true });
await build({
  entryPoints: ['tests/media.test.jsx'],
  outfile: '.cache/media.test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  tsconfig: 'tsconfig.app.json',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  define: {
    'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: 'http://localhost:8080/api/v1' }),
  },
});
const result = spawnSync(process.execPath, ['--test', '.cache/media.test.cjs'], {
  stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
