// Zusammenführungstool (Fragebogenplan F5, PLAN_Logbuch_Datensicherheit L6): liest alle Dateien aus dem Exportordner
// (Beobachtung, Versuch, Tageskennzahlen, Fragebogen, Logbuch-Dateien aller Geräte), wendet die Änderungen aus dem
// Logbuch an und erzeugt Auswertungsdateien und einen Prüfbericht. DOM-frei; läuft im Browser und unter Node.
//
// Regeln:
// - Probeläufe (HXNOW_TEST_…, Test-Code) werden übersprungen.
// - Logbuch-Dateien: je Gerät die neueste (export_ts); daraus Teilnehmerliste, Phasenplan, Einträge, Änderungen. Bei
//   gleicher ID gilt die jüngste Datei. Dateien mit falscher Prüfsumme werden nicht verwendet.
// - Sitzungsdateien gleicher ID: identisch → einmal; verschieden → die zuletzt gelesene, mit Hinweis.
// - Änderungen: `gueltig`, `ungueltig_grund`, wirksamer Code und wirksame Phase (Original in `pseudonym_original`,
//   `phase_original`). Ungültige Sitzungen bleiben in den Long-Dateien (gueltig = 0), fehlen aber in Wide, Prä-Post,
//   Scores und Phasen.
// - Widerrufene Codes: alle Daten werden verworfen (auch aus Dateien, die noch im Ordner liegen).
import { leseCsv, dateiArtAusKopf } from '../csvlesen.js';
import { csvText } from '../export.js';
import { leseLogbuchDatei } from '../logbuchdatei.js';
import { wirksamerStand } from '../aenderungen.js';
import { probandenUebersicht, PHASEN } from '../studienstand.js';
import { exportDateiname } from '../widerruf.js';
import { alleZellen, bogen as bogenNach } from '../fb/definition.js';
import { codebuchDatei } from '../fb/codebuch.js';
import { isoMitOffset } from '../zeit.js';
import { bereinigeBlock } from './bereinigen.js';

const FB_ARTEN = ['FB1', 'KB', 'FB2'];
const ZUSATZ = ['gueltig', 'ungueltig_grund', 'pseudonym_original', 'phase_original', 'nachgetragen', 'nachtrag_von'];

/** Datei am Kopf erkennen (Spaltennamen). */
export function dateiArt(text) {
  return dateiArtAusKopf(String(text).replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].split(';'));
}

/**
 * @param {{ name: string, text: string }[]} dateien
 * @param {{ def, schema, jetzt?: number }} opt Fragebogen-Definition, Kodierschema
 * @returns {{ ausgaben: { name, inhalt }[], bericht: string[], zahlen }}
 */
export function fuehreZusammen(dateien, { def, schema, jetzt = Date.now() }) {
  const bericht = [];
  const hinweis = (t) => bericht.push(t);
  const testCode = schema.pseudonym?.testCode;
  const istTest = (name, code) => /^HXNOW_TEST_/.test(name) || (testCode && code === testCode);
  const zahlen = { vorFestschreibung: 0, gelesen: dateien.length, uebersprungenTest: 0, unbekannt: 0, doppelt: 0, abweichend: 0, widerrufen: 0, logbuecher: 0, logbuchFehler: 0 };

  // ------------------------------------------------------------------ Dateien einlesen
  const logbuecher = [];
  const sitzungen = { block: new Map(), versuch: new Map(), fb: new Map(), tag: new Map() };
  const nachtraege = new Map();
  for (const d of dateien) {
    const art = dateiArt(d.text);
    if (!art) { zahlen.unbekannt += 1; hinweis(`Nicht erkannt, übersprungen: ${d.name}`); continue; }
    // Dateien ohne format_version stammen aus der Zeit vor der Festschreibung (App < 1.0.0) und werden nicht ausgewertet
    if (!String(d.text).replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].split(';').includes('format_version')) {
      zahlen.vorFestschreibung += 1;
      hinweis(`Vor der Festschreibung erzeugt (ohne format_version), nicht ausgewertet: ${d.name}`);
      continue;
    }
    if (art === 'logbuch') {
      if (/^HXNOW_TEST_/.test(d.name)) { zahlen.uebersprungenTest += 1; continue; }
      const lb = leseLogbuchDatei(d.text);
      if (!lb.ok) { zahlen.logbuchFehler += 1; hinweis(`Logbuch-Datei nicht verwendet (${lb.fehler.join(' ')}): ${d.name}`); continue; }
      logbuecher.push({ name: d.name, ...lb });
      continue;
    }
    const { kopf, zeilen } = leseCsv(d.text);
    if (zeilen.length === 0) { zahlen.unbekannt += 1; hinweis(`Leere Datei: ${d.name}`); continue; }
    const z0 = zeilen[0];
    const id = { block: z0.block_id, versuch: z0.versuch_id, fb: z0.sitzung_id, tag: `${z0.datum}|${z0.bereich}|${z0.teilbereich ?? ''}` }[art];
    if (art !== 'tag' && istTest(d.name, z0.pseudonym)) { zahlen.uebersprungenTest += 1; continue; }
    const n = art === 'block' ? Number(z0.n_zeilen_block) : art === 'fb' ? Number(z0.n_zeilen) : zeilen.length;
    if (!(n === zeilen.length || (art === 'block' && n === 0 && zeilen.length === 1))) hinweis(`Unvollständig (${zeilen.length} statt ${n} Zeilen): ${d.name}`);
    if (art === 'fb' && z0.bezug_sitzung_id) { nachtraege.set(id, { name: d.name, text: d.text, kopf, zeilen }); continue; }
    const alt = sitzungen[art].get(id);
    if (alt) {
      if (alt.text.replace(/^﻿/, '') === d.text.replace(/^﻿/, '')) { zahlen.doppelt += 1; continue; }
      zahlen.abweichend += 1;
      hinweis(`Gleiche ID, anderer Inhalt – verwendet wird ${d.name} statt ${alt.name}`);
    }
    sitzungen[art].set(id, { name: d.name, text: d.text, kopf, zeilen });
  }

  // ------------------------------------------------------------------ Abschnitts-Nachträge in die Originalbögen einsetzen
  // (Korrekturauftrag A2): Werte des Nachtrags ersetzen nur Zellen mit Status gefiltert/ausgelassen; fehlende Zellen
  // (z. B. neue Items der aktuellen Definition) kommen hinzu. Ohne Original bleibt der Nachtrag eigenständig in fb_long.
  const nachtragOhneBasis = new Set();
  let nachtragZellen = 0;
  for (const [nid, n] of nachtraege) {
    const basis = sitzungen.fb.get(n.zeilen[0].bezug_sitzung_id);
    if (!basis) {
      hinweis(`Nachtrag ohne Originalbogen (${n.zeilen[0].bezug_sitzung_id}): ${n.name}`);
      sitzungen.fb.set(nid, n);
      nachtragOhneBasis.add(nid);
      continue;
    }
    for (const k of n.kopf) if (!basis.kopf.includes(k)) basis.kopf.push(k);
    for (const r of n.zeilen) {
      const i = basis.zeilen.findIndex((x) => x.item_id === r.item_id);
      const neu = { ...(i >= 0 ? basis.zeilen[i] : basis.zeilen[0]), item_id: r.item_id, item_v: r.item_v, paar: r.paar, typ: r.typ,
        abschnitt: r.abschnitt, wert: r.wert, wert_text: r.wert_text, status: r.status, nachtrag_von: nid };
      if (i < 0) { basis.zeilen.push(neu); nachtragZellen += 1; } else if (['gefiltert', 'ausgelassen'].includes(basis.zeilen[i].status)) { basis.zeilen[i] = neu; nachtragZellen += 1; }
    }
  }
  if (nachtraege.size) hinweis(`Abschnitts-Nachträge: ${nachtraege.size} (${nachtragZellen} Zellen eingesetzt, ${nachtragOhneBasis.size} ohne Originalbogen)`);

  // ------------------------------------------------------------------ Logbuch zusammenführen
  const jeGeraet = new Map();
  for (const lb of logbuecher) {
    const g = lb.meta?.geraeteId ?? lb.name;
    const alt = jeGeraet.get(g);
    if (!alt || (lb.meta?.exportTs ?? 0) > (alt.meta?.exportTs ?? 0)) jeGeraet.set(g, lb);
  }
  const genutzt = [...jeGeraet.values()].sort((a, b) => (a.meta?.exportTs ?? 0) - (b.meta?.exportTs ?? 0));
  zahlen.logbuecher = genutzt.length;
  const karte = (feld, schl) => {
    const m = new Map();
    for (const lb of genutzt) for (const x of lb[feld]) m.set(x[schl], x);
    return m;
  };
  const teilnehmende = karte('teilnehmende', 'pseudonym');
  const phasenplan = [...karte('phasenplan', 'bereich').values()];
  const logbuchKarte = karte('logbuch', 'eintragId');
  const aenderungen = [...karte('aenderungen', 'aenderungId').values()].sort((a, b) => a.ts - b.ts);
  if (genutzt.length === 0) hinweis('Keine gültige Logbuch-Datei – Änderungen (ungültig, Zuordnung, Phase) können nicht angewendet werden.');
  for (const lb of genutzt) hinweis(`Logbuch verwendet: ${lb.name} (Gerät ${String(lb.meta?.geraeteId).slice(0, 8)}, Stand ${lb.meta?.exportTs ? isoMitOffset(lb.meta.exportTs) : '?'}: ${lb.meta?.standText ?? ''})`);

  const widerrufen = new Set([...teilnehmende.values()].filter((t) => t.status === 'widerrufen').map((t) => t.pseudonym));
  const stand = (id) => {
    const l = logbuchKarte.get(id);
    return l ? wirksamerStand(l, aenderungen) : null;
  };
  const zusatz = (id, pseudonym, phase) => {
    const s = stand(id);
    if (!s) return { gueltig: 1, ungueltig_grund: '', pseudonym_original: '', phase_original: '', nachgetragen: '', pseudonym, phase, imLogbuch: false };
    return {
      gueltig: s.gueltig ? 1 : 0, ungueltig_grund: s.ungueltigGrund ?? '', pseudonym_original: s.pseudonymOriginal ?? '', phase_original: s.phaseOriginal ?? '',
      nachgetragen: (s.nachgetragen ?? []).join(','), arbeitskontext: s.arbeitskontext, dienst: s.dienst,
      pseudonym: s.pseudonym, phase: s.phase ?? phase, imLogbuch: true,
    };
  };
  const istWiderrufen = (roh, wirksam) => widerrufen.has(roh) || widerrufen.has(wirksam);

  // ------------------------------------------------------------------ Long-Dateien mit Änderungen
  const ausgaben = [];
  const verworfen = new Set();
  function langDatei(art, name, idSpalte, phaseSpalte) {
    const kopf = [];
    for (const s of sitzungen[art].values()) for (const k of s.kopf) if (!kopf.includes(k)) kopf.push(k);
    const alle = [...kopf, ...ZUSATZ];
    const zeilen = [];
    for (const [id, s] of sitzungen[art]) {
      const z0 = s.zeilen[0];
      const zu = art === 'tag' ? null : zusatz(id, z0.pseudonym, phaseSpalte ? z0[phaseSpalte] : null);
      if (zu && istWiderrufen(z0.pseudonym, zu.pseudonym)) { zahlen.widerrufen += 1; verworfen.add(id); continue; }
      for (const r of s.zeilen) {
        const w = { ...r };
        if (zu) {
          w.pseudonym = zu.pseudonym;
          if (phaseSpalte) w[phaseSpalte] = zu.phase;
          Object.assign(w, { gueltig: zu.gueltig, ungueltig_grund: zu.ungueltig_grund, pseudonym_original: zu.pseudonym_original, phase_original: zu.phase_original, nachgetragen: zu.nachgetragen });
          // nachgetragene Blockangaben (Änderung NACHTRAG_FELD) füllen nur leere Felder
          if (art === 'block') for (const feld of ['arbeitskontext', 'dienst']) if (!w[feld] && zu[feld]) w[feld] = zu[feld];
        } else Object.assign(w, { gueltig: 1 });
        zeilen.push(alle.map((k) => w[k] ?? ''));
      }
    }
    ausgaben.push({ name, inhalt: csvText(art === 'tag' ? kopf : alle, art === 'tag' ? zeilen.map((z) => z.slice(0, kopf.length)) : zeilen) });
  }
  langDatei('block', 'beobachtung.csv', 'block_id', 'phase');
  // Bereinigte Beobachtung: kurze Episoden zusammengelegt (Kodierhandbuch 1.0, Mindestdauer)
  const regeln = { mindestdauerSek: schema.regelnAuswertung?.mindestdauerSek ?? 3, mindestdauerAusnahmen: schema.regelnAuswertung?.mindestdauerAusnahmen ?? ['T3'] };
  const roh = leseCsv(ausgaben[0].inhalt);
  const jeBlock = Map.groupBy(roh.zeilen, (z) => z.block_id);
  const bereinigt = [...jeBlock.values()].flatMap((z) => bereinigeBlock(z, regeln));
  const zusammengelegt = bereinigt.reduce((s, z) => s + (z.datensatz === 'episode' ? z.zusammengelegt - 1 : 0), 0);
  ausgaben.push({ name: 'beobachtung_bereinigt.csv', inhalt: csvText([...roh.kopf, 'zusammengelegt'], bereinigt.map((z) => [...roh.kopf.map((k) => z[k] ?? ''), z.zusammengelegt])) });
  // Kodierschema-Versionen der Blöcke: bei gemischten Versionen Codes mit geänderter Bedeutung beachten (z. B. T5 ab 2.0)
  const schemaJeBlock = new Map(roh.zeilen.map((z) => [z.block_id, z.schema_version]));
  const schemaZaehlung = [...schemaJeBlock.values()].reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map());
  const gehenMitNeben = roh.zeilen.filter((z) => z.datensatz === 'episode' && z.taetigkeit === 'T9' && z.nebentaetigkeiten).length;
  langDatei('versuch', 'versuche.csv', 'versuch_id', 'phase');
  langDatei('tag', 'tageskennzahlen.csv', null, null);
  langDatei('fb', 'fb_long.csv', 'sitzung_id', null);

  // ------------------------------------------------------------------ Fragebögen: Wide, Prä-Post, Scores
  const boegen = [...sitzungen.fb.entries()].filter(([id]) => !verworfen.has(id) && !nachtragOhneBasis.has(id)).map(([id, s]) => {
    const z0 = s.zeilen[0];
    const zu = zusatz(id, z0.pseudonym, null);
    const werte = Object.fromEntries(s.zeilen.map((r) => [r.item_id, r.wert !== '' ? r.wert : r.wert_text]));
    return { id, bogen: z0.bogen, z0, zu, werte };
  });
  const gueltigeBoegen = boegen.filter((b) => b.zu.gueltig === 1);
  const META_WIDE = ['sitzung_id', 'pseudonym', 'bereich', 'erhebungsmodus', 'papier_datum', 'start', 'ende', 'dauer_sek', 'definition_version', 'geraete_id'];
  for (const art of FB_ARTEN) {
    const b = bogenNach(def, art);
    const liste = gueltigeBoegen.filter((x) => x.bogen === art);
    const ids = [...alleZellen(b, { mitEntfernten: true }).map((z) => z.id)];
    for (const x of liste) for (const k of Object.keys(x.werte)) if (!ids.includes(k)) ids.push(k);
    ausgaben.push({
      name: `${art.toLowerCase()}_wide.csv`,
      inhalt: csvText([...META_WIDE, ...ids], liste.map((x) => [...META_WIDE.map((k) => (k === 'pseudonym' ? x.zu.pseudonym : x.z0[k] ?? '')), ...ids.map((i) => x.werte[i] ?? '')])),
    });
  }

  // Prä-Post: je Code und Paar-ID FB1- und FB2-Wert, FB2 auf FB1-Codes umkodiert
  const zellenFb1 = new Map(alleZellen(bogenNach(def, 'FB1'), { mitEntfernten: true }).filter((z) => z.paar).map((z) => [z.paar, z]));
  const zellenFb2 = new Map(alleZellen(bogenNach(def, 'FB2'), { mitEntfernten: true }).filter((z) => z.paar).map((z) => [z.paar, z]));
  const paare = [...new Set([...zellenFb1.keys(), ...zellenFb2.keys()])];
  const juengster = (code, art) => gueltigeBoegen.filter((x) => x.zu.pseudonym === code && x.bogen === art).sort((a, b) => String(b.z0.start).localeCompare(String(a.z0.start)))[0] ?? null;
  const codes = [...new Set(gueltigeBoegen.filter((x) => x.bogen === 'FB1' || x.bogen === 'FB2').map((x) => x.zu.pseudonym))].sort();
  const praePost = [];
  for (const code of codes) {
    const f1 = juengster(code, 'FB1');
    const f2 = juengster(code, 'FB2');
    for (const paar of paare) {
      const z1 = zellenFb1.get(paar);
      const z2 = zellenFb2.get(paar);
      const w1 = f1 && z1 ? f1.werte[z1.id] ?? '' : '';
      const w2 = f2 && z2 ? f2.werte[z2.id] ?? '' : '';
      const um = z2?.paarUmkodierung && /^\d+$/.test(String(w2)) ? z2.paarUmkodierung[Number(w2)] ?? '' : w2;
      praePost.push([code, paar, z1?.id ?? '', w1, z2?.id ?? '', w2, um, f1 ? 1 : 0, f2 ? 1 : 0]);
    }
  }
  ausgaben.push({ name: 'prae_post.csv', inhalt: csvText(['pseudonym', 'paar', 'fb1_item', 'fb1_wert', 'fb2_item', 'fb2_wert', 'fb2_wert_wie_fb1', 'fb1_vorhanden', 'fb2_vorhanden'], praePost) });

  // Scores
  const SKALEN = ['ATI', 'TAM_PU', 'TAM_PEOU', 'TAM_BI', 'SUS'];
  const scoreZeilen = gueltigeBoegen.map((x) => {
    const b = bogenNach(def, x.bogen);
    const items = alleZellen(b).filter((z) => z.skala);
    const s = Object.fromEntries(SKALEN.map((sk) => [sk, score(items.filter((z) => z.skala === sk), x.werte, sk === 'SUS')]));
    return [x.id, x.bogen, x.zu.pseudonym, x.z0.bereich, x.z0.start, ...SKALEN.map((sk) => s[sk])];
  });
  ausgaben.push({ name: 'scores.csv', inhalt: csvText(['sitzung_id', 'bogen', 'pseudonym', 'bereich', 'start', ...SKALEN], scoreZeilen) });

  // ------------------------------------------------------------------ Logbuch gesamt, Phasen, alle Einträge, Änderungen
  const dateiZu = new Map();
  for (const art of ['block', 'versuch', 'fb']) for (const [id, s] of sitzungen[art]) dateiZu.set(id, s.name);
  const logbuchListe = [...logbuchKarte.values()].filter((l) => !l.testmodus);
  const wirksam = logbuchListe.map((l) => wirksamerStand(l, aenderungen)).filter((e) => !istWiderrufen(e.pseudonymOriginal ?? e.pseudonym, e.pseudonym));
  const LOGBUCH_SPALTEN = ['eintrag_id', 'art', 'pseudonym', 'pseudonym_original', 'phase', 'phase_original', 'bereich', 'dienst', 'arbeitskontext',
    'start', 'ende', 'dauer_sek', 'beobachtet_sek', 'pausen_anzahl', 'pausen_sek', 'status', 'abbruch_code', 'erhebungsmodus', 'papier_datum', 'export_status',
    'geraete_id', 'gueltig', 'ungueltig_grund', 'kommentare', 'wiederhergestellt', 'datei'];
  const iso = (ts) => (ts ? isoMitOffset(ts) : '');
  ausgaben.push({
    name: 'logbuch_gesamt.csv',
    inhalt: csvText(LOGBUCH_SPALTEN, wirksam.sort((a, b) => a.startTs - b.startTs).map((e) => [
      e.eintragId, e.art, e.pseudonym, e.pseudonymOriginal ?? '', e.phase ?? '', e.phaseOriginal ?? '', e.bereich ?? '', e.dienst ?? '', e.arbeitskontext ?? '',
      iso(e.startTs), iso(e.endTs), FB_ARTEN.includes(e.art) ? e.dauerSek ?? e.beobachtetSek ?? '' : (e.startTs && e.endTs ? Math.round((e.endTs - e.startTs) / 1000) : ''), FB_ARTEN.includes(e.art) ? '' : e.beobachtetSek ?? '', e.pausenAnzahl ?? '', e.pausenSek ?? '', e.status, e.abbruchCode ?? '', e.erhebungsmodus ?? '',
      e.papierDatum ?? '', e.exportStatus ?? '', e.geraeteId ?? '', e.gueltig ? 1 : 0, e.ungueltigGrund ?? '', e.kommentare.filter((k) => !k.zurueckgezogen).length,
      e.wiederhergestellt ? 1 : 0, dateiZu.get(e.eintragId) ?? '',
    ])),
  });

  // alle Einträge: Logbuch ∪ Dateien, mit Abgleich
  const alleIds = new Set([...wirksam.map((e) => e.eintragId), ...[...dateiZu.keys()].filter((id) => !verworfen.has(id))]);
  const fehlendeDateien = [];
  const ohneLogbuch = [];
  const alleZeilen = [...alleIds].map((id) => {
    const e = wirksam.find((x) => x.eintragId === id);
    const datei = dateiZu.get(id) ?? '';
    const erwartet = e ? exportDateiname(e) : null;
    let pruefung = '';
    if (e?.geloescht && !datei) pruefung = 'gelöscht';
    else if (e && erwartet && !datei && e.status !== 'laufend') { pruefung = e.exportStatus === 'offen' ? 'nicht exportiert' : 'Datei fehlt'; if (pruefung === 'Datei fehlt') fehlendeDateien.push(erwartet); }
    if (!e) { pruefung = 'nicht im Logbuch'; ohneLogbuch.push(datei); }
    return [id, e?.art ?? '', e?.pseudonym ?? '', e ? iso(e.startTs) : '', e ? 1 : 0, datei, erwartet ?? '', pruefung];
  });
  ausgaben.push({ name: 'alle_eintraege.csv', inhalt: csvText(['eintrag_id', 'art', 'pseudonym', 'start', 'im_logbuch', 'datei', 'erwarteter_dateiname', 'pruefung'], alleZeilen) });

  const uebersicht = probandenUebersicht({
    teilnehmende: [...teilnehmende.values()].filter((t) => !widerrufen.has(t.pseudonym)), phasenplan, logbuch: logbuchListe, aenderungen,
  }, { ziel: schema.zielBloeckeProPhase ?? 5, jetzt });
  const tag = (ts) => (ts ? iso(ts).slice(0, 10) : '');
  const phasenZeilen = uebersicht.flatMap((u) => PHASEN.map((p) => {
    const x = u.phasen[p.id];
    return [u.t.pseudonym, u.t.bereich ?? '', u.t.status, p.id, u.daten[p.von] ?? '', p.bis === 'ende' ? u.daten.ende ?? '' : u.daten[p.bis] ?? '',
      tag(x.tatsaechlich?.von), tag(x.tatsaechlich?.bis), x.ziel ?? '', p.blockPhase ? x.bloecke : '', p.blockPhase ? x.ungueltig : '', p.blockPhase ? x.minuten : '',
      p.blockPhase ? x.versuche : '', p.bogen, x.bogen ? 1 : 0, x.bogen ? tag(x.bogen.startTs) : ''];
  }));
  ausgaben.push({
    name: 'phasen.csv',
    inhalt: csvText(['pseudonym', 'bereich', 'status', 'phase', 'geplant_von', 'geplant_bis', 'tatsaechlich_von', 'tatsaechlich_bis', 'ziel_bloecke',
      'bloecke_gueltig', 'bloecke_ungueltig', 'minuten', 'nicht_angetroffen', 'bogen', 'bogen_vorhanden', 'bogen_datum'], phasenZeilen),
  });
  ausgaben.push({
    name: 'aenderungen.csv',
    inhalt: csvText(['aenderung_id', 'ts', 'geraete_id', 'art', 'ziel_typ', 'ziel_id', 'feld', 'alt', 'neu', 'grund', 'text'],
      aenderungen.filter((a) => !widerrufen.has(a.zielId)).map((a) => [a.aenderungId, isoMitOffset(a.ts, true), a.geraeteId, a.art, a.zielTyp, a.zielId, a.feld ?? '', a.alt ?? '', a.neu ?? '', a.grund ?? '', a.text ?? ''])),
  });
  const cb = codebuchDatei(def);
  ausgaben.push({ name: cb.dateiname, inhalt: cb.inhalt });

  // ------------------------------------------------------------------ Prüfbericht
  const n = (art) => [...sitzungen[art].keys()].filter((id) => !verworfen.has(id)).length;
  const kopfBericht = [
    'HX Now – Prüfbericht der Zusammenführung',
    `Erstellt: ${isoMitOffset(jetzt)} · Fragebogen-Definition ${def.definitionVersion}`,
    '',
    `Dateien gelesen: ${zahlen.gelesen}; vor der Festschreibung (nicht ausgewertet): ${zahlen.vorFestschreibung}; Probeläufe übersprungen: ${zahlen.uebersprungenTest}; nicht erkannt: ${zahlen.unbekannt}; doppelt: ${zahlen.doppelt}; gleiche ID mit anderem Inhalt: ${zahlen.abweichend}`,
    `Blöcke: ${n('block')} · Nicht angetroffen: ${n('versuch')} · Fragebögen: ${n('fb')} (gültig ${gueltigeBoegen.length}) · Tageskennzahlen: ${sitzungen.tag.size}`,
    `Logbuch-Dateien verwendet: ${zahlen.logbuecher} (Geräte) · verworfen wegen Prüfsumme/Zeilenzahl: ${zahlen.logbuchFehler}`,
    `Ungültig markiert: ${wirksam.filter((e) => !e.gueltig).length} · anderem Code zugeordnet: ${wirksam.filter((e) => e.pseudonymOriginal).length} · Phase geändert: ${wirksam.filter((e) => e.phaseOriginal).length}`,
    `Widerrufene Codes: ${widerrufen.size ? [...widerrufen].sort().join(', ') : 'keine'} · verworfene Sitzungsdateien: ${zahlen.widerrufen}`,
    `Konflikte (Änderungen von mehreren Geräten): ${wirksam.filter((e) => e.konflikt).length}`,
    `Kodierschema der Blöcke: ${[...schemaZaehlung].map(([v, n]) => `${v}: ${n}`).join(', ') || '–'}${schemaZaehlung.size > 1 ? ' – GEMISCHT: Codes mit geänderter Bedeutung beachten (Kodierhandbuch, Versionstabelle; ab 2.0 ist körperliche Untersuchung T11 statt T5)' : ''}`,
    `Bereinigung: ${zusammengelegt} kurze bzw. gleich kodierte Episoden zusammengelegt (Mindestdauer ${regeln.mindestdauerSek} s, ausgenommen ${regeln.mindestdauerAusnahmen.join(', ')}) → beobachtung_bereinigt.csv`,
    `Gehen (T9) mit Nebentätigkeit: ${gehenMitNeben} Episoden – laut Kodierhandbuch 1.0 ist dann die Nebentätigkeit (z. B. Telefon) Haupttätigkeit mit Ort Unterwegs`,
    '',
    `Laut Logbuch exportiert, aber Datei fehlt (${fehlendeDateien.length}):`, ...fehlendeDateien.map((f) => `  - ${f}`),
    `Datei ohne Logbuch-Eintrag (${ohneLogbuch.length}):`, ...ohneLogbuch.map((f) => `  - ${f}`),
    '',
    'Hinweise:',
  ];
  const pruefbericht = [...kopfBericht, ...(bericht.length ? bericht.map((b) => `  - ${b}`) : ['  keine'])].join('\r\n');
  ausgaben.push({ name: 'pruefbericht.txt', inhalt: `${pruefbericht}\r\n` });
  return { ausgaben, bericht: pruefbericht.split('\r\n'), zahlen: { ...zahlen, fehlendeDateien: fehlendeDateien.length, ohneLogbuch: ohneLogbuch.length } };
}

/**
 * Score einer Skala (portiert aus HXNow-Fragebogen/src/scoring.js): gültig sind ganze Zahlen im Bereich min–max;
 * −88, −99, leer und Zusatzcodes fehlen. Score nur, wenn alle Items gültig sind. Mittelwert mit Umpolung
 * (min + max − x); SUS: ungerade Items x − 1, gerade 5 − x, Summe × 2,5 (ohne Umpolung).
 */
export function score(items, werte, sus = false) {
  if (items.length === 0) return '';
  const zahlen = items.map((z) => {
    const t = String(werte[z.id] ?? '').trim();
    if (!/^-?\d+$/.test(t)) return null;
    const w = Number(t);
    if (w < z.min || w > z.max) return null;
    return sus ? w : z.umpolen ? z.min + z.max - w : w;
  });
  if (zahlen.some((x) => x === null)) return '';
  const r = (x) => Math.round(x * 10000) / 10000;
  if (sus) return items.length === 10 ? r(zahlen.reduce((s, w, i) => s + (i % 2 === 0 ? w - 1 : 5 - w), 0) * 2.5) : '';
  return r(zahlen.reduce((a, b) => a + b, 0) / zahlen.length);
}
