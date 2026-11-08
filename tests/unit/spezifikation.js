// Liest die Fragebogen-Spezifikationen (docs/quellen/*_v0.3.md) für den Abgleich mit js/frageboegen.js.
// Format je Item: „### <ID> · <Typ>“, Fragetext, dann Felder „- `feld`: wert“ mit Unterpunkten „  - …“.
import { readFileSync } from 'node:fs';

const backticks = (s) => [...String(s).matchAll(/`([^`]*)`/g)].map((m) => m[1]);
/** „1 = a | 2 = b“ → [[1, 'a'], [2, 'b']] */
export const optionenAus = (s) => s.split('|').map((t) => t.trim()).filter(Boolean)
  .map((t) => { const m = /^(-?\d+) = (.+)$/.exec(t); return m ? [Number(m[1]), m[2].trim()] : null; }).filter(Boolean);

/** Bedingungen vergleichbar machen: Leerraum vereinheitlichen, Klammern ignorieren. */
export const bedingung = (s) => String(s ?? '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();

export function leseSpezifikation(url) {
  const zeilen = readFileSync(url, 'utf8').split('\n');
  const spez = { abschnitte: [], items: [], infos: [], sprung: null };
  let abschnitt = null;
  let item = null;
  let feld = null;
  for (const roh of zeilen) {
    const z = roh.replace(/\s+$/, '');
    let m;
    if ((m = /^## Abschnitt (\S+) · (.+)$/.exec(z))) {
      abschnitt = { id: m[1], titel: m[2] };
      spez.abschnitte.push(abschnitt);
      item = null;
    } else if ((m = /^### (\S+) · (\S+)$/.exec(z))) {
      item = { id: m[1], typ: m[2], abschnitt: abschnitt?.id, textZeilen: [], felder: {} };
      spez.items.push(item);
      feld = null;
    } else if (/^### Weiche Sprungregel/.test(z)) {
      spez.sprung = {};
      item = null;
    } else if (spez.sprung && !item && (m = /^- Bedingung: (.+)$/.exec(z))) {
      spez.sprung.wenn = backticks(m[1])[0];
    } else if (spez.sprung && !item && (m = /^- `softSkip`: Hinweis „(.+)“$/.exec(z))) {
      spez.sprung.text = m[1];
    } else if ((m = /^\*Info:\* (.+)$/.exec(z)) || (m = /^> (.+)$/.exec(z))) {
      spez.infos.push(m[1]);
    } else if (item && (m = /^- `([A-Za-z]+)`: ?(.*)$/.exec(z))) {
      feld = m[1];
      item.felder[feld] = { wert: m[2], unter: [] };
    } else if (item && feld && (m = /^ {2}- (.+)$/.exec(z))) {
      item.felder[feld].unter.push(m[1]);
    } else if (item && !feld && z.trim() && !z.startsWith('---')) {
      item.textZeilen.push(z.trim());
    }
  }
  for (const it of spez.items) it.text = it.textZeilen.join(' ');
  return spez;
}

/** Auto-Wert aus „`0`, wenn `A8 = 2`“ bzw. „alle `W5_<k>` = 0, wenn `W4 = 1`“. */
export function autoAus(s) {
  const bt = backticks(s);
  const wert = /^-?\d+$/.test(bt[0] ?? '') ? Number(bt[0]) : Number((/= (-?\d+),/.exec(s) ?? [])[1]);
  return { wenn: bt.at(-1), wert };
}

/** Skala „1–6 (1 = a · 2 = b) + Option 9 = nicht genutzt“ → { min, max, anker, zusatz } */
export function skalaAus(s) {
  const m = /^(-?\d+)–(-?\d+) \((.+)\)(?: \+ Option (\d+) = (.+))?$/.exec(s.trim());
  if (!m) return null;
  const anker = Object.fromEntries(m[3].split(' · ').map((t) => { const a = /^(-?\d+) = (.+)$/.exec(t.trim()); return [Number(a[1]), a[2]]; }));
  return { min: Number(m[1]), max: Number(m[2]), anker, zusatz: m[4] ? [[Number(m[4]), m[5]]] : null };
}

export { backticks };
