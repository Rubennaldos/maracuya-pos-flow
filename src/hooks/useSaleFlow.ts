// Sale flow management hook
import { useState, useCallback, useEffect } from "react";
import { EnterFlowManager, FlowStep, CartItem } from "@/lib/enterFlow";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { PrintManager } from "@/lib/print";
import { useSession } from "@/state/session";

interface SaleFlowOptions {
  onComplete?: () => void;
  onStepChange?: (step: FlowStep) => void;
}

export const useSaleFlow = (options: SaleFlowOptions = {}) => {
  const { user } = useSession();
  const [flowManager] = useState(() => new EnterFlowManager());
  const [isProcessing, setIsProcessing] = useState(false);

  // Registra callbacks SOLO una vez y cuando cambien las deps
  useEffect(() => {
    const onStep = options.onStepChange ?? (() => {});
    flowManager.onStepChange(onStep);

    flowManager.onComplete(async (finalState) => {
      await processSale(finalState);
      options.onComplete?.();
    });

    // no hay cleanup porque EnterFlowManager administra suscriptores internamente
  }, [flowManager, options.onComplete, options.onStepChange]);

  const processSale = useCallback(
    async (saleData: any) => {
      if (!user) return;

      if (isProcessing) return; // candado extra
      setIsProcessing(true);
      try {
        // 1) Correlativo atómico
        const correlative = await RTDBHelper.getNextCorrelative("sale");

        // 2) Construye objeto de venta (SIN id; lo pone pushData)
        const nowIso = new Date().toISOString();
        const saleBase = {
          correlative,
          date: nowIso,
          cashier: user.id,
          client: saleData.selectedClient ?? null,
          items: saleData.cart,
          subtotal: saleData.total,
          tax: 0,
          total: saleData.total,
          paymentMethod: saleData.paymentMethod,
          type: saleData.saleType,
          status: "completed",
          paid: saleData.paymentMethod !== "credito" ? saleData.total : 0,
          createdBy: user.id,
          createdAt: nowIso,
          origin: saleData.origin ?? "PV", // PV | VH
        };

        // 3) Guarda venta; pushData asigna id automáticamente si no existe
        const saleId = await RTDBHelper.pushData(RTDB_PATHS.sales, saleBase);

        // 4) Si es crédito, registra en cuentas por cobrar
        if (saleData.paymentMethod === "credito" && saleData.selectedClient) {
          const arEntry = {
            saleId,
            correlative,
            clientId: saleData.selectedClient.id,
            clientName: saleData.selectedClient.name || saleData.selectedClient.fullName || "Cliente",
            amount: saleBase.total,
            date: saleBase.date,
            status: "pending",
            type: "sale",
            origin: saleBase.origin,
            items: saleData.cart, // Items visibles en AR
            createdAt: nowIso,
          };
          const arEntryPath =
  `${RTDB_PATHS.accounts_receivable}/${saleData.selectedClient.id}/entries/${saleId}`;
await RTDBHelper.setData(arEntryPath, arEntry); // <-- clave = saleId

        }

        // 5) Comanda de cocina automática (según config)
        const hasKitchenItems = (saleData.cart as CartItem[]).some((i) => i.isKitchen);
        if (hasKitchenItems) {
          const config = await RTDBHelper.getData(RTDB_PATHS.config);
          if (config?.autoPrintKitchen && PrintManager?.printKitchenOrder) {
            await PrintManager.printKitchenOrder({
              id: saleId,
              correlative,
              date: saleBase.date,
              time: new Date().toLocaleTimeString(),
              client: saleData.selectedClient?.fullName || saleData.selectedClient?.name || "Cliente Varios",
              items: (saleData.cart as CartItem[]).filter((i) => i.isKitchen),
              subtotal: saleBase.total,
              total: saleBase.total,
              paymentMethod: saleBase.paymentMethod,
              type: saleBase.type,
              user: (user as any).name ?? user.id,
            });
          }
        }

        // 6) Log de auditoría
        await RTDBHelper.logAction(
          user.id,
          "sale_created",
          {
            saleId,
            correlative,
            total: saleBase.total,
            paymentMethod: saleBase.paymentMethod,
            itemCount: (saleData.cart as CartItem[]).length,
          },
          "sale",
          saleId
        );

        // 7) Reset del flujo
        flowManager.resetFlow();
      } catch (error) {
        console.error("Error processing sale:", error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [user, flowManager, isProcessing]
  );

  const saveDraft = useCallback(async () => {
    if (!user) return;

    const state = flowManager.getState();
    if (state.cart.length === 0) return;

    try {
      const draft = {
        cashier: user.id,
        cart: state.cart,
        saleType: state.saleType,
        total: state.total,
        createdAt: new Date().toISOString(),
      };

      await RTDBHelper.pushData(RTDB_PATHS.drafts, draft);

      // Limpia carrito actual
      flowManager.updateCart([]);

      console.log("Draft saved successfully");
    } catch (error) {
      console.error("Error saving draft:", error);
    }
  }, [user, flowManager]);

  return {
    flowManager,
    isProcessing,
    processSale,
    saveDraft,
  };
};
