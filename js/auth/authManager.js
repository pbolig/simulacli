import { CONFIG, getStoredConfig, setStoredConfig } from "../config.js";

/**
 * Authentication & Authorization Manager
 */
export class AuthManager {
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.currentUser = null;
  }

  async init() {
    // Restore and validate session from localStorage against active database
    const savedUser = getStoredConfig(CONFIG.STORAGE_KEYS.CURRENT_USER);
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.email) {
          // Verify user exists and is approved in current active DB
          const activeUser = await this.db.getUserByEmail(parsed.email);
          if (activeUser && activeUser.status === "approved") {
            this.currentUser = activeUser;
            setStoredConfig(CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(activeUser));
          } else {
            // User does not exist or is pending in active DB -> clear ghost session
            this.currentUser = null;
            localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
          }
        }
      } catch (e) {
        this.currentUser = null;
        localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
      }
    }
    return this.currentUser;
  }

  /**
   * Register a new user.
   * Special Rule: If no users exist yet in DB, the FIRST registered user automatically becomes SUPERADMIN (approved).
   * All subsequent users default to role 'user' and status 'pending'.
   */
  async register(email, fullName, password) {
    const existingUsers = await this.db.getUsers();
    
    // Check if email already registered
    const existingUser = existingUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      throw new Error("El correo electrónico ya se encuentra registrado en el sistema.");
    }

    const isFirstUser = existingUsers.length === 0;
    
    const role = isFirstUser ? "superadmin" : "user";
    const status = isFirstUser ? "approved" : "pending";

    const newUser = await this.db.createUser({
      email: email.trim(),
      fullName: fullName.trim(),
      password,
      role,
      status
    });

    if (isFirstUser) {
      await this.db.logEvent("SUPERADMIN_CREATED", `Primer usuario del sistema asignado como Superadmin: ${email}`, email);
    }

    return {
      user: newUser,
      isFirstUser
    };
  }

  /**
   * Authenticate user with email and password
   */
  async login(email, password) {
    const user = await this.db.getUserByEmail(email.trim());
    if (!user) {
      throw new Error("Credenciales inválidas. Usuario no encontrado.");
    }

    if (user.password !== password) {
      await this.db.logEvent("AUTH_FAILED", `Intento de inicio de sesión fallido para: ${email}`, email);
      throw new Error("Credenciales inválidas. Contraseña incorrecta.");
    }

    if (user.status === "pending") {
      await this.db.logEvent("AUTH_BLOCKED", `Intento de acceso bloqueado por cuenta pendiente: ${email}`, email);
      throw new Error("Tu cuenta aún se encuentra pendiente de aprobación por un Administrador.");
    }

    if (user.status === "rejected") {
      throw new Error("Tu cuenta ha sido rechazada por la administración.");
    }

    this.currentUser = user;
    setStoredConfig(CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    await this.db.logEvent("USER_LOGIN", `Inicio de sesión exitoso: ${user.email} (${user.role})`, user.email);

    return user;
  }

  /**
   * Terminate active user session
   */
  async logout() {
    if (this.currentUser) {
      await this.db.logEvent("USER_LOGOUT", `Cierre de sesión: ${this.currentUser.email}`, this.currentUser.email);
    }
    this.currentUser = null;
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  isSuperAdmin() {
    return this.currentUser && this.currentUser.role === "superadmin";
  }

  isAdmin() {
    return this.currentUser && (this.currentUser.role === "admin" || this.currentUser.role === "superadmin");
  }

  /**
   * Approve a pending user account
   */
  async approveUser(userId, role = "user") {
    if (!this.isAdmin()) {
      throw new Error("Acceso denegado. Se requieren permisos de Administrador.");
    }
    return await this.db.updateUserStatus(userId, "approved", role);
  }

  /**
   * Reject a user account
   */
  async rejectUser(userId) {
    if (!this.isAdmin()) {
      throw new Error("Acceso denegado. Se requieren permisos de Administrador.");
    }
    return await this.db.updateUserStatus(userId, "rejected");
  }
}
