CREATE TABLE tutor_conversation (
  id                    uuid PRIMARY KEY,
  learner_id            uuid NOT NULL,
  session_id            uuid NOT NULL,
  concept_id            uuid REFERENCES concept(id),
  question_revision_id  uuid NOT NULL REFERENCES question_revision(id),
  status                text NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  hints_used            smallint NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
  solution_unlocked     boolean NOT NULL DEFAULT false,
  context_version       bigint NOT NULL DEFAULT 1,
  expires_at            timestamptz NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_id, learner_id) REFERENCES learning_session (id, learner_id)
);

CREATE TABLE tutor_message (
  id                uuid PRIMARY KEY,
  conversation_id   uuid NOT NULL REFERENCES tutor_conversation(id),
  ordinal           int NOT NULL CHECK (ordinal > 0),
  role              text NOT NULL CHECK (role IN ('LEARNER','TUTOR')),
  status            text NOT NULL CHECK (status IN ('PENDING','COMPLETED','FAILED','BLOCKED')),
  text              text CHECK (char_length(text) <= 2000),
  quick_replies     jsonb NOT NULL DEFAULT '[]',     -- ≤ 4 short strings
  intent            text CHECK (intent IN ('QUESTION','SOCRATIC_PROMPT','HINT','SOLUTION_REVIEW','REDIRECT','REFUSAL')),
  reply_to_id       uuid REFERENCES tutor_message(id),
  moderation        jsonb NOT NULL DEFAULT '{}',
  prompt_version    text,
  model             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  UNIQUE (conversation_id, ordinal),
  CHECK (role = 'LEARNER' OR reply_to_id IS NOT NULL)
);
CREATE UNIQUE INDEX tutor_open_session_focus ON tutor_conversation(session_id,coalesce(concept_id,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE status='OPEN';
CREATE UNIQUE INDEX tutor_reply_once ON tutor_message(reply_to_id) WHERE role='TUTOR';
