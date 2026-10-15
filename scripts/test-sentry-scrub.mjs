import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// Limpieza de eventos de Sentry (src/app/observability/scrub.ts), sin cargar el SDK.
await mkdir('.cache', { recursive: true });
await build({
  entryPoints: ['tests/sentry-scrub.test.js'],
  outfile: '.cache/sentry-scrub.test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  tsconfig: 'tsconfig.app.json',
});
const result = spawnSync(process.execPath, ['--test', '.cache/sentry-scrub.test.cjs'], {
  stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
