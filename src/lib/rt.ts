// src/lib/rt.ts
import {
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue,
  runTransaction,
  DataSnapshot,
} from "firebase/database";
import { rtdb, RTDB_PATHS } from "./rtdb";

// Helpers genéricos para RTDB
export class RTDBHelper {
  // Get data
  static async getData<T = any>(path: string): Promise<T | null> {
    try {
      const snapshot = await get(ref(rtdb, path));
      return snapshot.exists() ? (snapshot.val() as T) : null;
    } catch (error) {
      console.error("Error getting data:", error);
      throw error;
    }
  }

  // Set data (replace)
  static async setData<T = any>(path: string, data: T): Promise<void> {
    try {
      await set(ref(rtdb, path), data as any);
    } catch (error) {
      console.error("Error setting data:", error);
      throw error;
    }
  }

  // Push data con id automático; si el payload NO trae id, lo añade
  static async pushData<T extends Record<string, any> = any>(path: string, data: T): Promise<string> {
    try {
      const newRef = push(ref(rtdb, path));
      const key = newRef.key!;
      const payload =
        data && typeof data === "object" && !("id" in data) ? { ...data, id: key } : data;
      await set(newRef, payload as any);
      return key;
    } catch (error) {
      console.error("Error pushing data:", error);
      throw error;
    }
  }

  // Update múltiples rutas (fan-out)
  static async updateData(updates: Record<string, any>): Promise<void> {
    try {
      await update(ref(rtdb), updates);
    } catch (error) {
      console.error("Error updating data:", error);
      throw error;
    }
  }

  // Remove (single path)
  static async removeData(path: string): Promise<void> {
    try {
      await remove(ref(rtdb, path));
    } catch (error) {
      console.error("Error removing data:", error);
      throw error;
    }
  }

  // Listener (devuelve función para desuscribir)
  static listenToData<T = any>(path: string, callback: (data: T | null) => void): () => void {
    const dbRef = ref(rtdb, path);
    const unsubscribe = onValue(dbRef, (snapshot: DataSnapshot) => {
      const data = snapshot.exists() ? (snapshot.val() as T) : null;
      callback(data);
    });
    return unsubscribe; // onValue v9 devuelve fn de cleanup
  }

  // Transacción segura (contadores, correlativos)
  static async runTransaction<T = any>(
    path: string,
    updateFunction: (currentData: T | null) => T | undefined
  ): Promise<T> {
    try {
      const result = await runTransaction(ref(rtdb, path), updateFunction as any);
      return result.snapshot.val() as T;
    } catch (error) {
      console.error("Error running transaction:", error);
      throw error;
    }
  }

  // Siguiente correlativo con prefijo por tipo
  static async getNextCorrelative(type: "sale" | "lunch" | "historical"): Promise<string> {
    const correlatePath = `${RTDB_PATHS.correlatives}/${type}`;
    const nextNumber = await this.runTransaction<number>(correlatePath, (currentValue) => {
      return (currentValue || 0) + 1;
    });
    const prefix = type === "sale" ? "B001" : type === "lunch" ? "A001" : "VH001";
    return `${prefix}-${String(nextNumber).padStart(5, "0")}`;
  }

  // Config por defecto si no existe
  static async initializeConfig(): Promise<void> {
    const config = await this.getData(RTDB_PATHS.config);
    if (!config) {
      const defaultConfig = {
        printingMode: "kiosk", // 'kiosk' | 'raw'
        printerName: "",
        autoPrintKitchen: true,
        ticketHeader:
          "Maracuyá Tiendas y Concesionarias Saludables\nSEDE VILLA GRATIA\n================================",
        ticketFooter:
          "================================\nGracias por su compra\nwww.maracuya.com",
        taxRate: 0.18,
        currency: "PEN",
      };
      await this.setData(RTDB_PATHS.config, defaultConfig);
    }
  }

  // Usuarios demo si no existen (HASHES CORRECTOS)
  static async initializeDemoUsers(): Promise<void> {
    const users = await this.getData(RTDB_PATHS.users);
    if (!users) {
      const demoUsers = {
        admin: {
          id: "admin",
          name: "Administrador",
          role: "admin",
          pinHash:
            "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4", // 1234
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        cajero: {
          id: "cajero",
          name: "Cajero Principal",
          role: "cajero",
          pinHash:
            "f8638b979b2f4f793ddb6dbd197e0ee25a7a6ea32b0ae22f5e3c5d119d839e75", // 5678
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        cobranzas: {
          id: "cobranzas",
          name: "Cobranzas",
          role: "cobranzas",
          pinHash:
            "888df25ae35772424a560c7152a1de794440e0ea5cfee62828333a456a506e05", // 9999
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      };
      await this.setData(RTDB_PATHS.users, demoUsers);
      console.log("Demo users initialized with correct PIN hashes");
    }
  }

  // Log de auditoría (best effort)
  static async logAction(
    userId: string,
    action: string,
    details: any,
    entityType?: string,
    entityId?: string
  ): Promise<void> {
    try {
      const logEntry = {
        userId,
        action,
        details,
        entityType,
        entityId,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      };
      const dayKey = new Date().toISOString().split("T")[0];
      const logPath = `${RTDB_PATHS.logs}/${dayKey}`;
      await this.pushData(logPath, logEntry);
    } catch {
      // no bloquear nada por el log
    }
  }

  /**
   * 🔥 Eliminación en cascada (a la papelera) de una venta:
   *  - Mueve /sales/{saleId} -> /deleted_sales/{saleId} con metadatos
   *  - Borra entradas en /accounts_receivable/{clientId}/entries/{saleId|autoId} que apunten a esa venta
   *  - Borra espejo plano legado /accounts_receivable/{saleId}
   */
  static async deleteSaleCascade(saleId: string, deletedBy: string = "system"): Promise<void> {
    const salePath = `${RTDB_PATHS.sales}/${saleId}`;
    const sale = await this.getData<any>(salePath);

    if (!sale) {
      console.error("Sale not found:", saleId);
      return;
    }

    const updates: Record<string, any> = {};

    // 1) Mover a papelera con metadatos
    const deletedSaleData = {
      ...sale,
      deletedAt: new Date().toISOString(),
      deletedBy,
    };
    updates[`${RTDB_PATHS.deleted_sales}/${saleId}`] = deletedSaleData;

    // 2) Borrar venta original
    updates[salePath] = null;

    // 3) Borrar espejo plano legado (si existiera)
    updates[`${RTDB_PATHS.accounts_receivable}/${saleId}`] = null;

    // 4) Borrar entradas por cliente en /accounts_receivable/{clientId}/entries/*
    let clientId: string | undefined = sale?.client?.id || sale?.clientId || undefined;

    const removeEntriesForClient = async (cid: string) => {
      const entriesPath = `${RTDB_PATHS.accounts_receivable}/${cid}/entries`;
      const entries = await this.getData<Record<string, any>>(entriesPath);
      if (!entries) return;

      for (const [entryKey, entryVal] of Object.entries(entries)) {
        // borrar si la key es el saleId o si el payload referencia saleId
        if (entryKey === saleId || (entryVal as any)?.saleId === saleId) {
          updates[`${entriesPath}/${entryKey}`] = null;
        }
      }
    };

    if (clientId) {
      await removeEntriesForClient(clientId);
    } else {
      // Fallback: escanear todo AR para encontrar referencias (seguro y simple)
      const arRoot = await this.getData<Record<string, any>>(RTDB_PATHS.accounts_receivable);
      if (arRoot) {
        for (const [cid, node] of Object.entries(arRoot)) {
          const entries = (node as any)?.entries;
          if (!entries) continue;
          for (const [entryKey, entryVal] of Object.entries<any>(entries)) {
            if (entryKey === saleId || entryVal?.saleId === saleId) {
              updates[`${RTDB_PATHS.accounts_receivable}/${cid}/entries/${entryKey}`] = null;
              clientId = cid;
            }
          }
        }
      }
    }

    // Fan-out single update
    await this.updateData(updates);

    // Log best-effort
    await this.logAction(
      deletedBy,
      "sale_moved_to_trash",
      { saleId, clientId: clientId ?? null },
      "sale",
      saleId
    );
  }

  /**
   * 🗂 Si usas aún /historical_sales, también puedes moverlas a papelera.
   * (Ojo: tus ventas históricas actuales se guardan en /sales con type:"historical")
   */
  static async deleteHistoricalSale(saleId: string, deletedBy: string = "system"): Promise<void> {
    const salePath = `${RTDB_PATHS.historical_sales}/${saleId}`;
    const sale = await this.getData<any>(salePath);

    if (!sale) {
      console.error("Historical sale not found:", saleId);
      return;
    }

    const updates: Record<string, any> = {};

    // mover venta histórica a papelera
    const deletedSaleData = {
      ...sale,
      type: "historical",
      deletedAt: new Date().toISOString(),
      deletedBy,
    };
    updates[`${RTDB_PATHS.deleted_sales}/${saleId}`] = deletedSaleData;

    // borrar venta histórica original
    updates[salePath] = null;

    await this.updateData(updates);

    await this.logAction(
      deletedBy,
      "historical_sale_moved_to_trash",
      { saleId },
      "historical_sale",
      saleId
    );
  }
}

// Atajos convenientes
export const rtdbGet = RTDBHelper.getData;
export const rtdbSet = RTDBHelper.setData;
export const rtdbPush = RTDBHelper.pushData;
export const rtdbUpdate = RTDBHelper.updateData;
export const rtdbRemove = RTDBHelper.removeData;
export const rtdbListen = RTDBHelper.listenToData;
export const rtdbTransaction = RTDBHelper.runTransaction;
