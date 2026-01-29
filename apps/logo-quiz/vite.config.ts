import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const envFile = isProd ? 'environment.prod.ts' : 'environment.ts';

  return {
    plugins: [react()],
    root: path.resolve(__dirname),
    publicDir: path.resolve(__dirname, 'public'),
    resolve: {
      alias: {
        '@logo-quiz/models': path.resolve(__dirname, '../../libs/models/src'),
        '@logo-quiz/store': path.resolve(__dirname, 'src/store'),
        '@logo-quiz/environment': path.resolve(__dirname, `src/environments/${envFile}`),
      },
    },
    server: {
      port: 4200,
      host: '0.0.0.0',
    },
    build: {
      outDir: path.resolve(__dirname, '../../dist/apps/logo-quiz'),
      emptyOutDir: true,
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '',
        },
      },
    },
  };
});
