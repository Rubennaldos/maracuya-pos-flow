// ChatBotAdmin.tsx - Panel de administración del chatbot
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Edit2, Trash2, Save, X, Eye, EyeOff, Copy, 
  TestTube, Settings, Bot, Brain, Zap 
} from "lucide-react";
import { Intent, ChatBotService } from "@/lib/chatBotService";
import { useToast } from "@/hooks/use-toast";

interface ChatBotAdminProps {
  intents: Intent[];
  onIntentsUpdate: (intents: Intent[]) => void;
}

/**
 * COMPONENTE DE ADMINISTRACIÓN DEL CHATBOT
 * 
 * Este componente permite:
 * - Crear, editar y eliminar intents
 * - Configurar palabras clave y respuestas
 * - Probar intents antes de activarlos
 * - Gestionar configuración general del chatbot
 */
export const ChatBotAdmin = ({ intents, onIntentsUpdate }: ChatBotAdminProps) => {
  const { toast } = useToast();
  const [editingIntent, setEditingIntent] = useState<Intent | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * CREAR NUEVO INTENT
   */
  const createNewIntent = () => {
    const newIntent: Intent = {
      id: `intent_${Date.now()}`,
      name: "",
      description: "",
      keywords: [],
      action: "custom",
      response_template: "",
      enabled: true,
      examples: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setEditingIntent(newIntent);
    setShowCreateDialog(true);
  };

  /**
   * GUARDAR INTENT
   */
  const saveIntent = async () => {
    if (!editingIntent) return;

    // Validaciones
    if (!editingIntent.name.trim()) {
      toast({
        title: "Error",
        description: "El nombre del intent es requerido",
        variant: "destructive"
      });
      return;
    }

    if (editingIntent.keywords.length === 0) {
      toast({
        title: "Error", 
        description: "Debe agregar al menos una palabra clave",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);

      let updatedIntents;
      
      if (intents.find(i => i.id === editingIntent.id)) {
        // Actualizar intent existente
        updatedIntents = intents.map(i => 
          i.id === editingIntent.id 
            ? { ...editingIntent, updated_at: new Date().toISOString() }
            : i
        );
      } else {
        // Agregar nuevo intent
        updatedIntents = [...intents, editingIntent];
      }

      // Guardar en base de datos
      await ChatBotService.saveIntents(updatedIntents);
      onIntentsUpdate(updatedIntents);

      toast({
        title: "Éxito",
        description: "Intent guardado correctamente"
      });

      setEditingIntent(null);
      setShowCreateDialog(false);

    } catch (error) {
      console.error("Error saving intent:", error);
      toast({
        title: "Error",
        description: "Error guardando el intent",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ELIMINAR INTENT
   */
  const deleteIntent = async (intentId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este intent?")) {
      return;
    }

    try {
      const updatedIntents = intents.filter(i => i.id !== intentId);
      await ChatBotService.saveIntents(updatedIntents);
      onIntentsUpdate(updatedIntents);

      toast({
        title: "Éxito",
        description: "Intent eliminado correctamente"
      });

    } catch (error) {
      console.error("Error deleting intent:", error);
      toast({
        title: "Error",
        description: "Error eliminando el intent",
        variant: "destructive"
      });
    }
  };

  /**
   * TOGGLE ESTADO DEL INTENT
   */
  const toggleIntentStatus = async (intentId: string) => {
    try {
      const updatedIntents = intents.map(i => 
        i.id === intentId 
          ? { ...i, enabled: !i.enabled, updated_at: new Date().toISOString() }
          : i
      );

      await ChatBotService.saveIntents(updatedIntents);
      onIntentsUpdate(updatedIntents);

      toast({
        title: "Éxito",
        description: "Estado del intent actualizado"
      });

    } catch (error) {
      console.error("Error toggling intent:", error);
      toast({
        title: "Error",
        description: "Error actualizando el intent",
        variant: "destructive"
      });
    }
  };

  /**
   * PROBAR INTENT
   */
  const testIntent = async () => {
    if (!testMessage.trim()) return;

    try {
      setIsLoading(true);
      const result = await ChatBotService.processMessage(testMessage, intents);
      setTestResult(result);
    } catch (error) {
      console.error("Error testing intent:", error);
      setTestResult({
        message: "Error procesando mensaje de prueba",
        type: "error"
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * AGREGAR PALABRA CLAVE
   */
  const addKeyword = (keyword: string) => {
    if (!editingIntent || !keyword.trim()) return;
    
    const keywords = [...editingIntent.keywords, keyword.trim()];
    setEditingIntent({
      ...editingIntent,
      keywords: [...new Set(keywords)] // Evitar duplicados
    });
  };

  /**
   * REMOVER PALABRA CLAVE
   */
  const removeKeyword = (index: number) => {
    if (!editingIntent) return;
    
    const keywords = editingIntent.keywords.filter((_, i) => i !== index);
    setEditingIntent({
      ...editingIntent,
      keywords
    });
  };

  /**
   * AGREGAR EJEMPLO
   */
  const addExample = (example: string) => {
    if (!editingIntent || !example.trim()) return;
    
    const examples = [...editingIntent.examples, example.trim()];
    setEditingIntent({
      ...editingIntent,
      examples: [...new Set(examples)] // Evitar duplicados
    });
  };

  /**
   * REMOVER EJEMPLO
   */
  const removeExample = (index: number) => {
    if (!editingIntent) return;
    
    const examples = editingIntent.examples.filter((_, i) => i !== index);
    setEditingIntent({
      ...editingIntent,
      examples
    });
  };

  /**
   * COPIAR INTENT
   */
  const copyIntent = (intent: Intent) => {
    const copiedIntent: Intent = {
      ...intent,
      id: `intent_${Date.now()}`,
      name: `${intent.name} (Copia)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setEditingIntent(copiedIntent);
    setShowCreateDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Administración de ChatBot
          </h2>
          <p className="text-muted-foreground mt-1">
            Configura intents, palabras clave y respuestas automáticas
          </p>
        </div>
        <Button onClick={createNewIntent} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Intent
        </Button>
      </div>

      <Tabs defaultValue="intents" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="intents" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Intents
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Probar
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuración
          </TabsTrigger>
        </TabsList>

        {/* TAB DE INTENTS */}
        <TabsContent value="intents" className="space-y-4">
          <div className="grid gap-4">
            {intents.map((intent) => (
              <Card key={intent.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch 
                        checked={intent.enabled}
                        onCheckedChange={() => toggleIntentStatus(intent.id)}
                      />
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {intent.enabled ? (
                            <Eye className="w-4 h-4 text-green-500" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-gray-400" />
                          )}
                          {intent.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {intent.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyIntent(intent)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingIntent(intent);
                          setShowCreateDialog(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteIntent(intent.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Palabras Clave:</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {intent.keywords.map((keyword, index) => (
                          <Badge key={index} variant="secondary">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Acción:</Label>
                      <Badge variant="outline" className="ml-2">
                        {intent.action}
                      </Badge>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Ejemplos:</Label>
                      <div className="text-sm text-muted-foreground mt-1">
                        {intent.examples.length > 0 ? (
                          intent.examples.slice(0, 3).map((example, index) => (
                            <div key={index}>• "{example}"</div>
                          ))
                        ) : (
                          "Sin ejemplos configurados"
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB DE PRUEBAS */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-5 h-5" />
                Probar ChatBot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Escribe un mensaje de prueba..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && testIntent()}
                />
                <Button 
                  onClick={testIntent} 
                  disabled={!testMessage.trim() || isLoading}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {testResult && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={testResult.type === "error" ? "destructive" : "default"}>
                          {testResult.type}
                        </Badge>
                        {testResult.intent && (
                          <Badge variant="outline">
                            Intent: {testResult.intent}
                          </Badge>
                        )}
                      </div>
                      <div className="bg-background p-3 rounded border">
                        <p className="whitespace-pre-wrap">{testResult.message}</p>
                      </div>
                      {testResult.data && (
                        <details className="mt-2">
                          <summary className="text-sm font-medium cursor-pointer">
                            Ver datos (JSON)
                          </summary>
                          <pre className="mt-2 text-xs bg-background p-2 rounded border overflow-auto">
                            {JSON.stringify(testResult.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB DE CONFIGURACIÓN */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración General</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Mensaje de Bienvenida</Label>
                    <p className="text-sm text-muted-foreground">
                      Mostrar mensaje de bienvenida al iniciar el chat
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Respuestas Inteligentes</Label>
                    <p className="text-sm text-muted-foreground">
                      Usar IA para generar respuestas cuando no hay intent específico
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Logging de Conversaciones</Label>
                    <p className="text-sm text-muted-foreground">
                      Guardar historial de conversaciones para analytics
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG PARA CREAR/EDITAR INTENT */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIntent?.name ? "Editar Intent" : "Crear Nuevo Intent"}
            </DialogTitle>
          </DialogHeader>

          {editingIntent && (
            <div className="space-y-6">
              {/* Información básica */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre del Intent *</Label>
                  <Input
                    value={editingIntent.name}
                    onChange={(e) => setEditingIntent({
                      ...editingIntent,
                      name: e.target.value
                    })}
                    placeholder="ej: Buscar Cliente"
                  />
                </div>
                <div>
                  <Label>Acción</Label>
                  <Input
                    value={editingIntent.action}
                    onChange={(e) => setEditingIntent({
                      ...editingIntent,
                      action: e.target.value
                    })}
                    placeholder="ej: search_client"
                  />
                </div>
              </div>

              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={editingIntent.description}
                  onChange={(e) => setEditingIntent({
                    ...editingIntent,
                    description: e.target.value
                  })}
                  placeholder="Describe qué hace este intent..."
                />
              </div>

              {/* Palabras clave */}
              <div>
                <Label>Palabras Clave *</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Agregar palabra clave..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addKeyword((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      addKeyword(input.value);
                      input.value = '';
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {editingIntent.keywords.map((keyword, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeKeyword(index)}
                    >
                      {keyword} <X className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Plantilla de respuesta */}
              <div>
                <Label>Plantilla de Respuesta</Label>
                <Textarea
                  value={editingIntent.response_template}
                  onChange={(e) => setEditingIntent({
                    ...editingIntent,
                    response_template: e.target.value
                  })}
                  placeholder="Usa {{variable}} para datos dinámicos..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variables disponibles: {"{results}"}, {"{count}"}, {"{clientName}"}, {"{totalDebt}"}
                </p>
              </div>

              {/* Ejemplos */}
              <div>
                <Label>Ejemplos de Frases</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Agregar ejemplo..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addExample((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      addExample(input.value);
                      input.value = '';
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-1 mt-2">
                  {editingIntent.examples.map((example, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between bg-muted p-2 rounded text-sm"
                    >
                      <span>"{example}"</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExample(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setEditingIntent(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={saveIntent} disabled={isLoading}>
                  {isLoading ? (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Guardar Intent
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};