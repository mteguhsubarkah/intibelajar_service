import { sql } from 'kysely';
import type { Connection } from '../db.js';
import type { Release } from './interface.js';
// Deterministic catalog mapping, not an AI diagnosis. Map concepts needed by the task;
// do not automatically display all their prerequisite concepts for a numeric evaluation.
export interface LegacyIntakeMap { subject: string | null; topicId: string | null; cores: string[]; demo: false }

/** Suggest catalog concepts from supported question wording; this does not assess mastery. */
export function detect(text: string) {
  const t = text.toLowerCase().replace(/\b(sin|cos|tan)\s*([0-9])/g,'$1 $2');
  const trig = /(^|[^a-z])(sin|sinus|cos|cosinus|kosinus|tan|tangen|trigonometri|sudut|segitiga|tangga|menara|elevasi|depresi)([^a-z]|$)|°/.test(t);
  const eks = /(pangkat|eksponen|logaritma|(^|[^a-z])log([^a-z]|$)|[²³⁻ⁿ]|\^)/.test(t);
  const cores: string[] = [];
  if (trig) {
    const specialAngle = /(?:^|[^\d.])(0|30|45|60|90)\s*(?:°|derajat)|(?:sinus|cosinus|kosinus|tangen|sin|cos|tan)\s*\(?\s*(?:0|30|45|60|90)(?![\d.])/.test(t);
    const geometry = /segitiga|siku|sisi|miring|depan|samping|hipotenusa|hypotenuse|tangga|menara|tiang|papan|bayangan|tinggi|jarak|panjang|elevasi|depresi|diagram/.test(t);
    const symbolic = /(?:sinus|cosinus|kosinus|tangen|sin|cos|tan)\b\s*\(?\s*[a-zα-ω](?![a-zα-ω])|identitas|buktikan/.test(t);
    // cos 30 is a special-angle lookup. Triangle modelling and symbolic ratio tasks
    // still need the triangle/ratio concepts; do not confuse prerequisites with task scope.
    if (!specialAngle || geometry || symbolic) cores.push('tri-c', 'tri-d');
    if (specialAngle) cores.push('tri-f');
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
