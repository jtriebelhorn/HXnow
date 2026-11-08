# Quelltexte der Fragebögen

Vorlagen, gegen die `tests/unit/definition.test.js` die Definition in `js/frageboegen.js` prüft: die Spezifikationen
(jedes Item) und die Papierfassungen (Wortlaut).

| Datei | Quelle | Gewonnen mit |
| --- | --- | --- |
| `FB1_v0.3.txt` | `Fragebogen1_Baseline_v0.3.docx` (08.11.2026) | `textutil -convert txt` |
| `FB2_v0.3.txt` | `Fragebogen2_Post_v0.3.pdf` (08.11.2026) | Textextraktion mit PDFKit |
| `FB1_Baseline_v0.3.md`, `KB_Gewoehnung_v0.3.md`, `FB2_Post_v0.3.md` | Spezifikationen vom 08.11.2026 (maßgeblich für Codes, Filter und App-Texte) | unverändert kopiert |

Nachbearbeitung `FB2_v0.3.txt`: Die PDF-Extraktion hat zwei Zeilenreste verschoben. Sie wurden in die Lesereihenfolge
des PDFs zurückgesetzt: „A)“ ans Ende von W1 („… weiter mit Abschnitt A)“) und „B. Visitenwagen)“ ans Ende von W7c
(„anders vor Ort gelöst (z. B. Visitenwagen)“). Sonst unverändert.

Bei einer neuen Fragebogenversion den Text neu gewinnen, hier ablegen und die Tabelle ergänzen.
