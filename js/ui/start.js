// Startseite (Spezifikation 7.1): Neuer Block, Person nicht angetroffen, Tageskennzahlen,
// Liste nicht abgeschlossener Exporte mit Exportieren / Eingang bestätigt und Warnbanner (> 24 h nicht bestätigt).
import { el, ersetze } from './dom.js';
import * as db from '../db.js';
import { stelleWiederHer } from '../block.js';
import { blockDatei, versuchDatei, tagDatei } from '../export.js';
import { uhrzeit, datumLokal, formatiereCountdown } from '../zeit.js';
import { exportiere, andereWege, bestaetigeEingang } from './exportieren.js';
import { updateHinweis } from './update.js';
import { istTestPseudonym } from '../schema.js';

const TAG_MS = 24 * 3600 * 1000;

const EXPORT_TEXT = { offen: 'nicht exportiert', exportiert: 'exportiert, Eingang nicht bestätigt' };
const STATUS_TEXT = { beendet: 'beendet', abgebrochen: 'abgebrochen' };

export async function zeigeStart(app) {
  const { schema } = app;
  const daten = await db.holeAlleDaten(app.db);
  const episodenJeBlock = new Map();
  for (const e of daten.episoden) {
    if (!episodenJeBlock.has(e.blockId)) episodenJeBlock.set(e.blockId, []);
    episodenJeBlock.get(e.blockId).push(e);
  }

  const offen = (x) => x.exportStatus !== 'bestaetigt';
  const neuZeichnen = () => app.zeige('start');

  // Exportdateien werden hier vorbereitet, damit der Klick auf „Exportieren“ synchron teilen kann.
  const eintraege = [
    ...daten.bloecke.filter((b) => offen(b) && (b.status === 'beendet' || b.status === 'abgebrochen')).map((b) => ({
      art: istTestPseudonym(schema, b.pseudonym) ? 'Block · Probelauf' : 'Block', ts: b.endTs ?? b.startTs, test: 'eintrag-block',
      titel: `${b.pseudonym} · ${phase(schema, b.phase)} · ${datumLokal(b.startTs)} ${uhrzeit(b.startTs).slice(0, 5)}`,
      details: `${STATUS_TEXT[b.status]}${b.abbruchCode ? ` (${b.abbruchCode})` : ''}, ${formatiereCountdown((b.endTs ?? b.startTs) - b.startTs)} min`,
      exportStatus: b.exportStatus,
      datei: blockDatei(stelleWiederHer(b, episodenJeBlock.get(b.blockId) ?? []), schema),
      ziel: { store: db.STORES.BLOECKE, schluessel: b.blockId, nachher: neuZeichnen },
      oeffnen: () => app.zeige('abschluss', { blockId: b.blockId }),
    })),
    ...daten.versuche.filter(offen).map((v) => ({
      art: istTestPseudonym(schema, v.pseudonym) ? 'Nicht angetroffen · Probelauf' : 'Nicht angetroffen', ts: v.ts, test: 'eintrag-versuch',
      titel: `${v.pseudonym} · ${phase(schema, v.phase)} · ${datumLokal(v.ts)} ${uhrzeit(v.ts).slice(0, 5)}`,
      details: '', exportStatus: v.exportStatus,
      datei: versuchDatei(v, schema),
      ziel: { store: db.STORES.VERSUCHE, schluessel: v.versuchId, nachher: neuZeichnen },
    })),
    ...daten.tageskennzahlen.filter(offen).map((k) => ({
      art: 'Tageskennzahlen', ts: k.ts, test: 'eintrag-tag',
      titel: `${k.datum} · ${bereich(schema, k.bereich)}`,
      details: '', exportStatus: k.exportStatus,
      datei: tagDatei(k),
      ziel: { store: db.STORES.TAGESKENNZAHLEN, schluessel: [k.datum, k.bereich], nachher: neuZeichnen },
      oeffnen: () => app.zeige('tageskennzahlen', { datum: k.datum, bereich: k.bereich }),
    })),
  ].sort((a, b) => b.ts - a.ts);

  const alt = eintraege.filter((e) => Date.now() - e.ts > TAG_MS);

  ersetze(app.wurzel,
    el('header', { class: 'kopf-start' },
      el('h1', {}, 'HX Now Beobachtung'),
      el('div', { class: 'kopf-menue' },
        el('button', { type: 'button', class: 'klein', 'data-test': 'menue-sicherung', onclick: () => app.zeige('sicherung') }, 'Sicherung'),
        el('button', { type: 'button', class: 'klein', 'data-test': 'menue-info', onclick: () => app.zeige('info') }, 'Info'))),
    updateHinweis(app),
    alt.length > 0
      ? el('div', { class: 'banner-rot', role: 'alert', 'data-test': 'banner-24h' },
        `${alt.length} ${alt.length === 1 ? 'Eintrag ist' : 'Einträge sind'} seit über 24 Stunden nicht bestätigt. Bitte exportieren und Eingang bestätigen.`)
      : null,
    el('div', { class: 'stapel' },
      el('button', { type: 'button', class: 'primaer gross', 'data-test': 'neuer-block', onclick: () => app.zeige('blockNeu') }, 'Neuer Block'),
      el('button', { type: 'button', class: 'gross', 'data-test': 'nicht-angetroffen', onclick: () => app.zeige('versuch') }, 'Person nicht angetroffen'),
      el('button', { type: 'button', class: 'gross', 'data-test': 'tageskennzahlen', onclick: () => app.zeige('tageskennzahlen') }, 'Tageskennzahlen'),
    ),
    el('h2', {}, 'Nicht abgeschlossene Exporte'),
    eintraege.length === 0
      ? el('p', { class: 'hinweis', 'data-test': 'keine-offenen' }, 'Keine offenen Einträge.')
      : el('ul', { class: 'liste', 'data-test': 'offene-liste' }, eintraege.map((e) =>
        el('li', { 'data-test': e.test, 'data-export': e.exportStatus },
          el('div', { class: 'liste-text' },
            el('span', { class: 'liste-art' }, e.art),
            el('span', { class: 'liste-titel' }, e.titel),
            el('span', { class: `liste-details export-${e.exportStatus}` }, [e.details, EXPORT_TEXT[e.exportStatus]].filter(Boolean).join(' · '))),
          el('div', { class: 'liste-knoepfe' },
            // Kein async/await vor exportiere(): Teilen muss direkt aus der Geste erfolgen.
            el('button', { type: 'button', class: 'primaer', 'data-test': 'exportieren', onclick: () => exportiere(app, e.datei, e.ziel) }, 'Exportieren'),
            el('button', { type: 'button', 'data-test': 'andere-wege', onclick: () => andereWege(app, e.datei, e.ziel) }, 'Andere Wege'),
            el('button', {
              type: 'button', 'data-test': 'bestaetigen', disabled: e.exportStatus !== 'exportiert',
              onclick: () => bestaetigeEingang(app, e.ziel),
            }, 'Eingang bestätigt'),
            e.oeffnen ? el('button', { type: 'button', 'data-test': 'oeffnen', onclick: e.oeffnen }, 'Öffnen') : null)))),
    el('p', { class: 'info', 'data-test': 'info' },
      `${schema.studie} · App-Version ${app.appVersion} · Schema-Version ${schema.schemaVersion}`),
  );
}

function phase(schema, code) {
  return schema.phasen.find((p) => p.code === code)?.label ?? code;
}

function bereich(schema, code) {
  return schema.bereiche.find((b) => b.code === code)?.label ?? code;
}
