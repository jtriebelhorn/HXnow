// Bereinigung kurzer Episoden für die Auswertung (Kodierhandbuch 1.0, 3: Mindestdauer). Die Rohdaten bleiben
// unverändert (beobachtung.csv); diese Funktion erzeugt die Zeilen für beobachtung_bereinigt.csv. DOM-frei.
//
// Regeln je Block (Zeilen in Reihenfolge `nr`):
// 1. Eine Episode kürzer als `mindestdauerSek` wird der unmittelbar vorangehenden Episode zugeschlagen (Dauer und Ende).
//    Steht davor eine Pause oder nichts, wird sie der folgenden Episode zugeschlagen (deren Beginn rückt vor).
// 2. Ausgenommen sind Tätigkeiten aus `mindestdauerAusnahmen` (HX Now, T3): Sie bleiben immer eigene Zeilen.
// 3. Danach werden direkt aufeinanderfolgende Episoden mit gleicher Kodierung (Tätigkeit, Ort, Nutzung, Haltung,
//    Nebentätigkeiten mit ihren Angaben) zu einer Zeile vereint.
// Spalte `zusammengelegt` = Zahl der Rohzeilen, die in einer Zeile aufgegangen sind (1 = unverändert).

const KODIERUNG_FEST = ['taetigkeit', 'ort', 'nutzungsart', 'haltung', 'nebentaetigkeiten'];

/** Schlüssel der Kodierung einer Episodenzeile (inkl. NT-Spalten wie NT3, NT3_nutzung). */
function kodierung(z) {
  return JSON.stringify([...KODIERUNG_FEST.map((k) => z[k] ?? ''), ...Object.keys(z).filter((k) => /^NT\d/.test(k)).sort().map((k) => z[k])]);
}

/**
 * @param {Record<string,string>[]} zeilen alle Zeilen eines Blocks (datensatz episode | pause | block)
 * @param {{ mindestdauerSek: number, mindestdauerAusnahmen: string[] }} regeln
 * @returns {Record<string, string|number>[]}
 */
export function bereinigeBlock(zeilen, { mindestdauerSek, mindestdauerAusnahmen = [] }) {
  const sortiert = [...zeilen].sort((a, b) => Number(a.nr) - Number(b.nr)).map((z) => ({ ...z, zusammengelegt: 1 }));
  const istEp = (z) => z?.datensatz === 'episode';
  const kurz = (z) => istEp(z) && Number(z.dauer_sek) < mindestdauerSek && !mindestdauerAusnahmen.includes(z.taetigkeit);
  const anhaengen = (ziel, z, vorne) => {
    ziel.dauer_sek = Number(ziel.dauer_sek) + Number(z.dauer_sek);
    if (vorne) ziel.start = z.start; else ziel.ende = z.ende;
    ziel.zusammengelegt += z.zusammengelegt;
  };
  // 1. kurze Episoden an die vorangehende (sonst folgende) Episode
  const schritt1 = [];
  for (let i = 0; i < sortiert.length; i++) {
    const z = sortiert[i];
    if (kurz(z) && istEp(schritt1.at(-1))) { anhaengen(schritt1.at(-1), z, false); continue; }
    if (kurz(z) && istEp(sortiert[i + 1])) { anhaengen(sortiert[i + 1], z, true); continue; }
    schritt1.push(z);
  }
  // 2. gleiche Kodierung direkt hintereinander vereinen
  const aus = [];
  for (const z of schritt1) {
    const vor = aus.at(-1);
    if (istEp(z) && istEp(vor) && kodierung(vor) === kodierung(z)) { anhaengen(vor, z, false); continue; }
    aus.push(z);
  }
  return aus;
}
