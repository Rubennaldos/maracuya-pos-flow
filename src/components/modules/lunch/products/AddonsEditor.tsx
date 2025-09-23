// src/components/modules/lunch/products/AddonsEditor.tsx
import React, { memo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, X } from "lucide-react";

/** Clave de UI estable para evitar remontaje de inputs y pérdida de foco */
export type AddonForm = {
  cid: string;      // clave UI (no se guarda en DB)
  id?: string;      // id del agregado en DB (si existe)
  name: string;
  priceStr: string; // precio como string mientras se escribe
  active?: boolean;
};

type Props = {
  addons: AddonForm[];
  setAddons: React.Dispatch<React.SetStateAction<AddonForm[]>>;
  errorText?: string | null;
};

const AddonRow = memo(function AddonRow({
  a,
  idx,
  onChangeName,
  onChangePrice,
  onToggleActive,
  onRemove,
}: {
  a: AddonForm;
  idx: number;
  onChangeName: (idx: number, v: string) => void;
  onChangePrice: (idx: number, v: string) => void;
  onToggleActive: (idx: number, v: boolean) => void;
  onRemove: (cid: string) => void;
}) {
  const nameId = `addon-name-${a.cid}`;
  const priceId = `addon-price-${a.cid}`;
  const activeId = `addon-active-${a.cid}`;

  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <Input
        id={nameId}
        name={nameId}
        className="col-span-6"
        placeholder="Nombre (ej. Huevo frito)"
        value={a.name}
        onChange={(e) => onChangeName(idx, e.target.value)}
      />
      <Input
        id={priceId}
        name={priceId}
        className="col-span-3"
        placeholder="Precio (ej. 1.50)"
        inputMode="decimal"
        value={a.priceStr}
        onChange={(e) => onChangePrice(idx, e.target.value)}
      />
      <div className="col-span-2 flex items-center gap-2">
        <Switch
          id={activeId}
          checked={a.active !== false}
          onCheckedChange={(v) => onToggleActive(idx, v)}
        />
        <Label htmlFor={activeId}>Activo</Label>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="col-span-1"
        onClick={() => onRemove(a.cid)}
        title="Quitar"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
});

function AddonsEditorInner({ addons, setAddons, errorText }: Props) {
  const handleAdd = useCallback(() => {
    setAddons((arr) => [
      ...arr,
      {
        cid: (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2),
        name: "",
        priceStr: "",
        active: true,
      },
    ]);
  }, [setAddons]);

  const onChangeName = useCallback(
    (i: number, v: string) =>
      setAddons((arr) => {
        const next = arr.slice();
        next[i] = { ...next[i], name: v };
        return next;
      }),
    [setAddons]
  );

  const onChangePrice = useCallback(
    (i: number, v: string) =>
      setAddons((arr) => {
        const next = arr.slice();
        next[i] = { ...next[i], priceStr: v };
        return next;
      }),
    [setAddons]
  );

  const onToggleActive = useCallback(
    (i: number, v: boolean) =>
      setAddons((arr) => {
        const next = arr.slice();
        next[i] = { ...next[i], active: v };
        return next;
      }),
    [setAddons]
  );

  const onRemove = useCallback(
    (cid: string) => setAddons((arr) => arr.filter((x) => x.cid !== cid)),
    [setAddons]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Agregados (opcional)</Label>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-3 w-3 mr-1" /> Añadir agregado
        </Button>
      </div>

      {addons.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Puedes crear opciones como “Huevo frito (S/ 1.50)”, “Palta (S/ 1.00)”, etc.
        </p>
      )}

      {addons.map((a, idx) => (
        <AddonRow
          key={a.cid}
          a={a}
          idx={idx}
          onChangeName={onChangeName}
          onChangePrice={onChangePrice}
          onToggleActive={onToggleActive}
          onRemove={onRemove}
        />
      ))}

      {errorText && <p className="text-xs text-destructive">{errorText}</p>}
    </div>
  );
}

export default memo(AddonsEditorInner);
