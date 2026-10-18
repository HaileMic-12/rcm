import { NextResponse } from "next/server";
import { collection, getDocs, addDoc, query, limit } from "firebase/firestore";
import { db } from "../../../lib/firebase"; // Adjust path if your firebase file is elsewhere
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Adding "req: Request" forces Next.js to skip the cache and run dynamically!
export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams; // Bypasses cache natively
  
  console.log("🚀 API Route Triggered! Starting Gemini generation...");

  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ Missing API Key in .env.local");
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    const sectionsRef = collection(db, "book_sections");
    const q = query(sectionsRef, limit(3));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.error("❌ No text chunks found in the database.");
      return NextResponse.json({ error: "No text chunks found in database." }, { status: 404 });
    }

    console.log(`✅ Found ${snapshot.size} chunks in Firebase. Starting AI loop...`);
const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
    const flashcardsRef = collection(db, "flashcards");
    let totalGenerated = 0;

    for (const doc of snapshot.docs) {
      const text = doc.data().content;
      
      const prompt = `
        You are an expert medical professor creating study materials for radiology students.
        Read the following textbook excerpt and generate exactly 3 high-yield flashcards.
        Return ONLY a raw JSON array of objects. Do not use markdown blocks (\`\`\`json).
        Each object must have a "question" and an "answer".
        Make the questions challenging and the answers concise.

        Excerpt:
        ${text}
      `;

      console.log(`🧠 Asking Gemini to process chunk: ${doc.id}... (this takes a few seconds)`);
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      
      console.log(`✅ Gemini responded for chunk ${doc.id}! Saving to database...`);
      
      // Clean up the response in case Gemini includes markdown formatting
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "");
      const generatedCards = JSON.parse(cleanJson);

      for (const card of generatedCards) {
        await addDoc(flashcardsRef, {
          question: card.question,
          answer: card.answer,
          source_chunk: doc.id,
          created_at: new Date().toISOString()
        });
        totalGenerated++;
      }
      
      // Pause for 2 seconds to avoid hitting free-tier rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`🎉 ALL DONE! Successfully generated ${totalGenerated} cards.`);
    return NextResponse.json({ 
      success: true, 
      message: `Success! Gemini AI generated ${totalGenerated} flashcards. Timestamp: ${Date.now()}` 
    });

  } catch (error: any) {
    console.error("❌ AI Generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}