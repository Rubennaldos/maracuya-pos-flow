// src/lib/rtdb.ts
import { initializeApp } from "firebase/app";
import { getDatabase, Database } from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

/**
 * Config de Firebase
 * - Usa variables Vite si existen (VITE_FB_*).
 * - Si no, usa los valores por defecto de tu proyecto actual.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY ?? "AIzaSyCaqH273YfTajeMMVCr_3HEoNffH1XQcFs",
  authDomain: import.meta.env.VITE_FB_PROJECT_ID
    ? `${import.meta.env.VITE_FB_PROJECT_ID}.firebaseapp.com`
    : "pv-maracuya-villa-gratia-4b044.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FB_DB_NAME
    ? `https://${import.meta.env.VITE_FB_DB_NAME}.firebaseio.com`
    : "https://pv-maracuya-villa-gratia-4b044-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FB_PROJECT_ID ?? "pv-maracuya-villa-gratia-4b044",
  storageBucket: import.meta.env.VITE_FB_PROJECT_ID
    ? `${import.meta.env.VITE_FB_PROJECT_ID}.firebasestorage.app`
    : "pv-maracuya-villa-gratia-4b044.firebasestorage.app",
  messagingSenderId: "766387561136",
  appId: "1:766387561136:web:a01c41256e7c6ca47dd175",
};

// --- Inicialización ---
const app = initializeApp(firebaseConfig);
export const rtdb: Database = getDatabase(app);
export const auth = getAuth(app);

/**
 * authReady:
 * Promesa que se resuelve cuando YA hay usuario (usamos login anónimo).
 * Todos nuestros accesos a RTDB esperarán esto primero.
 */
export const authReady: Promise<void> = new Promise((resolve, reject) => {
  let resolved = false;

  onAuthStateChanged(auth, () => {
    if (!resolved) {
      resolved = true;
      resolve();
    }
  });

  // Login anónimo (no cambia tu UI)
  signInAnonymously(auth).catch((e) => {
    console.error("Error en login anónimo:", e);
    reject(e);
  });
});

/**
 * Rutas de la base de datos (igual que tenías)
 */
export const RTDB_PATHS = {
  users: "users",
  products: "products",
  sales: "sales",
  clients: "clients",
  accounts_receivable: "accounts_receivable",
  cash_closes: "cash_closes",
  drafts: "drafts",
  scheduled_sales: "scheduled_sales",
  lunches: "lunches",
  promotions: "promotions",
  unregistered_sales: "unregistered_sales",
  historical_sales: "historical_sales",
  deleted_sales: "deleted_sales",
  config: "config",
  correlatives: "correlatives",
  logs: "logs",

  // Almuerzos
  lunch_menu: "lunch_menu",
  lunch_orders: "lunch_orders",
  lunch_settings: "lunch_settings",
  lunch_combo_templates: "lunch_combo_templates",
  lunch_promos: "lunch_promos",
} as const;
