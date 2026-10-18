import { resolve } from 'node:path';
import { loadManifest, type Manifest } from '../../src/catalog/manifest.js';
// Reviewed fixture for publisher and catalog tests. It is derived at runtime from the committed draft,
// so it cannot drift from it. The committed draft itself stays unreviewed: these review marks are synthetic
// and exist only in test memory. They are not a content decision.

export const draftManifest = () => loadManifest(resolve('catalog/manifest'));

export function reviewedFixture(draft: Manifest = draftManifest(), version = 1): Manifest {
  const m = structuredClone(draft);
  const mark = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(mark); return; }
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if ((o.review as { status?: string } | undefined)?.status === 'PROPOSED') o.review = { ...(o.review as object), status: 'REVIEWED' };
    Object.values(o).forEach(mark);
  };
  mark(m);
  m.release.version = version;
  m.release.decisions = m.release.decisions.map(d => ({ ...d, status: 'APPROVED' }));
  m.release.signOff = { status: 'REVIEWED', reviewers: [{ name: 'Synthetic test reviewer', role: 'test fixture (not a content decision)', date: '2026-10-18' }] };
  m.release.source = { ...m.release.source, frontendDataDirty: false };
  return m;
}
