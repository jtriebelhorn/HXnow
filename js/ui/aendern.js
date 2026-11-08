// Änderungen im Logbuch (PLAN_Logbuch_Datensicherheit 6). Phase L3: geschützte Aktionen laufen direkt; PIN und
// Korrekturen (Kommentar, ungültig, Zuordnung, Phase, Status, Phasendaten je Proband) folgen in Phase L4.

/** Führt eine geschützte Aktion aus (ab L4 nach PIN-Abfrage). */
export function schuetze(app, titel, aktion) {
  return aktion();
}

/** Knöpfe für Korrekturen an einem Eintrag (ab L4). */
export function eintragKnoepfe() { return null; }

/** Knöpfe für Änderungen an einem Probanden (ab L4). */
export function probandKnoepfe() { return null; }

/** PIN-Verwaltung im Studienplan (ab L4). */
export function aenderungsKnoepfe() { return null; }
