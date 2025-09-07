// Legacy auth store - migrated to src/state/session.ts
// This file provides compatibility wrapper

import { useSession } from '../state/session';

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'cajero' | 'cobranzas';
}

// Compatibility wrapper that mimics the old zustand store API
export const useAuthStore = (selector?: (state: any) => any) => {
  const session = useSession();
  
  const store = {
    isAuthenticated: session.isAuthenticated,
    user: session.user,
    login: session.login,
    logout: session.logout
  };

  if (selector) {
    return selector(store);
  }
  
  return store;
};