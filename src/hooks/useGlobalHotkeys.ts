// Global hotkeys hook for POS system
import { useEffect, useCallback } from 'react';

export interface HotkeyHandlers {
  onEnter?: () => void;
  onEscape?: () => void;
  onF2?: () => void; // Borrador
  onF3?: () => void; // Venta programada
  onF4?: () => void; // Almuerzos
  onCtrlEnter?: () => void; // Procesar venta alternativo
  onCtrlS?: () => void; // Borrador alternativo
  onCtrlP?: () => void; // Programada alternativo
  onCtrlL?: () => void; // Almuerzos alternativo
}

export const useGlobalHotkeys = (handlers: HotkeyHandlers) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if user is typing in input fields
    const activeElement = document.activeElement;
    const isTyping = activeElement instanceof HTMLInputElement || 
                    activeElement instanceof HTMLTextAreaElement ||
                    activeElement instanceof HTMLSelectElement ||
                    activeElement?.tagName === 'INPUT' ||
                    activeElement?.tagName === 'TEXTAREA' ||
                    activeElement?.tagName === 'SELECT';

    // Allow Ctrl+Enter even when typing
    if (event.ctrlKey && event.key === 'Enter' && handlers.onCtrlEnter) {
      event.preventDefault();
      handlers.onCtrlEnter();
      return;
    }

    // Ignore other hotkeys when typing
    if (isTyping) return;

    switch (event.key) {
      case 'Enter':
        if (handlers.onEnter) {
          event.preventDefault();
          handlers.onEnter();
        }
        break;
      
      case 'Escape':
        if (handlers.onEscape) {
          event.preventDefault();
          handlers.onEscape();
        }
        break;
      
      case 'F2':
        if (handlers.onF2) {
          event.preventDefault();
          handlers.onF2();
        }
        break;
      
      case 'F3':
        if (handlers.onF3) {
          event.preventDefault();
          handlers.onF3();
        }
        break;
      
      case 'F4':
        if (handlers.onF4) {
          event.preventDefault();
          handlers.onF4();
        }
        break;
    }

    // Handle Ctrl combinations
    if (event.ctrlKey) {
      switch (event.key) {
        case 's':
          if (handlers.onCtrlS) {
            event.preventDefault();
            handlers.onCtrlS();
          }
          break;
        
        case 'p':
          if (handlers.onCtrlP) {
            event.preventDefault();
            handlers.onCtrlP();
          }
          break;
        
        case 'l':
          if (handlers.onCtrlL) {
            event.preventDefault();
            handlers.onCtrlL();
          }
          break;
      }
    }
  }, [handlers]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};