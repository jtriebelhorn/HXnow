// Prüf-Workflow: simuliert realitätsnah zwei Beobachtungstage (Prä und Post) im iPhone-Profil und prüft,
// ob alle Eingaben vollständig, verständlich und mit exakten Zeitstempeln gespeichert und wieder auslesbar sind.
//
// Aufruf:  npm run pruefen               (neuer Zufalls-Seed → andere Abläufe bei jedem Lauf)
//          SEED=123456 npm run pruefen   (Lauf exakt wiederholen)
// Ergebnis: pruefberichte/<Zeitpunkt>_seed<Seed>/bericht.md (+ exportierte Dateien)

import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SollBlock } from './soll.js';
import { zufall, DAUER, KOMMENTARE, naechsteTaetigkeit, ortFuer, nutzungsart, haltung } from './modell.js';
import { pruefeBlock, pruefeRohdaten, pruefeEinzelCsv } from './abgleich.js';
import { isoBerlin } from './lesen.js';
import { schreibeBericht } from './bericht.js';
import { mockeTeilen, geteilt, leseDb } from '../e2e/hilfen.js';

const SCHEMA = JSON.parse(readFileSync(new URL('../../kodierschema.json', import.meta.url), 'utf8'));
const APP_VERSION = /APP_VERSION = '([^']+)'/.exec(readFileSync(new URL('../../js/version.js', import.meta.url), 'utf8'))[1];
const SEED = Number(process.env.SEED ?? (Date.now() % 1_000_000_000));

test.setTimeout(15 * 60_000);

test('Simulierte Beobachtungstage: Eingaben vollständig gespeichert und wieder auslesbar', async ({ page, browser }, testInfo) => {
  const r = zufall(SEED);
  const laufStart = new Date();
  const ordner = join('pruefberichte', `${laufStart.toISOString().slice(0, 19).replace(/[:T]/g, '-')}_seed${SEED}`);
  mkdirSync(join(ordner, 'dateien'), { recursive: true });
  const lauf = {
    ordner, seed: SEED, browser: `${testInfo.project.name} (${browser.browserType().name()})`,
    appVersion: APP_VERSION, schemaVersion: SCHEMA.schemaVersion, start: laufStart.toLocaleString('de-DE'),
    simTag: '', szenarien: [], gesamt: [],
  };
  const gesamt = (name, ok, detail = '') => lauf.gesamt.push({ name, ok: Boolean(ok), detail: ok ? '' : detail });
  const speichereDatei = (name, inhalt) => writeFileSync(join(ordner, 'dateien', name), inhalt);

  // ------------------------------------------------------------------ Hilfen für die Bedienung
  const jetzt = () => page.evaluate(() => Date.now());
  const vor = async (ms) => { if (ms > 0) await page.clock.fastForward(Math.round(ms)); };
  const tippe = (id) => page.locator(`[data-test=${id}]`).tap();
  const letzteDatei = async () => (await geteilt(page)).at(-1);

  /** Wartet, bis die Anzeige den Soll-Zustand zeigt (= gespeichert, Vorgabe 7 der Spezifikation). */
  async function synchron(soll) {
    if (soll.pausiert) {
      await expect(page.locator('[data-test=pause-status]')).toBeVisible();
      return;
    }
    const a = soll.akt;
    if (!a) return;
    const box = page.locator('[data-test=aktuelle-episode]');
    await expect(box).toContainText(`#${a.nr}`);
    await expect(box).toContainText(`${a.t} `);
    await expect(box).toContainText(` ${a.o} `);
    if (a.n && !a.offen.has('n')) await expect(box).toContainText(a.n);
    if (a.h && !a.offen.has('h')) await expect(box).toContainText(a.h);
  }

  await mockeTeilen(page, 'erfolg');
  const tag1 = new Date('2026-12-03T07:20:00+01:00');
  await page.clock.install({ time: new Date(tag1.getTime() - 1000) });
  await page.clock.pauseAt(tag1);
  await page.goto('./');
  await expect(page.locator('[data-test=neuer-block]')).toBeVisible();

  // ------------------------------------------------------------------ Tageskennzahlen und Versuch
  const tagErwartet = [];
  async function tageskennzahlen(bereich) {
    await tippe('tageskennzahlen');
    await tippe(`tag-bereich-${bereich}`);
    const auslastung = r.ganz(14, 32);
    const aerzte = r.ganz(2, 6);
    const ereignis = r.wahl(['Personalausfall Pflege; 2 Betten gesperrt', 'Systemstörung KIS 10–11 Uhr', '"Massenanfall" geübt', '']);
    await page.locator('[data-test=tag-auslastung]').fill(String(auslastung));
    for (let i = 0; i < aerzte; i++) await tippe('tag-aerzte-plus');
    if (ereignis) await page.locator('[data-test=tag-ereignisse]').fill(ereignis);
    const ts = await jetzt();
    await tippe('tag-speichern');
    await expect(page.locator('[data-test=eintrag-tag]').first()).toBeVisible();
    tagErwartet.push({ bereich, datum: isoBerlin(ts).slice(0, 10), werte: {
      datensatz: 'tageskennzahlen', datum: isoBerlin(ts).slice(0, 10), bereich, auslastung: String(auslastung),
      aerzte_anwesend: String(aerzte), ereignisse: ereignis, beobachter: SCHEMA.beobachter[0],
      schema_version: SCHEMA.schemaVersion, app_version: APP_VERSION, erfasst: isoBerlin(ts),
    } });
  }

  const versuchErwartet = [];
  async function versuch(phase, bereich) {
    const pseudonym = `P${String(r.ganz(100, 199)).padStart(3, '0')}`;
    await tippe('nicht-angetroffen');
    await page.locator('[data-test=pseudonym]').fill(pseudonym);
    await tippe(`phase-${phase}`);
    await tippe(`bereich-${bereich}`);
    const kommentar = 'Im OP; Rückruf "später"';
    await page.locator('[data-test=versuch-kommentar]').fill(kommentar);
    const ts = await jetzt();
    await tippe('versuch-speichern');
    await expect(page.locator('[data-test=eintrag-versuch]').first()).toBeVisible();
    versuchErwartet.push({ pseudonym, werte: {
      datensatz: 'versuch', geraete_id: '', schema_version: SCHEMA.schemaVersion, app_version: APP_VERSION,
      pseudonym, beobachter: SCHEMA.beobachter[0], bereich, dienst: '', phase,
      datum: isoBerlin(ts).slice(0, 10), zeitpunkt: isoBerlin(ts), kommentar,
    } });
  }

  // ------------------------------------------------------------------ Ein Block
  const GRUPPE = Object.fromEntries(SCHEMA.arbeitskontext.map((k) => [k.code, k.gruppe]));

  async function spieleBlock(sz) {
    const m = sz.meta;
    await tippe('neuer-block');
    await tippe(`dauer-${m.dauerSek}`);
    await page.locator('[data-test=pseudonym]').fill(m.pseudonym);
    await tippe(`phase-${m.phase}`);
    await tippe(`bereich-${m.bereich}`);
    if (m.dienst) await tippe(`dienst-${m.dienst}`);
    if (m.arbeitskontext) {
      await tippe(`kontextgruppe-${GRUPPE[m.arbeitskontext]}`);
      if (await page.locator(`[data-test=kontext-${m.arbeitskontext}]`).count()) await tippe(`kontext-${m.arbeitskontext}`);
    }
    const startTs = await jetzt();
    await tippe('block-starten');
    await expect(page.locator('[data-test=countdown]')).toBeVisible();
    const soll = new SollBlock(SCHEMA, { ...m, beobachter: SCHEMA.beobachter[0] }, startTs);
    soll.log(startTs, `Block gestartet (${m.pseudonym}, ${m.phase}, ${m.dauerSek / 60} min)`);
    const kontext = m.arbeitskontext ?? m.modellKontext;
    const zaehler = { rueckgaengig: 0, kommentare: 0, doppeltipps: 0, kurzepisoden: 0 };

    // Zusatzkodierung nach einem Tätigkeitswechsel (wie eine Beobachterin: kurz danach)
    async function zusatzNach() {
      const a = soll.akt;
      const { felder } = soll.zusatz(a.t);
      if (felder.includes('n')) {
        const n = nutzungsart(r, a.t, a.o);
        if (n) { await vor(r.dauerMs(0.4, 2)); const ts = await jetzt(); await tippe(`n-${n}`); soll.tippeZusatz(ts, 'n', n); await synchron(soll); }
      }
      if (felder.includes('h') && r.ja(0.85)) {
        const h = haltung(r, a.o);
        await vor(r.dauerMs(0.4, 2)); const ts = await jetzt(); await tippe(`h-${h}`); soll.tippeZusatz(ts, 'h', h); await synchron(soll);
      }
    }

    async function wechsleT(t) {
      const a = soll.akt;
      const o = ortFuer(r, kontext, t, a?.o);
      let ts = await jetzt();
      await tippe(`t-${t}`);
      soll.tippeT(ts, t);
      if (!a || o !== a.o) {
        await vor(r.dauerMs(0.4, 1.5));
        ts = await jetzt();
        await tippe(`o-${o}`);
        soll.tippeO(ts, o);
      }
      await synchron(soll);
      await zusatzNach();
    }

    // Erste Episode: kurz nach dem Start Tätigkeit und Ort tippen
    await vor(r.dauerMs(1, 3));
    await wechsleT(naechsteTaetigkeit(r, kontext, m.phase, null));

    async function modellAktion() {
      const a = soll.akt;
      const x = r.zahl();
      if (x < 0.03) { // vertippt und sofort korrigiert
        const falsch = naechsteTaetigkeit(r, kontext, m.phase, a.t);
        const ts = await jetzt(); await tippe(`t-${falsch}`); soll.tippeT(ts, falsch); await synchron(soll);
        await vor(r.dauerMs(1, 3));
        const ts2 = await jetzt(); await tippe('rueckgaengig'); soll.rueckgaengig(ts2); await synchron(soll);
        zaehler.rueckgaengig++;
        return;
      }
      if (x < 0.06) { // Doppeltipp auf die aktive Taste (darf nichts ändern)
        const ts = await jetzt(); await tippe(`t-${a.t}`); soll.tippeT(ts, a.t); await synchron(soll);
        zaehler.doppeltipps++;
        return;
      }
      if (x < 0.10) { // Kommentar zur laufenden Episode
        const text = r.wahl(KOMMENTARE);
        await tippe('kommentar');
        await page.locator('[data-test=episoden-kommentar]').fill(text);
        const ts = await jetzt();
        await tippe('kommentar-speichern');
        soll.kommentarEpisode(ts, text);
        await expect(page.locator('[data-test=dialog-kommentar]')).toHaveCount(0);
        zaehler.kommentare++;
        return;
      }
      const { felder } = soll.zusatz(a.t);
      if (x < 0.25 && a.t === 'T3' && felder.length) { // Nutzungsart/Haltung wechselt während HX-Now-Nutzung
        const feld = r.wahl(felder);
        const code = feld === 'n' ? nutzungsart(r, 'T3', a.o) : haltung(r, a.o);
        const ts = await jetzt(); await tippe(`${feld}-${code}`); soll.tippeZusatz(ts, feld, code); await synchron(soll);
        return;
      }
      if (x < 0.40) { // Ortswechsel bei gleicher Tätigkeit
        const o = ortFuer(r, kontext, a.t, null);
        const ts = await jetzt(); await tippe(`o-${o}`); soll.tippeO(ts, o); await synchron(soll);
        return;
      }
      await wechsleT(naechsteTaetigkeit(r, kontext, m.phase, a.t));
    }

    async function ereignis(e) {
      if (e.art === 'pause') {
        let ts = await jetzt(); await tippe('pause'); soll.pause(ts); await synchron(soll);
        await vor(r.dauerMs(1, 4));
        if (e.grund) { ts = await jetzt(); await tippe(`pausegrund-${e.grund}`); soll.pausenGrund(ts, e.grund); await expect(page.locator(`[data-test=pausegrund-${e.grund}]`)).toHaveAttribute('aria-pressed', 'true'); }
        if (e.notiz) {
          await tippe('kommentar');
          await page.locator('[data-test=pause-freitext]').fill(e.notiz);
          ts = await jetzt(); await tippe('pause-notiz-speichern'); soll.pausenNotiz(ts, e.notiz);
          await expect(page.locator('[data-test=pause-notiz]')).toBeVisible();
        }
        const pauseStart = soll.pausen.at(-1).startTs;
        const rest = pauseStart + e.dauerSek * 1000 - (await jetzt());
        if (e.gesperrt) {
          soll.log(await jetzt(), 'iPhone gesperrt (App im Hintergrund)');
          await page.goto('about:blank'); await vor(rest); await page.goto('./');
          soll.log(await jetzt(), 'iPhone entsperrt, App wieder geöffnet');
          await synchron(soll);
        } else {
          await vor(rest);
        }
        if (e.abbruch) return; // Abbruch folgt während der Pause
        ts = await jetzt(); await tippe('pause'); soll.fortsetzen(ts); await synchron(soll);
      } else if (e.art === 'neuladen') {
        soll.log(await jetzt(), 'App neu geladen (z. B. aus dem App-Umschalter beendet und neu geöffnet)');
        await page.reload(); await synchron(soll);
      } else if (e.art === 'gesperrt') {
        soll.log(await jetzt(), `iPhone ${e.dauerSek} s gesperrt`);
        await page.goto('about:blank'); await vor(e.dauerSek * 1000); await page.goto('./');
        soll.log(await jetzt(), 'iPhone entsperrt, App wieder geöffnet');
        await synchron(soll);
      } else if (e.art === 'geraet') {
        if (soll.geraetAutomatisch || soll.geraetMarkiertTs !== null) { soll.log(await jetzt(), 'Gerät dabei war bereits gesetzt – kein Tipp nötig'); return; }
        const ts = await jetzt(); await tippe('geraet-dabei'); soll.geraetSchalter(ts);
        await expect(page.locator('[data-test=geraet-dabei]')).toHaveAttribute('aria-pressed', 'true');
      }
    }

    // Hauptschleife über die beobachtete Zeit
    const PUFFER_MS = 10_000;
    const ereignisse = [...(sz.ereignisse ?? [])].sort((a, b) => a.beiSek - b.beiSek);
    let ei = 0;
    const ende = sz.ende;
    const endeBeiMs = (ende.art === 'regulaer' ? m.dauerSek : ende.beiSek) * 1000;
    for (;;) {
      const obs = soll.beobachtetMs(await jetzt());
      let dauer = r.dauerMs(...DAUER[soll.akt.t]);
      if (r.ja(0.05)) { dauer = r.dauerMs(1.5, 4.5); zaehler.kurzepisoden++; } // sehr kurze Episode (< 5 s, bleibt roh erhalten)
      const naechstes = ereignisse[ei];
      if (naechstes && naechstes.beiSek * 1000 <= Math.min(obs + dauer + PUFFER_MS, endeBeiMs)) {
        await vor(naechstes.beiSek * 1000 - obs);
        await ereignis(naechstes);
        ei++;
        if (naechstes.abbruch) break;
        continue;
      }
      // Puffer: nach einem Wechsel folgen noch Ort/Nutzung/Haltung oder Rückgängig (bis ca. 8,5 s)
      if (obs + dauer + PUFFER_MS >= endeBeiMs) {
        if (ende.art === 'regulaer') {
          await vor(endeBeiMs - obs + r.dauerMs(0.5, 5));
        } else if (ende.art === 'ablaufImHintergrund') {
          await vor(endeBeiMs - obs);
          soll.log(await jetzt(), 'iPhone gesperrt – Blockzeit läuft im Hintergrund ab');
          await page.goto('about:blank'); await vor(30 * 60_000); await page.goto('./');
        } else {
          await vor(endeBeiMs - obs);
        }
        break;
      }
      await vor(dauer);
      await modellAktion();
    }

    // Blockende
    if (ende.art === 'regulaer' || ende.art === 'ablaufImHintergrund') {
      await expect(page.locator('[data-test=abschluss-status]')).toHaveText('Regulär beendet');
      soll.regulaer();
    } else if (ende.art === 'abbruch') {
      await tippe('abbruch');
      await tippe(`abbruch-${ende.grund}`);
      if (ende.kommentar) await page.locator('[data-test=abbruch-kommentar]').fill(ende.kommentar);
      const ts = await jetzt();
      await tippe('abbruch-bestaetigen');
      soll.abbruch(ts, ende.grund, ende.kommentar ?? '');
      await expect(page.locator('[data-test=abschluss-status]')).toContainText(`Abgebrochen: ${ende.grund}`);
    } else if (ende.art === 'beenden') {
      await tippe('beenden');
      const ts = await jetzt();
      if (ende.behalten) await tippe('beenden-behalten');
      else { await tippe('beenden-verwerfen'); await tippe('bestaetigen-ja'); }
      soll.beendet(ts, ende.behalten);
      await expect(page.locator('[data-test=abschluss-status]')).toBeVisible();
    }

    // Abschlussseite: fehlende Angaben, unvollständige Episoden, Gerät dabei, Blockkommentar, Export
    const a = sz.abschluss ?? {};
    let dateiname = null;
    let csv = null;
    if (soll.status !== 'verworfen') {
      if (a.kontext) { await tippe(`ergaenze-arbeitskontext-${a.kontext}`); soll.meta.arbeitskontext = a.kontext; soll.log(await jetzt(), `Kontext ${a.kontext} nachgetragen`); await expect(page.locator('[data-test=abschluss-kontext]')).toContainText(a.kontext); }
      if (a.dienst) { await tippe(`ergaenze-dienst-${a.dienst}`); soll.meta.dienst = a.dienst; soll.log(await jetzt(), `Dienst ${a.dienst} nachgetragen`); await expect(page.locator('[data-test=ergaenze-dienst-S]')).toHaveCount(0); }
      if (a.unvollstaendigErgaenzen) {
        for (const e of soll.episoden) {
          const { pflicht } = soll.zusatz(e.t);
          for (const f of [...e.offen].filter((x) => pflicht.includes(x))) {
            const code = f === 'n' ? 'N1' : 'H2';
            await tippe(`ergaenzen-${e.nr}-${code}`);
            e[f] = code; e.offen.delete(f);
            soll.log(await jetzt(), `Episode ${e.nr}: ${f === 'n' ? 'Nutzungsart' : 'Haltung'} ${code} nachgetragen`);
            await expect(page.locator(`[data-test=ergaenzen-${e.nr}-${code}]`)).toHaveCount(0);
          }
        }
      }
      if (a.geraet && soll.post) {
        await tippe(`geraet-${a.geraet}`);
        soll.geraetAntwort = a.geraet;
        await expect(page.locator(`[data-test=geraet-${a.geraet}]`)).toHaveAttribute('aria-pressed', 'true');
      }
      if (a.kommentar) {
        await page.locator('[data-test=block-kommentar]').fill(a.kommentar);
        await tippe('block-kommentar-speichern');
        soll.kommentar = a.kommentar;
        await expect(page.locator('#meldung')).toContainText('Kommentar gespeichert');
      }
      await tippe('exportieren');
      await expect(page.locator('[data-test=abschluss-export]')).toContainText('exportiert');
      const f = await letzteDatei();
      dateiname = f.name;
      csv = f.text;
      speichereDatei(dateiname, csv);
    }

    // Prüfen: Export-CSV und Rohdaten
    const db = await leseDb(page);
    const block = db.bloecke.find((b) => b.startTs === soll.startTs);
    const roh = { block, episoden: db.episoden.filter((e) => e.blockId === block?.blockId), pausen: db.pausen.filter((q) => q.blockId === block?.blockId) };
    let ergebnis;
    if (!block) {
      ergebnis = { pruefungen: [{ name: 'Block in der Datenbank gefunden', ok: false, detail: `kein Block mit Start ${isoBerlin(soll.startTs)}` }], gelesen: [] };
    } else if (csv) {
      ergebnis = pruefeBlock(soll, csv, roh);
      ergebnis.pruefungen.push({ name: 'Exportstatus = exportiert', ok: block.exportStatus === 'exportiert', detail: block.exportStatus });
    } else {
      const [name, ok, detail] = pruefeRohdaten(soll, roh);
      ergebnis = { pruefungen: [{ name, ok, detail }, { name: 'Verworfener Block: kein Export, Daten bleiben gespeichert', ok: block.status === 'verworfen', detail: block.status }], gelesen: [] };
    }

    await tippe('zur-startseite');
    await expect(page.locator('[data-test=neuer-block]')).toBeVisible();

    lauf.szenarien.push({
      titel: sz.titel,
      beschreibung: sz.beschreibung,
      kennzahlen: {
        Episoden: soll.episoden.length, Pausen: soll.pausen.length, 'Rückgängig': zaehler.rueckgaengig,
        Kommentare: zaehler.kommentare, Doppeltipps: zaehler.doppeltipps, 'Episoden < 5 s': zaehler.kurzepisoden,
        'Beobachtet (s)': Math.round(soll.beobachtetMs(soll.endTs) / 1000),
      },
      pruefungen: ergebnis.pruefungen,
      gelesen: ergebnis.gelesen,
      dateien: dateiname ? [dateiname] : [],
      protokoll: soll.protokoll.map((p) => ({ zeit: isoBerlin(p.ts).slice(11, 19), text: p.text })),
    });
    return soll;
  }

  const pseudo = () => `P${String(r.ganz(1, 99)).padStart(3, '0')}`;
  const zwischen = () => vor(r.dauerMs(600, 2400)); // 10–40 min bis zum nächsten Block

  // ================================================================== Tag 1: Prä-Phase, Nephrologie, Frühdienst
  await tageskennzahlen('NEPH');
  await vor(r.dauerMs(300, 900));
  await spieleBlock({
    titel: 'Prä 1 – Visite, 15 min, Pause mit Grund, App neu geladen',
    beschreibung: 'Visite auf Station (K1). Nach ca. 5 min lehnt eine Patientin die Anwesenheit ab (Pause P1), nach ca. 9 min wird die App neu geladen. Reguläres Ende.',
    meta: { pseudonym: pseudo(), phase: 'PRE', bereich: 'NEPH', dienst: 'F', arbeitskontext: 'K1', dauerSek: 900 },
    ereignisse: [{ beiSek: r.ganz(250, 330), art: 'pause', dauerSek: r.ganz(40, 120), grund: 'P1' }, { beiSek: r.ganz(500, 580), art: 'neuladen' }],
    ende: { art: 'regulaer' },
    abschluss: {},
  });
  await zwischen();
  await spieleBlock({
    titel: 'Prä 2 – Stationsarbeit, 10 min, iPhone 3 min gesperrt',
    beschreibung: 'Stationsarbeit (K3), Blockdauer 10 min. Nach ca. 4 min wird das iPhone für 3 min gesperrt – die Kodierung läuft weiter. Blockkommentar mit Sonderzeichen.',
    meta: { pseudonym: pseudo(), phase: 'PRE', bereich: 'NEPH', dienst: 'F', arbeitskontext: 'K3', dauerSek: 600 },
    ereignisse: [{ beiSek: r.ganz(200, 260), art: 'gesperrt', dauerSek: 180 }],
    ende: { art: 'regulaer' },
    abschluss: { kommentar: 'Ruhiger Vormittag; "Visite" verschoben\nzweite Zeile' },
  });
  await zwischen();
  await versuch('PRE', 'NEPH');
  await vor(r.dauerMs(300, 900));
  await spieleBlock({
    titel: 'Prä 3 – Abbruch A1 während einer Pause',
    beschreibung: 'Visite (K1). Nach ca. 6 min Pause ohne Grund; nach 30–60 s bittet die beobachtete Person um Abbruch (A1).',
    meta: { pseudonym: pseudo(), phase: 'PRE', bereich: 'NEPH', dienst: 'F', arbeitskontext: 'K1', dauerSek: 900 },
    ereignisse: [{ beiSek: r.ganz(330, 400), art: 'pause', dauerSek: r.ganz(30, 60), abbruch: true }],
    ende: { art: 'abbruch', grund: 'A1', beiSek: 9999 },
    abschluss: {},
  });

  // ================================================================== Tag 2: Post-Phase, Notaufnahme, Spätdienst
  const tag2 = new Date('2027-03-10T14:20:00+01:00').getTime();
  await page.clock.pauseAt(tag2); // Sprung zum Post-Tag (Monate später; dazwischen keine Nutzung)
  await page.reload();
  await expect(page.locator('[data-test=neuer-block]')).toBeVisible();
  await tageskennzahlen('ZNA');
  await vor(r.dauerMs(300, 900));
  await spieleBlock({
    titel: 'Post 1 – Notaufnahme mit HX Now, Pause P5 mit Notiz bei gesperrtem iPhone',
    beschreibung: 'Behandlungsbereich (K6). HX Now wird mehrfach genutzt (setzt „Gerät dabei“ automatisch). Pause P5 mit Notiz, während der Pause ist das iPhone gesperrt. Unvollständige HX-Now-Episoden werden am Ende ergänzt; „Gerät dabei“ ist mit „ja“ vorbelegt.',
    meta: { pseudonym: pseudo(), phase: 'POST', bereich: 'ZNA', dienst: 'S', arbeitskontext: 'K6', dauerSek: 900 },
    ereignisse: [{ beiSek: r.ganz(300, 420), art: 'pause', dauerSek: r.ganz(60, 200), grund: 'P5', notiz: 'Schockraum; "Alarm" Stufe 2', gesperrt: true }],
    ende: { art: 'regulaer' },
    abschluss: { unvollstaendigErgaenzen: true },
  });
  await zwischen();
  await spieleBlock({
    titel: 'Post 2 – ohne Kontext und Dienst gestartet, Gerät manuell markiert',
    beschreibung: 'Nur Pflichtangaben beim Start (10 min). Nach ca. 2 min wird „Gerät dabei“ von Hand gesetzt (Gerät in der Kitteltasche). Am Ende werden Kontext (K6) und Dienst (S) nachgetragen und „Gerät dabei“ mit „nicht erkennbar“ beantwortet.',
    meta: { pseudonym: pseudo(), phase: 'POST', bereich: 'ZNA', dienst: null, arbeitskontext: null, modellKontext: 'K6', dauerSek: 600 },
    ereignisse: [{ beiSek: r.ganz(90, 150), art: 'geraet' }],
    ende: { art: 'regulaer' },
    abschluss: { kontext: 'K6', dienst: 'S', geraet: 'U' },
  });
  await zwischen();
  await spieleBlock({
    titel: 'Post 3 – Blockzeit läuft bei gesperrtem iPhone ab',
    beschreibung: 'Notaufnahmestation (K7). Nach ca. 11 min wird das iPhone gesperrt und erst 30 min später geöffnet – die App zeigt die Abschlussseite, Ende = Start + 15 min.',
    meta: { pseudonym: pseudo(), phase: 'POST', bereich: 'ZNA', dienst: 'S', arbeitskontext: 'K7', modellKontext: 'K6', dauerSek: 900 },
    ereignisse: [],
    ende: { art: 'ablaufImHintergrund', beiSek: r.ganz(640, 700) },
    abschluss: { geraet: 'J' },
  });
  await zwischen();
  await versuch('POST', 'ZNA');
  await vor(r.dauerMs(300, 900));
  await spieleBlock({
    titel: 'Post 4 – vorzeitig beendet, Daten behalten',
    beschreibung: 'Behandlungsbereich (K6). Nach ca. 7 min wird der Block vorzeitig beendet (Daten behalten).',
    meta: { pseudonym: pseudo(), phase: 'POST', bereich: 'ZNA', dienst: 'S', arbeitskontext: 'K6', dauerSek: 900 },
    ereignisse: [],
    ende: { art: 'beenden', behalten: true, beiSek: r.ganz(380, 460) },
    abschluss: {},
  });
  await zwischen();
  await spieleBlock({
    titel: 'Post 5 – vorzeitig beendet, Daten verworfen',
    beschreibung: 'Nach ca. 2 min wird klar, dass die falsche Person beobachtet wird: Block beenden → verwerfen. Der Block darf nicht exportiert werden, bleibt aber gespeichert.',
    meta: { pseudonym: pseudo(), phase: 'POST', bereich: 'ZNA', dienst: 'S', arbeitskontext: 'K6', dauerSek: 900 },
    ereignisse: [],
    ende: { art: 'beenden', behalten: false, beiSek: r.ganz(90, 150) },
    abschluss: {},
  });
  lauf.simTag = `Prä: ${isoBerlin(tag1.getTime()).slice(0, 10)} (Nephrologie, Früh) · Post: ${isoBerlin(tag2).slice(0, 10)} (Notaufnahme, Spät)`;

  // ================================================================== Tagesabschluss: Exporte von der Startseite
  const verworfen = (await leseDb(page)).bloecke.filter((b) => b.status === 'verworfen').length;
  gesamt('Verworfener Block erscheint nicht in der Exportliste', (await page.locator('[data-test=eintrag-block]').count()) === (await leseDb(page)).bloecke.filter((b) => b.status !== 'verworfen' && b.exportStatus !== 'bestaetigt').length, `verworfen: ${verworfen}`);
  for (const art of ['eintrag-tag', 'eintrag-versuch']) {
    for (;;) {
      const offen = page.locator(`[data-test=${art}][data-export=offen]`);
      const anzahl = await offen.count();
      if (!anzahl) break;
      const vorher = (await geteilt(page)).length;
      await offen.first().locator('[data-test=exportieren]').tap();
      await expect.poll(async () => (await geteilt(page)).length).toBe(vorher + 1);
      await expect(offen).toHaveCount(anzahl - 1); // Status gespeichert, Liste neu gezeichnet
    }
  }
  const alleDateien = await geteilt(page);
  for (const t of tagErwartet) {
    const f = alleDateien.find((d) => d.name.startsWith(`HXNOW_TAG_${t.bereich}_${t.datum.replace(/-/g, '')}`));
    if (!f) { gesamt(`Tageskennzahlen ${t.bereich} ${t.datum} exportiert`, false, 'keine Datei'); continue; }
    speichereDatei(f.name, f.text);
    for (const x of pruefeEinzelCsv(`Tageskennzahlen ${t.bereich} ${t.datum}`, f.text, t.werte).pruefungen) gesamt(x.name, x.ok, x.detail);
  }
  const dbJetzt = await leseDb(page);
  for (const v of versuchErwartet) {
    const f = alleDateien.find((d) => d.name.startsWith(`HXNOW_VERSUCH_${v.pseudonym}_`));
    if (!f) { gesamt(`Versuch ${v.pseudonym} exportiert`, false, 'keine Datei'); continue; }
    speichereDatei(f.name, f.text);
    const gespeichert = dbJetzt.versuche.find((x) => x.pseudonym === v.pseudonym);
    const werte = { ...v.werte, geraete_id: gespeichert?.geraeteId ?? '?', versuch_id: gespeichert?.versuchId ?? '?' };
    for (const x of pruefeEinzelCsv(`Versuch ${v.pseudonym}`, f.text, werte).pruefungen) gesamt(x.name, x.ok, x.detail);
  }

  // Eingang bestätigen (nächster Morgen)
  await vor(16 * 3600_000);
  for (;;) {
    const knopf = page.locator('[data-test=offene-liste] li [data-test=bestaetigen]:not([disabled])').first();
    if (!(await knopf.count())) break;
    const anzahl = await page.locator('[data-test=offene-liste] li').count();
    await knopf.tap();
    await tippe('bestaetigen-ja');
    await expect(page.locator('[data-test=offene-liste] li')).toHaveCount(anzahl - 1);
  }
  gesamt('Alle Exporte bestätigt – Liste „Nicht abgeschlossene Exporte“ leer', await page.locator('[data-test=keine-offenen]').isVisible());
  const dbEnde = await leseDb(page);
  const nichtBestaetigt = [...dbEnde.bloecke.filter((b) => b.status !== 'verworfen'), ...dbEnde.versuche, ...dbEnde.tageskennzahlen].filter((x) => x.exportStatus !== 'bestaetigt' || !x.bestaetigtTs || !x.exportiertTs);
  gesamt('Exportstatus aller Einträge „bestaetigt“ mit Zeitstempeln', nichtBestaetigt.length === 0, `${nichtBestaetigt.length} Einträge offen`);

  // ================================================================== Datensicherung und zweites Gerät
  await tippe('menue-sicherung');
  await tippe('json-export');
  const sicherung = await letzteDatei();
  speichereDatei(sicherung.name, sicherung.text);
  let json = null;
  try { json = JSON.parse(sicherung.text); } catch (e) { gesamt('JSON-Sicherung lesbar', false, e.message); }
  if (json) {
    const sortiert = (liste, k) => [...liste].sort((a, b) => String(a[k]).localeCompare(String(b[k])));
    const vergleich = [['bloecke', 'blockId'], ['episoden', 'episodeId'], ['pausen', 'pauseId'], ['versuche', 'versuchId'], ['tageskennzahlen', 'datum']];
    const gleich = vergleich.every(([s, k]) => JSON.stringify(sortiert(json.stores[s], k)) === JSON.stringify(sortiert(dbEnde[s], k)));
    gesamt('JSON-Sicherung enthält alle gespeicherten Daten unverändert (inkl. gelöschter Episoden)', gleich);

    const ctx2 = await browser.newContext({ ...testInfo.project.use, serviceWorkers: 'block' });
    const seite2 = await ctx2.newPage();
    await seite2.goto('./');
    await seite2.locator('[data-test=menue-sicherung]').tap();
    await seite2.setInputFiles('[data-test=import-datei]', { name: sicherung.name, mimeType: 'application/json', buffer: Buffer.from(sicherung.text) });
    await expect(seite2.locator('#meldung')).toContainText('bereits vorhanden');
    const db2 = await leseDb(seite2);
    const gleich2 = vergleich.every(([s, k]) => JSON.stringify(sortiert(db2[s], k)) === JSON.stringify(sortiert(dbEnde[s], k)));
    gesamt('Import auf zweitem Gerät ergibt identische Daten', gleich2);
    await seite2.setInputFiles('[data-test=import-datei]', { name: sicherung.name, mimeType: 'application/json', buffer: Buffer.from(sicherung.text) });
    await expect(seite2.locator('#meldung')).toContainText('0 neu');
    const db3 = await leseDb(seite2);
    gesamt('Erneuter Import erzeugt keine Dubletten', vergleich.every(([s]) => db3[s].length === db2[s].length));
    await ctx2.close();
  }

  // ================================================================== Bericht
  const { datei, fehler } = schreibeBericht(lauf, SCHEMA);
  writeFileSync(join(ordner, 'seed.txt'), String(SEED));
  console.log(`\nPrüfbericht: ${datei}\nSeed: ${SEED} (wiederholen mit SEED=${SEED} npm run pruefen)\nErgebnis: ${fehler.length === 0 ? 'alle Prüfungen bestanden' : `${fehler.length} Prüfungen fehlgeschlagen`}\n`);
  expect(fehler.map((f) => `${f.name}: ${f.detail}`), `Siehe ${datei}`).toEqual([]);
});
