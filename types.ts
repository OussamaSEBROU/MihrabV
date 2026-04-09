
export interface ShelfData {
  id: string;
  name: string;
  color?: string;
}

export interface Annotation {
  id: string;
  type: 'highlight' | 'underline' | 'box' | 'note';
  pageIndex: number;
  x: number; // Percentage
  y: number; // Percentage
  width?: number; // Percentage
  height?: number; // Percentage
  text?: string; // For notes/content
  title?: string; // Title for the modification
  chapter?: string; // Chapter / Bab name
  color: string;
}

export interface Book {
  id: string;
  shelfId: string;
  title: string;
  author: string;
  cover: string;
  content: string;
  timeSpentSeconds: number;
  dailyTimeSeconds?: number; // New: track daily progress
  lastReadDate?: string; // New: YYYY-MM-DD to detect new days
  stars: number;
  addedAt: number;
  lastReadAt?: number;
  lastPage?: number; // New field to resume reading
  sessionTimeSeconds?: number; // Current session accumulated time for notifications
  annotations?: Annotation[];
}

export interface FlashCard {
  id: string;
  bookId: string;
  content: string;
  addedAt: number;
  nextReviewDate: number;
}

export interface HabitData {
  history: string[]; // YYYY-MM-DD (Full days)
  missedDays: string[]; // YYYY-MM-DD (Gaps)
  shields: number;
  streak: number;
  lastUpdated: string; // YYYY-MM-DD
  consecutiveFullDays: number; // Counter for earning shields
}

export enum ViewState {
  SHELF = 'SHELF',
  READER = 'READER',
  VAULT = 'VAULT',
  DASHBOARD = 'DASHBOARD'
}

export type Language = 'en' | 'ar';

export interface Insight {
  text: string;
  icon: React.ReactNode;
  color: string;
  isShining?: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp?: number;
}
