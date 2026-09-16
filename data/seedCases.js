/**
 * Pre-loaded Seed Clinical Cases for SimulaCli
 */
export const SEED_CASES = [
  {
    id: "case-001",
    title: "Síndrome Coronario Agudo (Dolor Torácico Infarto)",
    category: "Cardiología / Urgencias",
    difficulty: "Intermedio",
    patientName: "Roberto Gómez",
    patientAge: 58,
    patientGender: "Masculino",
    patientAvatar: "svg:patient-male-senior",
    chiefComplaint: "Dolor opresivo retroesternal irradiado a brazo izquierdo y mandíbula, sudoración fría y disnea de 45 minutos de evolución.",
    medicalHistory: "Hipertensión arterial no controlada (10 años), Tabaquismo activo (20 cigarrillos/día), Dislipidemia. Sin alergias medicamentosas conocidas.",
    vitalSigns: {
      heartRate: 110, // bpm
      bloodPressure: "160/95", // mmHg
      respiratoryRate: 24, // rpm
      oxygenSaturation: 92, // %
      temperature: 36.8 // °C
    },
    symptoms: [
      { id: "sym-101", name: "Dolor Opresivo Retroesternal", severity: "Alta", details: "Intensidad 9/10, desencadenado en reposo, no cede con cambios de postura." },
      { id: "sym-102", name: "Diaforesis Profusa", severity: "Media-Alta", details: "Piel fría y sudorosa al tacto." },
      { id: "sym-103", name: "Disnea Clase Funcional III", severity: "Media", details: "Dificultad respiratoria moderada a severa." },
      { id: "sym-104", name: "Náuseas y Sensación de Angustia", severity: "Media", details: "Sensación inminente de muerte." }
    ],
    questions: [
      {
        id: "q-101",
        title: "Evaluación Inicial y Triaje",
        description: "Al recibir al paciente en el shock room, ¿cuál es la primera conducta diagnóstica de elección a realizar en menos de 10 minutos?",
        type: "single_choice",
        options: [
          "Solicitar Radiografía de Tórax y Hemograma completo.",
          "Realizar Electrocardiograma (ECG) de 12 derivaciones inmediatamente.",
          "Administrar Analgésicos opioides e indicar reposo en cama.",
          "Solicitar Ecocardiograma Doppler transtorácico de urgencia."
        ],
        correctAnswer: "Realizar Electrocardiograma (ECG) de 12 derivaciones inmediatamente.",
        points: 25,
        feedback: "Correcto. Ante todo dolor torácico sospechoso de síndrome coronario agudo, el ECG de 12 derivaciones debe ser tomado e interpretado en los primeros 10 minutos de arribo al shock room."
      },
      {
        id: "q-102",
        title: "Terapéutica Farmacológica Inicial",
        description: "Seleccione las medidas terapéuticas iniciales indicadas para este paciente (Monitoreo y Farmacoterapia de Urgencia):",
        type: "multiple_choice",
        options: [
          "Oxigenoterapia si la saturación es < 90% o cursa con disnea severa.",
          "Antiagregación plaquetaria con Aspirina (AAS 160-325 mg masticable).",
          "Monitorización electrocardiográfica continua y acceso venoso periférico.",
          "Administración inmediata de antibióticos de amplio espectro.",
          "Nitroglicerina sublingual si la presión sistólica es mayor a 90 mmHg (y no consumió inhibidores de PDE-5)."
        ],
        correctAnswer: [
          "Oxigenoterapia si la saturación es < 90% o cursa con disnea severa.",
          "Antiagregación plaquetaria con Aspirina (AAS 160-325 mg masticable).",
          "Monitorización electrocardiográfica continua y acceso venoso periférico.",
          "Nitroglicerina sublingual si la presión sistólica es mayor a 90 mmHg (y no consumió inhibidores de PDE-5)."
        ],
        points: 25,
        feedback: "Excelente razonamiento. La mnemotecnia o esquema MONA/MANO adaptado prioriza antiagregación rápida con AAS, oxígenoterapia orientada por oximetría, nitroglicerina para el dolor y monitoreo vital constante."
      },
      {
        id: "q-103",
        title: "Biomarcadores Cardíacos",
        description: "Indique cuál es el biomarcador sérico con mayor sensibilidad y especificidad diagnóstica para confirmar la necrosis miocárdica en este escenario:",
        type: "dropdown",
        options: [
          "Troponina I o T Ultrasensible",
          "CK-MB Total",
          "Transaminasa GOT / AST",
          "Mioglobina Sérica",
          "Proteína C Reactiva Ultrasensible"
        ],
        correctAnswer: "Troponina I o T Ultrasensible",
        points: 25,
        feedback: "Correcto. Las troponinas I o T ultrasensibles son las enzimas de elección estándar de oro para el diagnóstico de infarto agudo de miocardio."
      },
      {
        id: "q-104",
        title: "Plan de Reperfusión y Conducta Médica",
        description: "Describa brevemente la estrategia de manejo definitivo (Reperfusión / Angioplastia o Fibrinolisis) y la justificación clínica del tiempo de respuesta:",
        type: "text_open",
        correctAnswer: "Angioplastia coronaria primaria (ICP) en menos de 90-120 minutos desde el primer contacto médico, o fibrinolisis en menos de 30 minutos si ICP no está disponible.",
        points: 25,
        keywords: ["angioplastia", "icp", "reperfusión", "fibrinolisis", "tiempo", "120", "90", "stent"],
        feedback: "El tiempo es miocardio. La angioplastia primaria dentro de los 90-120 min es la estrategia óptima para restaurar el flujo coronario en IAM con supradesnivel del ST."
      }
    ]
  },
  {
    id: "case-002",
    title: "Crisis Asmática Severa (Insuficiencia Respiratoria Aguda)",
    category: "Neumonología / Guardia",
    difficulty: "Principiante - Intermedio",
    patientName: "Sofía Martínez",
    patientAge: 24,
    patientGender: "Femenino",
    patientAvatar: "svg:patient-female-young",
    chiefComplaint: "Disnea súbita progresiva, tiraje intercostal y sibilancias audibles a distancia tras exposición a polvo ambiental.",
    medicalHistory: "Asma bronquial desde la infancia con uso irregular de inhaladores de corticoide. Sin antecedentes de intubación previa.",
    vitalSigns: {
      heartRate: 125, // bpm
      bloodPressure: "135/85", // mmHg
      respiratoryRate: 32, // rpm
      oxygenSaturation: 89, // %
      temperature: 36.5 // °C
    },
    symptoms: [
      { id: "sym-201", name: "Disnea y Dificultad para Hablar en Frases", severity: "Alta", details: "Imposibilidad de completar frases cortas sin pausar para respirar." },
      { id: "sym-202", name: "Uso de Músculos Accesorios y Tiraje", severity: "Alta", details: "Retracción intercostal y supraclavicular marcada." },
      { id: "sym-203", name: "Sibilancias Auscultatorias Bilaterales", severity: "Media-Alta", details: "Sibilancias en ambos campos pulmonares con prolongación de fase espiratoria." }
    ],
    questions: [
      {
        id: "q-201",
        title: "Tratamiento Broncodilatador de Primera Línea",
        description: "¿Cuál es el esquema broncodilatador de rescate primario indicado de forma inmediata?",
        type: "single_choice",
        options: [
          "Salbutamol en nebulización continua o IDM con aerocámara + Bromuro de Ipratropio.",
          "Teofilina por vía endovenosa lenta.",
          "Inhalación exclusiva de salmeterol de acción prolongada.",
          "Sedación e intubación endotraqueal inmediata sin intentar terapia médica previa."
        ],
        correctAnswer: "Salbutamol en nebulización continua o IDM con aerocámara + Bromuro de Ipratropio.",
        points: 35,
        feedback: "Correcto. Los Agonistas Beta-2 de acción corta (SABA) combinados con anticolinérgicos (Ipratropio) son el pilar del tratamiento farmacológico inicial en la crisis asmática."
      },
      {
        id: "q-202",
        title: "Uso de Corticoides Sistémicos",
        description: "¿Por qué es fundamental la administración precoz de corticoides sistémicos (ej. Hidrocortisona o Metilprednisolona EV / Prednisona VO) en esta crisis?",
        type: "dropdown",
        options: [
          "Para reducir la inflamación bronquial y prevenir recaídas tempranas en las próximas horas",
          "Para lograr un efecto broncodilatador ultra-rápido en menos de 3 minutos",
          "Para tratar una infección bacteriana agregada de forma inmediata",
          "Para sedar a la paciente y disminuir el consumo de oxígeno"
        ],
        correctAnswer: "Para reducir la inflamación bronquial y prevenir recaídas tempranas en las próximas horas",
        points: 35,
        feedback: "Correcto. Si bien tardan de 4 a 6 horas en mostrar su máximo beneficio, la administración rápida de corticoides es vital para frenar la cascada inflamatoria asmática."
      },
      {
        id: "q-203",
        title: "Signos de Alarma y Deterioro Clínico",
        description: "Describa qué hallazgo al examen físico o gases arteriales indicaría tórax silente o agotamiento muscular inminente:",
        type: "text_open",
        correctAnswer: "Desaparición de sibilancias con persistencia de tiraje (tórax silente), somnolencia, cianosis, o hipercapnia (PaCO2 normal o elevada) en la gasometría.",
        points: 30,
        keywords: ["silente", "tórax silente", "ausencia de ruidos", "hipercapnia", "somnolencia", "paco2", "agotamiento"],
        feedback: "El tórax silente es una emergencia extrema donde no hay entrada de aire audible debido a la obstrucción bronquial severa, precediendo la parada respiratoria."
      }
    ]
  },
  {
    id: "case-003",
    title: "Cetoacidosis Diabética (Descompensación Metabólica)",
    category: "Endocrinología / Terapia Intensiva",
    difficulty: "Avanzado",
    patientName: "Carlos Benítez",
    patientAge: 32,
    patientGender: "Masculino",
    patientAvatar: "svg:patient-male-adult",
    chiefComplaint: "Poliuria, polidipsia intensa, dolor abdominal difuso, náuseas, vómitos y respiración de Kussmaul.",
    medicalHistory: "Diabetes Mellitus Tipo 1 diagnosticada hace 5 años. Refiere haber suspendido la insulina basal hace 48 horas por cuadro febril viral.",
    vitalSigns: {
      heartRate: 118,
      bloodPressure: "100/60",
      respiratoryRate: 28,
      oxygenSaturation: 96,
      temperature: 37.2
    },
    symptoms: [
      { id: "sym-301", name: "Respiración de Kussmaul con Aliento Cetónico", severity: "Alta", details: "Respiración profunda y rápida con olor a manzana o cetoacetona." },
      { id: "sym-302", name: "Deshidratación Severa y Signo del Pliegue", severity: "Alta", details: "Mucosas secas, hipotensión ortostática y oliguria." },
      { id: "sym-303", name: "Dolor Abdominal Agudo Difuso", severity: "Media-Alta", details: "Dolor referido secundario a la acidosis metabólica y distensión gástrica." }
    ],
    questions: [
      {
        id: "q-301",
        title: "Prioridad Diagnóstica y Criterios",
        description: "Marque el trío de hallazgos analíticos característicos de la Cetoacidosis Diabética (CAD):",
        type: "single_choice",
        options: [
          "Glucemia > 250 mg/dL, pH arterial < 7.30 / Bicarbonato < 18 mEq/L, y Cetonemia/Cetonuria positiva.",
          "Glucemia > 600 mg/dL, pH arterial > 7.30 y Osmolaridad > 320 mOsm/kg.",
          "Glucemia normal, Lactato elevado y Alcalosis respiratoria pura.",
          "Hipoglucemia < 50 mg/dL, Cetonuria negativa e Hipernatremia."
        ],
        correctAnswer: "Glucemia > 250 mg/dL, pH arterial < 7.30 / Bicarbonato < 18 mEq/L, y Cetonemia/Cetonuria positiva.",
        points: 33,
        feedback: "Correcto. La triada clásica de la CAD es hiperglucemia, acidosis metabólica con anion gap aumentado y cetosis."
      },
      {
        id: "q-302",
        title: "Manejo del Potasio antes de la Insulinoterapia",
        description: "¿Cuál es la regla fundamental con respecto al nivel de potasio sérico (K+) antes de iniciar la infusión continua de insulina EV?",
        type: "dropdown",
        options: [
          "Verificar K+ > 3.3 mEq/L; si es menor a 3.3 mEq/L, se debe reponer potasio primero y diferir la insulina",
          "Iniciar insulina siempre sin importar el nivel de potasio",
          "Administrar insulina junto con un bolo masivo de cloruro de potasio en todos los casos",
          "Indicar diuréticos de asa para forzar la excreción de potasio"
        ],
        correctAnswer: "Verificar K+ > 3.3 mEq/L; si es menor a 3.3 mEq/L, se debe reponer potasio primero y diferir la insulina",
        points: 33,
        feedback: "Correcto. La insulina desplaza el potasio al espacio intracelular. Iniciar insulina con K < 3.3 mEq/L puede desencadenar arritmias cardíacas letales o paro cardíaco."
      },
      {
        id: "q-303",
        title: "Líquidos de Reanimación Inicial",
        description: "¿Cuál es la solución hidroelectrolítica de primera línea para la reexpansión de volumen inicial en las primeras 1-2 horas?",
        type: "single_choice",
        options: [
          "Solución Fisiológica (NaCl 0.9%) a 1000-1500 ml/hora.",
          "Solución Dextrosa al 5% con Insulina.",
          "Agua destilada pura endovenosa.",
          "Solución Salina Hipertónica al 3%."
        ],
        correctAnswer: "Solución Fisiológica (NaCl 0.9%) a 1000-1500 ml/hora.",
        points: 34,
        feedback: "Correcto. La restitución inicial de volumen con solución salina al 0.9% restablece la perfusión tisular y la filtración renal."
      }
    ]
  }
];
