-- organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT NOT NULL, -- 'trades' | 'municipal' | 'healthcare' | 'energy' | 'other'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'admin' | 'retiree' | 'successor'
  job_title TEXT,
  years_exp INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- transfer engagements table
CREATE TABLE transfer_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  retiree_id UUID NOT NULL REFERENCES users(id),
  successor_id UUID REFERENCES users(id),
  retirement_date DATE,
  release_date DATE,
  status TEXT DEFAULT 'pending', -- 'pending' | 'active' | 'complete'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- interview sessions table
CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES transfer_engagements(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL, -- 1 through 6
  session_focus TEXT NOT NULL, -- 'orientation' | 'processes' | 'decisions' | 'relationships' | 'edge_cases' | 'review'
  status TEXT DEFAULT 'pending', -- 'pending' | 'active' | 'complete'
  running_summary JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(engagement_id, session_number)
);

-- interview exchanges table
CREATE TABLE interview_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- 'anchor' | 'probe' | 'scenario' | 'contrast' | 'legacy' | 'gap_fill'
  response_text TEXT,
  ai_follow_up TEXT,
  knowledge_type TEXT, -- 'explicit' | 'tacit' | 'relational' | 'emergency' | 'exception'
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- knowledge profiles table
CREATE TABLE knowledge_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES transfer_engagements(id) ON DELETE CASCADE,
  section TEXT NOT NULL, -- 'processes' | 'decisions' | 'relationships' | 'edge_cases' | 'unwritten_rules' | 'advice'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  quote TEXT,
  knowledge_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
