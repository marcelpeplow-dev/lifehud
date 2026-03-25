CREATE TABLE IF NOT EXISTS user_dashboard_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  config_type TEXT NOT NULL,          -- 'stat_card' | 'graph' | 'domain_stat_card' | 'domain_graph'
  position INT NOT NULL,              -- 0-3 for stat cards, 0-1 for graphs
  domain TEXT,                        -- which domain page this belongs to (null = main dashboard)
  config JSONB NOT NULL DEFAULT '{}', -- the actual configuration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, config_type, position, domain)
);

ALTER TABLE user_dashboard_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own dashboard config" ON user_dashboard_config
  FOR ALL USING (auth.uid() = user_id);
