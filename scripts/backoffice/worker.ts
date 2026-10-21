import { setTimeout } from 'node:timers/promises';
import { Store, claim, importSeed, OfficeError, enqueue } from './store.js';

const store = new Store(); store.init();
if (process.argv.includes('--enqueue')) store.change(undefined, 'enqueue:cli', enqueue);
let stopped = false;
process.once('SIGTERM', () => { stopped = true; }); process.once('SIGINT', () => { stopped = true; });
do {
  try {
    // Only acquire/write when work is available. Jobs and edits share one short cross-process lock.
    const ready = store.read().jobs.some(j => j.status === 'QUEUED' || j.status === 'RUNNING' && (j.leaseUntil ?? 0) <= Date.now());
    if (ready) {
      const job = store.change(undefined, 'worker:claim', s => claim(s, Date.now()));
      if (job) {
        try {
          store.change(undefined, 'worker:import', s => importSeed(s, job));
          console.log(`DONE ${job.id}`);
        } catch (error) {
          if (error instanceof OfficeError && error.status === 409) throw error;
          store.change(undefined, 'worker:failed', s => { const j = s.jobs.find(x => x.id === job.id); if (j && j.leaseToken === job.leaseToken) { j.status = 'FAILED'; j.message = 'Impor gagal validasi; draf tidak ditimpa'; } });
          process.exitCode = 1;
        }
      }
    }
  } catch (e) {
    if (!(e instanceof OfficeError && e.status === 409)) { console.error('Worker gagal; periksa draf/izin filesystem'); process.exitCode = 1; }
  }
  if (!process.argv.includes('--once') && !stopped) await setTimeout(2000);
} while (!process.argv.includes('--once') && !stopped);
