"use client";

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
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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

  // Fecha Perú (UTC-5) para generar próximos días
  const now = new Date();
  const peruTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const today = new Date(peruTime.getFullYear(), peruTime.getMonth(), peruTime.getDate());

  const dayKeyMap: Record<number, string> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };

  // Próximos 14 días (filtrando deshabilitados)
  const availableDays = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, i);
    const dayKey = dayKeyMap[date.getDay()];
    if (disabledDays?.[dayKey]) return null;

    return {
      date: format(date, "yyyy-MM-dd"),
      dayName: format(date, "EEEE", { locale: es }),
      dayNumber: format(date, "d"),
      month: format(date, "MMM", { locale: es }),
      isToday: i === 0,
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
    // vibración ligera opcional
    if (navigator?.vibrate) navigator.vibrate(8);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        {/* header */}
        <div className="px-5 pt-5">
          <DialogHeader className="p-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              Seleccionar días {productName ? `para ${productName}` : ""}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Elige los días en los que quieres recibir este producto.
              {typeof pricePerDay === "number" && (
                <span className="block mt-1 font-medium">
                  Precio por día: {PEN(pricePerDay)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* contenido scrollable */}
        <div className="px-4 pb-24 pt-4 overflow-y-auto max-h-[70vh]">
          {/* rejilla de botones circulares */}
          <div
            className={cn(
              "grid gap-2",
              // 7 en desktop, 5/6 en pantallas chicas para tacto cómodo
              "grid-cols-6 sm:grid-cols-7"
            )}
          >
            {availableDays.map(({ date, dayName, dayNumber, month, isToday }) => {
              const isSelected = selectedDays.includes(date);
              return (
                <motion.button
                  key={date}
                  type="button"
                  onClick={() => handleDayToggle(date)}
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ y: -2 }}
                  aria-pressed={isSelected}
                  className={cn(
                    "h-16 w-full rounded-full border-2 flex flex-col items-center justify-center",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
                    "text-xs select-none",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-white hover:bg-muted/40",
                    isToday && !isSelected && "ring-1 ring-primary/20"
                  )}
                >
                  <span className="font-semibold leading-none capitalize">
                    {dayName.slice(0, 3)}
                  </span>
                  <span className="text-base font-bold leading-none">{dayNumber}</span>
                  <span className="leading-none capitalize opacity-80">{month}</span>
                </motion.button>
              );
            })}
          </div>

          {/* listado elegido (compacto) */}
          {selectedDays.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              Días seleccionados:{" "}
              {selectedDays
                .map((date) => {
                  const dayInfo = availableDays.find((d) => d.date === date);
                  if (!dayInfo) return date;
                  return `${dayInfo.dayName} ${dayInfo.dayNumber}/${dayInfo.month}`;
                })
                .join(", ")}
            </div>
          )}
        </div>

        {/* sticky total + acciones */}
        <div className="sticky bottom-0 w-full border-t bg-white/95 backdrop-blur px-4 py-3">
          {selectedDays.length > 0 && typeof pricePerDay === "number" ? (
            <div className="mb-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium">
              Subtotal: {selectedDays.length} día
              {selectedDays.length > 1 ? "s" : ""} × {PEN(pricePerDay)} = {PEN(subtotal)}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={onConfirm} disabled={!!confirmDisabled}>
              Agregar al carrito
            </Button>
          </div>
        </div>

        {/* mantenemos DialogFooter para no romper estructura, aunque ya no visible */}
        <DialogFooter className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
