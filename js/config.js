// Konfiguration der Auslieferung (PLAN_Logbuch_Datensicherheit, Abschnitt 2.5).
// Alle Repositories unter jtriebelhorn.github.io teilen sich denselben Speicher (gleiche Herkunft). Eine Testversion
// muss deshalb einen eigenen Datenbanknamen haben, sonst sähe sie die Studiendaten. Für eine Testversion TESTVERSION
// auf true setzen: Sie zeigt dauerhaft das gelbe Band „TESTVERSION – keine Studiendaten“.
export const TESTVERSION = false;

export const DB_NAME = TESTVERSION ? 'hxnow-beobachtung-test' : 'hxnow-beobachtung';

// Feste Adresse der Studienversion (ENTSCHEIDUNGEN Nr. 33). Nie ändern: iOS bindet den Speicher an die Adresse.
export const STUDIEN_ADRESSE = 'https://jtriebelhorn.github.io/HXnow/';
