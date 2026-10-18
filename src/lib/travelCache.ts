export interface QuizQuestion {
  id: string;
  module: string;
  chapter: string;
  section: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface ExamResultRecord {
  id: string;
  chapter: string;
  date: string;
  score: number;
  total: number;
  percentage: number;
  mode: string;
}

const CACHE_KEY = "radiology_questions_cache";
const HISTORY_KEY = "radiology_exam_history";

export const travelCache = {
  getQuestions(): QuizQuestion[] | null {
    if (typeof window === "undefined") return null;
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : null;
  },

  saveQuestions(questions: QuizQuestion[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(questions));
  },

  getHistory(): ExamResultRecord[] {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveHistory(history: ExamResultRecord[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }
};