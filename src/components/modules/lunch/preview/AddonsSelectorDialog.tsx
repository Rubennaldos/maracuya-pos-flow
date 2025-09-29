// src/components/modules/lunch/preview/AddonsSelectorDialog.tsx
import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus } from "lucide-react";
import type { AddonT } from "../types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName?: string;
  addons: AddonT[];
  selectedAddons: { [addonId: string]: number }; // cantidad seleccionada por addon
  onAddonsChange: (selectedAddons: { [addonId: string]: number }) => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
};

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
  const activeAddons = useMemo(() => 
    addons.filter(addon => addon.active !== false), 
    [addons]
  );

  const totalAddonsPrice = useMemo(() => {
    return Object.entries(selectedAddons).reduce((total, [addonId, quantity]) => {
      const addon = addons.find(a => a.id === addonId);
      return total + (addon?.price || 0) * quantity;
    }, 0);
  }, [selectedAddons, addons]);

  const PEN = (amount: number) => `S/ ${amount.toFixed(2)}`;

  const handleToggleAddon = (addonId: string) => {
    const newSelected = { ...selectedAddons };
    if (newSelected[addonId]) {
      delete newSelected[addonId];
    } else {
      newSelected[addonId] = 1;
    }
    onAddonsChange(newSelected);
  };

  const handleChangeQuantity = (addonId: string, delta: number) => {
    const newSelected = { ...selectedAddons };
    const currentQty = newSelected[addonId] || 0;
    const newQty = Math.max(0, currentQty + delta);
    
    if (newQty === 0) {
      delete newSelected[addonId];
    } else {
      newSelected[addonId] = newQty;
    }
    onAddonsChange(newSelected);
  };

  const hasSelectedAddons = Object.keys(selectedAddons).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Agregar extras
          </DialogTitle>
          {productName && (
            <p className="text-sm text-muted-foreground">
              Para: <span className="font-medium">{productName}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {activeAddons.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Este producto no tiene agregados disponibles
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {activeAddons.map((addon) => {
                  const isSelected = selectedAddons[addon.id!] > 0;
                  const quantity = selectedAddons[addon.id!] || 0;

                  return (
                    <div
                      key={addon.id}
                      className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleAddon(addon.id!)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{addon.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {PEN(addon.price)}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleChangeQuantity(addon.id!, -1)}
                            className="h-7 w-7 p-0"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm w-6 text-center">{quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleChangeQuantity(addon.id!, 1)}
                            className="h-7 w-7 p-0"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {hasSelectedAddons && (
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center font-medium">
                    <span>Total agregados:</span>
                    <span className="text-primary">{PEN(totalAddonsPrice)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="flex-1"
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}