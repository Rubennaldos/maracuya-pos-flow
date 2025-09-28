import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, addDays, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type DayOption = { date: string; label: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName?: string;
  pricePerDay?: number;
  days: DayOption[];               // [{ date: '2025-09-30', label: 'martes 30/09' }]
  selectedDays: string[];          // ['2025-09-30', ...]
  onToggleDay: (date: string, checked: boolean) => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  disabledDays?: Record<string, boolean>; // Nueva prop para días deshabilitados
};

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

export default function SelectDaysDialog({
  open,
  onOpenChange,
  productName,
  pricePerDay,
  days,
  selectedDays,
  onToggleDay,
  onConfirm,
  confirmDisabled,
  disabledDays,
}: Props) {
  const subtotal =
    (pricePerDay || 0) * (Array.isArray(selectedDays) ? selectedDays.length : 0);

  // Get current date in Peru timezone (UTC-5)
  const now = new Date();
  const peruTime = new Date(now.getTime() - (5 * 60 * 60 * 1000)); // UTC-5
  const today = new Date(peruTime.getFullYear(), peruTime.getMonth(), peruTime.getDate());
  
  // Mapeo de días de la semana para verificar días deshabilitados
  const dayKeyMap: Record<number, string> = {
    0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 
    4: 'thursday', 5: 'friday', 6: 'saturday'
  };
  
  // Generate next 14 days starting from today, filtering out disabled days
  const availableDays = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, i);
    const dayKey = dayKeyMap[date.getDay()];
    
    // Si el día está deshabilitado en configuración, no lo incluimos
    if (disabledDays?.[dayKey]) return null;
    
    return {
      date: format(date, 'yyyy-MM-dd'),
      dayName: format(date, 'EEEE', { locale: es }),
      dayNumber: format(date, 'd'),
      month: format(date, 'MMM', { locale: es }),
      isToday: i === 0
    };
  }).filter(Boolean) as Array<{
    date: string;
    dayName: string;
    dayNumber: string;
    month: string;
    isToday: boolean;
  }>;

  const handleDayToggle = (dateString: string) => {
    const isSelected = selectedDays.includes(dateString);
    onToggleDay(dateString, !isSelected);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Seleccionar días {productName ? `para ${productName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Elige los días en los que quieres recibir este producto.
            {typeof pricePerDay === "number" && (
              <span className="block mt-1 font-medium">
                Precio por día: {PEN(pricePerDay)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-7 gap-2">
            {availableDays.map(({ date, dayName, dayNumber, month, isToday }) => {
              const isSelected = selectedDays.includes(date);
              return (
                <button
                  key={date}
                  onClick={() => handleDayToggle(date)}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-lg border-2 transition-all hover:bg-muted/50",
                    isSelected 
                      ? "border-primary bg-primary text-primary-foreground" 
                      : "border-border",
                    isToday && "ring-2 ring-primary/20"
                  )}
                >
                  <span className="text-xs font-medium capitalize">
                    {dayName.slice(0, 3)}
                  </span>
                  <span className="text-lg font-bold">
                    {dayNumber}
                  </span>
                  <span className="text-xs capitalize">
                    {month}
                  </span>
                  {isToday && (
                    <span className="text-xs mt-1 opacity-70">Hoy</span>
                  )}
                </button>
              );
            })}
          </div>
          
          {selectedDays.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Días seleccionados: {selectedDays.map(date => {
                const dayInfo = availableDays.find(d => d.date === date);
                if (!dayInfo) return date;
                return `${dayInfo.dayName} ${dayInfo.dayNumber}/${dayInfo.month}`;
              }).join(', ')}
            </div>
          )}
        </div>

        {selectedDays.length > 0 && typeof pricePerDay === "number" && (
          <div className="bg-primary/10 p-3 rounded-lg">
            <div className="text-sm font-medium">
              Subtotal: {selectedDays.length} día
              {selectedDays.length > 1 ? "s" : ""} × {PEN(pricePerDay)} ={" "}
              {PEN(subtotal)}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={!!confirmDisabled}>
            Agregar al carrito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
