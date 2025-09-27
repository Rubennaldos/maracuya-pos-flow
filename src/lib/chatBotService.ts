// chatBotService.ts - Servicio principal del chatbot
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

/**
 * INTERFACES Y TIPOS
 */

// Estructura de un mensaje en el chat
export interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: string;
  type?: "welcome" | "error" | "data" | "normal";
  data?: any; // Datos adicionales de consultas
  intent?: string; // Intent que activó la respuesta
}

// Respuesta del chatbot
export interface ChatResponse {
  message: string;
  type: "data" | "error" | "normal";
  data?: any;
  intent?: string;
}

// Configuración de un intent (intención)
export interface Intent {
  id: string;
  name: string;
  description: string;
  keywords: string[]; // Palabras clave que activan este intent
  action: string; // Acción a ejecutar
  response_template: string; // Plantilla de respuesta
  enabled: boolean;
  examples: string[]; // Ejemplos de frases que activan este intent
  created_at: string;
  updated_at: string;
}

// Configuración del patrón de búsqueda
interface SearchPattern {
  type: "exact" | "contains" | "startsWith" | "endsWith" | "regex";
  value: string;
}

/**
 * SERVICIO PRINCIPAL DEL CHATBOT
 * 
 * Este servicio maneja toda la lógica del chatbot incluyendo:
 * - Procesamiento de mensajes y detección de intents
 * - Consultas a la base de datos
 * - Generación de respuestas inteligentes
 * - Configuración y gestión de intents
 */
export class ChatBotService {
  
  /**
   * PROCESAR MENSAJE PRINCIPAL
   * Analiza el mensaje del usuario y genera una respuesta apropiada
   */
  static async processMessage(message: string, intents: Intent[]): Promise<ChatResponse> {
    try {
      console.log("Processing message:", message);
      
      // 1. Detectar intent basado en palabras clave
      const detectedIntent = this.detectIntent(message, intents);
      
      if (detectedIntent) {
        console.log("Intent detected:", detectedIntent.name);
        
        // 2. Ejecutar acción específica del intent
        const result = await this.executeAction(detectedIntent.action, message);
        
        // 3. Generar respuesta usando la plantilla
        const response = this.generateResponse(detectedIntent.response_template, result, message);
        
        return {
          message: response,
          type: "data",
          data: result.data,
          intent: detectedIntent.name
        };
      }
      
      // Si no se detecta intent específico, usar fallback inteligente
      return await this.handleFallback(message);
      
    } catch (error) {
      console.error("Error processing message:", error);
      return {
        message: "Lo siento, he tenido un problema procesando tu consulta. Por favor intenta de nuevo o contacta al administrador.",
        type: "error"
      };
    }
  }

  /**
   * DETECTAR INTENT
   * Analiza el mensaje y determina qué intent coincide mejor
   */
  private static detectIntent(message: string, intents: Intent[]): Intent | null {
    const lowerMessage = message.toLowerCase().trim();
    
    // Buscar intents activos ordenados por coincidencia
    let bestMatch: Intent | null = null;
    let maxScore = 0;
    
    for (const intent of intents.filter(i => i.enabled)) {
      const score = this.calculateIntentScore(lowerMessage, intent);
      if (score > maxScore && score > 0.3) { // Umbral mínimo de confianza
        maxScore = score;
        bestMatch = intent;
      }
    }
    
    return bestMatch;
  }

  /**
   * CALCULAR PUNTUACIÓN DE INTENT
   * Determina qué tan bien coincide un mensaje con un intent
   */
  private static calculateIntentScore(message: string, intent: Intent): number {
    let score = 0;
    let totalKeywords = intent.keywords.length;
    
    if (totalKeywords === 0) return 0;
    
    // Verificar coincidencias de palabras clave
    for (const keyword of intent.keywords) {
      const keywordLower = keyword.toLowerCase();
      if (message.includes(keywordLower)) {
        // Bonus si la palabra está al inicio
        if (message.startsWith(keywordLower)) {
          score += 2;
        } else {
          score += 1;
        }
      }
    }
    
    // Normalizar puntuación (0-1)
    return Math.min(score / totalKeywords, 1);
  }

  /**
   * EJECUTAR ACCIÓN
   * Ejecuta la acción específica del intent detectado
   */
  private static async executeAction(action: string, message: string): Promise<{ data?: any; error?: string }> {
    try {
      switch (action) {
        case "search_client":
          return await this.searchClient(message);
          
        case "get_debtors":
          return await this.getDebtors(message);
          
        case "get_sales":
          return await this.getSales(message);
          
        case "get_products":
          return await this.getProducts(message);
          
        case "get_client_debt":
          return await this.getClientDebt(message);
          
        case "get_sales_today":
          return await this.getSalesToday();
          
        case "get_top_debtors":
          return await this.getTopDebtors();
          
        case "search_product":
          return await this.searchProduct(message);
          
        default:
          return { error: "Acción no reconocida" };
      }
    } catch (error) {
      console.error("Error executing action:", error);
      return { error: "Error ejecutando la consulta" };
    }
  }

  /**
   * BÚSQUEDA DE CLIENTES
   * Busca clientes por ID, nombre o información similar
   */
  private static async searchClient(message: string): Promise<{ data?: any; error?: string }> {
    try {
      // Extraer posible ID o nombre del mensaje
      const searchTerm = this.extractSearchTerm(message, ["cliente", "buscar", "id"]);
      
      if (!searchTerm) {
        return { error: "No se pudo extraer el término de búsqueda para el cliente" };
      }

      // Buscar en clientes
      const clients = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.clients);
      
      if (!clients) {
        return { error: "No se encontraron clientes en la base de datos" };
      }

      const results = [];
      
      for (const [clientId, client] of Object.entries(clients)) {
        if (
          clientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (client.name && client.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (client.fullName && client.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
        ) {
          results.push({
            id: clientId,
            name: client.name || client.fullName || "Sin nombre",
            phone: client.phone || "No disponible",
            email: client.email || "No disponible"
          });
        }
      }

      return { data: results };
      
    } catch (error) {
      console.error("Error searching clients:", error);
      return { error: "Error buscando clientes" };
    }
  }

  /**
   * OBTENER DEUDORES
   * Obtiene lista de clientes con deudas pendientes
   */
  private static async getDebtors(message?: string): Promise<{ data?: any; error?: string }> {
    try {
      const arData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.accounts_receivable);
      
      if (!arData) {
        return { data: [] };
      }

      const debtors = [];
      
      // Procesar formato nuevo (agrupado por cliente)
      for (const [clientId, clientData] of Object.entries(arData)) {
        const cData = clientData as any;
        if (cData && typeof cData === "object" && cData.entries) {
          let totalDebt = 0;
          let pendingInvoices = 0;
          
          for (const [entryId, entry] of Object.entries<any>(cData.entries)) {
            if (entry?.status === "pending") {
              totalDebt += Number(entry.amount || 0);
              pendingInvoices++;
            }
          }
          
          if (totalDebt > 0) {
            debtors.push({
              clientId,
              clientName: Object.values<any>(cData.entries)[0]?.clientName || clientId,
              totalDebt,
              pendingInvoices
            });
          }
        }
      }

      // Ordenar por deuda mayor
      debtors.sort((a, b) => b.totalDebt - a.totalDebt);
      
      return { data: debtors };
      
    } catch (error) {
      console.error("Error getting debtors:", error);
      return { error: "Error obteniendo deudores" };
    }
  }

  /**
   * OBTENER DEUDA ESPECÍFICA DE CLIENTE
   */
  private static async getClientDebt(message: string): Promise<{ data?: any; error?: string }> {
    try {
      const clientId = this.extractSearchTerm(message, ["cliente", "debe", "deuda"]);
      
      if (!clientId) {
        return { error: "No se pudo identificar el cliente" };
      }

      const arData = await RTDBHelper.getData<any>(`${RTDB_PATHS.accounts_receivable}/${clientId}`);
      
      if (!arData || !arData.entries) {
        return { data: { clientId, totalDebt: 0, pendingInvoices: [] } };
      }

      let totalDebt = 0;
      const pendingInvoices = [];
      
      for (const [entryId, entry] of Object.entries<any>(arData.entries)) {
        if (entry?.status === "pending") {
          totalDebt += Number(entry.amount || 0);
          pendingInvoices.push({
            id: entryId,
            correlative: entry.correlative || entryId,
            amount: entry.amount,
            date: entry.date
          });
        }
      }

      return { 
        data: { 
          clientId, 
          clientName: pendingInvoices[0]?.clientName || clientId,
          totalDebt, 
          pendingInvoices 
        } 
      };
      
    } catch (error) {
      console.error("Error getting client debt:", error);
      return { error: "Error obteniendo deuda del cliente" };
    }
  }

  /**
   * OBTENER VENTAS
   */
  private static async getSales(message: string): Promise<{ data?: any; error?: string }> {
    try {
      const sales = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.sales);
      
      if (!sales) {
        return { data: [] };
      }

      // Convertir a array y ordenar por fecha
      const salesArray = Object.entries(sales).map(([id, sale]) => ({
        id,
        ...sale,
        date: sale.date || sale.createdAt
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Limitar a últimas 10 ventas por defecto
      return { data: salesArray.slice(0, 10) };
      
    } catch (error) {
      console.error("Error getting sales:", error);
      return { error: "Error obteniendo ventas" };
    }
  }

  /**
   * OBTENER VENTAS DEL DÍA
   */
  private static async getSalesToday(): Promise<{ data?: any; error?: string }> {
    try {
      const sales = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.sales);
      
      if (!sales) {
        return { data: { count: 0, total: 0, sales: [] } };
      }

      const today = new Date().toISOString().split('T')[0];
      const todaySales = [];
      let totalAmount = 0;

      for (const [id, sale] of Object.entries(sales)) {
        const saleDate = (sale.date || sale.createdAt)?.split('T')[0];
        if (saleDate === today) {
          todaySales.push({ id, ...sale });
          totalAmount += Number(sale.total || 0);
        }
      }

      return { 
        data: { 
          count: todaySales.length, 
          total: totalAmount, 
          sales: todaySales.slice(0, 5) // Mostrar últimas 5
        } 
      };
      
    } catch (error) {
      console.error("Error getting today's sales:", error);
      return { error: "Error obteniendo ventas del día" };
    }
  }

  /**
   * OBTENER PRODUCTOS
   */
  private static async getProducts(message: string): Promise<{ data?: any; error?: string }> {
    try {
      const products = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.products);
      
      if (!products) {
        return { data: [] };
      }

      // Convertir a array
      const productsArray = Object.entries(products).map(([id, product]) => ({
        id,
        name: product.name || "Sin nombre",
        price: product.price || 0,
        stock: product.stock || 0,
        category: product.category || "Sin categoría"
      }));

      return { data: productsArray };
      
    } catch (error) {
      console.error("Error getting products:", error);
      return { error: "Error obteniendo productos" };
    }
  }

  /**
   * BUSCAR PRODUCTO ESPECÍFICO
   */
  private static async searchProduct(message: string): Promise<{ data?: any; error?: string }> {
    try {
      const searchTerm = this.extractSearchTerm(message, ["producto", "buscar"]);
      
      if (!searchTerm) {
        return { error: "No se pudo extraer el término de búsqueda para el producto" };
      }

      const products = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.products);
      
      if (!products) {
        return { data: [] };
      }

      const results = [];
      
      for (const [productId, product] of Object.entries(products)) {
        if (
          productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (product.name && product.name.toLowerCase().includes(searchTerm.toLowerCase()))
        ) {
          results.push({
            id: productId,
            name: product.name || "Sin nombre",
            price: product.price || 0,
            stock: product.stock || 0,
            category: product.category || "Sin categoría"
          });
        }
      }

      return { data: results };
      
    } catch (error) {
      console.error("Error searching products:", error);
      return { error: "Error buscando productos" };
    }
  }

  /**
   * OBTENER TOP DEUDORES
   */
  private static async getTopDebtors(): Promise<{ data?: any; error?: string }> {
    try {
      const debtorsResult = await this.getDebtors();
      
      if (debtorsResult.error) {
        return debtorsResult;
      }

      // Obtener top 5 deudores
      const topDebtors = (debtorsResult.data || []).slice(0, 5);
      
      return { data: topDebtors };
      
    } catch (error) {
      console.error("Error getting top debtors:", error);
      return { error: "Error obteniendo top deudores" };
    }
  }

  /**
   * EXTRAER TÉRMINO DE BÚSQUEDA
   * Extrae el término de búsqueda del mensaje eliminando palabras clave
   */
  private static extractSearchTerm(message: string, keywords: string[]): string {
    let cleanMessage = message.toLowerCase();
    
    // Remover palabras clave comunes
    const commonWords = [...keywords, "el", "la", "los", "las", "un", "una", "de", "del", "por", "para", "con"];
    
    for (const word of commonWords) {
      cleanMessage = cleanMessage.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
    }
    
    // Limpiar espacios extra y retornar
    return cleanMessage.trim().replace(/\s+/g, ' ');
  }

  /**
   * GENERAR RESPUESTA
   * Genera respuesta usando plantilla y datos obtenidos
   */
  private static generateResponse(template: string, result: { data?: any; error?: string }, originalMessage: string): string {
    if (result.error) {
      return `❌ ${result.error}`;
    }

    if (!result.data) {
      return template;
    }

    // Reemplazar variables en la plantilla
    let response = template;
    
    if (Array.isArray(result.data)) {
      if (result.data.length === 0) {
        response = response.replace("{{results}}", "No se encontraron resultados.");
      } else {
        const formattedResults = this.formatResults(result.data);
        response = response.replace("{{results}}", formattedResults);
        response = response.replace("{{count}}", result.data.length.toString());
      }
    } else {
      // Para objetos únicos
      response = this.replaceObjectVariables(response, result.data);
    }

    return response;
  }

  /**
   * FORMATEAR RESULTADOS PARA MOSTRAR
   */
  private static formatResults(data: any[]): string {
    if (!data || data.length === 0) return "No hay resultados.";

    // Detectar tipo de datos basado en propiedades
    const firstItem = data[0];
    
    if (firstItem.clientId && firstItem.totalDebt !== undefined) {
      // Formato para deudores
      return data.map((debtor, index) => 
        `${index + 1}. **${debtor.clientName}** (ID: ${debtor.clientId})\n   💰 Deuda: S/ ${debtor.totalDebt.toFixed(2)}\n   📄 Facturas pendientes: ${debtor.pendingInvoices}`
      ).join('\n\n');
    }
    
    if (firstItem.name && firstItem.price !== undefined) {
      // Formato para productos
      return data.map((product, index) => 
        `${index + 1}. **${product.name}**\n   💰 Precio: S/ ${product.price.toFixed(2)}\n   📦 Stock: ${product.stock}\n   🏷️ Categoría: ${product.category}`
      ).join('\n\n');
    }
    
    if (firstItem.correlative || firstItem.total !== undefined) {
      // Formato para ventas
      return data.map((sale, index) => 
        `${index + 1}. **${sale.correlative || sale.id}**\n   💰 Total: S/ ${sale.total?.toFixed(2) || '0.00'}\n   📅 Fecha: ${sale.date ? new Date(sale.date).toLocaleDateString('es-ES') : 'N/A'}`
      ).join('\n\n');
    }
    
    // Formato genérico
    return data.map((item, index) => 
      `${index + 1}. ${JSON.stringify(item, null, 2)}`
    ).join('\n\n');
  }

  /**
   * REEMPLAZAR VARIABLES DE OBJETO
   */
  private static replaceObjectVariables(template: string, data: any): string {
    let result = template;
    
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      if (typeof value === 'number') {
        result = result.replace(placeholder, value.toFixed(2));
      } else {
        result = result.replace(placeholder, String(value));
      }
    }
    
    return result;
  }

  /**
   * MANEJAR FALLBACK
   * Respuesta cuando no se detecta intent específico
   */
  private static async handleFallback(message: string): Promise<ChatResponse> {
    // Intentar búsqueda general en palabras clave comunes
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes("ayuda") || lowerMessage.includes("help")) {
      return {
        message: `🤖 **Puedo ayudarte con:**\n\n` +
                `• Buscar clientes: "buscar cliente Juan" o "cliente ID123"\n` +
                `• Ver deudores: "mostrar deudores" o "quién debe"\n` +
                `• Consultar ventas: "ventas del día" o "últimas ventas"\n` +
                `• Buscar productos: "producto galletas" o "productos disponibles"\n` +
                `• Deuda específica: "cuánto debe María" o "deuda cliente ID456"\n\n` +
                `💡 **Ejemplos:**\n` +
                `"¿Cuánto debe el cliente Juan?"\n` +
                `"Mostrar productos con stock"\n` +
                `"Ventas de hoy"\n` +
                `"Top 5 deudores"`,
        type: "normal"
      };
    }
    
    return {
      message: `🤔 No estoy seguro de cómo ayudarte con eso. \n\n` +
              `Puedes preguntar sobre:\n` +
              `• Clientes y deudas\n` +
              `• Ventas y productos\n` +
              `• Escribe "ayuda" para ver más opciones`,
      type: "normal"
    };
  }

  /**
   * CARGAR INTENTS DESDE BASE DE DATOS
   */
  static async loadIntents(): Promise<Intent[]> {
    try {
      const intents = await RTDBHelper.getData<Record<string, Intent>>("chatbot_intents");
      
      if (!intents) {
        // Crear intents por defecto si no existen
        const defaultIntents = this.getDefaultIntents();
        await this.saveIntents(defaultIntents);
        return defaultIntents;
      }
      
      return Object.values(intents);
    } catch (error) {
      console.error("Error loading intents:", error);
      return this.getDefaultIntents();
    }
  }

  /**
   * GUARDAR INTENTS EN BASE DE DATOS
   */
  static async saveIntents(intents: Intent[]): Promise<void> {
    try {
      const intentsObject = intents.reduce((acc, intent) => {
        acc[intent.id] = intent;
        return acc;
      }, {} as Record<string, Intent>);
      
      await RTDBHelper.setData("chatbot_intents", intentsObject);
    } catch (error) {
      console.error("Error saving intents:", error);
      throw error;
    }
  }

  /**
   * INTENTS POR DEFECTO
   */
  private static getDefaultIntents(): Intent[] {
    return [
      {
        id: "search_client",
        name: "Buscar Cliente",
        description: "Busca clientes por ID o nombre",
        keywords: ["cliente", "buscar", "encontrar", "id"],
        action: "search_client",
        response_template: "🔍 **Resultados de búsqueda:**\n\n{{results}}",
        enabled: true,
        examples: ["buscar cliente Juan", "cliente ID123", "encontrar María"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "get_debtors",
        name: "Mostrar Deudores",
        description: "Muestra lista de clientes con deudas pendientes",
        keywords: ["deudores", "debe", "deben", "deuda", "adeuda", "crédito"],
        action: "get_debtors",
        response_template: "💰 **Clientes con deudas pendientes ({{count}}):**\n\n{{results}}",
        enabled: true,
        examples: ["mostrar deudores", "quién debe", "lista de deudas"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "get_client_debt",
        name: "Deuda de Cliente Específico",
        description: "Consulta la deuda de un cliente en particular",
        keywords: ["cuánto", "debe", "deuda", "adeuda"],
        action: "get_client_debt",
        response_template: "💳 **Deuda de {{clientName}}:**\n\n💰 Total adeudado: S/ {{totalDebt}}\n📄 Facturas pendientes: {{pendingInvoices}}",
        enabled: true,
        examples: ["cuánto debe Juan", "deuda cliente María", "adeuda ID123"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "get_sales_today",
        name: "Ventas del Día",
        description: "Muestra las ventas realizadas hoy",
        keywords: ["ventas", "hoy", "día", "diarias"],
        action: "get_sales_today",
        response_template: "📊 **Ventas de hoy:**\n\n📈 Total ventas: {{count}}\n💰 Monto total: S/ {{total}}\n\n**Últimas ventas:**\n{{results}}",
        enabled: true,
        examples: ["ventas del día", "ventas de hoy", "cuánto vendimos hoy"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "get_products",
        name: "Mostrar Productos",
        description: "Muestra lista de productos disponibles",
        keywords: ["productos", "inventario", "stock", "disponible"],
        action: "get_products",
        response_template: "📦 **Productos disponibles ({{count}}):**\n\n{{results}}",
        enabled: true,
        examples: ["mostrar productos", "qué productos hay", "inventario disponible"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "search_product",
        name: "Buscar Producto",
        description: "Busca un producto específico",
        keywords: ["producto", "buscar", "encontrar"],
        action: "search_product",
        response_template: "🔍 **Resultados de búsqueda de productos:**\n\n{{results}}",
        enabled: true,
        examples: ["buscar producto galletas", "producto coca cola", "encontrar arroz"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "get_top_debtors",
        name: "Top Deudores",
        description: "Muestra los clientes con mayor deuda",
        keywords: ["top", "mayor", "grandes", "deudores"],
        action: "get_top_debtors",
        response_template: "🏆 **Top 5 Deudores:**\n\n{{results}}",
        enabled: true,
        examples: ["top deudores", "mayores deudas", "grandes deudores"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }
}