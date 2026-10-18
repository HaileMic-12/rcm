export interface RawQuestion {
  module: string; // e.g., "Chapter 7 - Pericardial recesses"
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface ParsedQuestion extends RawQuestion {
  id: string;
  chapter: string; // e.g., "Chapter 7"
  section: string; // e.g., "Pericardial recesses"
}

export function processQuestionDatabase(rawQuestions: RawQuestion[]): ParsedQuestion[] {
  return rawQuestions.map((q, index) => {
    // Splits "Chapter 7 - Pericardial recesses" or "Chapter 11 - The GI tract - Esophagus"
    const parts = q.module.split(' - ');
    const chapter = parts[0]?.trim() || 'General';
    const section = parts.slice(1).join(' - ').trim() || 'All Sections';

    return {
      ...q,
      id: `q-${index}`,
      chapter,
      section,
    };
  });
}