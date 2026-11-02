// Zeitfunktionen: Formatierung, Countdown, ISO-Zeit mit Offset, Sekundenrundung.
// DOM-frei. Alle Zeitstempel sind Millisekunden seit Epoche; formatiert wird in der lokalen Zeitzone des Geräts.

const zwei = (n) => String(n).padStart(2, '0');

/** Countdown „mm:ss“ aus verbleibenden Millisekunden (aufgerundet, damit 15:00 am Start und 00:00 erst am Ende steht). */
export function formatiereCountdown(restMs) {
  const sek = Math.max(0, Math.ceil(restMs / 1000));
  return `${zwei(Math.floor(sek / 60))}:${zwei(sek % 60)}`;
}

/** Lokale Zeit als ISO 8601 mit Offset, z. B. 2026-12-03T09:15:02+01:00 (Sekundengenau, Millisekunden abgeschnitten). */
export function isoMitOffset(ts) {
  const d = new Date(ts);
  const offsetMin = -d.getTimezoneOffset();
  const vz = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${datumLokal(ts)}T${zwei(d.getHours())}:${zwei(d.getMinutes())}:${zwei(d.getSeconds())}`
    + `${vz}${zwei(Math.floor(abs / 60))}:${zwei(abs % 60)}`;
}

/** Lokales Datum JJJJ-MM-TT. */
export function datumLokal(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

/** Teile für Dateinamen: { datum: 'JJJJMMTT', uhrzeit: 'HHMM' } in lokaler Zeit. */
export function dateinameZeit(ts) {
  const d = new Date(ts);
  return {
    datum: `${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}`,
    uhrzeit: `${zwei(d.getHours())}${zwei(d.getMinutes())}`,
  };
}

/** Uhrzeit HH:MM:SS (lokal), für die Anzeige. */
export function uhrzeit(ts) {
  const d = new Date(ts);
  return `${zwei(d.getHours())}:${zwei(d.getMinutes())}:${zwei(d.getSeconds())}`;
}

/** Ganze Sekunden zwischen Bezugszeitpunkt und ts, kaufmännisch gerundet auf Millisekunden-Basis. */
export function sekundenSeit(basisTs, ts) {
  return Math.round((ts - basisTs) / 1000);
}

/**
 * Dauer einer Episode in ganzen Sekunden.
 * Gerundet werden Start und Ende relativ zum Blockstart; dadurch ergibt die Summe aller
 * Episodendauern exakt die gerundete Blockdauer (keine sich aufsummierenden Rundungsfehler).
 */
export function dauerSek(blockStartTs, startTs, endeTs) {
  return sekundenSeit(blockStartTs, endeTs) - sekundenSeit(blockStartTs, startTs);
}
