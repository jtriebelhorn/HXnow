// Zugriff auf die Fragebogen-Definition und ihre Prüfung. DOM-frei.
//
// Zelle = eine Zeile im Export (Plan 6.2): ein Item, eine Matrixzelle, eine Mehrfachoption oder bei
// Prozentgruppen je Zeile „angekreuzt“ (0/1) und Prozent. Die Zellen-ID ist dauerhaft (Plan 4.1).

export const FRAGETYPEN = Object.freeze(['info', 'text', 'freitext', 'zahl', 'einfach', 'mehrfach', 'skala', 'prozentgruppe', 'matrix']);
export const KEINE_ANGABE = -99;
export const GEFILTERT = -88;

const SCHLUESSELWOERTER = new Set(['UND', 'ODER']);

/** Bogen nach ID oder null. */
export function bogen(def, id) {
  return def.boegen.find((b) => b.id === id) ?? null;
}

/** Alle Items eines Bogens (mit Abschnitt), in Reihenfolge; entfernte nur auf Wunsch. */
export function items(b, { mitEntfernten = false } = {}) {
  return b.abschnitte.flatMap((a) => a.items.map((it) => ({ ...it, abschnitt: a.id })))
    .filter((it) => mitEntfernten || !it.entfernt);
}

const und = (...teile) => {
  const da = teile.filter(Boolean);
  return da.length <= 1 ? (da[0] ?? '') : da.map((t) => `(${t})`).join(' UND ');
};

/**
 * Zellen eines Items (Exportzeilen) mit allem, was Codebuch, Filter und Export brauchen.
 * @returns {{ id, itemId, abschnitt, v, typ, text, optionen, min, max, skala, umpolen, paar, showIf, entfernt, art }[]}
 */
export function zellen(it) {
  const basis = {
    itemId: it.id, abschnitt: it.abschnitt, v: it.v, typ: it.typ, optionen: it.optionen ?? null,
    min: it.min ?? null, max: it.max ?? null, skala: it.skala ?? '', umpolen: Boolean(it.umpolen),
    zusatz: it.zusatz ?? null, // Skala: zusätzliche Codes außerhalb min–max, z. B. [[0, 'nicht genutzt']]
    paar: it.paar ?? '', entfernt: Boolean(it.entfernt), art: 'wert',
  };
  switch (it.typ) {
    case 'info':
      return [];
    case 'mehrfach':
      return it.optionen.map(([code, label]) => ({
        ...basis, id: `${it.id}_${code < 0 ? 'KA' : code}`, text: `${it.text} – ${label}`, optionen: [[0, 'nein'], [1, 'ja']],
        paar: it.paar ? `${it.paar}_${code}` : '', showIf: und(it.showIf, it.optionShowIf?.[code]), art: 'option', code,
      }));
    case 'prozentgruppe':
      return it.zeilen.flatMap(([z, label]) => [
        { ...basis, id: `${it.id}_${z}`, text: `${it.text} – ${label}`, optionen: [[0, 'nein'], [1, 'ja']], showIf: it.showIf ?? '', art: 'angekreuzt', zeile: z },
        { ...basis, id: `${it.id}_${z}_P`, text: `${it.text} – ${label} (Anteil in %)`, optionen: null, min: 0, max: it.summe ?? 100, showIf: und(it.showIf, `${it.id}.${z} = 1`), art: 'prozent', zeile: z },
      ]);
    case 'matrix':
      return it.zeilen.flatMap(([z, label]) => it.gruppen.map((g) => {
        const id = `${it.id}_${z}_${g.id}`;
        return {
          ...basis, id, text: `${it.text} – ${label} – ${g.id}: ${g.titel}`, optionen: g.optionen,
          paar: it.paarJeZelle ? id : it.paarZeilen ? `${it.paarZeilen}_${Number(z)}` : '', showIf: und(it.showIf, it.zeilenShowIf?.[z], g.showIf?.replaceAll('*', z)),
          art: 'zelle', zeile: z, gruppe: g.id,
        };
      }));
    default:
      return [{ ...basis, id: it.id, text: it.text, showIf: it.showIf ?? '' }];
  }
}

/** Alle Zellen eines Bogens in Reihenfolge. */
export function alleZellen(b, opt) {
  return items(b, opt).flatMap(zellen);
}

/** Namen, auf die ein Filter verweist (A6.STAT → Zelle A6_STAT). */
export function filterNamen(ausdruck) {
  const ohneText = String(ausdruck ?? '').replace(/"[^"]*"/g, '');
  return [...new Set((ohneText.match(/[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)?/g) ?? [])
    .filter((n) => !SCHLUESSELWOERTER.has(n))
    .map((n) => n.replace('.', '_')))];
}

/**
 * Prüft die Definition (Plan 3 und 4).
 * @returns {string[]} Fehlermeldungen (leer = gültig)
 */
export function pruefeDefinition(def) {
  const f = [];
  if (!/^\d+\.\d+\.\d+$/.test(def.definitionVersion ?? '')) f.push('definitionVersion muss SemVer sein (z. B. 1.0.0).');
  const bogenIds = def.boegen.map((b) => b.id);
  for (const d of doppelte(bogenIds)) f.push(`Bogen ${d} kommt mehrfach vor.`);

  for (const b of def.boegen) {
    const wo = (x) => `${b.id} ${x}`;
    for (const d of doppelte(b.abschnitte.map((a) => a.id))) f.push(wo(`Abschnitt ${d} kommt mehrfach vor.`));
    const alle = items(b, { mitEntfernten: true });
    for (const d of doppelte(alle.map((it) => it.id))) f.push(wo(`Item-ID ${d} kommt mehrfach vor.`));
    const zellIds = alleZellen(b, { mitEntfernten: true }).map((z) => z.id);
    for (const d of doppelte(zellIds)) f.push(wo(`Zellen-ID ${d} kommt mehrfach vor.`));
    const paare = alle.filter((it) => it.paar).map((it) => it.paar);
    for (const d of doppelte(paare)) f.push(wo(`Paar-ID ${d} kommt mehrfach vor.`));
    const bekannt = new Set(zellIds);

    for (const it of alle) {
      const w = (x) => f.push(wo(`${it.id}: ${x}`));
      if (!FRAGETYPEN.includes(it.typ)) w(`unbekannter Typ „${it.typ}“.`);
      if (!Number.isInteger(it.v) || it.v < 1) w('Item-Version v muss eine ganze Zahl ≥ 1 sein.');
      if (typeof it.text !== 'string' || !it.text.trim()) w('Text fehlt.');
      if (it.umpolen && it.typ !== 'skala') w('umpolen nur bei Skalen.');
      if (it.typ === 'skala' && !(Number.isInteger(it.min) && Number.isInteger(it.max) && it.min < it.max)) w('Skala braucht ganze Zahlen min < max.');
      if (it.typ === 'zahl' && it.min !== undefined && it.max !== undefined && !(it.min <= it.max)) w('min > max.');
      for (const liste of [it.optionen, ...(it.gruppen ?? []).map((g) => g.optionen)].filter(Boolean)) {
        if (!liste.every(([c]) => Number.isInteger(c))) w('Optionscodes müssen ganze Zahlen sein.');
        for (const d of doppelte(liste.map(([c]) => c))) w(`Optionscode ${d} kommt mehrfach vor.`);
      }
      if (['einfach', 'mehrfach'].includes(it.typ) && !(it.optionen?.length > 0)) w('Optionen fehlen.');
      if (it.reihenfolge && JSON.stringify([...it.reihenfolge].sort()) !== JSON.stringify((it.optionen ?? []).map(([c]) => c).sort())) {
        w('reihenfolge muss genau die Optionscodes enthalten.');
      }
      if (it.zusatz && (it.typ !== 'skala' || it.zusatz.some(([c]) => c >= it.min && c <= it.max))) w('zusatz nur bei Skalen und außerhalb von min–max.');
      if (['prozentgruppe', 'matrix'].includes(it.typ) && !(it.zeilen?.length > 0)) w('Zeilen fehlen.');
      if (it.typ === 'matrix' && !(it.gruppen?.length > 0)) w('Spaltengruppen fehlen.');
      if (it.freitextBei !== undefined) {
        const moeglich = it.typ === 'prozentgruppe' ? it.zeilen.map(([z]) => z) : (it.optionen ?? []).map(([c]) => c);
        if (!moeglich.includes(it.freitextBei)) w(`freitextBei „${it.freitextBei}“ gibt es nicht.`);
      }
      const ausdruecke = [it.showIf, it.auto?.wenn, ...Object.values(it.optionShowIf ?? {}), ...Object.values(it.zeilenShowIf ?? {}),
        ...(it.gruppen ?? []).map((g) => g.showIf?.replaceAll('*', '01'))].filter(Boolean);
      for (const n of ausdruecke.flatMap(filterNamen)) {
        if (!bekannt.has(n)) w(`Filter verweist auf unbekannte Frage „${n}“.`);
      }
    }
  }
  return f;
}

function doppelte(werte) {
  const gesehen = new Set();
  const doppelt = new Set();
  for (const w of werte) (gesehen.has(w) ? doppelt : gesehen).add(w);
  return [...doppelt];
}
