-- Migration: enable Matu Dev 3.5 on all plans
-- Run in MatuDB SQL console

UPDATE plans SET models_allowed = 'matu,vo0,vo5,matu-apex,matu-dev-3-5' WHERE id IN ('pro', 'team');
UPDATE plans SET models_allowed = 'matu,vo0,matu-apex,matu-dev-3-5' WHERE id = 'free';
