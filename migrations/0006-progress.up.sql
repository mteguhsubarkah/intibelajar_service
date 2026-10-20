-- Extracted from authoritative 04; development projection tables.
CREATE TABLE mastery_state (
  learner_id               uuid NOT NULL REFERENCES learner(id),
  concept_id               uuid NOT NULL REFERENCES concept(id),
  status                   text NOT NULL CHECK (status IN ('NOT_ASSESSED','DEVELOPING','DEMONSTRATED')),
  exploration              text NOT NULL CHECK (exploration IN ('UNVISITED','VISITED')),
  lesson_complete          boolean NOT NULL DEFAULT false,
  practiced                boolean NOT NULL DEFAULT false,
  transfer_streak          smallint NOT NULL DEFAULT 0 CHECK (transfer_streak BETWEEN 0 AND 3),
  transfer_correct_total   int NOT NULL DEFAULT 0 CHECK (transfer_correct_total >= 0),
  qualifying_contexts      smallint NOT NULL DEFAULT 0 CHECK (qualifying_contexts >= 0),
  needs_review             boolean NOT NULL DEFAULT false,
  needs_review_reason      text CHECK (needs_review_reason IN ('CONTRADICTION','STALE_14D')),
  ui_tier                  smallint NOT NULL DEFAULT -1 CHECK (ui_tier BETWEEN -1 AND 3),
  demonstrated_at          timestamptz,
  last_practiced_at        timestamptz,
  policy_version           text NOT NULL,
  version                  bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, concept_id),
  CHECK ((status = 'DEMONSTRATED') = (demonstrated_at IS NOT NULL)),
  CHECK (needs_review = (needs_review_reason IS NOT NULL))
);

CREATE TABLE progress_event (
  id            uuid PRIMARY KEY,
  learner_id    uuid NOT NULL REFERENCES learner(id),
  session_id    uuid REFERENCES learning_session(id),
  evidence_id   uuid REFERENCES concept_evidence(id),
  event_key     text NOT NULL,                       -- deterministic, e.g. 'xp:SOAL_BENAR:<familyCode>'
  type          text NOT NULL CHECK (type IN ('CONCEPT_VISITED','ATTEMPT_GRADED','LESSON_COMPLETED','SESSION_COMPLETED','MASTERY_CHANGED','TIER_CHANGED','XP_AWARDED','STREAK_EXTENDED','STREAK_FREEZE_USED','MISSION_COMPLETED','DEVICE_HISTORY_IMPORTED')),
  xp_delta      int NOT NULL DEFAULT 0 CHECK (xp_delta >= 0),
  payload       jsonb NOT NULL DEFAULT '{}',          -- ≤ 4 KB, ids and enums only
  local_date    date NOT NULL,                        -- learner timezone bucket for streaks/missions
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, event_key),
  CHECK (type = 'XP_AWARDED' OR xp_delta = 0)
);

CREATE TABLE learner_stats (
  learner_id              uuid PRIMARY KEY REFERENCES learner(id),
  xp_total                int NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
  current_streak_days     int NOT NULL DEFAULT 0 CHECK (current_streak_days >= 0),
  longest_streak_days     int NOT NULL DEFAULT 0 CHECK (longest_streak_days >= 0),
  last_active_local_date  date,
  streak_freezes          smallint NOT NULL DEFAULT 0 CHECK (streak_freezes BETWEEN 0 AND 2),
  policy_version          text NOT NULL,
  version                 bigint NOT NULL DEFAULT 1,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX progress_events_learner_time ON progress_event(learner_id,occurred_at,id);
