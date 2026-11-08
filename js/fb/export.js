// Export eines Fragebogens (Fragebogenplan 6.2): Long-Format, eine Zeile je Zelle (Item, Matrixzelle, Freitextfeld,
// weiche Sprungregel), auch für ausgeblendete. Für alle Bögen und Definitionsversionen gleich aufgebaut.
// DOM-frei; synchron aus dem Speicherzustand (Teilen in der Nutzergeste).
import { csvText } from '../export.js';
import { isoMitOffset, dateinameZeit } from '../zeit.js';
import { berechneStand } from './stand.js';

export const SPALTEN_FB = Object.freeze([
  'datensatz', 'sitzung_id', 'geraete_id', 'app_version', 'definition_version', 'bogen', 'pseudonym', 'bereich',
  'erhebungsmodus', 'papier_datum', 'start', 'ende', 'dauer_sek', 'abschnitt', 'abschnitt_dauer_sek',
  'item_id', 'item_v', 'paar', 'typ', 'wert', 'wert_text', 'status', 'n_zeilen',
]);

const WERT = { beantwortet: (e) => e.wert, automatisch: (e) => e.wert, keine_angabe: () => -99, gefiltert: (e) => e.wert ?? '', ausgelassen: () => '' };

/** Dateiname; Probeläufe (Test-Code) beginnen mit HXNOW_TEST_. */
export function dateinameFb(sitzung, test = false) {
  const { datum, uhrzeit } = dateinameZeit(sitzung.startTs ?? sitzung.angelegtTs);
  const code = String(sitzung.pseudonym).replace(/[^A-Za-z0-9-]/g, '_');
  return `HXNOW_${test ? 'TEST_' : ''}FB_${sitzung.bogen}_${code}_${datum}_${uhrzeit}_${sitzung.sitzungId.slice(0, 8)}.csv`;
}

/**
 * @param {object} b Bogen aus der Definition
 * @param {object} sitzung Datensatz aus fb_sitzungen
 * @param {Record<string, {wert, wertText}>} antworten nach Zellen-ID
 */
export function fbDatei(b, sitzung, antworten, { definitionVersion, test = false }) {
  const stand = berechneStand(b, antworten);
  const s = sitzung;
  const dauer = s.endTs && s.startTs ? Math.round((s.endTs - s.startTs) / 1000) : '';
  const zeilen = [...stand.zellen.values()].map((e) => {
    const z = e.zelle;
    return [
      'antwort', s.sitzungId, s.geraeteId, s.appVersion, definitionVersion, b.id, s.pseudonym, s.bereich ?? '',
      s.erhebungsmodus, s.papierDatum ?? '', s.startTs ? isoMitOffset(s.startTs) : '', s.endTs ? isoMitOffset(s.endTs) : '', dauer,
      z.abschnitt, Math.round(s.seitenzeiten?.[z.abschnitt] ?? 0), z.id, z.v, z.paar, z.typ,
      WERT[e.status](e), e.text, e.status,
    ];
  });
  const n = zeilen.length;
  return { dateiname: dateinameFb(s, test), inhalt: csvText(SPALTEN_FB, zeilen.map((z) => [...z, n])), typ: 'text/csv' };
}
