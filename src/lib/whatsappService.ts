// whatsappService.ts - Servicio para WhatsApp Business API
import { ref, push, set, get, onValue, off } from "firebase/database";
import { rtdb } from "./rtdb";

// Interfaces para WhatsApp Business
export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  text?: string;
  type: "text" | "image" | "document" | "audio" | "video";
  timestamp: string;
  status: "sent" | "delivered" | "read" | "failed";
  direction: "inbound" | "outbound";
  mediaUrl?: string;
  read?: boolean;
  fromName?: string;
}

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  autoResponseEnabled: boolean;
  businessHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface WhatsAppContact {
  phone: string;
  name: string;
  lastMessage: string;
  unreadCount?: number;
}

/**
 * SERVICIO DE WHATSAPP BUSINESS
 * 
 * Maneja toda la integración con WhatsApp Business API:
 * - Envío y recepción de mensajes
 * - Configuración de webhooks
 * - Almacenamiento en Firebase RTDB
 * - Gestión de contactos y conversaciones
 */
export class WhatsAppService {
  private static readonly WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";
  
  /**
   * ENVIAR MENSAJE VÍA WHATSAPP API
   */
  static async sendMessage(config: WhatsAppConfig, to: string, text: string): Promise<any> {
    if (!config.accessToken || !config.phoneNumberId) {
      throw new Error("Configuración de WhatsApp incompleta");
    }

    const url = `${this.WHATSAPP_API_URL}/${config.phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: {
        body: text
      }
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("WhatsApp API Error:", error);
        throw new Error(`Error enviando mensaje: ${error.error?.message || "Error desconocido"}`);
      }

      const result = await response.json();
      
      // Guardar mensaje enviado en RTDB
      await this.saveMessage({
        id: result.messages?.[0]?.id || `msg-${Date.now()}`,
        from: config.phoneNumberId,
        to,
        text,
        type: "text",
        timestamp: new Date().toISOString(),
        status: "sent",
        direction: "outbound"
      });

      return result;
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      throw error;
    }
  }

  /**
   * VERIFICAR CONEXIÓN CON WHATSAPP API
   */
  static async verifyConnection(config: WhatsAppConfig): Promise<boolean> {
    if (!config.accessToken || !config.phoneNumberId) {
      return false;
    }

    try {
      const url = `${this.WHATSAPP_API_URL}/${config.phoneNumberId}`;
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${config.accessToken}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error("Error verifying WhatsApp connection:", error);
      return false;
    }
  }

  /**
   * SIMULAR POLLING DE MENSAJES (sin webhook real)
   * En producción con backend, esto se haría vía webhooks
   */
  static async pollMessages(config: WhatsAppConfig): Promise<WhatsAppMessage[]> {
    // NOTA: Esta es una implementación simulada
    // En un entorno real con webhooks, los mensajes llegarían automáticamente
    
    try {
      // Intentar obtener mensajes desde la API (esto puede no estar disponible sin webhooks)
      const url = `${this.WHATSAPP_API_URL}/${config.businessAccountId}/conversations`;
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${config.accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Procesar y convertir a nuestro formato
        return this.processApiMessages(data);
      }
    } catch (error) {
      console.warn("Polling no disponible sin webhooks:", error);
    }

    // Por ahora retornar array vacío
    return [];
  }

  /**
   * PROCESAR MENSAJES DE LA API
   */
  private static processApiMessages(apiData: any): WhatsAppMessage[] {
    const messages: WhatsAppMessage[] = [];
    
    if (apiData.data) {
      for (const conversation of apiData.data) {
        // Convertir formato de API a nuestro formato
        // Esta implementación depende del formato específico de la API
      }
    }
    
    return messages;
  }

  /**
   * GUARDAR MENSAJE EN RTDB
   */
  static async saveMessage(message: WhatsAppMessage): Promise<void> {
    try {
      const conversationId = message.direction === "outbound" ? message.to : message.from;
      const messageRef = ref(rtdb, `whatsapp/conversations/${conversationId}/messages/${message.id}`);
      await set(messageRef, message);
      
      // Actualizar último mensaje en el contacto
      const contactRef = ref(rtdb, `whatsapp/contacts/${conversationId}`);
      const contactSnapshot = await get(contactRef);
      
      const contactData = {
        phone: conversationId,
        name: contactSnapshot.val()?.name || message.fromName || conversationId,
        lastMessage: message.timestamp,
        unreadCount: message.direction === "inbound" ? 
          ((contactSnapshot.val()?.unreadCount || 0) + 1) : 0
      };
      
      await set(contactRef, contactData);
    } catch (error) {
      console.error("Error saving message to RTDB:", error);
      throw error;
    }
  }

  /**
   * OBTENER CONVERSACIONES DESDE RTDB
   */
  static async getConversations(): Promise<{
    conversations: Record<string, WhatsAppMessage[]>;
    contacts: Record<string, WhatsAppContact>;
  }> {
    try {
      const conversationsRef = ref(rtdb, "whatsapp/conversations");
      const contactsRef = ref(rtdb, "whatsapp/contacts");
      
      const [conversationsSnapshot, contactsSnapshot] = await Promise.all([
        get(conversationsRef),
        get(contactsRef)
      ]);
      
      const conversations: Record<string, WhatsAppMessage[]> = {};
      const conversationsData = conversationsSnapshot.val() || {};
      
      // Convertir estructura de RTDB a arrays de mensajes
      Object.entries(conversationsData).forEach(([contactId, conversation]: [string, any]) => {
        const messages: WhatsAppMessage[] = [];
        if (conversation.messages) {
          Object.values(conversation.messages).forEach((message: any) => {
            messages.push(message);
          });
        }
        // Ordenar por timestamp
        messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        conversations[contactId] = messages;
      });
      
      return {
        conversations,
        contacts: contactsSnapshot.val() || {}
      };
    } catch (error) {
      console.error("Error getting conversations from RTDB:", error);
      return { conversations: {}, contacts: {} };
    }
  }

  /**
   * GUARDAR CONVERSACIONES EN RTDB
   */
  static async saveConversations(
    conversations: Record<string, WhatsAppMessage[]>,
    contacts: Record<string, WhatsAppContact>
  ): Promise<void> {
    try {
      // Convertir conversaciones al formato de RTDB
      const rtdbConversations: Record<string, any> = {};
      
      Object.entries(conversations).forEach(([contactId, messages]) => {
        rtdbConversations[contactId] = {
          messages: messages.reduce((acc, message) => {
            acc[message.id] = message;
            return acc;
          }, {} as Record<string, WhatsAppMessage>)
        };
      });
      
      // Guardar en batch
      const updates: Record<string, any> = {};
      updates["whatsapp/conversations"] = rtdbConversations;
      updates["whatsapp/contacts"] = contacts;
      
      await set(ref(rtdb), updates);
    } catch (error) {
      console.error("Error saving conversations to RTDB:", error);
      throw error;
    }
  }

  /**
   * GUARDAR CONFIGURACIÓN EN RTDB
   */
  static async saveConfiguration(config: WhatsAppConfig): Promise<void> {
    try {
      const configRef = ref(rtdb, "whatsapp/config");
      await set(configRef, config);
    } catch (error) {
      console.error("Error saving WhatsApp configuration:", error);
      throw error;
    }
  }

  /**
   * OBTENER CONFIGURACIÓN DESDE RTDB
   */
  static async getConfiguration(): Promise<WhatsAppConfig | null> {
    try {
      const configRef = ref(rtdb, "whatsapp/config");
      const snapshot = await get(configRef);
      return snapshot.val();
    } catch (error) {
      console.error("Error getting WhatsApp configuration:", error);
      return null;
    }
  }

  /**
   * MARCAR MENSAJES COMO LEÍDOS
   */
  static async markAsRead(contactId: string): Promise<void> {
    try {
      const contactRef = ref(rtdb, `whatsapp/contacts/${contactId}/unreadCount`);
      await set(contactRef, 0);
      
      // Marcar todos los mensajes de entrada como leídos
      const messagesRef = ref(rtdb, `whatsapp/conversations/${contactId}/messages`);
      const snapshot = await get(messagesRef);
      const messages = snapshot.val() || {};
      
      const updates: Record<string, any> = {};
      Object.entries(messages).forEach(([messageId, message]: [string, any]) => {
        if (message.direction === "inbound") {
          updates[`whatsapp/conversations/${contactId}/messages/${messageId}/read`] = true;
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await set(ref(rtdb), updates);
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
      throw error;
    }
  }

  /**
   * CONFIGURAR WEBHOOK (función de utilidad)
   * Esto requiere un backend real para funcionar
   */
  static getWebhookInstructions(): string {
    return `
Para configurar WhatsApp Business API:

1. Ve a Meta for Developers (developers.facebook.com)
2. Crea una nueva app de WhatsApp Business
3. Configura el webhook con esta URL: ${window.location.origin}/api/whatsapp/webhook
4. Usa el verify token configurado en este módulo
5. Suscríbete a los eventos: messages, message_deliveries

IMPORTANTE: Sin un backend propio, los webhooks no funcionarán automáticamente.
Para funcionalidad completa, considera usar Supabase Edge Functions.

Eventos que debes suscribir:
- messages (mensajes entrantes)
- message_deliveries (confirmaciones de entrega)
- message_reads (confirmaciones de lectura)
    `;
  }

  /**
   * PROCESAR WEBHOOK DE WHATSAPP (función de referencia)
   * Esta función sería usada en un endpoint real
   */
  static async processWebhook(webhookData: any): Promise<void> {
    try {
      if (webhookData.object === "whatsapp_business_account") {
        for (const entry of webhookData.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === "messages") {
              const messages = change.value?.messages || [];
              const contacts = change.value?.contacts || [];
              
              for (const message of messages) {
                const contact = contacts.find((c: any) => c.wa_id === message.from);
                
                const whatsappMessage: WhatsAppMessage = {
                  id: message.id,
                  from: message.from,
                  to: change.value.metadata.phone_number_id,
                  text: message.text?.body,
                  type: message.type,
                  timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                  status: "delivered",
                  direction: "inbound",
                  fromName: contact?.profile?.name
                };
                
                await this.saveMessage(whatsappMessage);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing WhatsApp webhook:", error);
      throw error;
    }
  }
}