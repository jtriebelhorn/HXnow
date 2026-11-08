// Startseite (Spezifikation 7.1): Neuer Block, Person nicht angetroffen, Tageskennzahlen,
// Liste nicht abgeschlossener Exporte mit Exportieren / Eingang bestätigt und Warnbanner (> 24 h nicht bestätigt).
import { el, ersetze, bestaetige } from './dom.js';
import * as db from '../db.js';
import { stelleWiederHer } from '../block.js';
import { blockDatei, versuchDatei, tagDatei } from '../export.js';
import { uhrzeit, datumLokal, formatiereCountdown } from '../zeit.js';
import { exportiere, andereWege, bestaetigeEingang, sichereLogbuch } from './exportieren.js';
import { updateHinweis, updateSuche, aktualisiertHinweis } from './update.js';
import { istTestPseudonym } from '../schema.js';
import { fbExportDatei, brecheFbAb, BOGEN_NAME } from './fragebogen.js';

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
  const antwortenJe = Map.groupBy(daten.fb_antworten, (a) => a.sitzungId);
  const laufendeFb = daten.fb_sitzungen.filter((s) => s.status === 'laufend');
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
    ...daten.fb_sitzungen.filter((s) => offen(s) && s.status === 'abgeschlossen').map((s) => ({
      art: s.testmodus ? 'Fragebogen · Probelauf' : 'Fragebogen', ts: s.endTs ?? s.angelegtTs, test: 'eintrag-fb',
      titel: `${s.pseudonym} · ${BOGEN_NAME[s.bogen]} · ${datumLokal(s.angelegtTs)} ${uhrzeit(s.angelegtTs).slice(0, 5)}`,
      details: s.erhebungsmodus === 'PAPIER' ? 'Papier' : '', exportStatus: s.exportStatus,
      datei: fbExportDatei(app, s, Object.fromEntries((antwortenJe.get(s.sitzungId) ?? []).map((a) => [a.itemId, a]))),
      ziel: { store: db.STORES.FB_SITZUNGEN, schluessel: s.sitzungId, nachher: neuZeichnen },
      oeffnen: () => app.zeige('fbStatus', { sitzungId: s.sitzungId }),
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

  // Sicherung (PLAN_Logbuch_Datensicherheit 4.1): Sitzungen ohne Export sind nicht gesichert.
  const ungesichert = nichtGesichert(app);
  const aeltesteUngesichert = Math.min(...ungesichert.map((l) => l.endTs ?? l.startTs));
  const letzte = app.meta?.letzteSicherungTs ?? null;
  // Leere Datenbank (z. B. nach Löschen des App-Symbols): Sicherung laden anbieten (PLAN_Logbuch_Datensicherheit 4.5)
  const leer = ['bloecke', 'versuche', 'tageskennzahlen', 'fb_sitzungen', 'teilnehmende', 'logbuch'].every((n) => daten[n].length === 0)
    && !app.meta?.neuBegonnenTs;
  const stillgelegt = Boolean(app.meta?.stillgelegt);

  ersetze(app.wurzel,
    el('header', { class: 'kopf-start' },
      el('h1', {}, 'HX Now Beobachtung'),
      el('div', { class: 'kopf-menue' },
        el('button', { type: 'button', class: 'klein', 'data-test': 'menue-sicherung', onclick: () => app.zeige('sicherung') }, 'Sicherung'),
        el('button', { type: 'button', class: 'klein', 'data-test': 'menue-info', onclick: () => app.zeige('info') }, 'Info'))),
    updateHinweis(app),
    aktualisiertHinweis(app),
    stillgelegt ? el('div', { class: 'banner-rot', role: 'alert', 'data-test': 'banner-stillgelegt' },
      'Dieses Gerät ist stillgelegt – keine neuen Erhebungen. Daten bleiben exportierbar (Aufheben unter „Sicherung“).') : null,
    leer ? el('div', { class: 'banner-info', 'data-test': 'banner-leer' },
      el('p', {}, 'Keine Studiendaten gefunden. Letzte Sicherung laden?'),
      el('div', { class: 'knopfreihe' },
        el('button', { type: 'button', class: 'primaer', 'data-test': 'leer-laden', onclick: () => app.zeige('sicherung') }, 'Sicherung laden'),
        el('button', { type: 'button', 'data-test': 'leer-neu', onclick: () => neuBeginnen(app) }, 'Neu beginnen'))) : null,
    ungesichert.length > 0
      ? el('div', {
        class: Date.now() - aeltesteUngesichert > TAG_MS ? 'banner-rot' : 'banner-gelb', role: 'alert', 'data-test': 'banner-nicht-gesichert',
      }, `${ungesichert.length} ${ungesichert.length === 1 ? 'Sitzung ist' : 'Sitzungen sind'} nicht gesichert`
        + `${Date.now() - aeltesteUngesichert > TAG_MS ? ' – seit über 24 Stunden' : ''}. Bitte exportieren.`)
      : null,
    alt.length > 0
      ? el('div', { class: 'banner-rot', role: 'alert', 'data-test': 'banner-24h' },
        `${alt.length} ${alt.length === 1 ? 'Eintrag ist' : 'Einträge sind'} seit über 24 Stunden nicht bestätigt. Bitte exportieren und Eingang bestätigen.`)
      : null,
    el('div', { class: 'stapel' },
      el('button', { type: 'button', class: 'primaer gross', 'data-test': 'neuer-block', disabled: stillgelegt, onclick: () => app.zeige('blockNeu') }, 'Neuer Block'),
      el('button', { type: 'button', class: 'gross', 'data-test': 'neuer-fragebogen', disabled: stillgelegt, onclick: () => app.zeige('fbNeu') }, 'Fragebogen'),
      el('button', { type: 'button', class: 'gross', 'data-test': 'nicht-angetroffen', disabled: stillgelegt, onclick: () => app.zeige('versuch') }, 'Person nicht angetroffen'),
      el('button', { type: 'button', class: 'gross', 'data-test': 'tageskennzahlen', onclick: () => app.zeige('tageskennzahlen') }, 'Tageskennzahlen'),
    ),
    el('div', { class: 'sicherung-zeile', 'data-test': 'sicherung-zeile' },
      el('span', { 'data-test': 'letzte-sicherung' }, letzte ? `Letzte Sicherung: ${datumDe(letzte)} ${uhrzeit(letzte).slice(0, 5)}` : 'Noch keine Sicherung'),
      // synchron: die Logbuch-Datei liegt im Speicher (app.logbuchDaten)
      el('button', { type: 'button', class: 'klein', 'data-test': 'logbuch-sichern', onclick: () => sichereLogbuch(app) }, 'Logbuch sichern')),
    laufendeFb.length === 0 ? null : el('section', { 'data-test': 'offene-fragebogen' },
      el('h2', {}, 'Nicht abgeschlossene Fragebögen'),
      el('ul', { class: 'liste' }, laufendeFb.map((s) => el('li', { 'data-test': 'eintrag-fb-offen' },
        el('div', { class: 'liste-text' },
          el('span', { class: 'liste-art' }, BOGEN_NAME[s.bogen]),
          el('span', { class: 'liste-titel' }, `${s.pseudonym} · begonnen ${datumLokal(s.angelegtTs)} ${uhrzeit(s.angelegtTs).slice(0, 5)}`)),
        el('div', { class: 'liste-knoepfe' },
          el('button', { type: 'button', class: 'primaer', 'data-test': 'fb-fortsetzen', onclick: () => app.zeige(s.startTs ? 'fbAusfuellen' : 'fbUebergabe', { sitzungId: s.sitzungId }) }, 'Fortsetzen'),
          el('button', { type: 'button', class: 'gefahr', 'data-test': 'fb-abbrechen', onclick: () => brecheFbAb(app, s) }, 'Abbrechen')))))),
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
    updateSuche(app, { klein: true }),
  );
}

/** „Neu beginnen“ trotz leerer Datenbank: doppelte Rückfrage, damit niemand versehentlich ohne Sicherung weitermacht. */
async function neuBeginnen(app) {
  if (!(await bestaetige('Ohne Sicherung beginnen?', 'Wenn auf diesem Gerät schon Studiendaten erfasst wurden, zuerst die letzte Sicherung laden.', { ja: 'Weiter', nein: 'Zurück' }))) return;
  if (!(await bestaetige('Wirklich neu beginnen?', 'Es gibt hier keine früheren Daten. Neu beginnen nur beim ersten Einsatz dieses Geräts oder nach Rücksprache.', { ja: 'Neu beginnen', nein: 'Zurück', gefahr: true }))) return;
  const ts = Date.now();
  await db.setzeMeta(app.db, 'neuBegonnenTs', ts);
  app.meta.neuBegonnenTs = ts;
  app.zeige('start');
}

/** Abgeschlossene Sitzungen (außer Probeläufen), deren Datei noch nicht exportiert wurde. */
export function nichtGesichert(app) {
  const fertig = ['beendet', 'abgebrochen', 'nicht_angetroffen', 'abgeschlossen'];
  return (app.logbuchDaten?.logbuch ?? []).filter((l) => !l.testmodus && l.exportStatus === 'offen' && fertig.includes(l.status));
}

const datumDe = (ts) => datumLokal(ts).split('-').reverse().join('.');

function phase(schema, code) {
  return schema.phasen.find((p) => p.code === code)?.label ?? code;
}

function bereich(schema, code) {
  return schema.bereiche.find((b) => b.code === code)?.label ?? code;
}
