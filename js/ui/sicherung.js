// Datensicherung (PLAN_Logbuch_Datensicherheit 4.4–4.6): Komplettsicherung aller Daten, Wiederherstellen aus
// mehreren Dateien (Erkennung am Inhalt, Prüfsummen, ohne Überschreiben, mit Bericht), Gerät wechseln/stilllegen,
// Löschen bestätigter Einträge (nur mit Sicherheitsabfrage, nie automatisch).
import { el, ersetze, bestaetige, meldung, dialog } from './dom.js';
import * as db from '../db.js';
import { erstelleSicherung, sicherungsDatei } from '../sicherung.js';
import { erkenneDatei, planeWiederherstellung } from '../wiederherstellen.js';
import { istTestPseudonym } from '../schema.js';
import { datumLokal, uhrzeit } from '../zeit.js';
import { exportiere } from './exportieren.js';

/** Komplettsicherung aus geladenen Daten (synchron, für das Teilen in der Nutzergeste). */
export function komplettDatei(app, daten) {
  return sicherungsDatei(erstelleSicherung({
    daten, geraeteId: app.meta.geraeteId, appVersion: app.appVersion, schemaVersion: app.schema.schemaVersion, dbVersion: db.DB_VERSION, now: Date.now(),
  }));
}

const summe = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const mehrzahl = (n, ein, viele) => `${n} ${n === 1 ? ein : viele}`;

/** Bericht der Wiederherstellung als Textzeilen. */
function berichtZeilen(b, importErgebnis = null) {
  const zeit = (ts) => `${datumLokal(ts).split('-').reverse().join('.')} ${uhrzeit(ts).slice(0, 5)}`;
  return [
    `${mehrzahl(b.dateien, 'Datei', 'Dateien')} gelesen: ${mehrzahl(b.komplett, 'Komplettsicherung', 'Komplettsicherungen')}, `
      + `${mehrzahl(b.logbuecher, 'Logbuch-Datei', 'Logbuch-Dateien')}, ${mehrzahl(b.sitzungen, 'Sitzungsdatei', 'Sitzungsdateien')}`
      + `${b.tage ? `, ${mehrzahl(b.tage, 'Tageskennzahl-Datei', 'Tageskennzahl-Dateien')}` : ''}.`,
    b.neuestesLogbuch ? `Neueste Logbuch-Datei: ${b.neuestesLogbuch.name} vom ${zeit(b.neuestesLogbuch.exportTs)} (${b.neuestesLogbuch.standText}).` : null,
    b.ohneLogbuch && b.sitzungen ? `Keine Logbuch-Datei – Logbuch aus den Sitzungsdateien aufgebaut (${mehrzahl(b.aufgebaut, 'Eintrag', 'Einträge')}).` : null,
    b.aufgebaut && !b.ohneLogbuch ? `${mehrzahl(b.aufgebaut, 'Eintrag', 'Einträge')} aus Sitzungsdateien ergänzt.` : null,
    b.geraete.length > 1 ? `Daten von ${b.geraete.length} Geräten.` : null,
    ...b.abgelehnt.map((a) => `Abgelehnt: ${a.name} – ${a.grund}`),
    b.widerrufen.codes.length ? `Widerrufen, nicht übernommen: ${b.widerrufen.codes.join(', ')} (${mehrzahl(b.widerrufen.saetze, 'Datensatz', 'Datensätze')}).` : null,
    b.offeneSitzungen ? `${mehrzahl(b.offeneSitzungen, 'Sitzung', 'Sitzungen')} ohne bestätigten Eingang – bitte prüfen, ob die Dateien im Exportordner liegen.` : null,
    importErgebnis ? `Übernommen: ${summe(importErgebnis.neu)} neu, ${summe(importErgebnis.uebersprungen)} bereits vorhanden (übersprungen).` : null,
  ].filter(Boolean);
}

/** Dateien lesen, Plan zeigen, nach Rückfrage ohne Überschreiben importieren. */
async function ladeDateien(app, files) {
  const dateien = await Promise.all([...files].map(async (f) => erkenneDatei(f.name, await f.text())));
  const brauchbar = dateien.filter((d) => d.typ !== 'unbekannt');
  if (brauchbar.length === 0) {
    meldung(`Import nicht möglich: ${dateien.flatMap((d) => d.fehler).slice(0, 3).join(' ')}`, 'fehler');
    return;
  }
  const vorhandeneTeilnehmende = await db.holeAlle(app.db, db.STORES.TEILNEHMENDE);
  const { stores, bericht } = planeWiederherstellung(dateien, { vorhandeneTeilnehmende, istTest: (p) => istTestPseudonym(app.schema, p) });
  const ok = await new Promise((fertig) => dialog('Sicherung laden', (schliessen) => [
    el('ul', { class: 'bericht', 'data-test': 'wiederherstellen-vorschau' }, berichtZeilen(bericht).map((z) => el('li', {}, z))),
    el('p', { class: 'hinweis' }, 'Vorhandene Einträge auf diesem Gerät werden nicht überschrieben.'),
    el('div', { class: 'stapel' },
      el('button', { type: 'button', class: 'primaer gross', 'data-test': 'wiederherstellen-ja', onclick: () => { schliessen(); fertig(true); } }, 'Übernehmen'),
      el('button', { type: 'button', 'data-test': 'wiederherstellen-nein', onclick: () => { schliessen(); fertig(false); } }, 'Abbrechen')),
  ], { testId: 'dialog-wiederherstellen' }));
  if (!ok) return;
  try {
    const ergebnis = await db.importiere(app.db, stores);
    const fremd = bericht.geraete.filter((g) => g !== app.meta.geraeteId);
    if (fremd.length) {
      const herkunft = [...new Set([...(app.meta.geraeteIdHerkunft ?? []), ...fremd])];
      await db.setzeMeta(app.db, 'geraeteIdHerkunft', herkunft);
      app.meta.geraeteIdHerkunft = herkunft;
    }
    app.teilnehmende = new Map((await db.holeAlle(app.db, db.STORES.TEILNEHMENDE)).map((t) => [t.pseudonym, t]));
    meldung(`Import abgeschlossen: ${summe(ergebnis.neu)} neu, ${summe(ergebnis.uebersprungen)} bereits vorhanden (übersprungen).`);
    app.zeige('sicherung', { bericht: berichtZeilen(bericht, ergebnis) });
  } catch (e) {
    meldung(`Import fehlgeschlagen (${e.message}). Es wurde nichts übernommen.`, 'fehler');
  }
}

const NAMEN = { bloecke: 'Blöcke', episoden: 'Episoden', versuche: 'Versuche', tageskennzahlen: 'Tageskennzahlen', fb_sitzungen: 'Fragebögen', teilnehmende: 'Teilnehmende', logbuch: 'Logbuch-Einträge' };

export async function zeigeSicherung(app, { bericht = null } = {}) {
  const daten = await db.holeAlleDaten(app.db);
  const bestaetigt = {
    bloecke: daten.bloecke.filter((b) => b.exportStatus === 'bestaetigt' && b.status !== 'laufend').length,
    versuche: daten.versuche.filter((v) => v.exportStatus === 'bestaetigt').length,
    tageskennzahlen: daten.tageskennzahlen.filter((t) => t.exportStatus === 'bestaetigt').length,
  };
  const nBestaetigt = bestaetigt.bloecke + bestaetigt.versuche + bestaetigt.tageskennzahlen;
  const nVerworfen = daten.bloecke.filter((b) => b.status === 'verworfen').length;

  const dateiFeld = el('input', {
    type: 'file', multiple: true, accept: '.csv,.json,text/csv,application/json', class: 'unsichtbar', 'data-test': 'import-datei',
    onchange: () => {
      const files = [...(dateiFeld.files ?? [])];
      dateiFeld.value = '';
      if (files.length) ladeDateien(app, files);
    },
  });
  const stillgelegt = Boolean(app.meta.stillgelegt);

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
      onclick: () => {
        exportiere(app, komplettDatei(app, daten));
        db.setzeMeta(app.db, 'letzteKomplettsicherungTs', Date.now()).catch(() => {});
      },
    }, 'Komplettsicherung erstellen'),

    el('h2', {}, 'Wiederherstellen'),
    el('p', { class: 'hinweis' }, 'Im Exportordner alle Dateien markieren (Komplettsicherungen, Logbuch-Dateien, Sitzungsdateien). '
      + 'Die App erkennt jede Datei am Inhalt, prüft die Prüfsummen und nimmt die neueste Logbuch-Datei. '
      + 'Vorhandene Einträge werden nicht überschrieben, doppelte werden übersprungen.'),
    dateiFeld,
    el('button', { type: 'button', class: 'gross', 'data-test': 'json-import', onclick: () => dateiFeld.click() }, 'Sicherung laden'),
    bericht ? el('section', { class: 'warnkasten', 'data-test': 'wiederherstellen-bericht' },
      el('h3', {}, 'Bericht'), el('ul', { class: 'bericht' }, bericht.map((z) => el('li', {}, z)))) : null,

    el('h2', {}, 'Gerät wechseln'),
    el('ol', { class: 'hinweis' },
      el('li', {}, 'Auf diesem Gerät „Komplettsicherung erstellen“ und im Exportordner speichern.'),
      el('li', {}, 'Auf dem neuen Gerät die App installieren, „Sicherung laden“ und die Dateien wählen.'),
      el('li', {}, 'Dieses Gerät stilllegen: Es nimmt dann keine neuen Erhebungen mehr an.')),
    stillgelegt
      ? el('button', {
        type: 'button', class: 'gross', 'data-test': 'geraet-reaktivieren',
        onclick: async () => {
          if (!(await bestaetige('Stilllegung aufheben?', 'Dieses Gerät nimmt danach wieder Erhebungen an. Nur aufheben, wenn das andere Gerät nicht mehr genutzt wird.', { ja: 'Aufheben', nein: 'Zurück' }))) return;
          await db.setzeMeta(app.db, 'stillgelegt', false);
          app.meta.stillgelegt = false;
          app.zeige('sicherung');
        },
      }, 'Stilllegung aufheben')
      : el('button', {
        type: 'button', class: 'gefahr gross', 'data-test': 'geraet-stilllegen',
        onclick: async () => {
          if (!(await bestaetige('Gerät stilllegen?', 'Vorher eine Komplettsicherung erstellen und auf dem neuen Gerät laden. Danach sind auf diesem Gerät keine neuen Blöcke, Versuche und Fragebögen mehr möglich; Daten bleiben erhalten und exportierbar.', { ja: 'Stilllegen', nein: 'Zurück', gefahr: true }))) return;
          await db.setzeMeta(app.db, 'stillgelegt', true);
          app.meta.stillgelegt = true;
          app.zeige('sicherung');
        },
      }, 'Gerät stilllegen'),

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
