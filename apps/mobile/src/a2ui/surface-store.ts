import { create } from "zustand";

interface SurfaceState {
  byActivityId: Record<string, Record<string, unknown>>;
  applyActivitySnapshot: (
    messageId: string,
    content: Record<string, unknown>,
    replace?: boolean,
  ) => void;
  loadActivities: (
    items: Array<{
      id: string;
      activityType: string;
      content: Record<string, unknown>;
    }>,
  ) => void;
  clear: () => void;
}

export const useSurfaceStore = create<SurfaceState>((set) => ({
  byActivityId: {},

  applyActivitySnapshot: (messageId, content, replace = true) =>
    set((state) => {
      if (!replace && state.byActivityId[messageId]) return state;
      return {
        byActivityId: {
          ...state.byActivityId,
          [messageId]: content,
        },
      };
    }),

  loadActivities: (items) =>
    set({
      byActivityId: Object.fromEntries(
        items
          .filter((item) =>
            item.activityType === "a2ui" ||
            item.activityType === "a2ui-surface" ||
            item.activityType === "surface",
          )
          .map((item) => [item.id, item.content]),
      ),
    }),

  clear: () => set({ byActivityId: {} }),
}));
