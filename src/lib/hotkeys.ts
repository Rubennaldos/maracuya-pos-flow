// src/lib/hotkeys.ts
// Captura global de hotkeys con tolerancia y soporte Ctrl/Cmd

export type HotkeyMap = {
  onEnter?: () => void;
  onEsc?: () => void;
  onF2?: () => void;
  onF3?: () => void;
  onF4?: () => void;
  onCtrlEnter?: () => void; // alternos
  onCtrlS?: () => void;
  onCtrlP?: () => void;
  onCtrlL?: () => void;
};

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  const ce = el.isContentEditable === true || el.getAttribute("contenteditable") === "true";
  // Permitir Enter global si el input lo pide explícitamente
  const allowEnter = (el.getAttribute("data-hotkey-allow") || "")
    .toLowerCase()
    .includes("enter");
  if (allowEnter) return false;
  return tag === "input" || tag === "textarea" || tag === "select" || ce;
}

function keyLower(e: KeyboardEvent) {
  // F-keys vienen como 'F2', 'F3'... y letras como 's', 'p' etc.
  const k = e.key ?? "";
  return /^[Ff]\d+$/.test(k) ? k.toUpperCase() : k.toLowerCase();
}

function isCtrlLike(e: KeyboardEvent) {
  // Ctrl en Win/Linux o Command en macOS
  return e.ctrlKey || e.metaKey;
}

// ---------- De-dupe & throttle ----------
const pressedOnce = new Set<string>();
const lastFireAt: Record<string, number> = {};
const THROTTLE_MS = 200; // evita repeticiones muy rápidas

const makeId = (e: KeyboardEvent) =>
  `${isCtrlLike(e) ? "M-" : ""}${keyLower(e)}`; // M- = ctrl/meta

function shouldThrottle(id: string) {
  const now = Date.now();
  const last = lastFireAt[id] || 0;
  if (now - last < THROTTLE_MS) return true;
  lastFireAt[id] = now;
  return false;
}

function handle(map: HotkeyMap, e: KeyboardEvent) {
  const typing = isTypingTarget(e.target);
  const key = keyLower(e);

  // --- combinaciones Ctrl/Cmd siempre permitidas, incluso escribiendo ---
  if (isCtrlLike(e) && key === "enter" && map.onCtrlEnter) {
    e.preventDefault();
    map.onCtrlEnter();
    return;
  }
  if (isCtrlLike(e) && key === "s" && map.onCtrlS) {
    e.preventDefault();
    map.onCtrlS();
    return;
  }
  if (isCtrlLike(e) && key === "p" && map.onCtrlP) {
    e.preventDefault();
    map.onCtrlP();
    return;
  }
  if (isCtrlLike(e) && key === "l" && map.onCtrlL) {
    e.preventDefault();
    map.onCtrlL();
    return;
  }

  // Si estás escribiendo, no dispares el resto de globales
  if (typing) return;

  // --- globales sin modificadores ---
  if (key === "enter" && map.onEnter) {
    e.preventDefault();
    map.onEnter();
    return;
  }
  if (key === "escape" && map.onEsc) {
    e.preventDefault();
    map.onEsc();
    return;
  }
  if (key === "F2" && map.onF2) {
    e.preventDefault();
    map.onF2();
    return;
  }
  if (key === "F3" && map.onF3) {
    e.preventDefault();
    map.onF3();
    return;
  }
  if (key === "F4" && map.onF4) {
    e.preventDefault();
    map.onF4();
    return;
  }
}

/**
 * Registra hotkeys globales y devuelve una función para desregistrarlas.
 */
export function bindHotkeys(map: HotkeyMap) {
  const kd = (e: KeyboardEvent) => {
    // de-dupe: procesa solo una vez por pulsación
    const id = makeId(e);
    if (pressedOnce.has(id)) return;
    pressedOnce.add(id);

    // throttle adicional para evitar repeticiones fantasma
    if (shouldThrottle(id)) return;

    handle(map, e);
  };

  const ku = (e: KeyboardEvent) => {
    // libera la tecla para permitir futuros disparos
    pressedOnce.delete(makeId(e));
  };

  // Usamos solo window para evitar dobles notificaciones entre document/window
  window.addEventListener("keydown", kd, { passive: false, capture: true });
  window.addEventListener("keyup", ku, { passive: false, capture: true });

  return () => {
    window.removeEventListener("keydown", kd, { capture: true } as any);
    window.removeEventListener("keyup", ku, { capture: true } as any);
    pressedOnce.clear();
  };
}
