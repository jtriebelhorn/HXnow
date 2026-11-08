// Export-Bedienung: Exportwege in der Reihenfolge der Spezifikation (7.4) und Statusverwaltung.
//
// exportiere() ist bewusst SYNCHRON und muss direkt im Klick-Handler aufgerufen werden:
// Safari erlaubt navigator.share() nur unmittelbar aus einer Nutzergeste. Die Datei muss deshalb
// bereits vor dem Klick (aus dem Zustand im Speicher) vorliegen bzw. synchron erzeugt werden.
// Statusänderungen in der Datenbank erfolgen erst nach dem Teilen.
// Sitzungsexporte (mit `ziel.store`) teilen die Logbuch-Datei mit (PLAN_Logbuch_Datensicherheit 4.1): Sie liegt im
// Speicher vor (app.logbuchDateiFuer, synchron) und ersetzt im Exportordner die vorige Fassung.
import { el, dialog, bestaetige, meldung } from './dom.js';
import { versucheTeilen, ladeHerunter, mailtoUrl, kopiereInZwischenablage } from '../export.js';
import * as db from '../db.js';

/**
 * @param {object} app
 * @param {{ dateiname, inhalt, typ }} datei
 * @param {{ store?: string, schluessel?: any, nachher?: () => void }} ziel Datensatz, dessen Status gesetzt wird
 */
export function exportiere(app, datei, ziel = {}) {
  const weitere = logbuchAnhang(app, ziel);
  let teilen = null;
  try {
    teilen = versucheTeilen(datei, undefined, weitere); // synchron, kein await davor
  } catch {
    teilen = null;
  }
  if (!teilen) {
    andereWege(app, datei, ziel);
    return;
  }
  const mitLogbuch = teilen.anzahl > 1 || ziel.nurLogbuch;
  teilen.then(
    (ergebnis) => {
      if (ergebnis !== 'geteilt') { meldung(ziel.nurLogbuch ? 'Teilen abgebrochen – Logbuch nicht gesichert.' : 'Teilen abgebrochen – der Eintrag bleibt „nicht exportiert“.'); return; }
      markiereExportiert(app, datei, ziel, mitLogbuch);
      if (weitere.length && !mitLogbuch) meldung('Dieses Gerät teilt nur eine Datei. Bitte zusätzlich „Logbuch sichern“ tippen.', 'fehler');
    },
    () => andereWege(app, datei, ziel, 'Teilen ist nicht möglich. Bitte einen anderen Weg wählen.'),
  );
}

/** Logbuch-Datei als zweite Datei bei Sitzungsexporten. */
function logbuchAnhang(app, ziel) {
  if (!ziel.store || typeof app.logbuchDateiFuer !== 'function') return [];
  try { return [app.logbuchDateiFuer(ziel.schluessel)]; } catch { return []; }
}

/** „Logbuch sichern“: nur die Logbuch-Datei teilen (synchron aus dem Klick). */
export function sichereLogbuch(app) {
  exportiere(app, app.logbuchDateiFuer(null), { nurLogbuch: true, nachher: () => app.zeige('start') });
}

/** Wege 2–4: Download, Mail, Zwischenablage. */
export function andereWege(app, datei, ziel = {}, hinweis = null) {
  const weitere = logbuchAnhang(app, ziel);
  const mail = mailtoUrl(datei, app.schema);
  dialog('Exportieren', (schliessen) => [
    hinweis ? el('p', { class: 'feldfehler' }, hinweis) : null,
    el('p', { class: 'hinweis' }, datei.dateiname),
    el('div', { class: 'stapel' },
      el('button', {
        type: 'button', class: 'primaer', 'data-test': 'weg-download',
        onclick: () => {
          ladeHerunter(datei);
          for (const w of weitere) ladeHerunter(w);
          schliessen();
          frageNach(app, datei, ziel, weitere.length ? 'Dateien gespeichert?' : 'Datei gespeichert?',
            `Wurde${weitere.length ? 'n Sitzungsdatei und Logbuch' : ' die Datei'} gespeichert bzw. auf das Klinikumssystem übertragen?`, weitere.length > 0 || ziel.nurLogbuch);
        },
      }, weitere.length ? 'Dateien herunterladen (Sitzung und Logbuch)' : 'Datei herunterladen'),
      mail.grund === 'kein-empfaenger' ? null : el('button', {
        type: 'button', 'data-test': 'weg-mail', disabled: !mail.url,
        onclick: () => {
          const a = el('a', { href: mail.url });
          document.body.append(a);
          a.click();
          a.remove();
          schliessen();
          frageNach(app, datei, ziel, 'Mail gesendet?', 'Wurde die Mail mit den Daten abgeschickt?');
        },
      }, 'Per Mail senden'),
      mail.grund === 'zu-lang'
        ? el('p', { class: 'hinweis', 'data-test': 'mail-zu-lang' }, 'Für den Mail-Weg sind die Daten zu lang. Bitte „In Zwischenablage kopieren“ verwenden und den Text in eine Mail einfügen.')
        : null,
      el('button', {
        type: 'button', 'data-test': 'weg-zwischenablage',
        onclick: async () => {
          const ok = await kopiereInZwischenablage(datei);
          schliessen();
          if (!ok) { meldung('Kopieren nicht möglich. Bitte „Datei herunterladen“ verwenden.', 'fehler'); return; }
          frageNach(app, datei, ziel, 'In Zwischenablage kopiert',
            'Die Daten sind kopiert. Bitte in eine Mail an das Studienpostfach einfügen und senden. Wurden sie gesendet?');
        },
      }, 'In Zwischenablage kopieren'),
      el('button', { type: 'button', 'data-test': 'weg-abbrechen', onclick: schliessen }, 'Abbrechen')),
  ], { testId: 'dialog-exportwege' });
}

async function frageNach(app, datei, ziel, titel, text, mitLogbuch = false) {
  if (await bestaetige(titel, text, { ja: 'Ja', nein: 'Nein' })) markiereExportiert(app, datei, ziel, mitLogbuch);
  else meldung('Der Eintrag bleibt „nicht exportiert“.');
}

async function markiereExportiert(app, datei, { store, schluessel, nachher }, mitLogbuch = false) {
  if (mitLogbuch) {
    const ts = Date.now();
    if (app.meta) app.meta.letzteSicherungTs = ts;
    await db.setzeMeta(app.db, 'letzteSicherungTs', ts).catch(() => {});
  }
  if (!store) {
    meldung(mitLogbuch && !datei.dateiname.includes('Logbuch') ? 'Exportiert, Logbuch gesichert.' : mitLogbuch ? 'Logbuch gesichert.' : 'Exportiert.');
    if (nachher) nachher();
    return;
  }
  try {
    await db.setzeExportStatus(app.db, store, schluessel, 'exportiert');
    meldung(`Exportiert: ${datei.dateiname}${mitLogbuch ? ' (mit Logbuch)' : ''}`);
  } catch (e) {
    meldung(`Status konnte nicht gespeichert werden (${e.message}).`, 'fehler');
  }
  if (nachher) nachher();
}

/** „Eingang bestätigt“ mit Sicherheitsabfrage. */
export async function bestaetigeEingang(app, { store, schluessel, nachher }) {
  const ok = await bestaetige('Eingang bestätigen?',
    'Nur bestätigen, wenn die Datei sicher auf dem Klinikumssystem angekommen ist. Danach kann der Eintrag in der Datensicherung gelöscht werden.',
    { ja: 'Eingang bestätigt', nein: 'Zurück' });
  if (!ok) return;
  try {
    await db.setzeExportStatus(app.db, store, schluessel, 'bestaetigt');
    meldung('Eingang bestätigt.');
  } catch (e) {
    meldung(`Status konnte nicht gespeichert werden (${e.message}).`, 'fehler');
  }
  if (nachher) nachher();
}
