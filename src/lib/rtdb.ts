import { initializeApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

// Firebase configuration - en producción usar variables de entorno
const firebaseConfig = {
  apiKey: "AIzaSyCaqH273YfTajeMMVCr_3HEoNffH1XQcFs",
  authDomain: "pv-maracuya-villa-gratia-4b044.firebaseapp.com",
  databaseURL: "https://pv-maracuya-villa-gratia-4b044-default-rtdb.firebaseio.com",
  projectId: "pv-maracuya-villa-gratia-4b044",
  storageBucket: "pv-maracuya-villa-gratia-4b044.firebasestorage.app",
  messagingSenderId: "766387561136",
  appId: "1:766387561136:web:a01c41256e7c6ca47dd175"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
export const rtdb: Database = getDatabase(app);

// Database paths structure
export const RTDB_PATHS = {
  users: 'users',
  products: 'products',
  sales: 'sales',
  clients: 'clients',
  accounts_receivable: 'accounts_receivable',
  cash_closes: 'cash_closes',
  drafts: 'drafts',
  scheduled_sales: 'scheduled_sales',
  lunches: 'lunches',
  promotions: 'promotions',
  unregistered_sales: 'unregistered_sales',
  config: 'config',
  correlatives: 'correlatives',
  logs: 'logs'
} as const;

export type RTDBPath = keyof typeof RTDB_PATHS;