import { NextResponse } from "next/server";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET(req: Request) {
  console.log("🚀 Starting Modular MCQ generation...");

  try {
    const sectionsRef = collection(db, "book_sections");
    const snapshot = await getDocs(sectionsRef);
    
    if (snapshot.empty) return NextResponse.json({ error: "No text found." }, { status: 404 });

    const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
    const quizRef = collection(db, "quiz_questions");
    let totalGenerated = 0;

    for (const doc of snapshot.docs) {
      const text = doc.data().content;
      
      const prompt = `
        You are an expert medical professor. Read the following textbook excerpt and generate exactly 3 challenging multiple-choice questions.
        Return ONLY a raw JSON array of objects. Do not use markdown blocks (\`\`\`json).
        Each object MUST have:
        - "module": A short, broad anatomical category for this topic (e.g., "Thorax", "Neuroanatomy", "Upper Limb", "Abdomen", "Pelvis", "Head & Neck"). Use consistent naming.
        - "question": The question text.
        - "options": An array of exactly 4 strings (1 correct, 3 distractors).
        - "correctAnswer": The exact string from the options array that is correct.
        - "explanation": A 1-2 sentence explanation of why the answer is correct.

        Excerpt:
        ${text}
      `;

      console.log(`🧠 Processing chunk: ${doc.id}...`);
      
      const result = await model.generateContent(prompt);
      const cleanJson = result.response.text().trim().replace(/```json/g, "").replace(/```/g, "");
      
      try {
        const generatedQuestions = JSON.parse(cleanJson);
        for (const q of generatedQuestions) {
          await addDoc(quizRef, {
            module: q.module || "General Anatomy", // Saves the module tag!
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            source_chunk: doc.id,
            created_at: new Date().toISOString()
          });
          totalGenerated++;
        }
      } catch (parseErr) {
        console.error("Skipped a chunk due to JSON format error.");
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return NextResponse.json({ success: true, message: `Success! Generated ${totalGenerated} modular MCQs.` });

  } catch (error: any) {
    console.error("❌ AI error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}