CREATE TABLE private_asset (
  id            uuid PRIMARY KEY,
  learner_id    uuid NOT NULL REFERENCES learner(id),
  storage_key   text NOT NULL UNIQUE,                  -- random, non-guessable; bucket is private
  media_type    text NOT NULL CHECK (media_type IN ('image/jpeg','image/png','image/webp')),
  byte_size     int NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
  sha256        bytea NOT NULL,
  status        text NOT NULL CHECK (status IN ('QUARANTINED','READY','REJECTED','DELETED')),
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE question_intake (
  id                      uuid PRIMARY KEY,
  learner_id              uuid NOT NULL REFERENCES learner(id),
  input_mode              text NOT NULL CHECK (input_mode IN ('PHOTO','TYPED')),
  asset_id                uuid UNIQUE REFERENCES private_asset(id),
  status                  text NOT NULL CHECK (status IN ('RECEIVED','READING','READ','CONFIRMED','DISCARDED','FAILED','EXPIRED')),
  draft_text              text CHECK (char_length(draft_text) <= 2000),
  read_confidence         numeric(4,3) CHECK (read_confidence BETWEEN 0 AND 1),
  suggested_topic_id      uuid REFERENCES topic(id),
  suggested_concept_ids   uuid[] NOT NULL DEFAULT '{}',   -- advisory; re-validated at confirmation
  confirmed_question_id   uuid UNIQUE REFERENCES question(id),
  failure_code            text,
  expires_at              timestamptz NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CHECK ((input_mode = 'PHOTO') = (asset_id IS NOT NULL) OR status IN ('DISCARDED','EXPIRED'))
);
-- Development-only encrypted image quarantine; no public image URL.
CREATE TABLE development_intake_image(asset_id uuid PRIMARY KEY REFERENCES private_asset(id),ciphertext bytea NOT NULL,lease text,lease_until timestamptz);
