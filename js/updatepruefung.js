// Ergebnis von „Nach Updates suchen“ (PLAN_Logbuch_Datensicherheit 2.2). DOM-frei testbar.

/**
 * @param {object} p { erreichbar: Server antwortete, neuerWorker: neue Version installiert sich oder wartet,
 *                     serverVersion: appVersion aus version.json, appVersion: installierte Version }
 * @returns {{ art: 'neu'|'aktuell'|'offline', version: string|null }}
 */
export function bewerteUpdate({ erreichbar, neuerWorker, serverVersion, appVersion }) {
  if (neuerWorker) return { art: 'neu', version: serverVersion ?? null };
  if (!erreichbar) return { art: 'offline', version: null };
  if (serverVersion && serverVersion !== appVersion) return { art: 'neu', version: serverVersion };
  return { art: 'aktuell', version: appVersion };
}

/** Anzeigetext zum Ergebnis. */
export function updateText(ergebnis, appVersion) {
  if (ergebnis.art === 'neu') {
    return `Neue Version ${ergebnis.version ?? ''} verfügbar (installiert: ${appVersion}).`.replace('Version  ', 'Version ');
  }
  if (ergebnis.art === 'aktuell') return `Die App ist aktuell (${appVersion}).`;
  return 'Keine Verbindung. Bitte später erneut versuchen.';
}
