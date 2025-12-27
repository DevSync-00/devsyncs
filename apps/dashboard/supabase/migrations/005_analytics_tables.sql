-- Analytics and Historical Data Tables
-- This migration creates tables for storing analytics data, schema snapshots, and metrics

-- Schema Snapshots: Store historical schema states for drift analysis
CREATE TABLE IF NOT EXISTS schema_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  schema_type TEXT NOT NULL, -- 'code' or 'db'
  schema_data JSONB NOT NULL, -- Full schema state
  schema_hash TEXT NOT NULL, -- SHA-256 hash for change detection
  mismatch_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add missing columns if table exists but is incomplete
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_snapshots') THEN
    -- Add schema_data column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schema_snapshots' AND column_name = 'schema_data') THEN
      ALTER TABLE schema_snapshots ADD COLUMN schema_data JSONB;
      -- Set a default empty object for existing rows
      UPDATE schema_snapshots SET schema_data = '{}'::jsonb WHERE schema_data IS NULL;
      ALTER TABLE schema_snapshots ALTER COLUMN schema_data SET NOT NULL;
    END IF;
    
    -- Add schema_type column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schema_snapshots' AND column_name = 'schema_type') THEN
      ALTER TABLE schema_snapshots ADD COLUMN schema_type TEXT;
      UPDATE schema_snapshots SET schema_type = 'db' WHERE schema_type IS NULL;
      ALTER TABLE schema_snapshots ALTER COLUMN schema_type SET NOT NULL;
    END IF;
    
    -- Add schema_hash column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schema_snapshots' AND column_name = 'schema_hash') THEN
      ALTER TABLE schema_snapshots ADD COLUMN schema_hash TEXT;
      -- Update existing rows with a hash based on schema_data (now it should exist)
      UPDATE schema_snapshots SET schema_hash = COALESCE(md5(schema_data::text), md5(id::text)) WHERE schema_hash IS NULL;
      ALTER TABLE schema_snapshots ALTER COLUMN schema_hash SET NOT NULL;
    END IF;
    
    -- Add mismatch_count column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schema_snapshots' AND column_name = 'mismatch_count') THEN
      ALTER TABLE schema_snapshots ADD COLUMN mismatch_count INTEGER DEFAULT 0;
    END IF;
    
    -- Add created_by column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schema_snapshots' AND column_name = 'created_by') THEN
      ALTER TABLE schema_snapshots ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
  END IF;
END $$;

-- Schema Drift Metrics: Track drift trends over time
CREATE TABLE IF NOT EXISTS schema_drift_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_tables INTEGER DEFAULT 0,
  total_columns INTEGER DEFAULT 0,
  changed_tables INTEGER DEFAULT 0,
  changed_columns INTEGER DEFAULT 0,
  new_tables INTEGER DEFAULT 0,
  new_columns INTEGER DEFAULT 0,
  removed_tables INTEGER DEFAULT 0,
  removed_columns INTEGER DEFAULT 0,
  drift_velocity NUMERIC(10, 2) DEFAULT 0, -- Changes per day
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, snapshot_date)
);

-- Migration Metrics: Track migration performance and patterns
CREATE TABLE IF NOT EXISTS migration_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  execution_type TEXT NOT NULL, -- 'apply', 'rollback', 'dry_run'
  execution_status TEXT NOT NULL, -- 'success', 'failed', 'running'
  duration_ms INTEGER,
  affected_tables INTEGER DEFAULT 0,
  affected_rows INTEGER DEFAULT 0,
  complexity_score NUMERIC(5, 2) DEFAULT 0, -- Based on SQL complexity
  validation_errors INTEGER DEFAULT 0,
  validation_warnings INTEGER DEFAULT 0,
  breaking_changes INTEGER DEFAULT 0,
  executed_by UUID REFERENCES auth.users(id),
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Team Activity Metrics: Track per-developer/team activity
CREATE TABLE IF NOT EXISTS team_activity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  scans_count INTEGER DEFAULT 0,
  migrations_count INTEGER DEFAULT 0,
  fixes_applied INTEGER DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id, project_id, activity_date)
);

-- Schema Stability Scores: Track stability scores over time
CREATE TABLE IF NOT EXISTS schema_stability_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  score_date DATE NOT NULL,
  stability_score NUMERIC(5, 2) NOT NULL, -- 0-100
  drift_velocity_score NUMERIC(5, 2) DEFAULT 0, -- Component of stability
  migration_failure_score NUMERIC(5, 2) DEFAULT 0, -- Component of stability
  breaking_change_score NUMERIC(5, 2) DEFAULT 0, -- Component of stability
  trend TEXT DEFAULT 'stable', -- 'improving', 'stable', 'degrading'
  factors JSONB DEFAULT '{}', -- Detailed breakdown
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, score_date)
);

-- Frequently Changing Objects: Track tables/columns that change often
CREATE TABLE IF NOT EXISTS frequently_changing_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL, -- 'table' or 'column'
  object_name TEXT NOT NULL, -- Table or column name
  change_count INTEGER DEFAULT 0,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_changed_at TIMESTAMPTZ DEFAULT NOW(),
  risk_level TEXT DEFAULT 'low', -- 'low', 'medium', 'high'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, object_type, object_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_schema_snapshots_project_id ON schema_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_schema_snapshots_created_at ON schema_snapshots(created_at);

-- Create schema_hash index only if column exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schema_snapshots' AND column_name = 'schema_hash') THEN
    CREATE INDEX IF NOT EXISTS idx_schema_snapshots_schema_hash ON schema_snapshots(schema_hash);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drift_metrics_project_id ON schema_drift_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_drift_metrics_snapshot_date ON schema_drift_metrics(snapshot_date);

CREATE INDEX IF NOT EXISTS idx_migration_metrics_migration_id ON migration_metrics(migration_id);
CREATE INDEX IF NOT EXISTS idx_migration_metrics_project_id ON migration_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_migration_metrics_executed_at ON migration_metrics(executed_at);
CREATE INDEX IF NOT EXISTS idx_migration_metrics_execution_status ON migration_metrics(execution_status);

CREATE INDEX IF NOT EXISTS idx_team_activity_team_id ON team_activity_metrics(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_user_id ON team_activity_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_date ON team_activity_metrics(activity_date);

CREATE INDEX IF NOT EXISTS idx_stability_scores_project_id ON schema_stability_scores(project_id);
CREATE INDEX IF NOT EXISTS idx_stability_scores_score_date ON schema_stability_scores(score_date);

CREATE INDEX IF NOT EXISTS idx_frequently_changing_project_id ON frequently_changing_objects(project_id);
CREATE INDEX IF NOT EXISTS idx_frequently_changing_risk_level ON frequently_changing_objects(risk_level);

-- RLS Policies
ALTER TABLE schema_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_drift_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_activity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_stability_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE frequently_changing_objects ENABLE ROW LEVEL SECURITY;

-- Users can view analytics for their own projects
CREATE POLICY "Users can view own project analytics"
  ON schema_snapshots FOR SELECT
  USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    OR project_id IN (
      SELECT project_id FROM projects 
      WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can view own project drift metrics"
  ON schema_drift_metrics FOR SELECT
  USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    OR project_id IN (
      SELECT project_id FROM projects 
      WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can view own project migration metrics"
  ON migration_metrics FOR SELECT
  USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    OR project_id IN (
      SELECT project_id FROM projects 
      WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can view own team activity"
  ON team_activity_metrics FOR SELECT
  USING (
    user_id = auth.uid()
    OR team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own project stability scores"
  ON schema_stability_scores FOR SELECT
  USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    OR project_id IN (
      SELECT project_id FROM projects 
      WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can view own project frequently changing objects"
  ON frequently_changing_objects FOR SELECT
  USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    OR project_id IN (
      SELECT project_id FROM projects 
      WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );

-- Service role can insert/update (for background jobs)
CREATE POLICY "Service can manage analytics data"
  ON schema_snapshots FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service can manage drift metrics"
  ON schema_drift_metrics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service can manage migration metrics"
  ON migration_metrics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service can manage team activity"
  ON team_activity_metrics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service can manage stability scores"
  ON schema_stability_scores FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service can manage frequently changing objects"
  ON frequently_changing_objects FOR ALL
  USING (auth.role() = 'service_role');

