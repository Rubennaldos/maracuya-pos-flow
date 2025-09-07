// Sale flow management hook
import { useState, useCallback } from 'react';
import { EnterFlowManager, FlowStep, Client, PaymentMethod, CartItem } from '@/lib/enterFlow';
import { RTDBHelper } from '@/lib/rt';
import { RTDB_PATHS } from '@/lib/rtdb';
import { PrintManager } from '@/lib/print';
import { useSession } from '@/state/session';

interface SaleFlowOptions {
  onComplete?: () => void;
  onStepChange?: (step: FlowStep) => void;
}

export const useSaleFlow = (options: SaleFlowOptions = {}) => {
  const { user } = useSession();
  const [flowManager] = useState(() => new EnterFlowManager());
  const [isProcessing, setIsProcessing] = useState(false);

  // Setup callbacks
  flowManager.onStepChange(options.onStepChange || (() => {}));
  flowManager.onComplete(async (finalState) => {
    await processSale(finalState);
    options.onComplete?.();
  });

  const processSale = useCallback(async (saleData: any) => {
    if (!user) return;
    
    setIsProcessing(true);
    try {
      // Generate correlative
      const correlative = await RTDBHelper.getNextCorrelative('sale');
      
      // Create sale object
      const sale = {
        id: `sale_${Date.now()}`,
        correlative,
        date: new Date().toISOString(),
        cashier: user.id,
        client: saleData.selectedClient,
        items: saleData.cart,
        subtotal: saleData.total,
        tax: 0, // Add tax calculation if needed
        total: saleData.total,
        paymentMethod: saleData.paymentMethod,
        type: saleData.saleType,
        status: 'completed',
        paid: saleData.paymentMethod !== 'credito' ? saleData.total : 0,
        createdBy: user.id,
        createdAt: new Date().toISOString()
      };

      // Save to RTDB
      await RTDBHelper.pushData(RTDB_PATHS.sales, sale);

      // If credit sale, add to accounts receivable
      if (saleData.paymentMethod === 'credito' && saleData.selectedClient) {
        const arEntry = {
          saleId: sale.id,
          correlative: sale.correlative,
          clientId: saleData.selectedClient.id,
          amount: sale.total,
          date: sale.date,
          status: 'pending',
          type: 'sale'
        };
        
        const arPath = `${RTDB_PATHS.accounts_receivable}/${saleData.selectedClient.id}/entries`;
        await RTDBHelper.pushData(arPath, arEntry);
      }

      // Print kitchen order if needed
      const hasKitchenItems = saleData.cart.some((item: CartItem) => item.isKitchen);
      if (hasKitchenItems) {
        const config = await RTDBHelper.getData(RTDB_PATHS.config);
        if (config?.autoPrintKitchen) {
          await PrintManager.printKitchenOrder({
            id: sale.id,
            correlative: sale.correlative,
            date: sale.date,
            time: new Date().toLocaleTimeString(),
            client: saleData.selectedClient?.fullName || 'Cliente Varios',
            items: saleData.cart.filter((item: CartItem) => item.isKitchen),
            subtotal: sale.total,
            total: sale.total,
            paymentMethod: sale.paymentMethod,
            type: sale.type,
            user: user.name
          });
        }
      }

      // Log action
      await RTDBHelper.logAction(
        user.id,
        'sale_created',
        {
          saleId: sale.id,
          correlative: sale.correlative,
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          itemCount: saleData.cart.length
        },
        'sale',
        sale.id
      );

      // Reset flow
      flowManager.resetFlow();
      
    } catch (error) {
      console.error('Error processing sale:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [user, flowManager]);

  const saveDraft = useCallback(async () => {
    if (!user) return;

    const state = flowManager.getState();
    if (state.cart.length === 0) return;

    try {
      const draft = {
        id: `draft_${Date.now()}`,
        cashier: user.id,
        cart: state.cart,
        saleType: state.saleType,
        total: state.total,
        createdAt: new Date().toISOString()
      };

      await RTDBHelper.pushData(RTDB_PATHS.drafts, draft);
      
      // Clear current cart
      flowManager.updateCart([]);
      
      console.log('Draft saved successfully');
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [user, flowManager]);

  return {
    flowManager,
    isProcessing,
    processSale,
    saveDraft
  };
};