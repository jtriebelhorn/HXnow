// Export (Spezifikation Abschnitt 7.4 und 8).
// Teil 1 – CSV-Erzeugung: DOM-frei, mit `node --test` testbar.
// Teil 2 – Exportwege (Teilen, Download, Mail, Zwischenablage): greifen erst beim Aufruf auf Browser-APIs zu.
//
// WICHTIG (Safari): versucheTeilen() muss synchron aus einem Klick-Handler aufgerufen werden,
// ohne vorheriges `await`. Die Datei wird daher synchron aus dem Zustand im Speicher erzeugt.

import { zeitleiste, geplanteDauerSek, mitGeraetDabei, blockEndeSek } from './block.js';
import { istTestPseudonym, nebentaetigkeiten } from './schema.js';
import { isoMitOffset, datumLokal, dateinameZeit } from './zeit.js';

const BOM = '\uFEFF';
const TRENNER = ';';
const ZEILENENDE = '\r\n';

/**
 * Feste Spalten der Block-CSV (Spezifikation v2 Abschnitt 8). Zusätzlich laut docs/ENTSCHEIDUNGEN.md:
 * `block_dauer_soll_sek` (Nr. 7), `block_ende_art` (Nr. 6), `block_ende_grund` (Nr. 17),
 * `hx_geraet_markiert` (Zeitpunkt des Schalters). Nach `haltung` folgt je gleichzeitiger Tätigkeit des
 * Kodierschemas eine Spalte `neben_<Code>` (Nr. 19), siehe spaltenBeobachtung(). Bedeutung: docs/CODEBUCH_EXPORT.md.
 */
export const SPALTEN_BEOBACHTUNG = Object.freeze([
  'datensatz', 'block_id', 'geraete_id', 'schema_version', 'app_version', 'pseudonym', 'beobachter',
  'bereich', 'dienst', 'phase', 'arbeitskontext', 'datum', 'block_start', 'block_ende',
  'block_dauer_soll_sek', 'block_beobachtet_sek', 'block_pausen_anzahl', 'block_pausen_sek',
  'block_status', 'block_ende_art', 'block_ende_grund', 'abbruch_code', 'block_kommentar',
  'hx_geraet_dabei', 'hx_geraet_automatisch', 'hx_geraet_markiert',
  'nr', 'start', 'ende', 'dauer_sek', 'taetigkeit', 'ort', 'nutzungsart', 'haltung', 'unvollstaendig',
  'pause_grund', 'pause_freitext', 'kommentar', 'n_zeilen_block',
]);

/** Alle Spalten der Block-CSV für ein Kodierschema: feste Spalten plus `neben_<Code>` nach `haltung`. */
export function spaltenBeobachtung(schema) {
  const i = SPALTEN_BEOBACHTUNG.indexOf('haltung') + 1;
  return [...SPALTEN_BEOBACHTUNG.slice(0, i), ...nebentaetigkeiten(schema).map((c) => `neben_${c}`), ...SPALTEN_BEOBACHTUNG.slice(i)];
}

export const SPALTEN_VERSUCH = Object.freeze([
  'datensatz', 'versuch_id', 'geraete_id', 'schema_version', 'app_version', 'pseudonym', 'beobachter',
  'bereich', 'dienst', 'phase', 'datum', 'zeitpunkt', 'kommentar',
]);

export const SPALTEN_TAG = Object.freeze([
  'datensatz', 'datum', 'bereich', 'auslastung', 'aerzte_anwesend', 'ereignisse', 'beobachter',
  'geraete_id', 'schema_version', 'app_version', 'erfasst',
]);

// ---------------------------------------------------------------------------
// CSV-Grundlagen (RFC 4180 mit Semikolon)
// ---------------------------------------------------------------------------

/** Ein Feld: in Anführungszeichen, wenn es Semikolon, Anführungszeichen oder Zeilenumbruch enthält. */
export function csvFeld(wert) {
  const s = wert === null || wert === undefined ? '' : String(wert);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Vollständiger CSV-Text: UTF-8-BOM, Kopfzeile, Zeilen, jede Zeile mit \r\n abgeschlossen. */
export function csvText(kopf, zeilen) {
  return BOM + [kopf, ...zeilen].map((z) => z.map(csvFeld).join(TRENNER) + ZEILENENDE).join('');
}

/** Nur Buchstaben, Ziffern und Bindestrich in Dateinamen. */
function dateinameTeil(s) {
  return String(s).replace(/[^A-Za-z0-9-]/g, '_');
}

// ---------------------------------------------------------------------------
// Block (Beobachtung)
// ---------------------------------------------------------------------------

/** Präfix der Dateinamen; Probeläufe mit dem Test-Code (z. B. P000) beginnen mit HXNOW_TEST_ (ENTSCHEIDUNGEN Nr. 18). */
function praefix(schema, pseudonym, art) {
  return istTestPseudonym(schema ?? {}, pseudonym) ? `HXNOW_TEST_${art}` : `HXNOW_${art}`;
}

export function dateinameBlock(block, schema = null) {
  const { datum, uhrzeit } = dateinameZeit(block.startTs);
  return `${praefix(schema, block.pseudonym, 'BEOB')}_${dateinameTeil(block.pseudonym)}_${datum}_${uhrzeit}_${block.blockId.slice(0, 8)}.csv`;
}

/**
 * Export-Datei eines beendeten oder abgebrochenen Blocks: eine Zeile je nicht gelöschter Episode und
 * je Pause, chronologisch, laufend nummeriert. Hat ein (abgebrochener) Block weder Episoden noch Pausen,
 * entsteht eine Zeile mit datensatz = "block" und n_zeilen_block = 0.
 * @returns {{ dateiname: string, inhalt: string, typ: string }}
 */
export function blockDatei(zustand, schema) {
  const b = zustand.block;
  if (b.endTs === null || b.status === 'laufend' || b.status === 'pausiert') throw new Error('Der Block läuft noch und kann nicht exportiert werden.');
  if (b.status === 'verworfen') throw new Error('Verworfene Blöcke werden nicht exportiert.');

  const zl = zeitleiste(zustand);
  const eps = zl.filter((x) => x.art === 'episode');
  const pausen = zl.filter((x) => x.art === 'pause');
  const post = mitGeraetDabei(zustand, schema);
  // Zeitstempel auf der gerundeten Uhr (Blockstart sekundengenau + gerundete Sekunden), damit in jeder Zeile
  // ende − start = dauer_sek gilt (ENTSCHEIDUNGEN Nr. 15). Rohdaten mit Millisekunden: IndexedDB/JSON-Sicherung.
  const basis = b.startTs - (b.startTs % 1000);
  const zeit = (sek) => isoMitOffset(basis + sek * 1000);
  const blockFelder = [
    b.blockId, b.geraeteId, b.schemaVersion, b.appVersion, b.pseudonym, b.beobachter,
    b.bereich, b.dienst, b.phase, b.arbeitskontext ?? '', datumLokal(b.startTs), zeit(0), zeit(blockEndeSek(zustand)),
    geplanteDauerSek(b, schema),
    eps.reduce((s, e) => s + e.dauerSek, 0), // beobachtete Zeit = Summe der Episoden (exakt konsistent)
    pausen.length,
    pausen.reduce((s, p) => s + p.dauerSek, 0),
    b.status, b.endeArt ?? '', b.endeGrund ?? '', b.abbruchCode ?? '', b.kommentar ?? '',
    post ? (b.hxGeraetDabei ?? '') : '',
    b.hxGeraetAutomatisch ? 1 : 0,
    post && b.hxGeraetMarkiertTs !== null && b.hxGeraetMarkiertTs !== undefined ? isoMitOffset(b.hxGeraetMarkiertTs) : '',
  ];
  const spalten = spaltenBeobachtung(schema);
  const neben = nebentaetigkeiten(schema);
  const leerZeile = Array(spalten.length - blockFelder.length - 2).fill('');
  const zeilen = zl.length === 0
    ? [['block', ...blockFelder, ...leerZeile, 0]]
    : zl.map((x, i) => [
      x.art, ...blockFelder,
      i + 1, zeit(x.startSek), zeit(x.endeSek), x.dauerSek,
      ...(x.art === 'episode'
        ? [x.taetigkeit, x.ort, x.nutzungsart ?? '', x.haltung ?? '', ...neben.map((c) => ((x.neben ?? []).includes(c) ? 1 : 0)),
          x.unvollstaendig ? 1 : 0, '', '', x.kommentar ?? '']
        : ['', '', '', '', ...neben.map(() => ''), '', x.grund ?? '', x.freitext ?? '', '']),
      zl.length,
    ]);
  return { dateiname: dateinameBlock(b, schema), inhalt: csvText(spalten, zeilen), typ: 'text/csv' };
}

// ---------------------------------------------------------------------------
// Versuch („nicht angetroffen“) und Tageskennzahlen
// ---------------------------------------------------------------------------

export function versuchDatei(v, schema = null) {
  const { datum, uhrzeit } = dateinameZeit(v.ts);
  const zeile = [
    'versuch', v.versuchId, v.geraeteId, v.schemaVersion ?? '', v.appVersion ?? '', v.pseudonym, v.beobachter,
    v.bereich, v.dienst, v.phase, datumLokal(v.ts), isoMitOffset(v.ts), v.kommentar ?? '',
  ];
  return {
    dateiname: `${praefix(schema, v.pseudonym, 'VERSUCH')}_${dateinameTeil(v.pseudonym)}_${datum}_${uhrzeit}_${v.versuchId.slice(0, 8)}.csv`,
    inhalt: csvText(SPALTEN_VERSUCH, [zeile]),
    typ: 'text/csv',
  };
}

export function tagDatei(t) {
  const { uhrzeit } = dateinameZeit(t.ts);
  const zeile = [
    'tageskennzahlen', t.datum, t.bereich, t.auslastung, t.aerzteAnwesend, t.ereignisse ?? '', t.beobachter,
    t.geraeteId ?? '', t.schemaVersion ?? '', t.appVersion ?? '', isoMitOffset(t.ts),
  ];
  return {
    dateiname: `HXNOW_TAG_${dateinameTeil(t.bereich)}_${t.datum.replace(/-/g, '')}_${uhrzeit}.csv`,
    inhalt: csvText(SPALTEN_TAG, [zeile]),
    typ: 'text/csv',
  };
}

// ---------------------------------------------------------------------------
// Exportwege
// ---------------------------------------------------------------------------

/** Maximale Länge einer mailto-URL (Abschnitt 7.4). */
export const MAILTO_MAX = 8000;

/**
 * Weg 1: Teilen-Menü. MUSS synchron aus einer Nutzergeste aufgerufen werden (kein `await` davor).
 * @returns {Promise<'geteilt'|'abgebrochen'>|null} null, wenn Teilen von Dateien nicht möglich ist.
 */
export function versucheTeilen(datei, nav = globalThis.navigator) {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function' || typeof File !== 'function') return null;
  const file = new File([datei.inhalt], datei.dateiname, { type: datei.typ });
  let moeglich = false;
  try { moeglich = nav.canShare({ files: [file] }); } catch { moeglich = false; }
  if (!moeglich) return null;
  return nav.share({ files: [file], title: datei.dateiname })
    .then(() => 'geteilt', (e) => (e && e.name === 'AbortError' ? 'abgebrochen' : Promise.reject(e)));
}

/** Weg 2: Download über Blob-URL und <a download>. */
export function ladeHerunter(datei, doc = globalThis.document) {
  const blob = new Blob([datei.inhalt], { type: datei.typ });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = datei.dateiname;
  a.rel = 'noopener';
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Textinhalt ohne BOM (für Mail und Zwischenablage). */
export function textOhneBom(datei) {
  return datei.inhalt.startsWith(BOM) ? datei.inhalt.slice(1) : datei.inhalt;
}

/**
 * Weg 3: mailto-URL an den konfigurierten Empfänger.
 * @returns {{ url: string|null, grund?: 'kein-empfaenger'|'zu-lang', laenge?: number }}
 */
export function mailtoUrl(datei, schema) {
  const empfaenger = (schema.export?.mailEmpfaenger ?? '').trim();
  if (!empfaenger) return { url: null, grund: 'kein-empfaenger' };
  const betreff = `${schema.export.mailBetreffPraefix} ${datei.dateiname}`;
  const url = `mailto:${encodeURIComponent(empfaenger).replace(/%40/g, '@')}`
    + `?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(textOhneBom(datei))}`;
  if (url.length > MAILTO_MAX) return { url: null, grund: 'zu-lang', laenge: url.length };
  return { url };
}

/** Weg 4: Zwischenablage. Fällt ohne Clipboard-API (z. B. http im lokalen Netz) auf execCommand zurück. */
export async function kopiereInZwischenablage(datei, nav = globalThis.navigator, doc = globalThis.document) {
  const text = textOhneBom(datei);
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text);
      return true;
    } catch { /* Ersatzweg unten */ }
  }
  const feld = doc.createElement('textarea');
  feld.value = text;
  feld.setAttribute('readonly', '');
  feld.className = 'unsichtbar';
  doc.body.append(feld);
  feld.select();
  let ok = false;
  try { ok = doc.execCommand('copy'); } catch { ok = false; }
  feld.remove();
  return ok;
}
