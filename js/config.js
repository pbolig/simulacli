/**
 * SimulaCli Configuration Module - 100% Serverless GitHub Native
 */
export const CONFIG = {
  APP_NAME: "SimulaCli",
  VERSION: "1.0.0",
  // Default Supabase credentials for production
  SUPABASE_URL: "https://xjdutgtttquimnkwdsrh.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZHV0Z3R0dHF1aW1ua3dkc3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDA1NTksImV4cCI6MjEwNTExNjU1OX0.nKEWGlcaccCRRUKSnzXe_aWVWgQR9FYbaFkCTojpagk",
  // Local storage / session storage keys
  STORAGE_KEYS: {
    CURRENT_USER: "simulacli_current_user",
    THEME: "simulacli_theme",
    GH_OWNER: "simulacli_gh_owner",
    GH_REPO: "simulacli_gh_repo",
    GH_TOKEN: "simulacli_gh_token",
    SUPABASE_URL: "simulacli_sb_url",
    SUPABASE_KEY: "simulacli_sb_key"
  }
};

export function getStoredConfig(key, fallback = "") {
  return localStorage.getItem(key) || fallback;
}

export function setStoredConfig(key, value) {
  localStorage.setItem(key, value);
}
