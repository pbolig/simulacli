import { SEED_CASES } from "../../data/seedCases.js";

/**
 * Schema Inspector & Auto-Migration Generator
 * Used to inspect schema status and generate SQL DDL tables for Supabase / PostgreSQL.
 */
export class SchemaSyncEngine {
  /**
   * Generates the SQL schema setup DDL query for Supabase SQL Editor or automated execution.
   */
  static getSupabaseDDL() {
    return `-- =================================================================
-- SimulaCli Database DDL Schema for Supabase / PostgreSQL
-- Automatic Schema Initializer & Table Builder
-- =================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    "fullName" TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Clinical Cases Table
CREATE TABLE IF NOT EXISTS public.cases (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    difficulty TEXT,
    "patientName" TEXT,
    "patientAge" INT,
    "patientGender" TEXT,
    "patientAvatar" TEXT,
    "chiefComplaint" TEXT,
    "medicalHistory" TEXT,
    "vitalSigns" JSONB,
    symptoms JSONB,
    questions JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Simulation Attempts Table
CREATE TABLE IF NOT EXISTS public.attempts (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseTitle" TEXT NOT NULL,
    "totalScore" NUMERIC(5,2),
    "maxScore" NUMERIC(5,2),
    "answers" JSONB,
    "feedbackReport" JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.logs (
    id TEXT PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    description TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (RLS) or add public access policies for API access
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs DISABLE ROW LEVEL SECURITY;

-- 5. Insert Default Superadmin User
INSERT INTO public.users (id, email, "fullName", password, role, status)
VALUES ('user-admin-seed', 'admin@iset57.com.ar', 'Superadmin ISET 57', 'iset57**', 'superadmin', 'approved')
ON CONFLICT (id) DO NOTHING;
`;
  }

  /**
   * Generates initial seed SQL inserts for Supabase.
   */
  static getSeedSQL() {
    return SEED_CASES.map(c => {
      const escapedTitle = c.title.replace(/'/g, "''");
      const jsonBody = JSON.stringify(c).replace(/'/g, "''");
      return `INSERT INTO public.cases (id, title, category, difficulty, "patientName", "patientAge", "patientGender", "patientAvatar", "chiefComplaint", "medicalHistory", "vitalSigns", symptoms, questions)
VALUES ('${c.id}', '${escapedTitle}', '${c.category}', '${c.difficulty}', '${c.patientName}', ${c.patientAge}, '${c.patientGender}', '${c.patientAvatar}', '${c.chiefComplaint.replace(/'/g, "''")}', '${c.medicalHistory.replace(/'/g, "''")}', '${JSON.stringify(c.vitalSigns)}'::jsonb, '${JSON.stringify(c.symptoms)}'::jsonb, '${JSON.stringify(c.questions)}'::jsonb)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, symptoms = EXCLUDED.symptoms, questions = EXCLUDED.questions;`;
    }).join("\n\n");
  }

  /**
   * Transparent sync check that can be executed directly from the UI or script.
   */
  static async syncSchema(dbAdapter) {
    const result = {
      tablesCreated: [],
      seedCasesSynced: 0,
      status: "success",
      message: ""
    };

    try {
      await dbAdapter.checkAndMigrateSchema();
      const cases = await dbAdapter.getCases();
      result.seedCasesSynced = cases ? cases.length : 0;
      result.message = `Sincronización completada exitosamente. (${result.seedCasesSynced} casos clínicos cargados).`;
    } catch (err) {
      result.status = "error";
      result.message = `Error en sincronización: ${err.message}`;
    }

    return result;
  }
}
