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

type AppMode = "selector" | "active" | "results" | "history";
type TestFeedbackMode = "timed" | "instant";

// Direct embedded questions (No fetch or database required!)
const EMBEDDED_QUESTIONS: QuizQuestion[] = [
  {
    id: "q-1",
    module: "Chapter 8 - The Breast",
    chapter: "Chapter 8",
    section: "Imaging methods",
    question: "What is the primary role of diagnostic ultrasound in the evaluation of dense breast tissue compared to mammography?",
    options: [
      "To replace mammography entirely in all age groups",
      "To differentiate solid masses from fluid-filled cysts in radiopaque dense tissue",
      "To visualize microcalcifications smaller than 100 micrometers",
      "To measure intramammary pressure gradients"
    ],
    correctAnswer: "To differentiate solid masses from fluid-filled cysts in radiopaque dense tissue",
    explanation: "Ultrasound is exceptionally useful in dense fibroglandular breasts to characterize lesions detected on mammography, specifically differentiating benign cysts from solid masses."
  },
  {
    id: "q-2",
    module: "Chapter 8 - The Breast",
    chapter: "Chapter 8",
    section: "Mammography and positioning",
    question: "In a standard mediolateral oblique (MLO) mammographic view, which anatomical landmark should ideally be visualized down to the level of the posterior nipple line?",
    options: [
      "The costophrenic angle",
      "The pectoralis muscle",
      "The sternoclavicular joint",
      "The xiphoid process"
    ],
    correctAnswer: "The pectoralis muscle",
    explanation: "A technically adequate MLO view must include the pectoralis muscle extending down to the level of the posterior nipple line to ensure adequate breast tissue inclusion."
  },
  {
    id: "q-3",
    module: "Chapter 9 - Anterior abdominal wall",
    chapter: "Chapter 9",
    section: "Anterior abdominal wall anatomy",
    question: "At what anatomical landmark below the costal margin does the posterior wall of the rectus sheath terminate, leaving only the transversalis fascia?",
    options": [
      "The linea alba",
      "The arcuate line (linea semicircularis)",
      "The umbilicus",
      "The inguinal ligament"
    ],
    correctAnswer: "The arcuate line (linea semicircularis)",
    explanation: "Below the arcuate line, all aponeurotic layers pass anteriorly to the rectus abdominis muscle, leaving only the transversalis fascia posteriorly."
  },
  {
    id: "q-4",
    module: "Chapter 13 - The male pelvis",
    chapter: "Chapter 13",
    section: "Prostate zones",
    question: "According to McNeal's anatomical subdivision, which zone of the prostate gland is the most common site for benign prostatic hyperplasia (BPH)?",
    options": [
      "The peripheral zone",
      "The central zone",
      "The transition zone",
      "The anterior fibromuscular stroma"
    ],
    correctAnswer: "The transition zone",
    explanation: "BPH predominantly originates within the transition zone surrounding the proximal urethra."
  },
  {
    id: "q-5",
    module: "Chapter 13 - The male pelvis",
    chapter: "Chapter 13",
    section: "Prostate zones",
    question: "Which zone constitutes approximately 70% of the glandular prostate and is the primary site for prostatic adenocarcinoma?",
    options": [
      "The peripheral zone",
      "The transition zone",
      "The central zone",
      "The periurethral glands"
    ],
    correctAnswer: "The peripheral zone",
    explanation: "The peripheral zone makes up about 70% of the normal glandular prostate and is where the majority of prostate carcinomas develop."
  }
];

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

  const [rawQuestions] = useState<QuizQuestion[]>(EMBEDDED_QUESTIONS);
  const [chaptersList, setChaptersList] = useState<string[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [sectionsList, setSectionsList] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [feedbackMode, setFeedbackMode] = useState<TestFeedbackMode>("timed");

  const [appMode, setAppMode] = useState<AppMode>("selector");
  const [activeTestQuestions, setActiveTestQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const [timeLeft, setTimeLeft] = useState<number>(3600);
  const [examHistory, setExamHistory] = useState<ExamResultRecord[]>([]);

  // Initialize chapters and history
  useEffect(() => {
    const chapSet = new Set<string>();
    EMBEDDED_QUESTIONS.forEach((q) => chapSet.add(q.chapter));
    const sortedChapters = Array.from(chapSet).sort();

    setChaptersList(sortedChapters);
    if (sortedChapters.length > 0) {
      setSelectedChapter(sortedChapters[0]);
    }

    const savedHistory = localStorage.getItem("radiology_exam_history");
    if (savedHistory) {
      try {
        setExamHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("History error", e);
      }
    }
  }, []);

  // Update sections when chapter changes
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
    setSelectedSections(matchingSections);
  }, [selectedChapter, rawQuestions]);

  // 60-Minute Timer Hook
  useEffect(() => {
    if (appMode !== "active" || feedbackMode !== "timed") return;

    if (timeLeft <= 0) {
      finalizeExam();
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

  const toggleSection = (sec: string) => {
    setSelectedSections((prev) =>
      prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
    );
  };

  const handleStartExam = () => {
    const filtered = rawQuestions.filter(
      (q) => q.chapter === selectedChapter && selectedSections.includes(q.section)
    );

    if (filtered.length === 0) {
      alert("Please select at least one section with available questions.");
      return;
    }

    const preparedQuestions = filtered.map((q) => ({
      ...q,
      options: shuffleArray(q.options),
    }));

    setActiveTestQuestions(shuffleArray(preparedQuestions));
    setCurrentQuizIndex(0);
    setUserAnswers({});
    setSelectedAnswer(null);
    setTimeLeft(3600);
    setAppMode("active");
  };

  const handleAnswerClick = (option: string) => {
    const currentQ = activeTestQuestions[currentQuizIndex];
    if (!currentQ) return;

    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: option }));
    setSelectedAnswer(option);
  };

  const finalizeExam = () => {
    let correctCount = 0;
    activeTestQuestions.forEach((q) => {
      if (userAnswers[q.id] === q.correctAnswer) correctCount++;
    });
    const percentage = Math.round((correctCount / activeTestQuestions.length) * 100);

    const newRecord: ExamResultRecord = {
      id: `exam-${Date.now()}`,
      chapter: selectedChapter,
      date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      score: correctCount,
      total: activeTestQuestions.length,
      percentage,
      mode: feedbackMode === "timed" ? "60-Min Exam" : "Instant Practice",
    };

    const updatedHistory = [newRecord, ...examHistory];
    setExamHistory(updatedHistory);
    localStorage.setItem("radiology_exam_history", JSON.stringify(updatedHistory));

    setAppMode("results");
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    if (currentQuizIndex < activeTestQuestions.length - 1) {
      setCurrentQuizIndex((prev) => prev + 1);
    } else {
      finalizeExam();
    }
  };

  const exportScores = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(examHistory, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `radiology_exam_scores_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-indigo-50 text-slate-900 p-4 md:p-8 font-sans selection:bg-blue-200">
      <header className="max-w-5xl mx-auto mb-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600 tracking-tight pb-1">
            Applied Radiological Anatomy
          </h1>
          <p className="text-slate-500 mt-2 text-lg font-medium">
            Interactive Study & Exam Suite (Standalone Mode)
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div className="flex p-1.5 space-x-2 bg-white/65 backdrop-blur-xl rounded-2xl shadow-sm border border-white">
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

          {activeTab === "quiz" && appMode === "selector" && examHistory.length > 0 && (
            <button
              onClick={() => setAppMode("history")}
              className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl shadow-sm hover:bg-slate-50 transition"
            >
              📊 View Exam History ({examHistory.length})
            </button>
          )}
        </div>

        <div className="bg-white/70 backdrop-blur-2xl p-6 md:p-10 rounded-[2rem] border border-white shadow-2xl min-h-[650px] relative overflow-hidden flex flex-col">
          {activeTab === "reader" && (
            <div className="relative z-10 w-full">
              <PDFReader />
            </div>
          )}

          {activeTab === "quiz" && (
            <div className="relative z-10 flex flex-col flex-grow w-full max-w-3xl mx-auto">
              
              {appMode === "selector" && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-1">Configure Your Test</h2>
                  <p className="text-slate-500 text-sm mb-6">
                    Choose a module, fine-tune your specific section focus, and select your exam style.
                  </p>

                  <div className="space-y-6">
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

                    <button
                      onClick={handleStartExam}
                      disabled={selectedSections.length === 0}
                      className="w-full mt-4 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-2xl font-bold text-lg shadow-lg transition-all"
                    >
                      Start Test ({selectedSections.reduce((acc, sec) => acc + rawQuestions.filter(q => q.chapter === selectedChapter && q.section === sec).length, 0)} Questions) →
                    </button>
                  </div>
                </div>
              )}

              {appMode === "active" && activeTestQuestions.length > 0 && (
                <div className="flex flex-col flex-grow">
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
                        onClick={finalizeExam}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition"
                      >
                        End Exam
                      </button>
                    </div>
                  </div>

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

                    {feedbackMode === "instant" && selectedAnswer !== null && (
                      <div className="mb-6">
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

              {appMode === "results" && (
                <div className="w-full">
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
                          <div className="flex justify-center gap-3 mt-6 flex-wrap">
                            <button
                              onClick={() => setAppMode("selector")}
                              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition"
                            >
                              Configure New Test
                            </button>
                            <button
                              onClick={() => setAppMode("history")}
                              className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition"
                            >
                              View Exam History
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

              {appMode === "history" && (
                <div className="w-full">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800">Your Exam History</h2>
                      <p className="text-slate-500 text-sm">Review your past performance or export scores.</p>
                    </div>
                    <div className="flex gap-3">
                      {examHistory.length > 0 && (
                        <button
                          onClick={exportScores}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                        >
                          📥 Export Scores (.JSON)
                        </button>
                      )}
                      <button
                        onClick={() => setAppMode("selector")}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                      >
                        ← Back to Quiz
                      </button>
                    </div>
                  </div>

                  {examHistory.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 font-medium">
                      No completed exams yet. Finish a test to record your score!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {examHistory.map((record) => (
                        <div key={record.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-800">{record.chapter}</span>
                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                                {record.mode}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400">{record.date}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-xl font-black text-indigo-600">{record.percentage}%</span>
                              <span className="text-xs text-slate-500 block">({record.score}/{record.total} correct)</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </main>
    </div>
  );
}