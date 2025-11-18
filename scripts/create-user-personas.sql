-- Create table for per-user personas
CREATE TABLE IF NOT EXISTS public.user_personas (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  needs TEXT,
  profile TEXT,
  age_range TEXT,
  income TEXT,
  status TEXT,
  goals JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_personas_user_id ON public.user_personas(user_id);

-- Create table for shared personas (share links)
CREATE TABLE IF NOT EXISTS public.shared_personas (
  token TEXT PRIMARY KEY,
  owner_user_id UUID,
  persona JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_personas_owner ON public.shared_personas(owner_user_id);

-- Example: grant minimal access if you use RLS; adjust as needed for your environment
-- GRANT SELECT ON public.shared_personas TO anon;
