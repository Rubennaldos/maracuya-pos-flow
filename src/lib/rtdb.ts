// src/lib/rtdb.ts
import { initializeApp } from "firebase/app";
import { getDatabase, Database } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY ?? "AIzaSyCaqH273YfTajeMMVCr_3HEoNffH1XQcFs",
  authDomain: import.meta.env.VITE_FB_PROJECT_ID
    ? `${import.meta.env.VITE_FB_PROJECT_ID}.firebaseapp.com`
    : "pv-maracuya-villa-gratia-4b044.firebaseapp.com",
  databaseURL:
    import.meta.env.VITE_FB_DB_NAME
      ? `https://${import.meta.env.VITE_FB_DB_NAME}.firebaseio.com`
      : "https://pv-maracuya-villa-gratia-4b044-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FB_PROJECT_ID ?? "pv-maracuya-villa-gratia-4b044",
  // No usamos Firebase Storage
  storageBucket:
    import.meta.env.VITE_FB_PROJECT_ID
      ? `${import.meta.env.VITE_FB_PROJECT_ID}.firebasestorage.app`
      : "pv-maracuya-villa-gratia-4b044.firebasestorage.app",
  messagingSenderId: "766387561136",
  appId: "1:766387561136:web:a01c41256e7c6ca47dd175",
};

const app = initializeApp(firebaseConfig);
export const rtdb: Database = getDatabase(app);
export const auth = getAuth(app); // 👈 importante para EmailLogin y guardias

// Rutas de la base de datos
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

  // 👇 Almuerzos
  lunch_menu: "lunch_menu",
  lunch_orders: "lunch_orders",
  lunch_settings: "lunch_settings",
  // 👇 Plantillas/favoritos de combos
  lunch_combo_templates: "lunch_combo_templates",
} as const;
