"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

const PDFReader = dynamic(() => import("../components/PDFReader"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-20 text-center">
      <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
      <p className="animate-pulse font-medium text-slate-500">Opening your book...</p>
    </div>
  ),
});

const RADIOLOGY_CURRICULUM = [
  { id: "Chapter 1", title: "The skull and brain" },
  { id: "Chapter 2", title: "The orbit and visual pathway" },
  { id: "Chapter 3", title: "The petrous temporal bone" },
  { id: "Chapter 4", title: "The extracranial head and neck" },
  { id: "Chapter 5", title: "The vertebral column and spinal cord" },
  { id: "Chapter 6", title: "The chest" },
  { id: "Chapter 7", title: "The heart and great vessels" },
  { id: "Chapter 8", title: "The breast" },
  { id: "Chapter 9", title: "The anterior abdominal wall and peritoneum" },
  { id: "Chapter 10", title: "The abdomen and retroperitoneum" },
  { id: "Chapter 11", title: "The gastrointestinal tract" },
  { id: "Chapter 12", title: "The kidney and adrenal gland" },
  { id: "Chapter 13", title: "The male pelvis" },
  { id: "Chapter 14", title: "The female pelvis" },
  { id: "Chapter 15", title: "The upper limb" },
  { id: "Chapter 16", title: "The lower limb" },
  { id: "Chapter 17", title: "Obstetrical imaging" },
] as const;

const MODALITIES = ["CT", "MRI", "Radiograph", "Ultrasound", "Angiography", "General"] as const;

interface QuizQuestion {
  id: string;
  module: string;
  chapter: string;
  section: string;
  modalities: string[];
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

type MainTab = "reader" | "quiz" | "mistakes" | "stats";
type AppMode = "selector" | "active" | "results";
type TestFeedbackMode = "timed" | "instant";

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

function getQuestionArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];

  // Supports the schemas used by the generated chapter banks:
  // { questions: [...] }, { questionBank: [...] }, { chapters: [{ questions: [...] }] }
  if (Array.isArray(data.questions)) return data.questions;
  if (Array.isArray(data.questionBank)) return data.questionBank;

  if (Array.isArray(data.chapters)) {
    return data.chapters.flatMap((chapter: any) => {
      if (Array.isArray(chapter?.questions)) return chapter.questions;
      if (Array.isArray(chapter?.questionBank)) return chapter.questionBank;
      return [];
    });
  }

  return [];
}

function normalizeQuestion(item: any, index: number): QuizQuestion | null {
  if (!item || typeof item !== "object") return null;

  const chapterSource = String(
    item.chapterId ?? item.chapterNumber ?? item.chapter ?? item.module ?? "Chapter 1"
  );
  const chapterMatch = chapterSource.match(/\d+/) ?? String(item.module ?? "").match(/\d+/);
  const chapterNumber = chapterMatch ? Number.parseInt(chapterMatch[0], 10) : 1;
  const curriculumChapter = RADIOLOGY_CURRICULUM.find((chapter) => chapter.id === `Chapter ${chapterNumber}`);
  const chapterTitle = String(
    item.chapterTitle ?? item.chapterName ?? item.title ?? curriculumChapter?.title ?? item.chapter ?? "General Anatomy"
  );
  const chapterId = `Chapter ${chapterNumber}`;

  let sectionTitle = String(item.section ?? item.topic ?? item.subtopic ?? "");
  if (!sectionTitle && item.module && String(item.module).includes(" - ")) {
    sectionTitle = String(item.module).split(" - ").slice(1).join(" - ").trim();
  }
  if (!sectionTitle || /^chapter\s*\d+$/i.test(sectionTitle)) sectionTitle = chapterTitle;

  const rawOptions = Array.isArray(item.options) ? item.options : [];
  const normalizedOptions = rawOptions
    .map((option: any, optionIndex: number) => {
      if (typeof option === "string") {
        return { label: String.fromCharCode(65 + optionIndex), text: option };
      }
      const label = String(
        option?.label ?? option?.optionId ?? option?.letter ?? option?.key ?? String.fromCharCode(65 + optionIndex)
      ).trim();
      const text = String(option?.text ?? option?.value ?? option?.answer ?? "").trim();
      return { label, text };
    })
    .filter((option: { label: string; text: string }) => option.text.length > 0)
    .sort((a: { label: string; text: string }, b: { label: string; text: string }) => {
      const order = (label: string) => {
        const first = label.trim().toUpperCase().replace(/[^A-Z]/g, "").charAt(0);
        const n = first ? first.charCodeAt(0) - 65 : 999;
        return n >= 0 && n < 26 ? n : 999;
      };
      return order(a.label) - order(b.label);
    });

  const options = normalizedOptions.map((option: { label: string; text: string }) => option.text);
  const rawCorrect = item.correctAnswer ?? item.answer ?? item.correct_option ?? "";
  let correctAnswer = "";

  if (rawCorrect && typeof rawCorrect === "object") {
    correctAnswer = String(rawCorrect.text ?? rawCorrect.value ?? "");
    if (!correctAnswer) {
      const answerLabel = String(
        rawCorrect.optionId ?? rawCorrect.label ?? rawCorrect.letter ?? rawCorrect.key ?? ""
      ).trim().toUpperCase();
      correctAnswer =
        normalizedOptions.find((option: { label: string; text: string }) =>
          option.label.trim().toUpperCase() === answerLabel
        )?.text ?? "";
    }
  } else {
    const answerValue = String(rawCorrect).trim();
    const answerLabel = String(item.answerLabel ?? item.correctOption ?? answerValue).trim().toUpperCase();
    const labelMatch = normalizedOptions.find((option: { label: string; text: string }) =>
      option.label.trim().toUpperCase() === answerLabel
    );
    const textMatch = normalizedOptions.find((option: { label: string; text: string }) =>
      option.text.trim() === answerValue
    );
    correctAnswer = textMatch?.text ?? labelMatch?.text ?? answerValue;
  }

  const questionText = String(item.question ?? item.questionText ?? item.stem ?? "").trim();
  const explanation = String(item.explanation ?? item.rationale ?? item.answerExplanation ?? "").trim();
  if (!questionText || options.length < 2 || !correctAnswer || !options.includes(correctAnswer)) return null;

  const searchableText = `${questionText} ${explanation} ${sectionTitle} ${item.topic ?? ""}`.toLowerCase();
  const detectedModalities: string[] = [];
  if (/\bct\b|computed tomography/i.test(searchableText)) detectedModalities.push("CT");
  if (/\bmri\b|magnetic resonance|\bt1\b|\bt2\b/i.test(searchableText)) detectedModalities.push("MRI");
  if (/\bradiograph\b|x-ray|plain film|radiography/i.test(searchableText)) detectedModalities.push("Radiograph");
  if (/\bultrasound\b|sonograph|echograph/i.test(searchableText)) detectedModalities.push("Ultrasound");
  if (/\bangiograph|angiography/i.test(searchableText)) detectedModalities.push("Angiography");
  if (detectedModalities.length === 0) detectedModalities.push("General");

  const sourceId = String(item.questionId ?? item.id ?? `item${index + 1}`);

  return {
    id: `q-chapter${chapterNumber}-${sourceId}`,
    module: `Chapter ${chapterNumber}: ${chapterTitle}`,
    chapter: chapterId,
    section: sectionTitle,
    modalities: detectedModalities,
    question: questionText,
    options,
    correctAnswer,
    explanation: explanation || "No explanation was supplied for this question.",
  };
}

export default function StudyApp() {
  const [activeTab, setActiveTab] = useState<MainTab>("quiz");
  const [alertDialog, setAlertDialog] = useState<{ title: string; msg: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; msg: string; action: () => void } | null>(null);

  const [rawQuestions, setRawQuestions] = useState<QuizQuestion[]>([]);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [quizLoadError, setQuizLoadError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  const [mistakeIds, setMistakeIds] = useState<Set<string>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [userStats, setUserStats] = useState({ attempted: 0, correct: 0 });
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [selectedChapterId, setSelectedChapterId] = useState<string>("Chapter 17");
  const [sectionsList, setSectionsList] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
  const [feedbackMode, setFeedbackMode] = useState<TestFeedbackMode>("timed");

  const [appMode, setAppMode] = useState<AppMode>("selector");
  const [activeTestQuestions, setActiveTestQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const userAnswersRef = useRef<Record<string, string>>({});
  const hasFinishedRef = useRef(false);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(7200);

  const loadQuiz = useCallback(async () => {
    if (rawQuestions.length > 0 || isLoadingQuiz || hasAttemptedLoad) return;

    setIsLoadingQuiz(true);
    setQuizLoadError(null);

    try {
      const response = await fetch("/manual-questions.json", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Could not fetch /manual-questions.json (HTTP ${response.status}). Make sure the file is located at public/manual-questions.json.`
        );
      }

      const data: unknown = await response.json();
      const questionArray = getQuestionArray(data);
      if (questionArray.length === 0) {
        throw new Error(
          "The imported JSON contains no questions. Supported formats are a top-level array, { questions: [...] }, { questionBank: [...] }, or { chapters: [{ questions: [...] }] }."
        );
      }

      const loaded = questionArray
        .map((item: any, index: number) => normalizeQuestion(item, index))
        .filter((question: QuizQuestion | null): question is QuizQuestion => question !== null);

      if (loaded.length === 0) {
        throw new Error(
          `Found ${questionArray.length} question records, but none had a question, at least two options, and a correct answer matching one of the options. Check the JSON schema.`
        );
      }

      setRawQuestions(loaded);
      setHasAttemptedLoad(true);

      const chaptersPresent = new Set(loaded.map((question) => question.chapter));
      if (!chaptersPresent.has(selectedChapterId)) {
        const firstAvailable = loaded[0]?.chapter;
        if (firstAvailable) setSelectedChapterId(firstAvailable);
      }
    } catch (error) {
      console.error("Error loading question bank:", error);
      setQuizLoadError(error instanceof Error ? error.message : "An unknown error occurred while loading the question bank.");
      setHasAttemptedLoad(true);
    } finally {
      setIsLoadingQuiz(false);
    }
  }, [rawQuestions.length, isLoadingQuiz, hasAttemptedLoad, selectedChapterId]);

  useEffect(() => {
    try {
      const savedMistakes = localStorage.getItem("rad_mistakes");
      if (savedMistakes) setMistakeIds(new Set(JSON.parse(savedMistakes)));

      const savedBookmarks = localStorage.getItem("rad_bookmarks");
      if (savedBookmarks) setBookmarkedIds(new Set(JSON.parse(savedBookmarks)));

      const savedStats = localStorage.getItem("rad_stats");
      if (savedStats) {
        const parsed = JSON.parse(savedStats);
        setUserStats({
          attempted: Number(parsed?.attempted) || 0,
          correct: Number(parsed?.correct) || 0,
        });
      }
    } catch (error) {
      console.error("Could not restore saved study data:", error);
    } finally {
      setIsDataLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isDataLoaded) return;
    localStorage.setItem("rad_mistakes", JSON.stringify(Array.from(mistakeIds)));
    localStorage.setItem("rad_bookmarks", JSON.stringify(Array.from(bookmarkedIds)));
    localStorage.setItem("rad_stats", JSON.stringify(userStats));
  }, [mistakeIds, bookmarkedIds, userStats, isDataLoaded]);

  useEffect(() => {
    if (activeTab === "quiz" || activeTab === "mistakes" || activeTab === "stats") loadQuiz();
  }, [activeTab, loadQuiz]);

  useEffect(() => {
    const chapterSections = Array.from(
      new Set(rawQuestions.filter((question) => question.chapter === selectedChapterId).map((question) => question.section))
    ).sort((a, b) => a.localeCompare(b));

    setSectionsList(chapterSections);
    setSelectedSections(chapterSections);
  }, [selectedChapterId, rawQuestions]);

  const finishExam = useCallback(() => {
    if (hasFinishedRef.current || activeTestQuestions.length === 0) return;
    hasFinishedRef.current = true;
    setAppMode("results");

    const currentAnswers = userAnswersRef.current;
    let sessionCorrect = 0;
    let sessionAttempted = 0;

    setMistakeIds((previous) => {
      const next = new Set(previous);
      activeTestQuestions.forEach((question) => {
        const answer = currentAnswers[question.id];
        if (!answer) return;
        if (answer === question.correctAnswer) next.delete(question.id);
        else next.add(question.id);
      });
      return next;
    });

    activeTestQuestions.forEach((question) => {
      const answer = currentAnswers[question.id];
      if (!answer) return;
      sessionAttempted += 1;
      if (answer === question.correctAnswer) sessionCorrect += 1;
    });

    setUserStats((previous) => ({
      attempted: previous.attempted + sessionAttempted,
      correct: previous.correct + sessionCorrect,
    }));
  }, [activeTestQuestions]);

  useEffect(() => {
    if (appMode !== "active" || feedbackMode !== "timed") return;
    if (timeLeft <= 0) {
      finishExam();
      return;
    }
    const timer = window.setInterval(() => setTimeLeft((previous) => Math.max(0, previous - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [appMode, feedbackMode, timeLeft, finishExam]);

  const formatTimer = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hours > 0
      ? `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      : `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleSection = (section: string) => {
    setSelectedSections((previous) =>
      previous.includes(section) ? previous.filter((item) => item !== section) : [...previous, section]
    );
  };

  const toggleModality = (modality: string) => {
    setSelectedModalities((previous) =>
      previous.includes(modality) ? previous.filter((item) => item !== modality) : [...previous, modality]
    );
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startExamWithQuestions = (questions: QuizQuestion[], mode: TestFeedbackMode) => {
    if (questions.length === 0) {
      setAlertDialog({ title: "No Questions Found", msg: "No questions are available for this selection." });
      return;
    }
    hasFinishedRef.current = false;
    setActiveTestQuestions(shuffleArray(questions));
    setFeedbackMode(mode);
    setCurrentQuizIndex(0);
    setUserAnswers({});
    userAnswersRef.current = {};
    setSelectedAnswer(null);
    setTimeLeft(7200);
    setAppMode("active");
    setActiveTab("quiz");
  };

  const handleStartExam = () => {
    const filtered = rawQuestions.filter(
      (question) =>
        question.chapter === selectedChapterId &&
        selectedSections.includes(question.section) &&
        (selectedModalities.length === 0 || question.modalities.some((modality) => selectedModalities.includes(modality)))
    );

    if (filtered.length === 0) {
      setAlertDialog({
        title: "No Questions Found",
        msg: "No questions match this chapter, section, and modality selection. Try selecting all sections or clearing the modality filters.",
      });
      return;
    }
    startExamWithQuestions(filtered, feedbackMode);
  };

  const handleDrillList = (ids: Set<string>, emptyMessage: string) => {
    const questionsToDrill = rawQuestions.filter((question) => ids.has(question.id));
    if (questionsToDrill.length === 0) {
      setAlertDialog({ title: "All Caught Up!", msg: emptyMessage });
      return;
    }
    startExamWithQuestions(questionsToDrill, "instant");
  };

  const handleAnswerClick = (option: string) => {
    const question = activeTestQuestions[currentQuizIndex];
    if (!question || (feedbackMode === "instant" && selectedAnswer !== null)) return;

    setUserAnswers((previous) => {
      const next = { ...previous, [question.id]: option };
      userAnswersRef.current = next;
      return next;
    });
    setSelectedAnswer(option);
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    if (currentQuizIndex < activeTestQuestions.length - 1) {
      setCurrentQuizIndex((previous) => previous + 1);
    } else {
      finishExam();
    }
  };

  const availableChapterIds = useMemo(
    () => Array.from(new Set(rawQuestions.map((question) => question.chapter))).sort(
      (a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""))
    ),
    [rawQuestions]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-indigo-50 p-4 font-sans text-slate-900 selection:bg-blue-200 md:p-8">
      {alertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-in zoom-in-95 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-xl font-bold text-slate-800">{alertDialog.title}</h3>
            <p className="mb-6 leading-relaxed text-slate-500">{alertDialog.msg}</p>
            <button onClick={() => setAlertDialog(null)} className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-500">Got it</button>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-in zoom-in-95 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-xl font-bold text-slate-800">{confirmDialog.title}</h3>
            <p className="mb-6 leading-relaxed text-slate-500">{confirmDialog.msg}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 rounded-xl bg-slate-100 py-3 font-bold text-slate-700 hover:bg-slate-200">Cancel</button>
              <button onClick={() => { confirmDialog.action(); setConfirmDialog(null); }} className="flex-1 rounded-xl bg-rose-600 py-3 font-bold text-white shadow-md hover:bg-rose-500">Confirm</button>
            </div>
          </div>
        </div>
      )}

      <header className="mx-auto mb-8 flex max-w-5xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
        <div>
          <h1 className="bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text pb-1 text-4xl font-extrabold tracking-tight text-transparent md:text-5xl">
            Applied Radiological Anatomy
          </h1>
          <p className="mt-2 text-lg font-medium text-slate-500">Interactive Study &amp; Exam Suite</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl">
        <div className="mb-6 flex justify-center md:justify-start">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-white bg-white/60 p-1.5 shadow-sm backdrop-blur-xl">
            <button onClick={() => setActiveTab("reader")} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${activeTab === "reader" ? "border border-slate-100 bg-white text-blue-700 shadow-md" : "text-slate-500 hover:bg-white/50 hover:text-slate-800"}`}>📖 Book Reader</button>
            <button onClick={() => { setActiveTab("quiz"); setAppMode("selector"); }} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${activeTab === "quiz" ? "border border-slate-100 bg-white text-blue-700 shadow-md" : "text-slate-500 hover:bg-white/50 hover:text-slate-800"}`}>📝 Practice</button>
            <button onClick={() => { setActiveTab("mistakes"); setAppMode("selector"); }} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${activeTab === "mistakes" ? "border border-slate-100 bg-white text-rose-600 shadow-md" : "text-slate-500 hover:bg-white/50 hover:text-slate-800"}`}>
              ⚠️ Review
              {(mistakeIds.size > 0 || bookmarkedIds.size > 0) && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">{mistakeIds.size + bookmarkedIds.size}</span>}
            </button>
            <button onClick={() => { setActiveTab("stats"); setAppMode("selector"); }} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${activeTab === "stats" ? "border border-slate-100 bg-white text-indigo-700 shadow-md" : "text-slate-500 hover:bg-white/50 hover:text-slate-800"}`}>📊 Stats</button>
          </div>
        </div>

        <div className="relative flex min-h-[650px] flex-col overflow-hidden rounded-[2rem] border border-white bg-white/70 p-6 shadow-2xl backdrop-blur-2xl md:p-10">
          {activeTab === "reader" && <div className="relative z-10 w-full animate-in slide-in-from-bottom-4"><PDFReader /></div>}

          {activeTab === "mistakes" && (
            <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col animate-in fade-in">
              <h2 className="mb-2 text-3xl font-extrabold text-slate-800">Review &amp; Weak Areas</h2>
              <p className="mb-8 text-slate-500">Drill missed questions and revise saved anatomical landmarks. Mistakes are logged at the end of each exam.</p>
              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex h-full flex-col items-start justify-between rounded-2xl border border-rose-100 bg-rose-50/50 p-6 shadow-sm">
                  <div className="mb-4 flex w-full items-center justify-between">
                    <div><p className="mb-1 text-sm font-bold uppercase tracking-wider text-rose-500">Unresolved Mistakes</p><p className="text-4xl font-black text-rose-600">{mistakeIds.size}</p></div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-2xl text-rose-500 shadow-inner">⚠️</div>
                  </div>
                  <button onClick={() => handleDrillList(mistakeIds, "No active mistakes to drill! Great job.")} disabled={mistakeIds.size === 0} className="w-full rounded-xl bg-rose-600 py-3 font-bold text-white transition-all hover:bg-rose-500 disabled:opacity-50">Drill Mistakes</button>
                </div>
                <div className="flex h-full flex-col items-start justify-between rounded-2xl border border-amber-100 bg-amber-50/50 p-6 shadow-sm">
                  <div className="mb-4 flex w-full items-center justify-between">
                    <div><p className="mb-1 text-sm font-bold uppercase tracking-wider text-amber-600">Saved Bookmarks</p><p className="text-4xl font-black text-amber-600">{bookmarkedIds.size}</p></div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl text-amber-500 shadow-inner">★</div>
                  </div>
                  <button onClick={() => handleDrillList(bookmarkedIds, "No bookmarked questions saved yet. Use the star during a question to save it.")} disabled={bookmarkedIds.size === 0} className="w-full rounded-xl bg-amber-500 py-3 font-bold text-white transition-all hover:bg-amber-400 disabled:opacity-50">Review Bookmarks</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "stats" && (
            <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col animate-in fade-in">
              <h2 className="mb-2 text-3xl font-extrabold text-slate-800">Performance Analytics</h2>
              <p className="mb-8 text-slate-500">Track your practice history and overall question-bank performance.</p>
              <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm"><p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Attempted</p><p className="mt-auto text-3xl font-black text-slate-800">{userStats.attempted}</p></div>
                <div className="flex flex-col rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 shadow-sm"><p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-600/70">Correct</p><p className="mt-auto text-3xl font-black text-emerald-600">{userStats.correct}</p></div>
                <div className="col-span-2 flex flex-col rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6 shadow-sm md:col-span-1"><p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-600/70">Accuracy</p><div className="mt-auto"><p className="mb-2 text-3xl font-black text-indigo-600">{userStats.attempted ? Math.round((userStats.correct / userStats.attempted) * 100) : 0}%</p><div className="h-2 w-full rounded-full bg-indigo-200/50"><div className="h-2 rounded-full bg-indigo-600 transition-all duration-1000" style={{ width: `${userStats.attempted ? Math.round((userStats.correct / userStats.attempted) * 100) : 0}%` }} /></div></div></div>
                <div className="col-span-2 flex flex-col rounded-2xl border border-rose-100 bg-rose-50/50 p-6 shadow-sm md:col-span-1"><p className="mb-1 text-xs font-bold uppercase tracking-wider text-rose-600/70">Weak Areas</p><div className="mt-auto flex items-end justify-between"><p className="text-3xl font-black text-rose-600">{mistakeIds.size}</p><span className="mb-1 text-sm font-semibold text-rose-400">active mistakes</span></div></div>
              </div>
              <div className="mt-auto flex max-w-sm flex-col gap-3">
                <button onClick={() => setConfirmDialog({ title: "Clear Data", msg: "Permanently clear your study history, stats, bookmarks, and mistakes? This cannot be undone.", action: () => { setMistakeIds(new Set()); setBookmarkedIds(new Set()); setUserStats({ attempted: 0, correct: 0 }); } })} className="rounded-xl border-2 border-rose-100 py-3 font-bold text-rose-500 transition-colors hover:bg-rose-50">↺ Clear Data &amp; Start Over</button>
              </div>
            </div>
          )}

          {activeTab === "quiz" && (
            <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-grow flex-col">
              {appMode === "selector" && (
                <div className="animate-in fade-in">
                  <h2 className="mb-1 text-2xl font-bold text-slate-800">Configure Your Test</h2>
                  <p className="mb-6 text-sm text-slate-500">Choose a chapter, then refine the section and modality filters.</p>

                  {isLoadingQuiz ? (
                    <div className="flex flex-col items-center justify-center py-24"><div className="mb-3 h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" /><p className="font-medium text-slate-500">Loading question bank...</p></div>
                  ) : quizLoadError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
                      <h3 className="mb-2 font-bold">Question bank could not be loaded</h3>
                      <p className="text-sm leading-relaxed">{quizLoadError}</p>
                      <p className="mt-3 text-xs text-rose-700">Check that the imported JSON file exists beside this page and contains the questions array in one of the supported formats.</p>
                      <button onClick={() => { setHasAttemptedLoad(false); setQuizLoadError(null); }} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700">Try again</button>
                    </div>
                  ) : rawQuestions.length > 0 ? (
                    <div className="space-y-6">
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Select Chapter (Module)</label>
                        <select value={selectedChapterId} onChange={(event) => setSelectedChapterId(event.target.value)} className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500">
                          {RADIOLOGY_CURRICULUM.filter((chapter) => availableChapterIds.includes(chapter.id)).map((chapter) => {
                            const count = rawQuestions.filter((question) => question.chapter === chapter.id).length;
                            return <option key={chapter.id} value={chapter.id}>{chapter.id}: {chapter.title} ({count} questions)</option>;
                          })}
                          {availableChapterIds.filter((id) => !RADIOLOGY_CURRICULUM.some((chapter) => chapter.id === id)).map((id) => <option key={id} value={id}>{id} ({rawQuestions.filter((question) => question.chapter === id).length} questions)</option>)}
                        </select>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Sections ({selectedSections.length} of {sectionsList.length} selected)</label>
                          <div className="space-x-3 text-xs font-semibold"><button onClick={() => setSelectedSections(sectionsList)} className="text-indigo-600 hover:underline">Select All</button><button onClick={() => setSelectedSections([])} className="text-slate-400 hover:underline">Clear</button></div>
                        </div>
                        <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-inner sm:grid-cols-2">
                          {sectionsList.map((section) => {
                            const checked = selectedSections.includes(section);
                            const count = rawQuestions.filter((question) => question.chapter === selectedChapterId && question.section === section).length;
                            return <label key={section} className={`flex cursor-pointer items-center justify-between rounded-xl border p-2.5 text-xs transition ${checked ? "border-indigo-200 bg-indigo-50/60 font-semibold text-indigo-950 shadow-sm" : "border-slate-200 bg-white text-slate-500"}`}><span className="flex min-w-0 items-center space-x-2 pr-2"><input type="checkbox" checked={checked} onChange={() => toggleSection(section)} className="h-4 w-4 rounded text-indigo-600" /><span className="truncate">{section}</span></span><span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-600">{count}</span></label>;
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Filter by Modality</label>
                        <div className="flex flex-wrap gap-2">
                          {MODALITIES.map((modality) => {
                            const selected = selectedModalities.includes(modality);
                            return <button key={modality} onClick={() => toggleModality(modality)} className={`rounded-xl border px-4 py-2 text-xs font-bold transition-colors ${selected ? "border-indigo-700 bg-indigo-600 text-white shadow-md" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>{modality}</button>;
                          })}
                          {selectedModalities.length === 0 && <span className="px-4 py-2 text-xs font-medium text-slate-400">All modalities included</span>}
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Test Mode</label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <button type="button" onClick={() => setFeedbackMode("timed")} className={`rounded-2xl border-2 p-4 text-left transition ${feedbackMode === "timed" ? "border-indigo-600 bg-indigo-50/30 shadow-md" : "border-slate-200 bg-white hover:border-slate-300"}`}><div className="mb-1 text-sm font-bold text-slate-800">⏱️ 120-Min Timed Exam</div><p className="text-xs leading-relaxed text-slate-500">Two-hour countdown. Feedback and scoring appear after submission.</p></button>
                          <button type="button" onClick={() => setFeedbackMode("instant")} className={`rounded-2xl border-2 p-4 text-left transition ${feedbackMode === "instant" ? "border-indigo-600 bg-indigo-50/30 shadow-md" : "border-slate-200 bg-white hover:border-slate-300"}`}><div className="mb-1 text-sm font-bold text-slate-800">⚡ Instant Answer Mode</div><p className="text-xs leading-relaxed text-slate-500">See the answer explanation immediately after choosing an option.</p></button>
                        </div>
                      </div>

                      <button onClick={handleStartExam} disabled={selectedSections.length === 0} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-4 text-lg font-bold text-white shadow-lg transition-all hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50">Start Test →</button>
                      <p className="text-center text-xs text-slate-400">{rawQuestions.length} valid questions loaded from the imported JSON.</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">No valid questions are available in the imported JSON file.</div>
                  )}
                </div>
              )}

              {appMode === "active" && activeTestQuestions.length > 0 && (
                <div className="flex flex-grow flex-col animate-in fade-in">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <div><span className="block text-xs font-bold uppercase tracking-wider text-indigo-600">{activeTestQuestions[currentQuizIndex]?.chapter}</span><span className="text-sm font-semibold text-slate-700">Question {currentQuizIndex + 1} of {activeTestQuestions.length}</span></div>
                    <div className="flex items-center gap-3">
                      {feedbackMode === "timed" && <div className={`flex items-center gap-2 rounded-xl px-4 py-1.5 font-mono text-sm font-bold ${timeLeft < 300 ? "animate-pulse bg-rose-100 text-rose-700" : "border border-slate-200 bg-white text-slate-700 shadow-sm"}`}>⏱️ {formatTimer(timeLeft)}</div>}
                      <button onClick={finishExam} className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100">Submit Exam</button>
                    </div>
                  </div>

                  {(() => {
                    const question = activeTestQuestions[currentQuizIndex];
                    if (!question) return null;
                    return <div className="relative flex flex-grow flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-xl md:p-8">
                      <button onClick={() => toggleBookmark(question.id)} title="Bookmark this question" aria-label="Bookmark this question" className="absolute right-6 top-6 text-3xl transition-transform hover:scale-110">{bookmarkedIds.has(question.id) ? <span className="text-amber-400 drop-shadow-sm">★</span> : <span className="text-slate-300 hover:text-amber-300">☆</span>}</button>
                      <div className="mb-3 inline-block self-start rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">{question.section}</div>
                      <div className="mb-4 flex flex-wrap gap-2">{question.modalities.map((modality) => <span key={modality} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{modality}</span>)}</div>
                      <p className="mb-6 pr-8 text-xl font-medium leading-relaxed text-slate-800 md:text-2xl">{question.question}</p>
                      <div className="mb-6 flex flex-col gap-3">
                        {question.options.map((option, index) => {
                          const chosen = selectedAnswer === option;
                          const correct = option === question.correctAnswer;
                          let style = "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50";
                          if (feedbackMode === "instant" && selectedAnswer !== null) {
                            if (correct) style = "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-md ring-1 ring-emerald-500";
                            else if (chosen) style = "border-rose-500 bg-rose-50 text-rose-800 shadow-md ring-1 ring-rose-500";
                            else style = "border-slate-200 bg-slate-50 text-slate-400 opacity-50";
                          } else if (chosen) style = "border-indigo-500 bg-indigo-50 font-bold text-indigo-950 ring-1 ring-indigo-500";
                          return <button key={`${question.id}-option-${index}`} disabled={feedbackMode === "instant" && selectedAnswer !== null} onClick={() => handleAnswerClick(option)} className={`w-full rounded-2xl border-2 p-4 text-left text-lg font-medium transition-all ${style}`}><span className="mr-2 font-bold text-indigo-500">{String.fromCharCode(65 + index)}.</span>{option}</button>;
                        })}
                      </div>

                      {feedbackMode === "instant" && selectedAnswer !== null && <div className="mb-6 animate-in fade-in"><div className={`rounded-2xl border-2 p-4 shadow-sm ${selectedAnswer === question.correctAnswer ? "border-emerald-100 bg-emerald-50 text-emerald-900" : "border-rose-100 bg-rose-50 text-rose-900"}`}><div className="mb-1 flex items-center gap-2 text-lg font-bold">{selectedAnswer === question.correctAnswer ? "🎯 Correct!" : "❌ Incorrect"}</div><p className="mt-2 border-t border-slate-200/60 pt-2 text-sm leading-relaxed text-slate-700"><strong>Explanation: </strong>{question.explanation}</p></div></div>}
                      <button onClick={handleNextQuestion} disabled={selectedAnswer === null && feedbackMode === "instant"} className="mt-auto w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-4 text-xl font-bold text-white shadow-lg transition-all hover:from-indigo-700 hover:to-blue-700 disabled:opacity-40">{currentQuizIndex < activeTestQuestions.length - 1 ? "Next Question →" : "Submit Exam ✓"}</button>
                    </div>;
                  })()}
                </div>
              )}

              {appMode === "results" && (
                <div className="w-full animate-in fade-in">
                  {(() => {
                    const correctCount = activeTestQuestions.reduce((total, question) => total + (userAnswers[question.id] === question.correctAnswer ? 1 : 0), 0);
                    const percentage = activeTestQuestions.length ? Math.round((correctCount / activeTestQuestions.length) * 100) : 0;
                    return <div className="flex flex-col items-center">
                      <div className="mb-8 w-full rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center shadow-sm">
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-600">Exam Complete</span>
                        <h2 className="mb-2 mt-3 text-4xl font-black text-slate-800">{percentage}% Score</h2>
                        <p className="text-lg font-medium text-slate-600">You answered <strong className="text-indigo-600">{correctCount}</strong> out of <strong>{activeTestQuestions.length}</strong> questions correctly.</p>
                        <div className="mt-6 flex justify-center gap-3"><button onClick={() => setAppMode("selector")} className="rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-md transition hover:bg-indigo-700">Configure New Test</button></div>
                      </div>
                      <div className="w-full space-y-4">
                        <h3 className="mb-4 text-xl font-bold text-slate-800">Detailed Review &amp; Explanations</h3>
                        {activeTestQuestions.map((question, index) => {
                          const answer = userAnswers[question.id];
                          const isRight = answer === question.correctAnswer;
                          return <div key={question.id} className={`relative rounded-3xl border-2 p-6 shadow-sm ${isRight ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"}`}>
                            <button onClick={() => toggleBookmark(question.id)} aria-label="Bookmark question" className="absolute right-5 top-5 text-2xl transition-transform hover:scale-110">{bookmarkedIds.has(question.id) ? <span className="text-amber-400">★</span> : <span className="text-slate-400 hover:text-amber-300">☆</span>}</button>
                            <div className="mb-2 flex items-center justify-between pr-8"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">Q{index + 1} — {question.section}</span><span className={`rounded-full px-3 py-1 text-xs font-extrabold ${isRight ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{isRight ? "✓ Correct" : answer ? "✗ Incorrect" : "Unanswered"}</span></div>
                            <p className="mb-3 text-lg font-semibold text-slate-800">{question.question}</p>
                            <div className="mb-4 space-y-1 text-sm"><p className="text-slate-600">Your Answer: <strong className={isRight ? "text-emerald-700" : "text-rose-600"}>{answer || "None"}</strong></p>{!isRight && <p className="text-slate-600">Correct Answer: <strong className="text-emerald-700">{question.correctAnswer}</strong></p>}</div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700"><strong className="mb-1 block text-slate-900">Explanation:</strong>{question.explanation}</div>
                          </div>;
                        })}
                      </div>
                    </div>;
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
