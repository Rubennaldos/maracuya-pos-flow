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

  // Convert available days to Date objects for calendar
  const availableDates = days.map(day => parseISO(day.date));
  const selectedDates = selectedDays.map(date => parseISO(date));

  const handleDateToggle = (date: Date | undefined) => {
    if (!date) return;
    
    const dateString = format(date, 'yyyy-MM-dd');
    const isSelected = selectedDays.includes(dateString);
    onToggleDay(dateString, !isSelected);
  };

  const isDateAvailable = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return days.some(day => day.date === dateString);
  };

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
          {(!days || days.length === 0) ? (
            <div className="text-sm text-muted-foreground">
              No hay días habilitados para selección.
            </div>
          ) : (
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={(dates) => {
                if (!dates) return;
                const lastSelected = dates[dates.length - 1];
                if (lastSelected) {
                  handleDateToggle(lastSelected);
                }
              }}
              disabled={(date) => !isDateAvailable(date)}
              locale={es}
              className="rounded-md border pointer-events-auto"
              modifiers={{
                available: availableDates,
              }}
              modifiersStyles={{
                available: {
                  fontWeight: 'bold',
                },
              }}
            />
          )}
          
          {selectedDays.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Días seleccionados: {selectedDays.map(date => {
                const dayInfo = days.find(d => d.date === date);
                return dayInfo ? dayInfo.label : date;
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
