-- Adaptive designs table (simplified version of ads_library)
-- This table stores user-created adaptive creatives derived from an existing ad (ads_library).
-- It purposefully excludes external links and keeps fields simpler (textual descriptions, assets stored separately).

CREATE TABLE IF NOT EXISTS adaptive_designs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL,
  based_on_ad_archive_id TEXT, -- reference to ads_library.ad_archive_id (optional)
  title TEXT,
  text TEXT,
  caption TEXT,
  cta_text TEXT,
  cta_type TEXT,
  display_format TEXT,
  audio_script TEXT,
  video_script TEXT,
  image_description TEXT,
  -- store optionally the generated asset meta (e.g., filename or storage key). Prefer storing actual file in storage and reference key here.
  asset_file_name TEXT,
  asset_storage_key TEXT,
  payload JSONB,       -- shortPrompt / user-provided JSON used for generation
  make_response JSONB, -- raw response from Make.com
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_adaptive_designs_user ON adaptive_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_adaptive_designs_based_on_ad ON adaptive_designs(based_on_ad_archive_id);
