import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// Flujo público de reservas (#127): servicio y pantallas contra /public/* con
// fetch simulado. Mismo patrón que test-workspace.mjs (esbuild + node --test).
await mkdir('.cache', { recursive: true });
await build({
  entryPoints: ['tests/public-booking.test.jsx'],
  outfile: '.cache/public-booking.test.cjs',
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
const result = spawnSync(process.execPath, ['--test', '.cache/public-booking.test.cjs'], {
  stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
