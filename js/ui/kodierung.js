// Kodieransicht (Spezifikation v2, 7.3).
// Anzeige der Zeit nur aus Zeitstempeln berechnet; der Intervall-Timer aktualisiert ausschließlich die Anzeige
// und prüft das reguläre Blockende.
import { el, ersetze, dialog, bestaetige, kommentarFeld, meldung, auswahlGruppe } from './dom.js';
import * as B from '../block.js';
import { formatiereCountdown } from '../zeit.js';
import { pflichtangaben } from '../schema.js';

const TAKT_MS = 250;

export async function zeigeKodierung(app, { blockId }) {
  const { schema } = app;
  const sitzung = await app.sitzungFuer(blockId);
  let beendet = false;
  let zuLangAngezeigt = false;

  const finde = (liste, code) => schema[liste].find((e) => e.code === code);
  const label = (liste, code) => finde(liste, code)?.label ?? code;
  const z = () => sitzung.zustand;
  const pausiert = () => z().block.status === 'pausiert';

  // ------------------------------------------------------------------ Aktionen
  async function ausfuehren(fn) {
    let r;
    try {
      r = await sitzung.aktion(fn);
    } catch (e) {
      meldung(`Speichern fehlgeschlagen – Eingabe nicht übernommen (${e.message}).`, 'fehler');
      zeichne();
      return null;
    }
    if (!r.ok) {
      if (r.code === 'ABGELAUFEN' || r.code === 'NICHT_LAUFEND') {
        zumAbschluss();
        return r;
      }
      meldung(r.fehler, 'fehler');
    }
    zeichne();
    return r;
  }

  async function rueckgaengig() {
    const vorher = B.aktuelleEpisode(z());
    const r = await ausfuehren(B.rueckgaengig);
    if (r?.ok) meldung(`Episode ${vorher.nr} (${vorher.taetigkeit}/${vorher.ort}) rückgängig gemacht.`);
  }

  function kommentar() {
    if (pausiert()) { pausenNotiz(); return; }
    const akt = B.aktuelleEpisode(z());
    if (!akt) { meldung('Es läuft noch keine Episode.', 'fehler'); return; }
    const feld = kommentarFeld({ wert: akt.kommentar, testId: 'episoden-kommentar' });
    dialog(`Kommentar zu Episode ${akt.nr}`, (schliessen) => [
      feld,
      el('div', { class: 'knopfzeile' },
        el('button', { type: 'button', onclick: schliessen }, 'Abbrechen'),
        el('button', {
          type: 'button', class: 'primaer', 'data-test': 'kommentar-speichern',
          onclick: async () => {
            const text = feld.feld.value;
            const r = await ausfuehren((zz, c) => B.setzeEpisodenKommentar(zz, text, c));
            schliessen();
            if (r?.ok) meldung('Kommentar gespeichert.');
          },
        }, 'Speichern')),
    ], { testId: 'dialog-kommentar' });
  }

  async function pause() {
    // Kein Hinweis-Toast: der Pausenstatus ist in Kopfzeile und Statuszeile sichtbar
    await ausfuehren(B.pausiere);
  }

  /** Fortsetzen: ein Tipp – weiter mit Tätigkeit, Ort, Nutzungsart und Haltung von vor der Pause. */
  async function fortsetzen() {
    const r = await ausfuehren((zz, c) => B.setzeFort(zz, {}, c));
    if (r?.ok) meldung('Fortgesetzt.');
  }

  /** Notiz zur laufenden Pause (optional). */
  function pausenNotiz() {
    const p = B.laufendePause(z());
    const feld = kommentarFeld({ wert: p.freitext, testId: 'pause-freitext', titel: 'Notiz zur Pause', zeilen: 2 });
    dialog('Notiz zur Pause', (schliessen) => [
      feld,
      el('div', { class: 'knopfzeile' },
        el('button', { type: 'button', onclick: schliessen }, 'Abbrechen'),
        el('button', {
          type: 'button', class: 'primaer', 'data-test': 'pause-notiz-speichern',
          onclick: async () => {
            const text = feld.feld.value;
            const r = await ausfuehren((zz, c) => B.setzePauseAngaben(zz, { freitext: text }, c));
            schliessen();
            if (r?.ok) meldung('Notiz gespeichert.');
          },
        }, 'Speichern')),
    ], { testId: 'dialog-pause-notiz' });
  }

  function beenden() {
    dialog('Block vorzeitig beenden?', (schliessen) => [
      el('p', {}, 'Der Block endet jetzt, vor Ablauf der Blockzeit. Für einen Abbruch mit Grund bitte „Abbruch“ verwenden.'),
      el('div', { class: 'stapel' },
        el('button', {
          type: 'button', class: 'primaer', 'data-test': 'beenden-behalten',
          onclick: async () => { schliessen(); await beende(true); },
        }, 'Beenden – Daten behalten'),
        el('button', {
          type: 'button', class: 'gefahr', 'data-test': 'beenden-verwerfen',
          onclick: async () => {
            schliessen();
            const ja = await bestaetige('Daten verwerfen?',
              'Der Block wird als „verworfen“ markiert und nicht exportiert. Er bleibt auf dem Gerät gespeichert.',
              { ja: 'Verwerfen', nein: 'Zurück', gefahr: true });
            if (ja) await beende(false);
          },
        }, 'Beenden – Daten verwerfen'),
        el('button', { type: 'button', 'data-test': 'beenden-zurueck', onclick: schliessen }, 'Weiter beobachten')),
    ], { testId: 'dialog-beenden' });
  }

  async function beende(behalten) {
    const r = await ausfuehren((zz, c) => B.beendeManuell(zz, { behalten }, c));
    if (r?.ok) zumAbschluss();
  }

  function abbruch(vorwahl = null) {
    let grund = vorwahl;
    const grundPflicht = pflichtangaben(schema).abbruchGrund;
    const feld = kommentarFeld({ testId: 'abbruch-kommentar', beiEingabe: () => pruefe() });
    const pflicht = el('p', { class: 'feldfehler', 'data-test': 'abbruch-pflicht' });
    const ok = el('button', {
      type: 'button', class: 'gefahr', disabled: true, 'data-test': 'abbruch-bestaetigen',
      onclick: async () => {
        schliessen();
        const text = feld.feld.value;
        const r = await ausfuehren((zz, c) => B.brecheAb(zz, grund, text, c));
        if (r?.ok) zumAbschluss();
      },
    }, 'Block abbrechen');
    function pruefe() {
      const g = finde('abbruchgruende', grund);
      const fehlt = g?.kommentarPflicht && !feld.feld.value.trim();
      pflicht.textContent = fehlt ? 'Bei diesem Grund ist ein Kommentar Pflicht.' : '';
      ok.disabled = (grundPflicht && !g) || fehlt;
    }
    const schliessen = dialog('Block abbrechen', () => [
      auswahlGruppe({
        name: 'abbruch', titel: 'Grund', optional: !grundPflicht, eintraege: schema.abbruchgruende, wert: grund, spalten: 1,
        beschriftung: (a) => `${a.code} · ${a.label}`, beiAuswahl: (c) => { grund = c; pruefe(); },
      }),
      feld, pflicht,
      el('div', { class: 'knopfzeile' },
        el('button', { type: 'button', 'data-test': 'abbruch-zurueck', onclick: () => schliessen() }, 'Zurück'),
        ok),
    ], { testId: 'dialog-abbruch' });
    pruefe();
  }

  function zumAbschluss() {
    if (beendet) return;
    beendet = true;
    app.zeige('abschluss', { blockId });
  }

  // ------------------------------------------------------------------ Darstellung
  const countdown = el('div', { class: 'countdown', 'data-test': 'countdown', 'aria-live': 'off' });
  const laufzeit = el('span', { class: 'laufzeit', 'data-test': 'laufzeit' });
  const inhalt = el('div', { class: 'kodier-inhalt' });
  const pauseKnopf = el('button', { type: 'button', class: 'pause-knopf', 'data-test': 'pause' });
  const fussKnoepfe = {
    rueckgaengig: el('button', { type: 'button', 'data-test': 'rueckgaengig', onclick: rueckgaengig }, 'Rückgängig'),
    kommentar: el('button', { type: 'button', 'data-test': 'kommentar', onclick: kommentar }, 'Kommentar'),
  };

  function geraetSchalter(zz) {
    if (!B.mitGeraetDabei(zz, schema)) return null;
    const b = zz.block;
    const an = b.hxGeraetMarkiertTs !== null || b.hxGeraetAutomatisch;
    return el('button', {
      type: 'button', class: 'schalter', 'aria-pressed': an ? 'true' : 'false', 'data-test': 'geraet-dabei',
      disabled: b.hxGeraetAutomatisch,
      onclick: () => ausfuehren((z2, c) => B.setzeGeraetDabei(z2, !an, c)),
    },
    el('span', { class: 'schalter-symbol', 'aria-hidden': 'true' }, an ? '✓' : ''),
    'HX-Now-Gerät dabei',
    b.hxGeraetAutomatisch ? el('span', { class: 'schalter-hinweis' }, ' (automatisch)') : null);
  }

  function zeichne() {
    const zz = z();
    const p = pausiert();
    const akt = B.aktuelleEpisode(zz);
    const tAktiv = akt?.taetigkeit ?? zz.auswahl.taetigkeit;
    const oAktiv = akt?.ort ?? zz.auswahl.ort;
    const zusatz = akt && !p ? B.zusatzFelder(schema, akt.taetigkeit) : [];
    zuLangAngezeigt = p && B.pauseZuLang(zz, schema, Date.now());

    let status;
    if (p) {
      const pz = B.laufendePause(zz);
      status = el('div', { class: 'pause-box', 'data-test': 'pause-status' },
        el('p', { class: 'pause-text' }, 'Pause – Blockzeit steht still. „Fortsetzen“ macht mit der Kodierung von vorher weiter.'),
        auswahlGruppe({
          name: 'pausegrund', titel: 'Grund', optional: !pflichtangaben(schema).pauseGrund, eintraege: schema.pausengruende, wert: pz.grund,
          spalten: 1, beschriftung: (g) => `${g.code} · ${g.label}`,
          sofortMarkieren: false, // erst nach dem Speichern markieren (Neuzeichnen)
          beiAuswahl: (c) => ausfuehren((z2, ctx) => B.setzePauseAngaben(z2, { grund: c }, ctx)),
        }),
        pz.freitext ? el('p', { class: 'hinweis', 'data-test': 'pause-notiz' }, `Notiz: ${pz.freitext}`) : null);
    } else if (!akt) {
      status = el('div', { class: 'aufforderung', 'data-test': 'aufforderung' },
        !oAktiv && !tAktiv ? 'Tätigkeit und Ort wählen' : !oAktiv ? 'Ort wählen' : 'Tätigkeit wählen',
        tAktiv || oAktiv ? el('span', { class: 'vorwahl' }, ` (gewählt: ${[tAktiv, oAktiv].filter(Boolean).join(', ')})`) : null);
    } else {
      const teile = [`${akt.taetigkeit} ${label('taetigkeiten', akt.taetigkeit)}`, `${akt.ort} ${label('orte', akt.ort)}`];
      for (const feld of zusatz) {
        const offen = akt.offeneZusaetze.includes(feld);
        teile.push(offen ? `${feld === 'nutzungsart' ? 'N' : 'H'} ?` : akt[feld]);
      }
      status = el('div', { class: `aktuell${akt.unvollstaendig ? ' unvollstaendig' : ''}`, 'data-test': 'aktuelle-episode' },
        el('span', { class: 'aktuell-nr' }, `#${akt.nr}`),
        el('span', { class: 'aktuell-text' }, teile.join(' · ')),
        laufzeit);
    }

    const tTasten = schema.taetigkeiten.map((t) => el('button', {
      type: 'button', class: 'taste t',
      'aria-pressed': !p && t.code === tAktiv ? 'true' : 'false',
      disabled: p || !B.taetigkeitErlaubt(zz, schema, t.code),
      'data-test': `t-${t.code}`,
      onclick: () => ausfuehren((z2, c) => B.tippeTaetigkeit(z2, t.code, c)),
    }, el('span', { class: 'kurz' }, t.kurz), el('span', { class: 'code' }, t.code)));

    const oTasten = schema.orte.map((o) => el('button', {
      type: 'button', class: 'taste o',
      'aria-pressed': !p && o.code === oAktiv ? 'true' : 'false',
      disabled: p,
      'data-test': `o-${o.code}`,
      onclick: () => ausfuehren((z2, c) => B.tippeOrt(z2, o.code, c)),
    }, el('span', { class: 'kurz' }, o.label), el('span', { class: 'code' }, o.code)));

    const zusatzZeilen = zusatz.map((feld) => {
      const pflicht = B.zusatzFuer(schema, akt.taetigkeit).pflicht.includes(feld);
      const offen = akt.offeneZusaetze.includes(feld);
      const codes = B.zusatzCodes(schema, feld, akt.taetigkeit);
      return el('div', { class: `zusatz${offen && pflicht ? ' offen' : ''}${offen && !pflicht ? ' optional' : ''}`, 'data-test': `zeile-${feld}` },
        el('span', { class: 'zusatz-titel' }, feld === 'nutzungsart' ? 'Nutzung' : 'Haltung'),
        el('div', { class: `zusatz-tasten anzahl-${codes.length}` }, codes.map((n) => el('button', {
          type: 'button', class: 'taste n',
          'aria-pressed': !offen && akt[feld] === n.code ? 'true' : 'false',
          'data-test': `${feld === 'nutzungsart' ? 'n' : 'h'}-${n.code}`,
          onclick: () => ausfuehren((z2, c) => (feld === 'nutzungsart' ? B.tippeNutzungsart : B.tippeHaltung)(z2, n.code, c)),
        }, el('span', { class: 'kurz' }, n.label), el('span', { class: 'code' }, n.code)))));
    });

    ersetze(inhalt,
      geraetSchalter(zz),
      zuLangAngezeigt
        ? el('div', { class: 'banner-rot', role: 'alert', 'data-test': 'pause-zu-lang' },
          `Pause länger als ${Math.round(schema.pauseMaxSek / 60)} Minuten. Block mit A3 abbrechen?`,
          el('button', { type: 'button', class: 'gefahr abstand-links', 'data-test': 'pause-abbruch-a3', onclick: () => abbruch('A3') }, 'Abbruch A3'))
        : null,
      status,
      el('section', { class: `bereich-t${p ? ' gedimmt' : ''}`, 'aria-label': 'Tätigkeit' }, el('div', { class: 'raster-t' }, tTasten)),
      el('section', { class: `bereich-o${p ? ' gedimmt' : ''}`, 'aria-label': 'Ort' }, el('div', { class: 'raster-o' }, oTasten)),
      zusatzZeilen,
    );

    pauseKnopf.textContent = p ? 'Fortsetzen' : 'Pause';
    pauseKnopf.className = `pause-knopf${p ? ' primaer' : ''}`;
    pauseKnopf.onclick = p ? fortsetzen : pause;
    const grundFehlt = p && pflichtangaben(schema).pauseGrund && !B.laufendePause(zz).grund;
    pauseKnopf.disabled = (!p && !akt) || grundFehlt;
    fussKnoepfe.rueckgaengig.disabled = p;
    fussKnoepfe.kommentar.disabled = !p && !akt;
    takt();
  }

  function takt() {
    const zz = z();
    const jetzt = Date.now();
    if (pausiert()) {
      countdown.textContent = `PAUSE ${formatiereCountdown(Math.floor(B.pauseDauerMs(zz, jetzt) / 1000) * 1000)}`;
      countdown.classList.remove('warnung');
      countdown.classList.add('pausiert');
      if (!zuLangAngezeigt && B.pauseZuLang(zz, schema, jetzt)) zeichne();
      return;
    }
    countdown.classList.remove('pausiert');
    countdown.textContent = formatiereCountdown(B.restzeitMs(zz, schema, jetzt));
    countdown.classList.toggle('warnung', B.istWarnphase(zz, schema, jetzt));
    const akt = B.aktuelleEpisode(zz);
    if (akt) laufzeit.textContent = `${Math.max(0, Math.floor((jetzt - akt.startTs) / 1000))} s`;
    const ende = B.regulaeresEnde(zz, schema);
    if (zz.block.status === 'laufend' && ende !== null && jetzt >= ende && !beendet) {
      ausfuehren(B.pruefeAblauf).then(() => zumAbschluss());
    }
  }

  const block = z().block;
  ersetze(app.wurzel,
    el('header', { class: 'kopf-kodierung' },
      el('div', { class: 'kopf-info' },
        el('span', { class: 'kopf-code', 'data-test': 'kopf-pseudonym' }, block.pseudonym),
        el('span', { class: `kopf-phase phase-${block.phase}` }, label('phasen', block.phase)),
        el('span', { class: 'kopf-kontext', 'data-test': 'kopf-kontext' },
          block.arbeitskontext ? `${block.arbeitskontext} ${label('arbeitskontext', block.arbeitskontext)}` : '')),
      countdown),
    inhalt,
    el('footer', { class: 'fuss-kodierung' },
      pauseKnopf,
      fussKnoepfe.rueckgaengig,
      fussKnoepfe.kommentar,
      el('button', { type: 'button', 'data-test': 'beenden', onclick: beenden }, 'Beenden'),
      el('button', { type: 'button', class: 'gefahr', 'data-test': 'abbruch', onclick: () => abbruch() }, 'Abbruch')),
  );
  document.body.classList.add('kodiermodus');
  zeichne();

  // Anzeige-Takt und Rückkehr aus dem Hintergrund
  const intervall = setInterval(takt, TAKT_MS);
  const sichtbar = () => { if (document.visibilityState === 'visible') { takt(); sperreBildschirm(); } };
  document.addEventListener('visibilitychange', sichtbar);

  // Optional: Bildschirmsperre verhindern (Screen Wake Lock), Fehler werden ignoriert.
  let wakeLock = null;
  async function sperreBildschirm() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch { wakeLock = null; }
  }
  sperreBildschirm();

  return () => {
    clearInterval(intervall);
    document.removeEventListener('visibilitychange', sichtbar);
    document.body.classList.remove('kodiermodus');
    if (wakeLock) wakeLock.release().catch(() => {});
  };
}
