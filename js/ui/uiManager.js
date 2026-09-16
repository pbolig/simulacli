import { SchemaSyncEngine } from "../adapters/schemaSync.js";
import { CONFIG, getStoredConfig, setStoredConfig } from "../config.js";

/**
 * UI Manager - Handles DOM Rendering, View Routing, Modals & Visual Components
 */
export class UIManager {
  constructor(authManager, simEngine, dbAdapter) {
    this.auth = authManager;
    this.sim = simEngine;
    this.db = dbAdapter;
    this.activeView = "auth-view";
    this.currentAttemptReport = null;
  }

  init() {
    this._bindEvents();
    this.updateHeaderUI();
    this.routeTo(this.auth.isLoggedIn() ? "cases-view" : "auth-view");

    // Initialize 60-Minute Inactivity Auto-Logout Monitor
    this.auth.startInactivityMonitor(() => {
      this.updateHeaderUI();
      this.routeTo("auth-view");
      this.showToast("Tu sesión ha expirado por inactividad (60 minutos). Por favor, ingresa nuevamente.", "warning");
    });
  }

  _bindEvents() {
    // Nav Button Clicks
    document.querySelectorAll(".nav-btn[data-view]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const targetView = btn.dataset.view;
        this.routeTo(targetView);
      });
    });

    // Theme Toggle
    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        document.body.classList.toggle("light-theme");
        const isLight = document.body.classList.contains("light-theme");
        themeBtn.innerHTML = isLight ? '<i class="fas fa-moon"></i> Dark' : '<i class="fas fa-sun"></i> Light';
      });
    }

    // Modal Close buttons
    document.querySelectorAll(".modal-close-btn").forEach(btn => {
      btn.addEventListener("click", () => this.closeModals());
    });
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    let icon = "fa-info-circle";
    if (type === "success") icon = "fa-check-circle";
    if (type === "danger") icon = "fa-exclamation-triangle";
    if (type === "warning") icon = "fa-exclamation-circle";

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  closeModals() {
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("active");
  }

  updateHeaderUI() {
    const user = this.auth.getCurrentUser();
    const userContainer = document.getElementById("header-user-info");
    const navLinks = document.getElementById("main-nav-links");

    // DB Mode Status Indicator
    const dbDot = document.getElementById("db-status-dot");
    const dbText = document.getElementById("db-status-text");
    if (dbDot && dbText) {
      const isSupabase = this.db.name.includes("Supabase");
      dbDot.className = `status-dot ${isSupabase ? 'supabase' : 'local'}`;
      dbText.textContent = isSupabase ? "Supabase Cloud" : "Local SQLite / IDB";
    }

    if (!user) {
      if (userContainer) userContainer.style.display = "none";
      if (navLinks) navLinks.style.display = "none";
      return;
    }

    if (navLinks) navLinks.style.display = "flex";
    if (userContainer) {
      userContainer.style.display = "flex";
      userContainer.innerHTML = `
        <div class="user-profile-badge">
          <div class="user-avatar">${user.fullName.charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-size: 0.85rem; font-weight: 600;">${user.fullName}</div>
            <span class="user-role-tag role-${user.role}">${user.role}</span>
          </div>
        </div>
        <button id="logout-btn" class="btn btn-secondary btn-sm" title="Cerrar Sesión">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      `;

      document.getElementById("logout-btn")?.addEventListener("click", async () => {
        await this.auth.logout();
        this.updateHeaderUI();
        this.routeTo("auth-view");
        this.showToast("Sesión cerrada correctamente.", "info");
      });
    }

    // Toggle Admin-only menu items (Superadmin & Admin)
    const isAdmin = this.auth.isAdmin();
    document.querySelectorAll(".admin-only").forEach(el => {
      el.style.display = isAdmin ? "inline-flex" : "none";
    });

    // Toggle Docente-accessible menu items (Docentes, Admins, Superadmins)
    const isDocente = this.auth.isDocente();
    document.querySelectorAll(".docente-only").forEach(el => {
      el.style.display = isDocente ? "inline-flex" : "none";
    });
  }

  async routeTo(viewId) {
    // Guard check for unauthenticated users trying to access app views
    if (!this.auth.isLoggedIn() && viewId !== "auth-view") {
      viewId = "auth-view";
    }

    // Role-based route guards
    if (viewId === "users-view" || viewId === "db-view" || viewId === "logs-view") {
      if (!this.auth.isAdmin()) viewId = "cases-view";
    }
    if (viewId === "reports-view") {
      if (!this.auth.canViewReports()) viewId = "cases-view";
    }

    this.activeView = viewId;

    document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
    const targetSection = document.getElementById(viewId);
    if (targetSection) targetSection.classList.add("active");

    // Highlight active nav button
    document.querySelectorAll(".nav-btn[data-view]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === viewId);
    });

    // View initialization renders
    if (viewId === "auth-view") this.renderAuthView();
    if (viewId === "cases-view") await this.renderCasesView();
    if (viewId === "users-view") await this.renderUsersView();
    if (viewId === "reports-view") await this.renderReportsView();
    if (viewId === "db-view") await this.renderDbView();
    if (viewId === "logs-view") await this.renderLogsView();
  }

  // --- Auth View Renderer ---
  renderAuthView() {
    const container = document.getElementById("auth-view");
    if (!container) return;

    container.innerHTML = `
      <div class="auth-wrapper card auth-card">
        <div class="auth-hero-icon">
          <i class="fas fa-hospital-user"></i>
        </div>
        <h2 style="margin-bottom: 0.25rem;">SimulaCli</h2>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">
          Plataforma de Simulación Clínica & Aprendizaje Interactivo
        </p>

        <div id="first-user-banner" class="superadmin-banner" style="display: none;">
          <i class="fas fa-crown" style="font-size: 1.2rem; color: #f59e0b;"></i>
          <div>
            <strong>¡Modo Inicial Detectado!</strong><br>
            El primer usuario que se registre se asignará automáticamente como <strong>Superadmin</strong>.
          </div>
        </div>

        <div class="auth-tabs">
          <button id="tab-login-btn" class="auth-tab active">Iniciar Sesión</button>
          <button id="tab-register-btn" class="auth-tab">Auto-Registro</button>
        </div>

        <!-- Login Form -->
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Correo Electrónico</label>
            <input type="email" id="login-email" class="form-control" placeholder="doctor@hospital.org" required>
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <input type="password" id="login-password" class="form-control" placeholder="••••••••" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">
            <i class="fas fa-sign-in-alt"></i> Ingresar al Sistema
          </button>
        </form>

        <!-- Register Form -->
        <form id="register-form" style="display: none;">
          <div class="form-group">
            <label class="form-label">Nombre Completo</label>
            <input type="text" id="reg-name" class="form-control" placeholder="Dr. Alejandro Rossi" required>
          </div>
          <div class="form-group">
            <label class="form-label">Correo Electrónico</label>
            <input type="email" id="reg-email" class="form-control" placeholder="usuario@hospital.org" required>
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <input type="password" id="reg-password" class="form-control" placeholder="••••••••" required>
          </div>
          <button type="submit" class="btn btn-success" style="width: 100%; margin-top: 0.5rem;">
            <i class="fas fa-user-plus"></i> Crear Cuenta
          </button>
        </form>
      </div>
    `;

    // Check if system has 0 users
    this.db.getUsers().then(users => {
      const banner = document.getElementById("first-user-banner");
      if (banner) {
        banner.style.display = users.length === 0 ? "flex" : "none";
      }
    });

    // Tab Switch Events
    const loginTab = document.getElementById("tab-login-btn");
    const regTab = document.getElementById("tab-register-btn");
    const loginForm = document.getElementById("login-form");
    const regForm = document.getElementById("register-form");

    loginTab.addEventListener("click", () => {
      loginTab.classList.add("active");
      regTab.classList.remove("active");
      loginForm.style.display = "block";
      regForm.style.display = "none";
    });

    regTab.addEventListener("click", () => {
      regTab.classList.add("active");
      loginTab.classList.remove("active");
      loginForm.style.display = "none";
      regForm.style.display = "block";
    });

    // Login Form Submit
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const email = document.getElementById("login-email").value;
        const pass = document.getElementById("login-password").value;
        await this.auth.login(email, pass);
        this.updateHeaderUI();
        this.showToast("Bienvenido a SimulaCli.", "success");
        await this.routeTo("cases-view");
      } catch (err) {
        this.showToast(err.message, "danger");
      }
    });

    // Register Form Submit
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const name = document.getElementById("reg-name").value;
        const email = document.getElementById("reg-email").value;
        const pass = document.getElementById("reg-password").value;
        const res = await this.auth.register(email, name, pass);
        if (res.isFirstUser) {
          this.showToast("¡Cuenta de Superadmin registrada y autorizada automáticamente!", "success");
          await this.auth.login(email, pass);
          this.updateHeaderUI();
          await this.routeTo("cases-view");
        } else {
          this.showToast("Registro exitoso. Tu cuenta está pendiente de aprobación por el Superadmin.", "warning");
          loginTab.click();
        }
      } catch (err) {
        this.showToast(err.message, "danger");
      }
    });
  }

  // --- Clinical Cases View ---
  async renderCasesView() {
    const container = document.getElementById("cases-view");
    if (!container) return;

    let allCases = await this.db.getCases();
    const canManageCases = this.auth.canManageCases();

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; flex: 1;">
          <h2>Casos Clínicos Disponibles</h2>
          
          <!-- Google-Style Intelligent Search Bar -->
          <div class="google-search-wrapper">
            <i class="fas fa-search google-search-icon"></i>
            <input type="text" id="smart-case-search" class="google-search-input" placeholder="Buscar por título, síntoma, paciente o categoría...">
          </div>
        </div>

        ${canManageCases ? `
          <button id="add-case-btn" class="btn btn-primary">
            <i class="fas fa-plus-circle"></i> Crear Nuevo Caso Clínico
          </button>
        ` : ''}
      </div>

      <div id="cases-grid-container" class="cases-grid">
        ${allCases.map(c => this._buildCaseCardHTML(c, canManageCases)).join("")}
      </div>
    `;

    // Smart Intelligent Search Realtime Listener
    const searchInput = document.getElementById("smart-case-search");
    const gridContainer = document.getElementById("cases-grid-container");

    if (searchInput && gridContainer) {
      searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = allCases.filter(c => {
          const title = (c.title || "").toLowerCase();
          const patient = (c.patientName || "").toLowerCase();
          const complaint = (c.chiefComplaint || "").toLowerCase();
          const category = (c.category || "").toLowerCase();
          const difficulty = (c.difficulty || "").toLowerCase();
          const symptomsText = (c.symptoms || []).map(s => s.name.toLowerCase()).join(" ");

          return title.includes(query) || 
                 patient.includes(query) || 
                 complaint.includes(query) || 
                 category.includes(query) || 
                 difficulty.includes(query) || 
                 symptomsText.includes(query);
        });

        if (filtered.length > 0) {
          gridContainer.innerHTML = filtered.map(c => this._buildCaseCardHTML(c, canManageCases)).join("");
          this._bindCaseCardEvents(gridContainer, canManageCases);
        } else {
          gridContainer.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: var(--text-muted);">
              <i class="fas fa-search" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--primary);"></i>
              <h3>No se encontraron casos clínicos</h3>
              <p style="font-size: 0.9rem;">Pruebe buscando por otro síntoma, nombre de paciente o término médico.</p>
            </div>
          `;
        }
      });
    }

    this._bindCaseCardEvents(container, canManageCases);
  }

  _bindCaseCardEvents(container, isAdmin) {
    // Start simulation event
    container.querySelectorAll(".start-sim-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const caseId = btn.dataset.caseId;
        const caseObj = await this.db.getCaseById(caseId);
        if (caseObj) {
          this.sim.startSimulation(caseObj);
          this.renderSimulationRoomView();
        }
      });
    });

    // Admin Action Events
    if (isAdmin) {
      document.getElementById("add-case-btn")?.addEventListener("click", () => {
        this.openCaseEditorModal();
      });

      container.querySelectorAll(".edit-case-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const caseObj = await this.db.getCaseById(btn.dataset.caseId);
          if (caseObj) this.openCaseEditorModal(caseObj);
        });
      });

      container.querySelectorAll(".duplicate-case-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const caseObj = await this.db.getCaseById(btn.dataset.caseId);
          if (caseObj) {
            const clone = JSON.parse(JSON.stringify(caseObj));
            clone.id = "";
            clone.title = `Copia de ${clone.title}`;
            this.openCaseEditorModal(clone);
          }
        });
      });

      container.querySelectorAll(".view-rubric-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const caseObj = await this.db.getCaseById(btn.dataset.caseId);
          if (caseObj) this.openRubricModal(caseObj);
        });
      });

      container.querySelectorAll(".delete-case-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const caseId = btn.dataset.caseId;
          if (confirm("¿Está seguro de eliminar este caso clínico del sistema?")) {
            await this.db.deleteCase(caseId);
            this.showToast("Caso clínico eliminado.", "warning");
            await this.renderCasesView();
          }
        });
      });
    }
  }

  _buildCaseCardHTML(c, isAdmin) {
    const vitals = c.vitalSigns || {};
    const avatarSrc = c.patientAvatar && c.patientAvatar.startsWith("http") ? 
      `<img src="${c.patientAvatar}" alt="Paciente">` : 
      `<i class="fas fa-user-injured" style="color: var(--primary);"></i>`;

    return `
      <div class="card case-card">
        <div class="case-card-top">
          <span class="case-category-tag" title="${c.category || 'General'}"><i class="fas fa-folder-open" style="font-size:0.65rem;"></i> ${c.category || 'General'}</span>
          <span class="case-badge" title="${c.difficulty || 'Intermedio'}"><i class="fas fa-layer-group" style="font-size:0.65rem;"></i> ${c.difficulty || 'Intermedio'}</span>
        </div>

        <div class="patient-header">
          <div class="patient-avatar-box">
            ${avatarSrc}
          </div>
          <div style="flex-grow: 1; min-width: 0;">
            <h3 class="case-card-title">${c.title}</h3>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              ${c.patientName}, ${c.patientAge} años (${c.patientGender})
            </div>
          </div>
        </div>

        <p class="case-card-complaint">
          <strong>Motivo:</strong> ${c.chiefComplaint}
        </p>

        <div class="vitals-preview-bar">
          <div class="vital-item">
            <div class="vital-label">FC</div>
            <div class="vital-val">${vitals.heartRate || '--'}<span class="vital-unit">bpm</span></div>
          </div>
          <div class="vital-item">
            <div class="vital-label">PA</div>
            <div class="vital-val">${vitals.bloodPressure || '--'}</div>
          </div>
          <div class="vital-item">
            <div class="vital-label">SpO2</div>
            <div class="vital-val">${vitals.oxygenSaturation || '--'}%</div>
          </div>
          <div class="vital-item">
            <div class="vital-label">FR</div>
            <div class="vital-val">${vitals.respiratoryRate || '--'}</div>
          </div>
        </div>

        <div class="case-card-actions">
          <button class="btn btn-primary start-sim-btn" data-case-id="${c.id}" style="width: 100%;">
            <i class="fas fa-play-circle"></i> Iniciar Simulación
          </button>

          ${isAdmin ? `
            <div class="admin-actions-grid">
              <button class="btn btn-secondary btn-sm edit-case-btn" data-case-id="${c.id}" title="Editar Caso">
                <i class="fas fa-edit"></i> Editar
              </button>
              <button class="btn btn-secondary btn-sm duplicate-case-btn" data-case-id="${c.id}" title="Duplicar Caso">
                <i class="fas fa-copy"></i> Duplicar
              </button>
              <button class="btn btn-secondary btn-sm view-rubric-btn" data-case-id="${c.id}" style="grid-column: span 2;" title="Ver Clave de Respuestas">
                <i class="fas fa-key"></i> Clave de Respuestas Correctas
              </button>
              <button class="btn btn-danger btn-sm delete-case-btn" data-case-id="${c.id}" style="grid-column: span 2;" title="Eliminar Caso">
                <i class="fas fa-trash-alt"></i> Eliminar Caso
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // --- Interactive Hospital Simulation Room ---
  renderSimulationRoomView() {
    const container = document.getElementById("simulation-view");
    if (!container || !this.sim.activeCase) return;

    this.routeTo("simulation-view");
    const activeCase = this.sim.activeCase;
    const currentQ = this.sim.getCurrentQuestion();
    const vitals = activeCase.vitalSigns || {};

    const avatarSrc = activeCase.patientAvatar && activeCase.patientAvatar.startsWith("http") ? 
      `<img src="${activeCase.patientAvatar}" alt="Paciente">` : 
      `<i class="fas fa-user-injured" style="color: var(--primary);"></i>`;

    container.innerHTML = `
      <div class="sim-layout">
        <!-- Left Side: Clinical Patient Monitor -->
        <div class="clinical-monitor-card">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="patient-avatar-box" style="width: 44px; height: 44px;">
                ${avatarSrc}
              </div>
              <div>
                <h4 style="font-size: 1rem;">${activeCase.patientName}</h4>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${activeCase.patientAge} años | ${activeCase.patientGender}</div>
              </div>
            </div>
            <span class="brand-tag"><i class="fas fa-heartbeat"></i> Triaje Vivo</span>
          </div>

          <!-- Animated ECG -->
          <div class="ecg-graph-box">
            <svg class="ecg-line" viewBox="0 0 500 60">
              <path class="ecg-wave-path" d="M 0 30 L 80 30 L 90 10 L 100 50 L 110 5 L 120 40 L 130 30 L 250 30 L 260 12 L 270 48 L 280 8 L 290 38 L 300 30 L 500 30" />
            </svg>
          </div>

          <!-- Vitals Grid -->
          <div class="vitals-monitor-grid">
            <div class="monitor-vital-card">
              <div class="vital-label vital-tag-hr"><i class="fas fa-heart"></i> Frecuencia Cardíaca</div>
              <div class="vital-large-val vital-tag-hr">${vitals.heartRate || 80}</div>
              <div style="font-size:0.65rem; color: var(--text-dim);">BPM</div>
            </div>
            <div class="monitor-vital-card">
              <div class="vital-label vital-tag-bp"><i class="fas fa-compress-alt"></i> Presión Arterial</div>
              <div class="vital-large-val vital-tag-bp" style="font-size: 1.35rem;">${vitals.bloodPressure || '120/80'}</div>
              <div style="font-size:0.65rem; color: var(--text-dim);">mmHg</div>
            </div>
            <div class="monitor-vital-card">
              <div class="vital-label vital-tag-spo2"><i class="fas fa-lungs"></i> Sat. Oxígeno</div>
              <div class="vital-large-val vital-tag-spo2">${vitals.oxygenSaturation || 98}%</div>
              <div style="font-size:0.65rem; color: var(--text-dim);">SpO2</div>
            </div>
            <div class="monitor-vital-card">
              <div class="vital-label vital-tag-rr"><i class="fas fa-wind"></i> Frec. Respiratoria</div>
              <div class="vital-large-val vital-tag-rr">${vitals.respiratoryRate || 16}</div>
              <div style="font-size:0.65rem; color: var(--text-dim);">RPM</div>
            </div>
          </div>

          <!-- Symptomatology Box -->
          <div class="symptoms-box">
            <h5 style="font-size: 0.85rem; margin-bottom: 0.5rem; color: var(--primary);">
              <i class="fas fa-notes-medical"></i> Sintomatología Presentada
            </h5>
            ${activeCase.symptoms ? activeCase.symptoms.map(s => `
              <div class="symptom-tag-item">
                <span class="severity-pill severity-${s.severity}">${s.severity}</span>
                <div>
                  <strong style="font-size: 0.8rem;">${s.name}</strong>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${s.details}</div>
                </div>
              </div>
            `).join("") : '<div style="font-size:0.8rem;">Sin síntomas específicos registrado.</div>'}
          </div>
        </div>

        <!-- Right Side: Interactive Q&A Flow -->
        <div>
          <div class="question-card card">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <span class="question-step-badge">
                Pregunta ${this.sim.currentQuestionIndex + 1} de ${activeCase.questions.length}
              </span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">
                Puntaje: ${currentQ.points || 25} pts
              </span>
            </div>

            <h3 style="margin-bottom: 0.5rem;">${currentQ.title}</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.25rem;">
              ${currentQ.description}
            </p>

            <form id="question-form">
              ${this._renderQuestionInputHTML(currentQ)}

              <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 2rem;">
                <button type="button" id="prev-q-btn" class="btn btn-secondary" ${this.sim.currentQuestionIndex === 0 ? 'disabled' : ''}>
                  <i class="fas fa-arrow-left"></i> Anterior
                </button>
                
                ${this.sim.currentQuestionIndex < activeCase.questions.length - 1 ? `
                  <button type="submit" class="btn btn-primary">
                    Siguiente Pregunta <i class="fas fa-arrow-right"></i>
                  </button>
                ` : `
                  <button type="submit" class="btn btn-success">
                    <i class="fas fa-check-circle"></i> Finalizar Simulación & Ver Devolución
                  </button>
                `}
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Question form Submission & Navigation
    const qForm = document.getElementById("question-form");
    qForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this._saveCurrentQuestionAnswer(currentQ);

      const nextQ = this.sim.nextQuestion();
      if (nextQ) {
        this.renderSimulationRoomView();
      } else {
        // Complete Simulation
        this.finishSimulation();
      }
    });

    document.getElementById("prev-q-btn")?.addEventListener("click", () => {
      this._saveCurrentQuestionAnswer(currentQ);
      this.sim.previousQuestion();
      this.renderSimulationRoomView();
    });

    // Option selection button effects
    document.querySelectorAll(".option-btn").forEach(opt => {
      opt.addEventListener("click", () => {
        if (currentQ.type === "single_choice") {
          document.querySelectorAll(".option-btn").forEach(o => o.classList.remove("selected"));
          opt.classList.add("selected");
          opt.querySelector("input").checked = true;
        } else if (currentQ.type === "multiple_choice") {
          opt.classList.toggle("selected");
          const chk = opt.querySelector("input");
          chk.checked = !chk.checked;
        }
      });
    });
  }

  _renderQuestionInputHTML(q) {
    const savedAns = this.sim.userAnswers[q.id];

    if (q.type === "single_choice") {
      return `
        <div class="options-container">
          ${q.options.map(opt => `
            <div class="option-btn ${savedAns === opt ? 'selected' : ''}">
              <div class="option-radio"><i class="fas fa-check" style="font-size:0.6rem;"></i></div>
              <input type="radio" name="single-opt" value="${opt}" ${savedAns === opt ? 'checked' : ''} style="display:none;">
              <span>${opt}</span>
            </div>
          `).join("")}
        </div>
      `;
    }

    if (q.type === "multiple_choice") {
      const selectedArr = Array.isArray(savedAns) ? savedAns : [];
      return `
        <div class="options-container">
          ${q.options.map(opt => {
            const isSel = selectedArr.includes(opt);
            return `
              <div class="option-btn ${isSel ? 'selected' : ''}">
                <div class="option-checkbox"><i class="fas fa-check" style="font-size:0.6rem;"></i></div>
                <input type="checkbox" name="multi-opt" value="${opt}" ${isSel ? 'checked' : ''} style="display:none;">
                <span>${opt}</span>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    if (q.type === "dropdown") {
      return `
        <div class="form-group" style="margin: 1.5rem 0;">
          <label class="form-label">Seleccione la opción correcta:</label>
          <select id="dropdown-select" class="form-control" style="font-size: 1rem; padding: 0.85rem;">
            <option value="">-- Seleccionar opción --</option>
            ${q.options.map(opt => `
              <option value="${opt}" ${savedAns === opt ? 'selected' : ''}>${opt}</option>
            `).join("")}
          </select>
        </div>
      `;
    }

    if (q.type === "text_open") {
      return `
        <div class="form-group" style="margin: 1.5rem 0;">
          <label class="form-label">Escriba su respuesta o conducta médica recomendada:</label>
          <textarea id="open-text-ans" class="form-control" rows="4" placeholder="Ingrese detalladamente su planteo diagnóstico o tratamiento...">${savedAns || ''}</textarea>
        </div>
      `;
    }

    return '';
  }

  _saveCurrentQuestionAnswer(q) {
    if (q.type === "single_choice") {
      const selectedOpt = document.querySelector('.option-btn.selected input[type="radio"]');
      if (selectedOpt) this.sim.recordAnswer(q.id, selectedOpt.value);
    } else if (q.type === "multiple_choice") {
      const selectedOpts = Array.from(document.querySelectorAll('.option-btn.selected input[type="checkbox"]')).map(i => i.value);
      this.sim.recordAnswer(q.id, selectedOpts);
    } else if (q.type === "dropdown") {
      const select = document.getElementById("dropdown-select");
      if (select) this.sim.recordAnswer(q.id, select.value);
    } else if (q.type === "text_open") {
      const textarea = document.getElementById("open-text-ans");
      if (textarea) this.sim.recordAnswer(q.id, textarea.value);
    }
  }

  // --- Finish Simulation & Render Feedback Report ---
  async finishSimulation() {
    const user = this.auth.getCurrentUser();
    const report = this.sim.evaluateSimulation(user);
    this.currentAttemptReport = report;

    // Save Attempt to Database
    await this.db.saveAttempt({
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      caseId: report.caseId,
      caseTitle: report.caseTitle,
      totalScore: report.finalPercentage,
      maxScore: 100,
      answers: this.sim.userAnswers,
      feedbackReport: report
    });

    this.renderFeedbackView(report);
  }

  renderFeedbackView(report) {
    const container = document.getElementById("feedback-view");
    if (!container) return;

    this.routeTo("feedback-view");

    container.innerHTML = `
      <div class="card report-header">
        <span class="brand-tag"><i class="fas fa-file-medical-alt"></i> Devolución Clínica Final</span>
        <h2 style="margin-top: 0.5rem;">${report.caseTitle}</h2>
        <p style="color: var(--text-muted); font-size: 0.9rem;">
          Simulación completada por: <strong>${report.patientName}</strong> | Tiempo total: ${report.completionTimeSeconds} seg
        </p>

        <div class="score-gauge-box">
          <svg class="score-circle" width="130" height="130">
            <circle cx="65" cy="65" r="55" stroke="rgba(255,255,255,0.1)" stroke-width="10" fill="none"/>
            <circle cx="65" cy="65" r="55" stroke="var(--primary)" stroke-width="10" fill="none"
              stroke-dasharray="345" stroke-dashoffset="${345 - (345 * report.finalPercentage / 100)}" style="transition: stroke-dashoffset 1s ease;"/>
          </svg>
          <div class="score-number">${report.finalPercentage}%</div>
        </div>

        <div style="font-size: 1.1rem; font-weight: 700; color: var(--${report.gradeClass}); margin-bottom: 0.5rem;">
          ${report.performanceGrade}
        </div>
        <p style="max-width: 600px; margin: 0 auto; font-size: 0.9rem; color: var(--text-muted);">
          ${report.evaluationSummary}
        </p>

        <div class="no-print" style="margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: center;">
          <button id="print-report-btn" class="btn btn-secondary">
            <i class="fas fa-print"></i> Imprimir / Guardar PDF
          </button>
          <button id="back-cases-btn" class="btn btn-primary">
            <i class="fas fa-stethoscope"></i> Realizar Otra Simulación
          </button>
        </div>
      </div>

      <h3 style="margin-bottom: 1rem;"><i class="fas fa-list-check"></i> Desglose por Pregunta y Rubrica</h3>
      
      ${report.questionBreakdowns.map(qb => `
        <div class="card report-breakdown-card ${qb.isCorrect ? 'correct' : 'incorrect'}">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
            <strong>Pregunta ${qb.questionNumber}: ${qb.questionTitle}</strong>
            <span class="user-role-tag ${qb.isCorrect ? 'role-user' : 'role-superadmin'}">
              ${qb.ptsEarned} / ${qb.maxPts} pts
            </span>
          </div>

          <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 0.6rem;">
            ${qb.questionDescription}
          </p>

          <div style="font-size: 0.85rem; margin-bottom: 0.4rem;">
            <strong>Tu Respuesta:</strong> 
            <span style="color: ${qb.isCorrect ? 'var(--secondary)' : 'var(--danger)'};">
              ${Array.isArray(qb.userAnswer) ? qb.userAnswer.join(", ") : qb.userAnswer}
            </span>
          </div>

          <div class="feedback-explanation">
            <strong><i class="fas fa-lightbulb"></i> Devolución Pedagógica:</strong><br>
            ${qb.feedback}
          </div>
        </div>
      `).join("")}
    `;

    document.getElementById("print-report-btn")?.addEventListener("click", () => {
      window.print();
    });

    document.getElementById("back-cases-btn")?.addEventListener("click", () => {
      this.routeTo("cases-view");
    });
  }

  // --- Superadmin / Admin / Docente Analytics & Simulation Reports View ---
  async renderReportsView() {
    const container = document.getElementById("reports-view");
    if (!container || !this.auth.canViewReports()) return;

    const attempts = await this.db.getAttempts();
    const users = await this.db.getUsers();
    const cases = await this.db.getCases();

    container.innerHTML = `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i class="fas fa-chart-line"></i> Reporte Global de Simulaciones Clínicas</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">
              Filtre los resultados por usuario, rango de fechas o caso clínico simulado.
            </p>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="reports-filter-bar">
          <div style="flex: 1; min-width: 200px;">
            <label class="form-label"><i class="fas fa-user"></i> Usuario / Estudiante</label>
            <select id="rpt-filter-user" class="form-control">
              <option value="">-- Todos los Usuarios --</option>
              ${users.map(u => `<option value="${u.email}">${u.fullName} (${u.email})</option>`).join("")}
            </select>
          </div>

          <div style="flex: 1; min-width: 180px;">
            <label class="form-label"><i class="fas fa-calendar-alt"></i> Fecha Desde</label>
            <input type="date" id="rpt-filter-from" class="form-control">
          </div>

          <div style="flex: 1; min-width: 180px;">
            <label class="form-label"><i class="fas fa-calendar-alt"></i> Fecha Hasta</label>
            <input type="date" id="rpt-filter-to" class="form-control">
          </div>

          <div style="flex: 1; min-width: 200px;">
            <label class="form-label"><i class="fas fa-stethoscope"></i> Caso Clínico</label>
            <select id="rpt-filter-case" class="form-control">
              <option value="">-- Todos los Casos --</option>
              ${cases.map(c => `<option value="${c.id}">${c.title}</option>`).join("")}
            </select>
          </div>

          <div style="display: flex; align-items: flex-end; gap: 0.5rem; margin-top: 1.4rem;">
            <button id="apply-rpt-filter-btn" class="btn btn-primary">
              <i class="fas fa-filter"></i> Filtrar
            </button>
            <button id="reset-rpt-filter-btn" class="btn btn-secondary">
              <i class="fas fa-undo"></i> Limpiar
            </button>
          </div>
        </div>

        <div id="reports-table-container">
          ${this._buildReportsTableHTML(attempts)}
        </div>
      </div>
    `;

    // Filter Listeners
    const applyBtn = document.getElementById("apply-rpt-filter-btn");
    const resetBtn = document.getElementById("reset-rpt-filter-btn");

    const doFilter = () => {
      const selectedUser = document.getElementById("rpt-filter-user").value;
      const dateFrom = document.getElementById("rpt-filter-from").value;
      const dateTo = document.getElementById("rpt-filter-to").value;
      const selectedCase = document.getElementById("rpt-filter-case").value;

      const filtered = attempts.filter(a => {
        let matchUser = true;
        let matchDate = true;
        let matchCase = true;

        if (selectedUser && a.userEmail.toLowerCase() !== selectedUser.toLowerCase()) {
          matchUser = false;
        }

        if (selectedCase && a.caseId !== selectedCase) {
          matchCase = false;
        }

        if (a.createdAt) {
          const attemptDate = new Date(a.createdAt);
          if (dateFrom && attemptDate < new Date(dateFrom)) matchDate = false;
          if (dateTo) {
            const endOfDay = new Date(dateTo);
            endOfDay.setHours(23, 59, 59, 999);
            if (attemptDate > endOfDay) matchDate = false;
          }
        }

        return matchUser && matchDate && matchCase;
      });

      document.getElementById("reports-table-container").innerHTML = this._buildReportsTableHTML(filtered);
      this._bindReportRowEvents();
    };

    applyBtn?.addEventListener("click", doFilter);
    resetBtn?.addEventListener("click", () => {
      document.getElementById("rpt-filter-user").value = "";
      document.getElementById("rpt-filter-from").value = "";
      document.getElementById("rpt-filter-to").value = "";
      document.getElementById("rpt-filter-case").value = "";
      document.getElementById("reports-table-container").innerHTML = this._buildReportsTableHTML(attempts);
      this._bindReportRowEvents();
    });

    this._bindReportRowEvents();
  }

  _buildReportsTableHTML(attempts) {
    if (!attempts || attempts.length === 0) {
      return `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; color: var(--primary);"></i>
          <p>No se encontraron registros de simulaciones para los filtros seleccionados.</p>
        </div>
      `;
    }

    const totalSims = attempts.length;
    const avgScore = Math.round(attempts.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) / totalSims);

    return `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card" style="padding: 1rem; text-align: center; background: rgba(6, 182, 212, 0.1);">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Total Simulaciones</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--primary); font-family: var(--font-mono);">${totalSims}</div>
        </div>
        <div class="card" style="padding: 1rem; text-align: center; background: rgba(16, 185, 129, 0.1);">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Promedio de Puntaje</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--secondary); font-family: var(--font-mono);">${avgScore}%</div>
        </div>
        <div class="card" style="padding: 1rem; text-align: center; background: rgba(99, 102, 241, 0.1);">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Desempeño Promedio</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--accent); margin-top: 0.3rem;">
            ${avgScore >= 80 ? 'Excelente' : (avgScore >= 60 ? 'Aceptable' : 'Requiere Revisión')}
          </div>
        </div>
      </div>

      <div class="custom-table-wrapper">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Usuario / Estudiante</th>
              <th>Caso Clínico</th>
              <th>Fecha y Hora</th>
              <th>Puntaje</th>
              <th>Calificación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${attempts.map(a => {
              const rpt = a.feedbackReport || {};
              const pct = a.totalScore || 0;
              const dateStr = a.createdAt ? `${new Date(a.createdAt).toLocaleDateString()} ${new Date(a.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : '-';

              return `
                <tr>
                  <td>
                    <strong>${a.userName || 'Estudiante'}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${a.userEmail}</div>
                  </td>
                  <td><strong>${a.caseTitle}</strong></td>
                  <td style="font-size: 0.8rem; font-family: var(--font-mono);">${dateStr}</td>
                  <td>
                    <span class="user-role-tag ${pct >= 75 ? 'role-user' : (pct >= 60 ? 'role-admin' : 'role-superadmin')}">
                      ${pct}%
                    </span>
                  </td>
                  <td style="font-size: 0.85rem;">${rpt.performanceGrade || 'Evaluado'}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm view-rpt-devolucion-btn" data-attempt-id="${a.id}">
                      <i class="fas fa-file-medical-alt"></i> Ver Devolución
                    </button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  _bindReportRowEvents() {
    document.querySelectorAll(".view-rpt-devolucion-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const attemptId = btn.dataset.attemptId;
        const attempts = await this.db.getAttempts();
        const attempt = attempts.find(a => a.id === attemptId);
        if (attempt && attempt.feedbackReport) {
          this.renderFeedbackView(attempt.feedbackReport);
        }
      });
    });
  }

  // --- Superadmin / Admin User Management View ---
  async renderUsersView() {
    const container = document.getElementById("users-view");
    if (!container || !this.auth.isAdmin()) return;

    const users = await this.db.getUsers();

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i class="fas fa-users-cog"></i> Gestión de Usuarios y Autorizaciones</h3>
            <p style="font-size:0.85rem; color: var(--text-muted);">
              Aprobación y administración de perfiles auto-registrados.
            </p>
          </div>
        </div>

        <div class="custom-table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Usuario / Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Fecha Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td><strong>${u.fullName}</strong></td>
                  <td>${u.email}</td>
                  <td>
                    ${u.status === 'approved' && u.role !== 'superadmin' ? `
                      <select class="user-role-select form-control form-control-sm" data-user-id="${u.id}" style="padding: 0.25rem 0.5rem; font-size: 0.78rem; width: auto; display: inline-block;">
                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>Estudiante</option>
                        <option value="docente" ${u.role === 'docente' || u.role === 'teacher' ? 'selected' : ''}>Docente</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option>
                      </select>
                    ` : `
                      <span class="user-role-tag role-${u.role}">${u.role}</span>
                    `}
                  </td>
                  <td>
                    <span class="user-role-tag ${u.status === 'approved' ? 'role-user' : (u.status === 'pending' ? 'role-admin' : 'role-superadmin')}">
                      ${u.status.toUpperCase()}
                    </span>
                  </td>
                  <td style="font-size:0.8rem; font-family: var(--font-mono);">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td>
                  <td>
                    ${u.status === 'pending' ? `
                      <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
                        <button class="btn btn-success btn-sm approve-user-btn" data-user-id="${u.id}" data-role="user" title="Aprobar como Estudiante">
                          <i class="fas fa-check"></i> Aprobar
                        </button>
                        <button class="btn btn-primary btn-sm approve-user-btn" data-user-id="${u.id}" data-role="docente" title="Aprobar como Docente">
                          <i class="fas fa-chalkboard-teacher"></i> Docente
                        </button>
                        <button class="btn btn-danger btn-sm reject-user-btn" data-user-id="${u.id}">
                          <i class="fas fa-times"></i> Rechazar
                        </button>
                      </div>
                    ` : `
                      <span style="font-size:0.8rem; color:var(--text-muted);"><i class="fas fa-user-check"></i> Activo</span>
                    `}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Role Dropdown Change Handlers
    container.querySelectorAll(".user-role-select").forEach(sel => {
      sel.addEventListener("change", async (e) => {
        const userId = sel.dataset.userId;
        const newRole = e.target.value;
        try {
          await this.auth.updateUserRole(userId, newRole);
          this.showToast(`Rol de usuario actualizado a: ${newRole.toUpperCase()}`, "success");
          await this.renderUsersView();
        } catch (err) {
          this.showToast(err.message, "danger");
        }
      });
    });

    // Approve / Reject Handlers
    container.querySelectorAll(".approve-user-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const userId = btn.dataset.userId;
        const role = btn.dataset.role || "user";
        await this.auth.approveUser(userId, role);
        this.showToast(`Usuario aprobado con rol: ${role.toUpperCase()}.`, "success");
        await this.renderUsersView();
      });
    });

    container.querySelectorAll(".reject-user-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const userId = btn.dataset.userId;
        await this.auth.rejectUser(userId);
        this.showToast("Usuario rechazado.", "warning");
        await this.renderUsersView();
      });
    });
  }

  // --- Database Migration & Schema Control Panel ---
  async renderDbView() {
    const container = document.getElementById("db-view");
    if (!container) return;

    const ddl = SchemaSyncEngine.getSupabaseDDL();
    const currentSbUrl = getStoredConfig(CONFIG.STORAGE_KEYS.SUPABASE_URL, "");
    const currentSbKey = getStoredConfig(CONFIG.STORAGE_KEYS.SUPABASE_KEY, "");
    const isSupabaseActive = this.db.name.includes("Supabase");

    container.innerHTML = `
      <!-- Supabase Cloud Connection Panel -->
      <div class="card" style="margin-bottom: 1.5rem; border: 1px solid var(--primary-color);">
        <div class="card-header">
          <h3 class="card-title">
            <i class="fas fa-cloud"></i> Conexión con Supabase Cloud
          </h3>
          <span class="user-role-tag ${isSupabaseActive ? 'role-user' : 'role-admin'}">
            ${isSupabaseActive ? 'CONECTADO A SUPABASE' : 'MODO LOCAL ACTIVO'}
          </span>
        </div>

        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.25rem;">
          Conecta SimulaCli a tu proyecto en la nube de Supabase para centralizar usuarios, casos clínicos e intentos en tiempo real.
        </p>

        <form id="supabase-config-form" style="display: grid; gap: 1rem; margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label"><strong>Project URL</strong> (Ej: https://xxxxxxxxxxxx.supabase.co)</label>
            <input type="text" id="sb-input-url" class="form-control" placeholder="https://tu-proyecto.supabase.co" value="${currentSbUrl}">
          </div>
          <div class="form-group">
            <label class="form-label"><strong>Anon Public API Key</strong> (Clave pública de Supabase)</label>
            <input type="password" id="sb-input-key" class="form-control" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." value="${currentSbKey}">
          </div>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button type="submit" class="btn btn-primary">
              <i class="fas fa-plug"></i> Guardar y Conectar Supabase
            </button>
            ${isSupabaseActive || currentSbUrl ? `
              <button type="button" id="disconnect-supabase-btn" class="btn btn-danger">
                <i class="fas fa-power-off"></i> Desconectar (Volver a Modo Local)
              </button>
            ` : ''}
          </div>
        </form>
      </div>

      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-database"></i> Motor de Datos y Esquema SQL</h3>
        </div>

        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.25rem;">
          Motor activo: <strong>${this.db.name}</strong>.
        </p>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
          <button id="sync-now-btn" class="btn btn-primary">
            <i class="fas fa-sync-alt"></i> Sincronizar Datos Semilla
          </button>
          <button id="copy-sql-btn" class="btn btn-secondary">
            <i class="fas fa-copy"></i> Copiar Script SQL para Supabase
          </button>
          <button id="export-json-btn" class="btn btn-secondary">
            <i class="fas fa-file-code"></i> Descargar simulacli.json
          </button>
          <label class="btn btn-secondary" style="cursor: pointer;">
            <i class="fas fa-file-upload"></i> Cargar archivo .json
            <input type="file" id="import-json-file" accept=".json" style="display: none;">
          </label>
        </div>

        <div id="sync-result-box" style="display: none; margin-bottom: 1.5rem;"></div>

        <h4><i class="fas fa-code"></i> Script SQL DDL para Supabase SQL Editor</h4>
        <pre id="sql-ddl-code" class="form-control" style="font-family: var(--font-mono); font-size: 0.8rem; background: #040914; height: 250px; overflow-y: auto; margin-top: 0.5rem;">${ddl}</pre>
      </div>
    `;

    // Supabase Config Form Handler
    document.getElementById("supabase-config-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const url = document.getElementById("sb-input-url").value.trim();
      const key = document.getElementById("sb-input-key").value.trim();

      if (!url || !key) {
        this.showToast("Por favor ingresa tanto la URL como la Anon Key de Supabase.", "warning");
        return;
      }

      setStoredConfig(CONFIG.STORAGE_KEYS.SUPABASE_URL, url);
      setStoredConfig(CONFIG.STORAGE_KEYS.SUPABASE_KEY, key);
      this.showToast("Credenciales de Supabase guardadas. Recargando...", "success");
      setTimeout(() => window.location.reload(), 1000);
    });

    // Disconnect Supabase Handler
    document.getElementById("disconnect-supabase-btn")?.addEventListener("click", () => {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.SUPABASE_URL);
      localStorage.removeItem(CONFIG.STORAGE_KEYS.SUPABASE_KEY);
      this.showToast("Desconectado de Supabase. Recargando en modo local...", "info");
      setTimeout(() => window.location.reload(), 1000);
    });

    // Copy SQL DDL to Clipboard
    document.getElementById("copy-sql-btn")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(ddl);
        this.showToast("¡Script SQL copiado al portapapeles!", "success");
      } catch (e) {
        this.showToast("Selecciona y copia el texto del cuadro SQL manualmente.", "info");
      }
    });

    // Export .json file handler
    document.getElementById("export-json-btn")?.addEventListener("click", async () => {
      if (typeof this.db.exportJsonFile === "function") {
        await this.db.exportJsonFile();
        this.showToast("Archivo simulacli_database.json descargado.", "success");
      } else {
        this.showToast("Exportación realizada.", "info");
      }
    });

    // Import .json file handler
    document.getElementById("import-json-file")?.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file && typeof this.db.loadJsonFile === "function") {
        try {
          const text = await file.text();
          await this.db.loadJsonFile(text);
          this.showToast("Base de datos .json cargada exitosamente.", "success");
          await this.routeTo("cases-view");
        } catch (err) {
          this.showToast(err.message, "danger");
        }
      }
    });

    document.getElementById("sync-now-btn")?.addEventListener("click", async () => {
      const res = await SchemaSyncEngine.syncOfflineDataWithCloud(this.db, this.auth);
      const resBox = document.getElementById("sync-result-box");
      if (resBox) {
        resBox.style.display = "block";
        resBox.className = `superadmin-banner ${res.status === 'success' ? '' : 'danger'}`;
        resBox.innerHTML = `<i class="fas fa-info-circle"></i> <div>${res.message}</div>`;
      }
      this.showToast(res.message, res.status === "success" ? "success" : "danger");
    });
  }

  // --- End-to-End Audit Logs Timeline ---
  async renderLogsView() {
    const container = document.getElementById("logs-view");
    if (!container || !this.auth.isAdmin()) return;

    const logs = await this.db.getLogs(100);

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-history"></i> Registro de Auditoría de Punta a Punta</h3>
        </div>

        <div class="log-timeline">
          ${logs.map(l => `
            <div class="log-item">
              <span class="log-timestamp">${new Date(l.timestamp).toLocaleTimeString()} - ${new Date(l.timestamp).toLocaleDateString()}</span>
              <div>
                <span class="user-role-tag role-admin">${l.eventType}</span>
                <span style="font-size:0.85rem; font-weight:600; margin-left:0.5rem;">${l.description}</span>
                <div style="font-size:0.75rem; color:var(--text-dim);">${l.userEmail || 'sistema'}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // --- Rubric & Correct Answers Modal for Admins ---
  openRubricModal(caseObj) {
    this.openModal("case-editor-modal");
    const modalContent = document.getElementById("modal-case-body");
    if (!modalContent) return;

    modalContent.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
        <h3><i class="fas fa-key" style="color: var(--warning);"></i> Clave de Respuestas Correctas</h3>
        <span class="user-role-tag role-admin">Acceso Administrador</span>
      </div>

      <div style="background: rgba(15, 23, 42, 0.6); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; border: 1px solid var(--border-color);">
        <h4 style="color: var(--primary);">${caseObj.title}</h4>
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          Paciente: ${caseObj.patientName} (${caseObj.patientAge} años, ${caseObj.patientGender})
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${caseObj.questions ? caseObj.questions.map((q, idx) => `
          <div class="card" style="padding: 1rem; border-left: 4px solid var(--primary);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
              <strong>Pregunta ${idx + 1}: ${q.title}</strong>
              <span class="user-role-tag role-user">${q.points || 25} Puntos</span>
            </div>

            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.6rem;">${q.description}</p>

            <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.88rem; margin-bottom: 0.5rem;">
              <strong style="color: var(--secondary);"><i class="fas fa-check-circle"></i> Respuesta Correcta Esperada:</strong><br>
              <span>${Array.isArray(q.correctAnswer) ? q.correctAnswer.join(" + ") : q.correctAnswer}</span>
            </div>

            <div style="font-size: 0.82rem; color: var(--text-muted);">
              <strong>Justificación Pedagógica:</strong> ${q.feedback}
            </div>
          </div>
        `).join("") : '<div>No hay preguntas registradas en este caso.</div>'}
      </div>
    `;
  }

  // --- Case Editor Modal Handler ---
  openCaseEditorModal(caseObj = null) {
    this.openModal("case-editor-modal");
    const modalContent = document.getElementById("modal-case-body");
    if (!modalContent) return;

    const isEdit = caseObj && caseObj.id;
    const vitals = (caseObj && caseObj.vitalSigns) || { heartRate: 80, bloodPressure: "120/80", oxygenSaturation: 98, respiratoryRate: 16 };

    modalContent.innerHTML = `
      <h3><i class="fas fa-stethoscope"></i> ${isEdit ? 'Editar Caso Clínico' : 'Crear Nuevo Caso Clínico'}</h3>
      <form id="save-case-form" style="margin-top: 1rem;">
        <input type="hidden" id="case-id" value="${caseObj ? caseObj.id : ''}">

        <div class="form-group">
          <label class="form-label">Título del Caso Clínico</label>
          <input type="text" id="case-title" class="form-control" value="${caseObj ? caseObj.title : ''}" placeholder="Ej: Infarto Agudo de Miocardio" required>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label class="form-label">Categoría</label>
            <input type="text" id="case-category" class="form-control" value="${caseObj ? (caseObj.category || '') : 'Cardiología'}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Dificultad</label>
            <select id="case-difficulty" class="form-control">
              <option value="Principiante" ${caseObj && caseObj.difficulty === 'Principiante' ? 'selected' : ''}>Principiante</option>
              <option value="Intermedio" ${!caseObj || caseObj.difficulty === 'Intermedio' ? 'selected' : ''}>Intermedio</option>
              <option value="Avanzado" ${caseObj && caseObj.difficulty === 'Avanzado' ? 'selected' : ''}>Avanzado</option>
            </select>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label class="form-label">Nombre Paciente</label>
            <input type="text" id="patient-name" class="form-control" value="${caseObj ? caseObj.patientName : ''}" placeholder="Juan Pérez" required>
          </div>
          <div class="form-group">
            <label class="form-label">Edad Paciente</label>
            <input type="number" id="patient-age" class="form-control" value="${caseObj ? caseObj.patientAge : 45}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Género</label>
            <select id="patient-gender" class="form-control">
              <option value="Masculino" ${caseObj && caseObj.patientGender === 'Masculino' ? 'selected' : ''}>Masculino</option>
              <option value="Femenino" ${caseObj && caseObj.patientGender === 'Femenino' ? 'selected' : ''}>Femenino</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Avatar / Fotografía del Paciente (URL de imagen o gráfico)</label>
          <input type="text" id="patient-avatar-url" class="form-control" value="${caseObj ? (caseObj.patientAvatar || '') : ''}" placeholder="https://ejemplo.com/avatar.jpg">
        </div>

        <div class="form-group">
          <label class="form-label">Motivo de Consulta y Triaje Inicial</label>
          <textarea id="chief-complaint" class="form-control" rows="3" required>${caseObj ? caseObj.chiefComplaint : ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Antecedentes Médicos</label>
          <textarea id="medical-history" class="form-control" rows="2">${caseObj ? (caseObj.medicalHistory || '') : ''}</textarea>
        </div>

        <!-- Vital Signs -->
        <h4 style="margin: 1rem 0 0.5rem; font-size: 0.95rem; color: var(--primary);">Signos Vitales del Paciente</h4>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem;">
          <div>
            <label class="form-label">FC (bpm)</label>
            <input type="number" id="vital-hr" class="form-control" value="${vitals.heartRate || 80}">
          </div>
          <div>
            <label class="form-label">PA (mmHg)</label>
            <input type="text" id="vital-bp" class="form-control" value="${vitals.bloodPressure || '120/80'}">
          </div>
          <div>
            <label class="form-label">SpO2 (%)</label>
            <input type="number" id="vital-spo2" class="form-control" value="${vitals.oxygenSaturation || 98}">
          </div>
          <div>
            <label class="form-label">FR (rpm)</label>
            <input type="number" id="vital-rr" class="form-control" value="${vitals.respiratoryRate || 16}">
          </div>
        </div>

        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
          <i class="fas fa-save"></i> Guardar Caso Clínico
        </button>
      </form>
    `;

    document.getElementById("save-case-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const existingId = document.getElementById("case-id").value;
      const targetCase = {
        id: existingId || `case-${Date.now()}`,
        title: document.getElementById("case-title").value,
        category: document.getElementById("case-category").value,
        difficulty: document.getElementById("case-difficulty").value,
        patientName: document.getElementById("patient-name").value,
        patientAge: parseInt(document.getElementById("patient-age").value, 10),
        patientGender: document.getElementById("patient-gender").value,
        patientAvatar: document.getElementById("patient-avatar-url").value || "svg:patient-default",
        chiefComplaint: document.getElementById("chief-complaint").value,
        medicalHistory: document.getElementById("medical-history").value,
        vitalSigns: {
          heartRate: parseInt(document.getElementById("vital-hr").value, 10),
          bloodPressure: document.getElementById("vital-bp").value,
          oxygenSaturation: parseInt(document.getElementById("vital-spo2").value, 10),
          respiratoryRate: parseInt(document.getElementById("vital-rr").value, 10)
        },
        symptoms: caseObj ? (caseObj.symptoms || []) : [{ name: "Sintomatología reportada", severity: "Media", details: "Evaluación inicial." }],
        questions: caseObj ? (caseObj.questions || []) : [{
          id: `q-${Date.now()}`,
          title: "Evaluación Diagnóstica Inicial",
          description: "¿Cuál es la conducta inmediata indicada?",
          type: "single_choice",
          options: ["Monitorización continua y examen físico", "Alta médica inmediata", "Reposo sin estudio"],
          correctAnswer: "Monitorización continua y examen físico",
          points: 100,
          feedback: "Respuesta adecuada según guía de práctica clínica."
        }]
      };

      await this.db.saveCase(targetCase);
      this.closeModals();
      this.showToast(existingId ? "Caso clínico actualizado." : "Nuevo caso clínico creado.", "success");
      await this.renderCasesView();
    });
  }
}
