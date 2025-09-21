// src/components/modules/lunch/products/ProductsPanel.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Edit, Trash2, Star, Loader2, Check, GripVertical } from "lucide-react";
import type { MenuT, ProductT, ComboTemplate } from "../types";

/* ========= Util: Moneda ========= */
const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

/* ========= Util: JPG/PNG -> WebP (DataURL) en el navegador ========= */
async function fileToWebPDataURL(file: File, max = 900, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(max / bitmap.width, max / bitmap.height, 1);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  return await new Promise((resolve) =>
    canvas.toBlob((blob) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.readAsDataURL(blob!);
    }, "image/webp", quality)
  );
}

/** Quita todas las claves con valor `undefined` (para RTDB). */
const sanitize = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export type ProductsPanelProps = {
  menu: MenuT;
  onMenuChange: (next: MenuT) => void;
};

type Group = { catId: string; catName: string; items: ProductT[] };

export default function ProductsPanel({ menu, onMenuChange }: ProductsPanelProps) {
  /* ================== Derivados ================== */
  const categories = useMemo(() => {
    const c = menu.categories || {};
    return Object.values(c).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [menu]);

  const products = useMemo(() => {
    const p = menu.products || {};
    return Object.values(p);
  }, [menu]);

  /* ================== Modo ================== */
  type Mode = "variado" | "almuerzo";
  const [mode, setMode] = useState<Mode>("variado");

  /* ================== VARIADO ================== */
  const [editing, setEditing] = useState<ProductT | null>(null);
  const [form, setForm] = useState<Partial<ProductT>>({ active: true });
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [bulk, setBulk] = useState("");

  // estado para imagen
  const [imgBusy, setImgBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // validaciones + refs para auto-scroll
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement | null>(null);
  const priceRef = useRef<HTMLInputElement | null>(null);
  const catRef = useRef<HTMLSelectElement | null>(null);

  const filteredBase = useMemo(() => {
    const arr = products.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const needle = q.trim().toLowerCase();
    if (!needle) return arr;
    return arr.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(needle) ||
        ((menu.categories?.[p.categoryId!]?.name || "").toLowerCase().includes(needle))
    );
  }, [q, products, menu.categories]);

  // ======= AGRUPADO por categoría (solo productos activos) =======
  const groupsComputed = useMemo<Group[]>(() => {
    const active = filteredBase.filter((p) => p.active !== false);
    const catIndex: Record<string, { name: string; order: number }> = {};
    categories.forEach((c) => (catIndex[c.id] = { name: c.name, order: c.order ?? 0 }));

    const byCat: Record<string, ProductT[]> = {};
    for (const p of active) {
      const cid = p.categoryId || "__none__";
      if (!byCat[cid]) byCat[cid] = [];
      byCat[cid].push(p);
    }

    const result: Group[] = Object.entries(byCat).map(([catId, items]) => {
      const meta = catIndex[catId];
      // Orden por 'position' y luego nombre
      const ordered = items
        .slice()
        .sort((a, b) => {
          const pa = typeof (a as any).position === "number" ? (a as any).position : Number.POSITIVE_INFINITY;
          const pb = typeof (b as any).position === "number" ? (b as any).position : Number.POSITIVE_INFINITY;
          if (pa !== pb) return pa - pb;
          return (a.name || "").localeCompare(b.name || "");
        });
      return {
        catId,
        catName: meta ? meta.name : "Sin categoría",
        items: ordered,
      };
    });

    // Ordenamos grupos por orden de categoría; los sin categoría al final
    result.sort((A, B) => {
      const aO = catIndex[A.catId]?.order ?? 9_999;
      const bO = catIndex[B.catId]?.order ?? 9_999;
      return aO - bO;
    });

    // ocultar categorías vacías
    return result.filter((g) => g.items.length > 0);
  }, [filteredBase, categories]);

  // Copia local para drag&drop
  const [localGroups, setLocalGroups] = useState<Group[]>([]);
  useEffect(() => setLocalGroups(groupsComputed), [groupsComputed]);

  // --- Drag & Drop (solo dentro de la misma categoría) ---
  const dragInfo = useRef<{ groupIdx: number; itemIdx: number } | null>(null);

  const onDragStart = (groupIdx: number, itemIdx: number) => (ev: React.DragEvent) => {
    dragInfo.current = { groupIdx, itemIdx };
    ev.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (groupIdx: number, itemIdx: number) => (ev: React.DragEvent) => {
    ev.preventDefault();
    const d = dragInfo.current;
    if (!d) return;
    if (d.groupIdx !== groupIdx) return; // no cruzamos categorías
  };
  const onDrop = (groupIdx: number, itemIdx: number) => () => {
    const d = dragInfo.current;
    if (!d || d.groupIdx !== groupIdx) return;
    setLocalGroups((gs) => {
      const next = gs.map((g) => ({ ...g, items: g.items.slice() }));
      const g = next[groupIdx];
      const [moved] = g.items.splice(d.itemIdx, 1);
      g.items.splice(itemIdx, 0, moved);
      return next;
    });
    dragInfo.current = null;
  };
  const onDragEnd = () => {
    dragInfo.current = null;
  };

  const saveOrder = async () => {
    try {
      const updates: Record<string, any> = {};
      localGroups.forEach((g) => {
        g.items.forEach((p, idx) => {
          updates[`${RTDB_PATHS.lunch_menu}/products/${p.id}/position`] = idx;
        });
      });
      await RTDBHelper.updateData(updates);
      toast({ title: "Orden guardado" });
      const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
      if (m) onMenuChange(m);
    } catch (e) {
      console.error(e);
      toast({ title: "No se pudo guardar el orden", variant: "destructive" });
    }
  };

  // ====== CRUD VARIADO ======
  const resetForm = () => {
    setEditing(null);
    setForm({ active: true });
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = "";
    nameRef.current?.focus();
  };

  const validateVar = () => {
    const errs: Record<string, string> = {};
    const name = (form.name || "").trim();
    const price = Number(form.price);
    const catId = (form.categoryId || "").trim();

    if (!name) errs.name = "El nombre es obligatorio";
    if (!isFinite(price) || price < 0) errs.price = "Precio inválido";
    if (!catId || !menu.categories?.[catId]) errs.categoryId = "Seleccione una categoría";

    setErrors(errs);

    if (errs.name) nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    else if (errs.price) priceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    else if (errs.categoryId) catRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!validateVar()) {
      toast({ title: "Faltan campos por completar", variant: "destructive" });
      return;
    }

    const base = sanitize({
      id: editing?.id || "",
      name: (form.name || "").trim(),
      price: Number(form.price),
      categoryId: (form.categoryId || "").trim(),
      description: form.description?.trim() || null,
      image: form.image?.trim() || "",
      active: form.active !== false,
      isCombo: false, // variado
    });

    setLoading(true);
    try {
      if (editing) {
        const updates: Record<string, any> = {};
        for (const [k, v] of Object.entries(base)) {
          if (k === "id") continue;
          updates[`${RTDB_PATHS.lunch_menu}/products/${editing.id}/${k}`] = v;
        }
        await RTDBHelper.updateData(updates);
        toast({ title: "Producto actualizado con éxito" });
      } else {
        const newId = await RTDBHelper.pushData(`${RTDB_PATHS.lunch_menu}/products`, {
          ...base,
          active: true,
        });
        await RTDBHelper.updateData({
          [`${RTDB_PATHS.lunch_menu}/products/${newId}/id`]: newId,
        });
        toast({ title: "Producto creado con éxito" });
      }
      const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
      if (m) onMenuChange(m);
      resetForm();
    } catch (e) {
      console.error(e);
      toast({ title: "No se pudo guardar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const editVar = (p: ProductT) => {
    setEditing(p);
    setForm(p);
    setErrors({});
    setMode("variado");
    nameRef.current?.focus();
  };

  const toggleActive = async (p: ProductT) => {
    await RTDBHelper.updateData({
      [`${RTDB_PATHS.lunch_menu}/products/${p.id}/active`]: !(p.active !== false),
    });
    const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
    if (m) onMenuChange(m);
  };

  const remove = async (p: ProductT) => {
    if (!confirm(`Eliminar "${p.name}"?`)) return;
    await RTDBHelper.removeData(`${RTDB_PATHS.lunch_menu}/products/${p.id}`);
    const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
    if (m) onMenuChange(m);
    toast({ title: "Producto eliminado" });
  };

  const importBulk = async () => {
    const lines = bulk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;

    const updates: Record<string, any> = {};
    for (const line of lines) {
      const [nRaw, pRaw, cRaw] = line.split(/[;,]\s*/);
      const name = (nRaw || "").trim();
      const price = Number(pRaw);
      const catName = (cRaw || "").trim();
      if (!name || !isFinite(price)) continue;

      const cat =
        categories.find((c) => c.name.toLowerCase() === catName.toLowerCase()) || categories[0];
      if (!cat) continue;

      const id = (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2);
      updates[`${RTDB_PATHS.lunch_menu}/products/${id}`] = {
        id,
        name,
        price,
        categoryId: cat.id,
        active: true,
        isCombo: false,
      };
    }
    try {
      await RTDBHelper.updateData(updates);
      const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
      if (m) onMenuChange(m);
      setBulk("");
      toast({ title: "Importación lista" });
    } catch {
      toast({ title: "No se pudo importar", variant: "destructive" });
    }
  };

  // Imagen VARIADO
  const onImagePick = async (file?: File) => {
    if (!file) return;
    setImgBusy(true);
    try {
      const dataURL = await fileToWebPDataURL(file);
      setForm((f) => ({ ...f, image: dataURL }));
      toast({ title: "Imagen subida con éxito" });
    } catch {
      toast({ title: "No se pudo procesar la imagen", variant: "destructive" });
    } finally {
      setImgBusy(false);
    }
  };

  /* ================== ALMUERZO ================== */
  const [alm, setAlm] = useState<{
    title: string;
    entrada?: string;
    segundo?: string;
    postre?: string;
    price?: number;
    categoryId?: string;
    bebidaLabel: string;
    image?: string;
    templateId?: string;
  }>({ title: "", bebidaLabel: "Bebida del día" });

  const [almEditingId, setAlmEditingId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ComboTemplate[]>([]);
  const [almErrors, setAlmErrors] = useState<Record<string, string>>({});
  const almSegundoRef = useRef<HTMLInputElement | null>(null);
  const almPrecioRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const tplObj = await RTDBHelper.getData<Record<string, ComboTemplate>>(
        RTDB_PATHS.lunch_combo_templates
      );
      if (tplObj) setTemplates(Object.values(tplObj));
      const cats = categories;
      setAlm((a) => ({ ...a, categoryId: a.categoryId || cats[0]?.id }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]);

  const validateAlm = () => {
    const errs: Record<string, string> = {};
    const price = Number(alm.price);
    if (!(alm.segundo || "").trim()) errs.segundo = "El segundo es obligatorio";
    if (!isFinite(price) || price <= 0) errs.price = "Precio inválido";
    if (!alm.categoryId || !menu.categories?.[alm.categoryId]) errs.categoryId = "Seleccione categoría";
    setAlmErrors(errs);
    if (errs.segundo) almSegundoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    else if (errs.price) almPrecioRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    return Object.keys(errs).length === 0;
  };

  const buildAlmDescription = () => {
    const parts = [
      alm.entrada ? `Entrada: ${alm.entrada}` : null,
      alm.segundo ? `Segundo: ${alm.segundo}` : null,
      alm.postre ? `Postre: ${alm.postre}` : null,
      alm.bebidaLabel ? `Bebida: ${alm.bebidaLabel}` : null,
    ].filter(Boolean);
    return parts.join(" • ");
  };

  const saveAlm = async () => {
    if (!validateAlm()) {
      toast({ title: "Faltan campos por completar", variant: "destructive" });
      return;
    }
    const catId = alm.categoryId!;
    const name = (alm.title || "").trim() || `Almuerzo del día: ${alm.segundo}`;
    const description = buildAlmDescription();

    try {
      if (almEditingId) {
        // actualizar
        await RTDBHelper.updateData({
          [`${RTDB_PATHS.lunch_menu}/products/${almEditingId}/name`]: name,
          [`${RTDB_PATHS.lunch_menu}/products/${almEditingId}/price`]: Number(alm.price),
          [`${RTDB_PATHS.lunch_menu}/products/${almEditingId}/categoryId`]: catId,
          [`${RTDB_PATHS.lunch_menu}/products/${almEditingId}/description`]: description,
          [`${RTDB_PATHS.lunch_menu}/products/${almEditingId}/image`]: alm.image || "",
          [`${RTDB_PATHS.lunch_menu}/products/${almEditingId}/isCombo`]: true,
          [`${RTDB_PATHS.lunch_menu}/products/${almEditingId}/components`]: {
            entradaId: null,
            segundoId: null,
            postreId: null,
            bebidaLabel: alm.bebidaLabel || "Bebida del día",
          },
        });
        toast({ title: "Almuerzo actualizado" });
      } else {
        // crear
        const newId = await RTDBHelper.pushData(`${RTDB_PATHS.lunch_menu}/products`, {
          id: "",
          name,
          price: Number(alm.price),
          categoryId: catId,
          description,
          active: true,
          isCombo: true,
          image: alm.image || "",
          components: {
            entradaId: null,
            segundoId: null,
            postreId: null,
            bebidaLabel: alm.bebidaLabel || "Bebida del día",
          },
        });
        await RTDBHelper.updateData({
          [`${RTDB_PATHS.lunch_menu}/products/${newId}/id`]: newId,
        });
        toast({ title: "Almuerzo guardado" });
      }

      const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
      if (m) onMenuChange(m);

      // limpiar
      setAlm({
        title: "",
        entrada: "",
        segundo: "",
        postre: "",
        price: undefined,
        categoryId: catId,
        bebidaLabel: "Bebida del día",
        image: "",
        templateId: "",
      });
      setAlmErrors({});
      setAlmEditingId(null);
    } catch (e) {
      console.error(e);
      toast({ title: "No se pudo guardar", variant: "destructive" });
    }
  };

  const saveFav = async () => {
    if (!(alm.segundo || "").trim()) {
      setAlmErrors({ segundo: "El segundo es obligatorio" });
      almSegundoRef.current?.focus();
      toast({ title: "Falta el segundo", variant: "destructive" });
      return;
    }
    const price = Number(alm.price) || 0;
    const id = await RTDBHelper.pushData(RTDB_PATHS.lunch_combo_templates, {
      id: "",
      name: `Almuerzo: ${alm.segundo}`,
      title: alm.title || null,
      entrada: alm.entrada || null,
      segundo: alm.segundo!,
      postre: alm.postre || null,
      bebidaLabel: alm.bebidaLabel || "Bebida del día",
      price,
      categoryId: alm.categoryId || null,
      image: alm.image || null,
    });
    await RTDBHelper.updateData({
      [`${RTDB_PATHS.lunch_combo_templates}/${id}/id`]: id,
    });
    const tplObj = await RTDBHelper.getData<Record<string, ComboTemplate>>(
      RTDB_PATHS.lunch_combo_templates
    );
    if (tplObj) setTemplates(Object.values(tplObj));
    setAlm((a) => ({ ...a, templateId: id }));
    toast({ title: "Guardado en favoritos" });
  };

  const loadFav = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setAlm((a) => ({
      ...a,
      templateId: id,
      title: t.title || "",
      entrada: t.entrada || "",
      segundo: t.segundo || "",
      postre: t.postre || "",
      bebidaLabel: t.bebidaLabel || "Bebida del día",
      price: t.price || a.price,
      categoryId: t.categoryId || a.categoryId,
      image: t.image || "",
    }));
  };

  // Imagen ALMUERZO
  const [almImgBusy, setAlmImgBusy] = useState(false);
  const onAlmImagePick = async (file?: File) => {
    if (!file) return;
    setAlmImgBusy(true);
    try {
      const dataURL = await fileToWebPDataURL(file);
      setAlm((a) => ({ ...a, image: dataURL }));
      toast({ title: "Imagen subida con éxito" });
    } catch {
      toast({ title: "No se pudo procesar la imagen", variant: "destructive" });
    } finally {
      setAlmImgBusy(false);
    }
  };

  /* ======= Decide editor por tipo ======= */
  function parseAlmFromDescription(desc?: string) {
    const out: { entrada?: string; segundo?: string; postre?: string; bebida?: string } = {};
    if (!desc) return out;
    const parts = desc.split("•").map((s) => s.trim());
    for (const p of parts) {
      const [label, ...rest] = p.split(":");
      const val = rest.join(":").trim();
      const L = (label || "").toLowerCase();
      if (L.startsWith("entrada")) out.entrada = val;
      else if (L.startsWith("segundo")) out.segundo = val;
      else if (L.startsWith("postre")) out.postre = val;
      else if (L.startsWith("bebida")) out.bebida = val;
    }
    return out;
  }

  const routeEdit = (p: ProductT) => {
    if (p.isCombo) {
      // editar en MODO ALMUERZO
      const parsed = parseAlmFromDescription(p.description || "");
      setMode("almuerzo");
      setAlm({
        title: p.name?.replace(/^Almuerzo del día:\s*/i, "") || "",
        entrada: parsed.entrada || "",
        segundo: parsed.segundo || "",
        postre: parsed.postre || "",
        bebidaLabel: parsed.bebida || "Bebida del día",
        price: Number(p.price || 0),
        categoryId: p.categoryId || categories[0]?.id,
        image: p.image || "",
        templateId: "",
      });
      setAlmEditingId(p.id!);
      setAlmErrors({});
      return;
    }
    // editar en VARIADO
    editVar(p);
  };

  /* ================== UI ================== */
  const GroupedList = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Buscar por nombre o categoría…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-[520px]"
        />
        <Button onClick={saveOrder} disabled={localGroups.length === 0}>
          Guardar orden
        </Button>
      </div>

      {localGroups.length === 0 && (
        <p className="text-muted-foreground">No hay productos activos.</p>
      )}

      {localGroups.map((g, gi) => (
        <Card key={g.catId}>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{g.catName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {g.items.map((p, pi) => (
              <div
                key={p.id}
                className="flex items-center gap-3 border rounded px-3 py-2 bg-card"
                draggable
                onDragStart={onDragStart(gi, pi)}
                onDragOver={onDragOver(gi, pi)}
                onDrop={onDrop(gi, pi)}
                onDragEnd={onDragEnd}
              >
                <div className="cursor-grab active:cursor-grabbing text-muted-foreground">
                  <GripVertical className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {menu.categories?.[p.categoryId!]?.name || "—"}
                    {p.isCombo ? " • Combo" : ""}
                  </div>
                </div>

                <div className="w-24 text-right">{PEN(p.price)}</div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleActive(p)}>
                    {p.active !== false ? "Desactivar" : "Activar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => routeEdit(p)} title="Editar">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => remove(p)} title="Eliminar">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Selector de modo */}
      <Card>
        <CardHeader>
          <CardTitle>Modo</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant={mode === "variado" ? "default" : "outline"} onClick={() => setMode("variado")}>
            Variado
          </Button>
          <Button variant={mode === "almuerzo" ? "default" : "outline"} onClick={() => setMode("almuerzo")}>
            Almuerzo
          </Button>
        </CardContent>
      </Card>

      {mode === "variado" ? (
        <div className="grid xl:grid-cols-3 gap-6">
          {/* Form VARIADO */}
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>{editing ? "Editar producto" : "Nuevo producto"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input
                  ref={nameRef}
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={errors.name ? "border-destructive" : ""}
                  placeholder="Arroz con pollo"
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label>Precio (PEN)</Label>
                <Input
                  ref={priceRef}
                  inputMode="decimal"
                  value={form.price ?? ""}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value.replace(",", ".")) })}
                  className={errors.price ? "border-destructive" : ""}
                  placeholder="8.50"
                />
                {errors.price && <p className="text-xs text-destructive mt-1">{errors.price}</p>}
              </div>

              <div>
                <Label>Categoría</Label>
                <select
                  ref={catRef}
                  className={`border rounded h-9 px-2 w-full ${errors.categoryId ? "border-destructive" : ""}`}
                  value={form.categoryId || ""}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                >
                  <option value="">Seleccione…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && <p className="text-xs text-destructive mt-1">{errors.categoryId}</p>}
              </div>

              <div>
                <Label>Descripción (opcional)</Label>
                <Textarea
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div>
                <Label>Imagen (JPG/PNG — se convierte a WebP)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => onImagePick(e.target.files?.[0] || undefined)}
                    disabled={imgBusy}
                  />
                  {imgBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {!imgBusy && form.image && <Check className="h-4 w-4 text-green-600" />}
                </div>
                {form.image && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={form.image} alt="preview" className="h-14 w-14 rounded object-cover border" />
                    <Button type="button" variant="outline" onClick={() => setForm((f) => ({ ...f, image: "" }))}>
                      Quitar imagen
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={form.active !== false} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label>Activo</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={save} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {editing ? "Guardar cambios" : "Crear producto"}
                </Button>
                {editing && (
                  <Button variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista agrupada + drag (con guardar orden) */}
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Productos</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupedList />
            </CardContent>
          </Card>

          {/* Importación rápida */}
          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle>Importar rápido (pegar)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Formato por línea: <code>nombre;precio;categoría</code> — ej:
                <code> Arroz con pollo;8.5;Almuerzos</code>
              </p>
              <Textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                className="h-32 font-mono"
                placeholder={`Arroz con pollo;8.5;Almuerzos\nJugo natural;3;Bebidas`}
              />
              <Button onClick={importBulk} disabled={!bulk.trim()}>
                Importar productos
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ================== MODO ALMUERZO ================== */
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Almuerzo del día</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Título para mostrar (ej: Lunes 22 — Menú del día)</Label>
                <Input value={alm.title} onChange={(e) => setAlm((a) => ({ ...a, title: e.target.value }))} />
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label>Entrada</Label>
                  <Input
                    value={alm.entrada || ""}
                    onChange={(e) => setAlm((a) => ({ ...a, entrada: e.target.value }))}
                    placeholder="Sopa criolla"
                  />
                </div>
                <div>
                  <Label>Segundo *</Label>
                  <Input
                    ref={almSegundoRef}
                    value={alm.segundo || ""}
                    onChange={(e) => setAlm((a) => ({ ...a, segundo: e.target.value }))}
                    className={almErrors.segundo ? "border-destructive" : ""}
                    placeholder="Arroz con pollo"
                  />
                  {almErrors.segundo && <p className="text-xs text-destructive mt-1">{almErrors.segundo}</p>}
                </div>
                <div>
                  <Label>Postre</Label>
                  <Input
                    value={alm.postre || ""}
                    onChange={(e) => setAlm((a) => ({ ...a, postre: e.target.value }))}
                    placeholder="Gelatina"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label>Categoría</Label>
                  <select
                    className={`border rounded h-9 px-2 w-full ${almErrors.categoryId ? "border-destructive" : ""}`}
                    value={alm.categoryId || ""}
                    onChange={(e) => setAlm((a) => ({ ...a, categoryId: e.target.value }))}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {almErrors.categoryId && <p className="text-xs text-destructive mt-1">{almErrors.categoryId}</p>}
                </div>
                <div>
                  <Label>Precio (PEN)</Label>
                  <Input
                    ref={almPrecioRef}
                    inputMode="decimal"
                    value={alm.price ?? ""}
                    onChange={(e) => setAlm((a) => ({ ...a, price: Number(e.target.value.replace(",", ".")) }))}
                    className={almErrors.price ? "border-destructive" : ""}
                    placeholder="10.00"
                  />
                  {almErrors.price && <p className="text-xs text-destructive mt-1">{almErrors.price}</p>}
                </div>
                <div>
                  <Label>Bebida</Label>
                  <Input
                    value={alm.bebidaLabel}
                    onChange={(e) => setAlm((a) => ({ ...a, bebidaLabel: e.target.value }))}
                    placeholder="Bebida del día"
                  />
                </div>
              </div>

              <div>
                <Label>Imagen (JPG/PNG — se convierte a WebP)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => onAlmImagePick(e.target.files?.[0] || undefined)}
                    disabled={almImgBusy}
                  />
                  {almImgBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {!almImgBusy && alm.image && <Check className="h-4 w-4 text-green-600" />}
                </div>
                {alm.image && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={alm.image} alt="preview" className="h-14 w-14 rounded object-cover border" />
                    <Button type="button" variant="outline" onClick={() => setAlm((a) => ({ ...a, image: "" }))}>
                      Quitar imagen
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={saveAlm}>
                  <Save className="h-4 w-4 mr-2" />
                  {almEditingId ? "Guardar cambios" : "Guardar almuerzo"}
                </Button>
                <Button variant="outline" onClick={saveFav} title="Guardar como favorito">
                  <Star className="h-4 w-4 mr-2" /> Guardar favorito
                </Button>
                <select className="border rounded h-9 px-2" value={alm.templateId || ""} onChange={(e) => loadFav(e.target.value)}>
                  <option value="">— Cargar favorito —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Lista agrupada + drag también aquí */}
          <Card>
            <CardHeader>
              <CardTitle>Productos actuales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-auto">
              <GroupedList />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
