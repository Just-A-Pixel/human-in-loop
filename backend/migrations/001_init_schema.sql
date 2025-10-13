CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE approvals (
  context_id text PRIMARY KEY,
  approver_name text,
  title text,
  deadline timestamptz,
  turns jsonb DEFAULT '[]'::jsonb,
  snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  user_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username text NOT NULL UNIQUE,
  display_name text,
  channels text[] DEFAULT ARRAY['email'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  event_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  context_id text,
  type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_approvals_status_deadline ON approvals (status, deadline);
CREATE INDEX idx_approvals_snapshot_gin ON approvals USING gin (snapshot jsonb_path_ops);
