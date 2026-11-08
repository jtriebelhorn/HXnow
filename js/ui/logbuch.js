// Logbuch-Ansichten (PLAN_Logbuch_Datensicherheit 9, Fragebogenplan 2a): Studienübersicht mit Fällig-Liste,
// Probandentabelle und Verteilung, Detailansicht Proband mit Phasenkarten, Eintragsansicht, Teilnehmerliste mit
// CSV-Export/-Import, Studienplan (Phasenplan je Bereich, Exportordner).
//
// Grundsatz: Das Logbuch zeigt Umfang und Vollständigkeit der Erhebung, nie Inhalte je Person (keine
// Tätigkeitsanteile, keine HX-Now-Nutzung je Arzt, keine Fragebogenantworten). Grundlage ist app.logbuchDaten
// (vor jeder Ansicht neu gelesen) mit angewendeten Änderungen.
import { el, ersetze, meldung } from './dom.js';
import * as db from '../db.js';
import { csvText } from '../export.js';
import { leseCsv } from '../csvlesen.js';
import { datumLokal, uhrzeit, dateinameZeit } from '../zeit.js';
import { PHASEN, probandenUebersicht, faelligListe, verteilung, bereichsStand } from '../studienstand.js';
import { wirksamerStand, probandVerlauf, neueAenderung, ART, UNGUELTIG_GRUENDE } from '../aenderungen.js';
import { exportiere, sichereLogbuch } from './exportieren.js';
import { nichtGesichert } from './start.js';
import { aenderungsKnoepfe, eintragKnoepfe, probandKnoepfe, schuetze, aenderungsKontext } from './aendern.js';

export const ZIEL_STANDARD = 5;
export const ziel = (schema) => schema.zielBloeckeProPhase ?? ZIEL_STANDARD;

const DATUM_FELDER = [
  ['baselineStart', 'Beginn Baseline'], ['einfuehrungStart', 'Beginn Einführung'], ['regelbetriebStart', 'Beginn Regelbetrieb'],
  ['abschlussStart', 'Beginn Abschluss'], ['ende', 'Ende'],
];
const ART_NAME = { BLOCK: 'Block', VERSUCH: 'Nicht angetroffen', FB1: 'Fragebogen 1', KB: 'Kurzbogen', FB2: 'Fragebogen 2' };
const STATUS_NAME = { beendet: 'beendet', abgebrochen: 'abgebrochen', nicht_angetroffen: 'nicht angetroffen', abgeschlossen: 'abgeschlossen', laufend: 'läuft', pausiert: 'pausiert', verworfen: 'verworfen' };
const EXPORT_NAME = { offen: 'nicht exportiert', exportiert: 'exportiert', bestaetigt: 'Eingang bestätigt' };

const datumDe = (ts) => (ts ? datumLokal(ts).split('-').reverse().join('.') : '–');
const zeitDe = (ts) => (ts ? `${datumDe(ts)} ${uhrzeit(ts).slice(0, 5)}` : '–');
const tagDe = (iso) => (iso ? iso.split('-').reverse().join('.') : '–');
const daten = (app) => app.logbuchDaten ?? { teilnehmende: [], phasenplan: [], logbuch: [], aenderungen: [] };
const bereichName = (app, code) => app.schema.bereiche.find((b) => b.code === code)?.label ?? code ?? '–';

function zurueck(app, ziel = 'start', params = {}) {
  return el('button', { type: 'button', class: 'gross abstand-oben', 'data-test': 'zurueck', onclick: () => app.zeige(ziel, params) }, 'Zurück');
}

// ============================================================================ Studienübersicht
export function zeigeStudie(app) {
  const d = daten(app);
  const jetzt = Date.now();
  const uebersicht = probandenUebersicht(d, { ziel: ziel(app.schema), jetzt });
  const faellig = faelligListe(uebersicht, { nichtGesichert: nichtGesichert(app).length });
  const vert = verteilung(d.logbuch, d.aenderungen);
  const stand = bereichsStand(d.phasenplan, jetzt);

  ersetze(app.wurzel,
    el('h1', {}, 'Studie'),
    el('p', { class: 'hinweis' }, 'Umfang und Vollständigkeit der Erhebung – keine Inhalte je Person.'),
    stand.length === 0
      ? el('p', { class: 'warnkasten', 'data-test': 'kein-phasenplan' }, 'Noch kein Phasenplan – unter „Studienplan“ eintragen.')
      : el('ul', { class: 'liste-kurz', 'data-test': 'bereichsstand' }, stand.map((s) => el('li', {}, el('strong', {}, bereichName(app, s.bereich)), `: ${s.text}`))),

    el('h2', {}, 'Fällig'),
    faellig.length === 0
      ? el('p', { class: 'hinweis', 'data-test': 'nichts-faellig' }, 'Nichts fällig.')
      : el('ul', { class: 'liste-kurz faellig', 'data-test': 'faellig' }, faellig.map((f) => el('li', {
        class: f.pseudonym ? 'klickbar' : null, onclick: f.pseudonym ? () => app.zeige('proband', { pseudonym: f.pseudonym }) : null,
      }, f.text))),

    el('h2', {}, `Probanden (${uebersicht.length})`),
    uebersicht.length === 0 ? el('p', { class: 'hinweis' }, 'Noch keine Probanden in der Teilnehmerliste.') : el('div', { class: 'tabelle-rahmen' },
      el('table', { class: 'tabelle probanden', 'data-test': 'probanden' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Code'), ...PHASEN.map((p) => el('th', {}, p.kurz)), el('th', { class: 'zahl', title: 'nicht exportierte Sitzungen' }, 'Exp.'))),
        el('tbody', {}, uebersicht.map((u) => el('tr', {
          class: `klickbar ampel-${u.t.status === 'aktiv' ? u.ampel : 'grau'}`, 'data-test': `proband-${u.t.pseudonym}`,
          onclick: () => app.zeige('proband', { pseudonym: u.t.pseudonym }),
        },
        el('td', {}, el('strong', {}, u.t.pseudonym), u.t.status !== 'aktiv' ? el('div', { class: 'klein-text' }, u.t.status) : null),
        ...PHASEN.map((p) => {
          const x = u.phasen[p.id];
          return el('td', { class: `ampel-zelle-${x.ampel}` },
            x.ziel ? `${x.bloecke}/${x.ziel}` : '', x.ziel ? el('br') : null,
            el('span', { class: 'klein-text' }, `${p.bogen} ${x.bogen ? '✓' : '–'}`));
        }),
        el('td', { class: 'zahl' }, u.offeneExporte ? String(u.offeneExporte) : '✓')))))),

    el('h2', {}, 'Verteilung der Blöcke'),
    el('p', { class: 'hinweis' }, 'Über alle Probanden, gültige Blöcke ohne Probeläufe.'),
    ['PRE', 'POST'].map((ph) => el('section', { class: 'verteilung', 'data-test': `verteilung-${ph}` },
      el('h3', {}, `${app.schema.phasen.find((p) => p.code === ph)?.label ?? ph} (${vert[ph].anzahl})`),
      balken('Arbeitskontext', vert[ph].kontext, vert[ph].anzahl, (k) => app.schema.arbeitskontext.find((x) => x.code === k)?.label ?? k),
      balken('Dienst', vert[ph].dienst, vert[ph].anzahl, (k) => app.schema.dienste.find((x) => x.code === k)?.label ?? k),
      balken('Tageszeit', vert[ph].tageszeit, vert[ph].anzahl, (k) => k))),

    el('div', { class: 'stapel abstand-oben' },
      el('button', { type: 'button', class: 'gross', 'data-test': 'zu-teilnehmenden', onclick: () => app.zeige('teilnehmende') }, 'Teilnehmerliste'),
      el('button', { type: 'button', class: 'gross', 'data-test': 'zu-studienplan', onclick: () => app.zeige('studienplan') }, 'Studienplan (Phasen, Exportordner)'),
      el('button', { type: 'button', class: 'gross', 'data-test': 'logbuch-sichern', onclick: () => sichereLogbuch(app, () => app.zeige('studie')) }, 'Logbuch sichern')),
    zurueck(app));
}

function balken(titel, werte, gesamt, label) {
  const eintraege = Object.entries(werte).sort((a, b) => b[1] - a[1]);
  return el('div', { class: 'balken-gruppe' },
    el('div', { class: 'balken-titel' }, titel),
    eintraege.length === 0 ? el('div', { class: 'klein-text' }, '–') : eintraege.map(([k, n]) => el('div', { class: 'balken-zeile' },
      el('span', { class: 'balken-label' }, label(k)),
      el('span', { class: 'balken-spur' }, el('span', { class: `balken-wert breite-${Math.round((n / Math.max(1, gesamt)) * 20) * 5}` })),
      el('span', { class: 'balken-zahl' }, String(n)))));
}

// ============================================================================ Proband
export function zeigeProband(app, { pseudonym }) {
  const d = daten(app);
  const u = probandenUebersicht({ ...d, teilnehmende: d.teilnehmende.filter((t) => t.pseudonym === pseudonym) }, { ziel: ziel(app.schema), jetzt: Date.now() })[0];
  if (!u) { app.zeige('studie'); return; }
  const { t } = u;
  const pv = probandVerlauf(pseudonym, d.aenderungen);
  ersetze(app.wurzel,
    el('h1', { 'data-test': 'proband-code' }, t.pseudonym),
    t.status === 'widerrufen' ? el('div', { class: 'banner-rot', 'data-test': 'proband-widerrufen' }, 'Widerrufen – alle Daten gelöscht. Neue Erfassungen mit diesem Code sind nicht möglich.') : null,
    el('dl', { class: 'eckdaten', 'data-test': 'proband-eckdaten' },
      el('dt', {}, 'Bereich'), el('dd', {}, bereichName(app, t.bereich)),
      el('dt', {}, 'Status'), el('dd', { 'data-test': 'proband-status' }, `${t.status}${t.statusTs ? ` (seit ${datumDe(t.statusTs)})` : ''}`),
      el('dt', {}, 'Aufgenommen'), el('dd', {}, datumDe(t.registriertTs)),
      t.notiz ? el('dt', {}, 'Notiz') : null, t.notiz ? el('dd', {}, t.notiz) : null,
      el('dt', {}, 'Nicht gesichert'), el('dd', {}, u.offeneExporte ? `${u.offeneExporte} ${u.offeneExporte === 1 ? 'Sitzung' : 'Sitzungen'}` : 'alles exportiert')),
    probandKnoepfe(app, t, u),
    PHASEN.map((p) => phasenKarte(app, p, u.phasen[p.id], u.daten, t)),
    kommentarListe(pv.kommentare),
    el('h2', {}, `Einträge (${u.eintraege.length})`),
    u.eintraege.length === 0 ? el('p', { class: 'hinweis' }, 'Noch keine Einträge.') : el('ul', { class: 'liste', 'data-test': 'proband-eintraege' },
      u.eintraege.map((e) => el('li', { class: `klickbar${e.gueltig ? '' : ' ungueltig'}`, 'data-test': `eintrag-${e.eintragId}`, onclick: () => app.zeige('eintrag', { eintragId: e.eintragId }) },
        el('div', { class: 'liste-text' },
          el('span', { class: 'liste-art' }, `${ART_NAME[e.art] ?? e.art}${e.phase ? ` · ${e.phase}` : ''}${e.gueltig ? '' : ' · ungültig'}${e.wiederhergestellt ? ' · wiederhergestellt' : ''}`),
          el('span', { class: 'liste-titel' }, zeitDe(e.startTs)),
          el('span', { class: 'liste-details' }, [STATUS_NAME[e.status] ?? e.status, EXPORT_NAME[e.exportStatus], e.kommentare.some((k) => !k.zurueckgezogen) ? 'Kommentar' : null].filter(Boolean).join(' · ')))))),
    pv.verlauf.length ? verlaufListe(pv.verlauf) : null,
    zurueck(app, 'studie'));
}

function phasenKarte(app, p, x, daten, t) {
  const geplant = daten[p.von] ? `${tagDe(daten[p.von])} – ${p.bis === 'ende' ? tagDe(daten.ende) : tagDe(daten[p.bis])}` : 'nicht geplant';
  const abweichend = t.phasenAbweichung && (t.phasenAbweichung[p.von] || (p.bis !== 'ende' && t.phasenAbweichung[p.bis]));
  return el('section', { class: `phasen-karte ampel-rand-${t.status === 'aktiv' ? x.ampel : 'grau'}`, 'data-test': `phase-${p.id}` },
    el('h3', {}, p.name, x.laeuft ? el('span', { class: 'marke' }, 'läuft') : null),
    el('dl', { class: 'eckdaten' },
      el('dt', {}, 'Geplant'), el('dd', {}, geplant, abweichend ? ' (individuell)' : ''),
      x.restTage !== null && x.laeuft ? el('dt', {}, 'Rest') : null, x.restTage !== null && x.laeuft ? el('dd', {}, `${x.restTage} ${x.restTage === 1 ? 'Tag' : 'Tage'}`) : null,
      x.tatsaechlich ? el('dt', {}, 'Tatsächlich') : null,
      x.tatsaechlich ? el('dd', {}, `${datumDe(x.tatsaechlich.von)} – ${datumDe(x.tatsaechlich.bis)} (${x.tatsaechlich.tage} ${x.tatsaechlich.tage === 1 ? 'Tag' : 'Tage'})`) : null,
      x.ziel ? el('dt', {}, 'Blöcke') : null,
      x.ziel ? el('dd', { 'data-test': `bloecke-${p.id}` }, `${x.bloecke} von ${x.ziel}${x.ungueltig ? ` (+${x.ungueltig} ungültig)` : ''}`) : null,
      x.ziel ? el('dt', {}, 'Beobachtet') : null, x.ziel ? el('dd', {}, `${x.minuten} min`) : null,
      x.pausen ? el('dt', {}, 'Pausen') : null, x.pausen ? el('dd', {}, `${x.pausen} (${Math.round(x.pausenSek / 60)} min)`) : null,
      x.abbrueche.length ? el('dt', {}, 'Abbrüche') : null, x.abbrueche.length ? el('dd', {}, x.abbrueche.map((c) => c ?? '–').join(', ')) : null,
      x.versuche ? el('dt', {}, 'Nicht angetroffen') : null, x.versuche ? el('dd', {}, String(x.versuche)) : null,
      el('dt', {}, p.bogen), el('dd', { 'data-test': `bogen-${p.id}` }, x.bogen ? `abgeschlossen ${datumDe(x.bogen.startTs)}${x.bogen.erhebungsmodus === 'PAPIER' ? ' (Papier)' : ''}` : 'offen')));
}

function kommentarListe(kommentare) {
  const sichtbar = kommentare.filter((k) => !k.zurueckgezogen);
  if (!kommentare.length) return null;
  return el('section', { 'data-test': 'kommentare' },
    el('h2', {}, `Kommentare (${sichtbar.length})`),
    el('ul', { class: 'liste-kurz' }, kommentare.map((k) => el('li', { class: k.zurueckgezogen ? 'zurueckgezogen' : null },
      el('span', { class: 'klein-text' }, `${zeitDe(k.ts)}${k.zurueckgezogen ? ' · zurückgezogen' : ''}: `), k.text))));
}

const VERLAUF_TEXT = {
  KOMMENTAR: (a) => `Kommentar: ${a.text}`, KOMMENTAR_ZURUECK: () => 'Kommentar zurückgezogen',
  UNGUELTIG: (a) => `Ungültig: ${UNGUELTIG_GRUENDE.find((g) => g.code === a.grund)?.label ?? a.grund}${a.text ? ` – ${a.text}` : ''}`,
  UNGUELTIG_AUFGEHOBEN: (a) => `Ungültig aufgehoben${a.text ? ` – ${a.text}` : ''}`,
  ZUORDNUNG: (a) => `Proband ${a.alt} → ${a.neu}${a.text ? ` – ${a.text}` : ''}`, PHASE: (a) => `Phase ${a.alt} → ${a.neu}${a.text ? ` – ${a.text}` : ''}`,
  STATUS: (a) => `Status ${a.alt} → ${a.neu}${a.text ? ` – ${a.text}` : ''}`, PHASENDATEN: (a) => `${a.feld}: ${a.alt || '–'} → ${a.neu || '–'}${a.text ? ` – ${a.text}` : ''}`,
  WIDERRUF_LOESCHUNG: (a) => `Widerruf – Daten gelöscht${a.text ? ` (${a.text})` : ''}`,
};

function verlaufListe(verlauf) {
  return el('section', { 'data-test': 'verlauf' },
    el('h2', {}, 'Verlauf der Änderungen'),
    el('ul', { class: 'liste-kurz' }, verlauf.map((a) => el('li', {},
      el('span', { class: 'klein-text' }, `${zeitDe(a.ts)} · Gerät ${String(a.geraeteId).slice(0, 8)}: `), (VERLAUF_TEXT[a.art] ?? ((x) => x.art))(a)))));
}

// ============================================================================ Eintrag
export function zeigeEintrag(app, { eintragId }) {
  const d = daten(app);
  const roh = d.logbuch.find((l) => l.eintragId === eintragId);
  if (!roh) { app.zeige('studie'); return; }
  const e = wirksamerStand(roh, d.aenderungen);
  ersetze(app.wurzel,
    el('h1', {}, ART_NAME[e.art] ?? e.art),
    e.gueltig ? null : el('div', { class: 'banner-rot', 'data-test': 'eintrag-ungueltig' },
      `Ungültig: ${UNGUELTIG_GRUENDE.find((g) => g.code === e.ungueltigGrund)?.label ?? e.ungueltigGrund}${e.ungueltigText ? ` – ${e.ungueltigText}` : ''}`),
    e.konflikt ? el('p', { class: 'warnkasten' }, 'Änderungen von mehreren Geräten – es gilt die zeitlich letzte.') : null,
    el('dl', { class: 'eckdaten', 'data-test': 'eintrag-eckdaten' },
      el('dt', {}, 'Proband'), el('dd', { 'data-test': 'eintrag-pseudonym' }, e.pseudonym, e.pseudonymOriginal ? ` (ursprünglich ${e.pseudonymOriginal})` : ''),
      el('dt', {}, 'Phase'), el('dd', { 'data-test': 'eintrag-phase' }, e.phase ?? '–', e.phaseOriginal ? ` (ursprünglich ${e.phaseOriginal})` : ''),
      el('dt', {}, 'Bereich'), el('dd', {}, bereichName(app, e.bereich)),
      e.dienst ? el('dt', {}, 'Dienst') : null, e.dienst ? el('dd', {}, e.dienst) : null,
      e.arbeitskontext ? el('dt', {}, 'Kontext') : null, e.arbeitskontext ? el('dd', {}, e.arbeitskontext) : null,
      el('dt', {}, 'Beginn'), el('dd', {}, zeitDe(e.startTs)),
      el('dt', {}, 'Ende'), el('dd', {}, zeitDe(e.endTs)),
      e.art === 'BLOCK' ? el('dt', {}, 'Beobachtet') : null, e.art === 'BLOCK' ? el('dd', {}, `${Math.round((e.beobachtetSek ?? 0) / 60)} min, ${e.pausenAnzahl ?? 0} Pausen`) : null,
      el('dt', {}, 'Status'), el('dd', {}, STATUS_NAME[e.status] ?? e.status, e.abbruchCode ? ` (${e.abbruchCode})` : ''),
      e.erhebungsmodus ? el('dt', {}, 'Erhebung') : null, e.erhebungsmodus ? el('dd', {}, e.erhebungsmodus === 'PAPIER' ? `Papier (${tagDe(e.papierDatum)})` : 'App') : null,
      e.beantwortet !== null && e.beantwortet !== undefined ? el('dt', {}, 'Antworten') : null,
      e.beantwortet !== null && e.beantwortet !== undefined ? el('dd', {}, `${e.beantwortet} beantwortet, ${e.ausgelassen ?? 0} offen gelassen`) : null,
      el('dt', {}, 'Export'), el('dd', {}, EXPORT_NAME[e.exportStatus] ?? e.exportStatus),
      el('dt', {}, 'Gerät'), el('dd', {}, String(e.geraeteId ?? '').slice(0, 8)),
      e.testmodus ? el('dt', {}, 'Probelauf') : null, e.testmodus ? el('dd', {}, 'ja – wird nicht ausgewertet') : null),
    el('p', { class: 'hinweis' }, 'Die erfassten Daten bleiben unverändert; Korrekturen werden als Änderung gespeichert.'),
    eintragKnoepfe(app, roh, e),
    kommentarListe(e.kommentare),
    e.verlauf.length ? verlaufListe(e.verlauf) : null,
    zurueck(app, 'proband', { pseudonym: e.pseudonym }));
}

// ============================================================================ Teilnehmerliste
const SPALTEN_TEILNEHMENDE = ['pseudonym', 'bereich', 'status', 'registriert', 'notiz'];

export function zeigeTeilnehmende(app) {
  const liste = [...daten(app).teilnehmende].sort((a, b) => a.pseudonym.localeCompare(b.pseudonym));
  const dateiFeld = el('input', {
    type: 'file', accept: '.csv,text/csv', class: 'unsichtbar', 'data-test': 'teilnehmende-datei',
    onchange: async () => {
      const f = dateiFeld.files?.[0];
      dateiFeld.value = '';
      if (f) await ladeTeilnehmende(app, await f.text());
    },
  });
  const datei = () => {
    const { datum, uhrzeit: zeit } = dateinameZeit(Date.now());
    return {
      dateiname: `HXNOW_Teilnehmende_${String(app.meta.geraeteId).slice(0, 8)}_${datum}_${zeit}.csv`,
      inhalt: csvText(SPALTEN_TEILNEHMENDE, liste.map((t) => [t.pseudonym, t.bereich ?? '', t.status, t.registriertTs ? datumLokal(t.registriertTs) : '', t.notiz ?? ''])),
      typ: 'text/csv',
    };
  };
  ersetze(app.wurzel,
    el('h1', {}, 'Teilnehmerliste'),
    el('p', { class: 'hinweis' }, 'Nur Studien-Codes, keine Namen. Die Zuordnung Code ↔ Person liegt ausschließlich auf Papier bei der Studienleitung.'),
    liste.length === 0 ? el('p', { class: 'hinweis' }, 'Noch keine Codes. Codes werden beim ersten Block oder Fragebogen angelegt oder hier geladen.') : el('table', { class: 'tabelle', 'data-test': 'teilnehmende' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Code'), el('th', {}, 'Bereich'), el('th', {}, 'Status'), el('th', {}, 'Seit'))),
      el('tbody', {}, liste.map((t) => el('tr', { class: 'klickbar', 'data-test': `tn-${t.pseudonym}`, onclick: () => app.zeige('proband', { pseudonym: t.pseudonym }) },
        el('td', {}, t.pseudonym), el('td', {}, t.bereich ?? '–'), el('td', {}, t.status), el('td', {}, datumDe(t.statusTs ?? t.registriertTs)))))),
    el('div', { class: 'stapel abstand-oben' },
      el('button', { type: 'button', class: 'gross', 'data-test': 'teilnehmende-export', disabled: liste.length === 0, onclick: () => exportiere(app, datei()) }, 'Liste exportieren (CSV)'),
      dateiFeld,
      el('button', { type: 'button', class: 'gross', 'data-test': 'teilnehmende-laden', onclick: () => dateiFeld.click() }, 'Liste laden (CSV)'),
      el('p', { class: 'hinweis' }, 'Laden ergänzt fehlende Codes (Spalten pseudonym; bereich; status; notiz). Vorhandene Codes bleiben unverändert.')),
    zurueck(app, 'studie'));
}

async function ladeTeilnehmende(app, text) {
  const { kopf, zeilen } = leseCsv(text);
  if (!kopf.includes('pseudonym')) { meldung('Keine Teilnehmerliste: Spalte „pseudonym“ fehlt.', 'fehler'); return; }
  const muster = new RegExp(app.schema.pseudonym.muster);
  const bereiche = new Set(app.schema.bereiche.map((b) => b.code));
  const fehler = [];
  const saetze = [];
  for (const [i, z] of zeilen.entries()) {
    const code = String(z.pseudonym ?? '').trim().toUpperCase();
    if (!code) continue;
    if (!muster.test(code) || code === app.schema.pseudonym.testCode) { fehler.push(`Zeile ${i + 2}: ${code} ist kein gültiger Studien-Code`); continue; }
    if (z.bereich && !bereiche.has(z.bereich)) { fehler.push(`Zeile ${i + 2}: Bereich ${z.bereich} unbekannt`); continue; }
    const status = ['aktiv', 'pausiert', 'ausgeschieden', 'widerrufen'].includes(z.status) ? z.status : 'aktiv';
    saetze.push({ pseudonym: code, bereich: z.bereich || null, status, statusTs: Date.now(), registriertTs: Date.now(), notiz: z.notiz ?? '', phasenAbweichung: null });
  }
  if (fehler.length) { meldung(`Nicht geladen: ${fehler.slice(0, 3).join('; ')}${fehler.length > 3 ? ' …' : ''}`, 'fehler'); return; }
  const { neu, uebersprungen } = await db.importiere(app.db, { [db.STORES.TEILNEHMENDE]: saetze });
  app.teilnehmende = new Map((await db.holeAlle(app.db, db.STORES.TEILNEHMENDE)).map((t) => [t.pseudonym, t]));
  meldung(`Teilnehmerliste: ${neu.teilnehmende} neu, ${uebersprungen.teilnehmende} bereits vorhanden.`);
  app.zeige('teilnehmende');
}

// ============================================================================ Studienplan
export function zeigeStudienplan(app) {
  const plan = new Map(daten(app).phasenplan.map((p) => [p.bereich, p]));
  const fehlerBox = el('p', { class: 'feldfehler', 'aria-live': 'polite', 'data-test': 'phasenplan-fehler' });
  const ordner = el('input', { type: 'text', value: app.meta.exportordnerText ?? '', 'data-test': 'exportordner', placeholder: 'z. B. Klinik-Laufwerk \\\\Studien\\HXNow\\Export' });
  ersetze(app.wurzel,
    el('h1', {}, 'Studienplan'),
    el('h2', {}, 'Phasenplan je Bereich'),
    el('p', { class: 'hinweis' }, 'Daten je Bereich; Abweichungen einzelner Probanden in deren Detailansicht. Änderungen werden im Verlauf festgehalten.'),
    app.schema.bereiche.map((b) => {
      const p = plan.get(b.code) ?? {};
      const felder = Object.fromEntries(DATUM_FELDER.map(([f]) => [f, el('input', { type: 'date', value: p[f] ?? '', 'data-test': `plan-${b.code}-${f}` })]));
      return el('section', { class: 'phasen-karte', 'data-test': `plan-${b.code}` },
        el('h3', {}, b.label),
        DATUM_FELDER.map(([f, name]) => el('label', { class: 'feld feld-reihe' }, el('span', { class: 'feldname' }, name), felder[f])),
        el('button', {
          type: 'button', class: 'primaer', 'data-test': `plan-${b.code}-speichern`,
          onclick: () => {
            const neu = Object.fromEntries(DATUM_FELDER.map(([f]) => [f, felder[f].value || null]));
            const f = pruefePhasen(neu);
            fehlerBox.textContent = f ?? '';
            if (f) return;
            schuetze(app, 'Phasenplan ändern', () => speicherePhasenplan(app, b.code, p, neu));
          },
        }, 'Speichern'));
    }),
    fehlerBox,
    el('h2', {}, 'Ziel je Phase'),
    el('p', { 'data-test': 'ziel' }, `${ziel(app.schema)} Blöcke je Proband in Baseline und Regelbetrieb (Kodierschema „zielBloeckeProPhase“).`),
    el('h2', {}, 'Exportordner'),
    el('label', { class: 'feld' }, el('span', { class: 'feldname' }, 'Wohin die Dateien gehören (Hinweis für alle Beteiligten)'), ordner),
    el('button', {
      type: 'button', 'data-test': 'exportordner-speichern',
      onclick: async () => {
        const text = ordner.value.trim();
        await db.setzeMeta(app.db, 'exportordnerText', text);
        app.meta.exportordnerText = text;
        meldung('Exportordner gespeichert.');
      },
    }, 'Speichern'),
    aenderungsKnoepfe(app),
    zurueck(app, 'studie'));
}

/** Reihenfolge prüfen: jedes gesetzte Datum nach dem vorigen gesetzten. */
export function pruefePhasen(p) {
  let vorher = null;
  for (const [f, name] of DATUM_FELDER) {
    if (!p[f]) continue;
    if (vorher && p[f] <= vorher[1]) return `${name} muss nach „${vorher[0]}“ liegen.`;
    vorher = [name, p[f]];
  }
  if (!p.baselineStart && Object.values(p).some(Boolean)) return 'Bitte zuerst „Beginn Baseline“ eintragen.';
  return null;
}

async function speicherePhasenplan(app, bereich, alt, neu) {
  const ctx = aenderungsKontext(app);
  const aenderungen = DATUM_FELDER.filter(([f]) => (alt[f] ?? null) !== neu[f])
    .map(([f]) => neueAenderung({ art: ART.PHASENDATEN, zielTyp: 'bereich', zielId: bereich, feld: f, alt: alt[f] ?? null, neu: neu[f] }, ctx));
  if (aenderungen.length === 0) { meldung('Keine Änderung.'); return; }
  await db.schreibeLogbuchAenderung(app.db, { aenderungen, phasenplan: { bereich, ...neu } });
  meldung('Phasenplan gespeichert.');
  app.zeige('studienplan');
}

