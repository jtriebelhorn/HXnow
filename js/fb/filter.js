// Bedingungen der Fragebögen auswerten, ohne eval (Fragebogenplan 5, Spezifikationen v0.3 „Bedingungssyntax“).
//
//   ID = Wert   ID != Wert   ID > Wert   ID < Wert   ID >= Wert   ID <= Wert   (Wert: Zahl oder andere ID)
//   ID IN (a, b)   UND   ODER   Klammern   (UND bindet stärker als ODER)
//   IRGENDEIN(Muster) > 0   ALLE(Muster) = 0   ALLE(Muster) IN (1, -88)   UNBEKANNT(ID)
//   Muster: * steht für einen Teil ohne Unterstrich (W3_*_A, W5_*).
//
// Werte kommen über `wert(id)` → Zahl, −88 (ausgeblendet) oder null (unbeantwortet). Eine Bedingung auf eine
// unbeantwortete oder ausgeblendete Frage ist nicht erfüllt (auch bei !=), außer UNBEKANNT(ID) und bei ALLE, wo −88
// als Wert zählt (ALLE(W3_*_C) IN (1, -88)).
import { passendeIds } from './definition.js';

export const AUSGEBLENDET = -88;

const OPERATOREN = ['!=', '>=', '<=', '=', '>', '<'];

export class BedingungsFehler extends Error {}

function zerlege(text) {
  const t = [];
  let i = 0;
  while (i < text.length) {
    const z = text[i];
    if (/\s/.test(z)) { i++; continue; }
    if (z === '(' || z === ')' || z === ',') { t.push({ art: z }); i++; continue; }
    const op = OPERATOREN.find((o) => text.startsWith(o, i));
    if (op) { t.push({ art: 'op', wert: op }); i += op.length; continue; }
    const m = /^-?\d+(?:[.,]\d+)?/.exec(text.slice(i));
    if (m) { t.push({ art: 'zahl', wert: Number(m[0].replace(',', '.')) }); i += m[0].length; continue; }
    const n = /^[A-Za-z][A-Za-z0-9_*]*/.exec(text.slice(i));
    if (n) {
      const w = n[0];
      t.push(['UND', 'ODER', 'IN'].includes(w) ? { art: w } : ['IRGENDEIN', 'ALLE', 'UNBEKANNT'].includes(w) ? { art: 'funktion', wert: w } : { art: 'name', wert: w });
      i += w.length;
      continue;
    }
    throw new BedingungsFehler(`Unerwartetes Zeichen „${z}“ an Stelle ${i + 1}.`);
  }
  return t;
}

/** Zerlegt eine Bedingung in einen Baum. */
export function parse(text) {
  const t = zerlege(String(text));
  let p = 0;
  const sieh = () => t[p];
  const nimm = (art) => {
    const x = t[p];
    if (!x || (art && x.art !== art)) throw new BedingungsFehler(`„${art}“ erwartet in „${text}“.`);
    p++;
    return x;
  };
  function oder() {
    let l = und();
    while (sieh()?.art === 'ODER') { p++; l = { art: 'oder', l, r: und() }; }
    return l;
  }
  function und() {
    let l = atom();
    while (sieh()?.art === 'UND') { p++; l = { art: 'und', l, r: atom() }; }
    return l;
  }
  function wertListe() {
    nimm('(');
    const w = [nimm('zahl').wert];
    while (sieh()?.art === ',') { p++; w.push(nimm('zahl').wert); }
    nimm(')');
    return w;
  }
  function atom() {
    const x = sieh();
    if (x?.art === '(') { p++; const e = oder(); nimm(')'); return e; }
    let operand;
    if (x?.art === 'funktion') {
      p++;
      nimm('(');
      const name = nimm('name').wert;
      nimm(')');
      if (x.wert === 'UNBEKANNT') return { art: 'unbekannt', name };
      operand = { art: x.wert === 'ALLE' ? 'alle' : 'irgendein', muster: name };
    } else {
      operand = { art: 'id', name: nimm('name').wert };
    }
    if (sieh()?.art === 'IN') { p++; return { art: 'in', operand, werte: wertListe() }; }
    const op = nimm('op').wert;
    const r = sieh();
    const rechts = r?.art === 'zahl' ? (p++, { art: 'zahl', wert: r.wert }) : { art: 'id', name: nimm('name').wert };
    return { art: 'vgl', operand, op, rechts };
  }
  const baum = oder();
  if (p < t.length) throw new BedingungsFehler(`Unerwartetes „${t[p].wert ?? t[p].art}“ in „${text}“.`);
  return baum;
}

const vergleiche = (a, op, b) => ({ '=': a === b, '!=': a !== b, '>': a > b, '<': a < b, '>=': a >= b, '<=': a <= b })[op];
const bekannt = (w) => w !== null && w !== undefined && w !== AUSGEBLENDET;

/**
 * Wertet eine Bedingung aus. Leere Bedingung = erfüllt.
 * @param {string} text
 * @param {(id: string) => number|null} wert Wert einer Zelle (Zahl, −88 oder null)
 * @param {string[]} ids alle Zellen-IDs des Bogens (für Muster)
 */
export function erfuellt(text, wert, ids) {
  if (!text) return true;
  return auswerten(parseGemerkt(text), wert, ids);
}

const gemerkt = new Map();
function parseGemerkt(text) {
  if (!gemerkt.has(text)) gemerkt.set(text, parse(text));
  return gemerkt.get(text);
}

function auswerten(k, wert, ids) {
  switch (k.art) {
    case 'oder': return auswerten(k.l, wert, ids) || auswerten(k.r, wert, ids);
    case 'und': return auswerten(k.l, wert, ids) && auswerten(k.r, wert, ids);
    case 'unbekannt': return !bekannt(wert(k.name));
    case 'in':
    case 'vgl': {
      const test = (w) => (k.art === 'in' ? k.werte.includes(w) : vergleiche(w, k.op, rechts(k.rechts, wert)));
      if (k.art === 'vgl' && k.rechts.art === 'id' && !bekannt(wert(k.rechts.name))) return false;
      const o = k.operand;
      if (o.art === 'id') { const w = wert(o.name); return bekannt(w) && test(w); }
      const werte = passendeIds(o.muster, ids).map(wert);
      if (o.art === 'irgendein') return werte.some((w) => bekannt(w) && test(w));
      return werte.length > 0 && werte.every((w) => w !== null && w !== undefined && test(w));
    }
    default: throw new BedingungsFehler(`Unbekannter Ausdruck ${k.art}.`);
  }
}

function rechts(r, wert) {
  return r.art === 'zahl' ? r.wert : wert(r.name);
}
