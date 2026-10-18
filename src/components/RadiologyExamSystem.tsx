"use client";

import React, { useState, useEffect, useMemo } from "react";
import { RADIOLOGY_CURRICULUM, ChapterCurriculum } from "@/data/curriculum";
import { PREBUILT_QUESTIONS } from "@/data/prebuiltQuestions";

export interface QuestionItem {
  id: string;
  module: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

type FeedbackMode = "instant" | "timed_exam";
type ScreenState = "selector" | "loading" | "testing" | "results";

export default function ExamSystem() {
  // 1. User Selection State
  const [selectedChapter, setSelectedChapter] = useState<ChapterCurriculum>(RADIOLOGY_CURRICULUM[0]);
  const [selectedSections, setSelectedSections] = useState<string[]>(RADIOLOGY_CURRICULUM[0].sections);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>("timed_exam");
  const [includeFreshAI, setIncludeFreshAI] = useState<boolean>(false);

  // 2. Active Test State
  const [screen, setScreen] = useState<ScreenState>("selector");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(3600); // 60 Minutes = 3600s

  // Sync sections when user clicks a different chapter
  const handleSelectChapter = (chapter: ChapterCurriculum) => {
    setSelectedChapter(chapter);
    setSelectedSections(chapter.sections); // Select all sections by default
  };

  const toggleSection = (sectionName: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((s) => s !== sectionName)
        : [...prev, sectionName]
    );
  };

  // 60-Minute Timer Hook (Only runs during "timed_exam" mode)
  useEffect(() => {
    if (screen !== "testing" || feedbackMode !== "timed_exam") return;

    if (timeLeftSeconds <= 0) {
      // Auto-submit when 60 minutes expire
      setScreen("results");
      return;
    }

    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [screen, feedbackMode, timeLeftSeconds]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Start Exam Handler
  const startExam = async () => {
    if (selectedSections.length === 0) return;
    setScreen("loading");

    try {
      // Filter local pre-generated AI questions first
      let loadedQuestions = PREBUILT_QUESTIONS.filter((q) =>
        q.module.toLowerCase().startsWith(selectedChapter.id.toLowerCase())
      );

      // If user wants fresh AI questions generated on the fly via your API route:
      if (includeFreshAI || loadedQuestions.length === 0) {
        const res = await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapterId: selectedChapter.id,
            chapterTitle: selectedChapter.title,
            sections: selectedSections,
            useAI: true,
            questionCount: 15
          })
        });
        if (res.ok) {
          const data = await res.json();
          loadedQuestions = data.questions;
        }
      }

      const indexedQuestions: QuestionItem[] = loadedQuestions.map((q, idx) => ({
        ...q,
        id: `q-${idx}`
      }));

      setQuestions(indexedQuestions);
      setUserAnswers({});
      setCurrentIdx(0);
      setTimeLeftSeconds(3600); // 60 minutes
      setScreen("testing");
    } catch (err) {
      console.error(err);
      setScreen("selector");
    }
  };

  // Handle Option Click
  const selectAnswer = (questionId: string, optionText: string) => {
    // If in Instant Mode and already answered, lock selection so they can read explanation
    if (feedbackMode === "instant" && userAnswers[questionId]) return;

    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionText
    }));
  };

  // Compute Final Score
  const resultsSummary = useMemo(() => {
    let correct = 0;
    questions.forEach((q) => {
      if (userAnswers[q.id] === q.correctAnswer) correct++;
    });
    const total = questions.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, total, pct };
  }, [questions, userAnswers]);

  // =================================================================
  // SCREEN 1: MODULE & SECTION DASHBOARD
  // =================================================================
  if (screen === "selector") {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-slate-50 min-h-screen">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Applied Radiological Anatomy — Modular Study & Exam Portal
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Select a Chapter (Module), pick specific anatomical sections, and choose between Instant Answer mode or a 60-Minute Timed Chapter Exam.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: CHAPTER (MODULE) LIST */}
          <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
              1. Select Chapter (Module)
            </h2>
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {RADIOLOGY_CURRICULUM.map((chap) => {
                const isSelected = selectedChapter.id === chap.id;
                return (
                  <button
                    key={chap.id}
                    onClick={() => handleSelectChapter(chap)}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200"
                    }`}
                  >
                    <div>
                      <div className={`text-xs font-semibold ${isSelected ? "text-blue-100" : "text-blue-600"}`}>
                        {chap.id} • {chap.part.split(" - ")[1]}
                      </div>
                      <div className="font-bold text-sm mt-0.5">{chap.title}</div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      isSelected ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-700"
                    }`}>
                      {chap.sections.length} Sections
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: SECTION SELECTOR & EXAM MODE */}
          <div className="lg:col-span-7 space-y-6">
            {/* Section Checkboxes */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    2. Choose Sections in {selectedChapter.id}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedSections.length} of {selectedChapter.sections.length} sections selected
                  </p>
                </div>
                <div className="space-x-3 text-xs">
                  <button
                    onClick={() => setSelectedSections(selectedChapter.sections)}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Select All (Full Chapter)
                  </button>
                  <button
                    onClick={() => setSelectedSections([])}
                    className="text-slate-500 hover:underline"
                  >
                    Unselect All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {selectedChapter.sections.map((sec) => {
                  const checked = selectedSections.includes(sec);
                  return (
                    <label
                      key={sec}
                      className={`flex items-center space-x-2.5 p-2.5 rounded-lg border cursor-pointer text-xs font-medium transition ${
                        checked
                          ? "bg-blue-50 border-blue-300 text-blue-950"
                          : "bg-white border-slate-200 text-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSection(sec)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="line-clamp-2">{sec}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Mode Configuration */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                3. Answer & Timer Settings
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {/* Option A: 60-Min Timed Exam */}
                <div
                  onClick={() => setFeedbackMode("timed_exam")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                    feedbackMode === "timed_exam"
                      ? "border-blue-600 bg-blue-50/40"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-sm">
                      ⏱️ 60-Minute Chapter Exam
                    </span>
                    <input
                      type="radio"
                      checked={feedbackMode === "timed_exam"}
                      onChange={() => setFeedbackMode("timed_exam")}
                    />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    60-minute countdown timer. Results, total score, and full textbook explanations are revealed only after you end the test.
                  </p>
                </div>

                {/* Option B: Instant Answer Mode */}
                <div
                  onClick={() => setFeedbackMode("instant")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                    feedbackMode === "instant"
                      ? "border-blue-600 bg-blue-50/40"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-sm">
                      ⚡ Instant Answer Mode
                    </span>
                    <input
                      type="radio"
                      checked={feedbackMode === "instant"}
                      onChange={() => setFeedbackMode("instant")}
                    />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Get the correct answer and detailed explanation immediately after clicking an option on each question.
                  </p>
                </div>
              </div>

              {/* Optional toggle to generate extra questions live with AI */}
              <label className="flex items-center space-x-2.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 cursor-pointer mb-5">
                <input
                  type="checkbox"
                  checked={includeFreshAI}
                  onChange={(e) => setIncludeFreshAI(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>
                  <strong>Generate additional AI questions on-the-fly</strong> for the selected sections (requires internet connection; leave unchecked for instant offline-ready question bank).
                </span>
              </label>

              <button
                onClick={startExam}
                disabled={selectedSections.length === 0}
                className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow transition"
              >
                {feedbackMode === "timed_exam"
                  ? `Start 60-Minute ${selectedChapter.id} Exam →`
                  : `Start ${selectedChapter.id} Instant Practice →`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =================================================================
  // SCREEN 2: LOADING STATE
  // =================================================================
  if (screen === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-800">
          Preparing {selectedChapter.id}: {selectedChapter.title}...
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Loading questions for {selectedSections.length} selected section(s)
        </p>
      </div>
    );
  }

  // =================================================================
  // SCREEN 3: ACTIVE TEST (TIMED OR INSTANT)
  // =================================================================
  if (screen === "testing" && questions.length > 0) {
    const currentQ = questions[currentIdx];
    const userSelection = userAnswers[currentQ.id];
    const hasAnswered = Boolean(userSelection);

    return (
      <div className="max-w-3xl mx-auto p-6 my-8 bg-white rounded-2xl shadow-sm border border-slate-200">
        {/* Top Bar with Module Badge & 60-Min Timer */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-200">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md">
              {currentQ.module}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {feedbackMode === "timed_exam" && (
              <div
                className={`px-3.5 py-1.5 rounded-lg font-mono text-sm font-bold flex items-center space-x-1.5 ${
                  timeLeftSeconds < 300
                    ? "bg-red-100 text-red-700 animate-pulse"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                <span>⏱️</span>
                <span>{formatTimer(timeLeftSeconds)}</span>
              </div>
            )}

            <button
              onClick={() => setScreen("results")}
              className="text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 px-3.5 py-2 rounded-lg transition"
            >
              End Test & Get Results
            </button>
          </div>
        </div>

        {/* Question Counter */}
        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>
            Question <strong>{currentIdx + 1}</strong> of {questions.length}
          </span>
          <span>
            Answered: {Object.keys(userAnswers).length} / {questions.length}
          </span>
        </div>

        {/* Question Stem */}
        <h3 className="text-lg font-bold text-slate-900 mb-6 leading-snug">
          {currentQ.question}
        </h3>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {currentQ.options.map((option, i) => {
            const isSelected = userSelection === option;
            const isCorrect = option === currentQ.correctAnswer;

            let btnStyle = "border-slate-200 bg-white hover:bg-slate-50 text-slate-800";

            if (feedbackMode === "timed_exam") {
              if (isSelected) {
                btnStyle = "border-blue-600 bg-blue-50 text-blue-950 font-semibold";
              }
            } else if (feedbackMode === "instant" && hasAnswered) {
              if (isCorrect) {
                btnStyle = "border-green-600 bg-green-50 text-green-950 font-bold";
              } else if (isSelected && !isCorrect) {
                btnStyle = "border-red-500 bg-red-50 text-red-950";
              } else {
                btnStyle = "border-slate-200 bg-slate-50 text-slate-400 opacity-70";
              }
            }

            return (
              <button
                key={i}
                onClick={() => selectAnswer(currentQ.id, option)}
                className={`w-full text-left p-4 rounded-xl border-2 transition flex items-start space-x-3 ${btnStyle}`}
              >
                <span className="font-bold text-sm">{String.fromCharCode(65 + i)}.</span>
                <span className="text-sm flex-1">{option}</span>
              </button>
            );
          })}
        </div>

        {/* INSTANT FEEDBACK EXPLANATION (Only shown during test if mode === 'instant') */}
        {feedbackMode === "instant" && hasAnswered && (
          <div
            className={`p-4 rounded-xl border mb-6 ${
              userSelection === currentQ.correctAnswer
                ? "bg-green-50 border-green-200 text-green-950"
                : "bg-red-50 border-red-200 text-red-950"
            }`}
          >
            <div className="font-bold text-sm mb-1">
              {userSelection === currentQ.correctAnswer
                ? "✅ Correct!"
                : `❌ Incorrect — Correct Answer: ${currentQ.correctAnswer}`}
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              <strong>Explanation:</strong> {currentQ.explanation}
            </p>
          </div>
        )}

        {/* Question Navigation Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
            disabled={currentIdx === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 disabled:opacity-40"
          >
            ← Previous
          </button>

          {currentIdx < questions.length - 1 ? (
            <button
              onClick={() => setCurrentIdx((p) => p + 1)}
              className="px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700"
            >
              Next Question →
            </button>
          ) : (
            <button
              onClick={() => setScreen("results")}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 shadow"
            >
              Finish Exam & View Score ✓
            </button>
          )}
        </div>
      </div>
    );
  }

  // =================================================================
  // SCREEN 4: END-OF-EXAM RESULTS & EXPLANATIONS
  // =================================================================
  return (
    <div className="max-w-4xl mx-auto p-6 my-8 bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="text-center pb-6 mb-6 border-b border-slate-200">
        <span className="text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
          {selectedChapter.id}: {selectedChapter.title}
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 mt-3">
          Final Score: {resultsSummary.pct}%
        </h1>
        <p className="text-slate-600 mt-1">
          You got <strong>{resultsSummary.correct}</strong> out of{" "}
          <strong>{resultsSummary.total}</strong> questions right
        </p>

        {feedbackMode === "timed_exam" && (
          <p className="text-xs text-slate-500 mt-1">
            Time Elapsed: {formatTimer(3600 - timeLeftSeconds)} / 60:00
          </p>
        )}

        <div className="mt-6 flex justify-center space-x-3">
          <button
            onClick={startExam}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition"
          >
            Retake This Chapter Test
          </button>
          <button
            onClick={() => setScreen("selector")}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold px-5 py-2.5 rounded-xl transition"
          >
            Select Another Chapter / Section
          </button>
        </div>
      </div>

      {/* Full Answer Key & Textbook Explanations */}
      <h2 className="text-lg font-bold text-slate-900 mb-4">
        Complete Exam Review & Explanations
      </h2>
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const userAns = userAnswers[q.id];
          const isCorrect = userAns === q.correctAnswer;

          return (
            <div
              key={q.id}
              className={`p-5 rounded-xl border ${
                isCorrect ? "bg-green-50/30 border-green-200" : "bg-red-50/30 border-red-200"
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-700">
                  Q{idx + 1} • {q.module}
                </span>
                <span
                  className={`font-bold px-2.5 py-0.5 rounded ${
                    isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {isCorrect ? "✓ Correct" : userAns ? "✗ Incorrect" : "Unanswered"}
                </span>
              </div>

              <p className="font-semibold text-slate-900 text-sm mb-3">{q.question}</p>

              <div className="text-xs space-y-1 mb-3">
                <div>
                  <span className="text-slate-500 font-medium">Your Answer: </span>
                  <span className={isCorrect ? "text-green-700 font-bold" : "text-red-600 font-bold"}>
                    {userAns || "Not Answered"}
                  </span>
                </div>
                {!isCorrect && (
                  <div>
                    <span className="text-slate-500 font-medium">Correct Answer: </span>
                    <span className="text-green-700 font-bold">{q.correctAnswer}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed">
                <strong>Textbook Explanation: </strong>
                {q.explanation}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}