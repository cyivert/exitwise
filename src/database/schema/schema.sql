-- drop in reverse order to clear dependencies
DROP TABLE IF EXISTS knowledge_profiles CASCADE;
DROP TABLE IF EXISTS interview_exchanges CASCADE;
DROP TABLE IF EXISTS interview_sessions CASCADE;
DROP TABLE IF EXISTS transfer_engagements CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- enable uuid support
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  job_title TEXT,
  years_exp INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. transfer_engagements
CREATE TABLE transfer_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  retiree_id UUID NOT NULL REFERENCES users(id),
  successor_id UUID REFERENCES users(id),
  retirement_date DATE,
  release_date DATE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. interview_sessions
CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES transfer_engagements(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  retiree_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  session_focus TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  running_summary JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(engagement_id, session_number)
);

-- 5. interview_exchanges
CREATE TABLE interview_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  retiree_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  response_text TEXT,
  ai_follow_up TEXT,
  knowledge_type TEXT,
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. knowledge_profiles
CREATE TABLE knowledge_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES transfer_engagements(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  quote TEXT,
  knowledge_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

 --Create column:
ALTER TABLE organizations ADD COLUMN invite_code TEXT;

--Verify it exist:
SELECT column_name FROM information_schema.columns WHERE table_name = 'organizations';

--If exist, add constraint and data:
ALTER TABLE organizations ADD CONSTRAINT organizations_invite_code_key UNIQUE (invite_code);
UPDATE organizations
SET invite_code = substring(gen_random_uuid()::text, 1, 8)
WHERE invite_code IS NULL;