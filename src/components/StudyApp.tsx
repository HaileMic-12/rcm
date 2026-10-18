"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

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
  module: string; // e.g., "Chapter 7 - Heart and Great Vessels"
  chapter: string; // Extracted e.g., "Chapter 7"
  section: string; // Extracted e.g., "Heart and Great Vessels"
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

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
  const [activeTab, setActiveTab] = useState<"reader" | "quiz">("quiz");

  // Database & Raw State
  const [rawQuestions, setRawQuestions] = useState<QuizQuestion[]>([]);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);

  // Setup / Dashboard Filters
  const [chaptersList, setChaptersList] = useState<string[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [sectionsList, setSectionsList] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [feedbackMode, setFeedbackMode] = useState<TestFeedbackMode>("timed");

  // Active Quiz / Exam State
  const [appMode, setAppMode] = useState<AppMode>("selector");
  const [activeTestQuestions, setActiveTestQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // 60-Minute Timer State
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes in seconds

  // 1. Load Quiz from public/manual-questions.json on mount / tab switch
  const loadQuiz = async () => {
    if (rawQuestions.length > 0) return;
    setIsLoadingQuiz(true);
    try {
      const response = await fetch("/manual-questions.json");
      if (!response.ok) throw new Error("Failed to load manual-questions.json");

      const data = await response.json();
      const loaded: QuizQuestion[] = [];
      const chapSet = new Set<string>();

      data.forEach((item: any, index: number) => {
        const mod = item.module || "Chapter 1 - General Anatomy";
        
        // Parse "Chapter X - Section Name" cleanly
        const parts = mod.split(" - ");
        const chapter = parts[0]?.trim() || "Chapter 1";
        const section = parts.slice(1).join(" - ").trim() || "General";

        chapSet.add(chapter);

        loaded.push({
          id: `q-${index}`,
          module: mod,
          chapter,
          section,
          question: item.question,
          options: shuffleArray(item.options),
          correctAnswer: item.correctAnswer,
          explanation: item.explanation,
        });
      });

      setRawQuestions(loaded);
      const sortedChapters = Array.from(chapSet).sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, "")) || 0;
        const numB = parseInt(b.replace(/[^0-9]/g, "")) || 0;
        return numA - numB;
      });

      setChaptersList(sortedChapters);
      if (sortedChapters.length > 0) {
        setSelectedChapter(sortedChapters[0]);
      }
    } catch (error) {
      console.error("Error loading local quiz JSON:", error);
    }
    setIsLoadingQuiz(false);
  };

  useEffect(() => {
    if (activeTab === "quiz") {
      loadQuiz();
    }
  }, [activeTab]);

  // 2. Update available sections when chapter changes
  useEffect(() => {
    if (!selectedChapter) return;
    const matchingSections = Array.from(
      new Set(
        rawQuestions
          .filter((q) => q.chapter === selectedChapter)
          .map((q) => q.section)
      )
    ).sort();

    setSectionsList(matchingSections);
    setSelectedSections(matchingSections); // Select all by default
  }, [selectedChapter, rawQuestions]);

  // 3. 60-Minute Countdown Timer Hook (Active only in "timed" mode during test)
  useEffect(() => {
    if (appMode !== "active" || feedbackMode !== "timed") return;

    if (timeLeft <= 0) {
      setAppMode("results");
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [appMode, feedbackMode, timeLeft]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Section toggle handler
  const toggleSection = (sec: string) => {
    setSelectedSections((prev) =>
      prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
    );
  };

  // Start Test Action
  const handleStartExam = () => {
    const filtered = rawQuestions.filter(
      (q) => q.chapter === selectedChapter && selectedSections.includes(q.section)
    );

    if (filtered.length === 0) {
      alert("Please select at least one section with available questions.");
      return;
    }

    setActiveTestQuestions(shuffleArray(filtered));
    setCurrentQuizIndex(0);
    setUserAnswers({});
    setSelectedAnswer(null);
    setShowExplanation(false);
    setTimeLeft(3600); // Reset timer to 60 minutes
    setAppMode("active");
  };

  // Handle Answer Selection
  const handleAnswerClick = (option: string) => {
    const currentQ = activeTestQuestions[currentQuizIndex];
    if (!currentQ) return;

    // Record answer
    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: option }));
    setSelectedAnswer(option);

    if (feedbackMode === "instant") {
      setShowExplanation(true);
    }
  };

  // Next Question Handler
  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setShowExplanation(false);
    if (currentQuizIndex < activeTestQuestions.length - 1) {
      setCurrentQuizIndex((prev) => prev + 1);
    } else {
      setAppMode("results");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-indigo-50 text-slate-900 p-4 md:p-8 font-sans selection:bg-blue-200">
      <header className="max-w-5xl mx-auto mb-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600 tracking-tight pb-1">
            Applied Radiological Anatomy
          </h1>
          <p className="text-slate-500 mt-2 text-lg font-medium">Interactive Study & Exam Suite</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        {/* Navigation Tabs */}
        <div className="flex justify-center md:justify-start mb-6">
          <div className="flex p-1.5 space-x-2 bg-white/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white">
            <button
              onClick={() => setActiveTab("reader")}
              className={`px-6 py-3 font-semibold rounded-xl transition-all duration-300 ${
                activeTab === "reader"
                  ? "bg-white text-blue-700 shadow-md border border-slate-100"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              📖 Book Reader
            </button>
            <button
              onClick={() => setActiveTab("quiz")}
              className={`px-6 py-3 font-semibold rounded-xl transition-all duration-300 ${
                activeTab === "quiz"
                  ? "bg-white text-blue-700 shadow-md border border-slate-100"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              📝 Practice Quiz & Exams
            </button>
          </div>
        </div>

        {/* Main Card Container */}
        <div className="bg-white/70 backdrop-blur-2xl p-6 md:p-10 rounded-[2rem] border border-white shadow-2xl min-h-[650px] relative overflow-hidden flex flex-col">
          {activeTab === "reader" && (
            <div className="relative z-10 w-full animate-in slide-in-from-bottom-4 duration-500">
              <PDFReader />
            </div>
          )}

          {activeTab === "quiz" && (
            <div className="relative z-10 flex flex-col flex-grow w-full max-w-3xl mx-auto">
              
              {/* ================= VIEW 1: MODULE & SECTION SETUP DASHBOARD ================= */}
              {appMode === "selector" && (
                <div className="animate-in fade-in duration-300">
                  <h2 className="text-2xl font-bold text-slate-800 mb-1">Configure Your Test</h2>
                  <p className="text-slate-500 text-sm mb-6">
                    Choose a module, fine-tune your specific section focus, and select your exam style.
                  </p>

                  {isLoadingQuiz ? (
                    <div className="py-24 flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-3"></div>
                      <p className="text-slate-500 font-medium">Loading question bank from manual file...</p>
                    </div>
                  ) : chaptersList.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 font-medium">
                      No questions found in manual-questions.json. Please check your JSON file format.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Chapter Select */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Select Chapter (Module)
                        </label>
                        <select
                          value={selectedChapter}
                          onChange={(e) => setSelectedChapter(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                          {chaptersList.map((chap) => (
                            <option key={chap} value={chap}>
                              {chap} — {rawQuestions.find((q) => q.chapter === chap)?.module.split(" - ").slice(1).join(" - ") || ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Section Checklist */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Select Sections ({selectedSections.length} of {sectionsList.length} selected)
                          </label>
                          <div className="space-x-3 text-xs font-semibold">
                            <button
                              onClick={() => setSelectedSections(sectionsList)}
                              className="text-indigo-600 hover:underline"
                            >
                              Select All
                            </button>
                            <button
                              onClick={() => setSelectedSections([])}
                              className="text-slate-400 hover:underline"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                          {sectionsList.map((sec) => {
                            const isChecked = selectedSections.includes(sec);
                            const count = rawQuestions.filter(
                              (q) => q.chapter === selectedChapter && q.section === sec
                            ).length;
                            return (
                              <label
                                key={sec}
                                className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition text-xs font-medium ${
                                  isChecked
                                    ? "bg-indigo-50/60 border-indigo-200 text-indigo-950 font-semibold"
                                    : "bg-white border-slate-200 text-slate-500"
                                }`}
                              >
                                <div className="flex items-center space-x-2 truncate pr-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleSection(sec)}
                                    className="rounded text-indigo-600 h-4 w-4"
                                  />
                                  <span className="truncate">{sec}</span>
                                </div>
                                <span className="px-2 py-0.5 bg-slate-200/70 rounded-md text-[10px] text-slate-600 font-bold">
                                  {count}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Feedback & Timing Mode Selection */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Test Mode
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div
                            onClick={() => setFeedbackMode("timed")}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition ${
                              feedbackMode === "timed"
                                ? "border-indigo-600 bg-indigo-50/30"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="font-bold text-slate-800 text-sm mb-1">⏱️ 60-Min Timed Exam</div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              60-minute countdown timer. Results and explanations are provided at the end.
                            </p>
                          </div>

                          <div
                            onClick={() => setFeedbackMode("instant")}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition ${
                              feedbackMode === "instant"
                                ? "border-indigo-600 bg-indigo-50/30"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="font-bold text-slate-800 text-sm mb-1">⚡ Instant Answer Mode</div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              No timer. See correct/incorrect feedback and explanations immediately after answering.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Start Button */}
                      <button
                        onClick={handleStartExam}
                        disabled={selectedSections.length === 0}
                        className="w-full mt-4 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-2xl font-bold text-lg shadow-lg transition-all"
                      >
                        Start Test ({selectedSections.reduce((acc, sec) => acc + rawQuestions.filter(q => q.chapter === selectedChapter && q.section === sec).length, 0)} Questions) →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ================= VIEW 2: ACTIVE EXAM INTERFACE ================= */}
              {appMode === "active" && activeTestQuestions.length > 0 && (
                <div className="animate-in fade-in duration-300 flex flex-col flex-grow">
                  
                  {/* Top Bar: Progress & Timer */}
                  <div className="flex flex-wrap justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 gap-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 block">
                        {selectedChapter}
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
                      <button
                        onClick={() => setAppMode("results")}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition"
                      >
                        End Exam
                      </button>
                    </div>
                  </div>

                  {/* Question Card */}
                  <div className="bg-white border border-slate-100 rounded-3xl shadow-xl p-6 md:p-8 flex flex-col flex-grow">
                    <div className="mb-3 inline-block px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg uppercase tracking-wider self-start">
                      {activeTestQuestions[currentQuizIndex]?.section}
                    </div>

                    <p className="text-xl md:text-2xl font-medium text-slate-800 leading-relaxed mb-6">
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
                        } else if (feedbackMode === "timed" && isChosen) {
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

                    {/* Instant Mode Explanation Box */}
                    {feedbackMode === "instant" && selectedAnswer !== null && (
                      <div className="mb-6 animate-in fade-in duration-300">
                        <div className={`p-4 rounded-2xl border-2 ${selectedAnswer === activeTestQuestions[currentQuizIndex]?.correctAnswer ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-rose-50 border-rose-100 text-rose-900"}`}>
                          <div className="font-bold text-lg mb-1 flex items-center gap-2">
                            {selectedAnswer === activeTestQuestions[currentQuizIndex]?.correctAnswer ? "🎯 Correct!" : "❌ Incorrect"}
                          </div>
                          <p className="text-sm leading-relaxed mt-2 pt-2 border-t border-slate-200/60 text-slate-700">
                            {activeTestQuestions[currentQuizIndex]?.explanation}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Next / Finish Button */}
                    <button
                      onClick={handleNextQuestion}
                      disabled={feedbackMode === "instant" && selectedAnswer === null}
                      className="mt-auto w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-40 text-white rounded-2xl font-bold text-xl shadow-lg transition-all"
                    >
                      {currentQuizIndex < activeTestQuestions.length - 1 ? "Next Question →" : "View Final Results ✓"}
                    </button>
                  </div>
                </div>
              )}

              {/* ================= VIEW 3: RESULTS & EXPLANATIONS REPORT ================= */}
              {appMode === "results" && (
                <div className="animate-in fade-in duration-300 w-full">
                  {(() => {
                    let correctCount = 0;
                    activeTestQuestions.forEach((q) => {
                      if (userAnswers[q.id] === q.correctAnswer) correctCount++;
                    });
                    const percentage = Math.round((correctCount / activeTestQuestions.length) * 100);

                    return (
                      <div className="flex flex-col items-center">
                        <div className="text-center mb-8 bg-slate-50 border border-slate-200 p-8 rounded-3xl w-full">
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

                        {/* Question Breakdown & Review */}
                        <div className="w-full space-y-4">
                          <h3 className="text-xl font-bold text-slate-800 mb-4">Detailed Review & Explanations</h3>
                          {activeTestQuestions.map((q, idx) => {
                            const userAns = userAnswers[q.id];
                            const isRight = userAns === q.correctAnswer;

                            return (
                              <div
                                key={q.id}
                                className={`p-6 rounded-3xl border-2 ${
                                  isRight ? "bg-emerald-50/40 border-emerald-200" : "bg-rose-50/40 border-rose-200"
                                }`}
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Q{idx + 1} • {q.section}
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