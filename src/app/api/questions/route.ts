import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PREBUILT_QUESTIONS } from "@/data/prebuiltQuestions"; // Paste our generated JSON batches here

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { chapterId, chapterTitle, sections, useAI, questionCount = 15 } = await req.json();

    // 1. Filter pre-built questions matching the selected Chapter & Sections
    const matchedPrebuilt = PREBUILT_QUESTIONS.filter((q) => {
      const startsWithChapter = q.module.toLowerCase().startsWith(chapterId.toLowerCase());
      if (!startsWithChapter) return false;
      if (!sections || sections.length === 0) return true;

      // Match section keywords
      return sections.some((sec: string) =>
        q.module.toLowerCase().includes(sec.split(" ")[0].toLowerCase())
      );
    });

    // If not forcing fresh AI generation and we have pre-built questions, return them immediately (works offline!)
    if (!useAI && matchedPrebuilt.length > 0) {
      return NextResponse.json({ questions: matchedPrebuilt, source: "database" });
    }

    // 2. Otherwise, generate on-demand using Gemini API in the exact same schema
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an expert radiology examiner creating questions based on "Applied Radiological Anatomy" (2nd Edition, Butler, Mitchell, Healy).
      Generate ${questionCount} high-yield multiple-choice questions for:
      Chapter: ${chapterId}: ${chapterTitle}
      Specific Sections to cover: ${sections.join(", ")}

      Return ONLY a raw JSON array where each object follows this exact TypeScript interface:
      {
        "module": "${chapterId} - [Exact Section Name]",
        "question": "Clear clinical or radiological anatomy question stem?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": "Exact string matching one of the 4 options",
        "explanation": "Detailed anatomical explanation referencing imaging appearance (CT/MRI/US/X-ray)."
      }
    `;

    const result = await model.generateContent(prompt);
    const aiQuestions = JSON.parse(result.response.text());

    return NextResponse.json({
      questions: [...matchedPrebuilt, ...aiQuestions],
      source: "hybrid-ai"
    });
  } catch (error) {
    console.error("Error loading/generating questions:", error);
    return NextResponse.json({ error: "Failed to load questions" }, { status: 500 });
  }
}