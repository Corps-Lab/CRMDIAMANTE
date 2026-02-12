import { useEffect, useMemo, useState } from "react";

export type WeightLog = { weight: number; date: string; bodyFatPercentage?: number; notes?: string };
export type StrengthRecord = {
  id: string;
  exercise_name: string;
  initial_weight?: number | null;
  current_weight?: number | null;
  unit?: string;
};

type Mutation<T> = {
  mutate: (payload: T, opts?: { onSuccess?: () => void }) => void;
  isPending: boolean;
};

const WEIGHT_KEY = "fit_progress_weight_logs";
const STRENGTH_KEY = "fit_progress_strength_records";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors (private / quota)
  }
}

export function useProgress() {
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [strengthRecords, setStrengthRecords] = useState<StrengthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setWeightLogs(loadFromStorage<WeightLog[]>(WEIGHT_KEY, []));
    setStrengthRecords(loadFromStorage<StrengthRecord[]>(STRENGTH_KEY, []));
    setIsLoading(false);
  }, []);

  const addWeightLog: Mutation<{ weight: number; bodyFatPercentage?: number; notes?: string }> = {
    isPending: false,
    mutate: (payload, opts) => {
      const now = new Date();
      const entry: WeightLog = {
        weight: payload.weight,
        bodyFatPercentage: payload.bodyFatPercentage,
        notes: payload.notes,
        date: now.toISOString(),
      };
      const next = [entry, ...weightLogs].slice(0, 90);
      setWeightLogs(next);
      saveToStorage(WEIGHT_KEY, next);
      opts?.onSuccess?.();
    },
  };

  const upsertStrengthRecord: Mutation<{ id?: string; exerciseName: string; initialWeight?: number; currentWeight: number; unit: string }> = {
    isPending: false,
    mutate: (payload, opts) => {
      const id = payload.id || `${Date.now()}`;
      const existingIdx = strengthRecords.findIndex((r) => r.id === id);
      const record: StrengthRecord = {
        id,
        exercise_name: payload.exerciseName.trim(),
        initial_weight: payload.initialWeight ?? null,
        current_weight: payload.currentWeight,
        unit: payload.unit,
      };
      const next = [...strengthRecords];
      if (existingIdx >= 0) next[existingIdx] = record;
      else next.unshift(record);
      setStrengthRecords(next);
      saveToStorage(STRENGTH_KEY, next);
      opts?.onSuccess?.();
    },
  };

  const deleteStrengthRecord: Mutation<string> = {
    isPending: false,
    mutate: (id, opts) => {
      const next = strengthRecords.filter((r) => r.id !== id);
      setStrengthRecords(next);
      saveToStorage(STRENGTH_KEY, next);
      opts?.onSuccess?.();
    },
  };

  const getWeeklyStats = () => {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    const completedSet = new Set(
      weightLogs
        .map((w) => {
          const d = new Date(w.date);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })
        .filter((t) => !Number.isNaN(t))
    );
    return days.map((label, idx) => {
      const d = new Date(today.getTime() - (today.getDay() - idx) * dayMs);
      const ts = d.getTime();
      return { label, completed: completedSet.has(ts) };
    });
  };

  const calculateStreak = () => {
    let current = 0;
    let longest = 0;
    const sorted = [...weightLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let prevDay: number | null = null;
    sorted.forEach((item) => {
      const d = new Date(item.date);
      d.setHours(0, 0, 0, 0);
      const ts = d.getTime();
      if (prevDay === null || prevDay - ts === 24 * 60 * 60 * 1000) {
        current += 1;
      } else if (prevDay === ts) {
        // same day, ignore
      } else {
        current = 1;
      }
      longest = Math.max(longest, current);
      prevDay = ts;
    });
    return { current, longest };
  };

  const getWeightChartData = () => {
    const data = [...weightLogs]
      .slice(0, 12)
      .reverse()
      .map((item, idx) => ({
        week: `#${idx + 1}`,
        weight: item.weight,
      }));
    return data;
  };

  return {
    weightLogs,
    strengthRecords,
    isLoading,
    getWeeklyStats,
    calculateStreak,
    getWeightChartData,
    addWeightLog,
    upsertStrengthRecord,
    deleteStrengthRecord,
  };
}
