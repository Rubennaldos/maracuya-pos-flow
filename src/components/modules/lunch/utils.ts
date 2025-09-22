// src/components/modules/lunch/utils.ts
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

type Level = "patch" | "minor" | "major";

/** Parsea "x.y.z" o retorna [0,0,0] si no hay versión. */
function parseSemver(v?: string): [number, number, number] {
  if (!v) return [0, 0, 0];
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return [0, 0, 0];
  return [Number(m[1]) || 0, Number(m[2]) || 0, Number(m[3]) || 0];
}

/** Incrementa según nivel y devuelve string. */
function incSemver(v?: string, level: Level = "patch"): string {
  const [maj, min, pat] = parseSemver(v);
  if (level === "major") return `${maj + 1}.0.0`;
  if (level === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

/** Escribe en settings: version (semver), updateSeq (int), updatedAt (ms) */
async function writeVersion(level: Level) {
  const s = await RTDBHelper.getData<any>(RTDB_PATHS.lunch_settings);
  const nextVersion = incSemver(s?.version, level);
  const nextSeq = Number(s?.updateSeq || 0) + 1;
  await RTDBHelper.updateData({
    [`${RTDB_PATHS.lunch_settings}/version`]: nextVersion,
    [`${RTDB_PATHS.lunch_settings}/updateSeq`]: nextSeq,
    [`${RTDB_PATHS.lunch_settings}/updatedAt`]: Date.now(),
  });
}

/** Marca PATCH (cambios chicos). */
export async function bumpPatch() {
  try { await writeVersion("patch"); } catch (e) { console.error(e); }
}
/** Marca MINOR (cambios de contenido). */
export async function bumpMinor() {
  try { await writeVersion("minor"); } catch (e) { console.error(e); }
}
/** Marca MAJOR (actualización grande). */
export async function bumpMajor() {
  try { await writeVersion("major"); } catch (e) { console.error(e); }
}

/**
 * Heurística automática:
 * - si count >= majorThreshold -> MAJOR
 * - si count >= 1 -> MINOR
 * - si count = 0 -> PATCH (p.ej. reordenar)
 */
export async function bumpAuto(countAffected = 0, majorThreshold = 5) {
  try {
    if (countAffected >= majorThreshold) return await writeVersion("major");
    if (countAffected >= 1) return await writeVersion("minor");
    return await writeVersion("patch");
  } catch (e) {
    console.error("No se pudo incrementar versión (auto):", e);
  }
}
