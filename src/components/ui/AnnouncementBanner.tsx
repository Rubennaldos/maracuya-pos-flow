// Componente para mostrar anuncios como banner
import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AnnouncementT } from "@/components/modules/lunch/types";

type AnnouncementBannerProps = {
  announcements: AnnouncementT[];
  onDismiss?: (announcementId: string) => void;
};

export function AnnouncementBanner({ announcements, onDismiss }: AnnouncementBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (announcements.length === 0) return null;

  // Filtrar anuncios no descartados
  const visibleAnnouncements = announcements.filter(
    (announcement) => !dismissed.has(announcement.id)
  );

  if (visibleAnnouncements.length === 0) return null;

  const currentAnnouncement = visibleAnnouncements[currentIndex];

  const handleDismiss = (announcementId: string) => {
    setDismissed((prev) => new Set([...prev, announcementId]));
    onDismiss?.(announcementId);

    // Si se descarta el anuncio actual, ajustar el índice
    if (currentIndex >= visibleAnnouncements.length - 1) {
      setCurrentIndex(Math.max(0, currentIndex - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? visibleAnnouncements.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prev) =>
      prev === visibleAnnouncements.length - 1 ? 0 : prev + 1
    );
  };

  return (
    // Márgenes alrededor del modal para que no toque bordes
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 md:p-8">
      {/* Ancho +20% (56rem -> 67.2rem) y tope por viewport; alto con margen máximo 88vh */}
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 w-full max-w-[67.2rem] md:w-[min(92vw,67.2rem)] max-h-[88vh]">
        <CardContent className="p-0">
          <div className="relative">
            {/* Imagen de fondo si existe */}
            {currentAnnouncement.image && (
              // Alto ~100% más, pero limitado por viewport para mantener margen
              <div className="relative h-[70vh] md:h-[75vh] lg:h-[80vh] max-h-[80vh] overflow-hidden">
                <img
                  src={currentAnnouncement.image}
                  alt={currentAnnouncement.title}
                  className="w-full h-full object-contain"
                />
                {/* Oscurecer un poco para legibilidad del texto */}
                <div className="absolute inset-0 bg-black/40" />
              </div>
            )}

            {/* Contenido del anuncio */}
            <div
              className={`${
                currentAnnouncement.image
                  ? "absolute inset-0 flex flex-col justify-center items-center text-center text-white p-6 md:p-10"
                  : "p-8 text-center"
              }`}
            >
              <div className="space-y-4 max-w-3xl">
                <h1
                  className={`text-3xl md:text-5xl lg:text-6xl font-bold ${
                    currentAnnouncement.image
                      ? "text-white drop-shadow-lg"
                      : "text-foreground"
                  }`}
                >
                  {currentAnnouncement.title}
                </h1>

                {currentAnnouncement.message && (
                  <p
                    className={`text-base md:text-lg lg:text-xl ${
                      currentAnnouncement.image
                        ? "text-white/95 drop-shadow-md"
                        : "text-muted-foreground"
                    }`}
                  >
                    {currentAnnouncement.message}
                  </p>
                )}
              </div>
            </div>

            {/* Controles */}
            <div className="absolute top-4 right-4 flex gap-2">
              {/* Navegación si hay múltiples anuncios */}
              {visibleAnnouncements.length > 1 && (
                <div className="flex gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePrevious}
                    className="h-8 w-8 p-0 bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleNext}
                    className="h-8 w-8 p-0 bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Botón de cerrar */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDismiss(currentAnnouncement.id)}
                className="h-8 w-8 p-0 bg-white/20 hover:bg-white/30 backdrop-blur-sm"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Indicador de página si hay múltiples anuncios */}
            {visibleAnnouncements.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 transform flex gap-2">
                {visibleAnnouncements.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentIndex
                        ? "bg-white"
                        : "bg-white/40 hover:bg-white/60"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
