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
      {/* p-0 para poder tener header + scroll + footer sticky */}
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5">
          <DialogHeader className="p-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5" />
              Agregar extras
            </DialogTitle>
            {productName ? (
              <p className="text-xs text-muted-foreground mt-1">
                Para: <span className="font-medium">{productName}</span>
              </p>
            ) : null}
          </DialogHeader>
        </div>

        {/* Contenido scrollable (dejamos espacio para el footer sticky) */}
        <div className="px-4 pb-28 pt-4 overflow-y-auto max-h-[70vh]">
          {activeAddons.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Este producto no tiene agregados disponibles
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeAddons.map((addon) => {
                const id = addon.id as string;
                const qty = selectedAddons[id] || 0;
                const selected = qty > 0;

                return (
                  <motion.div
                    key={id}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      "addon-chip",
                      selected && "addon-chip--active"
                    )}
                  >
                    {/* chip principal: nombre + precio */}
                    <button
                      type="button"
                      onClick={() => toggleAddon(id)}
                      className="flex items-center gap-2 tap-40"
                      aria-pressed={selected}
                    >
                      <span className="font-medium text-sm">{addon.name}</span>
                      <Badge variant="secondary" className="text-[11px] px-1.5 py-0.5">
                        {PEN(addon.price)}
                      </Badge>
                    </button>

                    {/* Controles de cantidad compactos */}
                    {selected && (
                      <div className="ml-2 flex items-center gap-1">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          className="btn-circle btn-32 border-border bg-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            changeQty(id, -1);
                          }}
                          aria-label="Disminuir"
                        >
                          <Minus className="h-3 w-3" />
                        </motion.button>
                        <span className="w-6 text-center text-sm font-medium">{qty}</span>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          className="btn-circle btn-32 border-border bg-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            changeQty(id, +1);
                          }}
                          aria-label="Aumentar"
                        >
                          <Plus className="h-3 w-3" />
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer sticky: total + acciones */}
        <div className="modal-sticky-footer">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Total agregados</span>
            <span className="text-base font-bold text-primary">
              {PEN(totalAddonsPrice)}
            </span>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1"
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
