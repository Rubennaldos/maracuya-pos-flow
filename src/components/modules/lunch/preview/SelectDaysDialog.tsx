import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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

        <div className="space-y-3">
          {(!days || days.length === 0) ? (
            <div className="text-sm text-muted-foreground">
              No hay días habilitados para selección.
            </div>
          ) : (
            days.map(({ date, label }) => (
              <div
                key={date}
                className="flex items-center space-x-2 p-2 rounded border hover:bg-muted/50"
              >
                <Switch
                  checked={selectedDays.includes(date)}
                  onCheckedChange={(checked) => onToggleDay(date, !!checked)}
                />
                <Label className="capitalize flex-1 cursor-pointer">{label}</Label>
              </div>
            ))
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
