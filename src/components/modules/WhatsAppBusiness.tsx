// WhatsAppBusiness.tsx - Módulo de WhatsApp Business
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, Send, MessageCircle, Settings, 
  Phone, Users, Clock, CheckCircle2, 
  AlertCircle, Smartphone, Copy, Download,
  RefreshCw, Zap, Bot
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ChatBotService, ChatResponse } from "@/lib/chatBotService";
import { WhatsAppService, WhatsAppMessage, WhatsAppConfig } from "@/lib/whatsappService";

interface WhatsAppBusinessProps {
  onBack: () => void;
}

/**
 * COMPONENTE PRINCIPAL DE WHATSAPP BUSINESS
 * 
 * Este módulo maneja:
 * - Conversaciones de WhatsApp Business
 * - Configuración de API y webhooks
 * - Respuestas automáticas con el chatbot
 * - Gestión de contactos y mensajes
 */
export const WhatsAppBusiness = ({ onBack }: WhatsAppBusinessProps) => {
  const { toast } = useToast();
  
  // Estados principales
  const [activeTab, setActiveTab] = useState("conversations");
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados de configuración
  const [config, setConfig] = useState<WhatsAppConfig>({
    accessToken: "",
    phoneNumberId: "",
    businessAccountId: "",
    webhookVerifyToken: "",
    autoResponseEnabled: true,
    businessHours: {
      enabled: true,
      start: "08:00",
      end: "18:00"
    }
  });
  
  // Estados de conversaciones
  const [conversations, setConversations] = useState<Record<string, WhatsAppMessage[]>>({});
  const [contacts, setContacts] = useState<Record<string, any>>({});
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  
  // Referencias
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<number>();

  /**
   * EFECTO DE INICIALIZACIÓN
   */
  useEffect(() => {
    loadConfiguration();
    loadConversations();
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  /**
   * SCROLL AUTOMÁTICO
   */
  useEffect(() => {
    scrollToBottom();
  }, [conversations, selectedContact]);

  /**
   * CARGAR CONFIGURACIÓN DESDE RTDB
   */
  const loadConfiguration = async () => {
    try {
      const savedConfig = await WhatsAppService.getConfiguration();
      if (savedConfig) {
        setConfig(savedConfig);
        if (savedConfig.accessToken && savedConfig.phoneNumberId) {
          setConnectionStatus("connected");
          startPolling();
        }
      }
    } catch (error) {
      console.error("Error loading configuration:", error);
    }
  };

  /**
   * CARGAR CONVERSACIONES DESDE RTDB
   */
  const loadConversations = async () => {
    try {
      const data = await WhatsAppService.getConversations();
      setConversations(data.conversations || {});
      setContacts(data.contacts || {});
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  /**
   * GUARDAR CONFIGURACIÓN
   */
  const saveConfiguration = async () => {
    setIsLoading(true);
    try {
      await WhatsAppService.saveConfiguration(config);
      
      // Verificar conexión
      if (config.accessToken && config.phoneNumberId) {
        const isValid = await WhatsAppService.verifyConnection(config);
        if (isValid) {
          setConnectionStatus("connected");
          startPolling();
          toast({
            title: "Configuración guardada",
            description: "WhatsApp Business conectado correctamente",
          });
        } else {
          setConnectionStatus("disconnected");
          toast({
            title: "Error de conexión",
            description: "Verifica tus credenciales de WhatsApp Business",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * INICIAR POLLING DE MENSAJES
   */
  const startPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    pollingRef.current = setInterval(async () => {
      try {
        const newMessages = await WhatsAppService.pollMessages(config);
        if (newMessages.length > 0) {
          await processNewMessages(newMessages);
        }
      } catch (error) {
        console.error("Error polling messages:", error);
      }
    }, 5000); // Poll cada 5 segundos
  };

  /**
   * PROCESAR MENSAJES NUEVOS
   */
  const processNewMessages = async (messages: WhatsAppMessage[]) => {
    for (const message of messages) {
      // Actualizar conversaciones
      setConversations(prev => ({
        ...prev,
        [message.from]: [...(prev[message.from] || []), message]
      }));

      // Actualizar contactos
      if (!contacts[message.from]) {
        setContacts(prev => ({
          ...prev,
          [message.from]: {
            phone: message.from,
            name: message.fromName || message.from,
            lastMessage: message.timestamp
          }
        }));
      }

      // Procesar respuesta automática
      if (config.autoResponseEnabled && message.type === "text") {
        await processAutoResponse(message);
      }
    }

    // Guardar en RTDB
    await WhatsAppService.saveConversations(conversations, contacts);
  };

  /**
   * PROCESAR RESPUESTA AUTOMÁTICA CON CHATBOT
   */
  const processAutoResponse = async (message: WhatsAppMessage) => {
    try {
      // Verificar horario comercial
      if (config.businessHours.enabled && !isBusinessHours()) {
        const response = "Gracias por contactarnos. Nuestro horario de atención es de " +
          `${config.businessHours.start} a ${config.businessHours.end}. ` +
          "Te responderemos lo antes posible.";
        
        await sendMessage(message.from, response);
        return;
      }

      // Procesar con el chatbot
      const intents = await ChatBotService.loadIntents();
      const chatResponse: ChatResponse = await ChatBotService.processMessage(
        message.text || "", 
        intents
      );

      if (chatResponse.message) {
        await sendMessage(message.from, chatResponse.message);
      }
    } catch (error) {
      console.error("Error processing auto response:", error);
    }
  };

  /**
   * VERIFICAR HORARIO COMERCIAL
   */
  const isBusinessHours = (): boolean => {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const startTime = parseInt(config.businessHours.start.replace(":", ""));
    const endTime = parseInt(config.businessHours.end.replace(":", ""));
    
    return currentTime >= startTime && currentTime <= endTime;
  };

  /**
   * ENVIAR MENSAJE
   */
  const sendMessage = async (to: string, text: string) => {
    if (!text.trim()) return;

    setIsLoading(true);
    try {
      const message: WhatsAppMessage = {
        id: `msg-${Date.now()}`,
        from: config.phoneNumberId,
        to,
        text: text.trim(),
        type: "text",
        timestamp: new Date().toISOString(),
        status: "sent",
        direction: "outbound"
      };

      // Enviar vía API de WhatsApp
      await WhatsAppService.sendMessage(config, to, text);

      // Actualizar conversación local
      setConversations(prev => ({
        ...prev,
        [to]: [...(prev[to] || []), message]
      }));

      // Limpiar input si es mensaje manual
      if (to === selectedContact) {
        setNewMessage("");
      }

      toast({
        title: "Mensaje enviado",
        description: "El mensaje se envió correctamente",
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * MANEJAR ENVÍO DE MENSAJE MANUAL
   */
  const handleSendMessage = async () => {
    if (!selectedContact || !newMessage.trim()) return;
    await sendMessage(selectedContact, newMessage);
  };

  /**
   * SCROLL AL FINAL
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /**
   * FORMATEAR TIEMPO
   */
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * COPIAR WEBHOOK URL
   */
  const copyWebhookUrl = () => {
    const webhookUrl = `${window.location.origin}/api/whatsapp/webhook`;
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "URL copiada",
      description: "URL del webhook copiada al portapapeles",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <div className="flex items-center space-x-2">
              <Smartphone className="w-6 h-6 text-green-600" />
              <h1 className="text-2xl font-bold text-foreground">WhatsApp Business</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={connectionStatus === "connected" ? "default" : "destructive"}
              className="text-sm"
            >
              {connectionStatus === "connected" && <CheckCircle2 className="w-3 h-3 mr-1" />}
              {connectionStatus === "connecting" && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
              {connectionStatus === "disconnected" && <AlertCircle className="w-3 h-3 mr-1" />}
              {connectionStatus === "connected" ? "Conectado" : 
               connectionStatus === "connecting" ? "Conectando" : "Desconectado"}
            </Badge>
            <Badge variant="outline" className="text-sm">
              {Object.keys(conversations).length} conversaciones
            </Badge>
          </div>
        </div>
      </header>

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="conversations" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Conversaciones
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configuración
            </TabsTrigger>
            <TabsTrigger value="automation" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Automatización
            </TabsTrigger>
          </TabsList>

          {/* TAB DE CONVERSACIONES */}
          <TabsContent value="conversations" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
              {/* Lista de contactos */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Contactos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {Object.entries(contacts).map(([phone, contact]) => (
                      <div
                        key={phone}
                        className={`p-4 border-b cursor-pointer hover:bg-muted/50 ${
                          selectedContact === phone ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedContact(phone)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{contact.name}</p>
                            <p className="text-sm text-muted-foreground">{phone}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {formatTime(contact.lastMessage)}
                            </p>
                            {conversations[phone]?.some(m => m.direction === "inbound" && !m.read) && (
                              <Badge variant="destructive" className="text-xs">Nuevo</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {Object.keys(contacts).length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No hay conversaciones aún</p>
                        <p className="text-sm">Los mensajes aparecerán aquí</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Chat */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    {selectedContact ? contacts[selectedContact]?.name : "Selecciona una conversación"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col h-[500px] p-0">
                  {selectedContact ? (
                    <>
                      {/* Mensajes */}
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                          {(conversations[selectedContact] || []).map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${
                                message.direction === "outbound" ? "justify-end" : "justify-start"
                              }`}
                            >
                              <div
                                className={`max-w-[70%] rounded-lg p-3 ${
                                  message.direction === "outbound"
                                    ? "bg-green-600 text-white"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs opacity-70">
                                    {formatTime(message.timestamp)}
                                  </span>
                                  {message.direction === "outbound" && (
                                    <CheckCircle2 className="w-3 h-3" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>

                      {/* Input de mensaje */}
                      <div className="border-t p-4">
                        <div className="flex gap-2">
                          <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Escribe tu mensaje..."
                            disabled={isLoading || connectionStatus !== "connected"}
                            className="flex-1"
                          />
                          <Button 
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() || isLoading || connectionStatus !== "connected"}
                            size="icon"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>Selecciona una conversación para comenzar</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB DE CONFIGURACIÓN */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración de API</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="accessToken">Access Token</Label>
                    <Input
                      id="accessToken"
                      type="password"
                      value={config.accessToken}
                      onChange={(e) => setConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                      placeholder="Token de WhatsApp Business API"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                    <Input
                      id="phoneNumberId"
                      value={config.phoneNumberId}
                      onChange={(e) => setConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                      placeholder="ID del número de teléfono"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="businessAccountId">Business Account ID</Label>
                    <Input
                      id="businessAccountId"
                      value={config.businessAccountId}
                      onChange={(e) => setConfig(prev => ({ ...prev, businessAccountId: e.target.value }))}
                      placeholder="ID de la cuenta de negocio"
                    />
                  </div>

                  <Button onClick={saveConfiguration} disabled={isLoading} className="w-full">
                    {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Settings className="w-4 h-4 mr-2" />}
                    Guardar Configuración
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Webhook Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhookVerifyToken">Verify Token</Label>
                    <Input
                      id="webhookVerifyToken"
                      value={config.webhookVerifyToken}
                      onChange={(e) => setConfig(prev => ({ ...prev, webhookVerifyToken: e.target.value }))}
                      placeholder="Token de verificación del webhook"
                    />
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">URL del Webhook:</p>
                    <div className="flex gap-2">
                      <Input
                        value={`${window.location.origin}/api/whatsapp/webhook`}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button size="sm" variant="outline" onClick={copyWebhookUrl}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Configura esta URL en tu aplicación de WhatsApp Business
                    </p>
                  </div>

                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mb-2" />
                    <p className="text-sm text-yellow-800">
                      <strong>Limitación:</strong> Sin backend propio, los webhooks no funcionarán automáticamente. 
                      Considera usar Supabase para funcionalidad completa.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB DE AUTOMATIZACIÓN */}
          <TabsContent value="automation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Respuestas Automáticas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoResponse">Habilitar respuestas automáticas</Label>
                    <p className="text-sm text-muted-foreground">
                      Usa el chatbot para responder automáticamente
                    </p>
                  </div>
                  <Switch
                    id="autoResponse"
                    checked={config.autoResponseEnabled}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, autoResponseEnabled: checked }))
                    }
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Horario comercial</Label>
                    <Switch
                      checked={config.businessHours.enabled}
                      onCheckedChange={(checked) => 
                        setConfig(prev => ({ 
                          ...prev, 
                          businessHours: { ...prev.businessHours, enabled: checked }
                        }))
                      }
                    />
                  </div>

                  {config.businessHours.enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startTime">Hora de inicio</Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={config.businessHours.start}
                          onChange={(e) => 
                            setConfig(prev => ({ 
                              ...prev, 
                              businessHours: { ...prev.businessHours, start: e.target.value }
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endTime">Hora de cierre</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={config.businessHours.end}
                          onChange={(e) => 
                            setConfig(prev => ({ 
                              ...prev, 
                              businessHours: { ...prev.businessHours, end: e.target.value }
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Bot className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        Integración con ChatBot
                      </p>
                      <p className="text-sm text-blue-700">
                        Las respuestas automáticas utilizan el mismo motor de IA 
                        configurado en el módulo ChatBot, incluyendo consultas a 
                        clientes, deudores, ventas y productos.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};