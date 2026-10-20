import type { Connection } from '../db.js';
import { gradingSource } from '../catalog/grading-source.js';
export async function tutorChoices(db:Connection,revisionId:string){
 const source=await gradingSource(db,revisionId);
 return(await Promise.all((source.rubric.tutorLadder?.nodes.map(n=>n.ask)??[]).map(async ask=>{const step=await tutorStep(db,revisionId,ask,0);return step?{ask,...step}:null;}))).filter((x):x is NonNullable<typeof x>=>!!x);
}

/** Authored allowlist only: free text never expands the tutor's topic or exposes a private full node. */
export async function tutorStep(db: Connection, revisionId: string, message: string, hintsUsed: number) {
  const source = await gradingSource(db, revisionId), ladder = source.rubric.tutorLadder;
  if (!ladder) return null;
  const normalized = message.trim().toLocaleLowerCase('id');
  const full = normalized === 'lihat pembahasan lengkap';
  const hint = ['kasih petunjuk', 'kasih petunjuk lagi'].includes(normalized) || full && hintsUsed < 2;
  if (full && hintsUsed >= 2) return { full: true, hint: false, text: '', quick: [] as string[], hintsUsed };
  if (hint) return { full: false, hint: hintsUsed < 2, text: ladder.hints[Math.min(hintsUsed, 1)],
    hintsUsed: Math.min(2, hintsUsed + 1), quick: hintsUsed >= 1 ? ['Lihat pembahasan lengkap'] : ['Kasih petunjuk lagi'] };
  const node = ladder.nodes.find(n => n.ask.toLocaleLowerCase('id') === normalized);
  return { full: false, hint: false, hintsUsed,
    text: node?.text ?? 'Aku hanya membantu soal yang sedang kamu buka. Pilih hubungan yang ingin kamu pahami di bawah ini.',
    quick: node?.quick ?? ['Hubungkan soal dengan inti', 'Bangun soal dari inti', 'Kasih petunjuk'] };
}
