import { sql } from "kysely";
import type { Connection } from "../db.js";

/** Learner-owned facts only. Imports, quick checks and self reports never become bank results. */
export async function practiceFacts(db: Connection, learnerId: string) {
  const attempts = (
    await sql<PracticeAttempt>`select id, session_id, question_revision_id, assistance, verdict, response,
      submitted_at, graded_at from question_attempt where learner_id=${learnerId}
      and source='LIVE' and kind <> 'QUICK_CHECK' and response->>'responseType' <> 'SELF_REPORT'
      order by submitted_at desc, ordinal desc, id desc`.execute(db)
  ).rows;
  const pending = (
    await sql<PendingQuestion>`select s.id as session_id, i.question_revision_id, s.last_activity_at
      from learning_session s join session_item i on i.session_id=s.id
      where s.learner_id=${learnerId} and s.kind='PRACTICE' and s.origin <> 'DEVICE_IMPORT'
        and s.state not in ('COMPLETED','ABANDONED','EXPIRED') and s.expires_at>now() and i.status='PENDING'
      order by s.last_activity_at desc, s.id desc`.execute(db)
  ).rows;
  return { attempts, pending };
}
export interface PracticeAttempt {
  id: string;
  session_id: string;
  question_revision_id: string;
  assistance: string;
  verdict: string;
  response: {
    responseType: string;
    text?: string;
    numeric?: string;
    optionId?: string;
    purged?: boolean;
  };
  submitted_at: Date;
  graded_at: Date | null;
}
export interface PendingQuestion {
  session_id: string;
  question_revision_id: string;
  last_activity_at: Date;
}
