// ChatBot.tsx - Módulo principal del chatbot
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Send, Bot, User, Settings, MessageCircle, 
  Database, Trash2, Edit2, Plus, Download, Copy 
} from "lucide-react";
import { ChatBotService, ChatMessage, Intent, ChatResponse } from "@/lib/chatBotService";
import { ChatBotAdmin } from "./chatbot/ChatBotAdmin";
import { ChatBotAnalytics } from "./chatbot/ChatBotAnalytics";

interface ChatBotProps {
  onBack: () => void;
}

/**
 * COMPONENTE PRINCIPAL DEL CHATBOT
 * 
 * Este componente maneja toda la interfaz del chatbot incluyendo:
 * - Chat en tiempo real con usuarios
 * - Panel de administración para configurar intents
 * - Analytics y estadísticas de uso
 * - Configuración de respuestas automáticas
 */
export const ChatBot = ({ onBack }: ChatBotProps) => {
  // Estados principales del chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  
  // Estados para configuración
  const [intents, setIntents] = useState<Intent[]>([]);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
  
  // Referencias para scroll automático
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  /**
   * EFECTO DE INICIALIZACIÓN
   * Carga los intents configurados y muestra mensaje de bienvenida
   */
  useEffect(() => {
    const initializeChatBot = async () => {
      try {
        // Cargar intents desde la base de datos
        const loadedIntents = await ChatBotService.loadIntents();
        setIntents(loadedIntents);
        
        // Mostrar mensaje de bienvenida si está activado
        if (showWelcomeMessage) {
          const welcomeMessage: ChatMessage = {
            id: "welcome-" + Date.now(),
            text: "¡Hola! Soy tu asistente virtual de Maracuyá Villa Gratia. Puedo ayudarte con consultas sobre clientes, deudas, ventas y productos. ¿En qué puedo ayudarte?",
            sender: "bot",
            timestamp: new Date().toISOString(),
            type: "welcome"
          };
          setMessages([welcomeMessage]);
        }
      } catch (error) {
        console.error("Error initializing chatbot:", error);
      }
    };

    initializeChatBot();
  }, [showWelcomeMessage]);

  /**
   * SCROLL AUTOMÁTICO AL FINAL
   * Mantiene el chat siempre en el último mensaje
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /**
   * ENVIAR MENSAJE
   * Procesa el mensaje del usuario y genera respuesta automática
   */
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: "user-" + Date.now(),
      text: inputMessage.trim(),
      sender: "user",
      timestamp: new Date().toISOString()
    };

    // Agregar mensaje del usuario
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Procesar mensaje con el servicio del chatbot
      const response: ChatResponse = await ChatBotService.processMessage(
        inputMessage.trim(), 
        intents
      );

      // Simular delay para mejor UX
      setTimeout(() => {
        const botMessage: ChatMessage = {
          id: "bot-" + Date.now(),
          text: response.message,
          sender: "bot",
          timestamp: new Date().toISOString(),
          type: response.type,
          data: response.data, // Datos adicionales si los hay
          intent: response.intent
        };

        setMessages(prev => [...prev, botMessage]);
        setIsLoading(false);
      }, 800);

    } catch (error) {
      console.error("Error processing message:", error);
      
      const errorMessage: ChatMessage = {
        id: "error-" + Date.now(),
        text: "Lo siento, he tenido un problema procesando tu consulta. Por favor intenta de nuevo.",
        sender: "bot",
        timestamp: new Date().toISOString(),
        type: "error"
      };

      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  /**
   * MANEJAR ENTER PARA ENVIAR
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /**
   * LIMPIAR CONVERSACIÓN
   */
  const clearChat = () => {
    setMessages([]);
    if (showWelcomeMessage) {
      const welcomeMessage: ChatMessage = {
        id: "welcome-" + Date.now(),
        text: "¡Hola! ¿En qué puedo ayudarte hoy?",
        sender: "bot",
        timestamp: new Date().toISOString(),
        type: "welcome"
      };
      setMessages([welcomeMessage]);
    }
  };

  /**
   * FORMATEAR TIMESTAMP
   */
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * COPIAR MENSAJE AL PORTAPAPELES
   */
  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
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
              <Bot className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">ChatBot Asistente</h1>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">
            {messages.filter(m => m.sender === "user").length} consultas
          </Badge>
        </div>
      </header>

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configuración
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* TAB DE CHAT PRINCIPAL */}
          <TabsContent value="chat" className="space-y-6">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="flex-none">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    Conversación
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={clearChat}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Limpiar
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                {/* Área de mensajes */}
                <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            message.sender === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {message.sender === "bot" && (
                              <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            )}
                            {message.sender === "user" && (
                              <User className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                              
                              {/* Mostrar datos adicionales si los hay */}
                              {message.data && (
                                <div className="mt-2 p-2 bg-background/50 rounded text-xs">
                                  <pre className="whitespace-pre-wrap">
                                    {JSON.stringify(message.data, null, 2)}
                                  </pre>
                                </div>
                              )}

                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs opacity-70">
                                  {formatTime(message.timestamp)}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyMessage(message.text)}
                                  className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Indicador de escritura */}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted text-muted-foreground rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4" />
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input de mensaje */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Escribe tu consulta aquí... (ej: ¿Cuánto debe el cliente Juan?)"
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <Button 
                      onClick={sendMessage} 
                      disabled={!inputMessage.trim() || isLoading}
                      size="icon"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Sugerencias rápidas */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      "Buscar cliente por ID",
                      "Mostrar deudores",
                      "Ventas del día",
                      "Productos disponibles"
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        onClick={() => setInputMessage(suggestion)}
                        disabled={isLoading}
                        className="text-xs"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB DE ADMINISTRACIÓN */}
          <TabsContent value="admin">
            <ChatBotAdmin 
              intents={intents}
              onIntentsUpdate={setIntents}
            />
          </TabsContent>

          {/* TAB DE ANALYTICS */}
          <TabsContent value="analytics">
            <ChatBotAnalytics messages={messages} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};