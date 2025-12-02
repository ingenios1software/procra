"use client";

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { EventoBorrador } from '@/lib/types';
import isEqual from 'lodash.isequal';

interface DraftState {
  draft: EventoBorrador;
  setDraft: (newDraft: EventoBorrador) => void;
  clearDraft: () => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      draft: {},
      setDraft: (newDraft) => {
        if (!isEqual(get().draft, newDraft)) {
            set({ draft: newDraft });
        }
      },
      clearDraft: () => set({ draft: {} }),
    }),
    {
      name: 'evento-draft-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
    }
  )
);
