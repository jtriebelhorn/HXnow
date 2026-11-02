// Unabhängiges Auslesen der Exportdateien für den Prüf-Workflow (kein Code aus js/).

const BOM = '﻿';

/**
 * Liest eine Export-CSV streng nach Vorgabe: UTF-8-BOM, Semikolon, Zeilenende \r\n, Quoting nach RFC 4180.
 * @returns {{ kopf: string[], zeilen: object[], fehler: string[] }}
 */
export function leseCsv(text) {
  const fehler = [];
  if (!text.startsWith(BOM)) fehler.push('UTF-8-BOM fehlt');
  const t = text.startsWith(BOM) ? text.slice(1) : text;
  const datensaetze = [];
  let feld = '';
  let satz = [];
  let inQuote = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuote) {
      if (c === '"') {
        if (t[i + 1] === '"') { feld += '"'; i++; } else inQuote = false;
      } else feld += c;
      continue;
    }
    if (c === '"') {
      if (feld !== '') fehler.push(`Anführungszeichen mitten im Feld (Zeichen ${i})`);
      inQuote = true;
    } else if (c === ';') {
      satz.push(feld); feld = '';
    } else if (c === '\r') {
      if (t[i + 1] !== '\n') fehler.push(`Einzelnes \\r ohne \\n (Zeichen ${i})`);
      satz.push(feld); feld = ''; datensaetze.push(satz); satz = []; i++;
    } else if (c === '\n') {
      fehler.push(`Zeilenende \\n ohne \\r außerhalb von Anführungszeichen (Zeichen ${i})`);
      satz.push(feld); feld = ''; datensaetze.push(satz); satz = [];
    } else feld += c;
  }
  if (inQuote) fehler.push('Datei endet in einem offenen Anführungszeichen');
  if (feld !== '' || satz.length > 0) fehler.push('Letzte Zeile ohne abschließendes \\r\\n');
  const [kopf = [], ...rest] = datensaetze;
  const zeilen = rest.map((w, i) => {
    if (w.length !== kopf.length) fehler.push(`Zeile ${i + 2}: ${w.length} statt ${kopf.length} Felder`);
    return Object.fromEntries(kopf.map((k, j) => [k, w[j] ?? '']));
  });
  return { kopf, zeilen, fehler };
}

/** Lokale Zeit Europe/Berlin als ISO mit Offset, sekundengenau (abgeschnitten) – über Intl berechnet. */
export function isoBerlin(ts) {
  const teile = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset',
  }).formatToParts(new Date(ts)).map((p) => [p.type, p.value]));
  const offset = teile.timeZoneName === 'GMT' ? '+00:00' : teile.timeZoneName.replace('GMT', '');
  return `${teile.year}-${teile.month}-${teile.day}T${teile.hour}:${teile.minute}:${teile.second}${offset}`;
}

/** Zeitpunkt aus ISO mit Offset → ms (für Lesbarkeitsprüfungen). */
export function isoZuMs(iso) {
  return Date.parse(iso);
}

export const ISO_MUSTER = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
