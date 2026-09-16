import { CONFIG } from "./config.js";
import { LocalDbAdapter } from "./adapters/localDbAdapter.js";
import { AuthManager } from "./auth/authManager.js";
import { SimulationEngine } from "./simulation/simEngine.js";
import { UIManager } from "./ui/uiManager.js";

/**
 * SimulaCli Main Entry Point - 100% GitHub Native Serverless Architecture
 */
class App {
  constructor() {
    this.dbAdapter = null;
    this.authManager = null;
    this.simEngine = null;
    this.uiManager = null;
  }

  async start() {
    console.log(`Starting ${CONFIG.APP_NAME} v${CONFIG.VERSION} (GitHub Native Architecture)...`);

    try {
      // 1. Initialize Local & Repo JSON DB Adapter
      this.dbAdapter = new LocalDbAdapter();
      await this.dbAdapter.init();

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
