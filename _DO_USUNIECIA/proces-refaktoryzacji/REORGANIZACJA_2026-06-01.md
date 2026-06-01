# Reorganizacja repo — 2026-06-01

## Co zrobiono

1. Zawartość `mariusz-pliki/` → **root repo** (kanoniczna struktura Mariusza).
2. Poprzednie `owocni-crm/` i `twenty/` → **`_DO_USUNIECIA/legacy-stara-dokumentacja/`** (docelowo usunąć).
3. Stary root `README.md` → `_legacy/README_root_stary_2026-05-29.md`.
4. `integrations/` — bez zmian (kanoniczny kod Sortowni + Robot).

## Docelowa ścieżka

- Pracować tylko w `owocni-crm/` + `integrations/`.
- Po ledgerze pokrycia i akceptacji — **skasować cały `_DO_USUNIECIA/`**.

## Uwaga dla linków w `_legacy/`

Pliki w `_legacy/owocni-crm/` nadal linkują do `../twenty/` — to działa, bo `twenty/` jest teraz `_legacy/twenty/`.
