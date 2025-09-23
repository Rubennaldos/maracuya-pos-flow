// src/components/modules/lunch/products/addons-types.ts
export type AddonForm = {
  /** Clave SOLO-UI, estable para React keys (no se guarda en DB) */
  cid: string;
  /** Id real del agregado en DB (si existe) */
  id?: string;

  name: string;
  priceStr: string;
  active?: boolean;
};
