// Tageskennzahlen pro Beobachtungstag, Bereich und Teilbereich (Spezifikation 4 und 6, Store `tageskennzahlen`,
// ENTSCHEIDUNGEN Nr. 45). Vorhandene Werte für Datum + Bereich + Teilbereich werden geladen und überschrieben; nach Änderung wieder „offen“ für den Export.
import { el, ersetze, auswahlGruppe, kommentarFeld, komfort, meldung } from './dom.js';
import * as db from '../db.js';
import { datumLokal } from '../zeit.js';
import { pflichtangaben, teilbereiche } from '../schema.js';
import { umsatz } from '../export.js';

export async function zeigeTageskennzahlen(app, params = {}) {
  const { schema } = app;
  const pflicht = pflichtangaben(schema).tageskennzahlen;
  const optional = (f) => !pflicht.includes(f);
  const letzter = komfort.lesen('beobachter');
  const werte = {
    datum: params.datum ?? datumLokal(Date.now()),
    bereich: params.bereich ?? (schema.bereiche.length === 1 ? schema.bereiche[0].code : null),
    teilbereich: params.teilbereich ?? null,
    beobachter: schema.beobachter.includes(letzter) ? letzter : (schema.beobachter.length === 1 ? schema.beobachter[0] : null),
    belegung: null,
    aufnahmen: null,
    entlassungen: null,
    ambulant: null,
    aerzteAnwesend: null,
  };

  const datumFeld = el('input', { type: 'date', value: werte.datum, 'data-test': 'tag-datum', onchange: () => { werte.datum = datumFeld.value; lade(); } });
  const zahl = (name, beschriftung, testId) => {
    const feld = el('input', {
      type: 'number', inputmode: 'numeric', min: 0, max: 999, step: 1, 'data-test': testId,
      oninput: () => { werte[name] = feld.value === '' ? null : Number(feld.value); pruefe(); zeigeUmsatz(); },
    });
    const schritt = (d) => () => {
      const n = Math.max(0, (werte[name] ?? 0) + d);
      werte[name] = n; feld.value = String(n); pruefe(); zeigeUmsatz();
    };
    const knoten = el('div', { class: 'feld' },
      el('span', { class: 'feldname' }, beschriftung, optional(name) ? el('span', { class: 'optional' }, ' (optional)') : null),
      el('div', { class: 'stepper' },
        el('button', { type: 'button', 'aria-label': `${beschriftung} minus 1`, 'data-test': `${testId}-minus`, onclick: schritt(-1) }, '−'),
        feld,
        el('button', { type: 'button', 'aria-label': `${beschriftung} plus 1`, 'data-test': `${testId}-plus`, onclick: schritt(1) }, '+')));
    knoten.setze = (v) => { werte[name] = v ?? null; feld.value = v ?? ''; };
    return knoten;
  };
  // Kodierhandbuch 1.0, 6.2: Belegung nur bei stationären Teilbereichen; Tagesumsatz = Aufnahmen + Entlassungen + ambulant
  const belegung = zahl('belegung', 'Belegung (belegte Betten)', 'tag-belegung');
  const aufnahmen = zahl('aufnahmen', 'Aufnahmen', 'tag-aufnahmen');
  const entlassungen = zahl('entlassungen', 'Entlassungen', 'tag-entlassungen');
  const ambulant = zahl('ambulant', 'Ambulant betreute Patienten (z. B. Ambulanz, Dialyse, Konsile, ZNA)', 'tag-ambulant');
  const aerzte = zahl('aerzteAnwesend', 'Anwesende Ärztinnen und Ärzte', 'tag-aerzte');
  const umsatzText = el('p', { class: 'hinweis', 'data-test': 'tag-umsatz' });
  const zahlFelder = { belegung, aufnahmen, entlassungen, ambulant, aerzteAnwesend: aerzte };
  function zeigeUmsatz() {
    const u = umsatz(werte);
    umsatzText.textContent = u === '' ? 'Tagesumsatz: –' : `Tagesumsatz: ${u} Patienten (Aufnahmen + Entlassungen + ambulant)`;
  }
  const istStationaer = () => Boolean(teilbereiche(schema, werte.bereich).find((t) => t.code === werte.teilbereich)?.stationaer);
  function zeigeBelegung() {
    belegung.hidden = !istStationaer();
    if (belegung.hidden) belegung.setze(null);
  }
  const ereignisse = kommentarFeld({ testId: 'tag-ereignisse', zeilen: 4, titel: 'Besondere Ereignisse', optional: optional('ereignisse'), beiEingabe: () => pruefe() });
  const vorhanden = el('p', { class: 'hinweis', 'data-test': 'tag-vorhanden' });

  const speichern = el('button', {
    type: 'button', class: 'primaer gross', disabled: true, 'data-test': 'tag-speichern',
    onclick: async () => {
      if (!gueltig()) return;
      const satz = {
        datum: werte.datum,
        bereich: werte.bereich,
        teilbereich: werte.teilbereich ?? '',
        belegung: istStationaer() ? werte.belegung : null,
        aufnahmen: werte.aufnahmen,
        entlassungen: werte.entlassungen,
        ambulant: werte.ambulant,
        aerzteAnwesend: werte.aerzteAnwesend,
        ereignisse: ereignisse.feld.value.trim(),
        beobachter: werte.beobachter,
        geraeteId: app.meta.geraeteId,
        schemaVersion: schema.schemaVersion,
        appVersion: app.appVersion,
        ts: Date.now(),
        exportStatus: 'offen',
        exportiertTs: null,
        bestaetigtTs: null,
      };
      try {
        await db.speichere(app.db, db.STORES.TAGESKENNZAHLEN, satz);
      } catch (e) {
        meldung(`Speichern fehlgeschlagen: ${e.message}`, 'fehler');
        return;
      }
      meldung('Tageskennzahlen gespeichert.');
      app.zeige('start');
    },
  }, 'Speichern');

  // Pflicht laut `pflichtangaben.tageskennzahlen` (Standard: Datum und Bereich); Zahlen, wenn angegeben, ganze Zahlen ≥ 0
  function gueltig() {
    const zahlOk = (w) => w === null || (Number.isInteger(w) && w >= 0);
    const vorhanden = {
      datum: /^\d{4}-\d{2}-\d{2}$/.test(werte.datum),
      bereich: Boolean(werte.bereich),
      teilbereich: teilbereiche(schema, werte.bereich).length === 0 || Boolean(werte.teilbereich),
      beobachter: Boolean(werte.beobachter),
      belegung: !istStationaer() || werte.belegung !== null,
      aufnahmen: werte.aufnahmen !== null,
      entlassungen: werte.entlassungen !== null,
      ambulant: werte.ambulant !== null,
      aerzteAnwesend: werte.aerzteAnwesend !== null,
      ereignisse: ereignisse.feld.value.trim() !== '',
    };
    return pflicht.every((f) => vorhanden[f]) && vorhanden.teilbereich && Object.keys(zahlFelder).every((k) => zahlOk(werte[k]));
  }
  function pruefe() { speichern.disabled = !gueltig(); }

  // Beim Wechsel von Datum/Bereich/Teilbereich sofort leeren (vor dem Lesen), damit schnelle Eingaben nicht verloren gehen
  let geladen = null;
  async function lade() {
    pruefe();
    if (!werte.bereich || !werte.datum || !vorhandenTeil()) { vorhanden.textContent = ''; return; }
    const schluessel = [werte.datum, werte.bereich, werte.teilbereich ?? ''];
    if (geladen !== null && geladen !== schluessel.join('|')) {
      for (const z of Object.values(zahlFelder)) z.setze(null);
      ereignisse.feld.value = '';
      vorhanden.textContent = '';
    }
    geladen = schluessel.join('|');
    const satz = await db.hole(app.db, db.STORES.TAGESKENNZAHLEN, schluessel);
    if (geladen !== schluessel.join('|')) return; // inzwischen anders gewählt
    if (satz) {
      for (const [k, z] of Object.entries(zahlFelder)) z.setze(satz[k]);
      ereignisse.feld.value = satz.ereignisse ?? '';
      vorhanden.textContent = 'Für diesen Tag und Teilbereich liegen bereits Werte vor. Speichern überschreibt sie.';
    } else {
      vorhanden.textContent = '';
    }
    pruefe();
  }

  // Teilbereich (z. B. Normalstation, Dialyse …): Auswahl je nach Bereich, Pflicht, wenn der Bereich welche hat
  const vorhandenTeil = () => teilbereiche(schema, werte.bereich).length === 0 || Boolean(werte.teilbereich);
  const teilBox = el('div', { 'data-test': 'tag-teilbereich-box' });
  function zeigeTeilbereiche() {
    const liste = teilbereiche(schema, werte.bereich);
    if (!liste.some((t) => t.code === werte.teilbereich)) werte.teilbereich = liste.length === 1 ? liste[0].code : null;
    ersetze(teilBox, liste.length === 0 ? null : auswahlGruppe({
      name: 'tag-teilbereich', titel: 'Teilbereich', eintraege: liste, wert: werte.teilbereich, spalten: 2,
      beiAuswahl: (c) => { werte.teilbereich = c; zeigeBelegung(); lade(); },
    }));
  }
  zeigeTeilbereiche();
  zeigeBelegung();
  zeigeUmsatz();

  ersetze(app.wurzel,
    el('h1', {}, 'Tageskennzahlen'),
    el('div', { class: 'formular' },
      el('label', { class: 'feld' }, el('span', { class: 'feldname' }, 'Datum'), datumFeld),
      auswahlGruppe({ name: 'tag-bereich', titel: 'Bereich', eintraege: schema.bereiche, wert: werte.bereich, beiAuswahl: (c) => { werte.bereich = c; zeigeTeilbereiche(); zeigeBelegung(); lade(); }, spalten: 2, optional: optional('bereich') }),
      teilBox,
      schema.beobachter.length === 1 ? null : auswahlGruppe({ name: 'tag-beobachter', titel: 'Beobachter', eintraege: schema.beobachter.map((b) => ({ code: b, label: b })), wert: werte.beobachter, beiAuswahl: (c) => { werte.beobachter = c; if (c) komfort.schreiben('beobachter', c); pruefe(); }, spalten: 4, optional: optional('beobachter') }),
      vorhanden,
      belegung, aufnahmen, entlassungen, ambulant, umsatzText, aerzte, ereignisse),
    el('div', { class: 'stapel' },
      speichern,
      el('button', { type: 'button', class: 'gross', 'data-test': 'zurueck', onclick: () => app.zeige('start') }, 'Zurück')),
  );
  await lade();
}
