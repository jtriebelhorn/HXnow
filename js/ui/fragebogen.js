// Fragebogen-Modus (Fragebogenplan 2 und F1/F3): Vorbereitung durch die Doktorandin (Bogen, Studien-Code, Bereich,
// Erhebungsmodus), Übergabe an die teilnehmende Person, Ausfüllen (eine Seite je Abschnitt), Dank, Rückkehr zur
// Studienansicht per langem Druck, Statusansicht ohne Antworten mit Export.
// Jede Antwort wird sofort gespeichert; eine unterbrochene Sitzung wird an derselben Stelle fortgesetzt.
import { el, ersetze, auswahlGruppe, bestaetige, meldung } from './dom.js';
import * as db from '../db.js';
import { codeAuswahl, ergaenzeBereich } from './blockneu.js';
import { FRAGEBOGEN_DEFINITION as DEF } from '../frageboegen.js';
import { bogen as bogenNach, items } from '../fb/definition.js';
import { berechneStand, seiten, offeneFragen, pruefhinweise, sichtbareOptionen, zusammenfassungStand } from '../fb/stand.js';
import { erfuellt } from '../fb/filter.js';
import { fbDatei } from '../fb/export.js';
import { eintragAusFb } from '../logbuch.js';
import { istTestPseudonym } from '../schema.js';
import { exportiere, andereWege, bestaetigeEingang } from './exportieren.js';
import { formatiereCountdown, uhrzeit, datumLokal } from '../zeit.js';

const HALTEN_MS = 2000;

const BOGEN_NAME = { FB1: 'Fragebogen 1 – Baseline', KB: 'Kurzbogen Gewöhnung', FB2: 'Fragebogen 2 – Ende Regelbetrieb' };

/** Bögen, die in diesem Schema angeboten werden (kodierschema.json `fb.verfuegbar`, sonst alle). */
function verfuegbareBoegen(app) {
  const erlaubt = app.schema.fb?.verfuegbar;
  return DEF.boegen.filter((b) => !Array.isArray(erlaubt) || erlaubt.includes(b.id));
}

/** Datei, Stand und Logbuch-Eintrag einer Sitzung (synchron, für Teilen in der Nutzergeste). */
export function fbExportDatei(app, sitzung, antworten) {
  return fbDatei(bogenNach(DEF, sitzung.bogen), sitzung, antworten, {
    definitionVersion: sitzung.definitionVersion ?? DEF.definitionVersion, test: Boolean(sitzung.testmodus),
  });
}

function logbuchFuer(app, sitzung, antworten = null) {
  const b = bogenNach(DEF, sitzung.bogen);
  return eintragAusFb(sitzung, app.schema, b.phase, antworten ? zusammenfassungStand(berechneStand(b, antworten)) : null);
}

async function speichereSitzung(app, sitzung, antworten = null) {
  await db.schreibeFb(app.db, { sitzung, logbuch: logbuchFuer(app, sitzung, antworten) });
}

// ===================================================================== Vorbereitung
export async function zeigeFbNeu(app) {
  const laufend = (await db.laufendeBloecke(app.db)).length > 0;
  const werte = { bogen: null, pseudonym: '', bereich: app.schema.bereiche.length === 1 ? app.schema.bereiche[0].code : null, modus: 'APP', papierDatum: '' };
  const start = el('button', { type: 'button', class: 'primaer gross', disabled: true, 'data-test': 'fb-vorbereitung-weiter' }, 'Weiter');
  const hinweis = el('p', { class: 'feldfehler', 'data-test': 'fb-hinweis' });

  const pruefe = () => {
    const b = werte.bogen ? bogenNach(DEF, werte.bogen) : null;
    const nurTest = b?.status === 'entwurf' && werte.pseudonym && !istTestPseudonym(app.schema, werte.pseudonym);
    hinweis.textContent = laufend ? 'Ein Beobachtungsblock läuft. Bitte zuerst den Block abschließen.'
      : nurTest ? `${BOGEN_NAME[b.id]} ist noch ein Entwurf und nur im Probelauf (${app.schema.pseudonym.testCode}) möglich.` : '';
    start.disabled = laufend || !b || !werte.pseudonym || !werte.bereich || nurTest || (werte.modus === 'PAPIER' && !werte.papierDatum);
  };
  const code = codeAuswahl(app, { art: 'versuch', werte, beiAenderung: pruefe });
  const datum = el('input', { type: 'date', 'data-test': 'fb-papier-datum', oninput: () => { werte.papierDatum = datum.value; pruefe(); } });
  const datumFeld = el('label', { class: 'feld', hidden: true }, el('span', { class: 'feldname' }, 'Datum auf dem Papierbogen'), datum);

  start.onclick = async () => {
    start.disabled = true;
    const b = bogenNach(DEF, werte.bogen);
    const jetzt = Date.now();
    const sitzung = {
      sitzungId: app.uuid(), geraeteId: app.meta.geraeteId, appVersion: app.appVersion, definitionVersion: DEF.definitionVersion,
      bogen: b.id, pseudonym: werte.pseudonym, bereich: werte.bereich, erhebungsmodus: werte.modus,
      papierDatum: werte.modus === 'PAPIER' ? werte.papierDatum : null, angelegtTs: jetzt,
      startTs: werte.modus === 'PAPIER' ? jetzt : null, endTs: null, status: 'laufend', seite: null, seitenzeiten: {},
      exportStatus: 'offen', exportiertTs: null, bestaetigtTs: null, testmodus: istTestPseudonym(app.schema, werte.pseudonym),
    };
    try { await speichereSitzung(app, sitzung); } catch (e) { meldung(`Speichern fehlgeschlagen: ${e.message}`, 'fehler'); start.disabled = false; return; }
    await ergaenzeBereich(app, werte.pseudonym, werte.bereich);
    app.zeige(werte.modus === 'PAPIER' ? 'fbAusfuellen' : 'fbUebergabe', { sitzungId: sitzung.sitzungId });
  };

  ersetze(app.wurzel,
    el('h1', {}, 'Fragebogen vorbereiten'),
    el('p', { class: 'hinweis' }, 'Diese Angaben trägt die Doktorandin ein, bevor das Gerät weitergegeben wird.'),
    el('div', { class: 'formular' },
      auswahlGruppe({
        name: 'fb-bogen', titel: 'Fragebogen', spalten: 1,
        eintraege: verfuegbareBoegen(app).map((b) => ({ code: b.id, label: `${BOGEN_NAME[b.id]}${b.status === 'entwurf' ? ' (Entwurf – nur Probelauf)' : ''}` })),
        wert: null, beiAuswahl: (c) => { werte.bogen = c; pruefe(); },
      }),
      ...code.knoten,
      auswahlGruppe({ name: 'fb-bereich', titel: 'Bereich', eintraege: app.schema.bereiche, wert: werte.bereich, spalten: 2, beiAuswahl: (c) => { werte.bereich = c; pruefe(); } }),
      auswahlGruppe({
        name: 'fb-modus', titel: 'Erhebung', spalten: 1, wert: 'APP',
        eintraege: [{ code: 'APP', label: 'Ausfüllen durch die teilnehmende Person' }, { code: 'PAPIER', label: 'Papierbogen nacherfassen' }],
        beiAuswahl: (c) => { werte.modus = c ?? 'APP'; datumFeld.hidden = werte.modus !== 'PAPIER'; pruefe(); },
      }),
      datumFeld),
    hinweis,
    el('div', { class: 'stapel abstand-oben' }, start,
      el('button', { type: 'button', class: 'gross', 'data-test': 'zurueck', onclick: () => app.zeige('start') }, 'Abbrechen')),
  );
  pruefe();
}

// ===================================================================== Übergabe
export async function zeigeFbUebergabe(app, { sitzungId }) {
  const sitzung = await db.hole(app.db, db.STORES.FB_SITZUNGEN, sitzungId);
  ersetze(app.wurzel,
    el('section', { class: 'uebergabe', 'data-test': 'fb-uebergabe' },
      el('h1', {}, 'Bitte reichen Sie das Gerät an die teilnehmende Person weiter.'),
      el('p', { class: 'hinweis' }, `${BOGEN_NAME[sitzung.bogen]} · ${sitzung.pseudonym}`),
      el('button', {
        type: 'button', class: 'primaer gross', 'data-test': 'fb-start',
        onclick: async () => {
          const s = { ...sitzung, startTs: sitzung.startTs ?? Date.now() };
          await speichereSitzung(app, s);
          app.zeige('fbAusfuellen', { sitzungId });
        },
      }, 'Start'),
      el('button', { type: 'button', class: 'gross abstand-oben', 'data-test': 'zurueck', onclick: () => app.zeige('start') }, 'Zurück (Doktorandin)')));
}

// ===================================================================== Ausfüllen
export async function zeigeFbAusfuellen(app, { sitzungId }) {
  let sitzung = await db.hole(app.db, db.STORES.FB_SITZUNGEN, sitzungId);
  const b = bogenNach(DEF, sitzung.bogen);
  const antworten = await db.holeFbAntworten(app.db, sitzungId);
  let stand = berechneStand(b, antworten);
  let seite = sitzung.seite && seiten(b, stand).includes(sitzung.seite) ? sitzung.seite : seiten(b, stand)[0];
  let seiteSeit = Date.now();
  const inhalt = el('div', { class: 'fb-seite' });
  document.body.classList.add('fbmodus');

  /** Speichert eine Antwort sofort und zeichnet die Seite neu (Filter können Fragen ein- oder ausblenden). */
  async function antworte(zelle, wert, wertText = '', { weiter = false } = {}) {
    const a = { sitzungId, itemId: zelle.id, v: zelle.v, wert: wert ?? null, wertText, ts: Date.now() };
    try { await db.schreibeFb(app.db, { antworten: [a] }); } catch (e) { meldung(`Speichern fehlgeschlagen: ${e.message}`, 'fehler'); return; }
    antworten[zelle.id] = a;
    stand = berechneStand(b, antworten);
    zeichne();
    if (weiter) springeNach(zelle.id);
  }

  /** Nach einem Tipp in Skala oder Matrix zur nächsten sichtbaren Frage bzw. Zeile scrollen. */
  function springeNach(zellId) {
    const sichtbar = [...inhalt.querySelectorAll('[data-sprung]')];
    const i = sichtbar.findIndex((k) => k.dataset.sprung.split(' ').includes(zellId));
    const naechste = sichtbar[i + 1];
    if (naechste && !naechste.dataset.sprung.split(' ').every((id) => stand.zellen.get(id)?.status === 'beantwortet')) {
      naechste.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }
  }

  async function wechsleSeite(ziel) {
    const zeiten = { ...sitzung.seitenzeiten, [seite]: (sitzung.seitenzeiten?.[seite] ?? 0) + (Date.now() - seiteSeit) / 1000 };
    sitzung = { ...sitzung, seitenzeiten: zeiten, seite: ziel ?? seite };
    await speichereSitzung(app, sitzung, antworten);
    seiteSeit = Date.now();
    if (ziel) { seite = ziel; zeichne(); window.scrollTo(0, 0); }
  }

  async function weiter() {
    const offen = offeneFragen(stand, seite);
    const hinweise = pruefhinweise(b, stand, seite);
    if (offen > 0 || hinweise.length > 0) {
      const text = [offen > 0 ? `${offen} ${offen === 1 ? 'Frage ist' : 'Fragen sind'} noch offen – trotzdem weiter?` : '', ...hinweise.map((h) => h.text)].filter(Boolean).join(' ');
      if (!(await bestaetige('Hinweis', text, { ja: 'Trotzdem weiter', nein: 'Zurück zur Seite' }))) return;
    }
    const liste = seiten(b, stand);
    const i = liste.indexOf(seite);
    if (i < liste.length - 1) { await wechsleSeite(liste[i + 1]); return; }
    // Abschließen
    await wechsleSeite(null);
    sitzung = { ...sitzung, status: 'abgeschlossen', endTs: Date.now() };
    await speichereSitzung(app, sitzung, antworten);
    app.zeige('fbDanke', { sitzungId });
  }

  function zeichne() {
    const liste = seiten(b, stand);
    if (!liste.includes(seite)) seite = liste.find((s) => b.abschnitte.findIndex((a) => a.id === s) >= b.abschnitte.findIndex((a) => a.id === seite)) ?? liste.at(-1);
    const nr = liste.indexOf(seite);
    const a = b.abschnitte.find((x) => x.id === seite);
    const letzte = nr === liste.length - 1;
    ersetze(inhalt,
      el('p', { class: 'fortschritt', 'data-test': 'fb-fortschritt' }, `Abschnitt ${nr + 1} von ${liste.length}`),
      el('div', { class: 'fortschritt-balken', 'aria-hidden': 'true' }, el('span', { style: `width:${Math.round(((nr + 1) / liste.length) * 100)}%` })),
      nr === 0 ? el('div', { class: 'fb-einleitung', 'data-test': 'fb-einleitung' },
        el('p', {}, `Bearbeitungszeit ca. ${b.dauerMin} Minuten. ${b.einleitung}`)) : null,
      el('h2', { 'data-test': 'fb-abschnitt' }, `${a.id}  ${a.titel}`),
      items(b).filter((it) => it.abschnitt === seite).map((it) => zeichneItem(it)),
      (b.softSkips ?? []).filter((s) => s.nachAbschnitt === seite).map((s) => zeichneSprung(s)),
      pruefhinweise(b, stand, seite).map((h) => el('p', { class: 'feldfehler', 'data-test': `fb-pruefung-${h.itemId}` }, h.text)),
      el('div', { class: 'fb-navigation' },
        el('button', { type: 'button', 'data-test': 'fb-zurueck', disabled: nr === 0, onclick: () => wechsleSeite(liste[nr - 1]) }, 'Zurück'),
        el('button', { type: 'button', class: 'primaer', 'data-test': letzte ? 'fb-abschliessen' : 'fb-weiter', onclick: weiter }, letzte ? 'Abschließen' : 'Weiter')));
  }

  const e = (id) => stand.zellen.get(id);

  function optionKnopf(zelle, code, label, { weiter: spring = false, klein = false } = {}) {
    const an = e(zelle.id)?.wert === code && e(zelle.id).status !== 'automatisch';
    return el('button', {
      type: 'button', class: `option${klein ? ' klein' : ''}`, 'aria-pressed': an ? 'true' : 'false', 'data-test': `fb-${zelle.id}-${code}`,
      onclick: () => antworte(zelle, an ? null : code, '', { weiter: spring && !an }),
    }, label);
  }

  function textFeld(zelle, { mehrzeilig = false } = {}) {
    const wert = antworten[zelle.id]?.wertText ?? '';
    const attr = { 'data-test': `fb-${zelle.id}`, onchange: (ev) => antworte(zelle, null, ev.target.value.trim()) };
    return mehrzeilig ? el('textarea', { rows: 3, ...attr }, wert) : el('input', { type: 'text', value: wert, ...attr });
  }

  function zahlFeld(zelle) {
    const a = antworten[zelle.id]?.wert;
    const auto = e(zelle.id)?.status === 'automatisch';
    return el('input', {
      type: 'number', inputmode: 'numeric', min: zelle.min ?? undefined, max: zelle.max ?? undefined, class: 'zahl-feld',
      value: a ?? '', placeholder: auto ? String(e(zelle.id).wert) : '', 'data-test': `fb-${zelle.id}`,
      onchange: (ev) => { const t = ev.target.value.trim(); antworte(zelle, t === '' ? null : Number(t)); },
    });
  }

  function zeichneItem(it) {
    const zellen = [...stand.zellen.values()].filter((x) => x.zelle.itemId === it.id);
    if (it.typ === 'info') {
      if (it.showIf && !erfuellt(it.showIf, (id) => stand.zellen.get(id)?.wert ?? null, stand.ids)) return null;
      return it.unterueberschrift ? el('h3', { class: 'fb-unter' }, it.text) : el('p', { class: 'fb-info' }, it.text);
    }
    if (!zellen.some((x) => x.sichtbar)) return null;
    const haupt = e(it.id);
    const kopf = it.typ === 'zahl' && it.text.includes('___') ? null : el('p', { class: 'frage-text' }, el('span', { class: 'frage-nr' }, it.id), ' ', it.text);
    let koerper;
    switch (it.typ) {
      case 'einfach': {
        const txt = e(`${it.id}_TXT`);
        koerper = [
          el('div', { class: 'optionen' }, sichtbareOptionen(it, stand).map(([c, l]) => optionKnopf(haupt.zelle, c, l))),
          txt?.sichtbar ? el('label', { class: 'feld' }, el('span', { class: 'hinweis' }, 'Bitte angeben:'), textFeld(txt.zelle)) : null,
        ];
        break;
      }
      case 'zahl': {
        const [vor, nach] = it.text.includes('___') ? it.text.split('___') : [null, null];
        koerper = el('div', { class: 'zahl-zeile' },
          vor !== null ? el('span', { class: 'frage-text' }, el('span', { class: 'frage-nr' }, it.id), ' ', vor) : null,
          zahlFeld(haupt.zelle),
          el('span', {}, nach ?? it.einheit ?? ''));
        break;
      }
      case 'text':
      case 'freitext':
        koerper = [textFeld(haupt.zelle, { mehrzeilig: true }), it.hinweis ? el('p', { class: 'hinweis' }, it.hinweis) : null];
        break;
      case 'skala': {
        const werte = [];
        for (let w = it.min; w <= it.max; w++) werte.push([w, String(w)]);
        koerper = [
          el('div', { class: `skala anzahl-${werte.length}` },
            werte.map(([c, l]) => optionKnopf(haupt.zelle, c, l, { weiter: true, klein: true }))),
          // Zusatzantworten (z. B. „nicht genutzt“) in eigener Zeile: auf schmalen Geräten sonst zu eng
          it.zusatz?.length ? el('div', { class: 'skala-zusatz' },
            it.zusatz.map(([c, l]) => optionKnopf(haupt.zelle, c, l, { weiter: true, klein: true }))) : null,
          el('p', { class: 'anker' }, Object.entries(it.anker ?? {}).map(([w, l]) => `${w} = ${l}`).join(' · ')),
        ];
        break;
      }
      case 'prozentgruppe': {
        const summe = it.zeilen.reduce((s, [z]) => s + (e(`${it.id}_${z}`).wert === 1 ? (e(`${it.id}_${z}_PCT`).wert ?? 0) : 0), 0);
        koerper = [
          it.zeilen.map(([z, label]) => {
            const an = e(`${it.id}_${z}`);
            const pct = e(`${it.id}_${z}_PCT`);
            const txt = e(`${it.id}_${z}_TXT`);
            return el('div', { class: 'prozent-zeile' },
              el('button', {
                type: 'button', class: 'option', 'aria-pressed': an.wert === 1 ? 'true' : 'false', 'data-test': `fb-${an.zelle.id}`,
                onclick: () => antworte(an.zelle, an.wert === 1 ? 0 : 1),
              }, label),
              pct.sichtbar ? el('span', { class: 'prozent-feld' }, zahlFeld(pct.zelle), ' %', pct.status === 'automatisch' ? el('span', { class: 'hinweis' }, ' (automatisch)') : null) : null,
              txt?.sichtbar ? textFeld(txt.zelle) : null);
          }),
          el('p', { class: 'hinweis', 'data-test': `fb-summe-${it.id}` }, `Summe: ${summe} %`),
        ];
        break;
      }
      case 'matrix':
        koerper = it.zeilen.map(([z, label]) => {
          const zz = zellen.filter((x) => x.zelle.zeile === z);
          if (!zz.some((x) => x.sichtbar)) return null;
          return el('div', { class: 'matrix-karte', 'data-sprung': zz.map((x) => x.zelle.id).join(' ') },
            el('p', { class: 'matrix-zeile' }, label),
            zz.filter((x) => x.sichtbar).map((x) => {
              const g = it.gruppen.find((gg) => gg.id === x.zelle.gruppe);
              return el('div', { class: 'matrix-gruppe' },
                it.gruppen.length > 1 || g.titel ? el('span', { class: 'matrix-titel' }, it.gruppen.length > 1 ? `${g.id}  ${g.titel}` : g.titel) : null,
                el('div', { class: `optionen-reihe anzahl-${g.optionen.length}${g.optionen.some(([, l]) => l.length > 6) ? ' lang' : ''}` }, g.optionen.map(([c, l]) => optionKnopf(x.zelle, c, l, { weiter: true, klein: true }))));
            }));
        });
        break;
      default:
        koerper = null;
    }
    return el('div', { class: `frage${it.typ === 'matrix' ? ' frage-matrix' : ''}`, 'data-item': it.id, 'data-sprung': it.typ === 'matrix' ? undefined : it.id }, kopf, [koerper].flat(3));
  }

  function zeichneSprung(s) {
    const zelle = e(s.id);
    if (!zelle?.sichtbar) return null;
    return el('div', { class: 'frage sprung', 'data-test': 'fb-sprung', 'data-sprung': s.id },
      el('p', { class: 'frage-text' }, s.text),
      el('div', { class: 'optionen' }, optionKnopf(zelle.zelle, 1, 'Ja, überspringen'), optionKnopf(zelle.zelle, 2, 'Nein')));
  }

  ersetze(app.wurzel,
    el('header', { class: 'fb-kopf' }, el('h1', {}, b.titel),
      sitzung.testmodus ? el('div', { class: 'banner-test', 'data-test': 'probelauf' }, `Probelauf (${sitzung.pseudonym}) – wird nicht ausgewertet`) : null,
      sitzung.erhebungsmodus === 'PAPIER' ? el('p', { class: 'hinweis' }, `Papierbogen nacherfassen · ${sitzung.pseudonym} · ${sitzung.papierDatum}`) : null),
    inhalt);
  zeichne();
  return () => document.body.classList.remove('fbmodus');
}

// ===================================================================== Dank und Rückkehr
export async function zeigeFbDanke(app, { sitzungId }) {
  const sitzung = await db.hole(app.db, db.STORES.FB_SITZUNGEN, sitzungId);
  const b = bogenNach(DEF, sitzung.bogen);
  let timer = null;
  const status = el('span', { class: 'hinweis', 'data-test': 'fb-halten-hinweis' }, '');
  const los = () => { clearTimeout(timer); status.textContent = ''; };
  const knopf = el('button', {
    type: 'button', class: 'gross halten', 'data-test': 'fb-zurueck-halten',
    onpointerdown: () => {
      status.textContent = 'Gedrückt halten …';
      timer = setTimeout(() => { timer = null; app.zeige('fbStatus', { sitzungId }); }, HALTEN_MS);
    },
    onpointerup: los, onpointerleave: los, onpointercancel: los,
    oncontextmenu: (ev) => ev.preventDefault(),
  }, 'Zurück zur Studienansicht (2 s gedrückt halten)');
  ersetze(app.wurzel,
    el('section', { class: 'danke', 'data-test': 'fb-danke' },
      el('h1', {}, b.abschluss),
      sitzung.erhebungsmodus === 'APP' ? el('p', {}, 'Bitte geben Sie das Gerät zurück.') : null),
    el('div', { class: 'stapel abstand-oben' }, knopf, status));
  return () => clearTimeout(timer);
}

// ===================================================================== Statusansicht (Doktorandin, ohne Antworten)
export async function zeigeFbStatus(app, { sitzungId }) {
  const sitzung = await db.hole(app.db, db.STORES.FB_SITZUNGEN, sitzungId);
  const antworten = await db.holeFbAntworten(app.db, sitzungId);
  const b = bogenNach(DEF, sitzung.bogen);
  const k = zusammenfassungStand(berechneStand(b, antworten));
  const datei = fbExportDatei(app, sitzung, antworten);
  const ziel = { store: db.STORES.FB_SITZUNGEN, schluessel: sitzungId, nachher: () => app.zeige('fbStatus', { sitzungId }) };
  const EXPORT = { offen: 'nicht exportiert', exportiert: 'exportiert – Eingang noch nicht bestätigt', bestaetigt: 'Eingang bestätigt' };
  ersetze(app.wurzel,
    el('h1', {}, 'Fragebogen abgeschlossen'),
    sitzung.testmodus ? el('div', { class: 'banner-test', 'data-test': 'probelauf' }, 'Probelauf – Datei beginnt mit HXNOW_TEST_ und wird nicht ausgewertet') : null,
    el('dl', { class: 'eckdaten', 'data-test': 'fb-eckdaten' },
      el('dt', {}, 'Fragebogen'), el('dd', {}, BOGEN_NAME[sitzung.bogen]),
      el('dt', {}, 'Studien-Code'), el('dd', { 'data-test': 'fb-status-code' }, sitzung.pseudonym),
      el('dt', {}, 'Erhebung'), el('dd', {}, sitzung.erhebungsmodus === 'PAPIER' ? `Papier (${sitzung.papierDatum})` : 'App'),
      el('dt', {}, 'Status'), el('dd', { 'data-test': 'fb-status' }, sitzung.status),
      el('dt', {}, 'Beginn'), el('dd', {}, sitzung.startTs ? `${datumLokal(sitzung.startTs)} ${uhrzeit(sitzung.startTs)}` : '–'),
      el('dt', {}, 'Dauer'), el('dd', { 'data-test': 'fb-dauer' }, sitzung.endTs ? `${formatiereCountdown(sitzung.endTs - sitzung.startTs)} min` : '–'),
      el('dt', {}, 'Antworten'), el('dd', { 'data-test': 'fb-anzahl' }, `${k.beantwortet} beantwortet, ${k.ausgelassen} offen gelassen`),
      el('dt', {}, 'Export'), el('dd', { 'data-test': 'fb-export-status' }, EXPORT[sitzung.exportStatus])),
    el('p', { class: 'hinweis' }, 'Die Antworten werden hier bewusst nicht angezeigt.'),
    sitzung.status === 'abgeschlossen' ? el('div', { class: 'stapel abstand-oben' },
      el('button', { type: 'button', class: 'primaer gross', 'data-test': 'exportieren', onclick: () => exportiere(app, datei, ziel) },
        sitzung.exportStatus === 'offen' ? 'Exportieren' : 'Erneut exportieren'),
      el('button', { type: 'button', 'data-test': 'andere-wege', onclick: () => andereWege(app, datei, ziel) }, 'Andere Exportwege (Download, Mail, Zwischenablage)'),
      el('button', { type: 'button', 'data-test': 'bestaetigen', disabled: sitzung.exportStatus !== 'exportiert', onclick: () => bestaetigeEingang(app, ziel) }, 'Eingang bestätigt')) : null,
    el('button', { type: 'button', class: 'gross abstand-oben', 'data-test': 'zur-startseite', onclick: () => app.zeige('start') }, 'Zur Startseite'));
}

/** Unterbrochene Sitzung abbrechen (Startseite, mit Rückfrage). */
export async function brecheFbAb(app, sitzung) {
  if (!(await bestaetige('Fragebogen abbrechen?', `${BOGEN_NAME[sitzung.bogen]} von ${sitzung.pseudonym} wird als „abgebrochen“ gespeichert und nicht exportiert.`, { ja: 'Abbrechen', nein: 'Zurück', gefahr: true }))) return;
  const s = { ...sitzung, status: 'abgebrochen', endTs: Date.now() };
  await speichereSitzung(app, s, await db.holeFbAntworten(app.db, sitzung.sitzungId));
  app.zeige('start');
}

export { BOGEN_NAME };
