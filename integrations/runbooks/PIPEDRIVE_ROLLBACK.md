# Rollback importu Pipedrive z Twenty

**Kiedy:** tylko **przed** krokiem IMAP / re-sync po loadzie.  
Po IMAP maile zostają — ten rollback ich nie cofa.

**Skrypt:** `integrations/tools/pipedrive_rollback_twenty.py`

## Co usuwa

| Encja | Predykat |
|-------|----------|
| Opportunity | `pipedriveId` niepusty **lub** `srcSystem=PIPEDRIVE_LEGACY` |
| Person | `pipedriveId` niepusty |
| Company | `pipedriveId` niepusty |

Kolejność: Opportunity → Person → Company.

## Czego nie czyści automatycznie

- **Notes / Tasks** utworzone przy imporcie (brak prostego filtra REST po `pipedriveId`) — po `--apply` sprawdź sieroty ręcznie.
- Maile z IMAP.
- Pola Metadata / ADR.

## Użycie

```bash
# Przed loadem — powinno być 0
python3 integrations/tools/pipedrive_rollback_twenty.py --dry-run

# Po nieudanym loadzie / próbce (wymaga wpisania DELETE)
python3 integrations/tools/pipedrive_rollback_twenty.py --apply
```

## Owner-map (przypomnienie)

| PD | Twenty member |
|----|----------------|
| Robert | Robert Mańk `23ac9976-…` |
| Krzysztof | Ewa Malanowska `b9e2b31e-…` |
| Kamil / Patryk / niepowiązane | `owocni@gmail.com` `2d65d0e6-…` (UI „Owocni Owocni”) |
