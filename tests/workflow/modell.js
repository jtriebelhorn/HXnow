// Verhaltensmodell der Beobachtung: realitätsnahe Abfolgen und Dauern je Arbeitskontext.
// Grundlage: Kategorien und Grenzfälle aus dem Kodierhandbuch v0.2. Zufall mit Seed → jeder Lauf reproduzierbar.

/** Deterministischer Zufallsgenerator (mulberry32). */
export function zufall(seed) {
  let a = seed >>> 0;
  const zahl = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    zahl,
    ja: (p) => zahl() < p,
    ganz: (min, max) => min + Math.floor(zahl() * (max - min + 1)),
    wahl: (liste) => liste[Math.floor(zahl() * liste.length)],
    /** gewichtete Auswahl aus { wert: gewicht } */
    gewichtet: (obj) => {
      const e = Object.entries(obj).filter(([, g]) => g > 0);
      let x = zahl() * e.reduce((s, [, g]) => s + g, 0);
      for (const [w, g] of e) { x -= g; if (x <= 0) return w; }
      return e.at(-1)[0];
    },
    /** Dauer in ms, logarithmisch gleichverteilt zwischen min und max Sekunden, mit ms-Anteil */
    dauerMs: (minS, maxS) => Math.round(Math.exp(Math.log(minS) + zahl() * (Math.log(maxS) - Math.log(minS))) * 1000) + Math.floor(zahl() * 1000),
  };
  return r;
}

// Typische Dauer je Tätigkeit (Sekunden, min–max)
export const DAUER = {
  T1: [20, 240], T2: [15, 120], T3: [4, 90], T4: [4, 40], T5: [20, 180],
  T6: [8, 120], T7: [15, 150], T8: [10, 90], T9: [4, 40], T10: [8, 60],
};

// Häufigkeit der Tätigkeiten je Arbeitskontext
const T_GEWICHTE = {
  K1: { T5: 5, T2: 4, T6: 2, T9: 3, T3: 3, T7: 1, T8: 1, T1: 1, T4: 0.5, T10: 0.5 }, // Visite
  K3: { T1: 5, T7: 2, T6: 2, T8: 2, T3: 3, T9: 1, T10: 1, T5: 1, T4: 0.5, T2: 0.5 }, // Stationsarbeit
  K4: { T5: 4, T1: 2, T6: 2, T9: 2, T3: 2, T7: 1, T8: 1, T10: 0.5, T4: 0.5 }, // Funktionsbereich
  K6: { T5: 4, T9: 3, T7: 2, T6: 2, T1: 2, T3: 2, T2: 1, T4: 0.5, T10: 0.5 }, // Notaufnahme
};

// Plausible Orte je Kontext und Tätigkeit
const ORTE = {
  K1: { T1: ['O1'], T2: ['O3', 'O2'], T3: ['O3', 'O2', 'O1'], T4: ['O2', 'O1'], T5: ['O3'], T6: ['O2', 'O1', 'O3'], T7: ['O2', 'O1'], T8: ['O1', 'O3'], T9: ['O2', 'O8'], T10: ['O1', 'O8'] },
  K3: { T1: ['O1'], T2: ['O2', 'O3'], T3: ['O1', 'O2'], T4: ['O1', 'O8'], T5: ['O3'], T6: ['O1', 'O2'], T7: ['O1', 'O2'], T8: ['O1'], T9: ['O2', 'O7', 'O8'], T10: ['O1', 'O8'] },
  K4: { T1: ['O5', 'O1'], T2: ['O5'], T3: ['O5', 'O3', 'O2'], T4: ['O5'], T5: ['O5', 'O3'], T6: ['O5', 'O2'], T7: ['O5', 'O2'], T8: ['O5'], T9: ['O2'], T10: ['O5'] },
  K6: { T1: ['O1', 'O4'], T2: ['O4'], T3: ['O4', 'O2', 'O8'], T4: ['O2'], T5: ['O4'], T6: ['O4', 'O2', 'O1'], T7: ['O2', 'O1', 'O4'], T8: ['O1', 'O4'], T9: ['O2', 'O7', 'O8'], T10: ['O8', 'O1'] },
};

/** Nächste Tätigkeit (≠ aktuelle) für Kontext und Phase. */
export function naechsteTaetigkeit(r, kontext, phase, aktuell) {
  const g = { ...(T_GEWICHTE[kontext] ?? T_GEWICHTE.K3) };
  if (phase !== 'POST') delete g.T3;
  delete g[aktuell];
  return r.gewichtet(g);
}

/** Plausibler Ort für Tätigkeit im Kontext (bevorzugt den aktuellen Ort, falls passend). */
export function ortFuer(r, kontext, t, aktuellerOrt) {
  const liste = (ORTE[kontext] ?? ORTE.K3)[t];
  if (aktuellerOrt && liste.includes(aktuellerOrt) && r.ja(0.6)) return aktuellerOrt;
  return r.wahl(liste);
}

/** Nutzungsart: bei T3 meist Einsicht oder Sprache, bei PC/Wagen meist Texteingabe. null = nicht kodiert. */
export function nutzungsart(r, t, ort) {
  if (t === 'T3') return r.gewichtet({ N1: 5, N2: 2, N3: 2, N4: ort === 'O3' || ort === 'O4' ? 1.5 : 0.3, N9: 0.5 });
  if (t === 'T1' || t === 'T2') return r.ja(0.3) ? null : r.gewichtet({ N2: 4, N1: 3, N3: 0.5, N9: 0.5 });
  return null;
}

/** Haltung bei T3 passend zum Ort. */
export function haltung(r, ort) {
  if (ort === 'O2') return r.gewichtet({ H1: 4, H2: 2, H4: 1 });
  if (ort === 'O8') return r.gewichtet({ H4: 3, H2: 1, H1: 1 });
  if (ort === 'O1') return r.gewichtet({ H3: 3, H2: 2 });
  return r.gewichtet({ H2: 3, H3: 1, H4: 1 });
}

// Kommentare mit Sonderzeichen (Umlaute, Semikolon, Anführungszeichen, Zeilenumbruch) – ohne Namen
export const KOMMENTARE = [
  'Übergabe am Stützpunkt; Akte „unvollständig“',
  'Gerät kurz weggelegt, "Akku leer"?',
  'Rückfrage Pflege\nzweite Zeile mit Ä, Ö, Ü und ß',
  'Unklar, ob T6 oder T5 – T5 gewählt',
  'Lärm; Station sehr voll',
];
