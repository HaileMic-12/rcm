import { NextResponse } from "next/server";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import fs from "fs";
import path from "path";

export async function GET() {
  console.log("🚀 Starting Bulk JSON Import...");

  try {
    // Read the questions you pasted into the public folder
    const filePath = path.join(process.cwd(), "public", "manual-questions.json");
    const fileData = fs.readFileSync(filePath, "utf8");
    const questions = JSON.parse(fileData);

    const quizRef = collection(db, "quiz_questions");
    let count = 0;

    // Upload each question to Firebase
    for (const q of questions) {
      await addDoc(quizRef, {
        module: q.module,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        created_at: new Date().toISOString()
      });
      count++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `🎉 Successfully pushed ${count} manual questions to Firebase!` 
    });

  } catch (error: any) {
    console.error("❌ Import error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}