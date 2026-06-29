# Owocni Mail App — checklist implementacyjny S0 + S1

> **Środowisko docelowe:** Twenty Cloud sandbox `zany-maroon-panther.twenty.com`  
> **Środowisko dev:** lokalny komp; Node wymagany jako narzędzie budowania (nie serwer)  
> **Kod aplikacji:** `apps/owocni-mail-twenty/` w tym repo  

---

## Przygotowanie środowiska (jednorazowo)

### P1 — upgrade Node do 24+

Twenty SDK wymaga Node 24+. Sprawdź bieżącą wersję:

```bash
node --version   # teraz: 23.6.1 — za niska
```

Przez Homebrew:

```bash
brew install node@24
brew link node@24 --overwrite --force
node --version   # powinno pokazać v24.x
```

Lub przez `nvm`:

```bash
nvm install 24
nvm use 24
```

- [ ] `node --version` zwraca `v24.x`

### P2 — Corepack (Yarn 4)

```bash
corepack enable
corepack prepare yarn@stable --activate
yarn --version   # >= 4.x
```

- [ ] `yarn --version` zwraca `4.x`

### P3 — Create Twenty App

```bash
cd "/Volumes/Samsung_T5/owocni/owocni strona i bitrix/owocni-crm-github/apps"
npx create-twenty-app@latest owocni-mail-twenty
# Na pytania:
#   Name:        Owocni Mail
#   Description: Email templates and AI drafts for Owocni salespeople
#   Local server? → No (już mamy sandbox na Twenty Cloud)
```

- [ ] Katalog `apps/owocni-mail-twenty/` istnieje

### P4 — Podłącz sandbox Twenty Cloud

```bash
cd owocni-mail-twenty
yarn twenty remote:add \
  --url https://zany-maroon-panther.twenty.com \
  --as sandbox
```

CLI poprosi o klucz API. Użyj klucza z `.env.local` (`TWENTY_API_KEY`).

- [ ] `yarn twenty remote:list` pokazuje remote `sandbox`

---

## Faza S0 — Technical spike

**Cel:** dowód, że `useRecordId()` + `CoreApiClient` działają w sandboxie. Żadnych szablonów jeszcze.

### S0.1 — Command item + front component (skeleton)

Pliki do stworzenia (w `apps/owocni-mail-twenty/src/`):

**`command-menu-items/mail-templates.command-menu-item.ts`**

```typescript
import { defineCommandMenuItem } from 'twenty-sdk/define';

export default defineCommandMenuItem({
  universalIdentifier: 'a1000001-0000-0000-0000-000000000001',
  label: 'Szablony maili',
  shortLabel: 'Szablony',
  icon: 'IconMailBolt',
  isPinned: true,
  availabilityType: 'GLOBAL',
  frontComponentUniversalIdentifier: 'a2000001-0000-0000-0000-000000000001',
});
```

**`front-components/template-picker.tsx`**

```tsx
import { defineFrontComponent } from 'twenty-sdk/define';
import { useRecordId } from 'twenty-sdk/front-component';

const TemplatePicker = () => {
  const recordId = useRecordId();

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Szablony maili</h2>
      <p style={{ color: '#666' }}>
        {recordId
          ? `Rekord: ${recordId}`
          : 'Otwórz z poziomu Person lub Opportunity dla kontekstu'}
      </p>
      <p>— wkrótce: lista szablonów —</p>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: 'a2000001-0000-0000-0000-000000000001',
  name: 'template-picker',
  description: 'Picker szablonów maili Owocni',
  component: TemplatePicker,
});
```

- [ ] Pliki zapisane

### S0.2 — Sync do sandboxa

```bash
cd apps/owocni-mail-twenty
yarn twenty dev --once --remote sandbox
```

- [ ] Build bez błędów (exit 0)
- [ ] W Twenty sandbox: Settings → Applications → Twoja app widoczna

### S0.3 — Weryfikacja w UI

1. Otwórz https://zany-maroon-panther.twenty.com.
2. Przejdź na dowolny rekord Person.
3. Sprawdź prawy górny róg — widoczna ikona/przycisk „Szablony".
4. Kliknij — otwiera się side panel z tekstem i `recordId`.

- [ ] Pinned action widoczna
- [ ] Side panel otwiera się
- [ ] `recordId` wyświetla UUID rekordu Person (nie pusty)

### S0.4 — Odczyt danych Person przez CoreApiClient

Rozszerz `TemplatePicker` o fetch:

```tsx
import { defineFrontComponent } from 'twenty-sdk/define';
import { useRecordId } from 'twenty-sdk/front-component';
import { CoreApiClient } from 'twenty-sdk/clients';
import { useState, useEffect } from 'react';

const TemplatePicker = () => {
  const recordId = useRecordId();
  const [person, setPerson] = useState<{ name?: { firstName?: string; lastName?: string }; emails?: { primaryEmail?: string } } | null>(null);

  useEffect(() => {
    if (!recordId) return;
    const client = new CoreApiClient();
    client.query({
      person: {
        __args: { id: recordId },
        id: true,
        name: { firstName: true, lastName: true },
        emails: { primaryEmail: true },
      },
    }).then((res) => {
      setPerson(res.person ?? null);
    }).catch(console.error);
  }, [recordId]);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Szablony maili</h2>
      {person ? (
        <p>Kontakt: {person.name?.firstName} {person.name?.lastName} &lt;{person.emails?.primaryEmail}&gt;</p>
      ) : (
        <p style={{ color: '#999' }}>Ładowanie kontaktu…</p>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: 'a2000001-0000-0000-0000-000000000001',
  name: 'template-picker',
  description: 'Picker szablonów maili Owocni',
  component: TemplatePicker,
});
```

Sync i przetestuj:

```bash
yarn twenty dev --once --remote sandbox
```

- [ ] Panel pokazuje imię i email wybranego Person

**DoD S0:** PASS → przechodzimy do S1. FAIL → diagnoza przed kolejnym krokiem.

---

## Faza S1 — Templates MVP

**Cel:** 19 szablonów w Twenty, picker z podglądem i podstawianiem zmiennych, akcja „Skopiuj i odpowiedz".

### S1.1 — Obiekt `mailTemplate`

**`src/objects/mail-template.object.ts`**

```typescript
import { defineObject, FieldType } from 'twenty-sdk/define';

export default defineObject({
  universalIdentifier: 'b1000001-0000-0000-0000-000000000001',
  nameSingular: 'mailTemplate',
  namePlural: 'mailTemplates',
  labelSingular: 'Szablon maila',
  labelPlural: 'Szablony maili',
  description: 'Szablony maili do użycia przez handlowców',
  icon: 'IconMailFilled',
  fields: [
    {
      universalIdentifier: 'b2000001-0000-0000-0000-000000000001',
      name: 'subjectTemplate',
      type: FieldType.TEXT,
      label: 'Temat',
      description: 'Temat maila, może zawierać {{firstName}}, {{companyName}}',
      icon: 'IconLetterCase',
    },
    {
      universalIdentifier: 'b2000002-0000-0000-0000-000000000002',
      name: 'bodyHtmlTemplate',
      type: FieldType.RICH_TEXT,
      label: 'Treść HTML',
      description: 'Treść maila. Zmienne: {{firstName}}, {{companyName}}, {{offerValue}}',
      icon: 'IconCode',
    },
    {
      universalIdentifier: 'b2000003-0000-0000-0000-000000000003',
      name: 'category',
      type: FieldType.SELECT,
      label: 'Kategoria',
      icon: 'IconTag',
      defaultValue: "'general'",
      options: [
        { value: 'sales',            label: 'Sprzedaż',             position: 0,  color: 'green' },
        { value: 'website',          label: 'Strona',               position: 1,  color: 'blue' },
        { value: 'helpdesk',         label: 'Helpdesk',             position: 2,  color: 'orange' },
        { value: 'logo',             label: 'Logo',                 position: 3,  color: 'purple' },
        { value: 'name',             label: 'Nazwa',                position: 4,  color: 'pink' },
        { value: 'invoice',          label: 'Faktura',              position: 5,  color: 'yellow' },
        { value: 'customer_service', label: 'Obsługa',              position: 6,  color: 'turquoise' },
        { value: 'reminder',         label: 'Przypominajka',        position: 7,  color: 'red' },
        { value: 'general',          label: 'Ogólne',               position: 8,  color: 'gray' },
      ],
    },
    {
      universalIdentifier: 'b2000004-0000-0000-0000-000000000004',
      name: 'priority',
      type: FieldType.SELECT,
      label: 'Priorytet',
      icon: 'IconStar',
      defaultValue: "'nice'",
      options: [
        { value: 'must', label: 'MUST', position: 0, color: 'red' },
        { value: 'nice', label: 'NICE', position: 1, color: 'blue' },
      ],
    },
    {
      universalIdentifier: 'b2000005-0000-0000-0000-000000000005',
      name: 'legacyId',
      type: FieldType.NUMBER,
      label: 'BB Legacy ID',
      description: 'ID z better-bitrix (tylko ślad migracji)',
      icon: 'IconHash',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: 'b2000006-0000-0000-0000-000000000006',
      name: 'isActive',
      type: FieldType.BOOLEAN,
      label: 'Aktywny',
      icon: 'IconCheck',
      defaultValue: 'true',
    },
  ],
});
```

- [ ] Plik zapisany

### S1.2 — Sync obiektu

```bash
cd apps/owocni-mail-twenty
yarn twenty dev --once --remote sandbox
```

- [ ] W sandboxie widać nowy obiekt `Mail templates` w nawigacji

### S1.3 — Seed szablonów

Skrypt wsadowy seed który tworzy 19 rekordów przez REST API:

**`../../integrations/tools/seed_mail_templates_to_twenty.py`**

```python
#!/usr/bin/env python3
"""Seed mailTemplate records from BB export into Twenty workspace."""
from __future__ import annotations
import json, os, time, urllib.request, urllib.error
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPORT  = REPO_ROOT / 'integrations/runbooks/exports/bb_email_templates'
HTML_DIR = EXPORT / 'html_2026-06-16'

BB_CAT_MAP = {
    'sales': 'sales', 'invoice': 'sales', 'logo': 'logo', 'name': 'name',
    'website': 'website', 'helpdesk': 'helpdesk', 'customer_service': 'customer_service',
    'reminder': 'reminder', 'packaging': 'general', 'texts': 'general',
    'project_start': 'general', 'packages': 'general', 'contact': 'sales',
}

def load_env() -> None:
    for line in (REPO_ROOT / '.env.local').read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

def twenty_category(cats: list[str]) -> str:
    for c in cats:
        if c in BB_CAT_MAP: return BB_CAT_MAP[c]
    return 'general'

def slug(title: str) -> str:
    out = []
    for ch in title.lower():
        if ch.isalnum(): out.append(ch)
        elif ch in ' -_': out.append('-')
    s = ''.join(out).strip('-')
    while '--' in s: s = s.replace('--', '-')
    return (s[:60] or 'untitled').strip('-')

def rest(method: str, path: str, payload: dict | None = None) -> dict:
    key  = os.environ['TWENTY_API_KEY']
    base = os.environ.get('TWENTY_REST_URL', 'https://api.twenty.com/rest')
    req  = urllib.request.Request(
        f"{base.rstrip('/')}{path}",
        data    = json.dumps(payload).encode() if payload else None,
        headers = {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json',
                   'User-Agent': 'owocni-seed-templates/1.0'},
        method  = method,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f'{method} {path} → {exc.code}: {exc.read().decode()[:400]}') from exc

def main() -> None:
    load_env()
    rows = json.loads((EXPORT / 'bb_email_templates_migration_2026-06-16.json').read_text())['templates']
    mapping = []
    for row in rows:
        bb_id    = row['id']
        priority = 'must' if row.get('migration_priority') == 'MUST' else 'nice'
        cat      = twenty_category(row.get('category_labels') or [])
        name     = (row.get('title') or 'Bez tytułu').strip()
        subject  = (row.get('subject') or '').strip()
        html_file = HTML_DIR / f"{bb_id}_{slug(name)}.html"
        body_html = html_file.read_text(encoding='utf-8') if html_file.is_file() else ''

        payload = {
            'name':             name,
            'subjectTemplate':  subject,
            'bodyHtmlTemplate': body_html,
            'category':         cat,
            'priority':         priority,
            'legacyId':         bb_id,
            'isActive':         True,
        }

        try:
            resp   = rest('POST', '/mailTemplates', payload)
            new_id = resp['data']['createMailTemplate']['id']
            mapping.append({'bb_id': bb_id, 'twenty_id': new_id, 'name': name})
            print(f'  OK  bb={bb_id} → {new_id}  {name[:50]}')
        except RuntimeError as exc:
            print(f'  ERR bb={bb_id}: {exc}')
        time.sleep(0.2)

    out = EXPORT / 'seed_mapping_twenty_mail_templates.json'
    out.write_text(json.dumps({'mapping': mapping}, indent=2))
    print(f'\nDone: {len(mapping)}/{len(rows)} seeded → {out.name}')

if __name__ == '__main__':
    main()
```

Uruchom po sync obiektu:

```bash
python3 integrations/tools/seed_mail_templates_to_twenty.py
```

- [ ] `seed_mapping_twenty_mail_templates.json` zawiera 19 wpisów
- [ ] W Twenty widać rekordy „Mail templates"

### S1.4 — Picker UI z listą i podglądem

Zastąp szkielet `template-picker.tsx` pełnym komponentem:

**`src/front-components/template-picker.tsx`** (pełna wersja)

```tsx
import { defineFrontComponent } from 'twenty-sdk/define';
import { useRecordId } from 'twenty-sdk/front-component';
import { CoreApiClient } from 'twenty-sdk/clients';
import { useState, useEffect } from 'react';

// ---------- typy ----------
type Template = {
  id: string;
  name: string;
  category: string;
  priority: string;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
};

type Person = {
  name?: { firstName?: string; lastName?: string };
  emails?: { primaryEmail?: string };
  company?: { name?: string };
};

// ---------- pomocnicze ----------
function applyVars(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replaceAll(`{{${k}}}`, v),
    text,
  );
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    sales: 'Sprzedaż', website: 'Strona', helpdesk: 'Helpdesk',
    logo: 'Logo', name: 'Nazwa', invoice: 'Faktura',
    customer_service: 'Obsługa', reminder: 'Przypominajka', general: 'Ogólne',
  };
  return map[cat] ?? cat;
}

const CATEGORY_ORDER = ['sales', 'website', 'helpdesk', 'logo', 'name',
                        'invoice', 'customer_service', 'reminder', 'general'];

// ---------- style ----------
const S = {
  wrap:      { fontFamily: 'sans-serif', fontSize: 14, display: 'flex', height: '100%', flexDirection: 'column' as const },
  header:    { padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const },
  search:    { flex: 1, minWidth: 120, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 },
  select:    { padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 },
  list:      { overflowY: 'auto' as const, flex: 1, minHeight: 0 },
  item:      (active: boolean): React.CSSProperties => ({
               padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f3f3',
               background: active ? '#f0f7ff' : 'transparent',
               display: 'flex', justifyContent: 'space-between', alignItems: 'center',
             }),
  badge:     (priority: string): React.CSSProperties => ({
               fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
               background: priority === 'must' ? '#ffe0e0' : '#e8f0ff',
               color:      priority === 'must' ? '#c00'    : '#36f',
             }),
  preview:   { borderTop: '1px solid #eee', padding: 16, overflowY: 'auto' as const, maxHeight: '45%' },
  subjRow:   { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  subjLabel: { fontWeight: 600, fontSize: 12, color: '#666', whiteSpace: 'nowrap' as const },
  subjVal:   { flex: 1, padding: '5px 8px', border: '1px solid #ddd', borderRadius: 5, fontSize: 13 },
  actions:   { display: 'flex', gap: 8 },
  btnPri:    { flex: 1, padding: '8px 12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  btnSec:    { padding: '8px 12px', background: '#f3f4f6', color: '#333', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  notice:    { fontSize: 11, color: '#888', marginTop: 4 },
};

// ---------- główny komponent ----------
const TemplatePicker = () => {
  const recordId = useRecordId();

  const [templates, setTemplates]   = useState<Template[]>([]);
  const [person,    setPerson]      = useState<Person | null>(null);
  const [selected,  setSelected]    = useState<Template | null>(null);
  const [query,     setQuery]       = useState('');
  const [catFilter, setCatFilter]   = useState('');
  const [copied,    setCopied]      = useState(false);
  const [loading,   setLoading]     = useState(true);

  // ładuj szablony i dane osoby
  useEffect(() => {
    const client = new CoreApiClient();

    const tplQuery = client.query({
      mailTemplates: {
        filter: { isActive: { eq: true } },
        orderBy: [{ priority: 'DescNullsLast' }, { name: 'AscNullsLast' }],
        edges: {
          node: {
            id: true, name: true, category: true, priority: true,
            subjectTemplate: true, bodyHtmlTemplate: true,
          },
        },
      },
    }).then((res) => {
      setTemplates((res.mailTemplates?.edges ?? []).map((e: { node: Template }) => e.node));
    });

    const personQuery = recordId
      ? client.query({
          person: {
            __args: { id: recordId },
            name:   { firstName: true, lastName: true },
            emails: { primaryEmail: true },
            company: { name: true },
          },
        }).then((res) => setPerson(res.person ?? null))
      : Promise.resolve();

    Promise.all([tplQuery, personQuery]).finally(() => setLoading(false));
  }, [recordId]);

  // zmienne z kontekstu
  const vars: Record<string, string> = {
    firstName:   person?.name?.firstName   ?? '',
    lastName:    person?.name?.lastName    ?? '',
    companyName: person?.company?.name     ?? '',
    email:       person?.emails?.primaryEmail ?? '',
  };

  // filtrowanie
  const visible = templates
    .filter((t) => !catFilter || t.category === catFilter)
    .filter((t) => !query || t.name.toLowerCase().includes(query.toLowerCase()));

  const cats = CATEGORY_ORDER.filter((c) => templates.some((t) => t.category === c));

  // akcja: kopiuj subject + body
  const handleCopy = async () => {
    if (!selected) return;
    const subject = applyVars(selected.subjectTemplate, vars);
    const body    = applyVars(selected.bodyHtmlTemplate, vars);
    await navigator.clipboard.writeText(`TEMAT: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (loading) return <div style={{ padding: 20 }}>Ładowanie szablonów…</div>;

  return (
    <div style={S.wrap}>
      {/* nagłówek + filtry */}
      <div style={S.header}>
        <strong style={{ marginRight: 4 }}>Szablony maili</strong>
        <input
          style={S.search}
          placeholder="Szukaj…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select style={S.select} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value=''>Wszystkie</option>
          {cats.map((c) => (
            <option key={c} value={c}>{categoryLabel(c)}</option>
          ))}
        </select>
      </div>

      {/* lista */}
      <div style={S.list}>
        {visible.length === 0 && (
          <div style={{ padding: 20, color: '#999' }}>Brak wyników.</div>
        )}
        {visible.map((t) => (
          <div
            key={t.id}
            style={S.item(selected?.id === t.id)}
            onClick={() => setSelected(t)}
          >
            <span>{t.name}</span>
            <span style={S.badge(t.priority)}>{t.priority === 'must' ? 'MUST' : 'NICE'}</span>
          </div>
        ))}
      </div>

      {/* podgląd */}
      {selected && (
        <div style={S.preview}>
          <div style={S.subjRow}>
            <span style={S.subjLabel}>Temat:</span>
            <span style={S.subjVal}>{applyVars(selected.subjectTemplate, vars) || '—'}</span>
          </div>

          <div style={S.actions}>
            <button style={S.btnPri} onClick={handleCopy}>
              {copied ? '✓ Skopiowano!' : 'Skopiuj temat + treść'}
            </button>
            <button
              style={S.btnSec}
              onClick={() => {
                const win = window.open('', '_blank');
                if (win) {
                  win.document.write(applyVars(selected.bodyHtmlTemplate, vars));
                  win.document.close();
                }
              }}
            >
              Podgląd
            </button>
          </div>

          <p style={S.notice}>
            {recordId
              ? `Zmienne wypełnione z kontekstu: ${vars.firstName} ${vars.lastName}`
              : 'Otwórz z poziomu Person/Opp, by automatycznie wypełnić zmienne.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: 'a2000001-0000-0000-0000-000000000001',
  name: 'template-picker',
  description: 'Picker szablonów maili Owocni',
  component: TemplatePicker,
});
```

- [ ] Plik zapisany

### S1.5 — Sync i test

```bash
cd apps/owocni-mail-twenty
yarn twenty dev --once --remote sandbox
```

- [ ] Build bez błędów

Test ręczny w sandboxie Twenty:

| # | Akcja | Oczekiwany wynik |
|---|-------|-----------------|
| 1 | Person → „Szablony" | Side panel otwiera się |
| 2 | Widok listy | 19 szablonów widocznych |
| 3 | Filtr „Sprzedaż" | 3–5 szablonów |
| 4 | Szukaj „Logo" | ≥1 wynik |
| 5 | Wybór szablonu MUST | Badge czerwony, podgląd widoczny |
| 6 | „Skopiuj temat + treść" | Przycisk zmienia się na „✓ Skopiowano!" |
| 7 | Wklej do compose Twenty | Temat i treść wstawione |
| 8 | Zmienne | `{{firstName}}` zamienione na imię z Person |

- [ ] Wszystkie punkty PASS

---

## Faza S2 — szybkie akcje i role (dorobienie po S1)

Poniższe zadania są osobnymi małymi PR-ami, **nie blokują S1 PASS**:

### S2.1 — Filtr „ostatnio użyte"
- Persystuj `lastUsedTemplateIds` w `localStorage`.
- Pokaż sekcję „Ostatnio używane" na górze listy (max 3).

### S2.2 — Uprawnienia (`twenty-sdk` roles)
- Handlowcy: tylko odczyt + użycie.
- Admin (Dawid): CRUD szablonów z poziomu normalnej listy `Mail templates` w Twenty.

### S2.3 — Automatyczna podmiana zmiennych z Opportunity
- Jeśli `recordId` wskazuje na Opportunity (nie Person), pobierz też `Opportunity.name`, `Opportunity.amount`.
- Dodaj zmienną `{{oppName}}`, `{{offerValue}}`.

---

## Faza S3 — AI suggestions (plan)

Ten etap dochodzi po zakończeniu S1–S2. Zmiany w aplikacji są minimalne — AI działa jako osobna warstwa wywoływana z tego samego front componenta.

### Model interakcji

```
picker wybiera szablon → przycisk „Dopasuj AI"
→ Logic function (server-side w Twenty App)
   → POST Stape/n8n endpoint
      input: { templateId, personId, oppId, threadMessages[] }
      output: { subject, bodyHtml, confidence, flags }
→ wynik pojawia się w panelu jako edytowalny draft
→ „Wyślij" przez SendEmail mutation (PR #19363 dostępny w Twenty)
```

### Pliki do dodania (S3)

- `src/logic-functions/suggest-reply.logic-function.ts` — wywołanie endpointa AI.
- Rozszerzenie `template-picker.tsx` o przycisk „Dopasuj AI" i podgląd draftu.
- `aiSuggestionLog` object (opcjonalnie) — telemetria akceptacji/odrzutów.

### Kryteria PASS S3

- [ ] AI generuje szkic na podstawie szablonu + Person/Opp w < 10 s.
- [ ] Draft pojawia się w panelu jako edytowalny tekst.
- [ ] Brak halucynacji cen/obietnic — prompt guardrail aktywny.
- [ ] Acceptance rate po tygodniu UATu ≥ 60%.

---

## Mapowanie na bramy (podsumowanie)

| Gate | Faza | PASS gdy |
|------|------|----------|
| PAR-5.0 | ☑ | Strategia `E12_3_EMAIL_TEMPLATE_STRATEGY.md` |
| PAR-5.1 | S1.3 | 19 `mailTemplate` w Twenty |
| PAR-5.2 | S1.5 | Handlowiec wysyła bez BB |
| PAR-5.3 | S1.5 + S2 | Evidence + szkolenie |
| E12.3 PASS | S1 + S2 | PAR-5 + szkolenie |
| AI suggestions | S3 | Acceptance rate ≥ 60% |

---

## Pliki podsumowanie (cały S0+S1)

```
owocni-crm-github/
  apps/
    owocni-mail-twenty/               ← scaffold (npx create-twenty-app)
      src/
        application-config.ts         ← auto z scaffoldu
        objects/
          mail-template.object.ts     ← S1.1 (tu)
        command-menu-items/
          mail-templates.command-menu-item.ts   ← S0.1 (tu)
        front-components/
          template-picker.tsx         ← S0.1 skeleton → S1.4 full
  integrations/
    tools/
      seed_mail_templates_to_twenty.py    ← S1.3 (tu)
      export_bb_email_templates.py        ← już istnieje
```
