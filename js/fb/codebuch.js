// Codebuch der Fragebögen aus der eingebauten Definition (Plan 4.5): eine Zeile je Zelle (= Exportzeile).
// So passen Codebuch und App-Version immer zusammen.
import { csvText } from '../export.js';
import { alleZellen } from './definition.js';

export const SPALTEN_CODEBUCH = Object.freeze([
  'bogen', 'abschnitt', 'item_id', 'v', 'paar', 'typ', 'text', 'optionen', 'min', 'max', 'skala', 'umpolen', 'showIf', 'entfernt',
]);

const optionenText = (optionen) => (optionen ? optionen.map(([c, l]) => `${c}=${l}`).join(' | ') : '');

/** Zeilen des Codebuchs (Arrays in Spaltenreihenfolge). */
export function codebuchZeilen(def) {
  return def.boegen.flatMap((b) => alleZellen(b, { mitEntfernten: true }).map((z) => [
    b.id, z.abschnitt, z.id, z.v, z.paar, z.typ, z.text, optionenText([...(z.optionen ?? []), ...(z.zusatz ?? [])]), z.min ?? '', z.max ?? '',
    z.skala, z.umpolen ? 1 : 0, z.showIf, z.entfernt ? 1 : 0,
  ]));
}

/** Codebuch als CSV-Datei (UTF-8 mit BOM, Semikolon). */
export function codebuchDatei(def) {
  return {
    dateiname: `HXNOW_CODEBUCH_FB_${def.definitionVersion}.csv`,
    inhalt: csvText(SPALTEN_CODEBUCH, codebuchZeilen(def)),
    typ: 'text/csv',
  };
}

/**
 * Schnappschuss der gepaarten Zellen (Plan 4.4): Typ, Codes, Skalengrenzen, Umpolung.
 * Ändert sich etwas davon, schlägt tests/unit/definition.test.js fehl.
 */
export function paarSchnappschuss(def) {
  return def.boegen.flatMap((b) => alleZellen(b, { mitEntfernten: true }).filter((z) => z.paar).map((z) => ({
    bogen: b.id, paar: z.paar, zelle: z.id, typ: z.typ,
    codes: z.optionen ? z.optionen.map(([c]) => c) : null, zusatz: z.zusatz ? z.zusatz.map(([c]) => c) : null,
    umkodierung: z.paarUmkodierung,
    min: z.min, max: z.max, umpolen: z.umpolen,
  })));
}
