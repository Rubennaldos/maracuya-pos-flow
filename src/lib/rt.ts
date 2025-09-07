import { 
  ref, 
  get, 
  set, 
  push, 
  update, 
  remove,
  onValue,
  off,
  runTransaction,
  DataSnapshot,
  DatabaseReference
} from 'firebase/database';
import { rtdb, RTDB_PATHS } from './rtdb';

// Generic CRUD helpers for RTDB
export class RTDBHelper {
  
  // Get data from path
  static async getData<T = any>(path: string): Promise<T | null> {
    try {
      const snapshot = await get(ref(rtdb, path));
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('Error getting data:', error);
      throw error;
    }
  }

  // Set data at path
  static async setData<T = any>(path: string, data: T): Promise<void> {
    try {
      await set(ref(rtdb, path), data);
    } catch (error) {
      console.error('Error setting data:', error);
      throw error;
    }
  }

  // Push new data (auto-generated key)
  static async pushData<T = any>(path: string, data: T): Promise<string> {
    try {
      const newRef = push(ref(rtdb, path));
      await set(newRef, data);
      return newRef.key!;
    } catch (error) {
      console.error('Error pushing data:', error);
      throw error;
    }
  }

  // Update data at path
  static async updateData(updates: Record<string, any>): Promise<void> {
    try {
      await update(ref(rtdb), updates);
    } catch (error) {
      console.error('Error updating data:', error);
      throw error;
    }
  }

  // Remove data at path
  static async removeData(path: string): Promise<void> {
    try {
      await remove(ref(rtdb, path));
    } catch (error) {
      console.error('Error removing data:', error);
      throw error;
    }
  }

  // Listen to data changes
  static listenToData<T = any>(
    path: string, 
    callback: (data: T | null) => void
  ): () => void {
    const dbRef = ref(rtdb, path);
    
    const unsubscribe = onValue(dbRef, (snapshot: DataSnapshot) => {
      const data = snapshot.exists() ? snapshot.val() : null;
      callback(data);
    });

    return () => off(dbRef, 'value', unsubscribe);
  }

  // Transaction for safe updates (correlatives, counters)
  static async runTransaction<T = any>(
    path: string,
    updateFunction: (currentData: T | null) => T | undefined
  ): Promise<T> {
    try {
      const result = await runTransaction(ref(rtdb, path), updateFunction);
      return result.snapshot.val();
    } catch (error) {
      console.error('Error running transaction:', error);
      throw error;
    }
  }

  // Get next correlative safely
  static async getNextCorrelative(type: 'sale' | 'lunch' | 'historical'): Promise<string> {
    const correlatePath = `${RTDB_PATHS.correlatives}/${type}`;
    
    const nextNumber = await this.runTransaction<number>(
      correlatePath,
      (currentValue) => {
        return (currentValue || 0) + 1;
      }
    );

    // Format correlative based on type
    const prefix = type === 'sale' ? 'B001' : type === 'lunch' ? 'A001' : 'VH001';
    return `${prefix}-${String(nextNumber).padStart(5, '0')}`;
  }

  // Initialize default config if not exists
  static async initializeConfig(): Promise<void> {
    const config = await this.getData(RTDB_PATHS.config);
    
    if (!config) {
      const defaultConfig = {
        printingMode: 'kiosk', // 'kiosk' | 'raw'
        printerName: '',
        autoPrintKitchen: true,
        ticketHeader: 'Maracuyá Tiendas y Concesionarias Saludables\nSEDE VILLA GRATIA\n================================',
        ticketFooter: '================================\nGracias por su compra\nwww.maracuya.com',
        taxRate: 0.18,
        currency: 'PEN'
      };
      
      await this.setData(RTDB_PATHS.config, defaultConfig);
    }
  }

  // Initialize demo users if not exist
  static async initializeDemoUsers(): Promise<void> {
    const users = await this.getData(RTDB_PATHS.users);
    
    if (!users) {
      const demoUsers = {
        admin: {
          id: 'admin',
          name: 'Administrador',
          role: 'admin',
          pinHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', // "secret" en SHA256
          isActive: true,
          createdAt: new Date().toISOString()
        },
        cajero: {
          id: 'cajero',
          name: 'Cajero Principal',
          role: 'cajero',
          pinHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // "1234" en SHA256
          isActive: true,
          createdAt: new Date().toISOString()
        },
        cobranzas: {
          id: 'cobranzas',
          name: 'Cobranzas',
          role: 'cobranzas',
          pinHash: 'c6ee9e33cf5c6715a1d148fd73f7318884b41adcb916021e2bc0e800a5c5dd97', // "9999" en SHA256
          isActive: true,
          createdAt: new Date().toISOString()
        }
      };
      
      await this.setData(RTDB_PATHS.users, demoUsers);
    }
  }

  // Log audit actions
  static async logAction(
    userId: string,
    action: string,
    details: any,
    entityType?: string,
    entityId?: string
  ): Promise<void> {
    const logEntry = {
      userId,
      action,
      details,
      entityType,
      entityId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    const logPath = `${RTDB_PATHS.logs}/${new Date().toISOString().split('T')[0]}`;
    await this.pushData(logPath, logEntry);
  }
}

// Convenience exports
export const rtdbGet = RTDBHelper.getData;
export const rtdbSet = RTDBHelper.setData;
export const rtdbPush = RTDBHelper.pushData;
export const rtdbUpdate = RTDBHelper.updateData;
export const rtdbRemove = RTDBHelper.removeData;
export const rtdbListen = RTDBHelper.listenToData;
export const rtdbTransaction = RTDBHelper.runTransaction;