-- Enable MatuSports Pro on all plans and set per-model token caps.
-- Run in MatuDB SQL console after schema-matu-models-v2.sql

UPDATE plans SET models_allowed = 'matu,vo0,vo5,matu-apex,matu-dev-3-5,matu-space-ultra,matu-commerce,matu-marketing,matu-sports-pro' WHERE id IN ('pro', 'team');
UPDATE plans SET models_allowed = 'matu,vo0,matu-apex,matu-dev-3-5,matu-space-ultra,matu-commerce,matu-marketing,matu-sports-pro' WHERE id = 'free';

INSERT INTO plan_model_limits (plan_id, model_id, monthly_token_limit) VALUES
  ('free', 'matu-sports-pro', 15000),
  ('pro', 'matu-sports-pro', 300000),
  ('team', 'matu-sports-pro', -1)
ON CONFLICT (plan_id, model_id) DO UPDATE
  SET monthly_token_limit = EXCLUDED.monthly_token_limit;
