// ChatBotAnalytics.tsx - Panel de analytics del chatbot
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { 
  MessageCircle, TrendingUp, Clock, Target, 
  Users, Bot, Activity, AlertCircle 
} from "lucide-react";
import { ChatMessage } from "@/lib/chatBotService";
import { format, subDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface ChatBotAnalyticsProps {
  messages: ChatMessage[];
}

/**
 * COMPONENTE DE ANALYTICS DEL CHATBOT
 * 
 * Proporciona métricas y estadísticas detalladas sobre:
 * - Uso del chatbot y volumen de consultas
 * - Intents más utilizados
 * - Patrones temporales de uso
 * - Efectividad de las respuestas
 */
export const ChatBotAnalytics = ({ messages }: ChatBotAnalyticsProps) => {
  
  /**
   * CALCULAR MÉTRICAS PRINCIPALES
   */
  const metrics = useMemo(() => {
    const userMessages = messages.filter(m => m.sender === "user");
    const botMessages = messages.filter(m => m.sender === "bot");
    const totalMessages = messages.length;
    
    // Contar por tipo de respuesta
    const errorMessages = botMessages.filter(m => m.type === "error").length;
    const dataMessages = botMessages.filter(m => m.type === "data").length;
    const normalMessages = botMessages.filter(m => m.type === "normal").length;
    
    // Intents más utilizados
    const intentCounts = botMessages.reduce((acc, msg) => {
      if (msg.intent) {
        acc[msg.intent] = (acc[msg.intent] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Distribución horaria
    const hourlyDistribution = userMessages.reduce((acc, msg) => {
      const hour = new Date(msg.timestamp).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Distribución diaria (últimos 7 días)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const count = userMessages.filter(msg => 
        msg.timestamp.startsWith(dateStr)
      ).length;
      
      return {
        date: format(date, 'dd/MM', { locale: es }),
        count
      };
    }).reverse();

    // Tasa de éxito (respuestas con datos vs errores)
    const successRate = botMessages.length > 0 
      ? ((dataMessages + normalMessages) / botMessages.length) * 100 
      : 0;

    return {
      totalMessages,
      userMessages: userMessages.length,
      botMessages: botMessages.length,
      errorMessages,
      dataMessages,
      normalMessages,
      intentCounts,
      hourlyDistribution,
      last7Days,
      successRate
    };
  }, [messages]);

  /**
   * DATOS PARA GRÁFICOS
   */
  const chartData = useMemo(() => {
    // Gráfico de intents
    const intentsChart = Object.entries(metrics.intentCounts)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Gráfico de distribución horaria
    const hourlyChart = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour}:00`,
      count: metrics.hourlyDistribution[hour] || 0
    }));

    // Gráfico de tipos de respuesta
    const responseTypesChart = [
      { name: 'Datos', value: metrics.dataMessages, color: '#22c55e' },
      { name: 'Normal', value: metrics.normalMessages, color: '#3b82f6' },
      { name: 'Error', value: metrics.errorMessages, color: '#ef4444' }
    ].filter(item => item.value > 0);

    return {
      intentsChart,
      hourlyChart,
      responseTypesChart
    };
  }, [metrics]);

  /**
   * FORMATEAR NÚMEROS
   */
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num);
  };

  /**
   * FORMATEAR PORCENTAJE
   */
  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          Analytics del ChatBot
        </h2>
        <p className="text-muted-foreground mt-1">
          Métricas de uso y rendimiento del asistente virtual
        </p>
      </div>

      {/* MÉTRICAS PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mensajes</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.totalMessages)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(metrics.userMessages)} consultas de usuarios
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(metrics.successRate)}</div>
            <Progress value={metrics.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Respuestas con Datos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.dataMessages)}</div>
            <p className="text-xs text-muted-foreground">
              Consultas exitosas con información
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errores</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.errorMessages)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.botMessages > 0 ? formatPercentage((metrics.errorMessages / metrics.botMessages) * 100) : '0%'} del total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico de actividad por día */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Actividad Últimos 7 Días
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.last7Days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  labelFormatter={(label) => `Fecha: ${label}`}
                  formatter={(value) => [value, 'Consultas']}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribución de tipos de respuesta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Tipos de Respuesta
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.responseTypesChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.responseTypesChart}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.responseTypesChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No hay datos de respuestas disponibles
              </div>
            )}
          </CardContent>
        </Card>

        {/* Intents más utilizados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Intents Más Utilizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.intentsChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.intentsChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="intent" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No hay datos de intents disponibles
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribución horaria */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Distribución Horaria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.hourlyChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip 
                  labelFormatter={(label) => `Hora: ${label}`}
                  formatter={(value) => [value, 'Consultas']}
                />
                <Bar dataKey="count" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* DETALLES ADICIONALES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Intents */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Intents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {chartData.intentsChart.slice(0, 5).map((item, index) => (
                <div key={item.intent} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="text-sm font-medium">{item.intent}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(item.count)} usos
                    </span>
                    <Progress 
                      value={(item.count / chartData.intentsChart[0]?.count || 1) * 100} 
                      className="w-20"
                    />
                  </div>
                </div>
              ))}
              {chartData.intentsChart.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay intents utilizados aún
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas rápidas */}
        <Card>
          <CardHeader>
            <CardTitle>Estadísticas Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Promedio mensajes/sesión:</span>
                <Badge variant="secondary">
                  {metrics.userMessages > 0 ? (metrics.totalMessages / metrics.userMessages).toFixed(1) : '0'}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Hora más activa:</span>
                <Badge variant="secondary">
                  {Object.entries(metrics.hourlyDistribution).length > 0 
                    ? `${Object.entries(metrics.hourlyDistribution).sort(([,a], [,b]) => b - a)[0]?.[0] || '0'}:00`
                    : 'N/A'
                  }
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Intents únicos usados:</span>
                <Badge variant="secondary">
                  {Object.keys(metrics.intentCounts).length}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Tasa de respuestas útiles:</span>
                <Badge variant={metrics.successRate > 80 ? "default" : metrics.successRate > 60 ? "secondary" : "destructive"}>
                  {formatPercentage(metrics.successRate)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};