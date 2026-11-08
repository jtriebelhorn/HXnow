// Widerruf (PLAN_Logbuch_Datensicherheit 6.4): alle Daten eines Codes auf dem Gerät löschen; es bleiben nur die
// Zeile der Teilnehmerliste (Status „widerrufen“) und eine Änderung WIDERRUF_LOESCHUNG. Das Protokoll nennt die
// Dateien, die im Exportordner und bei der Studienleitung zu löschen sind. Beim Wiederherstellen und Zusammenführen
// werden Daten widerrufener Codes abgewiesen. DOM-frei.
import { wirksamerStand } from './aenderungen.js';
import { dateinameZeit, isoMitOffset } from './zeit.js';

const teil = (s) => String(s).replace(/[^A-Za-z0-9-]/g, '_');

/** Dateiname, unter dem ein Logbuch-Eintrag exportiert wurde (aus Rohdaten: Code, Beginn, ID) oder null. */
export function exportDateiname(l) {
  const { datum, uhrzeit } = dateinameZeit(l.startTs);
  const p = l.testmodus ? 'HXNOW_TEST_' : 'HXNOW_';
  const id8 = String(l.eintragId).slice(0, 8);
  if (l.art === 'BLOCK' && ['beendet', 'abgebrochen'].includes(l.status)) return `${p}BEOB_${teil(l.pseudonym)}_${datum}_${uhrzeit}_${id8}.csv`;
  if (l.art === 'VERSUCH') return `${p}VERSUCH_${teil(l.pseudonym)}_${datum}_${uhrzeit}_${id8}.csv`;
  if (['FB1', 'KB', 'FB2'].includes(l.art) && l.status === 'abgeschlossen') return `${p}FB_${l.art}_${teil(l.pseudonym)}_${datum}_${uhrzeit}_${id8}.csv`;
  return null;
}

/**
 * Was der Widerruf eines Codes betrifft: Einträge mit wirksamem Code = pseudonym (also auch zugeordnete),
 * zugehörige Änderungen und die Dateinamen.
 */
export function widerrufUmfang(pseudonym, { logbuch, aenderungen }) {
  const eintraege = logbuch.filter((l) => wirksamerStand(l, aenderungen).pseudonym === pseudonym);
  const ids = new Set(eintraege.map((l) => l.eintragId));
  const direkt = aenderungen.filter((a) => ids.has(a.zielId) || (a.zielId === pseudonym && a.zielTyp === 'proband'));
  const direktIds = new Set(direkt.map((a) => a.aenderungId));
  const aend = [...direkt, ...aenderungen.filter((a) => a.art === 'KOMMENTAR_ZURUECK' && direktIds.has(a.zielId))];
  const zaehle = (f) => eintraege.filter(f).length;
  return {
    eintraege,
    aenderungen: aend,
    // ohne nicht exportierte, gelöschte Sitzungen (von denen gibt es keine Datei)
    dateien: eintraege.filter((l) => !(l.exportStatus === 'offen' && wirksamerStand(l, aenderungen).geloescht)).map(exportDateiname).filter(Boolean).sort(),
    anzahl: {
      bloecke: zaehle((l) => l.art === 'BLOCK'), versuche: zaehle((l) => l.art === 'VERSUCH'),
      frageboegen: zaehle((l) => ['FB1', 'KB', 'FB2'].includes(l.art)),
    },
  };
}

/** Kurztext für die Änderung WIDERRUF_LOESCHUNG (ohne Inhalte). */
export function widerrufKurz(u) {
  return `${u.anzahl.bloecke} Blöcke, ${u.anzahl.versuche} Versuche, ${u.anzahl.frageboegen} Fragebögen gelöscht`;
}

export function dateinameWiderruf(pseudonym, ts) {
  return `HXNOW_Widerruf_${teil(pseudonym)}_${dateinameZeit(ts).datum}.txt`;
}

/** Widerrufsprotokoll als Text. */
export function widerrufProtokoll(pseudonym, u, { ts, geraeteId, appVersion }) {
  return [
    'HX Now Beobachtung – Widerrufsprotokoll',
    '',
    `Studien-Code: ${pseudonym}`,
    `Zeitpunkt: ${isoMitOffset(ts)}`,
    `Gerät: ${String(geraeteId).slice(0, 8)} · App-Version ${appVersion}`,
    '',
    `Auf diesem Gerät gelöscht: ${widerrufKurz(u)}.`,
    'Erhalten bleiben nur die Zeile der Teilnehmerliste (Status „widerrufen“) und dieser Vorgang im Änderungsprotokoll.',
    '',
    'Bitte im Exportordner und bei der Studienleitung löschen:',
    ...(u.dateien.length ? u.dateien.map((d) => `  - ${d}`) : ['  (keine exportierten Dateien)']),
    '',
    'Außerdem: Komplettsicherungen, die vor diesem Zeitpunkt erstellt wurden, enthalten die Daten noch. Sie werden',
    'beim Laden und beim Zusammenführen automatisch abgewiesen; bei der nächsten Komplettsicherung die alten löschen.',
    'Die Logbuch-Datei wird zusammen mit diesem Protokoll gesichert.',
    '',
  ].join('\r\n');
}
