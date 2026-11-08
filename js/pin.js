// PIN für geschützte Änderungen (PLAN_Logbuch_Datensicherheit 6.3): 4–8 Ziffern, gespeichert als SHA-256 mit
// zufälligem Salz (nie im Klartext). Nach 5 Fehlversuchen 5 Minuten gesperrt; eine richtige Eingabe gilt
// 10 Minuten. DOM-frei.
export const MAX_FEHLVERSUCHE = 5;
export const SPERRE_MS = 5 * 60_000;
export const GUELTIG_MS = 10 * 60_000;

export function pinFormatOk(pin) {
  return /^\d{4,8}$/.test(String(pin ?? ''));
}

export function neuesSalz(c = globalThis.crypto) {
  return [...c.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function pinHash(pin, salz, c = globalThis.crypto) {
  const daten = new TextEncoder().encode(`${salz}:${pin}`);
  return [...new Uint8Array(await c.subtle.digest('SHA-256', daten))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Prüft eine Eingabe und liefert den neuen Zustand.
 * @param {{ pinHash, pinSalz, fehlversuche, sperreBis }} z
 * @returns {Promise<{ ok: boolean, gesperrt: boolean, z, rest: number }>}
 */
export async function pruefePin(pin, z, jetzt = Date.now()) {
  if (z.sperreBis && jetzt < z.sperreBis) return { ok: false, gesperrt: true, z, rest: 0 };
  const ok = (await pinHash(pin, z.pinSalz)) === z.pinHash;
  if (ok) return { ok: true, gesperrt: false, z: { ...z, fehlversuche: 0, sperreBis: null }, rest: MAX_FEHLVERSUCHE };
  const fehl = (z.fehlversuche ?? 0) + 1;
  if (fehl >= MAX_FEHLVERSUCHE) return { ok: false, gesperrt: true, z: { ...z, fehlversuche: 0, sperreBis: jetzt + SPERRE_MS }, rest: 0 };
  return { ok: false, gesperrt: false, z: { ...z, fehlversuche: fehl, sperreBis: null }, rest: MAX_FEHLVERSUCHE - fehl };
}
