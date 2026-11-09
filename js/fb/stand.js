// Stand eines ausgefüllten Fragebogens: Sichtbarkeit, wirksamer Wert und Status jeder Zelle, offene Fragen,
// Prüfhinweise. DOM-frei; Grundlage für Darstellung (js/ui/fragebogen.js) und Export (js/fb/export.js).
//
// Status: beantwortet · ausgelassen (sichtbar, leer) · gefiltert (ausgeblendet, −88) · keine_angabe (−99) ·
// automatisch (ausgeblendet mit Auto-Wert, z. B. W2 = 0 bei A8 = nein; A6 = 100 % bei genau einem Bereich).
import { alleZellen, items, versionVor } from './definition.js';
import { erfuellt, AUSGEBLENDET } from './filter.js';

export const KEINE_ANGABE = -99;
const TEXT_TYPEN = new Set(['text', 'freitext']);

/** Zellen, die nur Text enthalten (Freitext, Freitextfeld zu „Sonstiges“). */
export const istTextZelle = (z) => TEXT_TYPEN.has(z.typ);

/**
 * @param {object} b Bogen aus der Definition
 * @param {Record<string, {wert?: number|null, wertText?: string}>} antworten nach Zellen-ID
 * @param {{ definitionVersion?: string }} opt Version, mit der die Sitzung begonnen wurde (Standard: aktuelle).
 *   Ältere Sitzungen: Fragen mit `seit` > Version gelten als nicht gestellt (−88); mit `entferntSeit` entfernte Fragen
 *   gehören weiter dazu.
 * @returns {{ zellen: Map<string, {zelle, sichtbar, wert, text, status}>, ids: string[] }}
 */
export function berechneStand(b, antworten, { definitionVersion = null } = {}) {
  const alt = (z) => definitionVersion && z.seit && versionVor(definitionVersion, z.seit);
  const liste = alleZellen(b, { mitEntfernten: true })
    .filter((z) => !z.entfernt || (definitionVersion && z.entferntSeit && versionVor(definitionVersion, z.entferntSeit)));
  const ids = liste.map((z) => z.id);
  const ersetzt = new Map(liste.filter((z) => z.ersetzt).map((z) => [z.id, z.ersetzt]));
  const zellen = new Map();
  // Bedingungen: fehlt die Antwort auf eine neue Frage (ältere Sitzung, Nachtrag), gilt die der ersetzten Vorgängerfrage
  const wert = (id) => {
    const w = zellen.get(id)?.wert ?? null;
    if ((w === null || w === AUSGEBLENDET) && ersetzt.has(id)) return zellen.get(ersetzt.get(id))?.wert ?? antworten[ersetzt.get(id)]?.wert ?? w;
    return w;
  };

  for (const z of liste) {
    if (alt(z)) { zellen.set(z.id, { zelle: z, sichtbar: false, wert: istTextZelle(z) ? null : AUSGEBLENDET, text: '', status: 'gefiltert', nichtGestellt: true }); continue; }
    const a = antworten[z.id] ?? {};
    const sichtbar = erfuellt(z.showIf, wert, ids);
    let w = null;
    let text = '';
    let status;
    if (sichtbar) {
      if (istTextZelle(z)) {
        text = String(a.wertText ?? '').trim();
        status = text ? 'beantwortet' : 'ausgelassen';
      } else if (a.wert !== null && a.wert !== undefined) {
        w = a.wert;
        status = w === KEINE_ANGABE ? 'keine_angabe' : 'beantwortet';
      } else {
        status = 'ausgelassen';
      }
    } else if (z.auto && (!z.auto.wenn || erfuellt(z.auto.wenn, wert, ids))) {
      w = z.auto.wert;
      status = 'automatisch';
    } else {
      w = istTextZelle(z) ? null : AUSGEBLENDET;
      status = 'gefiltert';
    }
    zellen.set(z.id, { zelle: z, sichtbar, wert: w, text, status });
  }

  // Mehrfachauswahl: sobald eine Option angekreuzt ist, gelten die übrigen sichtbaren als „nein“ (0)
  for (const it of items(b).filter((x) => x.typ === 'mehrfach')) {
    const opt = [...zellen.values()].filter((e) => e.zelle.itemId === it.id && e.zelle.art === 'option' && e.sichtbar);
    if (opt.some((e) => e.wert === 1)) for (const e of opt) if (e.wert === null) Object.assign(e, { wert: 0, status: 'beantwortet' });
  }

  // Prozentgruppen: nicht angekreuzte Zeilen = 0, sobald eine Zeile angekreuzt ist; genau eine Zeile → 100 %
  for (const it of items(b).filter((x) => x.typ === 'prozentgruppe')) {
    const zeilen = it.zeilen.map(([z]) => zellen.get(`${it.id}_${z}`)).filter((e) => e?.sichtbar);
    if (!zeilen.some((e) => e.wert === 1)) continue;
    for (const e of zeilen) if (e.wert === null) Object.assign(e, { wert: 0, status: 'beantwortet' });
    const an = zeilen.filter((e) => e.wert === 1);
    if (it.autoHundert && an.length === 1) {
      const pct = zellen.get(`${an[0].zelle.id}_PCT`);
      if (pct?.sichtbar && pct.wert === null) Object.assign(pct, { wert: 100, status: 'automatisch' });
    }
  }
  return { zellen, ids };
}

/** Abschnitte mit mindestens einer sichtbaren Frage (Seiten des Fragebogens). */
export function seiten(b, stand) {
  return b.abschnitte.filter((a) => {
    for (const e of stand.zellen.values()) if (e.zelle.abschnitt === a.id && e.sichtbar) return true;
    return false;
  }).map((a) => a.id);
}

/** Sichtbare, unbeantwortete Fragen eines Abschnitts (Freitexte sind optional und zählen nicht). */
export function offeneFragen(stand, abschnittId = null) {
  const offen = [...stand.zellen.values()].filter((e) => (abschnittId === null || e.zelle.abschnitt === abschnittId)
    && e.sichtbar && e.status === 'ausgelassen' && !istTextZelle(e.zelle) && e.zelle.art !== 'angekreuzt');
  // Mehrfachauswahl zählt als eine Frage
  return new Set(offen.map((e) => (e.zelle.art === 'option' ? `${e.zelle.itemId}#` : e.zelle.id))).size;
}

/** Weiche Prüfhinweise eines Abschnitts (Plan: „validierung“, kein Zwang). */
export function pruefhinweise(b, stand, abschnittId) {
  const h = [];
  const wert = (id) => stand.zellen.get(id)?.wert ?? null;
  for (const it of items(b).filter((x) => x.abschnitt === abschnittId)) {
    const e = stand.zellen.get(it.id);
    if (it.typ === 'zahl' && e?.sichtbar && e.wert !== null && ((it.min !== undefined && e.wert < it.min) || (it.max !== undefined && e.wert > it.max))) {
      h.push({ itemId: it.id, text: `Bitte einen Wert von ${it.min} bis ${it.max} eingeben.` });
    }
    if (it.validierung && e?.sichtbar && !erfuellt(it.validierung, wert, stand.ids)) {
      const [, links, op, rechts] = /^(\S+) (\S+) (\S+)$/.exec(it.validierung) ?? [];
      if (wert(links) !== null && wert(rechts) !== null) {
        h.push({ itemId: it.id, text: op === '<=' ? `Der Wert darf nicht größer sein als bei ${rechts}.` : `Bitte prüfen (${it.validierung}).` });
      }
    }
    // Plausibilitätshinweise mit eigenem Text ({ID} wird durch den Wert ersetzt), keine Sperre
    for (const p of it.pruefung ?? []) {
      if (e?.sichtbar && e.wert !== null && erfuellt(p.wenn, wert, stand.ids)) {
        h.push({ itemId: it.id, text: p.text.replace(/\{(\w+)\}/g, (_, id) => String(wert(id) ?? '')) });
      }
    }
    if (it.typ === 'prozentgruppe') {
      const zeilen = it.zeilen.map(([z]) => stand.zellen.get(`${it.id}_${z}`)).filter((x) => x?.sichtbar);
      if (!zeilen.length) continue;
      const an = zeilen.filter((x) => x.wert === 1);
      if (it.mindestensEine && an.length === 0) h.push({ itemId: it.id, text: 'Bitte mindestens einen Bereich ankreuzen.' });
      const summe = an.reduce((s, x) => s + (stand.zellen.get(`${x.zelle.id}_PCT`)?.wert ?? 0), 0);
      if (an.length > 0 && it.summe && summe !== it.summe) h.push({ itemId: it.id, text: `Die Anteile ergeben ${summe} % statt ${it.summe} %.` });
    }
  }
  return h;
}

/** Kennzahlen für die Statusansicht der Doktorandin (ohne Inhalte). */
export function zusammenfassungStand(stand) {
  const werte = [...stand.zellen.values()];
  return {
    beantwortet: werte.filter((e) => e.status === 'beantwortet' || e.status === 'keine_angabe').length,
    // wie in der Fragebogen-Datei: jede Zelle mit Status „ausgelassen“ (auch Freitextfelder)
    ausgelassen: werte.filter((e) => e.status === 'ausgelassen').length,
    zellen: werte.length,
  };
}

/** Anzuzeigende Optionen eines Items: Reihenfolge laut `reihenfolge`, ohne ausgeblendete (`optionShowIf`). */
export function sichtbareOptionen(it, stand) {
  const wert = (id) => stand.zellen.get(id)?.wert ?? null;
  const opt = it.reihenfolge ? it.reihenfolge.map((c) => it.optionen.find(([x]) => x === c)) : it.optionen;
  return opt.filter(([c]) => !it.optionShowIf?.[c] || erfuellt(it.optionShowIf[c], wert, stand.ids));
}
