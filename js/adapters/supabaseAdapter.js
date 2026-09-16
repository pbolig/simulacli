import { BaseDbAdapter } from "./dbAdapter.js";
import { SEED_CASES } from "../../data/seedCases.js";
import { SEED_USERS } from "../../data/seedUsers.js";

/**
 * Remote Supabase DB Adapter
 * Used in production environment (e.g. GitHub Pages) with Supabase Cloud backend.
 */
export class SupabaseAdapter extends BaseDbAdapter {
  constructor(supabaseUrl, supabaseKey) {
    super("Supabase Remote Cloud");
    this.url = supabaseUrl;
    this.key = supabaseKey;
    this.client = null;
  }

  async init() {
    if (!this.url || !this.key) {
      console.warn("Supabase credentials missing. Utilizing local adapter fallback.");
      throw new Error("Credenciales de Supabase no configuradas.");
    }

    if (window.supabase) {
      this.client = window.supabase.createClient(this.url, this.key);
    } else {
      console.warn("Supabase SDK CDN not detected, utilizing direct fetch client.");
    }

    await this.checkAndMigrateSchema();
    return this;
  }

  async checkAndMigrateSchema() {
    try {
      const cases = await this.getCases();
      if (!cases || cases.length === 0) {
        console.log("Supabase DB tables empty or initialized. Syncing seed cases...");
        for (const c of SEED_CASES) {
          await this.saveCase(c);
        }
      }

      const users = await this.getUsers();
      if (!users || users.length === 0) {
        console.log("Supabase DB users table empty. Syncing seed users...");
        for (const u of SEED_USERS) {
          await this.createUser(u);
        }
      }
    } catch (err) {
      console.warn("Schema check warning on Supabase:", err.message);
    }
  }

  // --- Fetch REST API Utility Fallback ---
  async _restRequest(table, method = "GET", body = null, query = "") {
    const headers = {
      "apikey": this.key,
      "Authorization": `Bearer ${this.key}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };

    const endpoint = `${this.url}/rest/v1/${table}${query}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(endpoint, options);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Supabase API error (${res.status}): ${errorText}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // --- Database Implementation ---
  async getUsers() {
    if (this.client) {
      const { data, error } = await this.client.from("users").select("*");
      if (error) throw error;
      return data || [];
    }
    return await this._restRequest("users", "GET") || [];
  }

  async getUserByEmail(email) {
    if (this.client) {
      const { data, error } = await this.client.from("users").select("*").eq("email", email).single();
      if (error && error.code !== "PGRST116") throw error;
      return data || null;
    }
    const users = await this._restRequest("users", "GET", null, `?email=eq.${encodeURIComponent(email)}`);
    return users && users.length > 0 ? users[0] : null;
  }

  async createUser(userData) {
    const newUser = {
      id: userData.id || `user-${Date.now()}`,
      email: userData.email,
      fullName: userData.fullName,
      password: userData.password,
      role: userData.role || "user",
      status: userData.status || "pending",
      createdAt: new Date().toISOString()
    };

    if (this.client) {
      const { data, error } = await this.client.from("users").insert([newUser]).select();
      if (error) throw error;
      await this.logEvent("USER_REGISTER", `Usuario registrado Supabase: ${newUser.email}`, newUser.email);
      return data[0];
    }
    const res = await this._restRequest("users", "POST", [newUser]);
    await this.logEvent("USER_REGISTER", `Usuario registrado Supabase: ${newUser.email}`, newUser.email);
    return res[0];
  }

  async updateUserStatus(userId, status, role = null) {
    const payload = { status };
    if (role) payload.role = role;

    if (this.client) {
      const { data, error } = await this.client.from("users").update(payload).eq("id", userId).select();
      if (error) throw error;
      await this.logEvent("USER_UPDATE", `Estado usuario Supabase actualizado: ${userId} -> ${status}`);
      return data[0];
    }
    const res = await this._restRequest("users", "PATCH", payload, `?id=eq.${encodeURIComponent(userId)}`);
    return res[0];
  }

  async getCases() {
    if (this.client) {
      const { data, error } = await this.client.from("cases").select("*");
      if (error) return [];
      return data || [];
    }
    try {
      return await this._restRequest("cases", "GET") || [];
    } catch (e) {
      return [];
    }
  }

  async getCaseById(caseId) {
    if (this.client) {
      const { data } = await this.client.from("cases").select("*").eq("id", caseId).single();
      return data || null;
    }
    const res = await this._restRequest("cases", "GET", null, `?id=eq.${encodeURIComponent(caseId)}`);
    return res && res.length > 0 ? res[0] : null;
  }

  async saveCase(caseData) {
    if (!caseData.id) caseData.id = `case-${Date.now()}`;
    if (this.client) {
      const { data, error } = await this.client.from("cases").upsert([caseData]).select();
      if (error) throw error;
      await this.logEvent("CASE_SAVE", `Caso guardado en Supabase: ${caseData.title}`);
      return data[0];
    }
    const res = await this._restRequest("cases", "POST", [caseData]);
    return res[0];
  }

  async deleteCase(caseId) {
    if (this.client) {
      const { error } = await this.client.from("cases").delete().eq("id", caseId);
      if (error) throw error;
      return true;
    }
    await this._restRequest("cases", "DELETE", null, `?id=eq.${encodeURIComponent(caseId)}`);
    return true;
  }

  async saveAttempt(attemptData) {
    if (!attemptData.id) attemptData.id = `attempt-${Date.now()}`;
    attemptData.createdAt = new Date().toISOString();

    if (this.client) {
      const { data, error } = await this.client.from("attempts").insert([attemptData]).select();
      if (error) throw error;
      await this.logEvent("SIMULATION_COMPLETE", `Simulación registrada Supabase: ${attemptData.caseTitle}`, attemptData.userEmail);
      return data[0];
    }
    const res = await this._restRequest("attempts", "POST", [attemptData]);
    return res[0];
  }

  async getAttempts(userId = null) {
    if (this.client) {
      let query = this.client.from("attempts").select("*");
      if (userId) query = query.eq("userId", userId);
      const { data, error } = await query;
      if (error) return [];
      return data || [];
    }
    const filter = userId ? `?userId=eq.${encodeURIComponent(userId)}` : "";
    return await this._restRequest("attempts", "GET", null, filter) || [];
  }

  async logEvent(eventType, description, userEmail = "sistema") {
    const logItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      eventType,
      description,
      userEmail,
      timestamp: new Date().toISOString()
    };
    try {
      if (this.client) {
        await this.client.from("logs").insert([logItem]);
      } else {
        await this._restRequest("logs", "POST", [logItem]);
      }
    } catch (e) {
      console.warn("Could not push log to Supabase:", e.message);
    }
    return logItem;
  }

  async getLogs(limit = 100) {
    if (this.client) {
      const { data } = await this.client.from("logs").select("*").order("timestamp", { ascending: false }).limit(limit);
      return data || [];
    }
    return await this._restRequest("logs", "GET", null, `?order=timestamp.desc&limit=${limit}`) || [];
  }
}
