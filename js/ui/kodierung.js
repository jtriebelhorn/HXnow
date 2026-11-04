// Kodieransicht (Spezifikation v2, 7.3).
// Anzeige der Zeit nur aus Zeitstempeln berechnet; der Intervall-Timer aktualisiert ausschließlich die Anzeige
// und prüft das reguläre Blockende.
import { el, ersetze, dialog, bestaetige, kommentarFeld, meldung, auswahlGruppe } from './dom.js';
import * as B from '../block.js';
import { formatiereCountdown } from '../zeit.js';
import { pflichtangaben, istTestPseudonym, nebentaetigkeiten, ntCode } from '../schema.js';

const TAKT_MS = 250;

export async function zeigeKodierung(app, { blockId }) {
  const { schema } = app;
  const sitzung = await app.sitzungFuer(blockId);
  let beendet = false;
  let zuLangAngezeigt = false;
  let nebenOffen = false; // Nebentätigkeiten sind zugeklappt, bis sie geöffnet werden

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

  /** Fortsetzen: ein Tipp – weiter mit Ort, Tätigkeit, Nutzungsart, Haltung und Nebentätigkeiten von vor der Pause. */
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
    const grundPflicht = pflichtangaben(schema).beendenGrund;
    const grund = kommentarFeld({
      testId: 'beenden-grund', titel: 'Grund für das vorzeitige Ende', optional: !grundPflicht, zeilen: 2,
      beiEingabe: (text) => { behalten.disabled = grundPflicht && !text.trim(); },
    });
    const behalten = el('button', {
      type: 'button', class: 'primaer', 'data-test': 'beenden-behalten', disabled: grundPflicht,
      onclick: async () => { const text = grund.feld.value; schliessen(); await beende(true, text); },
    }, 'Beenden – Daten behalten');
    const schliessen = dialog('Block vorzeitig beenden?', (zu) => [
      el('p', {}, 'Der Block endet jetzt, vor Ablauf der Blockzeit. Für einen Abbruch mit Grund bitte „Abbruch“ verwenden.'),
      grund,
      el('div', { class: 'stapel' },
        behalten,
        el('button', {
          type: 'button', class: 'gefahr', 'data-test': 'beenden-verwerfen',
          onclick: async () => {
            zu();
            const ja = await bestaetige('Daten verwerfen?',
              'Der Block wird als „verworfen“ markiert und nicht exportiert. Er bleibt auf dem Gerät gespeichert.',
              { ja: 'Verwerfen', nein: 'Zurück', gefahr: true });
            if (ja) await beende(false);
          },
        }, 'Beenden – Daten verwerfen'),
        el('button', { type: 'button', 'data-test': 'beenden-zurueck', onclick: () => zu() }, 'Weiter beobachten')),
    ], { testId: 'dialog-beenden' });
  }

  async function beende(behalten, grund = '') {
    const r = await ausfuehren((zz, c) => B.beendeManuell(zz, { behalten, grund }, c));
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

  /** Tastenzeile für eine Angabe zur Nebentätigkeit c (Nutzungsart bzw. Haltung von HX Now). */
  function nebenZusatzZeile({ c, titel, testZeile, testTaste, codes, wert, gesperrt = () => false, tippe }) {
    return el('div', { class: `zusatz${wert ? '' : ' optional'}`, 'data-test': `${testZeile}-${c}` },
      el('span', { class: 'zusatz-titel' }, `${finde('taetigkeiten', c)?.kurz ?? c}: ${titel}`),
      el('div', { class: `zusatz-tasten anzahl-${codes.length}` }, codes.map((x) => el('button', {
        type: 'button', class: 'taste n',
        'aria-pressed': wert === x.code ? 'true' : 'false',
        disabled: pausiert() || gesperrt(x.code),
        'data-test': `${testTaste}-${c}-${x.code}`,
        onclick: () => ausfuehren((z2, ctx) => tippe(z2, c, x.code, ctx)),
      }, el('span', { class: 'kurz' }, x.label), el('span', { class: 'code' }, x.code)))));
  }

  /**
   * Nebentätigkeiten (ENTSCHEIDUNGEN Nr. 19, 23, 25): zugeklappt nur eine Kopfzeile mit den eingeschalteten;
   * geöffnet Schalter, die anbleiben, bis sie abgewählt werden, und bei HX Now Nutzungsart und Haltung.
   */
  function nebenBereich(zz, akt, p) {
    const codes = nebentaetigkeiten(schema).filter((c) => B.taetigkeitErlaubt(zz, schema, c));
    if (codes.length === 0) return null;
    const aktiv = akt?.neben ?? [];
    const kopf = el('button', {
      type: 'button', class: 'neben-kopf', 'aria-expanded': nebenOffen ? 'true' : 'false', 'data-test': 'neben-oeffnen',
      onclick: () => { nebenOffen = !nebenOffen; zeichne(); },
    },
    el('span', { class: 'bereich-titel' }, 'Nebentätigkeit'),
    el('span', { class: 'neben-zusammenfassung' }, aktiv.length
      ? aktiv.map((c) => el('span', { class: 'chip chip-neben' }, finde('taetigkeiten', c)?.kurz ?? c))
      : el('span', { class: 'leise' }, 'keine')),
    el('span', { class: 'pfeil', 'aria-hidden': 'true' }, nebenOffen ? '▾' : '▸'));
    if (!nebenOffen) return el('section', { class: `bereich bereich-neben zu${p ? ' gedimmt' : ''}`, 'data-test': 'zeile-neben' }, kopf);

    const tasten = codes.map((c) => {
      const an = aktiv.includes(c);
      return el('button', {
        type: 'button', class: 'taste n',
        'aria-pressed': !p && an ? 'true' : 'false',
        disabled: p || !akt || (!an && c === akt.taetigkeit),
        'data-test': `neben-${c}`,
        onclick: () => ausfuehren((z2, ctx) => B.tippeNeben(z2, c, ctx)),
      }, el('span', { class: 'kurz' }, finde('taetigkeiten', c)?.kurz ?? c), el('span', { class: 'code' }, ntCode(c)));
    });
    const haltungFest = akt ? finde('orte', akt.ort)?.haltung : null;
    const zeilen = aktiv.flatMap((c) => [
      B.nebenMitNutzung(schema).includes(c) ? nebenZusatzZeile({
        c, titel: 'Nutzung', testZeile: 'zeile-neben-nutzung', testTaste: 'nn', codes: B.nutzungsartenFuer(schema, c),
        wert: akt.nebenNutzung?.[c] ?? null, tippe: B.tippeNebenNutzung,
      }) : null,
      B.nebenMitHaltung(schema).includes(c) ? nebenZusatzZeile({
        c, titel: 'Haltung', testZeile: 'zeile-neben-haltung', testTaste: 'nh', codes: schema.haltung,
        wert: akt.nebenHaltung?.[c] ?? null, gesperrt: (code) => haltungFest && code !== haltungFest, tippe: B.tippeNebenHaltung,
      }) : null,
    ]);
    return el('section', { class: `bereich bereich-neben${p ? ' gedimmt' : ''}`, 'data-test': 'zeile-neben' },
      kopf, el('div', { class: `zusatz-tasten neben-tasten anzahl-${codes.length}` }, tasten), zeilen);
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
        !oAktiv && !tAktiv ? 'Ort und Tätigkeit wählen' : !oAktiv ? 'Ort wählen' : 'Tätigkeit wählen',
        tAktiv || oAktiv ? el('span', { class: 'vorwahl' }, ` (gewählt: ${[oAktiv, tAktiv].filter(Boolean).join(', ')})`) : null);
    } else {
      const zusatzText = zusatz.map((feld) => (akt.offeneZusaetze.includes(feld) ? `${feld === 'nutzungsart' ? 'N' : 'H'} ?` : akt[feld]));
      const teile = [
        el('span', { class: 'chip chip-o' }, `${akt.ort} ${label('orte', akt.ort)}`),
        el('span', { class: 'chip chip-t' }, [`${akt.taetigkeit} ${label('taetigkeiten', akt.taetigkeit)}`, ...zusatzText].join(' · ')),
        akt.neben?.length ? el('span', { class: 'chip chip-neben' }, `Neben: ${B.nebenText(schema, akt)}`) : null,
      ].filter(Boolean);
      status = el('div', { class: `aktuell${akt.unvollstaendig ? ' unvollstaendig' : ''}`, 'data-test': 'aktuelle-episode' },
        el('span', { class: 'aktuell-nr' }, `#${akt.nr}`),
        el('span', { class: 'aktuell-text' }, teile.flatMap((t, i) => (i ? [el('span', { class: 'trenner' }, ' · '), t] : [t]))),
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

    const haltungFest = akt ? finde('orte', akt.ort)?.haltung : null;
    const zusatzZeilen = zusatz.map((feld) => {
      const pflicht = B.zusatzFuer(schema, akt.taetigkeit).pflicht.includes(feld);
      const offen = akt.offeneZusaetze.includes(feld);
      const codes = B.zusatzCodes(schema, feld, akt.taetigkeit);
      return el('div', { class: `zusatz${offen && pflicht ? ' offen' : ''}${offen && !pflicht ? ' optional' : ''}`, 'data-test': `zeile-${feld}` },
        el('span', { class: 'zusatz-titel' }, feld === 'nutzungsart' ? 'Nutzung' : 'Haltung'),
        el('div', { class: `zusatz-tasten anzahl-${codes.length}` }, codes.map((n) => el('button', {
          type: 'button', class: 'taste n',
          'aria-pressed': !offen && akt[feld] === n.code ? 'true' : 'false',
          disabled: feld === 'haltung' && haltungFest && n.code !== haltungFest,
          'data-test': `${feld === 'nutzungsart' ? 'n' : 'h'}-${n.code}`,
          onclick: () => ausfuehren((z2, c) => (feld === 'nutzungsart' ? B.tippeNutzungsart : B.tippeHaltung)(z2, n.code, c)),
        }, el('span', { class: 'kurz' }, n.label), el('span', { class: 'code' }, n.code)))));
    });

    const bereich = (art, titel, ...kinder) => el('section', { class: `bereich bereich-${art}${p ? ' gedimmt' : ''}`, 'aria-label': titel },
      el('div', { class: 'bereich-titel' }, titel), ...kinder);

    ersetze(inhalt,
      geraetSchalter(zz),
      zuLangAngezeigt
        ? el('div', { class: 'banner-rot', role: 'alert', 'data-test': 'pause-zu-lang' },
          `Pause länger als ${Math.round(schema.pauseMaxSek / 60)} Minuten. Block mit A3 abbrechen?`,
          el('button', { type: 'button', class: 'gefahr abstand-links', 'data-test': 'pause-abbruch-a3', onclick: () => abbruch('A3') }, 'Abbruch A3'))
        : null,
      status,
      bereich('o', 'Ort', el('div', { class: 'raster-o' }, oTasten)),
      bereich('t', 'Tätigkeit', el('div', { class: 'raster-t' }, tTasten), zusatzZeilen),
      nebenBereich(zz, akt, p),
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
    istTestPseudonym(schema, block.pseudonym)
      ? el('div', { class: 'banner-test', 'data-test': 'probelauf' }, `Probelauf (${block.pseudonym}) – wird nicht ausgewertet`)
      : null,
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
