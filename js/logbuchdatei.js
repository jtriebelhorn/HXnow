// Logbuch-Datei (PLAN_Logbuch_Datensicherheit 5): fester Name je Gerät, wird bei jedem Export ersetzt. Enthält
// Teilnehmerliste, Phasenplan, Logbuch-Einträge und Änderungsprotokoll, aber keine Beobachtungs- oder Antwortinhalte.
// Eine Kopfzeile für alle Zeilen; `datensatz` = meta · proband · phasenplan · eintrag · aenderung.
// Die meta-Zeile (immer zuerst) trägt n_zeilen und die CRC32-Prüfsumme über alle übrigen Zeilen. DOM-frei, synchron.
import { csvFeld, csvText } from './export.js';
import { leseCsv } from './csvlesen.js';
import { crc32 } from './crc32.js';
import { isoMitOffset, datumLokal, uhrzeit } from './zeit.js';

export const SPALTEN_LOGBUCH = Object.freeze([
  'datensatz', 'export_ts', 'geraete_id', 'app_version', 'db_version', 'definition_version', 'schema_version',
  'n_zeilen', 'pruefsumme', 'stand_text',
  'pseudonym', 'bereich', 'status', 'status_ts', 'registriert_ts', 'notiz',
  'baseline_start', 'einfuehrung_start', 'regelbetrieb_start', 'abschluss_start', 'phase_ende',
  'eintrag_id', 'art', 'phase', 'dienst', 'arbeitskontext', 'start', 'ende', 'beobachtet_sek', 'pausen_anzahl', 'pausen_sek',
  'ende_art', 'abbruch_code', 'erhebungsmodus', 'papier_datum', 'beantwortet', 'ausgelassen', 'export_status', 'testmodus',
  'aenderung_id', 'ts', 'ziel_typ', 'ziel_id', 'feld', 'alt', 'neu', 'grund', 'text',
]);

const PHASEN_FELDER = [['baselineStart', 'baseline_start'], ['einfuehrungStart', 'einfuehrung_start'],
  ['regelbetriebStart', 'regelbetrieb_start'], ['abschlussStart', 'abschluss_start'], ['ende', 'phase_ende']];

const iso = (ts) => (ts === null || ts === undefined || ts === '' ? '' : isoMitOffset(ts));
const ms = (s) => (s ? Date.parse(s) : null);
const zahl = (s) => (s === '' || s === undefined ? null : Number(s));

export function dateinameLogbuch(geraeteId, test = false) {
  return `HXNOW_${test ? 'TEST_' : ''}Logbuch_${String(geraeteId).slice(0, 8)}.csv`;
}

/** Kurzer Stand in Klartext (z. B. „16 Probanden, 61 Blöcke, 19 Fragebögen, letzte Sitzung 03.12.2026 10:14“). */
export function standText({ teilnehmende, logbuch }) {
  const echt = logbuch.filter((l) => !l.testmodus);
  const bloecke = echt.filter((l) => l.art === 'BLOCK').length;
  const boegen = echt.filter((l) => ['FB1', 'KB', 'FB2'].includes(l.art)).length;
  const letzte = Math.max(0, ...echt.map((l) => l.endTs ?? l.startTs ?? 0));
  return `${teilnehmende.length} Probanden, ${bloecke} Blöcke, ${boegen} Fragebögen`
    + (letzte ? `, letzte Sitzung ${datumLokal(letzte).split('-').reverse().join('.')} ${uhrzeit(letzte).slice(0, 5)}` : '');
}

/**
 * Erzeugt die Logbuch-Datei aus den Stores.
 * @param {{ teilnehmende, phasenplan, logbuch, aenderungen }} daten
 * @param {{ geraeteId, appVersion, dbVersion, definitionVersion, schemaVersion, now, test }} kopf
 */
export function logbuchDatei(daten, kopf) {
  const leer = Object.fromEntries(SPALTEN_LOGBUCH.map((s) => [s, '']));
  const zeile = (werte) => SPALTEN_LOGBUCH.map((s) => werte[s] ?? '');
  const zeilen = [
    ...daten.teilnehmende.map((t) => zeile({
      ...leer, datensatz: 'proband', pseudonym: t.pseudonym, bereich: t.bereich ?? '', status: t.status, status_ts: iso(t.statusTs),
      registriert_ts: iso(t.registriertTs), notiz: t.notiz ?? '',
      ...Object.fromEntries(PHASEN_FELDER.map(([f, s]) => [s, t.phasenAbweichung?.[f] ?? ''])),
    })),
    ...daten.phasenplan.map((p) => zeile({ ...leer, datensatz: 'phasenplan', bereich: p.bereich, ...Object.fromEntries(PHASEN_FELDER.map(([f, s]) => [s, p[f] ?? ''])) })),
    ...daten.logbuch.map((l) => zeile({
      ...leer, datensatz: 'eintrag', eintrag_id: l.eintragId, art: l.art, pseudonym: l.pseudonym, phase: l.phase ?? '', bereich: l.bereich ?? '',
      dienst: l.dienst ?? '', arbeitskontext: l.arbeitskontext ?? '', start: iso(l.startTs), ende: iso(l.endTs),
      beobachtet_sek: l.beobachtetSek ?? '', pausen_anzahl: l.pausenAnzahl ?? '', pausen_sek: l.pausenSek ?? '', status: l.status ?? '',
      ende_art: l.endeArt ?? '', abbruch_code: l.abbruchCode ?? '', erhebungsmodus: l.erhebungsmodus ?? '', papier_datum: l.papierDatum ?? '',
      beantwortet: l.beantwortet ?? '', ausgelassen: l.ausgelassen ?? '', export_status: l.exportStatus ?? '',
      testmodus: l.testmodus ? 1 : 0, geraete_id: l.geraeteId ?? '',
    })),
    ...daten.aenderungen.map((a) => zeile({
      ...leer, datensatz: 'aenderung', aenderung_id: a.aenderungId, ts: iso(a.ts), geraete_id: a.geraeteId ?? '', app_version: a.appVersion ?? '',
      art: a.art, ziel_typ: a.zielTyp, ziel_id: a.zielId, feld: a.feld ?? '', alt: a.alt ?? '', neu: a.neu ?? '', grund: a.grund ?? '', text: a.text ?? '',
    })),
  ];
  const koerper = zeilen.map((z) => z.map(csvFeld).join(';')).join('\r\n');
  const meta = zeile({
    ...leer, datensatz: 'meta', export_ts: iso(kopf.now), geraete_id: kopf.geraeteId, app_version: kopf.appVersion, db_version: kopf.dbVersion,
    definition_version: kopf.definitionVersion, schema_version: kopf.schemaVersion, n_zeilen: zeilen.length, pruefsumme: crc32(koerper),
    stand_text: standText(daten),
  });
  return { dateiname: dateinameLogbuch(kopf.geraeteId, kopf.test), inhalt: csvText(SPALTEN_LOGBUCH, [meta, ...zeilen]), typ: 'text/csv' };
}

/**
 * Liest eine Logbuch-Datei und prüft Zeilenzahl und Prüfsumme.
 * @returns {{ ok: boolean, fehler: string[], meta, teilnehmende, phasenplan, logbuch, aenderungen }}
 */
export function leseLogbuchDatei(text) {
  const roh = String(text).replace(/^﻿/, '');
  const { kopf, zeilen } = leseCsv(roh);
  const fehler = [];
  if (kopf[0] !== 'datensatz' || kopf[1] !== 'export_ts') return { ok: false, fehler: ['Keine Logbuch-Datei.'] };
  const meta = zeilen[0];
  if (meta?.datensatz !== 'meta') fehler.push('Die erste Zeile ist keine meta-Zeile.');
  // Prüfsumme über den Originaltext aller Zeilen nach der meta-Zeile (CSV-Felder können Zeilenumbrüche enthalten)
  const ohneKopf = roh.slice(roh.indexOf('\r\n') + 2);
  const metaEnde = indexNachDatensatz(ohneKopf);
  const koerper = ohneKopf.slice(metaEnde).replace(/\r\n$/, '');
  if (meta && crc32(koerper) !== meta.pruefsumme) fehler.push('Prüfsumme stimmt nicht – Datei verändert oder beschädigt.');
  if (meta && Number(meta.n_zeilen) !== zeilen.length - 1) fehler.push(`Zeilenzahl ${zeilen.length - 1} statt ${meta.n_zeilen}.`);
  const art = (a) => zeilen.filter((z) => z.datensatz === a);
  const phasen = (z) => Object.fromEntries(PHASEN_FELDER.map(([f, s]) => [f, z[s] || null]));
  const hatPhasen = (p) => Object.values(p).some(Boolean);
  return {
    ok: fehler.length === 0, fehler,
    meta: meta ? { exportTs: ms(meta.export_ts), geraeteId: meta.geraete_id, appVersion: meta.app_version, standText: meta.stand_text } : null,
    teilnehmende: art('proband').map((z) => ({
      pseudonym: z.pseudonym, bereich: z.bereich || null, status: z.status, statusTs: ms(z.status_ts), registriertTs: ms(z.registriert_ts),
      notiz: z.notiz, phasenAbweichung: hatPhasen(phasen(z)) ? phasen(z) : null,
    })),
    phasenplan: art('phasenplan').map((z) => ({ bereich: z.bereich, ...phasen(z) })),
    logbuch: art('eintrag').map((z) => ({
      eintragId: z.eintrag_id, art: z.art, pseudonym: z.pseudonym, phase: z.phase || null, bereich: z.bereich || null,
      dienst: z.dienst || null, arbeitskontext: z.arbeitskontext || null, startTs: ms(z.start), endTs: ms(z.ende),
      beobachtetSek: zahl(z.beobachtet_sek), pausenAnzahl: zahl(z.pausen_anzahl), pausenSek: zahl(z.pausen_sek), status: z.status,
      endeArt: z.ende_art || null, abbruchCode: z.abbruch_code || null, erhebungsmodus: z.erhebungsmodus, papierDatum: z.papier_datum || null,
      beantwortet: zahl(z.beantwortet), ausgelassen: zahl(z.ausgelassen), exportStatus: z.export_status, testmodus: z.testmodus === '1',
      geraeteId: z.geraete_id,
    })),
    aenderungen: art('aenderung').map((z) => ({
      aenderungId: z.aenderung_id, ts: ms(z.ts), geraeteId: z.geraete_id, appVersion: z.app_version, art: z.art, zielTyp: z.ziel_typ,
      zielId: z.ziel_id, feld: z.feld || null, alt: z.alt || null, neu: z.neu || null, grund: z.grund || null, text: z.text,
    })),
  };
}

/** Position nach dem ersten Datensatz (meta) unter Beachtung von Anführungszeichen. */
function indexNachDatensatz(t) {
  let inAnf = false;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '"') inAnf = !inAnf;
    else if (!inAnf && t[i] === '\r' && t[i + 1] === '\n') return i + 2;
  }
  return t.length;
}
