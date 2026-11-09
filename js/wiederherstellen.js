// Wiederherstellen (PLAN_Logbuch_Datensicherheit 4.5, 4.6): beliebig viele Dateien aus dem Exportordner auf einmal.
// Dateityp wird am Inhalt erkannt (nicht am Namen): Komplettsicherung (JSON), Logbuch-Datei, Sitzungsdateien
// (Block, Versuch, Fragebogen), Tageskennzahlen. Prüfsummen werden geprüft. Ergebnis ist ein Plan aus Datensätzen
// je Store, der ohne Überschreiben importiert wird (db.importiere), und ein Bericht. DOM-frei.
//
// Regeln:
// - Rohdaten (Blöcke mit Episoden, Antworten …) kommen nur aus Komplettsicherungen.
// - Teilnehmerliste, Phasenplan, Logbuch-Einträge und Änderungen kommen aus allen gültigen Logbuch-Dateien und
//   Komplettsicherungen; bei gleicher ID gilt die jüngste Quelle.
// - Fehlt ein Logbuch-Eintrag, wird er aus der Sitzungsdatei aufgebaut (`wiederhergestellt`). Liegt die
//   Sitzungsdatei im Exportordner, gilt der Eingang als bestätigt.
// - Daten widerrufener Codes werden abgewiesen (nur die Zeile der Teilnehmerliste und die Änderungen bleiben).
import { leseCsv, dateiArtAusKopf } from './csvlesen.js';
import { leseLogbuchDatei } from './logbuchdatei.js';
import { pruefeSicherung, GESICHERTE_STORES } from './sicherung.js';

const ms = (s) => (s ? Date.parse(s) : null);
const zahl = (s) => (s === '' || s === undefined || s === null ? null : Number(s));
const PHASE_BOGEN = { FB1: 'PRE', KB: 'EINF', FB2: 'POST' };
const FERTIG = new Set(['beendet', 'abgebrochen', 'nicht_angetroffen', 'abgeschlossen']);

/**
 * Erkennt eine Datei am Inhalt.
 * @returns {{ name, typ: 'komplett'|'logbuch'|'block'|'versuch'|'fb'|'tag'|'unbekannt', fehler: string[], ... }}
 */
export function erkenneDatei(name, text) {
  const t = String(text).replace(/^﻿/, '');
  const test = /^HXNOW_TEST_/.test(name);
  if (t.trimStart().startsWith('{')) {
    const { sicherung, fehler } = pruefeSicherung(t);
    return sicherung ? { name, typ: 'komplett', fehler: [], sicherung, ts: sicherung.erstelltTs ?? 0 } : { name, typ: 'unbekannt', fehler };
  }
  const ersteZeile = t.slice(0, t.indexOf('\n') >>> 0).replace(/\r$/, '');
  const kopf = ersteZeile.split(';');
  const art = dateiArtAusKopf(kopf);
  if (art === 'logbuch') {
    const lb = leseLogbuchDatei(t);
    return { name, typ: lb.ok ? 'logbuch' : 'unbekannt', fehler: lb.fehler, logbuch: lb, ts: lb.meta?.exportTs ?? 0 };
  }
  const { zeilen } = leseCsv(t);
  const z = zeilen[0];
  if (!z) return { name, typ: 'unbekannt', fehler: ['Leere Datei.'] };
  if (art === 'block') {
    const n = zahl(z.n_zeilen_block);
    if (n !== zeilen.length && !(n === 0 && zeilen.length === 1)) {
      return { name, typ: 'unbekannt', fehler: [`Zeilenzahl ${zeilen.length} statt ${z.n_zeilen_block} – Datei unvollständig.`] };
    }
    return {
      name, typ: 'block', fehler: [], test,
      eintrag: {
        eintragId: z.block_id, art: 'BLOCK', pseudonym: z.pseudonym, phase: z.phase || null, bereich: z.bereich || null, dienst: z.dienst || null,
        arbeitskontext: z.arbeitskontext || null, startTs: ms(z.block_start), endTs: ms(z.block_ende), beobachtetSek: zahl(z.block_beobachtet_sek),
        pausenAnzahl: zahl(z.block_pausen_anzahl), pausenSek: zahl(z.block_pausen_sek), status: z.block_status, endeArt: z.block_ende_art || null,
        abbruchCode: z.abbruch_code || null, erhebungsmodus: '', geraeteId: z.geraete_id,
      },
    };
  }
  if (art === 'versuch') {
    return {
      name, typ: 'versuch', fehler: [], test,
      eintrag: {
        eintragId: z.versuch_id, art: 'VERSUCH', pseudonym: z.pseudonym, phase: z.phase || null, bereich: z.bereich || null, dienst: z.dienst || null,
        arbeitskontext: null, startTs: ms(z.zeitpunkt), endTs: ms(z.zeitpunkt), beobachtetSek: 0, pausenAnzahl: 0, pausenSek: 0,
        status: 'nicht_angetroffen', endeArt: null, abbruchCode: null, erhebungsmodus: '', geraeteId: z.geraete_id,
      },
    };
  }
  if (art === 'fb') {
    if (zahl(z.n_zeilen) !== zeilen.length) return { name, typ: 'unbekannt', fehler: [`Zeilenzahl ${zeilen.length} statt ${z.n_zeilen} – Datei unvollständig.`] };
    const zaehle = (st) => zeilen.filter((r) => r.status === st).length;
    return {
      name, typ: 'fb', fehler: [], test,
      eintrag: {
        eintragId: z.sitzung_id, art: z.bezug_sitzung_id ? `${z.bogen}-NACHTRAG` : z.bogen, pseudonym: z.pseudonym, phase: PHASE_BOGEN[z.bogen] ?? null, bereich: z.bereich || null,
        dienst: null, arbeitskontext: null, startTs: ms(z.start) ?? ms(z.papier_datum), endTs: ms(z.ende), beobachtetSek: null, dauerSek: zahl(z.dauer_sek),
        pausenAnzahl: 0, pausenSek: 0, status: 'abgeschlossen', endeArt: null, abbruchCode: null, erhebungsmodus: z.erhebungsmodus,
        papierDatum: z.papier_datum || null, beantwortet: zaehle('beantwortet'), ausgelassen: zaehle('ausgelassen'), geraeteId: z.geraete_id,
      },
    };
  }
  if (art === 'tag') {
    return {
      name, typ: 'tag', fehler: [],
      satz: { datum: z.datum, bereich: z.bereich, teilbereich: z.teilbereich ?? '', belegung: zahl(z.belegung), aufnahmen: zahl(z.aufnahmen), entlassungen: zahl(z.entlassungen),
        ambulant: zahl(z.ambulant), aerzteAnwesend: zahl(z.aerzte_anwesend), ereignisse: z.ereignisse,
        beobachter: z.beobachter, geraeteId: z.geraete_id, schemaVersion: z.schema_version, appVersion: z.app_version, ts: ms(z.erfasst), exportStatus: 'bestaetigt' },
    };
  }
  return { name, typ: 'unbekannt', fehler: ['Dateityp nicht erkannt.'] };
}

/**
 * Stellt aus erkannten Dateien die zu importierenden Datensätze zusammen.
 * @param {ReturnType<typeof erkenneDatei>[]} dateien
 * @param {{ vorhandeneTeilnehmende?: object[], istTest?: (pseudonym) => boolean, now?: number }} opt
 * @returns {{ stores: Record<string, object[]>, bericht }}
 */
export function planeWiederherstellung(dateien, { vorhandeneTeilnehmende = [], istTest = () => false, now = Date.now() } = {}) {
  const gueltig = dateien.filter((d) => d.typ !== 'unbekannt');
  const komplett = gueltig.filter((d) => d.typ === 'komplett').sort((a, b) => a.ts - b.ts);
  const logbuecher = gueltig.filter((d) => d.typ === 'logbuch').sort((a, b) => a.ts - b.ts);
  const sitzungen = gueltig.filter((d) => ['block', 'versuch', 'fb'].includes(d.typ));

  // Quellen für Logbuch-Stores, älteste zuerst; spätere überschreiben gleiche IDs
  const quellen = [
    ...komplett.map((d) => ({ ts: d.ts, ...pick(d.sicherung.stores) })),
    ...logbuecher.map((d) => ({ ts: d.ts, teilnehmende: d.logbuch.teilnehmende, phasenplan: d.logbuch.phasenplan, logbuch: d.logbuch.logbuch, aenderungen: d.logbuch.aenderungen })),
  ].sort((a, b) => a.ts - b.ts);
  const karte = { teilnehmende: new Map(), phasenplan: new Map(), logbuch: new Map(), aenderungen: new Map() };
  const id = { teilnehmende: (x) => x.pseudonym, phasenplan: (x) => x.bereich, logbuch: (x) => x.eintragId, aenderungen: (x) => x.aenderungId };
  for (const q of quellen) for (const n of Object.keys(karte)) for (const x of q[n] ?? []) karte[n].set(id[n](x), x);

  // Sitzungsdateien: fehlende Einträge aufbauen, vorhandene als bestätigt führen
  let aufgebaut = 0;
  for (const d of sitzungen) {
    const e = d.eintrag;
    const alt = karte.logbuch.get(e.eintragId);
    if (alt) {
      if (alt.exportStatus !== 'bestaetigt') karte.logbuch.set(e.eintragId, { ...alt, exportStatus: 'bestaetigt' });
    } else {
      karte.logbuch.set(e.eintragId, { ...e, exportStatus: 'bestaetigt', testmodus: d.test || istTest(e.pseudonym), wiederhergestellt: true });
      aufgebaut += 1;
    }
    if (!karte.teilnehmende.has(e.pseudonym) && !(d.test || istTest(e.pseudonym))) {
      karte.teilnehmende.set(e.pseudonym, { pseudonym: e.pseudonym, bereich: e.bereich, status: 'aktiv', statusTs: e.startTs, registriertTs: e.startTs, notiz: '', phasenAbweichung: null, wiederhergestellt: true });
    }
  }

  // Widerrufene Codes: aus Gerät, Logbuch-Dateien und Sicherungen
  const widerrufen = new Set([...vorhandeneTeilnehmende, ...karte.teilnehmende.values()].filter((t) => t.status === 'widerrufen').map((t) => t.pseudonym));
  const roh = Object.fromEntries(Object.keys(GESICHERTE_STORES).filter((n) => !(n in karte)).map((n) => [n, []]));
  for (const d of komplett) for (const n of Object.keys(roh)) roh[n].push(...(d.sicherung.stores[n] ?? []));
  const abgewiesen = { saetze: 0, codes: new Set() };
  const weg = (pseudonym) => {
    if (!widerrufen.has(pseudonym)) return false;
    abgewiesen.saetze += 1;
    abgewiesen.codes.add(pseudonym);
    return true;
  };
  const blockeWeg = new Set(roh.bloecke.filter((b) => widerrufen.has(b.pseudonym)).map((b) => b.blockId));
  const sitzWeg = new Set(roh.fb_sitzungen.filter((s) => widerrufen.has(s.pseudonym)).map((s) => s.sitzungId));
  const stores = {
    bloecke: roh.bloecke.filter((b) => !weg(b.pseudonym)),
    episoden: roh.episoden.filter((e) => !blockeWeg.has(e.blockId)),
    pausen: roh.pausen.filter((p) => !blockeWeg.has(p.blockId)),
    versuche: roh.versuche.filter((v) => !weg(v.pseudonym)),
    tageskennzahlen: [...roh.tageskennzahlen, ...gueltig.filter((d) => d.typ === 'tag').map((d) => d.satz)],
    fb_sitzungen: roh.fb_sitzungen.filter((s) => !weg(s.pseudonym)),
    fb_antworten: roh.fb_antworten.filter((a) => !sitzWeg.has(a.sitzungId)),
    teilnehmende: [...karte.teilnehmende.values()],
    phasenplan: [...karte.phasenplan.values()],
    logbuch: [...karte.logbuch.values()].filter((l) => !weg(l.pseudonym)),
    aenderungen: [...karte.aenderungen.values()],
  };
  const neuestesLogbuch = logbuecher.at(-1) ?? null;
  return {
    stores,
    bericht: {
      dateien: dateien.length,
      komplett: komplett.length,
      logbuecher: logbuecher.length,
      neuestesLogbuch: neuestesLogbuch ? { name: neuestesLogbuch.name, exportTs: neuestesLogbuch.ts, standText: neuestesLogbuch.logbuch.meta?.standText ?? '' } : null,
      sitzungen: sitzungen.length,
      aufgebaut,
      tage: gueltig.filter((d) => d.typ === 'tag').length,
      abgelehnt: dateien.filter((d) => d.typ === 'unbekannt').map((d) => ({ name: d.name, grund: d.fehler.join(' ') })),
      widerrufen: { codes: [...abgewiesen.codes].sort(), saetze: abgewiesen.saetze },
      geraete: [...new Set([...komplett.map((d) => d.sicherung.geraeteId), ...logbuecher.map((d) => d.logbuch.meta?.geraeteId)].filter(Boolean))],
      offeneSitzungen: stores.logbuch.filter((l) => FERTIG.has(l.status) && l.exportStatus !== 'bestaetigt' && !l.testmodus).length,
      ohneLogbuch: logbuecher.length === 0,
      now,
    },
  };
}

function pick(stores) {
  return { teilnehmende: stores.teilnehmende ?? [], phasenplan: stores.phasenplan ?? [], logbuch: stores.logbuch ?? [], aenderungen: stores.aenderungen ?? [] };
}
