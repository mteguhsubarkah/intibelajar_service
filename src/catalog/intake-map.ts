import { sql } from 'kysely';
import type { Connection } from '../db.js';
import type { Release } from './interface.js';
// Legacy facade L8 (Slice 2 M7; 09 §6.2): POST /v1/learning/intake/map. A server port of the shipped frontend's
// detectLocally (services/intake.ts): a deterministic keyword mapper that maps only to topics the catalog maps and never
// guesses a concept for a question it does not recognise. No AI, no storage. The port keeps the frontend's rules
// verbatim; the only differences are `demo: false` and that every id is checked against the current release's frozen
// aliases (rule 8), so an alias the catalog does not carry is dropped rather than sent to a client that would discard it.

export interface LegacyIntakeMap { subject: string | null; topicId: string | null; cores: string[]; demo: false }

/** detectLocally, verbatim (the test compares both on the same inputs). */
export function detect(text: string) {
  const t = text.toLowerCase().replace(/\b(sin|cos|tan)\s*([0-9])/g,'$1 $2');
  const trig = /(^|[^a-z])(sin|sinus|cos|cosinus|kosinus|tan|tangen|trigonometri|sudut|segitiga|tangga|menara|elevasi|depresi)([^a-z]|$)|°/.test(t);
  const eks = /(pangkat|eksponen|logaritma|(^|[^a-z])log([^a-z]|$)|[²³⁻ⁿ]|\^)/.test(t);
  const cores: string[] = [];
  if (trig) {
    cores.push('tri-c', 'tri-d');
    if (/(30|45|60|90)\s*°|(30|45|60|90)\s*derajat|(?:sin|cos|tan)\s*\(?\s*(?:30|45|60|90)(?:\D|$)/.test(t)) cores.push('tri-f');
    if (/elevasi|depresi/.test(t)) cores.push('tri-p');
  }
  if (eks) cores.push('eks-b');
  if (eks && /=/.test(t) && /[a-z]\s*\^|ˣ|x/.test(t)) cores.push('eks-j');
  return { subject: trig || eks ? 'matematika' : null, topicId: trig ? 'trigonometri' : eks ? 'eksponen' : null, cores };
}

export async function legacyIntakeMap(db: Connection, release: Release, text: string): Promise<LegacyIntakeMap> {
  const found = detect(text);
  const wanted = [found.subject, found.topicId, ...found.cores].filter((x): x is string => x !== null);
  const known = new Set(wanted.length ? (await sql<{ k: string }>`select namespace || ':' || alias as k from catalog_alias
    where release_id = ${release.id} and namespace in ('SUBJECT', 'TOPIC', 'MAP') and alias in (${sql.join(wanted)})`.execute(db)).rows.map(r => r.k) : []);
  return {
    subject: found.subject && known.has('SUBJECT:' + found.subject) ? found.subject : null,
    topicId: found.topicId && known.has('TOPIC:' + found.topicId) ? found.topicId : null,
    cores: found.cores.filter(c => known.has('MAP:' + c)),
    demo: false,
  };
}
