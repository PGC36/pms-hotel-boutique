import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Prefijo '' = todas las variables (archivos .env y entorno), no solo las VITE_.
  const env = loadEnv(mode, process.cwd(), '');
  // Source maps solo si se pueden subir a Sentry (docs/sentry.md). Sin los tres datos,
  // el build no genera .map ni contacta a Sentry.
  const uploadSourceMaps = Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT);

  return {
    plugins: [
      react(),
      uploadSourceMaps &&
        sentryVitePlugin({
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          authToken: env.SENTRY_AUTH_TOKEN,
          release: { name: env.VITE_SENTRY_RELEASE || undefined },
          // Los .map se borran de dist en cuanto se suben: nunca llegan a Nginx.
          sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
          // Si Sentry no responde, el deploy sigue (el Dockerfile borra los .map igual).
          errorHandler: (error) =>
            console.warn(`[sentry] no se subieron los source maps: ${error.message}`),
          telemetry: false,
        }),
    ],
    build: {
      // 'hidden': genera los .map sin el comentario sourceMappingURL en los .js.
      sourcemap: uploadSourceMaps ? 'hidden' : false,
    },
    server: {
      host: 'localhost',
      port: 3000,
      strictPort: true,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
