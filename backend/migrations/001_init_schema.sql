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
  username text UNIQUE,
  display_name text,
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

-- Can add more columns as more channels are supported
CREATE TABLE channels (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username text UNIQUE,
  n8n text UNIQUE,
  email text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_approvals_status_deadline ON approvals (status, deadline);
CREATE INDEX idx_approvals_snapshot_gin ON approvals USING gin (snapshot jsonb_path_ops);

-- Insert default test user
INSERT INTO users (username, display_name)
VALUES ('test', 'Test User')
ON CONFLICT (username) DO NOTHING;

-- Insert default n8n notification webhook for demo
INSERT INTO channels (username, n8n)
VALUES ('test', 'http://host.docker.internal:5678/webhook-test/5a92773c-8f1b-4366-adb2-fa22ee4f495e');