import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReminderSettings {
  enabled: boolean;
  time: string; // HH:mm format
  setEnabled: (enabled: boolean) => void;
  setTime: (time: string) => void;
}

export const useReminderStore = create<ReminderSettings>()(
  persist(
    (set) => ({
      enabled: false,
      time: '20:00',
      setEnabled: (enabled) => set({ enabled }),
      setTime: (time) => set({ time }),
    }),
    { name: 'ebook-reminders' },
  ),
);
