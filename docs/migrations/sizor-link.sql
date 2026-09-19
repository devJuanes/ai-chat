-- Migración Sizor → MatuAI (MatuDB / organizations)
-- Ejecutar en el proyecto MatuDB de MatuAI (ai-chat)
--
-- Qué hace: vincula una organización de MatuAI a una company de Sizor.
-- Las orgs con sizor_company_id solo exponen: Matu, Matu Marketing y Matu Commerce.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sizor_company_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_sizor_company
  ON organizations(sizor_company_id)
  WHERE sizor_company_id IS NOT NULL;
