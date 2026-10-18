-- Extracted from architecture 04; future job references deferred to their slices.
CREATE TABLE learner (
  id                    uuid PRIMARY KEY,
  status                text NOT NULL CHECK (status IN ('PENDING_CONSENT','ACTIVE','SUSPENDED','DELETION_PENDING')),
  age_band              text NOT NULL CHECK (age_band IN ('UNDER_13','AGE_13_15','AGE_16_17','ADULT','UNKNOWN')),
  age_band_source       text NOT NULL CHECK (age_band_source IN ('SELF_DECLARED','GUARDIAN_CONFIRMED','VERIFIED')),
  consent_deadline_at   timestamptz,               -- PENDING_CONSENT bootstrap data is erased after this
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  version               bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  CHECK (status <> 'PENDING_CONSENT' OR consent_deadline_at IS NOT NULL)
);

CREATE TABLE guardian (
  id                 uuid PRIMARY KEY,
  email_hash         bytea NOT NULL UNIQUE,         -- HMAC(normalized email); lookup only
  email_ciphertext   bytea NOT NULL,                -- envelope-encrypted; consent/revocation notices only
  verified_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
  id           uuid PRIMARY KEY,
  role         text NOT NULL CHECK (role IN ('STUDENT','GUARDIAN')),
  learner_id   uuid UNIQUE REFERENCES learner(id),
  guardian_id  uuid UNIQUE REFERENCES guardian(id),
  status       text NOT NULL CHECK (status IN ('ACTIVE','DISABLED','DELETION_PENDING')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'STUDENT'  AND learner_id IS NOT NULL AND guardian_id IS NULL)
      OR (role = 'GUARDIAN' AND guardian_id IS NOT NULL AND learner_id IS NULL))
);

CREATE TABLE auth_identity (
  id                uuid PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES app_user(id),
  provider          text NOT NULL CHECK (provider IN ('GOOGLE','EMAIL')),
  subject           text NOT NULL,                  -- Google "sub"; for EMAIL the HMAC of the verified address
  email_verified    boolean NOT NULL,
  email_ciphertext  bytea,                          -- only if needed for transactional mail
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, subject)
);

CREATE TABLE auth_session (
  id                    uuid PRIMARY KEY,
  token_hash            bytea NOT NULL UNIQUE,      -- SHA-256 of the 256-bit opaque cookie value
  csrf_secret_hash      bytea NOT NULL,
  user_id               uuid REFERENCES app_user(id),   -- NULL = anonymous pre-auth session (OAuth binding only)
  created_at            timestamptz NOT NULL DEFAULT now(),
  last_seen_at          timestamptz NOT NULL DEFAULT now(),
  idle_expires_at       timestamptz NOT NULL,
  absolute_expires_at   timestamptz NOT NULL,
  revoked_at            timestamptz
);

CREATE TABLE auth_transaction (
  id                         uuid PRIMARY KEY,
  session_id                 uuid NOT NULL REFERENCES auth_session(id),
  provider                   text NOT NULL CHECK (provider IN ('GOOGLE','EMAIL')),
  state_hash                 bytea NOT NULL UNIQUE,
  nonce_hash                 bytea,
  pkce_verifier_ciphertext   bytea,
  continuation               jsonb NOT NULL,       -- Continuation VO: allow-listed route + optional sessionId/lessonStep
  expires_at                 timestamptz NOT NULL,
  consumed_at                timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_profile (
  learner_id               uuid PRIMARY KEY REFERENCES learner(id),
  display_name             varchar(40),          -- optional nickname; never a legal name requirement
  grade                    smallint CHECK (grade BETWEEN 7 AND 12),
  timezone                 text NOT NULL DEFAULT 'Asia/Jakarta' CHECK (timezone IN ('Asia/Jakarta','Asia/Makassar','Asia/Jayapura')),
  preferred_subject_codes  text[] NOT NULL DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE consent_record (
  id                   uuid PRIMARY KEY,
  learner_id           uuid NOT NULL REFERENCES learner(id),
  guardian_id          uuid NOT NULL REFERENCES guardian(id),   -- the guardian who decides or is notified
  purpose              text NOT NULL CHECK (purpose IN ('LEARNING_DATA','AI_PROCESSING','IMAGE_UPLOAD','PRODUCT_ANALYTICS')),
  status               text NOT NULL CHECK (status IN ('PENDING','GRANTED','DECLINED','EXPIRED','REVOKED')),
  method               text NOT NULL CHECK (method IN ('GUARDIAN_EMAIL','GUARDIAN_SIGNIN','SELF_WITH_GUARDIAN_NOTICE')),
  policy_version       text NOT NULL,
  policy_text_sha256   bytea NOT NULL,           -- exact text shown to the decider
  request_token_hash   bytea UNIQUE,             -- one-time link token, hashed
  decided_by           text CHECK (decided_by IN ('GUARDIAN','LEARNER','SYSTEM')),
  requested_at         timestamptz NOT NULL DEFAULT now(),
  decided_at           timestamptz,
  revoked_at           timestamptz,
  expires_at           timestamptz NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'GRANTED' OR decided_at IS NOT NULL)
);
CREATE UNIQUE INDEX consent_one_live_per_purpose ON consent_record (learner_id, purpose) WHERE status IN ('PENDING','GRANTED');

CREATE TABLE deletion_request (
  id             uuid PRIMARY KEY,
  learner_id     uuid NOT NULL REFERENCES learner(id),
  requested_by   text NOT NULL CHECK (requested_by IN ('LEARNER','GUARDIAN','SYSTEM')),
  reason         text NOT NULL CHECK (reason IN ('USER_REQUEST','CONSENT_DECLINED','CONSENT_REVOKED','CONSENT_EXPIRED','INACTIVITY','OTHER')),
  status         text NOT NULL CHECK (status IN ('QUEUED','RUNNING','COMPLETED','FAILED')),
  attempts       smallint NOT NULL DEFAULT 0,
  last_error     text,
  requested_at   timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz,
  completed_at   timestamptz
);
CREATE UNIQUE INDEX deletion_one_active ON deletion_request (learner_id) WHERE status IN ('QUEUED','RUNNING');

CREATE TABLE erasure_receipt (                      -- restricted schema; no FK by design
  receipt_id          uuid PRIMARY KEY,
  subject_digest      bytea NOT NULL UNIQUE,         -- HMAC(learner_id) under a restricted key; replayed after backup restore
  completed_at        timestamptz NOT NULL,
  backup_purge_after  timestamptz NOT NULL
);

CREATE TABLE audit_event (
  id               uuid PRIMARY KEY,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  actor_type       text NOT NULL CHECK (actor_type IN ('LEARNER','GUARDIAN','STAFF','SYSTEM')),
  actor_ref        bytea,                             -- pseudonymous HMAC
  subject_ref      bytea,                             -- pseudonymous HMAC of learner_id; no FK
  action           text NOT NULL,                     -- e.g. CONSENT_GRANTED, DELETION_COMPLETED, STAFF_VIEWED_SESSION
  detail           jsonb NOT NULL DEFAULT '{}'        -- ≤ 2 KB, no free text from learners
);

CREATE TABLE idempotency_record (
  scope_kind       text NOT NULL CHECK (scope_kind IN ('LEARNER','GUARDIAN','AUTH_SESSION')),
  scope_id         uuid NOT NULL,                     -- no FK: erasure deletes by scope_id
  operation        text NOT NULL,                     -- "METHOD route-template" + resource id
  key              varchar(128) NOT NULL,
  request_sha256   bytea NOT NULL,
  status           text NOT NULL CHECK (status IN ('IN_PROGRESS','COMPLETED')),
  response_status  smallint,
  response_body    jsonb,                             -- business payload only; never secrets
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  PRIMARY KEY (scope_kind, scope_id, operation, key)
);

CREATE TABLE job (
  id                   uuid PRIMARY KEY,
  queue                text NOT NULL CHECK (queue IN ('diagnosis','tutor','intake','deletion','projection')),
  deletion_request_id  uuid UNIQUE REFERENCES deletion_request(id),
  status               text NOT NULL CHECK (status IN ('QUEUED','RUNNING','DONE','FAILED','CANCELLED')),
  priority             smallint NOT NULL DEFAULT 0,
  available_at         timestamptz NOT NULL DEFAULT now(),
  lease_token          uuid,
  lease_until          timestamptz,
  attempts             smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts         smallint NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 5),
  deadline_at          timestamptz NOT NULL,
  last_error_code      text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (deletion_request_id IS NOT NULL),
  CHECK ((status = 'RUNNING') = (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);


CREATE INDEX identity_user ON auth_identity(user_id);
CREATE INDEX auth_session_user_idx ON auth_session(user_id);
CREATE INDEX session_expiry ON auth_session(idle_expires_at);
CREATE INDEX transaction_session ON auth_transaction(session_id);
CREATE INDEX consent_guardian ON consent_record(guardian_id);
CREATE INDEX consent_expiry ON consent_record(expires_at) WHERE status = 'PENDING';
CREATE INDEX idempotency_expiry ON idempotency_record(expires_at);
CREATE INDEX job_queued ON job(queue, priority DESC, available_at) WHERE status = 'QUEUED';
CREATE INDEX job_lease ON job(lease_until) WHERE status = 'RUNNING';
CREATE INDEX audit_subject ON audit_event(subject_ref);
CREATE INDEX audit_time ON audit_event(occurred_at);
ALTER TABLE auth_transaction ADD CHECK (octet_length(continuation::text) <= 4096);
ALTER TABLE audit_event ADD CHECK (octet_length(detail::text) <= 2048);
ALTER TABLE idempotency_record ADD CHECK (octet_length(response_body::text) <= 16384);
