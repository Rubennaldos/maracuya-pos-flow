// Printing utilities for 80mm thermal printers
import { rtdbGet } from './rt';
import { RTDB_PATHS } from './rtdb';

export interface PrintConfig {
  printingMode: 'kiosk' | 'raw';
  printerName?: string;
  autoPrintKitchen: boolean;
  ticketHeader: string;
  ticketFooter: string;
}

export interface PrintableItem {
  name: string;
  quantity: number;
  price: number;
  isKitchen?: boolean;
  notes?: string;
}

export interface PrintableOrder {
  id: string;
  correlative: string;
  date: string;
  time: string;
  client: {
    name: string;
    id?: string;
  };
  items: PrintableItem[];
  subtotal: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
  user: string;
  type: 'customer' | 'kitchen';
}

export class PrintManager {
  private static config: PrintConfig | null = null;

  // Get printing configuration from RTDB
  static async getConfig(): Promise<PrintConfig> {
    if (!this.config) {
      const config = await rtdbGet(RTDB_PATHS.config);
      this.config = config || {
        printingMode: 'kiosk',
        autoPrintKitchen: true,
        ticketHeader: 'Maracuyá Tiendas y Concesionarias Saludables\nSEDE VILLA GRATIA',
        ticketFooter: 'Gracias por su compra'
      };
    }
    return this.config;
  }

  // Print customer ticket
  static async printCustomerTicket(order: PrintableOrder): Promise<void> {
    const config = await this.getConfig();
    
    if (config.printingMode === 'kiosk') {
      await this.printKioskCustomer(order, config);
    } else {
      await this.printRawCustomer(order, config);
    }
  }

  // Print kitchen order (if has kitchen items)
  static async printKitchenOrder(order: PrintableOrder): Promise<void> {
    const config = await this.getConfig();
    const kitchenItems = order.items.filter(item => item.isKitchen);
    
    if (kitchenItems.length === 0) return;
    
    const kitchenOrder = {
      ...order,
      items: kitchenItems,
      type: 'kitchen' as const
    };

    if (config.autoPrintKitchen) {
      if (config.printingMode === 'kiosk') {
        await this.printKioskKitchen(kitchenOrder, config);
      } else {
        await this.printRawKitchen(kitchenOrder, config);
      }
    }
  }

  // Check if order needs kitchen printing
  static hasKitchenItems(order: PrintableOrder): boolean {
    return order.items.some(item => item.isKitchen);
  }

  // KIOSK MODE IMPLEMENTATIONS
  private static async printKioskCustomer(order: PrintableOrder, config: PrintConfig): Promise<void> {
    const ticketHtml = this.buildCustomerTicketHTML(order, config);
    this.printKioskHTML(ticketHtml);
  }

  private static async printKioskKitchen(order: PrintableOrder, config: PrintConfig): Promise<void> {
    const ticketHtml = this.buildKitchenTicketHTML(order, config);
    this.printKioskHTML(ticketHtml);
  }

  private static printKioskHTML(html: string): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('No se pudo abrir ventana de impresión');
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Ticket</title>
          <style>
            ${this.getKioskPrintStyles()}
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `);

    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }

  private static getKioskPrintStyles(): string {
    return `
      @media print {
        @page { 
          size: 80mm auto; 
          margin: 0; 
        }
        body { 
          margin: 0; 
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.2;
        }
        .ticket { 
          width: 80mm; 
          padding: 2mm; 
        }
        .center { text-align: center; }
        .left { text-align: left; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .large { font-size: 14px; }
        .separator { 
          border-top: 1px dashed #000; 
          margin: 2mm 0; 
        }
        .item-line {
          display: flex;
          justify-content: space-between;
          margin: 1mm 0;
        }
        .no-print { display: none !important; }
      }
      
      @media screen {
        body { 
          font-family: 'Courier New', monospace;
          padding: 20px;
          background: #f0f0f0;
        }
        .ticket {
          background: white;
          width: 80mm;
          margin: 0 auto;
          padding: 10px;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
      }
    `;
  }

  private static buildCustomerTicketHTML(order: PrintableOrder, config: PrintConfig): string {
    const headerLines = config.ticketHeader.split('\n');
    const footerLines = config.ticketFooter.split('\n');
    
    return `
      <div class="ticket">
        <div class="center">
          ${headerLines.map(line => `<div>${line}</div>`).join('')}
        </div>
        <div class="separator"></div>
        
        <div class="center">
          <div class="bold large">TICKET DE VENTA</div>
          <div>${order.correlative}</div>
        </div>
        <div class="separator"></div>
        
        <div>
          <div>Fecha: ${order.date}</div>
          <div>Hora: ${order.time}</div>
          <div>Cliente: ${order.client.name}</div>
          <div>Vendedor: ${order.user}</div>
        </div>
        <div class="separator"></div>
        
        <div>
          ${order.items.map(item => `
            <div class="item-line">
              <span>${item.quantity}x ${item.name}</span>
              <span>S/ ${(item.quantity * item.price).toFixed(2)}</span>
            </div>
            ${item.notes ? `<div style="font-size: 10px; margin-left: 10px;">Nota: ${item.notes}</div>` : ''}
          `).join('')}
        </div>
        <div class="separator"></div>
        
        <div>
          <div class="item-line">
            <span>Subtotal:</span>
            <span>S/ ${order.subtotal.toFixed(2)}</span>
          </div>
          ${order.discount ? `
            <div class="item-line">
              <span>Descuento:</span>
              <span>-S/ ${order.discount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="item-line bold">
            <span>TOTAL:</span>
            <span>S/ ${order.total.toFixed(2)}</span>
          </div>
        </div>
        <div class="separator"></div>
        
        <div>
          <div>Método: ${order.paymentMethod.toUpperCase()}</div>
          ${order.cashReceived ? `
            <div>Recibido: S/ ${order.cashReceived.toFixed(2)}</div>
            <div>Cambio: S/ ${(order.change || 0).toFixed(2)}</div>
          ` : ''}
        </div>
        <div class="separator"></div>
        
        <div class="center">
          ${footerLines.map(line => `<div>${line}</div>`).join('')}
        </div>
      </div>
    `;
  }

  private static buildKitchenTicketHTML(order: PrintableOrder, config: PrintConfig): string {
    return `
      <div class="ticket">
        <div class="center">
          <div class="bold large">COMANDA COCINA</div>
        </div>
        <div class="separator"></div>
        
        <div>
          <div class="bold large">Cliente: ${order.client.name}</div>
          <div>Orden: ${order.correlative}</div>
          <div>Fecha: ${order.date} - ${order.time}</div>
        </div>
        <div class="separator"></div>
        
        <div>
          ${order.items.filter(item => item.isKitchen).map(item => `
            <div class="bold">
              ${item.quantity}x ${item.name}
            </div>
            ${item.notes ? `<div style="margin-left: 10px; font-size: 11px;">NOTA: ${item.notes}</div>` : ''}
            <br>
          `).join('')}
        </div>
        <div class="separator"></div>
        
        <div class="center">
          <div>Vendedor: ${order.user}</div>
        </div>
      </div>
    `;
  }

  // RAW ESC/POS MODE IMPLEMENTATIONS
  private static async printRawCustomer(order: PrintableOrder, config: PrintConfig): Promise<void> {
    const escpos = this.buildCustomerESCPOS(order, config);
    await this.sendRawToPrinter(escpos, config.printerName);
  }

  private static async printRawKitchen(order: PrintableOrder, config: PrintConfig): Promise<void> {
    const escpos = this.buildKitchenESCPOS(order, config);
    await this.sendRawToPrinter(escpos, config.printerName);
  }

  private static buildCustomerESCPOS(order: PrintableOrder, config: PrintConfig): string[] {
    const commands: string[] = [];
    
    // Initialize
    commands.push(ESC_POS.INIT);
    
    // Header
    commands.push(ESC_POS.ALIGN_CENTER);
    config.ticketHeader.split('\n').forEach(line => {
      commands.push(line);
      commands.push(ESC_POS.LF);
    });
    
    commands.push(ESC_POS.LF);
    commands.push(ESC_POS.BOLD_ON);
    commands.push('TICKET DE VENTA');
    commands.push(ESC_POS.BOLD_OFF);
    commands.push(ESC_POS.LF);
    commands.push(order.correlative);
    commands.push(ESC_POS.LF);
    commands.push(ESC_POS.SEPARATOR);
    
    // Order details
    commands.push(ESC_POS.ALIGN_LEFT);
    commands.push(`Fecha: ${order.date}`);
    commands.push(ESC_POS.LF);
    commands.push(`Hora: ${order.time}`);
    commands.push(ESC_POS.LF);
    commands.push(`Cliente: ${order.client.name}`);
    commands.push(ESC_POS.LF);
    commands.push(`Vendedor: ${order.user}`);
    commands.push(ESC_POS.LF);
    commands.push(ESC_POS.SEPARATOR);
    
    // Items
    order.items.forEach(item => {
      const line = `${item.quantity}x ${item.name}`;
      const price = `S/ ${(item.quantity * item.price).toFixed(2)}`;
      commands.push(this.formatESCPOSLine(line, price, 32));
      if (item.notes) {
        commands.push(`  Nota: ${item.notes}`);
        commands.push(ESC_POS.LF);
      }
    });
    
    commands.push(ESC_POS.SEPARATOR);
    
    // Totals
    commands.push(this.formatESCPOSLine('Subtotal:', `S/ ${order.subtotal.toFixed(2)}`, 32));
    if (order.discount) {
      commands.push(this.formatESCPOSLine('Descuento:', `-S/ ${order.discount.toFixed(2)}`, 32));
    }
    commands.push(ESC_POS.BOLD_ON);
    commands.push(this.formatESCPOSLine('TOTAL:', `S/ ${order.total.toFixed(2)}`, 32));
    commands.push(ESC_POS.BOLD_OFF);
    
    commands.push(ESC_POS.SEPARATOR);
    
    // Payment
    commands.push(`Metodo: ${order.paymentMethod.toUpperCase()}`);
    commands.push(ESC_POS.LF);
    if (order.cashReceived) {
      commands.push(`Recibido: S/ ${order.cashReceived.toFixed(2)}`);
      commands.push(ESC_POS.LF);
      commands.push(`Cambio: S/ ${(order.change || 0).toFixed(2)}`);
      commands.push(ESC_POS.LF);
    }
    
    commands.push(ESC_POS.SEPARATOR);
    
    // Footer
    commands.push(ESC_POS.ALIGN_CENTER);
    config.ticketFooter.split('\n').forEach(line => {
      commands.push(line);
      commands.push(ESC_POS.LF);
    });
    
    // Cut paper
    commands.push(ESC_POS.CUT);
    
    return commands;
  }

  private static buildKitchenESCPOS(order: PrintableOrder, config: PrintConfig): string[] {
    const commands: string[] = [];
    
    commands.push(ESC_POS.INIT);
    commands.push(ESC_POS.ALIGN_CENTER);
    commands.push(ESC_POS.BOLD_ON);
    commands.push('COMANDA COCINA');
    commands.push(ESC_POS.BOLD_OFF);
    commands.push(ESC_POS.LF);
    commands.push(ESC_POS.SEPARATOR);
    
    commands.push(ESC_POS.ALIGN_LEFT);
    commands.push(ESC_POS.BOLD_ON);
    commands.push(`Cliente: ${order.client.name}`);
    commands.push(ESC_POS.BOLD_OFF);
    commands.push(ESC_POS.LF);
    commands.push(`Orden: ${order.correlative}`);
    commands.push(ESC_POS.LF);
    commands.push(`${order.date} - ${order.time}`);
    commands.push(ESC_POS.LF);
    commands.push(ESC_POS.SEPARATOR);
    
    // Kitchen items only
    order.items.filter(item => item.isKitchen).forEach(item => {
      commands.push(ESC_POS.BOLD_ON);
      commands.push(`${item.quantity}x ${item.name}`);
      commands.push(ESC_POS.BOLD_OFF);
      commands.push(ESC_POS.LF);
      if (item.notes) {
        commands.push(`NOTA: ${item.notes}`);
        commands.push(ESC_POS.LF);
      }
      commands.push(ESC_POS.LF);
    });
    
    commands.push(ESC_POS.SEPARATOR);
    commands.push(ESC_POS.ALIGN_CENTER);
    commands.push(`Vendedor: ${order.user}`);
    commands.push(ESC_POS.LF);
    commands.push(ESC_POS.CUT);
    
    return commands;
  }

  private static formatESCPOSLine(left: string, right: string, maxWidth: number): string {
    const spaces = maxWidth - left.length - right.length;
    return left + ' '.repeat(Math.max(1, spaces)) + right + ESC_POS.LF;
  }

  private static async sendRawToPrinter(commands: string[], printerName?: string): Promise<void> {
    // This would integrate with QZ Tray or Electron printing
    // For now, log the ESC/POS commands
    console.log('ESC/POS Commands for printer:', printerName);
    console.log(commands.join(''));
    
    // In a real implementation, you would send these commands to:
    // - QZ Tray (web printing solution)
    // - Electron's printer API
    // - Native app bridge
    
    // Example QZ Tray integration:
    /*
    if (window.qz) {
      await window.qz.printers.find(printerName);
      const config = qz.configs.create(printerName);
      await qz.print(config, commands);
    }
    */
  }
}

// ESC/POS Command Constants
export const ESC_POS = {
  INIT: '\x1B\x40',           // Initialize printer
  LF: '\x0A',                 // Line feed
  CR: '\x0D',                 // Carriage return
  
  // Text alignment
  ALIGN_LEFT: '\x1B\x61\x00',
  ALIGN_CENTER: '\x1B\x61\x01',
  ALIGN_RIGHT: '\x1B\x61\x02',
  
  // Text style
  BOLD_ON: '\x1B\x45\x01',
  BOLD_OFF: '\x1B\x45\x00',
  UNDERLINE_ON: '\x1B\x2D\x01',
  UNDERLINE_OFF: '\x1B\x2D\x00',
  
  // Paper cutting
  CUT: '\x1D\x56\x42\x00',    // Full cut
  PARTIAL_CUT: '\x1D\x56\x41\x00',
  
  // Custom separator
  SEPARATOR: '--------------------------------\n'
} as const;