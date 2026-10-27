import * as duckdb from '@duckdb/duckdb-wasm/blocking';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const expected = 'v2.0.0';
const db = await duckdb.createDuckDB(
  {
    base: {
      mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-base.wasm'),
      mainWorker: '',
    },
  },
  new duckdb.VoidLogger(),
  duckdb.NODE_RUNTIME,
);

try {
  await db.instantiate();
  const version = db.getVersion();
  if (version !== expected) {
    throw new Error(
      `LoQE requires the release DuckDB ${expected} runtime, got ${version}. ` +
        'Install the local runtime tarball or pass --duckdb-runtime to the Lakekeeper image build.',
    );
  }
  console.log(`[duckdb] release runtime ${version}: OK`);
} catch (error) {
  console.error(error.message ?? error);
  process.exitCode = 1;
} finally {
  db.reset();
}
