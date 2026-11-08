// Komplettsicherung (PLAN_Logbuch_Datensicherheit 4.4, ersetzt die JSON-Datensicherung aus Spezifikation 7.5):
// vollständiger Abzug aller Datensätze als eine Datei. DOM-frei. Import und Löschen liegen in db.js (Transaktionen).
// Prüfsumme und Wiederherstellen aus Sitzungsdateien folgen in Phase L2.
import { isoMitOffset, dateinameZeit } from './zeit.js';

export const SICHERUNG_FORMAT = 'hxnow-beobachtung-sicherung';
// 2: alle Stores ab Datenbank-Version 3 und Geräte-ID im Dateinamen; Version 1 bleibt ladbar
export const SICHERUNG_VERSION = 2;

// Gesicherte Stores und ihr Schlüssel (meta wird nicht übertragen: Geräte-ID bleibt pro Installation)
export const GESICHERTE_STORES = Object.freeze({
  bloecke: ['blockId'],
  episoden: ['episodeId'],
  pausen: ['pauseId'],
  versuche: ['versuchId'],
  tageskennzahlen: ['datum', 'bereich'],
  fb_sitzungen: ['sitzungId'],
  fb_antworten: ['sitzungId', 'itemId'],
  teilnehmende: ['pseudonym'],
  logbuch: ['eintragId'],
  aenderungen: ['aenderungId'],
  phasenplan: ['bereich'],
});

export function erstelleSicherung({ daten, geraeteId, appVersion, schemaVersion, now }) {
  const stores = {};
  for (const name of Object.keys(GESICHERTE_STORES)) stores[name] = daten[name] ?? [];
  return {
    format: SICHERUNG_FORMAT,
    formatVersion: SICHERUNG_VERSION,
    erstellt: isoMitOffset(now),
    erstelltTs: now,
    geraeteId,
    appVersion,
    schemaVersion,
    stores,
  };
}

export function sicherungsDatei(sicherung) {
  const { datum, uhrzeit } = dateinameZeit(sicherung.erstelltTs);
  return {
    dateiname: `HXNOW_Komplettsicherung_${String(sicherung.geraeteId ?? '').slice(0, 8)}_${datum}_${uhrzeit}.json`,
    inhalt: JSON.stringify(sicherung, null, 1),
    typ: 'application/json',
  };
}

/**
 * Parst und prüft eine Sicherungsdatei.
 * @returns {{ sicherung: object|null, fehler: string[] }}
 */
export function pruefeSicherung(text) {
  let s;
  try {
    s = JSON.parse(text);
  } catch (e) {
    return { sicherung: null, fehler: [`Die Datei ist kein gültiges JSON (${e.message}).`] };
  }
  const fehler = [];
  if (!s || s.format !== SICHERUNG_FORMAT) {
    return { sicherung: null, fehler: ['Die Datei ist keine Datensicherung dieser App.'] };
  }
  if (![1, SICHERUNG_VERSION].includes(s.formatVersion)) fehler.push(`Unbekannte Version der Sicherung (${s.formatVersion}).`);
  if (!s.stores || typeof s.stores !== 'object') {
    fehler.push('Die Sicherung enthält keine Daten.');
  } else {
    // Sicherungen vor Version 2 der App enthalten noch keine Pausen
    if (s.stores.pausen === undefined) s.stores.pausen = [];
    // Sicherungen vor App 0.7.0 enthalten die Stores ab Datenbank-Version 3 noch nicht
    for (const name of ['fb_sitzungen', 'fb_antworten', 'teilnehmende', 'logbuch', 'aenderungen', 'phasenplan']) {
      if (s.stores[name] === undefined) s.stores[name] = [];
    }
    for (const [name, schluessel] of Object.entries(GESICHERTE_STORES)) {
      const liste = s.stores[name];
      if (!Array.isArray(liste)) { fehler.push(`Bereich „${name}“ fehlt.`); continue; }
      liste.forEach((satz, i) => {
        if (!satz || typeof satz !== 'object' || schluessel.some((k) => satz[k] === undefined || satz[k] === null || satz[k] === '')) {
          fehler.push(`„${name}“, Eintrag ${i + 1}: Schlüssel (${schluessel.join(', ')}) fehlt.`);
        }
      });
    }
  }
  return { sicherung: fehler.length === 0 ? s : null, fehler };
}
