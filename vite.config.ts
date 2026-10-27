import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { existsSync, mkdirSync, copyFileSync, cpSync, rmSync, readFileSync } from 'fs';

const duckdbFiles = [
  'duckdb-browser-base.worker.js',
  'duckdb-base.wasm',
  'duckdb-threads.wasm',
  'duckdb-browser-threads.worker.js',
  'duckdb-browser-threads.pthread.worker.js',
];

// Copy DuckDB WASM files from @duckdb/duckdb-wasm npm package into public/duckdb/
// so Vite includes them in dist/ output. This avoids committing ~100MB of binaries to git.
function copyDuckDBFiles() {
  return {
    name: 'copy-duckdb-files',
    buildStart() {
      const srcDir = resolve(__dirname, 'node_modules/@duckdb/duckdb-wasm/dist');
      const destDir = resolve(__dirname, 'public/duckdb');
      const experimentDir = process.env.DUCKDB_THREADED_ARTIFACT_DIR;
      if (!experimentDir)
        throw new Error('Set DUCKDB_THREADED_ARTIFACT_DIR to the threaded build artifact.');
      const manifest = JSON.parse(readFileSync(resolve(experimentDir, 'manifest.json'), 'utf8'));
      if (manifest.pthread_pool_size !== 32 || manifest.duckdb_version !== 'v2.0.0') {
        throw new Error('This experiment requires DuckDB 2.0.0 with a 32-worker pool.');
      }
      const sourceFile = (file: string) =>
        resolve(file.includes('threads') ? resolve(experimentDir, 'runtime') : srcDir, file);

      if (!existsSync(srcDir)) {
        throw new Error(`DuckDB WASM package not found at ${srcDir}. Run "npm install" first.`);
      }

      const missing = duckdbFiles.filter((file) => !existsSync(sourceFile(file)));
      if (missing.length > 0) {
        throw new Error(`Missing DuckDB WASM files in ${srcDir}:\n  - ${missing.join('\n  - ')}`);
      }

      rmSync(destDir, { recursive: true, force: true });
      mkdirSync(destDir, { recursive: true });
      duckdbFiles.forEach((file) => {
        copyFileSync(sourceFile(file), resolve(destDir, file));
      });
      console.log('Copied DuckDB WASM files from @duckdb/duckdb-wasm');

      // Vendor both DuckDB extension platforms so
      // LoQE installs them from our own origin instead of extensions.duckdb.org —
      // works airgapped/offline. Downloaded at build time (and cached) by
      // scripts/download-duckdb-extensions.mjs (wired to prebuild/predev),
      // version-locked to the duckdb-wasm core version.
      const extSrc = resolve(__dirname, 'duckdb-extensions');
      if (!existsSync(extSrc)) {
        throw new Error(
          `DuckDB extensions missing at ${extSrc}. Run \`npm run download-duckdb-extensions\` ` +
            `(prebuild/predev normally do this). Without them LoQE cannot load extensions offline.`,
        );
      }
      // Replace the generated mirror so versions pruned from the download cache
      // cannot survive in public/ and be copied back into dist/ on the next build.
      const extDest = resolve(destDir, 'extensions');
      rmSync(extDest, { recursive: true, force: true });
      cpSync(extSrc, extDest, { recursive: true });
      console.log('Copied DuckDB extensions (including azure_wasm)');
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    copyDuckDBFiles(),
    vue({
      template: {
        compilerOptions: {
          hoistStatic: false,
          prefixIdentifiers: true,
          // ldrs web components (l-helix, l-hourglass, etc.)
          isCustomElement: (tag) => tag.startsWith('l-'),
        },
      },
    }),
    dts({
      // Generate .d.ts files
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.stories.ts'],
      // Output directory for type declarations
      outDir: 'dist/types',
      //Don't bundle into single file - keep structure
      rollupTypes: false,
      // Log level
      logLevel: 'warn',
      // Static import
      staticImport: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ConsoleComponents',
      fileName: (format) => `console-components.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: [
        'vue',
        'vuetify',
        /^vuetify\//,
        'vue-router',
        'pinia',
        'oidc-client-ts',
        /^virtual:/,
        'json-bigint',
        '@wdns/vue-code-block',
        'chart.js',
        'vue-chartjs',
        'date-fns',
        'vue-json-pretty',
        /^vue-json-pretty\/.*$/,
        '@duckdb/duckdb-wasm',
        'apache-arrow',
      ],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          vuetify: 'Vuetify',
          'vuetify/components': 'VuetifyComponents',
          'vue-router': 'VueRouter',
          pinia: 'Pinia',
          'oidc-client-ts': 'OidcClient',
          'json-bigint': 'JSONBig',
          'date-fns': 'dateFns',
          'vue-json-pretty': 'VueJsonPretty',
          'chart.js': 'Chart',
          'vue-chartjs': 'VueChartjs',
          '@wdns/vue-code-block': 'VueCodeBlock',
          '@duckdb/duckdb-wasm': 'DuckDB',
          'apache-arrow': 'Arrow',
        },
        manualChunks: undefined,
        generatedCode: {
          symbols: true,
        },
      },
    },
    cssCodeSplit: false,
    minify: 'oxc',
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
});
