import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'cajero' | 'cobranzas';
  pin?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
}

// Demo users - in production this should come from RTDB
const DEMO_USERS: User[] = [
  { id: '1', name: 'Administrador', role: 'admin', pin: '1234' },
  { id: '2', name: 'Cajero Principal', role: 'cajero', pin: '5678' },
  { id: '3', name: 'Cobranzas', role: 'cobranzas', pin: '9999' }
];

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      
      login: async (pin: string) => {
        // Simple PIN validation - in production use hashed PINs from RTDB
        const user = DEMO_USERS.find(u => u.pin === pin);
        if (user) {
          set({ isAuthenticated: true, user });
          return true;
        }
        return false;
      },
      
      logout: () => {
        set({ isAuthenticated: false, user: null });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        isAuthenticated: state.isAuthenticated, 
        user: state.user 
      }),
    }
  )
);