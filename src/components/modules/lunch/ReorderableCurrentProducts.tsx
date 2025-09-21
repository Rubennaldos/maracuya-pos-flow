// src/components/modules/lunch/ReorderableCurrentProducts.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { GripVertical, Edit, Trash2, Power } from "lucide-react";

type Menu = {
  categories?: Record<string, { id: string; name: string; order?: number }>;
  products?: Record<
    string,
    {
      id: string;
      name: string;
      price?: number;
      active?: boolean;
      categoryId?: string | null;
      isCombo?: boolean;
      position?: number; // 👈 usamos 'position' en todo el sistema
      image?: string;
      description?: string;
    }
  >;
};

type Group = {
  catId: string;
  catName: string;
  items: string[]; // ids de productos
};

export default function ReorderableCurrentProducts() {
  const [menu, setMenu] = useState<Menu>({});
  const [dirty, setDirty] = useState(false);
  const draggingId = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const m = await RTDBHelper.getData<Menu>(RTDB_PATHS.lunch_menu);
      setMenu(m || {});
    })();
  }, []);

  // categorías ordenadas
  const categories = useMemo(() => {
    const c = menu.categories || {};
    return Object.values(c).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [menu]);

  // grupos por categoría — SOLO categorías con productos activos
  const groups: Group[] = useMemo(() => {
    const p = menu.products || {};
    const byCat = new Map<string, string[]>();
    categories.forEach((c) => byCat.set(c.id, []));
    Object.values(p).forEach((prod) => {
      if (prod.active === false) return;
      const cid = prod.categoryId || "__uncat";
      if (!byCat.has(cid)) byCat.set(cid, []);
      byCat.get(cid)!.push(prod.id);
    });

    const result: Group[] = [];
    byCat.forEach((ids, cid) => {
      // orden interno por "position"
      const sorted = ids
        .map((id) => ({ id, position: menu.products?.[id]?.position ?? Number.POSITIVE_INFINITY }))
        .sort((a, b) => a.position - b.position)
        .map((x) => x.id);

      if (sorted.length === 0) return; // no mostrar categorías vacías
      const name =
        cid === "__uncat" ? "Sin categoría" : categories.find((c) => c.id === cid)?.name || "Sin categoría";
      result.push({ catId: cid, catName: name, items: sorted });
    });

    // respetar orden de categorías
    return result.sort((a, b) => {
      const ia = a.catId === "__uncat" ? 9_999 : categories.findIndex((c) => c.id === a.catId);
      const ib = b.catId === "__uncat" ? 9_999 : categories.findIndex((c) => c.id === b.catId);
      return ia - ib;
    });
  }, [menu, categories]);

  const onDragStart = (id: string) => (ev: React.DragEvent) => {
    draggingId.current = id;
    ev.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (overId: string) => (ev: React.DragEvent) => {
    ev.preventDefault();
    const dragId = draggingId.current;
    if (!dragId || dragId === overId) return;

    const gIndex = groups.findIndex((g) => g.items.includes(overId));
    if (gIndex === -1) return;
    const g = groups[gIndex];
    if (!g.items.includes(dragId)) return; // no mover entre categorías

    const items = [...g.items];
    const from = items.indexOf(dragId);
    const to = items.indexOf(overId);
    items.splice(from, 1);
    items.splice(to, 0, dragId);

    setMenu((m) => {
      const next: Menu = { ...m, products: { ...(m.products || {}) } };
      // reasignar 'position' 0..N
      items.forEach((pid, idx) => {
        next.products![pid] = { ...next.products![pid], position: idx };
      });
      return next;
    });
    setDirty(true);
  };

  const onDragEnd = () => {
    draggingId.current = null;
  };

  const save = async () => {
    try {
      const updates: Record<string, any> = {};
      Object.values(menu.products || {}).forEach((p) => {
        updates[`${RTDB_PATHS.lunch_menu}/products/${p.id}/position`] =
          typeof p.position === "number" ? p.position : Number.POSITIVE_INFINITY;
      });
      await RTDBHelper.updateData(updates);
      toast({ title: "Orden guardado" });
      setDirty(false);
    } catch {
      toast({ title: "No se pudo guardar el orden", variant: "destructive" });
    }
  };

  const prods = menu.products || {};

  return (
    <div className="p-4">
      <div className="flex items-center justify-end mb-3">
        <Button onClick={save} disabled={!dirty}>
          Guardar orden
        </Button>
      </div>

      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.catId} className="rounded-md border border-muted overflow-hidden">
            <div className="px-3 py-2 border-b bg-muted/50 font-semibold">{g.catName}</div>

            {g.items.map((id) => {
              const p = prods[id];
              if (!p) return null;
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={onDragStart(id)}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOver(id)}
                  className="flex items-center justify-between px-3 py-2 hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <div>
                      <div className="font-medium">{p.name || "Sin título"}</div>
                      <div className="text-xs text-muted-foreground">
                        S/ {Number(p.price || 0).toFixed(2)} • {p.isCombo ? "Almuerzos" : "Variados"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.active === false ? "outline" : "default"}>
                      {p.active === false ? "Inactivo" : "Activo"}
                    </Badge>
                    {/* Botones decorativos para mantener UI homogénea */}
                    <Button size="icon" variant="ghost" disabled>
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="destructive" disabled>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="text-muted-foreground text-sm px-3 py-4">No hay productos activos para ordenar.</div>
      )}
    </div>
  );
}
