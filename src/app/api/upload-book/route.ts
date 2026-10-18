import { NextResponse } from "next/server";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import fs from "fs";
import path from "path";

export async function GET() {
  console.log("🚀 Starting Full Book Upload to Firebase...");

  try {
    // 1. Read the giant JSON file your extract.js script created
    const filePath = path.join(process.cwd(), "public", "book-text.json");
    const fileData = fs.readFileSync(filePath, "utf8");
    const { text } = JSON.parse(fileData);

    // 2. Break it down into 3,000 character chunks
    const chunkSize = 3000;
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }

    console.log(`✅ Sliced book into ${chunks.length} chunks. Uploading now...`);

    // 3. Upload ALL chunks to Firebase
    const sectionsRef = collection(db, "book_sections");
    let uploadedCount = 0;

    for (const chunk of chunks) {
      // Skip empty chunks
      if (chunk.trim().length < 50) continue; 

      await addDoc(sectionsRef, {
        content: chunk,
        uploaded_at: new Date().toISOString()
      });
      uploadedCount++;
    }

    console.log(`🎉 ALL DONE! Uploaded ${uploadedCount} chunks to Firebase.`);
    return NextResponse.json({ 
      success: true, 
      message: `Successfully uploaded ${uploadedCount} chunks of the book to Firebase!` 
    });

  } catch (error: any) {
    console.error("❌ Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}