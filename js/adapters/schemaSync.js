import { SEED_CASES } from "../../data/seedCases.js";
import { LocalDbAdapter } from "./localDbAdapter.js";

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

-- Disable Row Level Security (RLS) and add permissive public policies
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public users access" ON public.users;
DROP POLICY IF EXISTS "Public cases access" ON public.cases;
DROP POLICY IF EXISTS "Public attempts access" ON public.attempts;
DROP POLICY IF EXISTS "Public logs access" ON public.logs;

CREATE POLICY "Public users access" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public cases access" ON public.cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public attempts access" ON public.attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public logs access" ON public.logs FOR ALL USING (true) WITH CHECK (true);

-- 5. Insert Default Superadmin User
INSERT INTO public.users (id, email, "fullName", password, role, status)
VALUES ('user-admin-seed', 'admin@iset57.com.ar', 'Superadmin ISET 57', 'iset57**', 'superadmin', 'approved')
ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, role = EXCLUDED.role, status = EXCLUDED.status;
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
   * Legacy sync check
   */
  static async syncSchema(dbAdapter) {
    return await this.syncOfflineDataWithCloud(dbAdapter, null);
  }

  /**
   * Secure Bidirectional synchronization between Local storage and Supabase Cloud
   */
  static async syncOfflineDataWithCloud(activeDb, authManager = null) {
    const result = {
      casesSynced: 0,
      attemptsSynced: 0,
      status: "success",
      message: ""
    };

    try {
      // If currently operating in purely Local Mode
      if (!activeDb.name.includes("Supabase")) {
        await activeDb.checkAndMigrateSchema();
        const cases = await activeDb.getCases();
        result.casesSynced = cases.length;
        result.message = `Base de datos local verificada (${cases.length} casos clínicos listos).`;
        return result;
      }

      // Supabase is active: inspect local DB for offline work to push
      const localDb = new LocalDbAdapter();
      await localDb.init();

      const localAttempts = await localDb.getAttempts();
      const localCases = await localDb.getCases();

      const cloudCases = await activeDb.getCases();
      const cloudAttempts = await activeDb.getAttempts();

      const cloudCaseIds = new Set(cloudCases.map(c => c.id));
      const cloudAttemptIds = new Set(cloudAttempts.map(a => a.id));

      // 1. Sync offline student simulation attempts to Supabase Cloud
      let attemptsUploaded = 0;
      for (const att of localAttempts) {
        if (!cloudAttemptIds.has(att.id)) {
          await activeDb.saveAttempt(att);
          attemptsUploaded++;
        }
      }
      result.attemptsSynced = attemptsUploaded;

      // 2. Sync offline cases to Supabase Cloud (Only if Superadmin / Admin)
      let casesUploaded = 0;
      const isAdmin = authManager && authManager.isAdmin();
      if (isAdmin) {
        for (const c of localCases) {
          if (!cloudCaseIds.has(c.id)) {
            await activeDb.saveCase(c);
            casesUploaded++;
          }
        }
      }

      // 3. Download cloud cases to local storage (for future offline use)
      for (const c of cloudCases) {
        await localDb.saveCase(c, false);
      }
      result.casesSynced = cloudCases.length;

      result.message = `¡Sincronización exitosa! ${attemptsUploaded} intentos offline subidos y ${cloudCases.length} casos sincronizados con la nube.`;
    } catch (err) {
      result.status = "error";
      result.message = `Error en sincronización: ${err.message}`;
    }

    return result;
  }
}
