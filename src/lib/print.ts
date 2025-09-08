// Printing utilities for 80mm thermal printers
import { rtdbGet } from "./rt";
import { RTDB_PATHS } from "./rtdb";

export interface PrintConfig {
  printingMode: "kiosk" | "raw";
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
  client: string | { name: string; id?: string }; // ⬅️ admite string u objeto
  items: PrintableItem[];
  subtotal: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
  user: string;
  type: "customer" | "kitchen";
}

export class PrintManager {
  private static config: PrintConfig | null = null;

  // Obtiene config desde RTDB (con fallback)
  static async getConfig(): Promise<PrintConfig> {
    if (!this.config) {
      const config = await rtdbGet<PrintConfig>(RTDB_PATHS.config);
      this.config =
        config || {
          printingMode: "kiosk",
          autoPrintKitchen: true,
          ticketHeader:
            "Maracuyá Tiendas y Concesionarias Saludables\nSEDE VILLA GRATIA",
          ticketFooter: "Gracias por su compra",
        };
    }
    return this.config;
  }

  // Normaliza nombre del cliente
  private static clientName(c: PrintableOrder["client"]): string {
    if (!c) return "Cliente Varios";
    if (typeof c === "string") return c || "Cliente Varios";
    return c.name || "Cliente Varios";
  }

  // Cliente (ticket)
  static async printCustomerTicket(order: PrintableOrder): Promise<void> {
    const config = await this.getConfig();
    if (config.printingMode === "kiosk") {
      await this.printKioskCustomer(order, config);
    } else {
      await this.printRawCustomer(order, config);
    }
  }

  // Cocina (comanda)
  static async printKitchenOrder(order: PrintableOrder): Promise<void> {
    const config = await this.getConfig();
    const kitchenItems = order.items.filter((i) => i.isKitchen);
    if (kitchenItems.length === 0) return;

    const kitchenOrder: PrintableOrder = { ...order, items: kitchenItems, type: "kitchen" };
    if (config.autoPrintKitchen) {
      if (config.printingMode === "kiosk") {
        await this.printKioskKitchen(kitchenOrder, config);
      } else {
        await this.printRawKitchen(kitchenOrder, config);
      }
    }
  }

  static hasKitchenItems(order: PrintableOrder): boolean {
    return order.items.some((i) => i.isKitchen);
  }

  // ======== KIOSK MODE ========
  private static async printKioskCustomer(order: PrintableOrder, config: PrintConfig): Promise<void> {
    const html = this.buildCustomerTicketHTML(order, config);
    this.printKioskHTML(html);
  }
  private static async printKioskKitchen(order: PrintableOrder, config: PrintConfig): Promise<void> {
    const html = this.buildKitchenTicketHTML(order, config);
    this.printKioskHTML(html);
  }

  private static printKioskHTML(html: string): void {
    const printWindow = window.open("", "_blank");
    if (!printWindow) throw new Error("No se pudo abrir ventana de impresión");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Ticket</title>
          <style>${this.getKioskPrintStyles()}</style>
        </head>
        <body>${html}</body>
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
        @page { size: 80mm auto; margin: 0; }
        body { margin: 0; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.2; }
        .ticket { width: 80mm; padding: 2mm; }
        .center { text-align: center; }
        .left { text-align: left; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .large { font-size: 14px; }
        .separator { border-top: 1px dashed #000; margin: 2mm 0; }
        .item-line { display: flex; justify-content: space-between; margin: 1mm 0; }
        .no-print { display: none !important; }
      }
      @media screen {
        body { font-family: 'Courier New', monospace; padding: 20px; background: #f0f0f0; }
        .ticket { background: #fff; width: 80mm; margin: 0 auto; padding: 10px; box-shadow: 0 0 10px rgba(0,0,0,.1); }
      }
    `;
  }

  private static buildCustomerTicketHTML(order: PrintableOrder, config: PrintConfig): string {
    const headerLines = config.ticketHeader.split("\n");
    const footerLines = config.ticketFooter.split("\n");
    const client = this.clientName(order.client);

    return `
      <div class="ticket">
        <div class="center">
          ${headerLines.map((l) => `<div>${l}</div>`).join("")}
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
          <div>Cliente: ${client}</div>
          <div>Vendedor: ${order.user}</div>
        </div>
        <div class="separator"></div>

        <div>
          ${order.items
            .map(
              (item) => `
            <div class="item-line">
              <span>${item.quantity}x ${item.name}</span>
              <span>S/ ${(item.quantity * item.price).toFixed(2)}</span>
            </div>
            ${item.notes ? `<div style="font-size:10px;margin-left:10px;">Nota: ${item.notes}</div>` : ""}
          `
            )
            .join("")}
        </div>

        <div class="separator"></div>
        <div>
          <div class="item-line"><span>Subtotal:</span><span>S/ ${order.subtotal.toFixed(2)}</span></div>
          ${order.discount
            ? `<div class="item-line"><span>Descuento:</span><span>-S/ ${order.discount.toFixed(2)}</span></div>`
            : ""}
          <div class="item-line bold"><span>TOTAL:</span><span>S/ ${order.total.toFixed(2)}</span></div>
        </div>

        <div class="separator"></div>
        <div>
          <div>Método: ${order.paymentMethod.toUpperCase()}</div>
          ${
            order.cashReceived
              ? `<div>Recibido: S/ ${order.cashReceived.toFixed(2)}</div><div>Cambio: S/ ${(order.change || 0).toFixed(2)}</div>`
              : ""
          }
        </div>

        <div class="separator"></div>
        <div class="center">
          ${footerLines.map((l) => `<div>${l}</div>`).join("")}
        </div>
      </div>
    `;
  }

  private static buildKitchenTicketHTML(order: PrintableOrder, _config: PrintConfig): string {
    const client = this.clientName(order.client);
    return `
      <div class="ticket">
        <div class="center"><div class="bold large">COMANDA COCINA</div></div>
        <div class="separator"></div>

        <div>
          <div class="bold large">Cliente: ${client}</div>
          <div>Orden: ${order.correlative}</div>
          <div>Fecha: ${order.date} - ${order.time}</div>
        </div>
        <div class="separator"></div>

        <div>
          ${order.items
            .filter((i) => i.isKitchen)
            .map(
              (item) => `
            <div class="bold">${item.quantity}x ${item.name}</div>
            ${item.notes ? `<div style="margin-left:10px;font-size:11px;">NOTA: ${item.notes}</div>` : ""}
            <br/>
          `
            )
            .join("")}
        </div>

        <div class="separator"></div>
        <div class="center"><div>Vendedor: ${order.user}</div></div>
      </div>
    `;
  }

  // ======== RAW ESC/POS ========
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
    const client = this.clientName(order.client);

    // Init + header
    commands.push(ESC_POS.INIT, ESC_POS.ALIGN_CENTER);
    config.ticketHeader.split("\n").forEach((l) => {
      commands.push(l, ESC_POS.LF);
    });

    commands.push(ESC_POS.LF, ESC_POS.BOLD_ON, "TICKET DE VENTA", ESC_POS.BOLD_OFF, ESC_POS.LF);
    commands.push(order.correlative, ESC_POS.LF, ESC_POS.SEPARATOR);

    // Details
    commands.push(ESC_POS.ALIGN_LEFT);
    commands.push(`Fecha: ${order.date}`, ESC_POS.LF);
    commands.push(`Hora: ${order.time}`, ESC_POS.LF);
    commands.push(`Cliente: ${client}`, ESC_POS.LF);
    commands.push(`Vendedor: ${order.user}`, ESC_POS.LF, ESC_POS.SEPARATOR);

    // Items
    order.items.forEach((item) => {
      const left = `${item.quantity}x ${item.name}`;
      const right = `S/ ${(item.quantity * item.price).toFixed(2)}`;
      commands.push(this.formatESCPOSLine(left, right, 32));
      if (item.notes) {
        commands.push(`  Nota: ${item.notes}`, ESC_POS.LF);
      }
    });

    commands.push(ESC_POS.SEPARATOR);
    commands.push(this.formatESCPOSLine("Subtotal:", `S/ ${order.subtotal.toFixed(2)}`, 32));
    if (order.discount) {
      commands.push(this.formatESCPOSLine("Descuento:", `-S/ ${order.discount.toFixed(2)}`, 32));
    }
    commands.push(ESC_POS.BOLD_ON);
    commands.push(this.formatESCPOSLine("TOTAL:", `S/ ${order.total.toFixed(2)}`, 32));
    commands.push(ESC_POS.BOLD_OFF, ESC_POS.SEPARATOR);

    commands.push(`Metodo: ${order.paymentMethod.toUpperCase()}`, ESC_POS.LF);
    if (order.cashReceived) {
      commands.push(`Recibido: S/ ${order.cashReceived.toFixed(2)}`, ESC_POS.LF);
      commands.push(`Cambio: S/ ${(order.change || 0).toFixed(2)}`, ESC_POS.LF);
    }

    commands.push(ESC_POS.SEPARATOR, ESC_POS.ALIGN_CENTER);
    config.ticketFooter.split("\n").forEach((l) => {
      commands.push(l, ESC_POS.LF);
    });
    commands.push(ESC_POS.CUT);

    return commands;
  }

  private static buildKitchenESCPOS(order: PrintableOrder, _config: PrintConfig): string[] {
    const commands: string[] = [];
    const client = this.clientName(order.client);

    commands.push(ESC_POS.INIT, ESC_POS.ALIGN_CENTER, ESC_POS.BOLD_ON, "COMANDA COCINA", ESC_POS.BOLD_OFF, ESC_POS.LF, ESC_POS.SEPARATOR);

    commands.push(ESC_POS.ALIGN_LEFT, ESC_POS.BOLD_ON, `Cliente: ${client}`, ESC_POS.BOLD_OFF, ESC_POS.LF);
    commands.push(`Orden: ${order.correlative}`, ESC_POS.LF);
    commands.push(`${order.date} - ${order.time}`, ESC_POS.LF, ESC_POS.SEPARATOR);

    order.items
      .filter((i) => i.isKitchen)
      .forEach((item) => {
        commands.push(ESC_POS.BOLD_ON, `${item.quantity}x ${item.name}`, ESC_POS.BOLD_OFF, ESC_POS.LF);
        if (item.notes) commands.push(`NOTA: ${item.notes}`, ESC_POS.LF);
        commands.push(ESC_POS.LF);
      });

    commands.push(ESC_POS.SEPARATOR, ESC_POS.ALIGN_CENTER, `Vendedor: ${order.user}`, ESC_POS.LF, ESC_POS.CUT);
    return commands;
  }

  private static formatESCPOSLine(left: string, right: string, maxWidth: number): string {
    const spaces = Math.max(1, maxWidth - left.length - right.length);
    return left + " ".repeat(spaces) + right + ESC_POS.LF;
  }

  private static async sendRawToPrinter(commands: string[], printerName?: string): Promise<void> {
    // Aquí integrarías QZ Tray o Electron. Por ahora, log.
    console.log("ESC/POS → printer:", printerName);
    console.log(commands.join(""));
    // Ejemplo QZ Tray:
    /*
    if ((window as any).qz) {
      const qz = (window as any).qz;
      await qz.printers.find(printerName);
      const cfg = qz.configs.create(printerName);
      await qz.print(cfg, commands);
    }
    */
  }
}

// ESC/POS Command Constants
export const ESC_POS = {
  INIT: "\x1B\x40",
  LF: "\x0A",
  CR: "\x0D",
  ALIGN_LEFT: "\x1B\x61\x00",
  ALIGN_CENTER: "\x1B\x61\x01",
  ALIGN_RIGHT: "\x1B\x61\x02",
  BOLD_ON: "\x1B\x45\x01",
  BOLD_OFF: "\x1B\x45\x00",
  UNDERLINE_ON: "\x1B\x2D\x01",
  UNDERLINE_OFF: "\x1B\x2D\x00",
  CUT: "\x1D\x56\x42\x00", // Full cut
  PARTIAL_CUT: "\x1D\x56\x41\x00",
  SEPARATOR: "--------------------------------\n",
} as const;
