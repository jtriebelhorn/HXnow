// CSV lesen (Semikolon, RFC 4180, optional mit BOM) – für Wiederherstellen und Zusammenführen. DOM-frei.

/** @returns {{ kopf: string[], zeilen: Record<string,string>[] }} */
export function leseCsv(text) {
  const t = String(text).replace(/^﻿/, '');
  const saetze = [];
  let feld = '';
  let satz = [];
  let inAnf = false;
  for (let i = 0; i < t.length; i++) {
    const z = t[i];
    if (inAnf) {
      if (z === '"' && t[i + 1] === '"') { feld += '"'; i++; } else if (z === '"') inAnf = false; else feld += z;
    } else if (z === '"') inAnf = true;
    else if (z === ';') { satz.push(feld); feld = ''; } else if (z === '\r' && t[i + 1] === '\n') { /* Zeilenende folgt */ } else if (z === '\n') { satz.push(feld); saetze.push(satz); satz = []; feld = ''; } else feld += z;
  }
  if (feld !== '' || satz.length) { satz.push(feld); saetze.push(satz); }
  const [kopf = [], ...rest] = saetze.filter((s) => !(s.length === 1 && s[0] === ''));
  return { kopf, zeilen: rest.map((s) => Object.fromEntries(kopf.map((k, i) => [k, s[i] ?? '']))) };
}

/**
 * Dateityp an den Spaltennamen erkennen (nicht an Positionen, damit zusätzliche Spalten nichts brechen):
 * 'logbuch' · 'block' · 'versuch' · 'fb' · 'tag' oder null.
 */
export function dateiArtAusKopf(kopf) {
  const hat = (s) => kopf.includes(s);
  if (kopf[0] !== 'datensatz') return null;
  if (hat('export_ts') && hat('pruefsumme')) return 'logbuch';
  if (hat('block_id')) return 'block';
  if (hat('versuch_id')) return 'versuch';
  if (hat('sitzung_id') && hat('item_id')) return 'fb';
  if (hat('aerzte_anwesend')) return 'tag';
  return null;
}
