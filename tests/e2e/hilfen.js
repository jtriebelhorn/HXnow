// Gemeinsame Schritte für die E2E-Tests.
import { expect } from '@playwright/test';

export const START = new Date('2026-12-03T09:15:00+01:00');

/** Uhr installieren und App öffnen. */
export async function oeffne(page, zeit = START) {
  // Uhr anhalten: Zeit vergeht nur über page.clock.fastForward (deterministische Sekunden)
  await page.clock.install({ time: new Date(zeit.getTime() - 1000) });
  await page.clock.pauseAt(zeit);
  await page.goto('./');
  await expect(page.locator('[data-test=neuer-block]')).toBeVisible();
}

/** Neuen Block anlegen und starten. */
const KONTEXT_GRUPPE = { K1: 'Station', K2: 'Station', K3: 'Station', K4: 'Funktionsbereich', K5: 'Ambulanz', K6: 'Notaufnahme', K7: 'Notaufnahme' };

export async function starteBlock(page, { pseudonym = 'P017', phase = 'POST', beobachter = 'B1', bereich = 'NEPH', dienst = 'F', dauer = 900, kontext = 'K1' } = {}) {
  await page.click('[data-test=neuer-block]');
  await page.click(`[data-test=dauer-${dauer}]`);
  await waehleCode(page, pseudonym);
  if (await page.locator(`[data-test=beobachter-${beobachter}]`).count()) await page.click(`[data-test=beobachter-${beobachter}]`);
  await page.click(`[data-test=bereich-${bereich}]`);
  await page.click(`[data-test=dienst-${dienst}]`);
  await page.click(`[data-test=phase-${phase}]`);
  await page.click(`[data-test=kontextgruppe-${KONTEXT_GRUPPE[kontext]}]`);
  if (await page.locator(`[data-test=kontext-${kontext}]`).count()) await page.click(`[data-test=kontext-${kontext}]`);
  await page.click('[data-test=block-starten]');
  await expect(page.locator('[data-test=countdown]')).toHaveText(`${dauer / 60}:00`);
}

/** Tippt eine Taste (t-T1, o-O4, n-N1, h-H1 …) und wartet, bis sie als aktiv angezeigt wird (= gespeichert). */
export async function tippe(page, test) {
  await page.click(`[data-test=${test}]`);
  await expect(page.locator(`[data-test=${test}]`)).toHaveAttribute('aria-pressed', 'true');
}

/** Liest Block und Episoden direkt aus IndexedDB. */
export function leseDb(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('hxnow-beobachtung');
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const stores = [...r.result.objectStoreNames].filter((s) => s !== 'meta');
      const tx = r.result.transaction(stores, 'readonly');
      const erg = {};
      for (const s of stores) {
        tx.objectStore(s).getAll().onsuccess = (e) => { erg[s] = e.target.result; };
      }
      tx.oncomplete = () => { r.result.close(); resolve(erg); };
    };
  }));
}

/**
 * Ersetzt navigator.share/canShare. verhalten: 'erfolg' | 'abbruch' | 'fehlt'.
 * Jeder Aufruf wird in window.__geteilt protokolliert, inkl. ob die Nutzergeste noch aktiv war.
 */
export async function mockeTeilen(page, verhalten = 'erfolg') {
  await page.addInitScript((v) => {
    window.__geteilt = [];
    if (v === 'fehlt') {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      return;
    }
    Object.defineProperty(navigator, 'canShare', { value: (d) => Array.isArray(d?.files), configurable: true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (d) => {
        window.__geteilt.push({
          datei: d.files[0],
          name: d.files[0].name,
          titel: d.title,
          aktiv: navigator.userActivation ? navigator.userActivation.isActive : null,
        });
        return v === 'abbruch' ? Promise.reject(new DOMException('abgebrochen', 'AbortError')) : Promise.resolve();
      },
    });
  }, verhalten);
}

/** Protokollierte Teilen-Aufrufe inkl. Dateiinhalt (Bytes als Text, BOM bleibt erhalten). */
export function geteilt(page) {
  return page.evaluate(async () => Promise.all(window.__geteilt.map(async (g) => ({
    name: g.name, titel: g.titel, aktiv: g.aktiv,
    text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(await g.datei.arrayBuffer()),
  }))));
}

/** Kurzer Block: Ort, Tätigkeit, ein Wechsel, dann reguläres Ende → Abschlussseite. */
export async function kurzerBlock(page, optionen = {}) {
  await starteBlock(page, optionen);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.clock.fastForward('02:00');
  await tippe(page, 't-T5');
  await page.clock.fastForward('15:00');
  await expect(page.locator('[data-test=abschluss-status]')).toHaveText('Regulär beendet');
  // Post-Phase: Pflichtfrage „Gerät dabei?“ vor dem Export
  if (await page.locator('[data-test=frage-geraet]').count()) await page.click('[data-test=geraet-N]');
}

/** Pause starten, optional Grund und Notiz setzen, dann mit einem Tipp fortsetzen. */
export async function pauseUndWeiter(page, { grund = null, notiz = null } = {}) {
  await page.click('[data-test=pause]');
  await expect(page.locator('[data-test=pause-status]')).toBeVisible();
  if (grund) await page.click(`[data-test=pausegrund-${grund}]`);
  if (notiz !== null) {
    await page.click('[data-test=kommentar]');
    await page.fill('[data-test=pause-freitext]', notiz);
    await page.click('[data-test=pause-notiz-speichern]');
    await expect(page.locator('[data-test=pause-notiz]')).toContainText(notiz);
  }
  await page.click('[data-test=pause]');
  await expect(page.locator('[data-test=pause-status]')).toHaveCount(0);
}

/** Studien-Code eintippen; ist er noch nicht in der Teilnehmerliste, „Neuen Code anlegen“ tippen. */
export async function waehleCode(page, code) {
  await page.fill('[data-test=pseudonym]', code);
  const anlegen = page.locator('[data-test=code-anlegen]');
  if (await anlegen.count()) {
    await anlegen.click();
    await expect(page.locator('[data-test=code-gewaehlt]')).toBeVisible();
  }
}
