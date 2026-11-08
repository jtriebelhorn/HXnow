// Datensicherung (PLAN_Logbuch_Datensicherheit 4.4): Komplettsicherung aller Daten, Import ohne Überschreiben,
// Löschen bestätigter Einträge (nur mit Sicherheitsabfrage, nie automatisch).
import { el, ersetze, bestaetige, meldung } from './dom.js';
import * as db from '../db.js';
import { erstelleSicherung, sicherungsDatei, pruefeSicherung, GESICHERTE_STORES } from '../sicherung.js';
import { exportiere } from './exportieren.js';

const NAMEN = { bloecke: 'Blöcke', episoden: 'Episoden', versuche: 'Versuche', tageskennzahlen: 'Tageskennzahlen' };

export async function zeigeSicherung(app) {
  const daten = await db.holeAlleDaten(app.db);
  const bestaetigt = {
    bloecke: daten.bloecke.filter((b) => b.exportStatus === 'bestaetigt' && b.status !== 'laufend').length,
    versuche: daten.versuche.filter((v) => v.exportStatus === 'bestaetigt').length,
    tageskennzahlen: daten.tageskennzahlen.filter((t) => t.exportStatus === 'bestaetigt').length,
  };
  const nBestaetigt = bestaetigt.bloecke + bestaetigt.versuche + bestaetigt.tageskennzahlen;
  const nVerworfen = daten.bloecke.filter((b) => b.status === 'verworfen').length;

  const dateiFeld = el('input', {
    type: 'file', accept: 'application/json,.json', class: 'unsichtbar', 'data-test': 'import-datei',
    onchange: async () => {
      const f = dateiFeld.files?.[0];
      dateiFeld.value = '';
      if (!f) return;
      const { sicherung, fehler } = pruefeSicherung(await f.text());
      if (!sicherung) { meldung(`Import nicht möglich: ${fehler.slice(0, 3).join(' ')}`, 'fehler'); return; }
      const stores = Object.fromEntries(Object.keys(GESICHERTE_STORES).map((n) => [n, sicherung.stores[n]]));
      try {
        const { neu, uebersprungen } = await db.importiere(app.db, stores);
        const summe = (o) => Object.values(o).reduce((a, b) => a + b, 0);
        meldung(`Import abgeschlossen: ${summe(neu)} neu, ${summe(uebersprungen)} bereits vorhanden (übersprungen).`);
        app.zeige('sicherung');
      } catch (e) {
        meldung(`Import fehlgeschlagen (${e.message}). Es wurde nichts übernommen.`, 'fehler');
      }
    },
  });

  ersetze(app.wurzel,
    el('h1', {}, 'Datensicherung'),
    el('table', { class: 'tabelle', 'data-test': 'bestand' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Gespeichert'), el('th', { class: 'zahl' }, 'Anzahl'))),
      el('tbody', {}, Object.keys(NAMEN).map((n) => el('tr', {},
        el('td', {}, NAMEN[n]), el('td', { class: 'zahl', 'data-test': `anzahl-${n}` }, daten[n].length))))),

    el('h2', {}, 'Sichern'),
    el('p', { class: 'hinweis' }, 'Vollständiger Abzug aller Daten als eine Datei – vor jedem Update, am Ende jeder Studienphase und vor einem Gerätewechsel. Die Datei enthält Studiendaten: nur auf Klinikumssystemen ablegen.'),
    el('button', {
      type: 'button', class: 'primaer gross', 'data-test': 'json-export',
      // Datei synchron aus den bereits geladenen Daten erzeugen (Teilen erfordert direkte Nutzergeste).
      onclick: () => exportiere(app, sicherungsDatei(erstelleSicherung({
        daten, geraeteId: app.meta.geraeteId, appVersion: app.appVersion, schemaVersion: app.schema.schemaVersion, now: Date.now(),
      }))),
    }, 'Komplettsicherung erstellen'),

    el('h2', {}, 'Wiederherstellen'),
    el('p', { class: 'hinweis' }, 'Liest eine Sicherung ein. Vorhandene Einträge werden nicht überschrieben, doppelte werden übersprungen.'),
    dateiFeld,
    el('button', { type: 'button', class: 'gross', 'data-test': 'json-import', onclick: () => dateiFeld.click() }, 'Sicherung laden'),

    el('h2', {}, 'Löschen'),
    el('button', {
      type: 'button', class: 'gefahr gross', 'data-test': 'loesche-bestaetigte', disabled: nBestaetigt === 0,
      onclick: async () => {
        const ok = await bestaetige('Bestätigte Einträge löschen?',
          `${bestaetigt.bloecke} Blöcke, ${bestaetigt.versuche} Versuche und ${bestaetigt.tageskennzahlen} Tageskennzahlen, deren Eingang bestätigt ist, werden endgültig von diesem Gerät gelöscht.`,
          { ja: 'Endgültig löschen', nein: 'Abbrechen', gefahr: true });
        if (!ok) return;
        const n = await db.loescheBestaetigte(app.db);
        meldung(`Gelöscht: ${n.bloecke} Blöcke (${n.episoden} Episoden), ${n.versuche} Versuche, ${n.tageskennzahlen} Tageskennzahlen.`);
        app.zeige('sicherung');
      },
    }, `Bestätigte Einträge löschen (${nBestaetigt})`),
    nVerworfen === 0 ? null : el('button', {
      type: 'button', class: 'gefahr gross abstand-oben-klein', 'data-test': 'loesche-verworfene',
      onclick: async () => {
        const ok = await bestaetige('Verworfene Blöcke löschen?',
          `${nVerworfen} verworfene Blöcke werden endgültig von diesem Gerät gelöscht.`,
          { ja: 'Endgültig löschen', nein: 'Abbrechen', gefahr: true });
        if (!ok) return;
        const n = await db.loescheVerworfene(app.db);
        meldung(`Gelöscht: ${n.bloecke} verworfene Blöcke (${n.episoden} Episoden).`);
        app.zeige('sicherung');
      },
    }, `Verworfene Blöcke löschen (${nVerworfen})`),

    el('div', { class: 'stapel abstand-oben' },
      el('button', { type: 'button', class: 'gross', 'data-test': 'zurueck', onclick: () => app.zeige('start') }, 'Zurück')),
  );
}
