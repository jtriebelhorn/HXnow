// Block anlegen (Spezifikation 7.2): Blockdauer, Studien-Code, Beobachter, Bereich, Dienst, Phase, Arbeitskontext.
// „Block starten“ erst aktiv, wenn alle Felder gültig sind. Datum und Uhrzeit setzt die App.
import { el, ersetze, auswahlGruppe, komfort, meldung } from './dom.js';
import * as B from '../block.js';
import * as db from '../db.js';
import { blockDauerOptionen } from '../schema.js';

/**
 * Gemeinsame Felder für Block und Versuch. Liefert { knoten, werte, gueltig() }.
 * Pflicht bzw. optional laut `pflichtangaben` im Kodierschema; optionale Felder sind gekennzeichnet
 * und lassen sich durch erneutes Tippen wieder abwählen.
 * art 'block': zusätzlich Arbeitskontext (zweistufig: Gruppe, bei mehreren Einträgen dann Unterauswahl).
 */
export function stammdatenFormular(app, beiAenderung, { art = 'versuch' } = {}) {
  const mitKontext = art === 'block';
  const optional = (feld) => !B.istPflicht(app.schema, art, feld);
  const { schema } = app;
  const letzter = komfort.lesen('beobachter');
  const werte = {
    pseudonym: '',
    beobachter: schema.beobachter.includes(letzter) ? letzter : (schema.beobachter.length === 1 ? schema.beobachter[0] : null),
    bereich: schema.bereiche.length === 1 ? schema.bereiche[0].code : null,
    dienst: null,
    phase: null,
    arbeitskontext: null,
  };

  const code = codeAuswahl(app, { art, werte, beiAenderung });

  const setze = (feld) => (code) => {
    werte[feld] = code;
    if (feld === 'beobachter' && code) komfort.schreiben('beobachter', code);
    beiAenderung();
  };

  const knoten = [
    ...code.knoten,
    auswahlGruppe({ name: 'phase', titel: 'Phase', eintraege: schema.phasen, wert: werte.phase, beiAuswahl: setze('phase'), spalten: 2, optional: optional('phase') }),
    auswahlGruppe({ name: 'bereich', titel: 'Bereich', eintraege: schema.bereiche, wert: werte.bereich, beiAuswahl: setze('bereich'), spalten: 2, optional: optional('bereich') }),
    // Nur ein Beobachter im Kodierschema → Kürzel automatisch, keine Auswahl anzeigen
    schema.beobachter.length === 1 ? null : auswahlGruppe({ name: 'beobachter', titel: 'Beobachter', eintraege: schema.beobachter.map((b) => ({ code: b, label: b })), wert: werte.beobachter, beiAuswahl: setze('beobachter'), spalten: 4, optional: optional('beobachter') }),
    auswahlGruppe({ name: 'dienst', titel: 'Dienst', eintraege: schema.dienste, wert: werte.dienst, beiAuswahl: setze('dienst'), optional: optional('dienst') }),
    mitKontext ? kontextAuswahl(schema, (code) => { werte.arbeitskontext = code; beiAenderung(); }, optional('arbeitskontext')) : null,
  ];
  return { knoten, werte, gueltig: () => Object.keys(B.pruefeStammdaten(schema, werte, art)).length === 0 };
}

/**
 * Studien-Code aus der Teilnehmerliste (Fragebogenplan 2a): Suchfeld, Treffer zum Antippen; ein neuer Code wird nur
 * über „Neuen Code anlegen“ aufgenommen. Widerrufen/ausgeschieden: keine neue Erfassung. Der Test-Code ist immer erlaubt.
 * Setzt `werte.pseudonym` nur bei zulässigem Code (sonst leer).
 */
export function codeAuswahl(app, { art = 'block', werte, beiAenderung }) {
  const { schema } = app;
  const codeFehler = el('span', { class: 'feldfehler', 'aria-live': 'polite', 'data-test': 'pseudonym-fehler' });
  const treffer = el('div', { class: 'code-treffer', 'data-test': 'code-treffer' });
  const codeFeld = el('input', {
    type: 'text', inputmode: 'text', autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
    placeholder: schema.pseudonym.beispiel ?? '', 'data-test': 'pseudonym', maxlength: 20,
    oninput: () => pruefeCode(),
  });
  function pruefeCode() {
    const eingabe = codeFeld.value.trim().toUpperCase();
    const liste = app.teilnehmende ?? new Map();
    const t = liste.get(eingabe);
    const istTest = eingabe && eingabe === schema.pseudonym.testCode;
    const muster = new RegExp(schema.pseudonym.muster).test(eingabe);
    werte.pseudonym = istTest || t?.status === 'aktiv' ? eingabe : '';
    codeFehler.textContent = '';
    const knoepfe = [];
    if (t && t.status !== 'aktiv') codeFehler.textContent = `${eingabe} ist ${t.status} – keine neue Erfassung möglich.`;
    else if (eingabe && !muster && !istTest) codeFehler.textContent = B.pruefeStammdaten(schema, { ...werte, pseudonym: eingabe }, art).pseudonym ?? '';
    else if (muster && !t && !istTest) {
      knoepfe.push(el('button', {
        type: 'button', class: 'klein', 'data-test': 'code-anlegen',
        onclick: async () => {
          const satz = { pseudonym: eingabe, bereich: werte.bereich, registriertTs: Date.now(), status: 'aktiv', statusTs: Date.now(), notiz: '', phasenAbweichung: null };
          try { await db.speichere(app.db, db.STORES.TEILNEHMENDE, satz); } catch (e) { meldung(`Speichern fehlgeschlagen: ${e.message}`, 'fehler'); return; }
          liste.set(eingabe, satz);
          app.teilnehmende = liste;
          meldung(`${eingabe} in die Teilnehmerliste aufgenommen.`);
          pruefeCode();
        },
      }, `Neuen Code anlegen: ${eingabe}`));
    }
    if (eingabe && !t) {
      for (const p of [...liste.values()].filter((x) => x.pseudonym.startsWith(eingabe) && x.pseudonym !== eingabe).slice(0, 6)) {
        knoepfe.push(el('button', {
          type: 'button', class: 'klein', 'data-test': `code-${p.pseudonym}`, disabled: p.status !== 'aktiv',
          onclick: () => { codeFeld.value = p.pseudonym; pruefeCode(); },
        }, p.status === 'aktiv' ? p.pseudonym : `${p.pseudonym} (${p.status})`));
      }
    }
    if (werte.pseudonym && t) knoepfe.push(el('span', { class: 'hinweis', 'data-test': 'code-gewaehlt' }, `✓ ${t.pseudonym} aus der Teilnehmerliste${t.bereich ? ` (${t.bereich})` : ''}`));
    ersetze(treffer, knoepfe);
    beiAenderung();
  }

  // Probeläufe mit dem reservierten Test-Code (ENTSCHEIDUNGEN Nr. 18): Export als HXNOW_TEST_…, nicht ausgewertet
  const testCode = schema.pseudonym.testCode;
  const testKnopf = testCode ? el('button', {
    type: 'button', class: 'klein', 'data-test': 'probelauf-code',
    onclick: () => { codeFeld.value = testCode; codeFeld.dispatchEvent(new Event('input')); },
  }, `Probelauf (${testCode})`) : null;

  return {
    knoten: [
      el('label', { class: 'feld' },
        el('span', { class: 'feldname' }, 'Studien-Code'),
        codeFeld, codeFehler, treffer,
        el('span', { class: 'hinweis' }, 'Nur Pseudonym, keine Namen.',
          testCode ? ` Für Tests und Schulung ${testCode} verwenden – wird nicht ausgewertet.` : '')),
      testKnopf,
    ],
  };
}

/** Arbeitskontext zweistufig: erst Gruppe (Station, Funktionsbereich …), bei mehreren Einträgen dann die Unterauswahl. */
function kontextAuswahl(schema, beiAuswahl, optional) {
  const gruppen = [...new Set(schema.arbeitskontext.map((k) => k.gruppe))];
  const unter = el('div', { class: 'unterauswahl' });
  const box = el('div', { class: 'feld' },
    auswahlGruppe({
      name: 'kontextgruppe', titel: 'Arbeitskontext',
      eintraege: gruppen.map((g) => ({ code: g, label: g })),
      wert: null,
      spalten: 2,
      optional,
      beiAuswahl: (gruppe) => {
        if (gruppe === null) { ersetze(unter); beiAuswahl(null); return; }
        const eintraege = schema.arbeitskontext.filter((k) => k.gruppe === gruppe);
        if (eintraege.length === 1) {
          ersetze(unter);
          beiAuswahl(eintraege[0].code);
          return;
        }
        beiAuswahl(null);
        ersetze(unter, auswahlGruppe({
          name: 'kontext', titel: gruppe, eintraege, wert: null, spalten: Math.min(eintraege.length, 3), beiAuswahl,
        }));
      },
    }),
    unter);
  return box;
}

export function zeigeBlockNeu(app) {
  let laeuft = false;
  const starten = el('button', {
    type: 'button', class: 'primaer gross', disabled: true, 'data-test': 'block-starten',
    onclick: async () => {
      if (laeuft || !form.gueltig()) return;
      if ((await db.offeneFbSitzungen(app.db)).length > 0) {
        meldung('Ein Fragebogen ist noch offen. Bitte auf der Startseite fortsetzen oder abbrechen.', 'fehler');
        return;
      }
      laeuft = true;
      starten.disabled = true;
      const r = B.erzeugeBlock(form.werte, {
        schema: app.schema, now: Date.now, uuid: app.uuid, geraeteId: app.meta.geraeteId, appVersion: app.appVersion,
      });
      if (!r.ok) { meldung(r.fehler, 'fehler'); laeuft = false; starten.disabled = false; return; }
      try {
        await db.schreibeAenderungen(app.db, r.schreiben);
      } catch (e) {
        meldung(`Speichern fehlgeschlagen: ${e.message}`, 'fehler');
        laeuft = false; starten.disabled = false;
        return;
      }
      app.neueSitzung(r.zustand);
      app.zeige('kodierung', { blockId: r.zustand.block.blockId });
    },
  }, 'Block starten');

  const form = stammdatenFormular(app, () => { starten.disabled = !form.gueltig(); }, { art: 'block' });

  // Blockdauer: wählbare Dauern aus dem Kodierschema; letzter Wert vorbelegt, sonst Standard
  const optionen = blockDauerOptionen(app.schema);
  const letzteDauer = Number(komfort.lesen('blockDauerSek'));
  form.werte.blockDauerSek = optionen.includes(letzteDauer) ? letzteDauer : app.schema.blockDauerSek;
  const dauerGruppe = auswahlGruppe({
    name: 'dauer', titel: 'Blockdauer',
    eintraege: optionen.map((d) => ({ code: d, label: `${d / 60} min` })),
    wert: form.werte.blockDauerSek,
    beiAuswahl: (d) => { form.werte.blockDauerSek = d; komfort.schreiben('blockDauerSek', String(d)); starten.disabled = !form.gueltig(); },
    spalten: Math.min(optionen.length, 4),
  });

  ersetze(app.wurzel,
    el('h1', {}, 'Neuer Block'),
    el('div', { class: 'formular' }, optionen.length > 1 ? dauerGruppe : null, form.knoten),
    el('p', { class: 'hinweis' }, 'Startzeit wird beim Tippen auf „Block starten“ gesetzt.'),
    el('div', { class: 'stapel' },
      starten,
      el('button', { type: 'button', class: 'gross', 'data-test': 'zurueck', onclick: () => app.zeige('start') }, 'Zurück')),
  );
}
