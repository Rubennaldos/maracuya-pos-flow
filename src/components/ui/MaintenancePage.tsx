import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Wrench } from "lucide-react";
import maintenanceImage from "@/assets/maintenance-worker.jpg";

type MaintenancePageProps = {
  whatsappPhone?: string;
};

export default function MaintenancePage({ whatsappPhone }: MaintenancePageProps) {
  const handleWhatsAppClick = () => {
    if (whatsappPhone) {
      const cleanPhone = whatsappPhone.replace(/\D/g, "");
      const message = encodeURIComponent("Hola! Quería consultar sobre el portal de almuerzos.");
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
      window.open(whatsappUrl, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardContent className="p-8 text-center space-y-6">
          {/* Imagen de mantenimiento */}
          <div className="relative">
            <img 
              src={maintenanceImage} 
              alt="Página en mantenimiento" 
              className="w-full h-48 object-cover rounded-lg shadow-md"
            />
            <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground p-2 rounded-full shadow-lg">
              <Wrench className="h-6 w-6" />
            </div>
          </div>

          {/* Título y mensaje */}
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-primary">
              🔧 Página en Mantenimiento
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Estamos trabajando para mejorar tu experiencia. 
              El portal de almuerzos estará disponible pronto.
            </p>
          </div>

          {/* Botón de WhatsApp */}
          {whatsappPhone && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                ¿Tienes alguna consulta urgente?
              </p>
              <Button 
                onClick={handleWhatsAppClick}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Contactar por WhatsApp
              </Button>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Maracuyá • Portal de Almuerzos
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}