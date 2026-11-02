// Export-Bedienung: Exportwege in der Reihenfolge der Spezifikation (7.4) und Statusverwaltung.
//
// exportiere() ist bewusst SYNCHRON und muss direkt im Klick-Handler aufgerufen werden:
// Safari erlaubt navigator.share() nur unmittelbar aus einer Nutzergeste. Die Datei muss deshalb
// bereits vor dem Klick (aus dem Zustand im Speicher) vorliegen bzw. synchron erzeugt werden.
// Statusänderungen in der Datenbank erfolgen erst nach dem Teilen.
import { el, dialog, bestaetige, meldung } from './dom.js';
import { versucheTeilen, ladeHerunter, mailtoUrl, kopiereInZwischenablage } from '../export.js';
import * as db from '../db.js';

/**
 * @param {object} app
 * @param {{ dateiname, inhalt, typ }} datei
 * @param {{ store?: string, schluessel?: any, nachher?: () => void }} ziel Datensatz, dessen Status gesetzt wird
 */
export function exportiere(app, datei, ziel = {}) {
  let teilen = null;
  try {
    teilen = versucheTeilen(datei); // synchron, kein await davor
  } catch {
    teilen = null;
  }
  if (!teilen) {
    andereWege(app, datei, ziel);
    return;
  }
  teilen.then(
    (ergebnis) => {
      if (ergebnis === 'geteilt') markiereExportiert(app, datei, ziel);
      else meldung('Teilen abgebrochen – der Eintrag bleibt „nicht exportiert“.');
    },
    () => andereWege(app, datei, ziel, 'Teilen ist nicht möglich. Bitte einen anderen Weg wählen.'),
  );
}

/** Wege 2–4: Download, Mail, Zwischenablage. */
export function andereWege(app, datei, ziel = {}, hinweis = null) {
  const mail = mailtoUrl(datei, app.schema);
  dialog('Exportieren', (schliessen) => [
    hinweis ? el('p', { class: 'feldfehler' }, hinweis) : null,
    el('p', { class: 'hinweis' }, datei.dateiname),
    el('div', { class: 'stapel' },
      el('button', {
        type: 'button', class: 'primaer', 'data-test': 'weg-download',
        onclick: () => {
          ladeHerunter(datei);
          schliessen();
          frageNach(app, datei, ziel, 'Datei gespeichert?', 'Wurde die Datei gespeichert bzw. auf das Klinikumssystem übertragen?');
        },
      }, 'Datei herunterladen'),
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

async function frageNach(app, datei, ziel, titel, text) {
  if (await bestaetige(titel, text, { ja: 'Ja', nein: 'Nein' })) markiereExportiert(app, datei, ziel);
  else meldung('Der Eintrag bleibt „nicht exportiert“.');
}

async function markiereExportiert(app, datei, { store, schluessel, nachher }) {
  if (!store) { meldung('Exportiert.'); return; }
  try {
    await db.setzeExportStatus(app.db, store, schluessel, 'exportiert');
    meldung(`Exportiert: ${datei.dateiname}`);
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
