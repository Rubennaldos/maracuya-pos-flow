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
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

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
}: Props) {
  const subtotal =
    (pricePerDay || 0) * (Array.isArray(selectedDays) ? selectedDays.length : 0);

  // Convert selected days to Date objects for calendar
  const selectedDates = selectedDays.map(date => parseISO(date));

  const handleDateSelect = (dates: Date[] | undefined) => {
    if (!dates) return;
    
    // Get the new selections as strings
    const newSelectedDays = dates.map(date => format(date, 'yyyy-MM-dd'));
    
    // Find what changed (added or removed)
    const wasAdded = newSelectedDays.find(date => !selectedDays.includes(date));
    const wasRemoved = selectedDays.find(date => !newSelectedDays.includes(date));
    
    if (wasAdded) {
      onToggleDay(wasAdded, true);
    } else if (wasRemoved) {
      onToggleDay(wasRemoved, false);
    }
  };

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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

        <div className="flex flex-col items-center space-y-4">
          <Calendar
            mode="multiple"
            selected={selectedDates}
            onSelect={handleDateSelect}
            disabled={(date) => date < tomorrow} // Only allow future dates
            locale={es}
            className="rounded-md border pointer-events-auto"
            defaultMonth={tomorrow}
          />
          
          {selectedDays.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Días seleccionados: {selectedDays.map(date => {
                const dateObj = parseISO(date);
                return format(dateObj, "EEEE dd/MM", { locale: es });
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
