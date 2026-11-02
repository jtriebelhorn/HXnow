// „Person nicht angetroffen“: dokumentiert einen Versuch ohne Episoden (Spezifikation 4 und 6, Store `versuche`).
import { el, ersetze, kommentarFeld, meldung } from './dom.js';
import { stammdatenFormular } from './blockneu.js';
import * as db from '../db.js';

export function zeigeVersuch(app) {
  let laeuft = false;
  const kommentar = kommentarFeld({ testId: 'versuch-kommentar' });
  const speichern = el('button', {
    type: 'button', class: 'primaer gross', disabled: true, 'data-test': 'versuch-speichern',
    onclick: async () => {
      if (laeuft || !form.gueltig()) return;
      laeuft = true;
      const w = form.werte;
      const versuch = {
        versuchId: app.uuid(),
        geraeteId: app.meta.geraeteId,
        schemaVersion: app.schema.schemaVersion,
        appVersion: app.appVersion,
        pseudonym: w.pseudonym,
        beobachter: w.beobachter,
        bereich: w.bereich,
        dienst: w.dienst,
        phase: w.phase,
        ts: Date.now(),
        kommentar: kommentar.feld.value.trim(),
        exportStatus: 'offen',
        exportiertTs: null,
        bestaetigtTs: null,
      };
      try {
        await db.speichere(app.db, db.STORES.VERSUCHE, versuch);
      } catch (e) {
        meldung(`Speichern fehlgeschlagen: ${e.message}`, 'fehler');
        laeuft = false;
        return;
      }
      meldung(`Versuch für ${versuch.pseudonym} gespeichert.`);
      app.zeige('start');
    },
  }, 'Versuch speichern');

  const form = stammdatenFormular(app, () => { speichern.disabled = !form.gueltig(); });

  ersetze(app.wurzel,
    el('h1', {}, 'Person nicht angetroffen'),
    el('p', { class: 'hinweis' }, 'Dokumentiert einen Beobachtungsversuch ohne Episoden. Datum und Uhrzeit setzt die App.'),
    el('div', { class: 'formular' }, form.knoten, kommentar),
    el('div', { class: 'stapel' },
      speichern,
      el('button', { type: 'button', class: 'gross', 'data-test': 'zurueck', onclick: () => app.zeige('start') }, 'Zurück')),
  );
}
