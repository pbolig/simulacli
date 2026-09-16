import { CONFIG, getSessionConfig, setSessionConfig, removeSessionConfig } from "../config.js";

/**
 * Authentication & Authorization Manager
 * Supports tab-scoped sessions (cleared on tab close) and automatic logout after 60 minutes of inactivity.
 */
export class AuthManager {
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.currentUser = null;
    this.inactivityTimer = null;
    this.lastActivityUpdate = Date.now();
    this.onTimeoutCallback = null;
  }

  async init() {
    // 1. Check if session has exceeded 60 minutes of inactivity
    const lastActivity = parseInt(getSessionConfig(CONFIG.STORAGE_KEYS.LAST_ACTIVITY, "0"), 10);
    const now = Date.now();

    if (lastActivity > 0 && (now - lastActivity > CONFIG.INACTIVITY_TIMEOUT_MS)) {
      console.log("Sesión previa expirada por inactividad (> 60 min).");
      this.logout();
      return null;
    }

    // 2. Restore and validate session from sessionStorage against active database
    const savedUser = getSessionConfig(CONFIG.STORAGE_KEYS.CURRENT_USER);
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.email) {
          // Verify user exists and is approved in current active DB
          const activeUser = await this.db.getUserByEmail(parsed.email);
          if (activeUser && activeUser.status === "approved") {
            this.currentUser = activeUser;
            setSessionConfig(CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(activeUser));
            setSessionConfig(CONFIG.STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
          } else {
            // User does not exist or is pending in active DB -> clear ghost session
            this.currentUser = null;
            removeSessionConfig(CONFIG.STORAGE_KEYS.CURRENT_USER);
          }
        }
      } catch (e) {
        this.currentUser = null;
        removeSessionConfig(CONFIG.STORAGE_KEYS.CURRENT_USER);
      }
    }
    return this.currentUser;
  }

  /**
   * Start 60-Minute Inactivity Monitor
   */
  startInactivityMonitor(onTimeoutCallback) {
    this.onTimeoutCallback = onTimeoutCallback;
    this._resetInactivityTimer();

    // Listen to user interactions to refresh the 60-minute inactivity timer
    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const handleActivity = () => {
      const now = Date.now();
      // Throttle activity updates to once every 30 seconds
      if (now - this.lastActivityUpdate > 30000) {
        this.lastActivityUpdate = now;
        if (this.isLoggedIn()) {
          setSessionConfig(CONFIG.STORAGE_KEYS.LAST_ACTIVITY, now.toString());
        }
        this._resetInactivityTimer();
      }
    };

    activityEvents.forEach(evt => {
      window.addEventListener(evt, handleActivity, { passive: true });
    });
  }

  _resetInactivityTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);

    if (this.isLoggedIn()) {
      this.inactivityTimer = setTimeout(() => {
        console.warn("Tiempo de inactividad de 60 minutos alcanzado. Cerrando sesión...");
        this.logout().then(() => {
          if (typeof this.onTimeoutCallback === "function") {
            this.onTimeoutCallback();
          }
        });
      }, CONFIG.INACTIVITY_TIMEOUT_MS);
    }
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
    const nowStr = Date.now().toString();
    setSessionConfig(CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    setSessionConfig(CONFIG.STORAGE_KEYS.LAST_ACTIVITY, nowStr);
    this.lastActivityUpdate = Date.now();
    this._resetInactivityTimer();

    // Cache user locally so offline logins work on this device in the future
    if (this.db.name.includes("Supabase")) {
      import("../adapters/localDbAdapter.js").then(async ({ LocalDbAdapter }) => {
        try {
          const localDb = new LocalDbAdapter();
          await localDb.init();
          await localDb._put("users", user);
        } catch (cacheErr) {
          console.warn("Caché local de usuario no disponible:", cacheErr);
        }
      });
    }

    await this.db.logEvent("USER_LOGIN", `Inicio de sesión exitoso: ${user.email} (${user.role})`, user.email);

    return user;
  }

  /**
   * Terminate active user session
   */
  async logout() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.currentUser) {
      await this.db.logEvent("USER_LOGOUT", `Cierre de sesión: ${this.currentUser.email}`, this.currentUser.email);
    }
    this.currentUser = null;
    removeSessionConfig(CONFIG.STORAGE_KEYS.CURRENT_USER);
    removeSessionConfig(CONFIG.STORAGE_KEYS.LAST_ACTIVITY);
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

  isDocente() {
    return this.currentUser && (
      this.currentUser.role === "docente" ||
      this.currentUser.role === "teacher" ||
      this.currentUser.role === "admin" ||
      this.currentUser.role === "superadmin"
    );
  }

  canManageCases() {
    return this.isDocente();
  }

  canViewReports() {
    return this.isDocente();
  }

  canManageUsers() {
    return this.isAdmin();
  }

  /**
   * Update an existing user's role (Only Superadmin or Admin)
   */
  async updateUserRole(userId, newRole) {
    if (!this.isAdmin()) {
      throw new Error("Acceso denegado. Se requieren permisos de Administrador para modificar roles.");
    }
    return await this.db.updateUserStatus(userId, "approved", newRole);
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
