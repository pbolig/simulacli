import { BaseDbAdapter } from "./dbAdapter.js";
import { SEED_CASES } from "../../data/seedCases.js";
import { GitHubSyncEngine } from "./githubSync.js";

/**
 * Local & Repository JSON Database Adapter (100% Serverless / GitHub Native)
 * Reads data directly from repo JSON files (data/cases.json) and commits updates back to Git via GitHub API.
 */
export class LocalDbAdapter extends BaseDbAdapter {
  constructor() {
    super("JSON Repositorio & IndexedDB");
    this.dbName = "SimulaCli_LocalDB";
    this.dbVersion = 1;
    this.db = null;
    this.storagePrefix = "simulacli_tbl_";
    this.useLocalStorage = false;
    this.ghSync = new GitHubSyncEngine();
  }

  async init() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn("IndexedDB not supported, falling back to LocalStorage.");
        this._initLocalStorageFallback();
        return resolve(this);
      }

      try {
        const request = window.indexedDB.open(this.dbName, this.dbVersion);

        request.onerror = (evt) => {
          console.warn("IndexedDB error, using LocalStorage fallback:", evt);
          this._initLocalStorageFallback();
          resolve(this);
        };

        request.onupgradeneeded = (evt) => {
          const db = evt.target.result;
          
          if (!db.objectStoreNames.contains("users")) {
            const userStore = db.createObjectStore("users", { keyPath: "id" });
            userStore.createIndex("email", "email", { unique: true });
          }

          if (!db.objectStoreNames.contains("cases")) {
            db.createObjectStore("cases", { keyPath: "id" });
          }

          if (!db.objectStoreNames.contains("attempts")) {
            const attemptStore = db.createObjectStore("attempts", { keyPath: "id" });
            attemptStore.createIndex("userId", "userId", { unique: false });
          }

          if (!db.objectStoreNames.contains("logs")) {
            db.createObjectStore("logs", { keyPath: "id" });
          }
        };

        request.onsuccess = async (evt) => {
          this.db = evt.target.result;
          await this.checkAndMigrateSchema();
          resolve(this);
        };
      } catch (err) {
        console.warn("IndexedDB exception, using LocalStorage fallback:", err);
        this._initLocalStorageFallback();
        resolve(this);
      }
    });
  }

  _initLocalStorageFallback() {
    this.useLocalStorage = true;
    if (!localStorage.getItem(this.storagePrefix + "users")) {
      localStorage.setItem(this.storagePrefix + "users", JSON.stringify([]));
    }
    if (!localStorage.getItem(this.storagePrefix + "cases")) {
      localStorage.setItem(this.storagePrefix + "cases", JSON.stringify(SEED_CASES));
    }
    if (!localStorage.getItem(this.storagePrefix + "attempts")) {
      localStorage.setItem(this.storagePrefix + "attempts", JSON.stringify([]));
    }
    if (!localStorage.getItem(this.storagePrefix + "logs")) {
      localStorage.setItem(this.storagePrefix + "logs", JSON.stringify([]));
    }
  }

  async checkAndMigrateSchema() {
    const cases = await this.getCases();
    if (!cases || cases.length === 0) {
      console.log("Local DB empty. Seeding starter clinical cases...");
      for (const c of SEED_CASES) {
        await this.saveCase(c);
      }
      await this.logEvent("SCHEMA_MIGRATE", "Esquema local verificado y datos semilla cargados exitosamente.");
    }
  }

  // --- IndexedDB / LocalStorage Operations ---
  _getAll(storeName) {
    if (this.useLocalStorage) {
      return Promise.resolve(JSON.parse(localStorage.getItem(this.storagePrefix + storeName) || "[]"));
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  _put(storeName, item) {
    if (this.useLocalStorage) {
      const items = JSON.parse(localStorage.getItem(this.storagePrefix + storeName) || "[]");
      const idx = items.findIndex(i => i.id === item.id);
      if (idx >= 0) items[idx] = item;
      else items.push(item);
      localStorage.setItem(this.storagePrefix + storeName, JSON.stringify(items));
      return Promise.resolve(item);
    }
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  _delete(storeName, key) {
    if (this.useLocalStorage) {
      let items = JSON.parse(localStorage.getItem(this.storagePrefix + storeName) || "[]");
      items = items.filter(i => i.id !== key);
      localStorage.setItem(this.storagePrefix + storeName, JSON.stringify(items));
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // --- Clean Native JSON File Import / Export Helpers ---
  async exportJsonFile() {
    const users = await this.getUsers();
    const cases = await this.getCases();
    const attempts = await this.getAttempts();
    const logs = await this.getLogs(500);

    const dbBackup = {
      app: "SimulaCli",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      data: {
        users,
        cases,
        attempts,
        logs
      }
    };

    const jsonStr = JSON.stringify(dbBackup, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `simulacli_database_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async loadJsonFile(jsonText) {
    const backupObj = JSON.parse(jsonText);
    const data = backupObj.data || backupObj;

    if (!data.cases || !Array.isArray(data.cases)) {
      throw new Error("Formato de archivo JSON no válido para SimulaCli.");
    }

    for (const c of data.cases) {
      await this.saveCase(c);
    }

    if (data.users && Array.isArray(data.users)) {
      for (const u of data.users) {
        const existing = await this.getUserByEmail(u.email);
        if (!existing) {
          await this.createUser(u);
        }
      }
    }

    await this.logEvent("JSON_IMPORT", `Base de datos cargada desde archivo JSON (${data.cases.length} casos).`);
    return true;
  }

  // --- BaseDbAdapter Public API ---
  async getUsers() {
    return await this._getAll("users");
  }

  async getUserByEmail(email) {
    const users = await this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async createUser(userData) {
    const newUser = {
      id: userData.id || `user-${Date.now()}`,
      email: userData.email,
      fullName: userData.fullName,
      password: userData.password,
      role: userData.role || "user",
      status: userData.status || "pending",
      createdAt: userData.createdAt || new Date().toISOString()
    };
    await this._put("users", newUser);
    await this.logEvent("USER_REGISTER", `Usuario registrado: ${newUser.email} (${newUser.role})`, newUser.email);
    return newUser;
  }

  async updateUserStatus(userId, status, role = null) {
    const users = await this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error("Usuario no encontrado.");
    user.status = status;
    if (role) user.role = role;
    await this._put("users", user);
    await this.logEvent("USER_UPDATE", `Estado usuario actualizado: ${user.email} -> ${status} (${user.role})`);
    return user;
  }

  async getCases() {
    return await this._getAll("cases");
  }

  async getCaseById(caseId) {
    const cases = await this.getCases();
    return cases.find(c => c.id === caseId) || null;
  }

  async saveCase(caseData, triggerCommit = true) {
    if (!caseData.id) caseData.id = `case-${Date.now()}`;
    await this._put("cases", caseData);
    await this.logEvent("CASE_SAVE", `Caso clínico guardado: ${caseData.title}`);

    if (triggerCommit && this.ghSync.isConfigured()) {
      const allCases = await this.getCases();
      await this.ghSync.commitJsonFile("data/cases.json", allCases, `feat(cases): guardar caso ${caseData.title}`);
    }

    return caseData;
  }

  async deleteCase(caseId) {
    await this._delete("cases", caseId);
    await this.logEvent("CASE_DELETE", `Caso clínico eliminado ID: ${caseId}`);

    if (this.ghSync.isConfigured()) {
      const allCases = await this.getCases();
      await this.ghSync.commitJsonFile("data/cases.json", allCases, `fix(cases): eliminar caso ${caseId}`);
    }

    return true;
  }

  async saveAttempt(attemptData) {
    if (!attemptData.id) attemptData.id = `attempt-${Date.now()}`;
    attemptData.createdAt = attemptData.createdAt || new Date().toISOString();
    await this._put("attempts", attemptData);
    await this.logEvent("SIMULATION_COMPLETE", `Simulación completada. Caso: ${attemptData.caseTitle}, Puntaje: ${attemptData.totalScore}%`, attemptData.userEmail);
    return attemptData;
  }

  async getAttempts(userId = null) {
    const attempts = await this._getAll("attempts");
    if (userId) {
      return attempts.filter(a => a.userId === userId);
    }
    return attempts;
  }

  async logEvent(eventType, description, userEmail = "sistema") {
    const logItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      eventType,
      description,
      userEmail,
      timestamp: new Date().toISOString()
    };
    await this._put("logs", logItem);
    return logItem;
  }

  async getLogs(limit = 100) {
    const logs = await this._getAll("logs");
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
  }
}
