import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GoalState {
  dailyGoalMinutes: number;
  setDailyGoal: (minutes: number) => void;
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set) => ({
      dailyGoalMinutes: 30,
      setDailyGoal: (minutes) => set({ dailyGoalMinutes: minutes }),
    }),
    { name: 'ebook-goals' },
  ),
);
