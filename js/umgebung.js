// Wie wurde die App geöffnet? (PLAN_Logbuch_Datensicherheit 3, ENTSCHEIDUNGEN Nr. 35) DOM-frei testbar.
//   installiert  – vom Home-Bildschirm bzw. als installierte App
//   ios-tab      – Safari-Tab auf iPhone/iPad: eigener, leerer Speicher → Erfassen gesperrt
//   browser-tab  – Desktop-Browser: erlaubt (Test, Reserve), mit Hinweisband
// Safari auf iPhone und iPad kennt `navigator.standalone` (true als Home-Bildschirm-App, sonst false); andere
// Browser haben die Eigenschaft nicht.

export function umgebung({ standalone, displayStandalone }) {
  if (standalone === true || displayStandalone) return 'installiert';
  if (standalone === false) return 'ios-tab';
  return 'browser-tab';
}

// Nur für automatische Tests: Der Testserver setzt das auf true (Cookie „hx-installiert“), damit Playwright im
// iPhone-Profil wie die installierte App läuft. In der ausgelieferten Datei immer false.
const TEST_INSTALLIERT = false;

export function ermittleUmgebung(win = globalThis) {
  if (TEST_INSTALLIERT) return 'installiert';
  return umgebung({
    standalone: win.navigator?.standalone,
    displayStandalone: Boolean(win.matchMedia?.('(display-mode: standalone)')?.matches),
  });
}
