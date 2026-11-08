// Änderungen im Logbuch (PLAN_Logbuch_Datensicherheit 6): Kommentar (frei), geschützt mit PIN: ungültig markieren
// bzw. aufheben, Proband (Zuordnung), Phase, Status des Probanden, individuelle Phasendaten. Jede Änderung wird nur
// angefügt (Store `aenderungen`); die erfassten Daten bleiben unverändert. Danach wird angeboten, das Logbuch zu
// sichern.
import { el, dialog, meldung, ersetze } from './dom.js';
import * as db from '../db.js';
import { neueAenderung, ART, UNGUELTIG_GRUENDE } from '../aenderungen.js';
import { pinFormatOk, neuesSalz, pinHash, pruefePin, GUELTIG_MS } from '../pin.js';
import { sichereLogbuch, exportiere } from './exportieren.js';
import { widerrufUmfang, widerrufKurz, widerrufProtokoll, dateinameWiderruf } from '../widerruf.js';

const STATUS_PROBAND = [
  { code: 'aktiv', label: 'aktiv' }, { code: 'pausiert', label: 'pausiert (z. B. Urlaub, Krankheit)' }, { code: 'ausgeschieden', label: 'ausgeschieden' },
];
const PHASEN_FELDER = [
  ['baselineStart', 'Beginn Baseline'], ['einfuehrungStart', 'Beginn Einführung'], ['regelbetriebStart', 'Beginn Regelbetrieb'],
  ['abschlussStart', 'Beginn Abschluss'], ['ende', 'Ende'],
];

/** Zeitstempel streng steigend: Die Reihenfolge der Änderungen entscheidet über den wirksamen Stand. */
export function aenderungsKontext(app) {
  const letzte = Math.max(0, ...(app.logbuchDaten?.aenderungen ?? []).map((a) => a.ts));
  let zuletzt = Math.max(letzte, app.letzteAenderungTs ?? 0);
  return {
    uuid: app.uuid, geraeteId: app.meta.geraeteId, appVersion: app.appVersion,
    now: () => { zuletzt = Math.max(Date.now(), zuletzt + 1); app.letzteAenderungTs = zuletzt; return zuletzt; },
  };
}
const ctx = aenderungsKontext;

// ============================================================================ PIN
/** Führt `aktion` nach PIN-Abfrage aus (PIN beim ersten Mal festlegen; 10 Minuten gültig). */
export function schuetze(app, titel, aktion) {
  if (app.pinGueltigBis && Date.now() < app.pinGueltigBis) return aktion();
  if (!app.meta.pinHash) return pinFestlegen(app, () => aktion());
  return pinAbfragen(app, titel, aktion);
}

function pinFeld(test) {
  return el('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 8, 'data-test': test });
}

function pinFestlegen(app, danach, { titel = 'PIN festlegen', alt = false } = {}) {
  const a = pinFeld('pin-neu');
  const b = pinFeld('pin-wiederholen');
  const fehler = el('p', { class: 'feldfehler', 'aria-live': 'polite', 'data-test': 'pin-fehler' });
  dialog(titel, (schliessen) => [
    el('p', {}, 'Die PIN schützt Korrekturen im Logbuch. 4–8 Ziffern; nur die Studienleitung und die Doktorandin kennen sie.'),
    el('label', { class: 'feld' }, el('span', { class: 'feldname' }, alt ? 'Neue PIN' : 'PIN'), a),
    el('label', { class: 'feld' }, el('span', { class: 'feldname' }, 'PIN wiederholen'), b),
    fehler,
    el('div', { class: 'knopfzeile' },
      el('button', { type: 'button', 'data-test': 'pin-abbrechen', onclick: schliessen }, 'Abbrechen'),
      el('button', {
        type: 'button', class: 'primaer', 'data-test': 'pin-speichern',
        onclick: async () => {
          if (!pinFormatOk(a.value)) { fehler.textContent = 'Bitte 4 bis 8 Ziffern.'; return; }
          if (a.value !== b.value) { fehler.textContent = 'Die beiden Eingaben stimmen nicht überein.'; return; }
          const salz = neuesSalz();
          const hash = await pinHash(a.value, salz);
          await db.setzeMeta(app.db, 'pinSalz', salz);
          await db.setzeMeta(app.db, 'pinHash', hash);
          Object.assign(app.meta, { pinSalz: salz, pinHash: hash });
          app.pinGueltigBis = Date.now() + GUELTIG_MS;
          schliessen();
          meldung('PIN gespeichert.');
          danach();
        },
      }, 'Speichern')),
  ], { testId: 'dialog-pin-festlegen' });
}

function pinAbfragen(app, titel, aktion) {
  const feld = pinFeld('pin');
  const fehler = el('p', { class: 'feldfehler', 'aria-live': 'polite', 'data-test': 'pin-fehler' });
  dialog('PIN eingeben', (schliessen) => [
    el('p', {}, titel),
    el('label', { class: 'feld' }, el('span', { class: 'feldname' }, 'PIN'), feld),
    fehler,
    el('div', { class: 'knopfzeile' },
      el('button', { type: 'button', 'data-test': 'pin-abbrechen', onclick: schliessen }, 'Abbrechen'),
      el('button', {
        type: 'button', class: 'primaer', 'data-test': 'pin-ok',
        onclick: async () => {
          const z = { pinHash: app.meta.pinHash, pinSalz: app.meta.pinSalz, fehlversuche: app.meta.pinFehlversuche ?? 0, sperreBis: app.meta.pinSperreBis ?? null };
          const eingabe = feld.value;
          feld.value = '';
          const r = await pruefePin(eingabe, z);
          Object.assign(app.meta, { pinFehlversuche: r.z.fehlversuche, pinSperreBis: r.z.sperreBis });
          await db.setzeMeta(app.db, 'pinFehlversuche', r.z.fehlversuche);
          await db.setzeMeta(app.db, 'pinSperreBis', r.z.sperreBis);
          if (r.gesperrt) { fehler.textContent = `Zu viele Fehlversuche – gesperrt bis ${new Date(r.z.sperreBis).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr.`; return; }
          if (!r.ok) { fehler.textContent = `PIN falsch. Noch ${r.rest} ${r.rest === 1 ? 'Versuch' : 'Versuche'}.`; return; }
          app.pinGueltigBis = Date.now() + GUELTIG_MS;
          schliessen();
          aktion();
        },
      }, 'OK')),
  ], { testId: 'dialog-pin' });
}

/** Im Studienplan: PIN ändern (erst alte PIN). */
export function aenderungsKnoepfe(app) {
  return [
    el('h2', {}, 'PIN'),
    el('p', { class: 'hinweis', 'data-test': 'pin-stand' }, app.meta.pinHash ? 'Eine PIN ist festgelegt.' : 'Noch keine PIN – sie wird bei der ersten geschützten Änderung festgelegt.'),
    app.meta.pinHash ? el('button', {
      type: 'button', 'data-test': 'pin-aendern',
      onclick: () => pinAbfragen(app, 'Zum Ändern zuerst die bisherige PIN eingeben.', () => pinFestlegen(app, () => app.zeige('studienplan'), { titel: 'Neue PIN', alt: true })),
    }, 'PIN ändern') : null,
  ];
}

// ============================================================================ Speichern
async function speichere(app, aenderungen, { teilnehmer = null, zurueck }) {
  try {
    await db.schreibeLogbuchAenderung(app.db, { aenderungen, teilnehmer });
  } catch (e) {
    meldung(`Speichern fehlgeschlagen: ${e.message}`, 'fehler');
    return;
  }
  if (teilnehmer) app.teilnehmende?.set(teilnehmer.pseudonym, teilnehmer);
  await zurueck();
  // Logbuch-Daten sind nach app.zeige() neu gelesen → die Datei entsteht synchron im Klick.
  dialog('Änderung gespeichert', (schliessen) => [
    el('p', {}, 'Logbuch jetzt sichern? Erst dann ist die Änderung auch im Exportordner.'),
    el('div', { class: 'knopfzeile' },
      el('button', { type: 'button', 'data-test': 'spaeter-sichern', onclick: schliessen }, 'Später'),
      el('button', { type: 'button', class: 'primaer', 'data-test': 'jetzt-sichern', onclick: () => { schliessen(); sichereLogbuch(app, zurueck); } }, 'Logbuch sichern')),
  ], { testId: 'dialog-nach-aenderung' });
}

/** Formular-Dialog mit Begründung; `felder` liefert Knoten, `lesen()` die Werte oder einen Fehlertext. */
function formular(titel, { felder, lesen, ok = 'Speichern', gefahr = false, test }) {
  const fehler = el('p', { class: 'feldfehler', 'aria-live': 'polite', 'data-test': 'aendern-fehler' });
  return new Promise((fertig) => dialog(titel, (schliessen) => [
    ...felder,
    fehler,
    el('div', { class: 'knopfzeile' },
      el('button', { type: 'button', 'data-test': 'aendern-abbrechen', onclick: () => { schliessen(); fertig(null); } }, 'Abbrechen'),
      el('button', {
        type: 'button', class: gefahr ? 'gefahr' : 'primaer', 'data-test': 'aendern-ok',
        onclick: () => {
          const r = lesen();
          if (typeof r === 'string') { fehler.textContent = r; return; }
          schliessen();
          fertig(r);
        },
      }, ok)),
  ], { testId: test }));
}

const textFeld = (test, titel = 'Begründung', optional = true) => {
  const f = el('textarea', { rows: 3, maxlength: 500, 'data-test': test });
  return [f, el('label', { class: 'feld' }, el('span', { class: 'feldname' }, titel, optional ? el('span', { class: 'optional' }, ' (optional)') : null), f,
    el('span', { class: 'hinweis' }, 'Keine Namen oder Angaben, die Personen erkennbar machen.'))];
};

function auswahl(name, eintraege, wert = null) {
  const s = el('select', { 'data-test': name }, el('option', { value: '' }, 'bitte wählen'), eintraege.map((e) => el('option', { value: e.code }, e.label)));
  if (wert) s.value = wert;
  return s;
}

// ============================================================================ Eintrag
export function eintragKnoepfe(app, roh, e) {
  const zurueck = () => app.zeige('eintrag', { eintragId: roh.eintragId });
  const ziel = { zielTyp: 'eintrag', zielId: roh.eintragId };
  const knoepfe = [
    el('button', { type: 'button', 'data-test': 'kommentar-neu', onclick: () => kommentar(app, ziel, zurueck) }, 'Kommentar'),
    e.gueltig
      ? el('button', { type: 'button', class: 'gefahr', 'data-test': 'ungueltig', onclick: () => schuetze(app, 'Eintrag als ungültig markieren', () => ungueltig(app, roh, zurueck)) }, 'Als ungültig markieren')
      : el('button', { type: 'button', 'data-test': 'ungueltig-aufheben', onclick: () => schuetze(app, 'Ungültig-Markierung aufheben', () => aufheben(app, roh, zurueck)) }, 'Ungültig aufheben'),
    el('button', { type: 'button', 'data-test': 'zuordnung', onclick: () => schuetze(app, 'Eintrag einem anderen Probanden zuordnen', () => zuordnung(app, roh, e, zurueck)) }, 'Anderer Proband'),
    ['BLOCK', 'VERSUCH'].includes(roh.art)
      ? el('button', { type: 'button', 'data-test': 'phase-aendern', onclick: () => schuetze(app, 'Phase des Eintrags ändern', () => phase(app, roh, e, zurueck)) }, 'Phase ändern')
      : null,
    e.kommentare.some((k) => !k.zurueckgezogen)
      ? el('button', { type: 'button', 'data-test': 'kommentar-zurueck', onclick: () => kommentarZurueck(app, e.kommentare, zurueck) }, 'Kommentar zurückziehen')
      : null,
  ];
  return el('div', { class: 'knopfraster abstand-oben', 'data-test': 'eintrag-knoepfe' }, knoepfe);
}

async function kommentar(app, ziel, zurueck) {
  const [f, feld] = textFeld('kommentar-text', 'Kommentar', false);
  const r = await formular('Kommentar', { felder: [feld], lesen: () => (f.value.trim() ? { text: f.value.trim() } : 'Bitte einen Text eingeben.'), test: 'dialog-kommentar' });
  if (r) speichere(app, [neueAenderung({ art: ART.KOMMENTAR, ...ziel, text: r.text }, ctx(app))], { zurueck });
}

async function kommentarZurueck(app, kommentare, zurueck) {
  const offen = kommentare.filter((k) => !k.zurueckgezogen);
  const s = auswahl('kommentar-wahl', offen.map((k) => ({ code: k.aenderungId, label: k.text.slice(0, 60) })), offen.length === 1 ? offen[0].aenderungId : null);
  const r = await formular('Kommentar zurückziehen', { felder: [el('label', { class: 'feld' }, el('span', { class: 'feldname' }, 'Kommentar'), s)], lesen: () => (s.value ? { id: s.value } : 'Bitte wählen.'), ok: 'Zurückziehen', test: 'dialog-kommentar-zurueck' });
  if (r) speichere(app, [neueAenderung({ art: ART.KOMMENTAR_ZURUECK, zielTyp: 'aenderung', zielId: r.id }, ctx(app))], { zurueck });
}

async function ungueltig(app, roh, zurueck) {
  const s = auswahl('ungueltig-grund', UNGUELTIG_GRUENDE.map((g) => ({ code: g.code, label: `${g.code} ${g.label}` })));
  const [f, feld] = textFeld('ungueltig-text', 'Erläuterung');
  const r = await formular('Als ungültig markieren', {
    felder: [el('p', {}, 'Der Eintrag bleibt erhalten, zählt aber nicht mehr und wird bei der Auswertung ausgeschlossen. Aufheben ist möglich.'),
      el('label', { class: 'feld' }, el('span', { class: 'feldname' }, 'Grund'), s), feld],
    lesen: () => (!s.value ? 'Bitte einen Grund wählen.' : s.value === 'U9' && !f.value.trim() ? 'Bei „Sonstiges“ bitte erläutern.' : { grund: s.value, text: f.value.trim() }),
    ok: 'Ungültig markieren', gefahr: true, test: 'dialog-ungueltig',
  });
  if (r) speichere(app, [neueAenderung({ art: ART.UNGUELTIG, zielTyp: 'eintrag', zielId: roh.eintragId, grund: r.grund, text: r.text }, ctx(app))], { zurueck });
}

async function aufheben(app, roh, zurueck) {
  const [f, feld] = textFeld('aufheben-text');
  const r = await formular('Ungültig aufheben', { felder: [feld], lesen: () => ({ text: f.value.trim() }), test: 'dialog-aufheben' });
  if (r) speichere(app, [neueAenderung({ art: ART.UNGUELTIG_AUFGEHOBEN, zielTyp: 'eintrag', zielId: roh.eintragId, text: r.text }, ctx(app))], { zurueck });
}

async function zuordnung(app, roh, e, zurueck) {
  const codes = [...(app.teilnehmende?.values() ?? [])].filter((t) => t.pseudonym !== e.pseudonym && t.status !== 'widerrufen')
    .sort((a, b) => a.pseudonym.localeCompare(b.pseudonym)).map((t) => ({ code: t.pseudonym, label: t.pseudonym }));
  const s = auswahl('zuordnung-code', codes);
  const [f, feld] = textFeld('zuordnung-text', 'Begründung', false);
  const r = await formular('Anderer Proband', {
    felder: [el('p', {}, `Bisher: ${e.pseudonym}. Die Datei behält den ursprünglichen Code; bei der Auswertung gilt der neue.`),
      el('label', { class: 'feld' }, el('span', { class: 'feldname' }, 'Neuer Studien-Code'), s), feld],
    lesen: () => (!s.value ? 'Bitte einen Code wählen (nur Codes aus der Teilnehmerliste).' : !f.value.trim() ? 'Bitte begründen.' : { neu: s.value, text: f.value.trim() }),
    test: 'dialog-zuordnung',
  });
  if (r) speichere(app, [neueAenderung({ art: ART.ZUORDNUNG, zielTyp: 'eintrag', zielId: roh.eintragId, feld: 'pseudonym', alt: e.pseudonym, neu: r.neu, text: r.text }, ctx(app))], { zurueck });
}

async function phase(app, roh, e, zurueck) {
  const s = auswahl('phase-neu', app.schema.phasen.filter((p) => p.code !== e.phase));
  const [f, feld] = textFeld('phase-text', 'Begründung', false);
  const r = await formular('Phase ändern', {
    felder: [el('p', {}, `Bisher: ${e.phase}.`), el('label', { class: 'feld' }, el('span', { class: 'feldname' }, 'Neue Phase'), s), feld],
    lesen: () => (!s.value ? 'Bitte eine Phase wählen.' : !f.value.trim() ? 'Bitte begründen.' : { neu: s.value, text: f.value.trim() }),
    test: 'dialog-phase',
  });
  if (r) speichere(app, [neueAenderung({ art: ART.PHASE, zielTyp: 'eintrag', zielId: roh.eintragId, feld: 'phase', alt: e.phase, neu: r.neu, text: r.text }, ctx(app))], { zurueck });
}

// ============================================================================ Proband
export function probandKnoepfe(app, t) {
  const zurueck = () => app.zeige('proband', { pseudonym: t.pseudonym });
  return el('div', { class: 'knopfraster abstand-oben', 'data-test': 'proband-knoepfe' },
    el('button', { type: 'button', 'data-test': 'kommentar-neu', onclick: () => kommentar(app, { zielTyp: 'proband', zielId: t.pseudonym }, zurueck) }, 'Kommentar'),
    t.status === 'widerrufen' ? null
      : el('button', { type: 'button', 'data-test': 'status-aendern', onclick: () => schuetze(app, 'Status des Probanden ändern', () => status(app, t, zurueck)) }, 'Status ändern'),
    t.status === 'widerrufen' ? null
      : el('button', { type: 'button', 'data-test': 'phasendaten', onclick: () => schuetze(app, 'Individuelle Phasendaten', () => phasendaten(app, t, zurueck)) }, 'Eigene Phasendaten'),
    widerrufKnopf(app, t));
}

async function status(app, t, zurueck) {
  const s = auswahl('status-neu', STATUS_PROBAND.filter((x) => x.code !== t.status));
  const [f, feld] = textFeld('status-text');
  const r = await formular('Status ändern', {
    felder: [el('p', {}, `Bisher: ${t.status}. Pausierte und ausgeschiedene Codes können nicht erfasst werden.`), el('label', { class: 'feld' }, el('span', { class: 'feldname' }, 'Neuer Status'), s), feld],
    lesen: () => (s.value ? { neu: s.value, text: f.value.trim() } : 'Bitte einen Status wählen.'),
    test: 'dialog-status',
  });
  if (!r) return;
  const a = neueAenderung({ art: ART.STATUS, zielTyp: 'proband', zielId: t.pseudonym, feld: 'status', alt: t.status, neu: r.neu, text: r.text }, ctx(app));
  speichere(app, [a], { teilnehmer: { ...t, status: r.neu, statusTs: a.ts }, zurueck });
}

async function phasendaten(app, t, zurueck) {
  const ab = t.phasenAbweichung ?? {};
  const felder = Object.fromEntries(PHASEN_FELDER.map(([f]) => [f, el('input', { type: 'date', value: ab[f] ?? '', 'data-test': `abweichung-${f}` })]));
  const [txt, feld] = textFeld('abweichung-text', 'Begründung', false);
  const r = await formular('Eigene Phasendaten', {
    felder: [el('p', {}, 'Nur ausfüllen, was vom Plan des Bereichs abweicht (z. B. später eingestiegen). Leere Felder = Plan des Bereichs.'),
      ...PHASEN_FELDER.map(([f, name]) => el('label', { class: 'feld feld-reihe' }, el('span', { class: 'feldname' }, name), felder[f])), feld],
    lesen: () => {
      const neu = Object.fromEntries(PHASEN_FELDER.map(([f]) => [f, felder[f].value || null]));
      if (PHASEN_FELDER.every(([f]) => (ab[f] ?? null) === neu[f])) return 'Keine Änderung.';
      return txt.value.trim() ? { neu, text: txt.value.trim() } : 'Bitte begründen.';
    },
    test: 'dialog-phasendaten',
  });
  if (!r) return;
  const aenderungen = PHASEN_FELDER.filter(([f]) => (ab[f] ?? null) !== r.neu[f])
    .map(([f]) => neueAenderung({ art: ART.PHASENDATEN, zielTyp: 'proband', zielId: t.pseudonym, feld: f, alt: ab[f] ?? null, neu: r.neu[f], text: r.text }, ctx(app)));
  const leer = Object.values(r.neu).every((v) => !v);
  speichere(app, aenderungen, { teilnehmer: { ...t, phasenAbweichung: leer ? null : r.neu }, zurueck });
}

// ============================================================================ Widerruf (L5)
function widerrufKnopf(app, t) {
  if (t.status === 'widerrufen') return null;
  return el('button', { type: 'button', class: 'gefahr', 'data-test': 'widerruf', onclick: () => schuetze(app, `Widerruf von ${t.pseudonym}`, () => widerruf(app, t)) }, 'Widerruf');
}

async function widerruf(app, t) {
  const laeuft = (await db.laufendeBloecke(app.db)).some((b) => b.pseudonym === t.pseudonym)
    || (await db.offeneFbSitzungen(app.db)).some((s) => s.pseudonym === t.pseudonym);
  if (laeuft) { meldung(`Für ${t.pseudonym} läuft noch ein Block oder Fragebogen. Bitte zuerst beenden oder abbrechen.`, 'fehler'); return; }
  const u = widerrufUmfang(t.pseudonym, app.logbuchDaten);
  const code = el('input', { type: 'text', autocapitalize: 'characters', autocomplete: 'off', 'data-test': 'widerruf-code' });
  const r = await formular(`Widerruf ${t.pseudonym}`, {
    felder: [
      el('p', {}, `Alle Daten von ${t.pseudonym} werden endgültig von diesem Gerät gelöscht: ${widerrufKurz(u)}. `
        + 'Erhalten bleiben nur die Zeile der Teilnehmerliste (Status „widerrufen“) und der Vorgang im Änderungsprotokoll.'),
      el('p', {}, `Danach entsteht ein Protokoll mit ${u.dateien.length} ${u.dateien.length === 1 ? 'Datei' : 'Dateien'}, die im Exportordner zu löschen sind.`),
      el('label', { class: 'feld' }, el('span', { class: 'feldname' }, 'Zum Bestätigen den Studien-Code eintippen'), code),
    ],
    lesen: () => (code.value.trim().toUpperCase() === t.pseudonym ? {} : 'Der Code stimmt nicht.'),
    ok: 'Endgültig löschen', gefahr: true, test: 'dialog-widerruf',
  });
  if (!r) return;
  const c = ctx(app);
  const aenderung = neueAenderung({ art: ART.WIDERRUF_LOESCHUNG, zielTyp: 'proband', zielId: t.pseudonym, feld: 'status', alt: t.status, neu: 'widerrufen', text: widerrufKurz(u) }, c);
  const ids = new Set(u.eintraege.map((e) => e.eintragId));
  const teilnehmer = { ...t, status: 'widerrufen', statusTs: aenderung.ts, notiz: '', phasenAbweichung: null };
  try {
    await db.widerrufe(app.db, {
      pseudonym: t.pseudonym, ids: [...ids], behalten: app.logbuchDaten.logbuch.filter((l) => !ids.has(l.eintragId)).map((l) => l.eintragId),
      aenderungIds: u.aenderungen.map((a) => a.aenderungId), aenderung, teilnehmer,
    });
  } catch (e) {
    meldung(`Widerruf fehlgeschlagen (${e.message}). Es wurde nichts gelöscht.`, 'fehler');
    return;
  }
  app.teilnehmende?.set(t.pseudonym, teilnehmer);
  const offen = [...new Set([...(app.meta.widerrufOffen ?? []), t.pseudonym])];
  await db.setzeMeta(app.db, 'widerrufOffen', offen);
  app.meta.widerrufOffen = offen;
  const protokoll = {
    dateiname: dateinameWiderruf(t.pseudonym, aenderung.ts),
    inhalt: widerrufProtokoll(t.pseudonym, u, { ts: aenderung.ts, geraeteId: app.meta.geraeteId, appVersion: app.appVersion }),
    typ: 'text/plain',
  };
  app.zeige('widerrufFertig', { pseudonym: t.pseudonym, protokoll, dateien: u.dateien });
}

/** Nach dem Widerruf: Protokoll und Logbuch teilen (Pflicht, Startseite mahnt bis dahin). */
export function zeigeWiderrufFertig(app, { pseudonym, protokoll, dateien }) {
  ersetze(app.wurzel,
    el('h1', {}, `Widerruf ${pseudonym}`),
    el('p', { 'data-test': 'widerruf-fertig' }, 'Die Daten sind von diesem Gerät gelöscht.'),
    el('h2', {}, 'Im Exportordner löschen'),
    dateien.length ? el('ul', { class: 'liste-kurz', 'data-test': 'widerruf-dateien' }, dateien.map((d) => el('li', {}, d))) : el('p', { class: 'hinweis' }, 'Keine exportierten Dateien.'),
    el('p', { class: 'hinweis' }, 'Jetzt Protokoll und Logbuch teilen und im Exportordner speichern. Das Logbuch ersetzt die vorige Fassung.'),
    el('div', { class: 'stapel' },
      el('button', {
        type: 'button', class: 'primaer gross', 'data-test': 'widerruf-teilen',
        onclick: () => exportiere(app, protokoll, { mitLogbuch: true, nachher: () => app.zeige('proband', { pseudonym }) }),
      }, 'Protokoll und Logbuch teilen'),
      el('button', { type: 'button', class: 'gross', 'data-test': 'zurueck', onclick: () => app.zeige('studie') }, 'Später')));
}

