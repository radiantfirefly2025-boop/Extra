
export type Priority = 'low' | 'medium' | 'high';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  priority: Priority;
}

export interface DayStats {
  secondsRemaining: number;
  formattedDate: string;
  dayName: string;
}

export interface AIInsight {
  tip: string;
  urgency: 'low' | 'medium' | 'high';
}
