# integrations/shared/

Wspólne stałe i helpery **dla dokumentacji LLM** oraz runtime **Node (Robot)**.

| Plik | Runtime | Rola |
|------|---------|------|
| `ssotPaths.js` | Node (+ kopia const w tagach Stape) | Nazwy adapterów, kolekcje Stape Store, kanon eventów |
| `envGuard.js` | Node (`GoogleCloudRobot.js`) | `sandbox` → bez prod Ads/Meta/GA4 MP |

**Stape (sGTM):** tagi nie używają `require()` — skopiuj logikę z `../ENV_GUARD.sGTM.js` i stałe z `ssotPaths.js` (lub `TWENTY_PATHS.md`).
