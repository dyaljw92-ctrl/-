import { WordDetail } from "./lib/gemini";

export interface WordProgress {
  word: string;
  magicValue: number; // 0-100
  lastReview: number; // timestamp
  nextReview: number; // timestamp
  correctCount: number;
  isMastered: boolean;
  details?: WordDetail;
}

export interface OwlStats {
  name: string;
  level: number;
  experience: number;
  hunger: number; // 0-100
  totalMagic: number;
}

export interface AppState {
  words: WordProgress[];
  currentSession: {
    words: string[];
    story?: any;
    wordDetails?: any[];
    quiz?: any[];
  } | null;
}

export const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15]; // days

export function calculateNextReview(correctCount: number): number {
  const days = EBBINGHAUS_INTERVALS[Math.min(correctCount, EBBINGHAUS_INTERVALS.length - 1)];
  return Date.now() + days * 24 * 60 * 60 * 1000;
}
