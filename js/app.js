import { CONFIG, getStoredConfig } from "./config.js";
import { LocalDbAdapter } from "./adapters/localDbAdapter.js";
import { SupabaseAdapter } from "./adapters/supabaseAdapter.js";
import { AuthManager } from "./auth/authManager.js";
import { SimulationEngine } from "./simulation/simEngine.js";
import { UIManager } from "./ui/uiManager.js";

/**
 * SimulaCli Main Entry Point - Hybrid Serverless & Cloud Database Architecture
 */
class App {
  constructor() {
    this.dbAdapter = null;
    this.authManager = null;
    this.simEngine = null;
    this.uiManager = null;
  }

  async start() {
    console.log(`Starting ${CONFIG.APP_NAME} v${CONFIG.VERSION}...`);

    try {
      // 1. Initialize Database Adapter (Supabase Cloud or Local JSON/IndexedDB)
      const sbUrl = getStoredConfig(CONFIG.STORAGE_KEYS.SUPABASE_URL, CONFIG.SUPABASE_URL);
      const sbKey = getStoredConfig(CONFIG.STORAGE_KEYS.SUPABASE_KEY, CONFIG.SUPABASE_ANON_KEY);

      if (sbUrl && sbKey) {
        try {
          console.log("Inicializando Adaptador Supabase Cloud...");
          this.dbAdapter = new SupabaseAdapter(sbUrl, sbKey);
          await this.dbAdapter.init();
          console.log("Conexión con Supabase Cloud exitosa.");
        } catch (sbErr) {
          console.warn("Fallo al conectar con Supabase, usando adaptador local como respaldo:", sbErr);
          this.dbAdapter = new LocalDbAdapter();
          await this.dbAdapter.init();
        }
      } else {
        this.dbAdapter = new LocalDbAdapter();
        await this.dbAdapter.init();
      }

      // 2. Initialize Auth Manager
      this.authManager = new AuthManager(this.dbAdapter);
      await this.authManager.init();

      // 3. Initialize Simulation Engine
      this.simEngine = new SimulationEngine(this.dbAdapter);

      // 4. Initialize UI Manager
      this.uiManager = new UIManager(this.authManager, this.simEngine, this.dbAdapter);
      this.uiManager.init();

    } catch (err) {
      console.error("Critical error during application startup:", err);
      alert("Error al inicializar SimulaCli: " + err.message);
    }
  }
}

// Instantiate App when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.start();
});
