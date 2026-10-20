-- Synthetic development-only spend ledger; no learner content or identifiers.
CREATE TABLE development_ai_call (
  id uuid PRIMARY KEY,
  reserved_idr integer NOT NULL CHECK (reserved_idr > 0 AND reserved_idr <= 80000),
  status text NOT NULL CHECK (status IN ('RESERVED','SUCCEEDED','FAILED')),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
