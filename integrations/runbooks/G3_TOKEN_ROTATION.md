---
doc_id: G3_TOKEN_ROTATION
title: "G3 — rotacja tokenów Twenty (instrukcja dla Dawida)"
layer: runbook
status: git_literals_removed
owner: "Dawid"
last_verified: 2026-09-03
related:
  - PLAN_NAPRAWCZY_GATES.md
---

# G3 — stan 3 IX

Dawid: rotacja w panelu była wcześniej. **Zrobione w kodzie:** literały JWT usunięte z gita.

- `integrations/tools/verify_identity_e2e.py` — `TWENTY_API_KEY` z env / `.env.local` / worker `.env.deploy`
- `apps/owocni-mail-twenty/vitest.config.ts` — bez hardcoded JWT (integration test wymaga env)

Żywy klucz workera zostaje w gitignorowanym `.env.deploy`. Nie commituj go.

Poniżej zostaje procedura, gdyby trzeba było wydać **nowy** klucz (stary z historii gita nadal jest w logu `git log -p`).

---

Dwa różne sekrety. **Nie rotuj, dopóki nie zaktualizujesz konsumentów.** Odwrotnie = pada worker / webhook / testy.

Nie wklejaj tu wartości kluczy. Identyfikujesz je po **pliku** i po **nazwie w Twenty** (Settings → APIs & Webhooks).

---

## Token A — klucz API workspace Owocni (produkcja)

Leży w git jako sklejany literał w `integrations/tools/verify_identity_e2e.py` (pięć stringów). Ten sam klucz jest też poza gitem, na żywych serwisach.

**Konsumenci (stan 3 IX, ten checkout):**

| Gdzie | W git? | Co zepsuje, jak unieważnisz za wcześnie |
|---|---|---|
| `integrations/tools/verify_identity_e2e.py` | tak | skrypt e2e identity |
| `.env.local` (root repo) | nie | lokalne skrypty `deploy_*.py`, Twenty CLI narzędzia |
| `integrations/cloud-functions/twenty-crm-worker/.env.deploy` | nie | **żywy worker GCP** (leady, kierunek, sweep) |
| `integrations/cloud-functions/twenty-inbound-webhook/.env.deploy` | nie | **żywy webhook** |

Osobny klucz (inny `jti`) jest w `system-health-check/.env.deploy` (`TWENTY_API_KEY_PROD` / `_SANDBOX`) — **nie mieszaj** z Tokenem A. Rotujesz go osobno, albo zostawiasz na drugą turę.

Historia gita: Token A był w repo **przed** commitem poczty. Samo wycięcie z HEAD nie wystarczy — stary klucz w historii nadal działa, dopóki go nie unieważnisz w Twenty.

### Kroki Token A

1. **Twenty → Settings → APIs & Webhooks → API keys.**  
   Znajdź klucz, który odpowiada Temu z `verify_identity_e2e.py` (data wydania ok. 8 VI 2026, typ API_KEY). Zanotuj nazwę. **Nie kasuj jeszcze.**

2. **Utwórz nowy klucz** o nazwie np. `owocni-worker-2026-09`. Skopiuj wartość **tylko** do menedżera haseł (Bitwarden).

3. **Podmień u konsumentów, zanim unieważnisz stary:**
   - `.env.local` → `TWENTY_API_KEY=`
   - `twenty-crm-worker/.env.deploy` → `TWENTY_API_KEY=`
   - `twenty-inbound-webhook/.env.deploy` → `TWENTY_API_KEY=`
   - `verify_identity_e2e.py` — **usuń literał**. Czytaj `os.environ["TWENTY_API_KEY"]` (jak inne skrypty). Bez fallbacku w kodzie.

4. **Redeploy** workera i webhooka (`deploy.sh` w obu folderach). Bez tego GCP dalej woła starym kluczem.

5. **Smoke (5 minut):** nowy lead z formularza = karta; jeden mail IN dostaje kierunek; `verify_identity_e2e.py` z `export TWENTY_API_KEY=…` z Bitwardena.

6. **Dopiero wtedy** w Twenty: revoke / delete **starego** klucza.

7. **Skan** (po usunięciu literału, w katalogu repo):

```bash
# Nie wypisuj trafień na Slacka / w mailu — tylko czyścić.
rg -n 'eyJhbGciOiJFUzI1Ni' --glob '!**/node_modules/**' --glob '!**/.git/**'
rg -n 'TWENTY_KEY\s*=' integrations/tools/verify_identity_e2e.py
```

Czysto = brak sklejanych JWT w tracked files. `.env.local` / `.env.deploy` mogą mieć nowy klucz — te pliki są w `.gitignore`.

8. **Historia:** `git log -p -- integrations/tools/verify_identity_e2e.py` nadal pokaże stary token. To OK **po** revoke w Twenty. Nie przepisujemy historii gita, chyba że Mariusz każe (force-push).

---

## Token B — fallback w `apps/owocni-mail-twenty/vitest.config.ts`

To **nie** jest klucz Owocni. Workspace id `20202020-…`, algorytm HS256 — typowy klucz z szablonu Twenty (lokalny docker / demo). CI Owocni Mail i tak dostaje swoje `TWENTY_API_KEY` z akcji `spawn-twenty-app-dev-test`.

**Nie „rotujesz” go w panelu Owocni.** Wycinasz hardcoded JWT.

### Kroki Token B

1. W `vitest.config.ts` zostaw tylko:

```ts
const TWENTY_API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:2020';
const TWENTY_API_KEY = process.env.TWENTY_API_KEY;
if (!TWENTY_API_KEY) {
  throw new Error('TWENTY_API_KEY required for integration tests');
}
```

2. `yarn test:unit` (używa `vitest.unit.config.ts`) **musi** przejść bez tego klucza — unit config już jest czysty.

3. `yarn test` (integration) lokalnie: tylko z własnym env albo w ogóle nie odpalaj. CI zostaje jak jest.

---

## PASS

- [ ] Token A unieważniony w Twenty
- [ ] Nowy klucz tylko w Bitwarden + gitignorowane env + GCP po redeploy
- [ ] `verify_identity_e2e.py` bez literału
- [ ] `vitest.config.ts` bez JWT
- [ ] `rg eyJhbGciOiJFUzI1Ni` na tracked files = 0
- [ ] Formularz + kierunek maila żywe po redeploy

---

## Czego nie robić

- Nie commituj nowego JWT.
- Nie rotuj Tokenu A w piątek wieczór bez smoke leadów.
- Nie ruszaj `system-health-check` w tej samej turze, jeśli nie musisz — inny klucz.
- Nie `git filter-repo` bez osobnej decyzji.
