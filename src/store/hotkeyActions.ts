import { create } from "zustand";

type Handlers = {
  onEnter?: () => void;
  onEsc?: () => void;
  onF2?: () => void;
  onF3?: () => void;
  onF4?: () => void;
  onCtrlEnter?: () => void;
  onCtrlS?: () => void;
  onCtrlP?: () => void;
  onCtrlL?: () => void;
};
type State = { handlers: Handlers; setHandlers: (h: Handlers) => void };

export const useHotkeyActions = create<State>((set) => ({
  handlers: {},
  setHandlers: (handlers) => set({ handlers }),
}));

// Acceso estático para llamar desde listeners sin re-render
export const HotkeyActions = {
  get: () => useHotkeyActions.getState().handlers,
};
