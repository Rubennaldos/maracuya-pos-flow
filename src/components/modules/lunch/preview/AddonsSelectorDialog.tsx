import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus } from "lucide-react";
import type { AddonT } from "@/components/modules/lunch/types";

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
  const activeAddons = useMemo(
    () => (addons || []).filter((a) => a && a.active !== false),
    [addons]
  );

  const totalAddonsPrice = useMemo(() => {
    return Object.entries(selectedAddons).reduce((total, [addonId, qty]) => {
      const addon = addons.find((a) => a.id === addonId);
      return total + (addon?.price || 0) * (qty || 0);
    }, 0);
  }, [selectedAddons, addons]);

  const toggleAddon = (id: string) => {
    const next = { ...selectedAddons };
    if (next[id]) delete next[id];
    else next[id] = 1;
    onAddonsChange(next);
  };

  const changeQty = (id: string, delta: number) => {
    const next = { ...selectedAddons };
    const q = (next[id] || 0) + delta;
    if (q <= 0) delete next[id];
    else next[id] = q;
    onAddonsChange(next);
  };

  const hasSelected = Object.keys(selectedAddons).length > 0;

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

        <div className="space-y-3">
          {activeAddons.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Este producto no tiene agregados disponibles
            </p>
          ) : (
            activeAddons.map((addon) => {
              const selected = (selectedAddons[addon.id!] || 0) > 0;
              const qty = selectedAddons[addon.id!] || 0;
              return (
                <div
                  key={addon.id}
                  className={`p-3 border rounded-lg flex items-start justify-between ${
                    selected ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-3 pr-3">
                    <Checkbox checked={selected} onCheckedChange={() => toggleAddon(addon.id!)} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{addon.name}</span>
                        <Badge variant="secondary" className="text-xs">{PEN(addon.price)}</Badge>
                      </div>
                      {addon.description && (
                        <div className="text-xs text-muted-foreground mt-1">{addon.description}</div>
                      )}
                    </div>
                  </div>

                  {selected && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => changeQty(addon.id!, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{qty}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => changeQty(addon.id!, +1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {hasSelected && (
          <div className="border-t pt-3 mt-2 flex items-center justify-between font-medium">
            <span>Total agregados:</span>
            <span className="text-primary">{PEN(totalAddonsPrice)}</span>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={!!confirmDisabled}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
  