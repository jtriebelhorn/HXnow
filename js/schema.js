// Laden und Validieren des Kodierschemas (kodierschema.json, Struktur laut Spezifikation v2 Abschnitt 5).
// DOM-frei, damit mit `node --test` testbar.

// Listen mit Einträgen der Form { code, label, ... }
const CODE_LISTEN = [
  'bereiche', 'dienste', 'phasen', 'arbeitskontext', 'taetigkeiten', 'orte',
  'nutzungsart', 'haltung', 'pausengruende', 'abbruchgruende', 'geraetDabeiOptionen',
];

// Codes, die gelten, solange Nutzungsart bzw. Haltung nicht gewählt sind: „Sonstige“ (ENTSCHEIDUNGEN Nr. 26)
export const NUTZUNGSART_UNBEKANNT = 'N9';
export const HALTUNG_UNBEKANNT = 'H9';

// Antworten auf „HX-Now-Gerät dabei?“ (ja · nein · nicht erkennbar); „nein“ ist gesperrt, wenn T3 kodiert wurde
export const GERAET_DABEI = Object.freeze({ JA: 'J', NEIN: 'N', UNKLAR: 'U' });

// Felder, die in `pflichtangaben` aufgeführt werden dürfen
export const PFLICHT_FELDER = Object.freeze({
  block: ['pseudonym', 'phase', 'bereich', 'beobachter', 'dienst', 'arbeitskontext'],
  versuch: ['pseudonym', 'phase', 'bereich', 'beobachter', 'dienst'],
  tageskennzahlen: ['datum', 'bereich', 'beobachter', 'belegung', 'aufnahmen', 'entlassungen', 'ambulant', 'aerzteAnwesend', 'ereignisse'],
});
// Immer Pflicht, unabhängig von der Konfiguration (Zuordnung, Prä/Post-Regeln, Dateiname, Schlüssel)
export const IMMER_PFLICHT = Object.freeze({
  block: ['pseudonym', 'phase'],
  versuch: ['pseudonym', 'phase'],
  tageskennzahlen: ['datum', 'bereich'],
});
const PFLICHT_STANDARD = Object.freeze({
  block: ['pseudonym', 'phase', 'bereich', 'beobachter'],
  versuch: ['pseudonym', 'phase'],
  tageskennzahlen: ['datum', 'bereich'],
  pauseGrund: false,
  abbruchGrund: true,
  geraetDabeiVorExport: false,
  beendenGrund: true,
});

/**
 * Wirksame Pflichtangaben: Konfiguration aus `pflichtangaben` (fehlende Teile = Standard),
 * ergänzt um die immer notwendigen Felder.
 */
export function pflichtangaben(schema) {
  const k = schema.pflichtangaben ?? {};
  const liste = (name) => [...new Set([...IMMER_PFLICHT[name], ...(Array.isArray(k[name]) ? k[name] : PFLICHT_STANDARD[name])])];
  return {
    block: liste('block'),
    versuch: liste('versuch'),
    tageskennzahlen: liste('tageskennzahlen'),
    pauseGrund: typeof k.pauseGrund === 'boolean' ? k.pauseGrund : PFLICHT_STANDARD.pauseGrund,
    abbruchGrund: typeof k.abbruchGrund === 'boolean' ? k.abbruchGrund : PFLICHT_STANDARD.abbruchGrund,
    geraetDabeiVorExport: typeof k.geraetDabeiVorExport === 'boolean' ? k.geraetDabeiVorExport : PFLICHT_STANDARD.geraetDabeiVorExport,
    beendenGrund: typeof k.beendenGrund === 'boolean' ? k.beendenGrund : PFLICHT_STANDARD.beendenGrund,
  };
}

/** Codes der Tätigkeiten, die als Nebentätigkeit zusätzlich zur Tätigkeit erfasst werden (ENTSCHEIDUNGEN Nr. 19). */
export function nebentaetigkeiten(schema) {
  return Array.isArray(schema.nebentaetigkeiten) ? schema.nebentaetigkeiten : [];
}

/** Anzeige- und Exportcode einer Nebentätigkeit: T3 → NT3 (ENTSCHEIDUNGEN Nr. 25). */
export function ntCode(taetigkeit) {
  return `N${taetigkeit}`;
}

/** Teilbereiche eines Bereichs (leer = keiner). */
export function teilbereiche(schema, bereich) {
  return schema.bereiche.find((b) => b.code === bereich)?.teilbereiche ?? [];
}

/** Ist der Studien-Code der reservierte Code für Probeläufe (z. B. P000)? */
export function istTestPseudonym(schema, pseudonym) {
  const t = schema.pseudonym?.testCode;
  return Boolean(t) && String(pseudonym ?? '').trim().toUpperCase() === t;
}

/** Wählbare Blockdauern in Sekunden (ohne Angabe nur die Standarddauer). */
export function blockDauerOptionen(schema) {
  return Array.isArray(schema.blockDauerOptionenSek) ? schema.blockDauerOptionenSek : [schema.blockDauerSek];
}

const istObjekt = (w) => w !== null && typeof w === 'object' && !Array.isArray(w);
const istText = (w) => typeof w === 'string' && w.trim() !== '';
const istGanzzahl = (w) => Number.isInteger(w);
const istBool = (w) => typeof w === 'boolean';

/**
 * Prüft ein Kodierschema.
 * @param {unknown} s geparstes JSON
 * @returns {string[]} Liste verständlicher Fehlermeldungen (leer = gültig)
 */
export function validiereSchema(s) {
  const fehler = [];
  const f = (text) => fehler.push(text);

  if (!istObjekt(s)) {
    return ['Das Kodierschema ist kein JSON-Objekt.'];
  }

  // --- Einfache Pflichtfelder ---
  if (!istText(s.schemaVersion)) f('Feld „schemaVersion“ fehlt oder ist leer (Text erwartet, z. B. "0.2").');
  if (!istText(s.studie)) f('Feld „studie“ fehlt oder ist leer.');

  if (!istGanzzahl(s.blockDauerSek) || s.blockDauerSek <= 0) {
    f('Feld „blockDauerSek“ muss eine positive ganze Zahl sein (z. B. 900).');
  }
  if (s.blockDauerOptionenSek !== undefined) {
    const o = s.blockDauerOptionenSek;
    if (!Array.isArray(o) || o.length === 0 || !o.every((d) => istGanzzahl(d) && d > 0)) {
      f('„blockDauerOptionenSek“ muss eine nicht leere Liste positiver ganzer Zahlen sein (z. B. [600, 900]).');
    } else {
      for (const d of duplikate(o)) f(`„blockDauerOptionenSek“: ${d} kommt mehrfach vor.`);
      if (istGanzzahl(s.blockDauerSek) && !o.includes(s.blockDauerSek)) {
        f('„blockDauerOptionenSek“ muss die Standarddauer „blockDauerSek“ enthalten.');
      }
      if (istGanzzahl(s.warnungVorEndeSek) && o.some((d) => s.warnungVorEndeSek >= d)) {
        f('„warnungVorEndeSek“ muss kleiner als jede Dauer in „blockDauerOptionenSek“ sein.');
      }
    }
  }
  if (!istGanzzahl(s.warnungVorEndeSek) || s.warnungVorEndeSek < 0) {
    f('Feld „warnungVorEndeSek“ muss eine ganze Zahl ≥ 0 sein (z. B. 60).');
  } else if (istGanzzahl(s.blockDauerSek) && s.warnungVorEndeSek >= s.blockDauerSek) {
    f('„warnungVorEndeSek“ muss kleiner als „blockDauerSek“ sein.');
  }
  if (!istGanzzahl(s.pauseMaxSek) || s.pauseMaxSek <= 0) {
    f('Feld „pauseMaxSek“ muss eine positive ganze Zahl sein (z. B. 300).');
  }
  if (!istBool(s.nutzungsartBeiT1T2)) {
    f('Feld „nutzungsartBeiT1T2“ muss true oder false sein.');
  }

  // --- Pflichtangaben (optional; fehlende Teile = Standard) ---
  if (s.pflichtangaben !== undefined) {
    if (!istObjekt(s.pflichtangaben)) {
      f('„pflichtangaben“ muss ein Objekt sein.');
    } else {
      for (const [name, erlaubt] of Object.entries(PFLICHT_FELDER)) {
        const liste = s.pflichtangaben[name];
        if (liste === undefined) continue;
        if (!Array.isArray(liste)) { f(`„pflichtangaben.${name}“ muss eine Liste sein.`); continue; }
        for (const feld of liste) {
          if (!erlaubt.includes(feld)) f(`„pflichtangaben.${name}“: unbekanntes Feld „${feld}“ (erlaubt: ${erlaubt.join(', ')}).`);
        }
      }
      for (const name of ['pauseGrund', 'abbruchGrund', 'geraetDabeiVorExport', 'beendenGrund']) {
        const w = s.pflichtangaben[name];
        if (w !== undefined && !istBool(w)) f(`„pflichtangaben.${name}“ muss true oder false sein.`);
      }
      const unbekannt = Object.keys(s.pflichtangaben).filter((k) => !(k in PFLICHT_STANDARD));
      for (const k of unbekannt) f(`„pflichtangaben“: unbekannter Eintrag „${k}“.`);
    }
  }

  // --- Pseudonym ---
  if (!istObjekt(s.pseudonym)) {
    f('Abschnitt „pseudonym“ fehlt.');
  } else {
    let regex = null;
    if (!istText(s.pseudonym.muster)) {
      f('Feld „pseudonym.muster“ fehlt oder ist leer.');
    } else {
      try {
        regex = new RegExp(s.pseudonym.muster);
      } catch {
        f(`„pseudonym.muster“ ist kein gültiger regulärer Ausdruck: ${s.pseudonym.muster}`);
      }
    }
    if (s.pseudonym.beispiel !== undefined) {
      if (!istText(s.pseudonym.beispiel)) {
        f('„pseudonym.beispiel“ muss ein Text sein.');
      } else if (regex && !regex.test(s.pseudonym.beispiel)) {
        f(`Das Beispiel „${s.pseudonym.beispiel}“ passt nicht zum Muster „${s.pseudonym.muster}“.`);
      }
    }
    if (s.pseudonym.testCode !== undefined) {
      if (!istText(s.pseudonym.testCode)) {
        f('„pseudonym.testCode“ muss ein Text sein (z. B. "P000").');
      } else if (regex && !regex.test(s.pseudonym.testCode)) {
        f(`Der Test-Code „${s.pseudonym.testCode}“ passt nicht zum Muster „${s.pseudonym.muster}“.`);
      } else if (s.pseudonym.testCode === s.pseudonym.beispiel) {
        f('„pseudonym.testCode“ darf nicht gleich dem Beispiel sein.');
      }
    }
    if (s.pseudonym.pruefziffer !== undefined && !istBool(s.pseudonym.pruefziffer)) {
      f('„pseudonym.pruefziffer“ muss true oder false sein.');
    }
  }

  // --- Beobachter-Kürzel ---
  if (!Array.isArray(s.beobachter) || s.beobachter.length === 0) {
    f('Liste „beobachter“ fehlt oder ist leer.');
  } else {
    s.beobachter.forEach((b, i) => {
      if (!istText(b)) f(`„beobachter“, Eintrag ${i + 1}: Kürzel muss ein nicht leerer Text sein.`);
    });
    for (const d of duplikate(s.beobachter.filter(istText))) {
      f(`„beobachter“: Kürzel „${d}“ kommt mehrfach vor.`);
    }
  }

  // --- Teilbereiche je Bereich (Tageskennzahlen, ENTSCHEIDUNGEN Nr. 45; optional) ---
  if (Array.isArray(s.bereiche)) {
    for (const b of s.bereiche.filter((x) => istObjekt(x) && x.teilbereiche !== undefined)) {
      const t = b.teilbereiche;
      if (!Array.isArray(t) || t.length === 0 || !t.every((x) => istObjekt(x) && istText(x.code) && istText(x.label) && /^[A-Z0-9_-]+$/.test(x.code) && (x.stationaer === undefined || istBool(x.stationaer)))) {
        f(`„bereiche“ (${b.code}): „teilbereiche“ muss eine nicht leere Liste aus { code (A–Z, 0–9, _ -), label, stationaer? (true/false) } sein.`);
      } else {
        for (const d of duplikate(t.map((x) => x.code))) f(`„bereiche“ (${b.code}): Teilbereich „${d}“ kommt mehrfach vor.`);
      }
    }
  }

  // --- Code-Listen ---
  const codes = {}; // Liste → Set gültiger Codes (für Referenzprüfungen)
  for (const name of CODE_LISTEN) {
    codes[name] = new Set();
    const liste = s[name];
    if (!Array.isArray(liste) || liste.length === 0) {
      f(`Liste „${name}“ fehlt oder ist leer.`);
      continue;
    }
    liste.forEach((eintrag, i) => {
      const wo = `„${name}“, Eintrag ${i + 1}`;
      if (!istObjekt(eintrag)) {
        f(`${wo}: Objekt mit „code“ und „label“ erwartet.`);
        return;
      }
      if (!istText(eintrag.code)) f(`${wo}: „code“ fehlt oder ist leer.`);
      if (!istText(eintrag.label)) f(`${wo}${istText(eintrag.code) ? ` (${eintrag.code})` : ''}: „label“ fehlt oder ist leer.`);
    });
    const vorhandene = liste.filter((e) => istObjekt(e) && istText(e.code)).map((e) => e.code);
    for (const d of duplikate(vorhandene)) f(`„${name}“: Code „${d}“ kommt mehrfach vor.`);
    vorhandene.forEach((c) => codes[name].add(c));
  }

  // --- Arbeitskontext: Gruppe ---
  for (const k of eintraege(s.arbeitskontext)) {
    if (!istText(k.gruppe)) f(`Arbeitskontext ${k.code ?? '?'}: „gruppe“ fehlt oder ist leer.`);
  }

  // --- Tätigkeiten ---
  const geraete = new Set();
  for (const t of eintraege(s.taetigkeiten)) {
    const wo = `Tätigkeit ${t.code ?? '?'}`;
    if (!istText(t.kurz)) f(`${wo}: „kurz“ (Tastenbeschriftung) fehlt oder ist leer.`);
    for (const feld of ['geraet', 'haltung', 'nutzungsartPflicht', 'setztGeraetDabei', 'ortsfest', 'nurGehen']) {
      if (t[feld] !== undefined && !istBool(t[feld])) f(`${wo}: „${feld}“ muss true oder false sein.`);
    }
    if (t.geraet === true) geraete.add(t.code);
    if (t.nutzungsartPflicht === true && t.geraet !== true) f(`${wo}: „nutzungsartPflicht“ ist nur bei Geräten („geraet“: true) möglich.`);
    if (t.nurPhase !== undefined && !codes.phasen.has(t.nurPhase)) {
      f(`${wo}: „nurPhase“ verweist auf unbekannte Phase „${t.nurPhase}“.`);
    }
  }

  // --- Unterwegs (ENTSCHEIDUNGEN Nr. 20): Ort „unterwegs“, ortsfeste Tätigkeiten, „Gehen“ ---
  for (const o of eintraege(s.orte)) {
    const wo = `Ort ${o.code ?? '?'}`;
    if (o.unterwegs !== undefined && !istBool(o.unterwegs)) f(`${wo}: „unterwegs“ muss true oder false sein.`);
    if (o.haltung !== undefined && !codes.haltung.has(o.haltung)) f(`${wo}: „haltung“ verweist auf unbekannte Haltung „${o.haltung}“.`);
  }
  const unterwegsOrte = eintraege(s.orte).filter((o) => o.unterwegs === true);
  const gehen = eintraege(s.taetigkeiten).filter((t) => t.nurGehen === true);
  if (unterwegsOrte.length > 1) f('„orte“: Nur ein Ort darf „unterwegs“ sein.');
  if (gehen.length > 1) f('„taetigkeiten“: Nur eine Tätigkeit darf „nurGehen“ sein.');
  if (eintraege(s.taetigkeiten).some((t) => t.ortsfest === true) && (unterwegsOrte.length !== 1 || gehen.length !== 1)) {
    f('Ortsfeste Tätigkeiten („ortsfest“) brauchen genau einen Ort mit „unterwegs“ und genau eine Tätigkeit mit „nurGehen“.');
  }
  for (const t of gehen) {
    if (t.ortsfest === true || t.geraet === true) f(`Tätigkeit ${t.code}: „nurGehen“ ist nicht mit „ortsfest“ oder „geraet“ kombinierbar.`);
  }

  // --- Gleichzeitige Tätigkeiten (ENTSCHEIDUNGEN Nr. 19) ---
  if (s.nebentaetigkeiten !== undefined) {
    if (!Array.isArray(s.nebentaetigkeiten)) {
      f('„nebentaetigkeiten“ muss eine Liste von Tätigkeitscodes sein (darf leer sein).');
    } else {
      for (const tc of s.nebentaetigkeiten) {
        const t = eintraege(s.taetigkeiten).find((x) => x.code === tc);
        if (!t) f(`„nebentaetigkeiten“ verweist auf unbekannte Tätigkeit „${tc}“.`);
        else if (t.nurGehen || t.ortsfest) f(`„nebentaetigkeiten“: ${tc} kann nicht gleichzeitig erfasst werden (ortsfest bzw. nur Gehen).`);
      }
      for (const d of duplikate(s.nebentaetigkeiten)) f(`„nebentaetigkeiten“: ${d} kommt mehrfach vor.`);
    }
  }

  // --- Nutzungsart: giltFuer, Platzhalter N9 ---
  for (const n of eintraege(s.nutzungsart)) {
    const wo = `Nutzungsart ${n.code ?? '?'}`;
    if (!Array.isArray(n.giltFuer) || n.giltFuer.length === 0) {
      f(`${wo}: „giltFuer“ muss eine nicht leere Liste von Tätigkeitscodes sein.`);
      continue;
    }
    for (const tc of n.giltFuer) {
      if (!codes.taetigkeiten.has(tc)) f(`${wo}: „giltFuer“ verweist auf unbekannte Tätigkeit „${tc}“.`);
      else if (!geraete.has(tc)) f(`${wo}: „giltFuer“ verweist auf „${tc}“, das kein Gerät ist („geraet“: true fehlt).`);
    }
  }
  if (codes.nutzungsart.size > 0) {
    const n9 = eintraege(s.nutzungsart).find((n) => n.code === NUTZUNGSART_UNBEKANNT);
    if (!n9) {
      f(`„nutzungsart“: Der Code „${NUTZUNGSART_UNBEKANNT}“ (nicht erkennbar) fehlt; er wird für unvollständige Episoden benötigt.`);
    } else {
      for (const t of eintraege(s.taetigkeiten).filter((x) => x.nutzungsartPflicht)) {
        if (Array.isArray(n9.giltFuer) && !n9.giltFuer.includes(t.code)) {
          f(`„${NUTZUNGSART_UNBEKANNT}“ muss für ${t.code} gelten (Pflicht-Nutzungsart).`);
        }
      }
    }
  }

  if (codes.haltung.size > 0 && !codes.haltung.has(HALTUNG_UNBEKANNT)) {
    f(`„haltung“: Der Code „${HALTUNG_UNBEKANNT}“ (Sonstige) fehlt; er gilt, solange keine Haltung gewählt ist.`);
  }

  // --- Pausengründe, Abbruchgründe ---
  for (const p of eintraege(s.pausengruende)) {
    if (p.freitextPflicht !== undefined && !istBool(p.freitextPflicht)) f(`Pausengrund ${p.code ?? '?'}: „freitextPflicht“ muss true oder false sein.`);
  }
  for (const a of eintraege(s.abbruchgruende)) {
    if (a.kommentarPflicht !== undefined && !istBool(a.kommentarPflicht)) f(`Abbruchgrund ${a.code ?? '?'}: „kommentarPflicht“ muss true oder false sein.`);
  }

  // --- Gerät dabei: J, N, U müssen vorhanden sein ---
  for (const code of Object.values(GERAET_DABEI)) {
    if (codes.geraetDabeiOptionen.size > 0 && !codes.geraetDabeiOptionen.has(code)) {
      f(`„geraetDabeiOptionen“: Code „${code}“ fehlt (benötigt: J, N, U).`);
    }
  }

  // --- Export ---
  if (!istObjekt(s.export)) {
    f('Abschnitt „export“ fehlt.');
  } else {
    if (typeof s.export.mailEmpfaenger !== 'string') f('„export.mailEmpfaenger“ muss ein Text sein (leer = kein Mail-Export).');
    if (!istText(s.export.mailBetreffPraefix)) f('„export.mailBetreffPraefix“ fehlt oder ist leer.');
  }

  // --- Regeln für die Auswertung ---
  if (!istObjekt(s.regelnAuswertung)) {
    f('Abschnitt „regelnAuswertung“ fehlt.');
  } else {
    const r = s.regelnAuswertung;
    if (typeof r.mindestdauerSek !== 'number' || !(r.mindestdauerSek >= 0)) {
      f('„regelnAuswertung.mindestdauerSek“ muss eine Zahl ≥ 0 sein.');
    }
    if (!Array.isArray(r.mindestdauerAusnahmen)) {
      f('„regelnAuswertung.mindestdauerAusnahmen“ muss eine Liste sein (darf leer sein).');
    } else {
      for (const tc of r.mindestdauerAusnahmen) {
        if (!codes.taetigkeiten.has(tc)) f(`„regelnAuswertung.mindestdauerAusnahmen“ verweist auf unbekannte Tätigkeit „${tc}“.`);
      }
    }
  }

  return fehler;
}

/**
 * Lädt und validiert das Kodierschema.
 * @param {(url: string) => Promise<Response>} fetchFn injizierbar für Tests
 * @param {string} url relativ zur App
 * @returns {Promise<{ schema: object|null, fehler: string[] }>}
 */
export async function ladeSchema(fetchFn, url = './kodierschema.json') {
  let antwort;
  try {
    antwort = await fetchFn(url, { cache: 'no-cache' });
  } catch (e) {
    return { schema: null, fehler: [`Die Datei kodierschema.json konnte nicht geladen werden (${e.message}).`] };
  }
  if (!antwort.ok) {
    return { schema: null, fehler: [`Die Datei kodierschema.json konnte nicht geladen werden (HTTP ${antwort.status}).`] };
  }
  let text;
  try {
    text = await antwort.text();
  } catch (e) {
    return { schema: null, fehler: [`Die Datei kodierschema.json konnte nicht gelesen werden (${e.message}).`] };
  }
  return pruefeSchemaText(text);
}

/**
 * Parst und validiert den Text einer kodierschema.json.
 * @param {string} text
 * @returns {{ schema: object|null, fehler: string[] }}
 */
export function pruefeSchemaText(text) {
  let schema;
  try {
    schema = JSON.parse(text);
  } catch (e) {
    return { schema: null, fehler: [`Die Datei kodierschema.json ist kein gültiges JSON: ${e.message}`] };
  }
  const fehler = validiereSchema(schema);
  return { schema: fehler.length === 0 ? schema : null, fehler };
}

// --- Hilfsfunktionen ---

function duplikate(werte) {
  const gesehen = new Set();
  const doppelt = new Set();
  for (const w of werte) (gesehen.has(w) ? doppelt : gesehen).add(w);
  return [...doppelt];
}

function eintraege(liste) {
  return Array.isArray(liste) ? liste.filter(istObjekt) : [];
}
