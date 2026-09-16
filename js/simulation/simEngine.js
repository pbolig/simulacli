/**
 * Clinical Simulation Engine (simEngine.js)
 * Manages active clinical cases, Q&A interactive progression, scoring rubrics, and feedback generation.
 */
export class SimulationEngine {
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.activeCase = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = {}; // { questionId: answer }
    this.startTime = null;
  }

  startSimulation(caseData) {
    this.activeCase = caseData;
    this.currentQuestionIndex = 0;
    this.userAnswers = {};
    this.startTime = new Date();
    return {
      caseTitle: caseData.title,
      totalQuestions: caseData.questions ? caseData.questions.length : 0,
      firstQuestion: this.getCurrentQuestion()
    };
  }

  getCurrentQuestion() {
    if (!this.activeCase || !this.activeCase.questions) return null;
    return this.activeCase.questions[this.currentQuestionIndex] || null;
  }

  recordAnswer(questionId, answer) {
    this.userAnswers[questionId] = answer;
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.activeCase.questions.length - 1) {
      this.currentQuestionIndex++;
      return this.getCurrentQuestion();
    }
    return null; // Reached end
  }

  previousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      return this.getCurrentQuestion();
    }
    return null;
  }

  /**
   * Evaluate simulation answers and calculate score report
   */
  evaluateSimulation(currentUser) {
    if (!this.activeCase) throw new Error("No hay una simulación activa.");

    let earnedScore = 0;
    let totalPossibleScore = 0;
    const questionBreakdowns = [];

    this.activeCase.questions.forEach((q, idx) => {
      const maxPts = q.points || 25;
      totalPossibleScore += maxPts;

      const userAns = this.userAnswers[q.id];
      let isCorrect = false;
      let ptsEarned = 0;

      if (q.type === "single_choice" || q.type === "dropdown") {
        if (userAns && userAns.trim() === q.correctAnswer.trim()) {
          isCorrect = true;
          ptsEarned = maxPts;
        }
      } else if (q.type === "multiple_choice") {
        if (Array.isArray(userAns) && Array.isArray(q.correctAnswer)) {
          const sortedUser = [...userAns].sort();
          const sortedCorrect = [...q.correctAnswer].sort();
          const matches = sortedUser.length === sortedCorrect.length && sortedUser.every((val, index) => val === sortedCorrect[index]);
          if (matches) {
            isCorrect = true;
            ptsEarned = maxPts;
          } else {
            // Partial points calculation
            const correctCount = userAns.filter(item => q.correctAnswer.includes(item)).length;
            ptsEarned = Math.round((correctCount / q.correctAnswer.length) * maxPts * 0.7);
          }
        }
      } else if (q.type === "text_open") {
        if (userAns && typeof userAns === "string" && userAns.trim().length > 0) {
          const lowerUser = userAns.toLowerCase();
          if (q.keywords && Array.isArray(q.keywords)) {
            const matchedKeywords = q.keywords.filter(kw => lowerUser.includes(kw.toLowerCase()));
            const matchRatio = matchedKeywords.length / q.keywords.length;
            ptsEarned = Math.round(matchRatio * maxPts);
            if (matchRatio >= 0.4) isCorrect = true;
          } else {
            ptsEarned = Math.round(maxPts * 0.75); // General open response credit
            isCorrect = true;
          }
        }
      }

      earnedScore += ptsEarned;

      questionBreakdowns.push({
        questionNumber: idx + 1,
        questionTitle: q.title,
        questionDescription: q.description,
        userAnswer: userAns || "Sin respuesta",
        correctAnswer: q.correctAnswer,
        isCorrect,
        ptsEarned,
        maxPts,
        feedback: q.feedback || "Evaluación registrada."
      });
    });

    const finalPercentage = Math.round((earnedScore / totalPossibleScore) * 100);
    
    // Performance Grade Level
    let performanceGrade = "Requiere Revisión";
    let gradeClass = "danger";
    if (finalPercentage >= 90) {
      performanceGrade = "Sobresaliente / Excelente Manejo Clínico";
      gradeClass = "success";
    } else if (finalPercentage >= 75) {
      performanceGrade = "Buen Desempeño Clínico";
      gradeClass = "primary";
    } else if (finalPercentage >= 60) {
      performanceGrade = "Aceptable / Ajustar Criterios";
      gradeClass = "warning";
    }

    const report = {
      caseId: this.activeCase.id,
      caseTitle: this.activeCase.title,
      patientName: this.activeCase.patientName,
      patientAvatar: this.activeCase.patientAvatar,
      completionTimeSeconds: Math.round((new Date() - this.startTime) / 1000),
      earnedScore,
      totalPossibleScore,
      finalPercentage,
      performanceGrade,
      gradeClass,
      questionBreakdowns,
      evaluationSummary: this._generateSummaryText(finalPercentage, this.activeCase.title)
    };

    return report;
  }

  _generateSummaryText(percentage, caseTitle) {
    if (percentage >= 90) {
      return `Demostró un dominio técnico impecable en la resolución del caso '${caseTitle}'. Las decisiones de triaje, indicación diagnóstica y esquema farmacológico fueron tomadas con precisión óptima.`;
    }
    if (percentage >= 75) {
      return `Demostró buen criterio razonado en el manejo de '${caseTitle}'. Se sugiere profundizar en la priorización de tiempos de respuesta e interpretación fina de biomarcadores.`;
    }
    return `Se identificaron áreas de oportunidad en el abordaje de '${caseTitle}'. Se recomienda repasar los protocolos de choque, dosificación farmacológica y medidas de soporte inicial.`;
  }
}
