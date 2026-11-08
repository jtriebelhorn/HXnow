// Fingerabdrücke der festgeschriebenen Versionen (ENTSCHEIDUNGEN Nr. 47): Kodierschema, Fragebogen-Definition und
// Exportformat. Ändert sich ein Inhalt, muss die zugehörige Version steigen; tests/unit/versionen.test.js prüft das gegen
// tests/fixtures/versionen.json (neue Version eintragen: npm run versionen). Nicht Teil der App.. Läuft nur unter Node (node:crypto).
import { createHash } from 'node:crypto';
import { spaltenBeobachtung, SPALTEN_VERSUCH, SPALTEN_TAG, EXPORT_FORMAT } from '../js/export.js';
import { SPALTEN_FB } from '../js/fb/export.js';
import { SPALTEN_LOGBUCH } from '../js/logbuchdatei.js';

/** JSON mit sortierten Schlüsseln (Reihenfolge der Schlüssel zählt nicht, Reihenfolge in Listen schon). */
export function stabil(x) {
  if (Array.isArray(x)) return `[${x.map(stabil).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${stabil(x[k])}`).join(',')}}`;
  return JSON.stringify(x);
}
const sha = (x) => createHash('sha256').update(stabil(x)).digest('hex');

/** Aktuelle Versionen mit Fingerabdruck. */
export function aktuelleVersionen(schema, def) {
  return {
    kodierschema: { version: schema.schemaVersion, hash: sha(schema) },
    fragebogen: { version: def.definitionVersion, hash: sha(def) },
    exportformat: {
      version: EXPORT_FORMAT,
      hash: sha({ beobachtung: spaltenBeobachtung(schema), versuch: SPALTEN_VERSUCH, tag: SPALTEN_TAG, fragebogen: SPALTEN_FB, logbuch: SPALTEN_LOGBUCH }),
    },
  };
}
