-- ═══════════════════════════════════════════════════════════════════════════
-- BARBER PRO — RESET COMPLETO DO BANCO (pré-lançamento)
-- ⚠️  IRREVERSÍVEL. Antes de rodar: Neon Console → Branches → criar snapshot
--     (ou Restore point) para poder voltar atrás se precisar.
--
-- O que faz: esvazia TODAS as tabelas e reinicia os IDs (RESTART IDENTITY),
-- EXCETO backoffice_users — preserva seu login do /superadmin.
-- A estrutura (tabelas, colunas, índices) permanece intacta.
--
-- Onde rodar: Neon Console → seu projeto → SQL Editor → colar → Run
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('backoffice_users')   -- preserva o superadmin
  ) LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
  END LOOP;
END $$;

-- Conferência: todas devem retornar 0, exceto backoffice_users
SELECT 'tenants' AS tabela, COUNT(*) FROM tenants
UNION ALL SELECT 'barbers', COUNT(*) FROM barbers
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'appointments', COUNT(*) FROM appointments
UNION ALL SELECT 'used_trials', COUNT(*) FROM used_trials
UNION ALL SELECT 'backoffice_users (deve ser > 0)', COUNT(*) FROM backoffice_users;
