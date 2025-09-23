// Enter Flow Handler for POS System
export type FlowStep = 
  | 'products' 
  | 'client' 
  | 'payment' 
  | 'confirmation' 
  | 'complete';

export interface FlowState {
  step: FlowStep;
  cart: CartItem[];
  selectedClient: Client | null;
  paymentMethod: PaymentMethod;
  total: number;
  saleType: 'normal' | 'scheduled' | 'lunch';
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isKitchen: boolean;
  notes?: string;
}

export interface Client {
  id: string;
  names: string;
  lastNames: string;
  fullName: string;
  hasAccount: boolean;
  grade?: string;
  level?: 'primaria' | 'secundaria' | 'Kinder';
  isActive: boolean;
}

export type PaymentMethod = 'efectivo' | 'credito' | 'transferencia' | 'yape' | 'plin';

export class EnterFlowManager {
  private state: FlowState;
  private callbacks: {
    onStepChange?: (step: FlowStep) => void;
    onStateChange?: (state: FlowState) => void;
    onComplete?: (finalState: FlowState) => void;
  };

  constructor(initialState?: Partial<FlowState>) {
    this.state = {
      step: 'products',
      cart: [],
      selectedClient: null,
      paymentMethod: 'efectivo',
      total: 0,
      saleType: 'normal',
      ...initialState
    };
    this.callbacks = {};
  }

  // Register callbacks
  onStepChange(callback: (step: FlowStep) => void) {
    this.callbacks.onStepChange = callback;
  }

  onStateChange(callback: (state: FlowState) => void) {
    this.callbacks.onStateChange = callback;
  }

  onComplete(callback: (finalState: FlowState) => void) {
    this.callbacks.onComplete = callback;
  }

  // Get current state
  getState(): FlowState {
    return { ...this.state };
  }

  // Update cart and recalculate total
  updateCart(cart: CartItem[]) {
    this.state.cart = cart;
    this.state.total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    this.notifyStateChange();
  }

  // Set sale type
  setSaleType(saleType: 'normal' | 'scheduled' | 'lunch') {
    this.state.saleType = saleType;
    this.notifyStateChange();
  }

  // Handle Enter key press
  handleEnter(): boolean {
    switch (this.state.step) {
      case 'products':
        if (this.state.cart.length === 0) {
          return false; // No products in cart
        }
        this.goToStep('client');
        return true;

      case 'client':
        if (!this.state.selectedClient) {
          return false; // No client selected
        }
        this.goToStep('payment');
        return true;

      case 'payment':
        this.goToStep('confirmation');
        return true;

      case 'confirmation':
        this.completeFlow();
        return true;

      case 'complete':
        this.resetFlow();
        return true;

      default:
        return false;
    }
  }

  // Handle Escape key (cancel/back)
  handleEscape(): boolean {
    switch (this.state.step) {
      case 'client':
        this.goToStep('products');
        return true;

      case 'payment':
        this.goToStep('client');
        return true;

      case 'confirmation':
        this.goToStep('payment');
        return true;

      case 'complete':
        this.resetFlow();
        return true;

      case 'products':
        // Clear cart
        this.updateCart([]);
        return true;

      default:
        return false;
    }
  }

  // Manual step navigation
  goToStep(step: FlowStep) {
    this.state.step = step;
    this.callbacks.onStepChange?.(step);
    this.notifyStateChange();
  }

  // Set selected client
  selectClient(client: Client | null) {
    this.state.selectedClient = client;
    this.notifyStateChange();
    
    // Auto-advance if client selected
    if (client && this.state.step === 'client') {
      // Small delay to show selection
      setTimeout(() => this.goToStep('payment'), 100);
    }
  }

  // Set payment method
  setPaymentMethod(method: PaymentMethod) {
    this.state.paymentMethod = method;
    this.notifyStateChange();
  }

  // Complete the flow
  private completeFlow() {
    this.state.step = 'complete';
    this.callbacks.onComplete?.(this.getState());
    this.notifyStateChange();
  }

  // Reset flow to start
  resetFlow() {
    this.state = {
      step: 'products',
      cart: [],
      selectedClient: null,
      paymentMethod: 'efectivo',
      total: 0,
      saleType: 'normal'
    };
    this.notifyStateChange();
  }

  // Check if current step is valid for advancing
  canAdvance(): boolean {
    switch (this.state.step) {
      case 'products':
        return this.state.cart.length > 0;
      case 'client':
        return this.state.selectedClient !== null;
      case 'payment':
        return true; // Payment method always has default
      case 'confirmation':
        return true;
      default:
        return false;
    }
  }

  // Get step title for UI
  getStepTitle(): string {
    switch (this.state.step) {
      case 'products':
        return 'Seleccionar Productos';
      case 'client':
        return 'Seleccionar Cliente';
      case 'payment':
        return 'Método de Pago';
      case 'confirmation':
        return 'Confirmar Venta';
      case 'complete':
        return 'Venta Completada';
      default:
        return '';
    }
  }

  // Get next action text for UI
  getNextActionText(): string {
    switch (this.state.step) {
      case 'products':
        return this.state.cart.length > 0 ? 'Continuar (Enter)' : 'Agregar productos';
      case 'client':
        return this.state.selectedClient ? 'Continuar (Enter)' : 'Seleccionar cliente';
      case 'payment':
        return 'Continuar (Enter)';
      case 'confirmation':
        return 'Procesar Venta (Enter)';
      case 'complete':
        return 'Nueva Venta (Enter)';
      default:
        return '';
    }
  }

  // Private helper to notify state changes
  private notifyStateChange() {
    this.callbacks.onStateChange?.(this.getState());
  }
}

// Keyboard event handler for global use
export function setupEnterFlowKeyboard(flowManager: EnterFlowManager): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Ignore if user is typing in input fields
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement) {
      return;
    }

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        flowManager.handleEnter();
        break;
      
      case 'Escape':
        event.preventDefault();
        flowManager.handleEscape();
        break;
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return () => document.removeEventListener('keydown', handleKeyDown);
}