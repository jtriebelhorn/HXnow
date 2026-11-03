// Fachlogik eines Beobachtungsblocks (Spezifikation v2, Abschnitt 4 und 7.3). DOM-frei.
//
// Alle Aktionen sind reine Funktionen: Sie verändern den übergebenen Zustand nicht, sondern liefern
//   { ok, zustand, schreiben: { block, episoden, pausen }, code?, fehler?, ... }
// `schreiben` enthält die geänderten Datensätze, die der Aufrufer sofort persistiert, bevor er den neuen
// Zustand anzeigt. Auch abgelehnte Aktionen können etwas zu schreiben haben (z. B. wenn dabei das reguläre
// Blockende festgestellt wurde) – `schreiben` daher immer verarbeiten.
//
// Zeitbegriffe:
//   Wandzeit       = endTs − startTs
//   beobachtete Zeit = Wandzeit − Summe der Pausen; das reguläre Ende ist erreicht, wenn sie die gewählte
//                    Blockdauer erreicht (während einer Pause steht sie still).
//
// Kontext `ctx`: { schema, now: () => number, uuid: () => string }, für Tests injizierbar.

import { NUTZUNGSART_UNBEKANNT, GERAET_DABEI, blockDauerOptionen, pflichtangaben, korrekturfensterMs } from './schema.js';

export const STATUS = Object.freeze({
  LAUFEND: 'laufend',
  PAUSIERT: 'pausiert',
  BEENDET: 'beendet',
  ABGEBROCHEN: 'abgebrochen',
  VERWORFEN: 'verworfen', // vorzeitig beendet, Daten nicht behalten (bleibt gespeichert, wird nicht exportiert)
});

export const ENDE_ART = Object.freeze({
  REGULAER: 'regulaer', // beobachtete Zeit hat die gewählte Blockdauer erreicht
  MANUELL: 'manuell', // „Block beenden“ vor Ablauf
  ABBRUCH: 'abbruch', // Abbruch mit Grund A1–A4
});

export const ZUSATZ_FELDER = Object.freeze(['nutzungsart', 'haltung']);

// ---------------------------------------------------------------------------
// Block anlegen und wiederherstellen
// ---------------------------------------------------------------------------

// Stammdaten: Feld → Prüfung (liefert Fehlermeldung oder null). Leere Werte prüft pruefeStammdaten.
const STAMMDATEN = {
  pseudonym: (schema, w) => (new RegExp(schema.pseudonym.muster).test(w)
    ? null : `Studien-Code ungültig (Beispiel: ${schema.pseudonym.beispiel ?? schema.pseudonym.muster}).`),
  beobachter: (schema, w) => (schema.beobachter.includes(w) ? null : 'Unbekanntes Beobachter-Kürzel.'),
  bereich: (schema, w) => (finde(schema.bereiche, w) ? null : 'Unbekannter Bereich.'),
  dienst: (schema, w) => (finde(schema.dienste, w) ? null : 'Unbekannter Dienst.'),
  phase: (schema, w) => (finde(schema.phasen, w) ? null : 'Unbekannte Phase.'),
  arbeitskontext: (schema, w) => (finde(schema.arbeitskontext, w) ? null : 'Unbekannter Arbeitskontext.'),
};
const FEHLT = {
  pseudonym: 'Studien-Code fehlt.', beobachter: 'Bitte Beobachter-Kürzel wählen.', bereich: 'Bitte Bereich wählen.',
  dienst: 'Bitte Dienst wählen.', phase: 'Bitte Phase wählen.', arbeitskontext: 'Bitte Arbeitskontext wählen.',
};

const leerWert = (w) => w === null || w === undefined || (typeof w === 'string' && w.trim() === '');

/**
 * Prüft Stammdaten eines Blocks bzw. Versuchs. Pflicht laut `pflichtangaben` (Kodierschema);
 * optionale Felder dürfen leer bleiben, müssen aber gültig sein, wenn sie angegeben sind.
 * @param {'block'|'versuch'} art
 * @returns {Record<string,string>} Feld → Fehlermeldung (leer = gültig)
 */
export function pruefeStammdaten(schema, angaben, art) {
  const pflicht = pflichtangaben(schema)[art];
  const felder = art === 'block' ? Object.keys(STAMMDATEN) : Object.keys(STAMMDATEN).filter((f) => f !== 'arbeitskontext');
  const fehler = {};
  for (const feld of felder) {
    const w = typeof angaben[feld] === 'string' ? angaben[feld].trim() : angaben[feld];
    if (leerWert(w)) {
      if (pflicht.includes(feld)) fehler[feld] = FEHLT[feld];
      continue;
    }
    const f = STAMMDATEN[feld](schema, w);
    if (f) fehler[feld] = f;
  }
  return fehler;
}

/** Prüft die Angaben beim Anlegen eines Blocks (inkl. Blockdauer). */
export function pruefeBlockAngaben(schema, angaben) {
  const fehler = pruefeStammdaten(schema, angaben, 'block');
  const dauer = angaben.blockDauerSek ?? schema.blockDauerSek;
  if (!blockDauerOptionen(schema).includes(dauer)) fehler.blockDauerSek = 'Bitte Blockdauer wählen.';
  return fehler;
}

/** Ist ein Stammdatenfeld laut Kodierschema Pflicht? */
export function istPflicht(schema, art, feld) {
  return pflichtangaben(schema)[art].includes(feld);
}

/**
 * Legt einen neuen, laufenden Block an. Startzeitpunkt = jetzt.
 * @param {object} angaben { pseudonym, phase, beobachter?, bereich?, dienst?, arbeitskontext?, blockDauerSek? } (Pflicht laut Kodierschema)
 * @param {object} ctx { schema, now, uuid, geraeteId, appVersion }
 */
export function erzeugeBlock(angaben, ctx) {
  const { schema } = ctx;
  const felder = pruefeBlockAngaben(schema, angaben);
  if (Object.keys(felder).length > 0) {
    return { ok: false, code: 'ANGABEN_UNGUELTIG', fehler: Object.values(felder).join(' '), felder, zustand: null, schreiben: leer() };
  }
  const block = {
    blockId: ctx.uuid(),
    geraeteId: ctx.geraeteId,
    schemaVersion: schema.schemaVersion,
    appVersion: ctx.appVersion,
    pseudonym: angaben.pseudonym.trim(),
    beobachter: angaben.beobachter || null,
    bereich: angaben.bereich || null,
    dienst: angaben.dienst || null,
    phase: angaben.phase,
    arbeitskontext: angaben.arbeitskontext || null,
    blockDauerSek: angaben.blockDauerSek ?? schema.blockDauerSek, // geplante beobachtete Zeit
    startTs: ctx.now(),
    endTs: null,
    status: STATUS.LAUFEND,
    endeArt: null,
    endeGrund: '',
    abbruchCode: null,
    kommentar: '',
    hxGeraetMarkiertTs: null,
    hxGeraetAutomatisch: false,
    hxGeraetDabei: null,
    exportStatus: 'offen',
    exportiertTs: null,
    bestaetigtTs: null,
  };
  return erfolg(neuerZustand(block, [], []), { block });
}

/** Baut den Zustand aus gespeicherten Datensätzen wieder auf (z. B. nach Neuladen). */
export function stelleWiederHer(block, episoden, pausen = []) {
  return neuerZustand(block, episoden, pausen);
}

function neuerZustand(block, episoden, pausen) {
  // `auswahl` hält T/O vor der ersten Episode (nur im Speicher; die erste Episode beginnt immer zum Blockstart)
  return {
    block,
    episoden: [...episoden].sort(nachNr),
    pausen: [...pausen].sort((a, b) => a.startTs - b.startTs),
    auswahl: { taetigkeit: null, ort: null },
  };
}

// ---------------------------------------------------------------------------
// Abfragen
// ---------------------------------------------------------------------------

/** Nicht gelöschte Episoden in Reihenfolge. */
export function aktiveEpisoden(zustand) {
  return zustand.episoden.filter((e) => !e.geloescht).sort(nachNr);
}

/** Zuletzt gestartete, nicht gelöschte Episode (während einer Pause: die Episode vor der Pause) oder null. */
export function aktuelleEpisode(zustand) {
  const aktiv = aktiveEpisoden(zustand);
  return aktiv.length > 0 ? aktiv[aktiv.length - 1] : null;
}

/** Laufende (noch nicht fortgesetzte) Pause oder null. */
export function laufendePause(zustand) {
  return zustand.pausen.find((p) => p.endTs === null) ?? null;
}

/** Läuft oder pausiert der Block (= noch nicht beendet)? */
export function istOffen(zustand) {
  return zustand.block.status === STATUS.LAUFEND || zustand.block.status === STATUS.PAUSIERT;
}

/** Geplante beobachtete Zeit des Blocks in Sekunden (ältere Blöcke ohne Angabe: Standard aus dem Schema). */
export function geplanteDauerSek(block, schema) {
  return block.blockDauerSek ?? schema.blockDauerSek;
}

/** Summe aller Pausendauern in ms; eine laufende Pause zählt bis `bis` (bzw. Blockende). */
export function pausenMs(zustand, bis = null) {
  const grenze = zustand.block.endTs ?? bis;
  return zustand.pausen.reduce((s, p) => s + Math.max(0, (p.endTs ?? grenze ?? p.startTs) - p.startTs), 0);
}

/** Beobachtete Zeit in ms (ohne Pausen), bis Blockende bzw. `jetzt`. */
export function beobachtetMs(zustand, jetzt = null) {
  const ende = zustand.block.endTs ?? jetzt ?? zustand.block.startTs;
  return Math.max(0, ende - zustand.block.startTs - pausenMs(zustand, ende));
}

/** Zeitpunkt des regulären Blockendes; null während einer Pause (die beobachtete Zeit steht still). */
export function regulaeresEnde(zustand, schema) {
  if (laufendePause(zustand)) return null;
  return zustand.block.startTs + geplanteDauerSek(zustand.block, schema) * 1000 + pausenMs(zustand);
}

/** Verbleibende beobachtete Zeit in ms (0, wenn der Block beendet ist). */
export function restzeitMs(zustand, schema, jetzt) {
  if (!istOffen(zustand)) return 0;
  return Math.max(0, geplanteDauerSek(zustand.block, schema) * 1000 - beobachtetMs(zustand, jetzt));
}

/** true in den letzten `warnungVorEndeSek` Sekunden eines laufenden (nicht pausierten) Blocks. */
export function istWarnphase(zustand, schema, jetzt) {
  const rest = restzeitMs(zustand, schema, jetzt);
  return zustand.block.status === STATUS.LAUFEND && rest > 0 && rest <= schema.warnungVorEndeSek * 1000;
}

/** Dauer der laufenden Pause in ms (0 ohne Pause). */
export function pauseDauerMs(zustand, jetzt) {
  const p = laufendePause(zustand);
  return p ? Math.max(0, jetzt - p.startTs) : 0;
}

/** Laufende Pause länger als `pauseMaxSek`? (nur Hinweis, kein automatischer Abbruch) */
export function pauseZuLang(zustand, schema, jetzt) {
  return pauseDauerMs(zustand, jetzt) > schema.pauseMaxSek * 1000;
}

/** Ob eine Tätigkeit in der Phase des Blocks wählbar ist (z. B. T3 nur in POST). */
export function taetigkeitErlaubt(zustand, schema, code) {
  const t = finde(schema.taetigkeiten, code);
  return Boolean(t) && (!t.nurPhase || t.nurPhase === zustand.block.phase);
}

/** Ob ein Ort gültig ist. */
export function ortErlaubt(zustand, schema, code) {
  return Boolean(finde(schema.orte, code));
}

/**
 * Zusatzangaben einer Tätigkeit:
 *  - Nutzungsart bei Geräten mit `nutzungsartPflicht` (T3, Pflicht) bzw. bei übrigen Geräten, wenn
 *    `nutzungsartBeiT1T2` eingeschaltet ist (optional).
 *  - Haltung bei Tätigkeiten mit `haltung: true` (T3, Pflicht).
 * @returns {{ felder: string[], pflicht: string[] }}
 */
export function zusatzFuer(schema, taetigkeit) {
  const t = finde(schema.taetigkeiten, taetigkeit);
  const felder = [];
  const pflicht = [];
  if (!t) return { felder, pflicht };
  if (t.geraet && (t.nutzungsartPflicht || schema.nutzungsartBeiT1T2) && nutzungsartenFuer(schema, taetigkeit).length > 0) {
    felder.push('nutzungsart');
    if (t.nutzungsartPflicht) pflicht.push('nutzungsart');
  }
  if (t.haltung) {
    felder.push('haltung');
    pflicht.push('haltung');
  }
  return { felder, pflicht };
}

/** Kurzform: Zusatzfelder einer Tätigkeit. */
export function zusatzFelder(schema, taetigkeit) {
  return zusatzFuer(schema, taetigkeit).felder;
}

/** Nutzungsarten, die für eine Tätigkeit gelten (`giltFuer`). */
export function nutzungsartenFuer(schema, taetigkeit) {
  return schema.nutzungsart.filter((n) => Array.isArray(n.giltFuer) && n.giltFuer.includes(taetigkeit));
}

/** Wählbare Codes eines Zusatzfelds für eine Tätigkeit. */
export function zusatzCodes(schema, feld, taetigkeit) {
  return feld === 'nutzungsart' ? nutzungsartenFuer(schema, taetigkeit) : schema[feld];
}

/** Phase, in der „HX-Now-Gerät dabei“ erfasst wird (aus der Tätigkeit mit `setztGeraetDabei`), oder null. */
export function geraetDabeiPhase(schema) {
  const t = schema.taetigkeiten.find((x) => x.setztGeraetDabei);
  return t ? (t.nurPhase ?? null) : null;
}

/** Wird in diesem Block „Gerät dabei“ erfasst? */
export function mitGeraetDabei(zustand, schema) {
  const phase = geraetDabeiPhase(schema);
  return phase !== null && zustand.block.phase === phase;
}

/** Vorbelegung der Abschlussfrage „Gerät dabei?“: „ja“, wenn der Schalter gesetzt ist, sonst keine. */
export function geraetDabeiVorbelegung(zustand) {
  const b = zustand.block;
  return b.hxGeraetAutomatisch || b.hxGeraetMarkiertTs !== null ? GERAET_DABEI.JA : null;
}

/**
 * Episoden mit berechnetem Ende und Dauer.
 * Ende = Start der nächsten nicht gelöschten Episode, Beginn einer Pause oder Blockende – was zuerst kommt.
 * Bei offenem Block endet die letzte Episode „jetzt“ (`laufend: true`).
 */
export function berechneEpisoden(zustand, jetzt = null) {
  const { block } = zustand;
  const aktiv = aktiveEpisoden(zustand);
  return aktiv.map((e, i) => {
    const kandidaten = [];
    if (aktiv[i + 1]) kandidaten.push(aktiv[i + 1].startTs);
    const pause = zustand.pausen.find((p) => p.startTs >= e.startTs);
    if (pause) kandidaten.push(pause.startTs);
    if (block.endTs !== null) kandidaten.push(block.endTs);
    const laufend = kandidaten.length === 0;
    const endeTs = laufend ? Math.max(e.startTs, jetzt ?? e.startTs) : Math.min(...kandidaten);
    // Ganze Sekunden auf der Uhr der beobachteten Zeit gerundet → Summe = gerundete beobachtete Zeit
    const beob = (ts) => Math.round((ts - block.startTs - pausenBis(zustand, ts, jetzt)) / 1000);
    const uhr = gerundeteUhr(zustand, jetzt);
    return {
      ...e, endeTs, laufend, dauerMs: endeTs - e.startTs, dauerSek: beob(endeTs) - beob(e.startTs),
      startSek: uhr(e.startTs), endeSek: uhr(endeTs),
    };
  });
}

/** Pausen mit berechnetem Ende und Dauer (laufende Pause bis Blockende bzw. `jetzt`). */
export function berechnePausen(zustand, jetzt = null) {
  const { block } = zustand;
  return zustand.pausen.map((p) => {
    const laufend = p.endTs === null && block.endTs === null;
    const endeTs = p.endTs ?? block.endTs ?? Math.max(p.startTs, jetzt ?? p.startTs);
    // Ganze Sekunden auf der Pausen-Uhr gerundet → Summe = gerundete Pausenzeit
    const pz = (ts) => Math.round(pausenBis(zustand, ts, jetzt) / 1000);
    const uhr = gerundeteUhr(zustand, jetzt);
    return {
      ...p, endeTs, laufend, dauerMs: endeTs - p.startTs, dauerSek: pz(endeTs) - pz(p.startTs),
      startSek: uhr(p.startTs), endeSek: uhr(endeTs),
    };
  });
}

/**
 * Sekunden ab Blockstart auf der gerundeten Uhr: beobachtete Zeit und Pausenzeit werden getrennt gerundet,
 * genau wie die Dauern. Dadurch gilt im Export für jede Zeile ende − start = dauer_sek, die Zeitleiste
 * bleibt lückenlos, und das Blockende ist Blockstart + beobachtete Zeit + Pausenzeit (ENTSCHEIDUNGEN Nr. 15).
 */
function gerundeteUhr(zustand, jetzt = null) {
  const start = zustand.block.startTs;
  return (ts) => {
    const pause = pausenBis(zustand, ts, jetzt);
    return Math.round((ts - start - pause) / 1000) + Math.round(pause / 1000);
  };
}

/** Blockende in Sekunden ab Blockstart auf der gerundeten Uhr (beendeter Block). */
export function blockEndeSek(zustand) {
  return gerundeteUhr(zustand)(zustand.block.endTs);
}

/** Chronologische Zeitleiste aus Episoden und Pausen: [{ art: 'episode'|'pause', ... }]. */
export function zeitleiste(zustand, jetzt = null) {
  const eintraege = [
    ...berechneEpisoden(zustand, jetzt).map((e) => ({ art: 'episode', ...e })),
    ...berechnePausen(zustand, jetzt).map((p) => ({ art: 'pause', ...p })),
  ];
  // Bei gleichem Start (Episode mit Dauer 0): Episoden nach Nummer, Episode vor Pause
  const rang = (x) => (x.art === 'episode' ? 0 : 1);
  return eintraege.sort((a, b) => a.startTs - b.startTs || rang(a) - rang(b) || (a.nr ?? 0) - (b.nr ?? 0));
}

/** Zusammenfassung für die Abschlussseite. Anteile beziehen sich auf die beobachtete Zeit. */
export function zusammenfassung(zustand, schema, jetzt = null) {
  const eps = berechneEpisoden(zustand, jetzt);
  const pausen = berechnePausen(zustand, jetzt);
  const beobachtet = beobachtetMs(zustand, jetzt);
  const proT = new Map();
  for (const e of eps) proT.set(e.taetigkeit, (proT.get(e.taetigkeit) ?? 0) + e.dauerMs);
  const anteile = [...proT.keys()]
    .sort((a, b) => indexIn(schema.taetigkeiten, a) - indexIn(schema.taetigkeiten, b))
    .map((code) => ({
      code,
      label: finde(schema.taetigkeiten, code)?.label ?? code,
      dauerMs: proT.get(code),
      prozent: beobachtet > 0 ? (100 * proT.get(code)) / beobachtet : 0,
    }));
  return {
    dauerMs: beobachtet,
    beobachtetMs: beobachtet,
    pausenAnzahl: pausen.length,
    pausenMs: pausen.reduce((s, p) => s + p.dauerMs, 0),
    anzahlEpisoden: eps.length,
    anteile,
    unvollstaendig: eps.filter((e) => e.unvollstaendig),
  };
}

// ---------------------------------------------------------------------------
// Aktionen während des Blocks
// ---------------------------------------------------------------------------

/**
 * Prüft, ob die beobachtete Zeit die Blockdauer erreicht hat, und beendet den Block dann regulär
 * mit endTs = Zeitpunkt des Erreichens (auch bei verspätetem Aufruf). Während einer Pause nie.
 * @returns Ergebnis mit `beendet: true`, wenn der Block hierdurch beendet wurde.
 */
export function pruefeAblauf(zustand, ctx) {
  if (zustand.block.status !== STATUS.LAUFEND) return erfolg(zustand, {}, { beendet: false });
  const ende = regulaeresEnde(zustand, ctx.schema);
  if (ende === null || ctx.now() < ende) return erfolg(zustand, {}, { beendet: false });
  const block = { ...zustand.block, status: STATUS.BEENDET, endeArt: ENDE_ART.REGULAER, endTs: ende };
  return erfolg({ ...zustand, block }, { block }, { beendet: true });
}

/** Tipp auf eine Tätigkeitstaste. */
export function tippeTaetigkeit(zustand, code, ctx) {
  return wechsle(zustand, { taetigkeit: code }, ctx);
}

/** Tipp auf eine Ortstaste. */
export function tippeOrt(zustand, code, ctx) {
  return wechsle(zustand, { ort: code }, ctx);
}

/**
 * Wechselt Tätigkeit und/oder Ort. Der jeweils nicht angegebene Wert wird übernommen.
 * Neue Episode, sobald sich T oder O ändert; gleiche Werte bewirken nichts (`unveraendert: true`).
 * Bei reinem Ortswechsel werden Nutzungsart und Haltung übernommen; ein Tätigkeitswechsel
 * (auch zwischen Geräten) setzt sie zurück.
 */
export function wechsle(zustand, ziel, ctx) {
  const sperre = eingabeSperre(zustand, ctx);
  if (sperre) return sperre;
  const { schema } = ctx;
  const akt = aktuelleEpisode(zustand);
  const basis = akt ?? zustand.auswahl;
  const t = ziel.taetigkeit ?? basis.taetigkeit;
  const o = ziel.ort ?? basis.ort;

  const fehlerT = ziel.taetigkeit !== undefined ? pruefeTaetigkeit(zustand, schema, ziel.taetigkeit) : null;
  if (fehlerT) return fehlerT;
  if (ziel.ort !== undefined && !finde(schema.orte, ziel.ort)) {
    return abgelehnt(zustand, 'CODE_UNBEKANNT', `Unbekannter Ort „${ziel.ort}“.`);
  }

  // Vor der ersten Episode: Auswahl sammeln; die erste Episode entsteht, sobald T und O feststehen.
  if (!akt) {
    const auswahl = { taetigkeit: t, ort: o };
    if (t === null || o === null) return erfolg({ ...zustand, auswahl }, {}, { neueEpisode: false });
    const ep = baueEpisode(zustand, ctx, schema, { taetigkeit: t, ort: o, ...zusatzStart(schema, t) }, zustand.block.startTs);
    return mitNeuerEpisode({ ...zustand, auswahl }, ep, ctx);
  }

  if (t === akt.taetigkeit && o === akt.ort) return erfolg(zustand, {}, { unveraendert: true, neueEpisode: false });

  const korrektur = korrigiere(zustand, akt, t, o, ctx);
  if (korrektur) return korrektur;

  const zusatz = t === akt.taetigkeit ? zusatzUebernehmen(akt) : zusatzStart(schema, t);
  return mitNeuerEpisode(zustand, baueEpisode(zustand, ctx, schema, { taetigkeit: t, ort: o, ...zusatz }), ctx);
}

/**
 * Korrekturfenster (ENTSCHEIDUNGEN Nr. 16): Ein T/O-Tipp kurz nach dem Anlegen einer Episode (`korrekturfensterSek`)
 * ändert diese Episode, statt eine neue anzulegen – z. B. erst Ort, dann sofort Tätigkeit. Führt die Korrektur
 * zur Kodierung der Vorgänger-Episode zurück, war die Episode ein Vertipper und wird wie bei „Rückgängig“ gelöscht.
 * Die überschriebenen Werte bleiben in `korrekturen` der Episode gespeichert (Rohdaten).
 * Nicht bei Tätigkeiten mit Mindestdauer-Ausnahme (HX Now): Deren kurze Nutzung bleibt eine eigene Episode.
 * @returns Ergebnis oder null, wenn kein Korrekturfall vorliegt
 */
function korrigiere(zustand, akt, t, o, ctx) {
  const { schema } = ctx;
  const fenster = korrekturfensterMs(schema);
  const ts = zeitpunkt(zustand, ctx);
  if (fenster <= 0 || ts - (akt.erfasstTs ?? akt.startTs) >= fenster) return null;
  const ausnahmen = schema.regelnAuswertung?.mindestdauerAusnahmen ?? [];
  if (t !== akt.taetigkeit && ausnahmen.includes(akt.taetigkeit)) return null;

  const korrekturen = [...(akt.korrekturen ?? []),
    { ts, taetigkeit: akt.taetigkeit, ort: akt.ort, nutzungsart: akt.nutzungsart, haltung: akt.haltung }];
  const aktiv = aktiveEpisoden(zustand);
  const vorher = aktiv.length >= 2 ? aktiv[aktiv.length - 2] : null;
  const pauseDazwischen = vorher && zustand.pausen.some((p) => p.startTs >= vorher.startTs && p.startTs <= akt.startTs);
  if (vorher && !pauseDazwischen && vorher.taetigkeit === t && vorher.ort === o) {
    const ep = { ...akt, geloescht: true, korrekturen };
    const { zustand: z, block } = ohneGeraetDabeiWennLeer(ersetze(zustand, ep), ctx);
    return erfolg(z, { episoden: [ep], block }, { korrigiert: true, neueEpisode: false, wiederAktiv: vorher });
  }
  const zusatz = t === akt.taetigkeit ? zusatzUebernehmen(akt) : zusatzStart(schema, t);
  const ep = mitVollstaendigkeit(schema, { ...akt, taetigkeit: t, ort: o, ...zusatz, korrekturen });
  let z = ersetze(zustand, ep);
  const block = geraetDabeiDurch(z, ep, ctx);
  if (block) z = { ...z, block };
  const { zustand: z2, block: block2 } = ohneGeraetDabeiWennLeer(z, ctx);
  return erfolg(z2, { episoden: [ep], block: block2 ?? block }, { korrigiert: true, neueEpisode: false, episode: ep });
}

/** Tipp auf eine Nutzungsart-Taste (N…). */
export function tippeNutzungsart(zustand, code, ctx) {
  return setzeZusatz(zustand, 'nutzungsart', code, ctx);
}

/** Tipp auf eine Haltungs-Taste (H…). */
export function tippeHaltung(zustand, code, ctx) {
  return setzeZusatz(zustand, 'haltung', code, ctx);
}

/**
 * Setzt Nutzungsart oder Haltung der laufenden Episode.
 * Noch leere Angabe → wird in der laufenden Episode ergänzt (keine neue Episode).
 * Bereits gesetzte Angabe mit anderem Wert → neue Episode.
 */
function setzeZusatz(zustand, feld, code, ctx) {
  const sperre = eingabeSperre(zustand, ctx);
  if (sperre) return sperre;
  const { schema } = ctx;
  const akt = aktuelleEpisode(zustand);
  if (!akt) return abgelehnt(zustand, 'KEINE_EPISODE', 'Bitte zuerst Tätigkeit und Ort wählen.');
  const fehler = pruefeZusatzCode(zustand, schema, akt.taetigkeit, feld, code);
  if (fehler) return fehler;

  if (akt.offeneZusaetze.includes(feld)) {
    const ep = mitVollstaendigkeit(schema, { ...akt, [feld]: code, offeneZusaetze: akt.offeneZusaetze.filter((f) => f !== feld) });
    return erfolg(ersetze(zustand, ep), { episoden: [ep] }, { neueEpisode: false });
  }
  if (akt[feld] === code) return erfolg(zustand, {}, { unveraendert: true, neueEpisode: false });

  const ep = baueEpisode(zustand, ctx, schema, {
    taetigkeit: akt.taetigkeit, ort: akt.ort, ...zusatzUebernehmen(akt), [feld]: code,
  });
  return mitNeuerEpisode(zustand, ep, ctx);
}

/**
 * Rückgängig: markiert die zuletzt gestartete Episode als gelöscht; die vorherige läuft weiter.
 * Nicht über die erste Episode und nicht über eine Pause hinweg; nimmt nur ganze Episoden zurück.
 */
export function rueckgaengig(zustand, ctx) {
  const sperre = eingabeSperre(zustand, ctx);
  if (sperre) return sperre;
  const aktiv = aktiveEpisoden(zustand);
  if (aktiv.length <= 1) {
    return abgelehnt(zustand, 'ERSTE_EPISODE', 'Die erste Episode kann nicht rückgängig gemacht werden.');
  }
  const letzte = aktiv[aktiv.length - 1];
  const vorher = aktiv[aktiv.length - 2];
  if (zustand.pausen.some((p) => p.startTs >= vorher.startTs && p.startTs <= letzte.startTs)) {
    return abgelehnt(zustand, 'UEBER_PAUSE', 'Die erste Episode nach einer Pause kann nicht rückgängig gemacht werden.');
  }
  const ep = { ...letzte, geloescht: true };
  const { zustand: z, block } = ohneGeraetDabeiWennLeer(ersetze(zustand, ep), ctx);
  return erfolg(z, { episoden: [ep], block }, { wiederAktiv: vorher });
}

/** Kommentar zur laufenden Episode (ersetzt einen vorhandenen Kommentar). */
export function setzeEpisodenKommentar(zustand, text, ctx) {
  const sperre = eingabeSperre(zustand, ctx);
  if (sperre) return sperre;
  const akt = aktuelleEpisode(zustand);
  if (!akt) return abgelehnt(zustand, 'KEINE_EPISODE', 'Es läuft noch keine Episode.');
  const ep = { ...akt, kommentar: String(text ?? '').trim() };
  return erfolg(ersetze(zustand, ep), { episoden: [ep] });
}

/** Kommentar zum Block, auch nach dem Blockende (Abschlussseite). */
export function setzeBlockKommentar(zustand, text) {
  const block = { ...zustand.block, kommentar: String(text ?? '').trim() };
  return erfolg({ ...zustand, block }, { block });
}

/**
 * Ergänzt eine noch leere Nutzungsart/Haltung einer beliebigen Episode, auch nach dem Blockende
 * (Abschlussseite). Bereits gesetzte Angaben können hier nicht verändert werden.
 */
export function ergaenzeEpisode(zustand, episodeId, feld, code, ctx) {
  const { schema } = ctx;
  const ep0 = zustand.episoden.find((e) => e.episodeId === episodeId && !e.geloescht);
  if (!ep0) return abgelehnt(zustand, 'EPISODE_UNBEKANNT', 'Episode nicht gefunden.');
  if (!ZUSATZ_FELDER.includes(feld) || !ep0.offeneZusaetze.includes(feld)) {
    return abgelehnt(zustand, 'NICHT_OFFEN', `${feldName(feld)} ist bei dieser Episode nicht offen.`);
  }
  const fehler = pruefeZusatzCode(zustand, schema, ep0.taetigkeit, feld, code);
  if (fehler) return fehler;
  const ep = mitVollstaendigkeit(schema, { ...ep0, [feld]: code, offeneZusaetze: ep0.offeneZusaetze.filter((f) => f !== feld) });
  return erfolg(ersetze(zustand, ep), { episoden: [ep] });
}

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

/** „Pause“: beendet die laufende Episode und hält die beobachtete Zeit an. */
export function pausiere(zustand, ctx) {
  const sperre = eingabeSperre(zustand, ctx);
  if (sperre) return sperre;
  if (!aktuelleEpisode(zustand)) return abgelehnt(zustand, 'KEINE_EPISODE', 'Bitte zuerst Tätigkeit und Ort wählen.');
  const pause = {
    pauseId: ctx.uuid(),
    blockId: zustand.block.blockId,
    startTs: zeitpunkt(zustand, ctx),
    endTs: null,
    grund: null,
    freitext: '',
  };
  const block = { ...zustand.block, status: STATUS.PAUSIERT };
  return erfolg({ ...zustand, block, pausen: [...zustand.pausen, pause] }, { block, pausen: [pause] }, { pause });
}

/**
 * Grund und Notiz der laufenden Pause setzen (jederzeit während der Pause, optional).
 * @param {{ grund?: string|null, freitext?: string }} angaben nur übergebene Felder werden geändert
 */
export function setzePauseAngaben(zustand, angaben, ctx) {
  const p0 = laufendePause(zustand);
  if (zustand.block.status !== STATUS.PAUSIERT || !p0) return abgelehnt(zustand, 'NICHT_PAUSIERT', 'Der Block ist nicht pausiert.');
  const pause = { ...p0 };
  if (angaben.grund !== undefined) {
    if (angaben.grund !== null && !finde(ctx.schema.pausengruende, angaben.grund)) {
      return abgelehnt(zustand, 'CODE_UNBEKANNT', `Unbekannter Pausengrund „${angaben.grund}“.`);
    }
    pause.grund = angaben.grund;
  }
  if (angaben.freitext !== undefined) pause.freitext = String(angaben.freitext ?? '').trim();
  return erfolg({ ...zustand, pausen: zustand.pausen.map((p) => (p.pauseId === pause.pauseId ? pause : p)) }, { pausen: [pause] });
}

/**
 * „Fortsetzen“: beendet die Pause und setzt die Kodierung so fort, wie sie vor der Pause war
 * (gleiche Tätigkeit, Ort, Nutzungsart und Haltung in einer neuen Episode).
 * Grund und Notiz sind optional (Pflicht nur, wenn `pflichtangaben.pauseGrund` bzw. `freitextPflicht` gesetzt ist).
 * Optional können Tätigkeit/Ort abweichend angegeben werden.
 * @param {{ grund?, freitext?, taetigkeit?, ort? }} angaben
 */
export function setzeFort(zustand, angaben = {}, ctx) {
  const { schema } = ctx;
  if (zustand.block.status !== STATUS.PAUSIERT) return abgelehnt(zustand, 'NICHT_PAUSIERT', 'Der Block ist nicht pausiert.');
  const pause0 = laufendePause(zustand);
  const grundCode = angaben.grund !== undefined ? angaben.grund : pause0.grund;
  const freitext = String((angaben.freitext !== undefined ? angaben.freitext : pause0.freitext) ?? '').trim();
  const grund = grundCode ? finde(schema.pausengruende, grundCode) : null;
  if (grundCode && !grund) return abgelehnt(zustand, 'CODE_UNBEKANNT', `Unbekannter Pausengrund „${grundCode}“.`);
  if (!grund && pflichtangaben(schema).pauseGrund) return abgelehnt(zustand, 'GRUND_FEHLT', 'Bitte den Grund der Pause wählen.');
  if (grund?.freitextPflicht && !freitext) {
    return abgelehnt(zustand, 'FREITEXT_PFLICHT', `Bei „${grund.label}“ ist eine Beschreibung Pflicht.`);
  }
  const vorher = aktuelleEpisode(zustand);
  const taetigkeit = angaben.taetigkeit ?? vorher.taetigkeit;
  const ort = angaben.ort ?? vorher.ort;
  const fehlerT = pruefeTaetigkeit(zustand, schema, taetigkeit);
  if (fehlerT) return fehlerT;
  if (!finde(schema.orte, ort)) return abgelehnt(zustand, 'CODE_UNBEKANNT', `Unbekannter Ort „${ort}“.`);

  const ts = zeitpunkt(zustand, ctx);
  const pause = { ...pause0, endTs: ts, grund: grund?.code ?? null, freitext };
  let z = {
    ...zustand,
    block: { ...zustand.block, status: STATUS.LAUFEND },
    pausen: zustand.pausen.map((p) => (p.pauseId === pause.pauseId ? pause : p)),
  };
  const zusatz = vorher.taetigkeit === taetigkeit ? zusatzUebernehmen(vorher) : zusatzStart(schema, taetigkeit);
  const ep = baueEpisode(z, ctx, schema, { taetigkeit, ort, ...zusatz }, ts);
  z = mitNeuerEpisode(z, ep, ctx).zustand;
  return erfolg(z, { block: z.block, episoden: [ep], pausen: [pause] }, { neueEpisode: true, episode: ep });
}

/**
 * Fehlende optionale Blockangabe nachtragen (z. B. Dienst oder Arbeitskontext auf der Abschlussseite).
 * Bereits gesetzte Angaben werden hier nicht geändert.
 */
export function ergaenzeBlockAngabe(zustand, feld, wert, ctx) {
  if (!['beobachter', 'bereich', 'dienst', 'arbeitskontext'].includes(feld)) {
    return abgelehnt(zustand, 'NICHT_ERGAENZBAR', `„${feld}“ kann nicht nachgetragen werden.`);
  }
  if (!leerWert(zustand.block[feld])) return abgelehnt(zustand, 'BEREITS_GESETZT', `„${feld}“ ist bereits gesetzt.`);
  const f = STAMMDATEN[feld](ctx.schema, wert);
  if (f) return abgelehnt(zustand, 'CODE_UNBEKANNT', f);
  const block = { ...zustand.block, [feld]: wert };
  return erfolg({ ...zustand, block }, { block });
}

// ---------------------------------------------------------------------------
// HX-Now-Gerät dabei (nur in der Phase der Tätigkeit mit `setztGeraetDabei`, d. h. Post)
// ---------------------------------------------------------------------------

/** Schalter „Gerät dabei“ während des Blocks setzen bzw. (wenn nicht automatisch gesetzt) zurücknehmen. */
export function setzeGeraetDabei(zustand, an, ctx) {
  const sperre = eingabeSperre(zustand, ctx, { auchPausiert: true });
  if (sperre) return sperre;
  if (!mitGeraetDabei(zustand, ctx.schema)) return abgelehnt(zustand, 'NUR_POST', '„Gerät dabei“ wird nur in der Post-Phase erfasst.');
  const b = zustand.block;
  let block;
  if (an) {
    if (b.hxGeraetMarkiertTs !== null) return erfolg(zustand, {}, { unveraendert: true });
    block = { ...b, hxGeraetMarkiertTs: ctx.now() };
  } else {
    if (b.hxGeraetAutomatisch) {
      return abgelehnt(zustand, 'AUTOMATISCH', 'Der Schalter wurde durch eine HX-Now-Episode gesetzt und kann nicht zurückgenommen werden.');
    }
    if (b.hxGeraetMarkiertTs === null) return erfolg(zustand, {}, { unveraendert: true });
    block = { ...b, hxGeraetMarkiertTs: null };
  }
  return erfolg({ ...zustand, block }, { block });
}

/** Abschlussfrage „War ein HX-Now-Gerät dabei?“ (J/N/U); „nein“ nicht möglich, wenn HX Now kodiert wurde. */
export function beantworteGeraetDabei(zustand, code, ctx) {
  if (!mitGeraetDabei(zustand, ctx.schema)) return abgelehnt(zustand, 'NUR_POST', '„Gerät dabei“ wird nur in der Post-Phase erfasst.');
  if (istOffen(zustand)) return abgelehnt(zustand, 'NOCH_OFFEN', 'Die Frage wird beim Blockabschluss beantwortet.');
  if (!finde(ctx.schema.geraetDabeiOptionen, code)) return abgelehnt(zustand, 'CODE_UNBEKANNT', 'Bitte ja, nein oder nicht erkennbar wählen.');
  if (code === GERAET_DABEI.NEIN && zustand.block.hxGeraetAutomatisch) {
    return abgelehnt(zustand, 'NEIN_GESPERRT', '„Nein“ ist nicht möglich, weil HX Now kodiert wurde.');
  }
  const block = { ...zustand.block, hxGeraetDabei: code };
  return erfolg({ ...zustand, block }, { block });
}

// ---------------------------------------------------------------------------
// Blockende
// ---------------------------------------------------------------------------

/**
 * Abbruch, auch während einer Pause. Grund Pflicht, wenn `pflichtangaben.abbruchGrund`; Kommentar Pflicht nur bei
 * Gründen mit `kommentarPflicht`.
 * endTs = jetzt; eine laufende Pause endet mit (Grund bleibt leer).
 */
export function brecheAb(zustand, abbruchCode, kommentar, ctx) {
  const sperre = eingabeSperre(zustand, ctx, { auchPausiert: true });
  if (sperre) return sperre;
  const grund = abbruchCode ? finde(ctx.schema.abbruchgruende, abbruchCode) : null;
  if (abbruchCode && !grund) return abgelehnt(zustand, 'GRUND_FEHLT', `Unbekannter Abbruchgrund „${abbruchCode}“.`);
  if (!grund && pflichtangaben(ctx.schema).abbruchGrund) return abgelehnt(zustand, 'GRUND_FEHLT', 'Bitte einen Abbruchgrund wählen.');
  const text = String(kommentar ?? '').trim();
  if (grund?.kommentarPflicht && !text) {
    return abgelehnt(zustand, 'KOMMENTAR_PFLICHT', `Bei „${grund.label}“ ist ein Kommentar Pflicht.`);
  }
  return beende(zustand, ctx, {
    status: STATUS.ABGEBROCHEN, endeArt: ENDE_ART.ABBRUCH, abbruchCode: grund?.code ?? null, kommentar: text || zustand.block.kommentar,
  });
}

/**
 * „Block beenden“ vor Ablauf ohne Abbruch (auch während einer Pause). endTs = jetzt.
 * behalten = true → Status „beendet“ (wird exportiert); false → „verworfen“ (bleibt gespeichert, kein Export).
 * Grund (Freitext) Pflicht beim Behalten, wenn `pflichtangaben.beendenGrund` (ENTSCHEIDUNGEN Nr. 17).
 */
export function beendeManuell(zustand, { behalten = true, grund = '' } = {}, ctx) {
  const sperre = eingabeSperre(zustand, ctx, { auchPausiert: true });
  if (sperre) return sperre;
  const text = String(grund ?? '').trim();
  if (behalten && !text && pflichtangaben(ctx.schema).beendenGrund) {
    return abgelehnt(zustand, 'GRUND_FEHLT', 'Bitte den Grund für das vorzeitige Ende angeben.');
  }
  return beende(zustand, ctx, { status: behalten ? STATUS.BEENDET : STATUS.VERWORFEN, endeArt: ENDE_ART.MANUELL, endeGrund: text });
}

function beende(zustand, ctx, felder) {
  const ts = zeitpunkt(zustand, ctx);
  const block = { ...zustand.block, ...felder, endTs: ts };
  const offen = laufendePause(zustand);
  const pause = offen ? { ...offen, endTs: ts } : null;
  const pausen = pause ? zustand.pausen.map((p) => (p.pauseId === pause.pauseId ? pause : p)) : zustand.pausen;
  return erfolg({ ...zustand, block, pausen }, { block, pausen: pause ? [pause] : [] });
}

// ---------------------------------------------------------------------------
// Interne Hilfen
// ---------------------------------------------------------------------------

/** Pausenzeit (ms) vor dem Zeitpunkt ts; eine laufende Pause zählt bis Blockende bzw. `jetzt`. */
function pausenBis(zustand, ts, jetzt = null) {
  let summe = 0;
  for (const p of zustand.pausen) {
    const ende = p.endTs ?? zustand.block.endTs ?? jetzt ?? ts;
    summe += Math.max(0, Math.min(ende, ts) - p.startTs);
  }
  return summe;
}

function finde(liste, code) {
  return (liste ?? []).find((e) => e.code === code) ?? null;
}

function indexIn(liste, code) {
  const i = liste.findIndex((e) => e.code === code);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

function nachNr(a, b) {
  return a.nr - b.nr || a.startTs - b.startTs;
}

function leer() {
  return { block: null, episoden: [], pausen: [] };
}

function erfolg(zustand, schreiben = {}, extra = {}) {
  return { ok: true, zustand, schreiben: { ...leer(), ...schreiben, block: schreiben.block ?? null }, ...extra };
}

function abgelehnt(zustand, code, fehler, schreiben = {}) {
  return { ok: false, code, fehler, zustand, schreiben: { ...leer(), ...schreiben, block: schreiben.block ?? null } };
}

/**
 * Eingaben nur bei laufendem (bzw. mit `auchPausiert` auch pausiertem), nicht abgelaufenem Block.
 * Stellt dabei ggf. das reguläre Ende fest.
 */
function eingabeSperre(zustand, ctx, { auchPausiert = false } = {}) {
  const status = zustand.block.status;
  if (status === STATUS.PAUSIERT) {
    return auchPausiert ? null : abgelehnt(zustand, 'PAUSIERT', 'Der Block ist pausiert. Bitte zuerst „Fortsetzen“.');
  }
  if (status !== STATUS.LAUFEND) {
    return abgelehnt(zustand, 'NICHT_LAUFEND', 'Der Block ist beendet; Eingaben sind nicht mehr möglich.');
  }
  const ablauf = pruefeAblauf(zustand, ctx);
  if (ablauf.beendet) {
    return abgelehnt(ablauf.zustand, 'ABGELAUFEN', 'Die Blockzeit ist abgelaufen; die Eingabe wurde nicht übernommen.', ablauf.schreiben);
  }
  return null;
}

function pruefeTaetigkeit(zustand, schema, code) {
  const td = finde(schema.taetigkeiten, code);
  if (!td) return abgelehnt(zustand, 'CODE_UNBEKANNT', code ? `Unbekannte Tätigkeit „${code}“.` : 'Bitte die Tätigkeit wählen.');
  if (td.nurPhase && td.nurPhase !== zustand.block.phase) {
    const phase = finde(schema.phasen, td.nurPhase)?.label ?? td.nurPhase;
    return abgelehnt(zustand, 'NUR_PHASE', `${td.label} (${td.code}) ist nur in der Phase „${phase}“ erlaubt.`);
  }
  return null;
}

function pruefeZusatzCode(zustand, schema, taetigkeit, feld, code) {
  if (!zusatzFelder(schema, taetigkeit).includes(feld)) {
    return abgelehnt(zustand, 'ZUSATZ_UNZULAESSIG', `${feldName(feld)} wird bei ${taetigkeit} nicht erfasst.`);
  }
  if (!finde(schema[feld], code)) return abgelehnt(zustand, 'CODE_UNBEKANNT', `Unbekannte ${feldName(feld)} „${code}“.`);
  if (!finde(zusatzCodes(schema, feld, taetigkeit), code)) {
    return abgelehnt(zustand, 'NICHT_ZULAESSIG', `${feldName(feld)} ${code} gilt nicht für ${taetigkeit}.`);
  }
  return null;
}

/**
 * Zeitpunkt einer Eingabe: Date.now() (über ctx.now), aber nie vor dem letzten Ereignis des Blocks
 * (Episodenstart, Pausenbeginn/-ende) – schützt vor Überlappungen, falls die Geräteuhr zurückgestellt wird.
 */
function zeitpunkt(zustand, ctx) {
  let ts = Math.max(ctx.now(), zustand.block.startTs);
  for (const e of aktiveEpisoden(zustand)) ts = Math.max(ts, e.startTs);
  for (const p of zustand.pausen) ts = Math.max(ts, p.startTs, p.endTs ?? 0);
  return ts;
}

/** Startwerte der Zusatzangaben: alle leer; Pflicht-Nutzungsart mit Platzhalter N9. */
function zusatzStart(schema, taetigkeit) {
  const { felder, pflicht } = zusatzFuer(schema, taetigkeit);
  return {
    nutzungsart: pflicht.includes('nutzungsart') ? NUTZUNGSART_UNBEKANNT : null,
    haltung: null,
    offeneZusaetze: [...felder],
  };
}

function zusatzUebernehmen(ep) {
  return { nutzungsart: ep.nutzungsart, haltung: ep.haltung, offeneZusaetze: [...ep.offeneZusaetze] };
}

/** unvollständig = eine Pflicht-Zusatzangabe ist noch leer. */
function mitVollstaendigkeit(schema, ep) {
  const { pflicht } = zusatzFuer(schema, ep.taetigkeit);
  return { ...ep, unvollstaendig: ep.offeneZusaetze.some((f) => pflicht.includes(f)) };
}

function baueEpisode(zustand, ctx, schema, werte, startTs = null) {
  const aktiv = aktiveEpisoden(zustand);
  return mitVollstaendigkeit(schema, {
    episodeId: ctx.uuid(),
    blockId: zustand.block.blockId,
    // Rückgängig löscht immer nur die letzte Episode → nicht gelöschte Episoden sind lückenlos 1..n
    nr: aktiv.length + 1,
    startTs: startTs ?? zeitpunkt(zustand, ctx),
    erfasstTs: zeitpunkt(zustand, ctx), // Zeitpunkt des Tipps, der die Episode angelegt hat (Korrekturfenster)
    taetigkeit: werte.taetigkeit,
    ort: werte.ort,
    nutzungsart: werte.nutzungsart ?? null,
    haltung: werte.haltung ?? null,
    offeneZusaetze: werte.offeneZusaetze ?? [],
    kommentar: '',
    geloescht: false,
  });
}

/** Fügt eine Episode hinzu; HX Now in der Post-Phase setzt „Gerät dabei“ automatisch. */
function mitNeuerEpisode(zustand, ep, ctx) {
  const block = geraetDabeiDurch(zustand, ep, ctx);
  const z = { ...zustand, block: block ?? zustand.block, episoden: [...zustand.episoden, ep] };
  return erfolg(z, { episoden: [ep], block }, { neueEpisode: true, episode: ep });
}

/** Geänderter Block, wenn die Episode „Gerät dabei“ automatisch setzt (HX Now in der Post-Phase), sonst null. */
function geraetDabeiDurch(zustand, ep, ctx) {
  const td = finde(ctx.schema.taetigkeiten, ep.taetigkeit);
  if (!td?.setztGeraetDabei || !mitGeraetDabei(zustand, ctx.schema) || zustand.block.hxGeraetAutomatisch) return null;
  return { ...zustand.block, hxGeraetAutomatisch: true, hxGeraetMarkiertTs: zustand.block.hxGeraetMarkiertTs ?? ctx.now() };
}

/** Automatisch gesetztes „Gerät dabei“ zurücknehmen, wenn keine HX-Now-Episode mehr übrig ist. */
function ohneGeraetDabeiWennLeer(zustand, ctx) {
  if (!zustand.block.hxGeraetAutomatisch
    || aktiveEpisoden(zustand).some((e) => finde(ctx.schema.taetigkeiten, e.taetigkeit)?.setztGeraetDabei)) {
    return { zustand, block: null };
  }
  const block = { ...zustand.block, hxGeraetAutomatisch: false };
  return { zustand: { ...zustand, block }, block };
}

function ersetze(zustand, ep) {
  return { ...zustand, episoden: zustand.episoden.map((e) => (e.episodeId === ep.episodeId ? ep : e)) };
}

function feldName(feld) {
  return feld === 'nutzungsart' ? 'Nutzungsart' : feld === 'haltung' ? 'Haltung' : feld;
}
