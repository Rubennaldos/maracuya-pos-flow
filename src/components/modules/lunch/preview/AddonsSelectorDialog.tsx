"use client";

import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus } from "lucide-react";
import type { AddonT } from "@/components/modules/lunch/types";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName?: string;
  addons: AddonT[];
  selectedAddons: { [addonId: string]: number }; // cantidad por addon
  onAddonsChange: (selectedAddons: { [addonId: string]: number }) => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
};

const PEN = (n: number) => `S/ ${Number(n || 0).toFixed(2)}`;

export default function AddonsSelectorDialog({
  open,
  onOpenChange,
  productName,
  addons,
  selectedAddons,
  onAddonsChange,
  onConfirm,
  confirmDisabled,
}: Props) {
  // Solo agregados activos
  const activeAddons = useMemo(
    () => (addons || []).filter((a) => a && a.active !== false),
    [addons]
  );

  // Total de agregados seleccionados
  const totalAddonsPrice = useMemo(() => {
    return Object.entries(selectedAddons).reduce((total, [addonId, qty]) => {
      const addon = addons.find((a) => a?.id === addonId);
      return total + (Number(addon?.price) || 0) * (qty || 0);
    }, 0);
  }, [selectedAddons, addons]);

  const hasSelected = Object.keys(selectedAddons).length > 0;

  const toggleAddon = (id: string) => {
    const next = { ...selectedAddons };
    if (next[id]) delete next[id];
    else next[id] = 1;
    onAddonsChange(next);

    // feedback háptico suave (si existe)
    try {
      if (
        typeof navigator !== "undefined" &&
        "vibrate" in navigator &&
        typeof (navigator as any).vibrate === "function"
      ) {
        (navigator as any).vibrate(8);
      }
    } catch {
      /* noop */
    }
  };

  const changeQty = (id: string, delta: number) => {
    const next = { ...selectedAddons };
    const q = (next[id] || 0) + delta;
    if (q <= 0) delete next[id];
    else next[id] = q;
    onAddonsChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Modal más compacto */}
      <DialogContent
        className={cn(
          "p-0 overflow-hidden",
          // ancho contenido y altura
          "w-[360px] sm:max-w-[420px] max-h-[80vh] rounded-lg"
        )}
      >
        {/* Header más compacto */}
        <div className="px-3 pt-3 pb-1">
          <DialogHeader className="p-0 space-y-0.5">
            <DialogTitle className="flex items-center gap-1.5 text-sm leading-none tracking-tight">
              <Plus className="h-3.5 w-3.5" />
              <span className="font-medium">Agregar extras</span>
            </DialogTitle>
            {productName ? (
              <p className="text-[11px] leading-none text-muted-foreground mt-0.5">
                Para: <span className="font-medium">{productName}</span>
              </p>
            ) : null}
          </DialogHeader>
        </div>

        {/* Contenido scrollable compacto */}
        <div className="px-3 pb-24 pt-2 overflow-y-auto max-h-[50vh]">
          {activeAddons.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Este producto no tiene agregados disponibles
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeAddons.map((addon) => {
                const id = addon.id as string; // aseguramos id string
                const qty = selectedAddons[id] || 0;
                const selected = qty > 0;

                return (
                  <motion.div
                    key={id}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      "relative border rounded-full px-3 py-1.5 text-[13px]",
                      "flex items-center gap-2 select-none shadow-sm",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-white hover:bg-muted/50"
                    )}
                  >
                    {/* chip principal: nombre + precio */}
                    <button
                      type="button"
                      onClick={() => toggleAddon(id)}
                      className="flex items-center gap-2"
                      aria-pressed={selected}
                    >
                      <span className="font-medium">{addon.name}</span>
                      <Badge
                        variant="secondary"
                        className="h-5 px-1.5 text-[11px] leading-none"
                      >
                        {PEN(addon.price)}
                      </Badge>
                    </button>

                    {/* Controles de cantidad compactos (32px) solo si está seleccionado */}
                    {selected && (
                      <div className="ml-1 flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            changeQty(id, -1);
                          }}
                          aria-label="Disminuir"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-6 text-center text-sm">{qty}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            changeQty(id, +1);
                          }}
                          aria-label="Aumentar"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer sticky compacto */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-t px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Total agregados</span>
            <span className="text-sm font-semibold text-primary">
              {PEN(totalAddonsPrice)}
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 h-9"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1 h-9"
              onClick={onConfirm}
              disabled={!!confirmDisabled}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
