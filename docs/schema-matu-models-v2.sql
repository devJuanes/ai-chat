-- Migration: enable Matu Space Ultra, Commerce & Marketing on all plans
-- Run in MatuDB SQL console after previous plan migrations

UPDATE plans SET models_allowed = 'matu,vo0,vo5,matu-apex,matu-dev-3-5,matu-space-ultra,matu-commerce,matu-marketing' WHERE id IN ('pro', 'team');
UPDATE plans SET models_allowed = 'matu,vo0,matu-apex,matu-dev-3-5,matu-space-ultra,matu-commerce,matu-marketing' WHERE id = 'free';
