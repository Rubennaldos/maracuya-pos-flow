// src/state/session.ts
import { create } from 'zustand';
import CryptoJS from 'crypto-js';
import { rtdbGet } from '../lib/rt';
import { RTDB_PATHS } from '../lib/rtdb';

// (opcional) soporte correo/contraseña
import { auth } from '@/lib/rtdb';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'cajero' | 'cobranzas';
  isActive: boolean;
  createdAt: string;
}

interface SessionState {
  // estado en memoria
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;

  // login por PIN (tu flujo original)
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  clearSession: () => void;

  // (opcional) correo/contraseña
  loginWithEmail?: (email: string, password: string) => Promise<boolean>;
  bindAuth?: () => void;
}

// hash PIN demo
function hashPin(pin: string): string {
  return CryptoJS.SHA256(pin).toString();
}

// (opcional) mapeo de rol por correo
const EMAIL_ROLE_MAP: Record<string, User['role']> = {
  'albertonaldos@gmail.com': 'admin',
  // 'cajero@tuemail.com': 'cajero',
  // 'cobranzas@tuemail.com': 'cobranzas',
};

export const useSession = create<SessionState>()((set, get) => ({
  isAuthenticated: false,
  user: null,
  loading: false, // 👈 agregado

  // ===== tu login por PIN (RTDB) =====
  async login(pin: string): Promise<boolean> {
    try {
      const pinHash = hashPin(pin);
      const users = await rtdbGet(RTDB_PATHS.users);
      if (!users) return false;

      const foundUser = Object.values(users).find((u: any) => {
        return u.pinHash === pinHash && u.isActive;
      });

      if (foundUser) {
        const u = foundUser as User;
        set({
          isAuthenticated: true,
          user: {
            id: u.id,
            name: u.name,
            role: u.role,
            isActive: u.isActive,
            createdAt: u.createdAt,
          },
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  // ===== (opcional) login con correo =====
  async loginWithEmail(email: string, password: string): Promise<boolean> {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // bindAuth() actualizará user/isAuthenticated
      return true;
    } catch {
      return false;
    }
  },

  // ===== (opcional) listener de auth =====
  bindAuth() {
    const s: any = get();
    if (s.__boundAuthListener) return;
    s.__boundAuthListener = true;

    set({ loading: true });
    onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser || !fbUser.email) {
        set({ isAuthenticated: false, user: null, loading: false });
        return;
      }
      const email = fbUser.email.toLowerCase();
      const role = EMAIL_ROLE_MAP[email];
      if (!role) {
        set({ isAuthenticated: false, user: null, loading: false });
        return;
      }
      set({
        isAuthenticated: true,
        user: {
          id: fbUser.uid,
          name: fbUser.displayName || email,
          role,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        loading: false,
      });
    });
  },

  logout() {
    try { signOut(auth).catch(() => {}); } catch {}
    set({ isAuthenticated: false, user: null });
  },

  clearSession() {
    set({ isAuthenticated: false, user: null });
  },
}));

// helpers de rol (como los tenías)
export const useUserRole = () => {
  const user = useSession((s) => s.user);
  return user?.role || null;
};

export const useCanAccess = (requiredRoles: string[]) => {
  const role = useUserRole();
  return role ? requiredRoles.includes(role) : false;
};

export const isAdmin = (user: User | null): boolean => user?.role === 'admin';
export const isCajero = (user: User | null): boolean =>
  user?.role === 'cajero' || user?.role === 'admin';
export const isCobranzas = (user: User | null): boolean =>
  user?.role === 'cobranzas' || user?.role === 'admin';
