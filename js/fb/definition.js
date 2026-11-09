// Zugriff auf die Fragebogen-Definition und ihre Prüfung. DOM-frei.
//
// Zelle = eine Zeile im Export (Plan 6.2) mit dauerhafter ID (Plan 4.1):
//   einfach/zahl/skala/text/freitext → <ID>; Freitext zu einer Option → <ID>_TXT
//   prozentgruppe → <ID>_<Zeile> (angekreuzt 0/1), <ID>_<Zeile>_PCT (Prozent), <ID>_<Zeile>_TXT (Freitext)
//   matrix mit mehreren Spaltengruppen → <ID>_<Zeile>_<Gruppe>, mit einer Spaltengruppe → <ID>_<Zeile>
//   mehrfach → <ID>_<Code>; weiche Sprungregel → <softSkip-ID>

export const FRAGETYPEN = Object.freeze(['info', 'text', 'freitext', 'zahl', 'einfach', 'mehrfach', 'skala', 'prozentgruppe', 'matrix']);
export const KEINE_ANGABE = -99;
export const GEFILTERT = -88;

const SCHLUESSELWOERTER = new Set(['UND', 'ODER', 'IN', 'IRGENDEIN', 'ALLE', 'UNBEKANNT']);

/** Bogen nach ID oder null. */
export function bogen(def, id) {
  return def.boegen.find((b) => b.id === id) ?? null;
}

/** Alle Items eines Bogens (mit Abschnitt), in Reihenfolge; entfernte nur auf Wunsch. */
export function items(b, { mitEntfernten = false } = {}) {
  return b.abschnitte.flatMap((a) => a.items.map((it) => ({ ...it, abschnitt: a.id })))
    .filter((it) => mitEntfernten || !it.entfernt);
}

/** Bedingungen mit UND verknüpfen (jede geklammert). */
export function und(...teile) {
  const da = teile.filter(Boolean);
  return da.length <= 1 ? (da[0] ?? '') : da.map((t) => `(${t})`).join(' UND ');
}

/** Bedingung, unter der ein Abschnitt nicht durch eine weiche Sprungregel übersprungen ist. */
function nichtUebersprungen(b, abschnittId) {
  return (b.softSkips ?? []).filter((s) => s.abschnitte.includes(abschnittId))
    .map((s) => `${s.id} != 1 ODER UNBEKANNT(${s.id})`).join(' UND ');
}

/**
 * Zellen eines Items (Exportzeilen) mit allem, was Codebuch, Filter und Export brauchen.
 * `b` (Bogen) wird für weiche Sprungregeln gebraucht.
 */
export function zellen(it, b = null) {
  const skip = b ? nichtUebersprungen(b, it.abschnitt) : '';
  const sichtbar = und(it.showIf, skip);
  const basis = {
    itemId: it.id, abschnitt: it.abschnitt, v: it.v, typ: it.typ, optionen: it.optionen ?? null,
    min: it.min ?? null, max: it.max ?? null, skala: it.skala ?? '', umpolen: Boolean(it.umpolen),
    zusatz: it.zusatz ?? null, paar: it.paar ?? '', paarUmkodierung: it.paarUmkodierung ?? null,
    entfernt: Boolean(it.entfernt), auto: it.auto ?? null, art: 'wert',
    // Versionen (Definition 1.1.0): seit = erst ab dieser Version gestellt; entferntSeit = bis davor gestellt;
    // ersetzt = ID der Vorgängerfrage (Bedingungen älterer Sitzungen nutzen deren Antwort)
    seit: it.seit ?? null, entferntSeit: it.entferntSeit ?? null, ersetzt: it.ersetzt ?? null, rueckfrageNull: it.rueckfrageNull ?? null,
  };
  const freitext = (id, text, bedingung) => ({
    ...basis, id, typ: 'text', text, optionen: null, min: null, max: null, skala: '', umpolen: false, zusatz: null,
    paar: '', paarUmkodierung: null, auto: null, showIf: und(sichtbar, bedingung), art: 'freitext',
  });
  switch (it.typ) {
    case 'info':
      return [];
    case 'mehrfach':
      return [
        ...it.optionen.map(([code, label]) => ({
          ...basis, id: `${it.id}_${code < 0 ? 'KA' : code}`, text: `${it.text} – ${label}`, optionen: [[0, 'nein'], [1, 'ja']],
          paar: it.paar ? `${it.paar}_${code}` : '', showIf: und(sichtbar, it.optionShowIf?.[code]), art: 'option', code,
        })),
        ...(it.freitextBei !== undefined ? [freitext(`${it.id}_TXT`, `${it.text} – Freitext`, `${it.id}_${it.freitextBei} = 1`)] : []),
      ];
    case 'prozentgruppe':
      return it.zeilen.flatMap(([z, label]) => [
        { ...basis, id: `${it.id}_${z}`, text: `${it.text} – ${label}`, optionen: [[0, 'nein'], [1, 'ja']], showIf: sichtbar, art: 'angekreuzt', zeile: z },
        {
          ...basis, id: `${it.id}_${z}_PCT`, text: `${it.text} – ${label} (Anteil in %)`, optionen: null, min: 0, max: it.summe ?? 100,
          showIf: und(sichtbar, `${it.id}_${z} = 1`), art: 'prozent', zeile: z,
        },
        ...(it.freitextBei === z ? [freitext(`${it.id}_${z}_TXT`, `${it.text} – ${label}: Freitext`, `${it.id}_${z} = 1`)] : []),
      ]);
    case 'matrix': {
      const eineGruppe = it.gruppen.length === 1;
      return it.zeilen.flatMap(([z, label]) => it.gruppen.map((g) => {
        const id = eineGruppe ? `${it.id}_${z}` : `${it.id}_${z}_${g.id}`;
        return {
          ...basis, id, text: `${it.text} – ${label}${eineGruppe ? '' : ` – ${g.id}: ${g.titel}`}`, optionen: g.optionen,
          paar: g.paarJeZelle ? id : it.paarZeilen ? `${it.paarZeilen}_${Number(z)}` : '',
          showIf: und(sichtbar, it.zeilenShowIf?.[z], g.showIf?.replaceAll('*', z)),
          auto: it.auto ?? (it.zeilenShowIf?.[z] && it.zeilenAuto !== undefined ? { wert: it.zeilenAuto } : null),
          art: 'zelle', zeile: z, gruppe: g.id,
        };
      }));
    }
    case 'einfach':
      return [
        { ...basis, id: it.id, text: it.text, showIf: sichtbar },
        ...(it.freitextBei !== undefined ? [freitext(`${it.id}_TXT`, `${it.text} – Freitext`, `${it.id} = ${it.freitextBei}`)] : []),
      ];
    default:
      return [{ ...basis, id: it.id, text: it.text, showIf: sichtbar }];
  }
}

/** Zellen der weichen Sprungregeln eines Bogens (Antwort 1 = überspringen, 2 = nicht überspringen). */
export function sprungZellen(b) {
  return (b.softSkips ?? []).map((s) => ({
    id: s.id, itemId: s.id, abschnitt: s.nachAbschnitt, v: 1, typ: 'einfach', text: s.text,
    optionen: [[1, 'ja, überspringen'], [2, 'nein']], min: null, max: null, skala: '', umpolen: false, zusatz: null,
    paar: '', paarUmkodierung: null, entfernt: false, auto: null, showIf: s.wenn, art: 'sprung',
  }));
}

/** Alle Zellen eines Bogens in Reihenfolge (Sprungregel nach ihrem Abschnitt). */
export function alleZellen(b, opt) {
  const liste = [];
  for (const a of b.abschnitte) {
    for (const it of a.items) {
      if (it.entfernt && !opt?.mitEntfernten) continue;
      liste.push(...zellen({ ...it, abschnitt: a.id }, b));
    }
    liste.push(...sprungZellen(b).filter((s) => s.abschnitt === a.id));
  }
  return liste;
}

/** Namen und Muster, auf die eine Bedingung verweist (z. B. W1, A6_STAT, W3_*_A). */
export function filterNamen(ausdruck) {
  const ohneText = String(ausdruck ?? '').replace(/"[^"]*"/g, '');
  return [...new Set((ohneText.match(/[A-Za-z][A-Za-z0-9_*]*/g) ?? []).filter((n) => !SCHLUESSELWOERTER.has(n)))];
}

/** Zellen-IDs, die auf ein Muster passen (* = ein Teil ohne Unterstrich). */
export function passendeIds(muster, ids) {
  const re = new RegExp(`^${muster.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^_]+')}$`);
  return ids.filter((id) => re.test(id));
}

/**
 * Prüft die Definition (Plan 3 und 4).
 * @returns {string[]} Fehlermeldungen (leer = gültig)
 */
export function pruefeDefinition(def) {
  const f = [];
  if (!/^\d+\.\d+\.\d+$/.test(def.definitionVersion ?? '')) f.push('definitionVersion muss SemVer sein (z. B. 1.0.0).');
  for (const d of doppelte(def.boegen.map((b) => b.id))) f.push(`Bogen ${d} kommt mehrfach vor.`);

  for (const b of def.boegen) {
    const wo = (x) => `${b.id} ${x}`;
    const abschnittIds = b.abschnitte.map((a) => a.id);
    for (const d of doppelte(abschnittIds)) f.push(wo(`Abschnitt ${d} kommt mehrfach vor.`));
    const alle = items(b, { mitEntfernten: true });
    for (const d of doppelte(alle.map((it) => it.id))) f.push(wo(`Item-ID ${d} kommt mehrfach vor.`));
    const zellIds = alleZellen(b, { mitEntfernten: true }).map((z) => z.id);
    for (const d of doppelte(zellIds)) f.push(wo(`Zellen-ID ${d} kommt mehrfach vor.`));
    for (const d of doppelte(alleZellen(b, { mitEntfernten: true }).filter((z) => z.paar).map((z) => z.paar))) {
      f.push(wo(`Paar-ID ${d} kommt mehrfach vor.`));
    }

    const pruefeAusdruck = (ausdruck, w) => {
      for (const n of filterNamen(ausdruck)) {
        if (n.includes('*') ? passendeIds(n, zellIds).length === 0 : !zellIds.includes(n)) w(`Bedingung verweist auf unbekannte Frage „${n}“.`);
      }
    };
    for (const s of b.softSkips ?? []) {
      const w = (x) => f.push(wo(`${s.id}: ${x}`));
      pruefeAusdruck(s.wenn, w);
      for (const a of [s.nachAbschnitt, ...s.abschnitte]) if (!abschnittIds.includes(a)) w(`unbekannter Abschnitt „${a}“.`);
    }

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
      if (['prozentgruppe', 'matrix'].includes(it.typ) && !(it.zeilen?.length > 0)) w('Zeilen fehlen.');
      if (it.typ === 'matrix' && !(it.gruppen?.length > 0)) w('Spaltengruppen fehlen.');
      if (it.zusatz && (it.typ !== 'skala' || it.zusatz.some(([c]) => c >= it.min && c <= it.max))) w('zusatz nur bei Skalen und außerhalb von min–max.');
      if (it.paarUmkodierung && !(it.optionen ?? []).every(([c]) => Number.isInteger(it.paarUmkodierung[c]))) w('paarUmkodierung muss jeden Code abbilden.');
      if (it.freitextBei !== undefined) {
        const moeglich = it.typ === 'prozentgruppe' ? it.zeilen.map(([z]) => z) : (it.optionen ?? []).map(([c]) => c);
        if (!moeglich.includes(it.freitextBei)) w(`freitextBei „${it.freitextBei}“ gibt es nicht.`);
      }
      const ausdruecke = [it.showIf, it.auto?.wenn, it.validierung, ...Object.values(it.optionShowIf ?? {}),
        ...Object.values(it.zeilenShowIf ?? {}), ...(it.gruppen ?? []).map((g) => g.showIf?.replaceAll('*', it.zeilen[0][0]))].filter(Boolean);
      for (const a of ausdruecke) pruefeAusdruck(a, w);
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

/** Vergleich von Versionsnummern (SemVer, nur Zahlen): a < b? */
export function versionVor(a, b) {
  const x = String(a ?? '').split('.').map(Number);
  const y = String(b ?? '').split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  }
  return false;
}
