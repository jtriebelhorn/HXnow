// Blockabschluss (Spezifikation v2, 7.4): Post-Phase zuerst „War ein HX-Now-Gerät dabei?“, Zusammenfassung
// (beobachtete Zeit, Pausen), Ergänzen unvollständiger Episoden, Blockkommentar, Export und „Eingang bestätigt“.
// Änderungen nach dem Export setzen den Exportstatus zurück auf „offen“ (die exportierte Datei ist dann veraltet);
// nach „Eingang bestätigt“ ist der Block schreibgeschützt.
import { el, ersetze, kommentarFeld, meldung, auswahlGruppe } from './dom.js';
import { pflichtangaben } from '../schema.js';
import * as B from '../block.js';
import * as db from '../db.js';
import { blockDatei } from '../export.js';
import { formatiereCountdown, uhrzeit, datumLokal } from '../zeit.js';
import { exportiere, andereWege, bestaetigeEingang } from './exportieren.js';

const STATUS_TEXT = {
  beendet: { regulaer: 'Regulär beendet', manuell: 'Vorzeitig beendet (Daten behalten)' },
  abgebrochen: 'Abgebrochen',
  verworfen: 'Verworfen (wird nicht exportiert)',
};

const EXPORT_TEXT = { offen: 'nicht exportiert', exportiert: 'exportiert – Eingang noch nicht bestätigt', bestaetigt: 'Eingang bestätigt' };

export async function zeigeAbschluss(app, { blockId }) {
  const { schema } = app;
  const sitzung = await app.sitzungFuer(blockId);
  const finde = (liste, code) => schema[liste].find((e) => e.code === code);
  const label = (liste, code) => finde(liste, code)?.label ?? code;

  /** Exportstatus aus der Datenbank in die Sitzung übernehmen (wird außerhalb von block.js geändert). */
  async function aktualisiere() {
    const b = await db.holeBlock(app.db, blockId);
    if (b) sitzung.laden({ ...sitzung.zustand, block: b });
    zeichne();
  }

  async function aendere(fn, erfolgsText) {
    let r;
    try {
      r = await sitzung.aktion(fn);
    } catch (e) {
      meldung(`Speichern fehlgeschlagen (${e.message}).`, 'fehler');
      return null;
    }
    if (!r.ok) { meldung(r.fehler, 'fehler'); return r; }
    if (sitzung.zustand.block.exportStatus === 'exportiert') {
      // Exportierte Datei ist veraltet → wieder „offen“
      await sitzung.aktion((z) => {
        const block = { ...z.block, exportStatus: 'offen', exportiertTs: null };
        return { ok: true, zustand: { ...z, block }, schreiben: { block, episoden: [], pausen: [] } };
      });
      meldung(`${erfolgsText} Bitte erneut exportieren.`);
    } else if (erfolgsText) {
      meldung(erfolgsText);
    }
    zeichne();
    return r;
  }

  // Post-Phase: Vorbelegung „ja“ übernehmen, wenn der Schalter gesetzt war und noch keine Antwort vorliegt
  {
    const z = sitzung.zustand;
    const vor = B.geraetDabeiVorbelegung(z);
    if (B.mitGeraetDabei(z, schema) && z.block.hxGeraetDabei === null && vor && z.block.status !== 'verworfen') {
      try { await sitzung.aktion((zz, c) => B.beantworteGeraetDabei(zz, vor, c)); } catch { /* Anzeige zeigt dann „offen“ */ }
    }
  }

  function geraetFrage(z, gesperrt) {
    if (!B.mitGeraetDabei(z, schema) || z.block.status === 'verworfen') return null;
    const b = z.block;
    const pflicht = pflichtangaben(schema).geraetDabeiVorExport;
    return el('section', { class: `frage${!b.hxGeraetDabei && pflicht ? ' warnkasten' : ''}`, 'data-test': 'frage-geraet' },
      el('h2', {}, 'War ein HX-Now-Gerät dabei?', pflicht ? null : el('span', { class: 'optional' }, ' (optional)')),
      b.hxGeraetAutomatisch ? el('p', { class: 'hinweis' }, 'HX Now wurde kodiert – „nein“ ist daher nicht wählbar.') : null,
      el('div', { class: 'gruppe spalten-3' }, schema.geraetDabeiOptionen.map((o) => el('button', {
        type: 'button', class: 'auswahl', 'data-test': `geraet-${o.code}`,
        'aria-pressed': b.hxGeraetDabei === o.code ? 'true' : 'false',
        disabled: gesperrt || (o.code === 'N' && b.hxGeraetAutomatisch),
        onclick: () => aendere((zz, c) => B.beantworteGeraetDabei(zz, o.code, c), ''),
      }, o.label))));
  }

  /** Fehlende optionale Blockangaben (z. B. Dienst, Arbeitskontext) nachtragen. */
  function fehlendeAngaben(z, gesperrt) {
    const b = z.block;
    if (gesperrt || b.status === 'verworfen') return null;
    const felder = [
      ['dienst', 'Dienst', schema.dienste, 3],
      ['arbeitskontext', 'Arbeitskontext', schema.arbeitskontext.map((k) => ({ ...k, label: `${k.gruppe}: ${k.label}` })), 1],
      ['bereich', 'Bereich', schema.bereiche, 2],
      ['beobachter', 'Beobachter', schema.beobachter.map((x) => ({ code: x, label: x })), 4],
    ].filter(([feld, , eintraege]) => !b[feld] && !(feld === 'beobachter' && eintraege.length === 1));
    if (felder.length === 0) return null;
    return el('section', { class: 'frage', 'data-test': 'fehlende-angaben' },
      el('h2', {}, 'Angaben ergänzen', el('span', { class: 'optional' }, ' (optional)')),
      felder.map(([feld, titel, eintraege, spalten]) => auswahlGruppe({
        name: `ergaenze-${feld}`, titel, eintraege, wert: null, spalten,
        beiAuswahl: (c) => aendere((zz, ctx) => B.ergaenzeBlockAngabe(zz, feld, c, ctx), `${titel} ergänzt.`),
      })));
  }

  function zeichne() {
    const z = sitzung.zustand;
    const b = z.block;
    const gesperrt = b.exportStatus === 'bestaetigt';
    const s = B.zusammenfassung(z, schema);
    const zl = B.zeitleiste(z);
    const status = b.status === 'beendet' ? STATUS_TEXT.beendet[b.endeArt] ?? 'Beendet'
      : b.status === 'abgebrochen' ? `${STATUS_TEXT.abgebrochen}: ${b.abbruchCode} ${label('abbruchgruende', b.abbruchCode)}`
        : STATUS_TEXT[b.status] ?? b.status;
    const ziel = { store: db.STORES.BLOECKE, schluessel: blockId, nachher: aktualisiere };
    const frageOffen = B.mitGeraetDabei(z, schema) && !b.hxGeraetDabei && pflichtangaben(schema).geraetDabeiVorExport;

    const unvollstaendig = s.unvollstaendig.map((e) => el('div', { class: 'ergaenzen', 'data-test': `ergaenzen-${e.nr}` },
      el('p', {}, `Episode ${e.nr} · ${uhrzeit(e.startTs)} · ${e.taetigkeit} ${label('taetigkeiten', e.taetigkeit)} · ${e.dauerSek} s`),
      e.offeneZusaetze.map((feld) => {
        const codes = B.zusatzCodes(schema, feld, e.taetigkeit);
        return el('div', { class: 'zusatz offen' },
          el('span', { class: 'zusatz-titel' }, feld === 'nutzungsart' ? 'Nutzung' : 'Haltung'),
          el('div', { class: `zusatz-tasten anzahl-${codes.length}` }, codes.map((n) => el('button', {
            type: 'button', class: 'taste n', 'data-test': `ergaenzen-${e.nr}-${n.code}`, disabled: gesperrt,
            onclick: () => aendere((zz, c) => B.ergaenzeEpisode(zz, e.episodeId, feld, n.code, c), `Episode ${e.nr} ergänzt.`),
          }, el('span', { class: 'kurz' }, n.label), el('span', { class: 'code' }, n.code)))));
      })));

    const kommentar = kommentarFeld({ wert: b.kommentar, testId: 'block-kommentar' });
    kommentar.feld.disabled = gesperrt;

    ersetze(app.wurzel,
      el('h1', {}, 'Block abgeschlossen'),
      geraetFrage(z, gesperrt),
      el('dl', { class: 'eckdaten', 'data-test': 'eckdaten' },
        el('dt', {}, 'Studien-Code'), el('dd', { 'data-test': 'abschluss-pseudonym' }, b.pseudonym),
        el('dt', {}, 'Phase'), el('dd', {}, label('phasen', b.phase)),
        el('dt', {}, 'Kontext'), el('dd', { 'data-test': 'abschluss-kontext' }, b.arbeitskontext ? `${b.arbeitskontext} ${label('arbeitskontext', b.arbeitskontext)}` : '–'),
        el('dt', {}, 'Beginn'), el('dd', {}, `${datumLokal(b.startTs)} ${uhrzeit(b.startTs)}`),
        el('dt', {}, 'Status'), el('dd', { 'data-test': 'abschluss-status' }, status),
        el('dt', {}, 'Beobachtet'), el('dd', { 'data-test': 'abschluss-dauer' }, `${formatiereCountdown(s.beobachtetMs)} min`),
        el('dt', {}, 'Geplant'), el('dd', { 'data-test': 'abschluss-geplant' }, `${B.geplanteDauerSek(b, schema) / 60} min`),
        el('dt', {}, 'Pausen'), el('dd', { 'data-test': 'abschluss-pausen' }, s.pausenAnzahl === 0 ? 'keine' : `${s.pausenAnzahl} (${formatiereCountdown(s.pausenMs)} min)`),
        el('dt', {}, 'Episoden'), el('dd', { 'data-test': 'abschluss-anzahl' }, String(s.anzahlEpisoden)),
        b.status === 'verworfen' ? null : el('dt', {}, 'Export'),
        b.status === 'verworfen' ? null : el('dd', { 'data-test': 'abschluss-export', class: `export-${b.exportStatus}` }, EXPORT_TEXT[b.exportStatus])),

      fehlendeAngaben(z, gesperrt),

      unvollstaendig.length > 0
        ? el('section', { class: 'warnkasten', 'data-test': 'unvollstaendig' },
          el('h2', {}, `${unvollstaendig.length} unvollständige ${unvollstaendig.length === 1 ? 'Episode' : 'Episoden'}`),
          el('p', {}, 'Bitte fehlende Angaben ergänzen, falls bekannt.'),
          unvollstaendig)
        : null,

      // Export: Datei wird im Klick-Handler synchron aus dem Zustand im Speicher erzeugt (kein await vor dem Teilen).
      b.status === 'verworfen' ? null : el('div', { class: 'stapel abstand-oben' },
        frageOffen ? el('p', { class: 'feldfehler', 'data-test': 'export-gesperrt' }, 'Vor dem Export bitte beantworten: War ein HX-Now-Gerät dabei?') : null,
        el('button', {
          type: 'button', class: 'primaer gross', 'data-test': 'exportieren', disabled: frageOffen,
          onclick: () => exportiere(app, blockDatei(sitzung.zustand, schema), ziel),
        }, b.exportStatus === 'offen' ? 'Abschließen und exportieren' : 'Erneut exportieren'),
        el('button', {
          type: 'button', 'data-test': 'andere-wege', disabled: frageOffen,
          onclick: () => andereWege(app, blockDatei(sitzung.zustand, schema), ziel),
        }, 'Andere Exportwege (Download, Mail, Zwischenablage)'),
        el('button', {
          type: 'button', 'data-test': 'bestaetigen', disabled: b.exportStatus !== 'exportiert',
          onclick: () => bestaetigeEingang(app, ziel),
        }, 'Eingang bestätigt')),

      el('h2', {}, 'Anteile je Tätigkeit (beobachtete Zeit)'),
      el('table', { class: 'tabelle', 'data-test': 'anteile' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Tätigkeit'), el('th', { class: 'zahl' }, 'Zeit'), el('th', { class: 'zahl' }, 'Anteil'))),
        el('tbody', {}, s.anteile.map((a) => el('tr', {},
          el('td', {}, `${a.code} ${a.label}`),
          el('td', { class: 'zahl' }, formatiereCountdown(a.dauerMs)),
          el('td', { class: 'zahl' }, `${a.prozent.toFixed(1).replace('.', ',')} %`))))),

      el('details', { class: 'episodenliste' },
        el('summary', {}, 'Alle Episoden und Pausen anzeigen'),
        el('table', { class: 'tabelle', 'data-test': 'episoden' },
          el('thead', {}, el('tr', {}, ['Nr', 'Start', 's', 'T', 'O', 'N', 'H'].map((h) => el('th', {}, h)))),
          el('tbody', {}, zl.map((x, i) => (x.art === 'pause'
            ? el('tr', { class: 'pause-zeile' },
              el('td', {}, i + 1), el('td', {}, uhrzeit(x.startTs)), el('td', { class: 'zahl' }, x.dauerSek),
              el('td', { colspan: 4 }, `Pause${x.grund ? ` ${x.grund} ${label('pausengruende', x.grund)}` : ''}${x.freitext ? `: ${x.freitext}` : ''}`))
            : el('tr', {},
              el('td', {}, i + 1), el('td', {}, uhrzeit(x.startTs)), el('td', { class: 'zahl' }, x.dauerSek),
              el('td', {}, x.taetigkeit), el('td', {}, x.ort),
              el('td', {}, x.offeneZusaetze.includes('nutzungsart') ? '?' : (x.nutzungsart ?? '')),
              el('td', {}, x.offeneZusaetze.includes('haltung') ? '?' : (x.haltung ?? '')))))))),

      el('h2', {}, 'Kommentar zum Block'),
      kommentar,
      el('button', {
        type: 'button', 'data-test': 'block-kommentar-speichern', disabled: gesperrt,
        onclick: () => aendere(() => B.setzeBlockKommentar(sitzung.zustand, kommentar.feld.value), 'Kommentar gespeichert.'),
      }, 'Kommentar speichern'),

      el('div', { class: 'stapel abstand-oben' },
        el('button', {
          type: 'button', class: 'gross', 'data-test': 'zur-startseite',
          onclick: () => { app.sitzung = null; app.zeige('start'); },
        }, 'Zur Startseite')),
    );
  }

  zeichne();
}
