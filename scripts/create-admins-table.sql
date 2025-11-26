  -- Create table to track admin users (only populated for admins)
  CREATE TABLE IF NOT EXISTS user_admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    email text NOT NULL UNIQUE,
    is_admin boolean NOT NULL DEFAULT true,
    is_blocked boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  -- Ensure is_blocked column exists for older installations
  ALTER TABLE IF EXISTS user_admins
    ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

  -- Index on email for lookup convenience (UNIQUE already creates an index)
  CREATE INDEX IF NOT EXISTS user_admins_email_idx ON user_admins (email);
