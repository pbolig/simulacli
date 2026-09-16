/**
 * Base Abstract DB Adapter Interface
 * All concrete database adapters (LocalDbAdapter, SupabaseAdapter) must implement these methods.
 */
export class BaseDbAdapter {
  constructor(name = "BaseDB") {
    this.name = name;
  }

  async init() {
    throw new Error("Method init() must be implemented.");
  }

  // Schema & Sync
  async checkAndMigrateSchema() {
    throw new Error("Method checkAndMigrateSchema() must be implemented.");
  }

  // User Management
  async getUsers() {
    throw new Error("Method getUsers() must be implemented.");
  }

  async getUserByEmail(email) {
    throw new Error("Method getUserByEmail() must be implemented.");
  }

  async createUser(userData) {
    throw new Error("Method createUser() must be implemented.");
  }

  async updateUserStatus(userId, status, role = null) {
    throw new Error("Method updateUserStatus() must be implemented.");
  }

  // Clinical Cases
  async getCases() {
    throw new Error("Method getCases() must be implemented.");
  }

  async getCaseById(caseId) {
    throw new Error("Method getCaseById() must be implemented.");
  }

  async saveCase(caseData) {
    throw new Error("Method saveCase() must be implemented.");
  }

  async deleteCase(caseId) {
    throw new Error("Method deleteCase() must be implemented.");
  }

  // Simulation Attempts
  async saveAttempt(attemptData) {
    throw new Error("Method saveAttempt() must be implemented.");
  }

  async getAttempts(userId = null) {
    throw new Error("Method getAttempts() must be implemented.");
  }

  // Audit Logging
  async logEvent(eventType, description, userEmail = "system") {
    throw new Error("Method logEvent() must be implemented.");
  }

  async getLogs(limit = 100) {
    throw new Error("Method getLogs() must be implemented.");
  }
}
