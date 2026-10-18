"use client";

import { useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Image from "next/image"; // Next.js optimized images

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FlashcardProps {
  front: string;
  back: string;
  modality?: string;
  imageUrl?: string; // Added optional image prop
}

export default function Flashcard({ front, back, modality, imageUrl }: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className="group h-96 w-full max-w-md perspective-1000 cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={cn(
        "relative h-full w-full rounded-2xl transition-transform duration-500 transform-style-3d shadow-xl border border-neutral-800",
        isFlipped ? "rotate-y-180" : ""
      )}>
        
        {/* Front of Card */}
        <div className="absolute inset-0 backface-hidden bg-neutral-900 rounded-2xl p-6 flex flex-col justify-center items-center text-center overflow-hidden">
          {modality && (
            <span className="absolute top-4 left-4 z-10 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-800/50">
              {modality}
            </span>
          )}
          
          {imageUrl && (
            <div className="relative w-full h-40 mb-4 rounded-lg overflow-hidden border border-neutral-800">
              <img src={imageUrl} alt="Radiology Scan" className="object-cover w-full h-full" />
            </div>
          )}

          <h3 className="text-xl font-medium text-neutral-100 leading-relaxed">
            {front}
          </h3>
          <p className="absolute bottom-4 text-xs text-neutral-500">Tap to reveal</p>
        </div>

        {/* Back of Card */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-emerald-950 rounded-2xl p-8 flex flex-col justify-center items-center text-center border border-emerald-900 overflow-y-auto">
          <h3 className="text-lg font-medium text-emerald-50 leading-relaxed">
            {back}
          </h3>
        </div>

      </div>
    </div>
  );
}