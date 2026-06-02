---
doc_id: INTEGRATIONS_FIXTURES
title: "integrations/fixtures — dane testowe sandbox"
layer: test_data
status: active
owner: "Dawid"
last_verified: 2026-06-02
---

# integrations/fixtures

Zestaw minimalnych payloadów do szybkiego smoke testu Robota (Faza 1).

## Jak używać

1. Weź JSON z `task-queue-*.json`.
2. W Stape Store zapisz jako dokument w `task_queue` (dowolny klucz).
3. Ustaw:
   - `status: "pending"`
   - `created_at`: aktualny epoch ms
4. Uruchom Robota i zweryfikuj logi wg `runbooks/SANDBOX_PHASE1_ROBOT_EVENTS.md`.

## Bezpieczeństwo

- Te pliki nie zawierają realnego PII.
- Surowe payloady webhooków z sandboxa zapisuj w `webhook-captures/`.
- PII/secrets nie commituj — patrz `.gitignore` w tym katalogu.
