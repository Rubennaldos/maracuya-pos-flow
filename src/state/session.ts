import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import CryptoJS from 'crypto-js';
import { rtdbGet } from '../lib/rt';
import { RTDB_PATHS } from '../lib/rtdb';

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'cajero' | 'cobranzas';
  isActive: boolean;
  createdAt: string;
}

interface SessionState {
  isAuthenticated: boolean;
  user: User | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  clearSession: () => void;
}

// Hash PIN using SHA-256 (client-side hashing for demo)
function hashPin(pin: string): string {
  return CryptoJS.SHA256(pin).toString();
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      
      login: async (pin: string): Promise<boolean> => {
        try {
          const pinHash = hashPin(pin);
          console.log('Attempting login with PIN:', pin);
          console.log('Generated hash:', pinHash);
          
          // Get users from RTDB
          const users = await rtdbGet(RTDB_PATHS.users);
          console.log('Users from RTDB:', users);
          
          if (!users) {
            console.error('No users found in database');
            return false;
          }

          // Find user by PIN hash
          const foundUser = Object.values(users).find((user: any) => {
            console.log('Checking user:', user.name, 'Hash:', user.pinHash, 'Expected:', pinHash);
            return user.pinHash === pinHash && user.isActive;
          });

          if (foundUser) {
            const user = foundUser as User;
            console.log('Login successful for user:', user.name);
            set({ 
              isAuthenticated: true, 
              user: {
                id: user.id,
                name: user.name,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt
              }
            });
            return true;
          }

          console.log('Login failed - no matching user found');
          return false;
        } catch (error) {
          console.error('Login error:', error);
          return false;
        }
      },
      
      logout: () => {
        set({ isAuthenticated: false, user: null });
      },

      clearSession: () => {
        set({ isAuthenticated: false, user: null });
      }
    }),
    {
      name: 'maracuya-session',
      partialize: (state) => ({ 
        isAuthenticated: state.isAuthenticated, 
        user: state.user 
      }),
    }
  )
);

// Utility functions for role-based access
export const useUserRole = () => {
  const user = useSession(state => state.user);
  return user?.role || null;
};

export const useCanAccess = (requiredRoles: string[]) => {
  const userRole = useUserRole();
  return userRole ? requiredRoles.includes(userRole) : false;
};

// Admin utilities
export const isAdmin = (user: User | null): boolean => {
  return user?.role === 'admin';
};

export const isCajero = (user: User | null): boolean => {
  return user?.role === 'cajero' || user?.role === 'admin';
};

export const isCobranzas = (user: User | null): boolean => {
  return user?.role === 'cobranzas' || user?.role === 'admin';
};