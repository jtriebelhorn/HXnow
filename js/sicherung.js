// JSON-Datensicherung (Spezifikation 7.5): vollständiger Abzug aller Datensätze als eine Datei.
// DOM-frei. Import und Löschen liegen in db.js (Transaktionen).
import { isoMitOffset, dateinameZeit } from './zeit.js';

export const SICHERUNG_FORMAT = 'hxnow-beobachtung-sicherung';
export const SICHERUNG_VERSION = 1;

// Gesicherte Stores und ihr Schlüssel (meta wird nicht übertragen: Geräte-ID bleibt pro Installation)
export const GESICHERTE_STORES = Object.freeze({
  bloecke: ['blockId'],
  episoden: ['episodeId'],
  pausen: ['pauseId'],
  versuche: ['versuchId'],
  tageskennzahlen: ['datum', 'bereich'],
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
    dateiname: `HXNOW_SICHERUNG_${datum}_${uhrzeit}.json`,
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
  if (s.formatVersion !== SICHERUNG_VERSION) fehler.push(`Unbekannte Version der Sicherung (${s.formatVersion}).`);
  if (!s.stores || typeof s.stores !== 'object') {
    fehler.push('Die Sicherung enthält keine Daten.');
  } else {
    // Sicherungen vor Version 2 der App enthalten noch keine Pausen
    if (s.stores.pausen === undefined) s.stores.pausen = [];
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
