"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

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

const MODALITIES = ["CT", "MRI", "Radiograph", "Ultrasound", "Angiography", "General"];

const PDFReader = dynamic(() => import("../components/PDFReader"), {
  ssr: false,
  loading: () => (
    <div className="p-20 text-center flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
      <p className="text-slate-500 font-medium animate-pulse">Opening your book...</p>
    </div>
  ),
});

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
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function StudyApp() {
  const [activeTab, setActiveTab] = useState<MainTab>("quiz");

  // Custom Alert & Confirm Modals
  const [alertDialog, setAlertDialog] = useState<{ title: string; msg: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; msg: string; action: () => void } | null>(null);

  // Database & Raw State
  const [rawQuestions, setRawQuestions] = useState<QuizQuestion[]>([]);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);

  // Persistent User Data State
  const [mistakeIds, setMistakeIds] = useState<Set<string>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [userStats, setUserStats] = useState({ attempted: 0, correct: 0 });
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Setup / Dashboard Filters
  const [selectedChapterId, setSelectedChapterId] = useState<string>("Chapter 1");
  const [sectionsList, setSectionsList] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
  const [feedbackMode, setFeedbackMode] = useState<TestFeedbackMode>("timed");

  // Active Quiz / Exam State
  const [appMode, setAppMode] = useState<AppMode>("selector");
  const [activeTestQuestions, setActiveTestQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  
  // Using a ref for answers to avoid stale state in the timer hook
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const userAnswersRef = useRef<Record<string, string>>({});
  
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Timer (2 Hours = 7200 seconds)
  const [timeLeft, setTimeLeft] = useState(7200);

  // 1. Load Quiz from JSON
  const loadQuiz = async () => {
    if (rawQuestions.length > 0) return;
    setIsLoadingQuiz(true);

    try {
      const response = await fetch("/manual-questions.json");
      if (!response.ok) {
        throw new Error(`Failed to load question-bank.json (${response.status})`);
      }

      const data = await response.json();
      const questionArray = Array.isArray(data.questionBank) ? data.questionBank : data;

      const loaded: QuizQuestion[] = questionArray.map((item: any, index: number) => {
        const chapterNumber = item.chapterId ? Number(item.chapterId) : (item.module?.match(/\d+/) ? parseInt(item.module.match(/\d+/)[0], 10) : 1);
        const curriculumChapter = RADIOLOGY_CURRICULUM.find((chapter) => chapter.id === `Chapter ${chapterNumber}`);
        
        let chapterTitle = item.chapter || curriculumChapter?.title || "General Anatomy";
        let sectionTitle = chapterTitle;

        if (item.module && item.module.includes(" - ")) {
          sectionTitle = item.module.split(" - ").slice(1).join(" - ").trim();
        }

        const options: string[] = Array.isArray(item.options)
          ? item.options.map((option: any) => typeof option === "string" ? option : option.text).filter((option: unknown): option is string => typeof option === "string")
          : [];

        const correctAnswer = item.correctAnswer || item.answer || item.options?.find((option: any) => option.label === item.answerLabel)?.text || "";

        const textToSearch = `${item.question} ${item.explanation}`.toLowerCase();
        const detectedModalities: string[] = [];
        if (/\bct\b|computed tomography/i.test(textToSearch)) detectedModalities.push("CT");
        if (/\bmri\b|magnetic resonance|t1|t2/i.test(textToSearch)) detectedModalities.push("MRI");
        if (/\bradiograph\b|x-ray|plain film/i.test(textToSearch)) detectedModalities.push("Radiograph");
        if (/\bultrasound\b|sonograph/i.test(textToSearch)) detectedModalities.push("Ultrasound");
        if (/\bangiograph\b/i.test(textToSearch)) detectedModalities.push("Angiography");
        if (detectedModalities.length === 0) detectedModalities.push("General");

        return {
          // BUGFIX: Guarantee a 100% globally unique ID to prevent multi-chapter selection collisions
          id: `q-chapter${chapterNumber}-item${item.id ?? index}`,
          module: `Chapter ${chapterNumber}: ${chapterTitle}`,
          chapter: `Chapter ${chapterNumber}`,
          section: sectionTitle,
          modalities: detectedModalities,
          question: item.question ?? "",
          options: shuffleArray(options),
          correctAnswer,
          explanation: item.explanation ?? "",
        };
      });

      setRawQuestions(loaded);
    } catch (error) {
      console.error("Error loading question bank:", error);
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  // Load persistent data from Local Storage
  useEffect(() => {
    const savedMistakes = localStorage.getItem("rad_mistakes");
    if (savedMistakes) setMistakeIds(new Set(JSON.parse(savedMistakes)));

    const savedBookmarks = localStorage.getItem("rad_bookmarks");
    if (savedBookmarks) setBookmarkedIds(new Set(JSON.parse(savedBookmarks)));

    const savedStats = localStorage.getItem("rad_stats");
    if (savedStats) setUserStats(JSON.parse(savedStats));

    setIsDataLoaded(true);
  }, []);

  // Save persistent data to Local Storage
  useEffect(() => {
    if (isDataLoaded) {
      localStorage.setItem("rad_mistakes", JSON.stringify(Array.from(mistakeIds)));
      localStorage.setItem("rad_bookmarks", JSON.stringify(Array.from(bookmarkedIds)));
      localStorage.setItem("rad_stats", JSON.stringify(userStats));
    }
  }, [mistakeIds, bookmarkedIds, userStats, isDataLoaded]);

  useEffect(() => {
    if (activeTab === "quiz" || activeTab === "mistakes" || activeTab === "stats") {
      loadQuiz();
    }
  }, [activeTab]);

  // Derive available sections
  useEffect(() => {
    const chapterSections = Array.from(
      new Set(
        rawQuestions
          .filter((q) => q.chapter === selectedChapterId)
          .map((q) => q.section)
      )
    ).sort((a, b) => a.localeCompare(b));

    setSectionsList(chapterSections);
    setSelectedSections(chapterSections);
  }, [selectedChapterId, rawQuestions]);

  // Submit Exam & Log Stats (Triggered ONLY at the end of the test)
  const finishExam = () => {
    setAppMode("results");

    const currentAnswers = userAnswersRef.current;
    let sessionCorrect = 0;
    let sessionAttempted = 0;

    // Process Mistakes
    setMistakeIds(prev => {
      const newMistakes = new Set(prev);
      activeTestQuestions.forEach(q => {
        const ans = currentAnswers[q.id];
        if (ans) {
          if (ans === q.correctAnswer) newMistakes.delete(q.id); // Mastered!
          else newMistakes.add(q.id); // Mistake
        }
      });
      return newMistakes;
    });

    // Process Stats
    setUserStats(prev => {
      activeTestQuestions.forEach(q => {
        const ans = currentAnswers[q.id];
        if (ans) {
          sessionAttempted++;
          if (ans === q.correctAnswer) sessionCorrect++;
        }
      });
      return {
        attempted: prev.attempted + sessionAttempted,
        correct: prev.correct + sessionCorrect
      };
    });
  };

  // Timer Hook
  useEffect(() => {
    if (appMode !== "active" || feedbackMode !== "timed") return;

    if (timeLeft <= 0) {
      finishExam();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [appMode, feedbackMode, timeLeft]);

  // Format timer to support Hours
  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const toggleSection = (sec: string) => {
    setSelectedSections((prev) =>
      prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
    );
  };

  const toggleModality = (mod: string) => {
    setSelectedModalities((prev) => 
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const startExamWithQuestions = (questions: QuizQuestion[], mode: TestFeedbackMode) => {
    setActiveTestQuestions(shuffleArray(questions));
    setFeedbackMode(mode);
    setCurrentQuizIndex(0);
    setUserAnswers({});
    userAnswersRef.current = {}; // Reset the ref for the new session
    setSelectedAnswer(null);
    setShowExplanation(false);
    setTimeLeft(7200); // Set to 2 Hours
    setAppMode("active");
    setActiveTab("quiz");
  };

  const handleStartExam = () => {
    const filtered = rawQuestions.filter(
      (q) => 
        q.chapter === selectedChapterId && 
        selectedSections.includes(q.section) &&
        (selectedModalities.length === 0 || q.modalities.some(m => selectedModalities.includes(m)))
    );

    if (filtered.length === 0) {
      setAlertDialog({ title: "No Questions Found", msg: "Adjust your section or modality filters to find questions." });
      return;
    }
    startExamWithQuestions(filtered, feedbackMode);
  };

  const handleDrillList = (listIds: Set<string>, emptyMsg: string) => {
    const questionsToDrill = rawQuestions.filter(q => listIds.has(q.id));
    if (questionsToDrill.length === 0) {
      setAlertDialog({ title: "All Caught Up!", msg: emptyMsg });
      return;
    }
    startExamWithQuestions(questionsToDrill, "instant");
  };

  const handleAnswerClick = (option: string) => {
    const currentQ = activeTestQuestions[currentQuizIndex];
    if (!currentQ) return;

    setUserAnswers((prev) => {
      const next = { ...prev, [currentQ.id]: option };
      userAnswersRef.current = next; // Sync ref for the timer end function
      return next;
    });
    setSelectedAnswer(option);

    // Explanations only show instantly in "instant" mode
    if (feedbackMode === "instant") {
      setShowExplanation(true);
    }
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setShowExplanation(false);
    if (currentQuizIndex < activeTestQuestions.length - 1) {
      setCurrentQuizIndex((prev) => prev + 1);
    } else {
      finishExam();
    }
  };

  const selectedChapterObj = RADIOLOGY_CURRICULUM.find((c) => c.id === selectedChapterId);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-indigo-50 text-slate-900 p-4 md:p-8 font-sans selection:bg-blue-200">
      
      {/* ================= CUSTOM MODALS ================= */}
      {alertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">{alertDialog.title}</h3>
            <p className="text-slate-500 mb-6 leading-relaxed">{alertDialog.msg}</p>
            <button onClick={() => setAlertDialog(null)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors">
              Got it
            </button>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-500 mb-6 leading-relaxed">{confirmDialog.msg}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={() => { confirmDialog.action(); setConfirmDialog(null); }} className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= HEADER ================= */}
      <header className="max-w-5xl mx-auto mb-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600 tracking-tight pb-1">
            Applied Radiological Anatomy
          </h1>
          <p className="text-slate-500 mt-2 text-lg font-medium">Interactive Study & Exam Suite</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        <div className="flex justify-center md:justify-start mb-6">
          <div className="flex flex-wrap p-1.5 gap-2 bg-white/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white">
            <button onClick={() => setActiveTab("reader")} className={`px-4 py-2 font-semibold text-sm rounded-xl transition-all duration-300 ${activeTab === "reader" ? "bg-white text-blue-700 shadow-md border border-slate-100" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"}`}>
              📖 Book Reader
            </button>
            <button onClick={() => { setActiveTab("quiz"); setAppMode("selector"); }} className={`px-4 py-2 font-semibold text-sm rounded-xl transition-all duration-300 ${activeTab === "quiz" ? "bg-white text-blue-700 shadow-md border border-slate-100" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"}`}>
              📝 Practice
            </button>
            <button onClick={() => { setActiveTab("mistakes"); setAppMode("selector"); }} className={`px-4 py-2 font-semibold text-sm rounded-xl transition-all duration-300 flex items-center gap-2 ${activeTab === "mistakes" ? "bg-white text-rose-600 shadow-md border border-slate-100" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"}`}>
              ⚠️ Review
              {(mistakeIds.size > 0 || bookmarkedIds.size > 0) && (
                <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                  {mistakeIds.size + bookmarkedIds.size}
                </span>
              )}
            </button>
            <button onClick={() => { setActiveTab("stats"); setAppMode("selector"); }} className={`px-4 py-2 font-semibold text-sm rounded-xl transition-all duration-300 ${activeTab === "stats" ? "bg-white text-indigo-700 shadow-md border border-slate-100" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"}`}>
              📊 Stats
            </button>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-2xl p-6 md:p-10 rounded-[2rem] border border-white shadow-2xl min-h-[650px] relative overflow-hidden flex flex-col">
          
          {/* ================= VIEW 1: PDF READER ================= */}
          {activeTab === "reader" && (
            <div className="relative z-10 w-full animate-in slide-in-from-bottom-4 duration-500">
              <PDFReader />
            </div>
          )}

          {/* ================= VIEW 2: MISTAKES & BOOKMARKS ================= */}
          {activeTab === "mistakes" && (
            <div className="relative z-10 animate-in fade-in duration-300 flex flex-col w-full max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Review & Weak Areas</h2>
              <p className="text-slate-500 mb-8">
                Drill missed questions and revise your saved anatomical landmarks. Mistakes are logged automatically at the end of every exam.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-rose-50/50 border border-rose-100 p-6 rounded-2xl flex flex-col items-start justify-between shadow-sm h-full">
                  <div className="w-full flex justify-between items-center mb-4">
                    <div>
                      <p className="text-sm font-bold text-rose-500 uppercase tracking-wider mb-1">Unresolved Mistakes</p>
                      <p className="text-4xl font-black text-rose-600">{mistakeIds.size}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 text-2xl shadow-inner">⚠️</div>
                  </div>
                  <button 
                    onClick={() => handleDrillList(mistakeIds, "No active mistakes to drill! Great job.")}
                    disabled={mistakeIds.size === 0}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all"
                  >
                    Drill Mistakes
                  </button>
                </div>

                <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-2xl flex flex-col items-start justify-between shadow-sm h-full">
                  <div className="w-full flex justify-between items-center mb-4">
                    <div>
                      <p className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-1">Saved Bookmarks</p>
                      <p className="text-4xl font-black text-amber-600">{bookmarkedIds.size}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 text-2xl shadow-inner">★</div>
                  </div>
                  <button 
                    onClick={() => handleDrillList(bookmarkedIds, "No bookmarked questions saved yet. Click the star icon during an exam to save tricky questions.")}
                    disabled={bookmarkedIds.size === 0}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-xl font-bold transition-all"
                  >
                    Review Bookmarks
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= VIEW 3: PERFORMANCE STATS ================= */}
          {activeTab === "stats" && (
            <div className="relative z-10 animate-in fade-in duration-300 flex flex-col w-full max-w-4xl mx-auto">
              <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Performance Analytics</h2>
              <p className="text-slate-500 mb-8">
                Comprehensive analytics tracking your pass readiness and overall curriculum mastery.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Attempted</p>
                  <p className="text-3xl font-black text-slate-800 mt-auto">{userStats.attempted}</p>
                </div>
                
                <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-2xl shadow-sm flex flex-col">
                  <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-wider mb-1">Correct</p>
                  <p className="text-3xl font-black text-emerald-600 mt-auto">{userStats.correct}</p>
                </div>

                <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-2xl shadow-sm flex flex-col col-span-2 md:col-span-1">
                  <p className="text-xs font-bold text-indigo-600/70 uppercase tracking-wider mb-1">Accuracy</p>
                  <div className="mt-auto">
                    <p className="text-3xl font-black text-indigo-600 mb-2">
                      {userStats.attempted > 0 ? Math.round((userStats.correct / userStats.attempted) * 100) : 0}%
                    </p>
                    <div className="w-full bg-indigo-200/50 rounded-full h-2">
                      <div 
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-1000" 
                        style={{ width: `${userStats.attempted > 0 ? Math.round((userStats.correct / userStats.attempted) * 100) : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="bg-rose-50/50 border border-rose-100 p-6 rounded-2xl shadow-sm flex flex-col col-span-2 md:col-span-1">
                  <p className="text-xs font-bold text-rose-600/70 uppercase tracking-wider mb-1">Weak Areas</p>
                  <div className="mt-auto flex justify-between items-end">
                    <p className="text-3xl font-black text-rose-600">{mistakeIds.size}</p>
                    <span className="text-sm font-semibold text-rose-400 mb-1">active mistakes</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 max-w-sm mt-auto">
                <button 
                  onClick={() => {
                    setConfirmDialog({
                      title: "Clear Data",
                      msg: "Are you sure you want to permanently clear all history, stats, and mistakes? This action cannot be undone.",
                      action: () => {
                        setMistakeIds(new Set());
                        setBookmarkedIds(new Set());
                        setUserStats({ attempted: 0, correct: 0 });
                      }
                    });
                  }}
                  className="py-3 border-2 border-rose-100 text-rose-500 hover:bg-rose-50 rounded-xl font-bold transition-colors"
                >
                  ↺ Clear Data & Start Over
                </button>
              </div>
            </div>
          )}

          {/* ================= VIEW 4: QUIZ EXAM SUITE ================= */}
          {activeTab === "quiz" && (
            <div className="relative z-10 flex flex-col flex-grow w-full max-w-3xl mx-auto">
              
              {appMode === "selector" && (
                <div className="animate-in fade-in duration-300">
                  <h2 className="text-2xl font-bold text-slate-800 mb-1">Configure Your Test</h2>
                  <p className="text-slate-500 text-sm mb-6">
                    Choose a chapter, fine-tune your specific section and modality focus.
                  </p>

                  {isLoadingQuiz ? (
                    <div className="py-24 flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-3"></div>
                      <p className="text-slate-500 font-medium">Loading question bank...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Select Chapter (Module)
                        </label>
                        <select
                          value={selectedChapterId}
                          onChange={(e) => setSelectedChapterId(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm"
                        >
                          {RADIOLOGY_CURRICULUM.map((chap) => {
                            const count = rawQuestions.filter((q) => q.chapter === chap.id).length;
                            return (
                              <option key={chap.id} value={chap.id}>
                                {chap.id}: {chap.title} ({count} questions)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Select Sections ({selectedSections.length} of {sectionsList.length} selected)
                          </label>
                          <div className="space-x-3 text-xs font-semibold">
                            <button onClick={() => setSelectedSections(sectionsList)} className="text-indigo-600 hover:underline">Select All</button>
                            <button onClick={() => setSelectedSections([])} className="text-slate-400 hover:underline">Clear</button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
                          {sectionsList.map((sec) => {
                            const isChecked = selectedSections.includes(sec);
                            const count = rawQuestions.filter((q) => q.chapter === selectedChapterId && q.section === sec).length;
                            return (
                              <label key={sec} className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition text-xs font-medium ${isChecked ? "bg-indigo-50/60 border-indigo-200 text-indigo-950 font-semibold shadow-sm" : "bg-white border-slate-200 text-slate-500"}`}>
                                <div className="flex items-center space-x-2 truncate pr-2">
                                  <input type="checkbox" checked={isChecked} onChange={() => toggleSection(sec)} className="rounded text-indigo-600 h-4 w-4" />
                                  <span className="truncate">{sec}</span>
                                </div>
                                <span className="px-2 py-0.5 bg-slate-200/70 rounded-md text-[10px] text-slate-600 font-bold">{count}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Filter by Modality
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {MODALITIES.map(mod => {
                            const isSelected = selectedModalities.includes(mod);
                            return (
                              <button
                                key={mod}
                                onClick={() => toggleModality(mod)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                                  isSelected 
                                    ? "bg-indigo-600 text-white border-indigo-700 shadow-md" 
                                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                {mod}
                              </button>
                            );
                          })}
                          {selectedModalities.length === 0 && (
                            <span className="px-4 py-2 text-xs font-medium text-slate-400">All modalities included</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Test Mode
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div
                            onClick={() => setFeedbackMode("timed")}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition ${feedbackMode === "timed" ? "border-indigo-600 bg-indigo-50/30 shadow-md" : "border-slate-200 bg-white hover:border-slate-300"}`}
                          >
                            <div className="font-bold text-slate-800 text-sm mb-1">⏱️ 120-Min Timed Exam</div>
                            <p className="text-xs text-slate-500 leading-relaxed">2-hour countdown timer. No instant feedback. Mistakes logged on submission.</p>
                          </div>
                          <div
                            onClick={() => setFeedbackMode("instant")}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition ${feedbackMode === "instant" ? "border-indigo-600 bg-indigo-50/30 shadow-md" : "border-slate-200 bg-white hover:border-slate-300"}`}
                          >
                            <div className="font-bold text-slate-800 text-sm mb-1">⚡ Instant Answer Mode</div>
                            <p className="text-xs text-slate-500 leading-relaxed">See correct/incorrect feedback immediately. Stats logged on submission.</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleStartExam}
                        disabled={selectedSections.length === 0}
                        className="w-full mt-4 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-2xl font-bold text-lg shadow-lg transition-all"
                      >
                        Start Test →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {appMode === "active" && activeTestQuestions.length > 0 && (
                <div className="animate-in fade-in duration-300 flex flex-col flex-grow">
                  <div className="flex flex-wrap justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 gap-4 shadow-sm">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 block">
                        {activeTestQuestions[currentQuizIndex]?.chapter}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">
                        Question {currentQuizIndex + 1} of {activeTestQuestions.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {feedbackMode === "timed" && (
                        <div className={`px-4 py-1.5 rounded-xl font-mono font-bold text-sm flex items-center gap-2 ${
                          timeLeft < 300 ? "bg-rose-100 text-rose-700 animate-pulse" : "bg-white text-slate-700 shadow-sm border border-slate-200"
                        }`}>
                          <span>⏱️</span>
                          <span>{formatTimer(timeLeft)}</span>
                        </div>
                      )}
                      <button onClick={() => finishExam()} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition">
                        Submit Exam
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-3xl shadow-xl p-6 md:p-8 flex flex-col flex-grow relative">
                    {/* Bookmark Button */}
                    <button 
                      onClick={() => toggleBookmark(activeTestQuestions[currentQuizIndex].id)}
                      className="absolute top-6 right-6 text-3xl transition-transform hover:scale-110 focus:outline-none"
                      title="Bookmark this question"
                    >
                      {bookmarkedIds.has(activeTestQuestions[currentQuizIndex].id) 
                        ? <span className="text-amber-400 drop-shadow-sm">★</span> 
                        : <span className="text-slate-300 hover:text-amber-200">☆</span>
                      }
                    </button>

                    <div className="mb-3 inline-block px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg uppercase tracking-wider self-start">
                      {activeTestQuestions[currentQuizIndex]?.section}
                    </div>

                    <div className="flex gap-2 mb-4">
                      {activeTestQuestions[currentQuizIndex]?.modalities.map(m => (
                        <span key={m} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-md font-bold uppercase">{m}</span>
                      ))}
                    </div>

                    <p className="text-xl md:text-2xl font-medium text-slate-800 leading-relaxed mb-6 pr-8">
                      {activeTestQuestions[currentQuizIndex]?.question}
                    </p>

                    <div className="flex flex-col gap-3 mb-6">
                      {activeTestQuestions[currentQuizIndex]?.options.map((option, idx) => {
                        const currentQ = activeTestQuestions[currentQuizIndex];
                        const isChosen = selectedAnswer === option;
                        const isCorrect = option === currentQ.correctAnswer;

                        let buttonStyle = "bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200";

                        if (feedbackMode === "instant" && selectedAnswer !== null) {
                          if (isCorrect) buttonStyle = "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-md ring-1 ring-emerald-500";
                          else if (isChosen && !isCorrect) buttonStyle = "bg-rose-50 border-rose-500 text-rose-800 shadow-md ring-1 ring-rose-500";
                          else buttonStyle = "bg-slate-50 border-slate-200 text-slate-400 opacity-50";
                        } else if (isChosen) {
                          buttonStyle = "bg-indigo-50 border-indigo-500 text-indigo-950 font-bold ring-1 ring-indigo-500";
                        }

                        return (
                          <button
                            key={idx}
                            disabled={feedbackMode === "instant" && selectedAnswer !== null}
                            onClick={() => handleAnswerClick(option)}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-300 font-medium text-lg ${buttonStyle}`}
                          >
                            <span className="font-bold mr-2 text-indigo-500">{String.fromCharCode(65 + idx)}.</span>
                            {option}
                          </button>
                        );
                      })}
                    </div>

                    {feedbackMode === "instant" && selectedAnswer !== null && (
                      <div className="mb-6 animate-in fade-in duration-300">
                        <div className={`p-4 rounded-2xl border-2 shadow-sm ${selectedAnswer === activeTestQuestions[currentQuizIndex]?.correctAnswer ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-rose-50 border-rose-100 text-rose-900"}`}>
                          <div className="font-bold text-lg mb-1 flex items-center gap-2">
                            {selectedAnswer === activeTestQuestions[currentQuizIndex]?.correctAnswer ? "🎯 Correct!" : "❌ Incorrect"}
                          </div>
                          <p className="text-sm leading-relaxed mt-2 pt-2 border-t border-slate-200/60 text-slate-700">
                            {activeTestQuestions[currentQuizIndex]?.explanation}
                          </p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleNextQuestion}
                      disabled={selectedAnswer === null && feedbackMode === "instant"}
                      className="mt-auto w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-40 text-white rounded-2xl font-bold text-xl shadow-lg transition-all"
                    >
                      {currentQuizIndex < activeTestQuestions.length - 1 ? "Next Question →" : "Submit Exam ✓"}
                    </button>
                  </div>
                </div>
              )}

              {appMode === "results" && (
                <div className="animate-in fade-in duration-300 w-full">
                  {(() => {
                    let correctCount = 0;
                    activeTestQuestions.forEach((q) => {
                      if (userAnswers[q.id] === q.correctAnswer) correctCount++;
                    });
                    const percentage = activeTestQuestions.length > 0 
                      ? Math.round((correctCount / activeTestQuestions.length) * 100)
                      : 0;

                    return (
                      <div className="flex flex-col items-center">
                        <div className="text-center mb-8 bg-slate-50 border border-slate-200 p-8 rounded-3xl w-full shadow-sm">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                            Exam Complete
                          </span>
                          <h2 className="text-4xl font-black text-slate-800 mt-3 mb-2">{percentage}% Score</h2>
                          <p className="text-slate-600 font-medium text-lg">
                            You answered <strong className="text-indigo-600">{correctCount}</strong> out of{" "}
                            <strong>{activeTestQuestions.length}</strong> questions correctly.
                          </p>
                          <div className="flex justify-center gap-3 mt-6">
                            <button
                              onClick={() => setAppMode("selector")}
                              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition"
                            >
                              Configure New Test
                            </button>
                          </div>
                        </div>

                        <div className="w-full space-y-4">
                          <h3 className="text-xl font-bold text-slate-800 mb-4">Detailed Review & Explanations</h3>
                          {activeTestQuestions.map((q, idx) => {
                            const userAns = userAnswers[q.id];
                            const isRight = userAns === q.correctAnswer;

                            return (
                              <div
                                key={q.id}
                                className={`p-6 rounded-3xl border-2 relative shadow-sm ${
                                  isRight ? "bg-emerald-50/40 border-emerald-200" : "bg-rose-50/40 border-rose-200"
                                }`}
                              >
                                <button 
                                  onClick={() => toggleBookmark(q.id)}
                                  className="absolute top-5 right-5 text-2xl transition-transform hover:scale-110 focus:outline-none"
                                >
                                  {bookmarkedIds.has(q.id) ? <span className="text-amber-400">★</span> : <span className="text-slate-400 hover:text-amber-200">☆</span>}
                                </button>

                                <div className="flex justify-between items-center mb-2 pr-8">
                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Q{idx + 1} — {q.section}
                                  </span>
                                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                                    isRight ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                  }`}>
                                    {isRight ? "✓ Correct" : userAns ? "✗ Incorrect" : "Unanswered"}
                                  </span>
                                </div>

                                <p className="text-lg font-semibold text-slate-800 mb-3">{q.question}</p>

                                <div className="text-sm space-y-1 mb-4">
                                  <p className="text-slate-600">
                                    Your Answer: <strong className={isRight ? "text-emerald-700" : "text-rose-600"}>{userAns || "None"}</strong>
                                  </p>
                                  {!isRight && (
                                    <p className="text-slate-600">
                                      Correct Answer: <strong className="text-emerald-700">{q.correctAnswer}</strong>
                                    </p>
                                  )}
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200 text-slate-700 text-sm leading-relaxed">
                                  <strong className="text-slate-900 block mb-1">Explanation:</strong>
                                  {q.explanation}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
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