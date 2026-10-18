"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/app";
import { db } from "../../lib/firebase";
import Flashcard from "../../components/Flashcard";
import { seedFlashcards } from "../../lib/seedData";

interface CardData {
  id: string;
  front_text: string;
  back_text: string;
  modality: string;
}

export default function StudyPage() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchCards = async () => {
      const querySnapshot = await getDocs(collection(db, "flashcards"));
      const fetchedCards = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CardData[];
      setCards(fetchedCards);
    };

    fetchCards();
  }, []);

  const handleNext = () => {
    if (currentIndex < cards.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center py-20 px-4">
      <div className="w-full max-w-md flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-white">Central Nervous System</h1>
        <span className="text-neutral-400 text-sm">{currentIndex + 1} / {cards.length}</span>
      </div>

      {cards.length > 0 ? (
        <>
          <Flashcard 
            front={cards[currentIndex].front_text} 
            back={cards[currentIndex].back_text}
            modality={cards[currentIndex].modality}
          />
          
          <div className="flex space-x-4 mt-8 w-full max-w-md">
            <button 
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex-1 py-3 rounded-xl bg-neutral-900 text-neutral-300 disabled:opacity-50 transition hover:bg-neutral-800"
            >
              Previous
            </button>
            <button 
              onClick={handleNext}
              disabled={currentIndex === cards.length - 1}
              className="flex-1 py-3 rounded-xl bg-emerald-600 text-white disabled:opacity-50 transition hover:bg-emerald-500"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center mt-20">
          <p className="text-neutral-400 mb-6">No flashcards found.</p>
          <button 
            onClick={seedFlashcards}
            className="px-6 py-2 bg-emerald-600 rounded-lg text-white font-medium"
          >
            Seed Initial Data
          </button>
        </div>
      )}
    </div>
  );
}