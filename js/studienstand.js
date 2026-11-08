// Studienübersicht für das Logbuch (PLAN_Logbuch_Datensicherheit 6.1, 9): Phasen aus dem Phasenplan, Zählungen je
// Proband und Phase, Zielerreichung, Fällig-Liste, Verteilung der Blöcke. Nur Umfang und Vollständigkeit der
// Erhebung, keine inhaltlichen Ergebnisse je Person. Grundlage ist der wirksame Stand (Änderungen angewendet),
// Probeläufe zählen nicht. DOM-frei.
import { wirksamerStand } from './aenderungen.js';

export const PHASEN = Object.freeze([
  { id: 'baseline', name: 'Baseline', kurz: 'Baseline', von: 'baselineStart', bis: 'einfuehrungStart', blockPhase: 'PRE', bogen: 'FB1' },
  { id: 'einfuehrung', name: 'Einführung', kurz: 'Einf.', von: 'einfuehrungStart', bis: 'regelbetriebStart', blockPhase: null, bogen: 'KB' },
  { id: 'regelbetrieb', name: 'Regelbetrieb', kurz: 'Regel', von: 'regelbetriebStart', bis: 'ende', blockPhase: 'POST', bogen: 'FB2' },
]);
const TAG_MS = 86_400_000;

const tag = (datum) => (datum ? Date.parse(`${datum}T00:00:00`) : null);

/** Phasendaten eines Probanden: Abweichung, sonst Bereich. */
export function phasendaten(t, phasenplan) {
  const bereich = phasenplan.find((p) => p.bereich === t?.bereich) ?? {};
  const ab = t?.phasenAbweichung ?? {};
  return Object.fromEntries(['baselineStart', 'einfuehrungStart', 'regelbetriebStart', 'abschlussStart', 'ende'].map((f) => [f, ab[f] || bereich[f] || null]));
}

/** Zeitraum einer Phase: [Beginn, Ende) in ms (Ende = letzter Tag + 1) oder null. */
export function zeitraum(daten, phase) {
  const von = tag(daten[phase.von]);
  const bis = phase.bis === 'ende' ? (daten.ende ? tag(daten.ende) + TAG_MS : null) : tag(daten[phase.bis]);
  return von ? { von, bis } : null;
}

/** Phase zu einem Zeitpunkt (für den Phasenvorschlag beim Blockstart) oder null. */
export function phaseAm(ts, daten) {
  for (const p of PHASEN) {
    const z = zeitraum(daten, p);
    if (z && ts >= z.von && (z.bis === null || ts < z.bis)) return p;
  }
  return null;
}

/** Wirksame, nicht im Probelauf erfasste Einträge. */
export function wirksameEintraege(logbuch, aenderungen) {
  return logbuch.filter((l) => !l.testmodus).map((l) => wirksamerStand(l, aenderungen));
}

/**
 * Kennzahlen je Proband (Fragebogenplan 2a: Tabelle; Logbuchplan 9.2: Phasenkarten).
 * @returns {Array<{ t, daten, phasen: Record<id, {...}>, offeneExporte, ampel }>}
 */
export function probandenUebersicht({ teilnehmende, phasenplan, logbuch, aenderungen }, { ziel, jetzt }) {
  const eintraege = wirksameEintraege(logbuch, aenderungen);
  return [...teilnehmende].sort((a, b) => a.pseudonym.localeCompare(b.pseudonym)).map((t) => {
    const eigene = eintraege.filter((e) => e.pseudonym === t.pseudonym);
    const daten = phasendaten(t, phasenplan);
    const phasen = Object.fromEntries(PHASEN.map((p) => {
      const z = zeitraum(daten, p);
      const bloecke = p.blockPhase ? eigene.filter((e) => e.art === 'BLOCK' && e.phase === p.blockPhase && ['beendet', 'abgebrochen'].includes(e.status)) : [];
      const gueltig = bloecke.filter((e) => e.gueltig);
      const boegen = eigene.filter((e) => e.art === p.bogen && e.status === 'abgeschlossen' && e.gueltig).sort((a, b) => a.startTs - b.startTs);
      const versuche = p.blockPhase ? eigene.filter((e) => e.art === 'VERSUCH' && e.phase === p.blockPhase && e.gueltig) : [];
      const zeiten = gueltig.map((e) => e.startTs).sort((a, b) => a - b);
      const restTage = z?.bis ? Math.ceil((z.bis - jetzt) / TAG_MS) : null;
      const laeuft = z && jetzt >= z.von && (z.bis === null || jetzt < z.bis);
      const vorbei = z?.bis !== null && z?.bis !== undefined && jetzt >= z.bis;
      let ampel = 'gruen';
      const fehlen = p.blockPhase ? Math.max(0, ziel - gueltig.length) : 0;
      if (t.status === 'aktiv') {
        if (vorbei && (fehlen > 0 || boegen.length === 0)) ampel = 'rot';
        else if (laeuft && (fehlen > (restTage ?? Infinity) || (boegen.length === 0 && restTage !== null && restTage <= 3))) ampel = fehlen > (restTage ?? Infinity) ? 'rot' : 'gelb';
        else if (laeuft && fehlen > 0 && restTage !== null && fehlen >= restTage - 1) ampel = 'gelb';
      }
      return [p.id, {
        zeitraum: z, laeuft, vorbei, restTage,
        tatsaechlich: zeiten.length ? { von: zeiten[0], bis: zeiten.at(-1), tage: Math.round((zeiten.at(-1) - zeiten[0]) / TAG_MS) + 1 } : null,
        bloecke: gueltig.length, ungueltig: bloecke.length - gueltig.length, ziel: p.blockPhase ? ziel : null,
        minuten: Math.round(gueltig.reduce((s, e) => s + (e.beobachtetSek ?? 0), 0) / 60),
        pausen: gueltig.reduce((s, e) => s + (e.pausenAnzahl ?? 0), 0), pausenSek: gueltig.reduce((s, e) => s + (e.pausenSek ?? 0), 0),
        abbrueche: gueltig.filter((e) => e.status === 'abgebrochen').map((e) => e.abbruchCode),
        versuche: versuche.length, bogen: boegen[0] ?? null, ampel,
      }];
    }));
    const offeneExporte = eigene.filter((e) => e.exportStatus !== 'bestaetigt' && e.status !== 'laufend' && e.status !== 'verworfen').length;
    const ampel = Object.values(phasen).some((x) => x.ampel === 'rot') ? 'rot' : Object.values(phasen).some((x) => x.ampel === 'gelb') ? 'gelb' : 'gruen';
    return { t, daten, phasen, offeneExporte, ampel, eintraege: eigene.sort((a, b) => a.startTs - b.startTs) };
  });
}

/** Fällig-Liste, nach Dringlichkeit sortiert (Logbuchplan 9.1). */
export function faelligListe(uebersicht, { nichtGesichert = 0 } = {}) {
  const liste = [];
  for (const u of uebersicht.filter((x) => x.t.status === 'aktiv')) {
    for (const p of PHASEN) {
      const x = u.phasen[p.id];
      if (!x.zeitraum || !(x.laeuft || x.vorbei)) continue;
      const rest = x.restTage === null ? '' : x.vorbei ? ' – Phase vorbei' : `, noch ${x.restTage} ${x.restTage === 1 ? 'Tag' : 'Tage'}`;
      if (!x.bogen) liste.push({ dringlich: x.vorbei ? 0 : x.restTage ?? 99, text: `${p.bogen} von ${u.t.pseudonym} offen – ${p.name}${x.vorbei ? ' vorbei' : x.restTage !== null ? ` endet in ${x.restTage} ${x.restTage === 1 ? 'Tag' : 'Tagen'}` : ''}`, pseudonym: u.t.pseudonym });
      if (x.ziel && x.bloecke < x.ziel) liste.push({ dringlich: x.vorbei ? 0 : x.restTage ?? 99, text: `${u.t.pseudonym}: ${x.bloecke} von ${x.ziel} Blöcken (${p.name})${rest}`, pseudonym: u.t.pseudonym });
    }
  }
  if (nichtGesichert > 0) liste.push({ dringlich: -1, text: `${nichtGesichert} ${nichtGesichert === 1 ? 'Sitzung' : 'Sitzungen'} nicht gesichert` });
  return liste.sort((a, b) => a.dringlich - b.dringlich);
}

/** Verteilung der gültigen Blöcke je Phase über alle Probanden (Kontext, Dienst, Tageszeit) – nie je Person. */
export function verteilung(logbuch, aenderungen) {
  const bloecke = wirksameEintraege(logbuch, aenderungen).filter((e) => e.art === 'BLOCK' && e.gueltig && ['beendet', 'abgebrochen'].includes(e.status));
  const zaehle = (liste, f) => liste.reduce((m, e) => { const k = f(e) ?? '–'; m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const tageszeit = (e) => { const h = new Date(e.startTs).getHours(); return h < 10 ? 'vor 10 Uhr' : h < 14 ? '10–14 Uhr' : 'nach 14 Uhr'; };
  return Object.fromEntries(['PRE', 'POST'].map((ph) => {
    const l = bloecke.filter((e) => e.phase === ph);
    return [ph, { anzahl: l.length, kontext: zaehle(l, (e) => e.arbeitskontext), dienst: zaehle(l, (e) => e.dienst), tageszeit: zaehle(l, tageszeit) }];
  }));
}

/** Studientag und Phase je Bereich (Kopf der Studienübersicht). */
export function bereichsStand(phasenplan, jetzt) {
  return phasenplan.map((p) => {
    const ph = phaseAm(jetzt, p);
    if (!ph) return { bereich: p.bereich, text: 'außerhalb des Phasenplans' };
    const z = zeitraum(p, ph);
    const tagNr = Math.floor((jetzt - z.von) / TAG_MS) + 1;
    const gesamt = z.bis ? Math.round((z.bis - z.von) / TAG_MS) : null;
    return { bereich: p.bereich, phase: ph.id, text: `${ph.name}, Tag ${tagNr}${gesamt ? ` von ${gesamt}` : ''}` };
  });
}
