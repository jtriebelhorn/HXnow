// CRC32 (IEEE 802.3), synchron – für Prüfsummen in Logbuch-Datei und Komplettsicherung
// (PLAN_Logbuch_Datensicherheit 4.2: crypto.subtle ist asynchron und passt nicht in die Teilen-Geste).
const TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC32 eines Textes (UTF-8), als 8-stellige Hexzahl. */
export function crc32(text) {
  const bytes = new TextEncoder().encode(text);
  let c = 0xFFFFFFFF;
  for (const b of bytes) c = TABELLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}
