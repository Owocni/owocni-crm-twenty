import { useEffect, useMemo, useRef, useState } from 'react';
import { RestApiClient, RestApiClientError } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { closeSidePanel, enqueueSnackbar, useRecordId } from 'twenty-sdk/front-component';

import {
  MailBodyEditor,
  type MailBodyEditorHandle,
} from 'src/front-components/mail-body-editor';
import { isDefined } from 'src/utils/isDefined';

export const TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '2d49aa61-2a83-485b-856d-c3d26885cae5';

type MailTemplateSummary = {
  id: string;
  name: string;
  category: string;
  priority: string;
  subjectTemplate: string;
};

type PersonRecord = {
  firstName: string;
  lastName: string;
  clientName: string;
  email: string;
  companyName: string;
};

type PickerDataResponse = {
  templates: MailTemplateSummary[];
  person: PersonRecord | null;
};

type TemplateDraftResponse = {
  subject?: string;
  body?: string;
  bodyHtml?: string;
  subjectFromTemplate?: boolean;
  error?: string;
};

type SendReadinessResponse = {
  canSend?: boolean;
  reason?: string | null;
  accountHandle?: string | null;
  connectedAccountId?: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  SALES: 'Sprzedaż',
  WEBSITE: 'Strona',
  HELPDESK: 'Helpdesk',
  LOGO: 'Logo',
  NAME: 'Nazwa',
  INVOICE: 'Faktura',
  CUSTOMER_SERVICE: 'Obsługa',
  REMINDER: 'Przypominajka',
  GENERAL: 'Ogólne',
};

const CATEGORY_ORDER = [
  'SALES',
  'WEBSITE',
  'HELPDESK',
  'LOGO',
  'NAME',
  'INVOICE',
  'CUSTOMER_SERVICE',
  'REMINDER',
  'GENERAL',
];

function getApiErrorMessage(error: unknown): string {
  if (error instanceof RestApiClientError) {
    const body = error.body;

    if (body && typeof body === 'object') {
      if ('error' in body && typeof body.error === 'string' && body.error) {
        return body.error;
      }

      if ('message' in body && typeof body.message === 'string' && body.message) {
        return body.message;
      }
    }
  }

  return error instanceof Error ? error.message : 'Nie udało się wysłać maila.';
}

const TemplatePicker = () => {
  const recordId = useRecordId();

  const [templates, setTemplates] = useState<MailTemplateSummary[]>([]);
  const [person, setPerson] = useState<PersonRecord | null>(null);
  const [canSendEmail, setCanSendEmail] = useState(false);
  const [sendBlockedReason, setSendBlockedReason] = useState<string | null>(null);
  const [connectedAccountHandle, setConnectedAccountHandle] = useState<
    string | null
  >(null);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBodyHtml, setEditBodyHtml] = useState('');
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [editorSessionId, setEditorSessionId] = useState(() => crypto.randomUUID());
  const editorRef = useRef<MailBodyEditorHandle>(null);
  const [subjectFromTemplate, setSubjectFromTemplate] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const personEmail = person?.email ?? '';

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId],
  );

  useEffect(() => {
    let cancelled = false;

    const loadList = async () => {
      setLoadingList(true);
      setListError(null);

      try {
        const client = new RestApiClient();
        const [data, readiness] = await Promise.all([
          client.get<PickerDataResponse>('/s/mail/picker-data', {
            query: recordId ? { recordId } : undefined,
          }),
          client.get<SendReadinessResponse>('/s/mail/send-readiness'),
        ]);

        if (cancelled) {
          return;
        }

        setTemplates(data.templates ?? []);
        setPerson(data.person ?? null);
        setCanSendEmail(Boolean(readiness.canSend));
        setSendBlockedReason(readiness.reason ?? null);
        setConnectedAccountHandle(readiness.accountHandle ?? null);
        setConnectedAccountId(readiness.connectedAccountId ?? null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setListError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    };

    void loadList();

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  const handleSelectTemplate = async (template: MailTemplateSummary) => {
    const nextSessionId = crypto.randomUUID();

    setSelectedId(template.id);
    setEditSubject('');
    setEditBodyHtml('');
    setShowHtmlEditor(false);
    setEditorKey((key) => key + 1);
    setEditorSessionId(nextSessionId);
    setDraftError(null);
    setLoadingDraft(true);

    try {
      const client = new RestApiClient();
      const draft = await client.get<TemplateDraftResponse>('/s/mail/template', {
        query: {
          templateId: template.id,
          ...(recordId ? { recordId } : {}),
        },
      });

      if (draft.error) {
        throw new Error(draft.error);
      }

      const bodyHtml = draft.bodyHtml ?? draft.body ?? '';

      setEditSubject(draft.subject ?? '');
      setEditBodyHtml(bodyHtml);
      setSubjectFromTemplate(Boolean(draft.subjectFromTemplate));

      if (bodyHtml.trim()) {
        await client.post('/s/mail/editor-draft', {
          sessionId: nextSessionId,
          html: bodyHtml,
        });
      }
    } catch (loadError) {
      setDraftError(
        loadError instanceof Error ? loadError.message : String(loadError),
      );
    } finally {
      setLoadingDraft(false);
    }
  };

  const resolveBodyHtml = async () => {
    if (showHtmlEditor) {
      return editBodyHtml.trim();
    }

    const flushed = await editorRef.current?.flushHtmlAsync();

    return (flushed?.trim() || editBodyHtml.trim());
  };

  const handleSend = async () => {
    if (!selected || !isDefined(recordId) || !personEmail) {
      return;
    }

    const subject = editSubject.trim();
    const bodyHtml = await resolveBodyHtml();

    if (!bodyHtml) {
      await enqueueSnackbar({
        message: 'Treść maila jest pusta.',
        variant: 'warning',
      });
      return;
    }

    if (!canSendEmail) {
      await enqueueSnackbar({
        message:
          sendBlockedReason ??
          'Nie można wysłać — sprawdź konto email w Settings → Accounts.',
        variant: 'error',
        duration: 12000,
      });
      return;
    }

    setSending(true);

    try {
      const client = new RestApiClient();
      const result = await client.post<{
        ok?: boolean;
        error?: string;
        to?: string;
        bodySource?: string;
        bodyLength?: number;
      }>('/s/mail/send-template', {
        recordId,
        to: personEmail,
        subject,
        htmlBody: bodyHtml,
        templateId: selected.id,
        connectedAccountId: connectedAccountId ?? undefined,
      });

      if (!result.ok) {
        throw new Error(result.error ?? 'Nie udało się wysłać maila.');
      }

      await enqueueSnackbar({
        message: `Email wysłany do ${result.to ?? personEmail}.`,
        variant: 'success',
        duration: 6000,
      });

      await closeSidePanel();
    } catch (sendError) {
      await enqueueSnackbar({
        message: getApiErrorMessage(sendError),
        variant: 'error',
        duration: 12000,
      });
    } finally {
      setSending(false);
    }
  };

  const visibleTemplates = templates
    .filter((template) => !categoryFilter || template.category === categoryFilter)
    .filter(
      (template) =>
        !query || template.name.toLowerCase().includes(query.toLowerCase()),
    );

  const categories = CATEGORY_ORDER.filter((category) =>
    templates.some((template) => template.category === category),
  );

  if (loadingList) {
    return (
      <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
        Ładowanie szablonów…
      </div>
    );
  }

  if (listError) {
    return (
      <div style={{ padding: 20, fontFamily: 'sans-serif', color: '#b00020' }}>
        Błąd ładowania: {listError}
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: 'sans-serif',
        fontSize: 14,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <strong>Szablony maili</strong>
        <input
          style={{
            flex: 1,
            minWidth: 120,
            padding: '6px 10px',
            border: '1px solid #ddd',
            borderRadius: 6,
            fontSize: 13,
          }}
          placeholder="Szukaj…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          style={{
            padding: '6px 8px',
            border: '1px solid #ddd',
            borderRadius: 6,
            fontSize: 13,
          }}
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="">Wszystkie</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category] ?? category}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          overflowY: 'auto',
          flex: selected ? '0 0 auto' : 1,
          maxHeight: selected ? '30%' : undefined,
          minHeight: 0,
        }}
      >
        {visibleTemplates.length === 0 ? (
          <div style={{ padding: 20, color: '#999' }}>Brak wyników.</div>
        ) : (
          visibleTemplates.map((template) => (
            <div
              key={template.id}
              style={{
                padding: '10px 16px',
                cursor: loadingDraft ? 'wait' : 'pointer',
                borderBottom: '1px solid #f3f3f3',
                background:
                  selectedId === template.id ? '#f0f7ff' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                opacity: loadingDraft && selectedId !== template.id ? 0.6 : 1,
              }}
              onClick={() => {
                if (!loadingDraft) {
                  void handleSelectTemplate(template);
                }
              }}
            >
              <span>{template.name}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 10,
                  background:
                    template.priority === 'MUST' ? '#ffe0e0' : '#e8f0ff',
                  color: template.priority === 'MUST' ? '#c00' : '#36f',
                  flexShrink: 0,
                }}
              >
                {template.priority === 'MUST' ? 'MUST' : 'NICE'}
              </span>
            </div>
          ))
        )}
      </div>

      {selected && (
        <div
          style={{
            borderTop: '1px solid #eee',
            padding: 16,
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {personEmail ? (
            <p style={{ fontSize: 12, color: '#444', margin: 0 }}>
              Do: <strong>{personEmail}</strong>
              {canSendEmail && connectedAccountHandle ? (
                <span style={{ color: '#666' }}>
                  {' '}
                  · z: {connectedAccountHandle}
                </span>
              ) : null}
            </p>
          ) : (
            <p style={{ fontSize: 12, color: '#b00020', margin: 0 }}>
              Brak email u tej osoby — uzupełnij pole Email.
            </p>
          )}

          {sendBlockedReason ? (
            <p style={{ fontSize: 11, color: '#b45309', margin: 0 }}>
              {sendBlockedReason}
            </p>
          ) : null}

          {loadingDraft ? (
            <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
              Ładowanie treści szablonu…
            </p>
          ) : null}

          {draftError ? (
            <p style={{ fontSize: 12, color: '#b00020', margin: 0 }}>
              {draftError}
            </p>
          ) : null}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 12, color: '#666' }}>
              Temat
              {!subjectFromTemplate && editSubject ? (
                <span style={{ fontWeight: 400, color: '#888' }}>
                  {' '}
                  (propozycja z nazwy)
                </span>
              ) : null}
            </span>
            <input
              style={{
                padding: '6px 8px',
                border: '1px solid #ddd',
                borderRadius: 5,
                fontSize: 13,
              }}
              value={editSubject}
              onChange={(event) => setEditSubject(event.target.value)}
              placeholder="Temat wiadomości"
              disabled={loadingDraft || sending}
            />
          </label>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              flex: 1,
              minHeight: 120,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 12, color: '#666' }}>
                Treść maila
              </span>
              {!loadingDraft ? (
                <button
                  type="button"
                  disabled={sending}
                onClick={() => {
                  void (async () => {
                    if (!showHtmlEditor) {
                      const flushed = await editorRef.current?.flushHtmlAsync();

                      setEditBodyHtml((current) =>
                        flushed?.trim() ? flushed : current,
                      );
                    } else {
                      setEditorKey((key) => key + 1);
                    }

                    setShowHtmlEditor((current) => !current);
                  })();
                }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#4f46e5',
                    fontSize: 11,
                    cursor: sending ? 'not-allowed' : 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  {showHtmlEditor ? 'Edytor wizualny' : 'Kod HTML'}
                </button>
              ) : null}
            </div>

            {loadingDraft ? (
              <div
                style={{
                  minHeight: 200,
                  padding: 10,
                  border: '1px solid #eee',
                  borderRadius: 6,
                  color: '#888',
                  fontSize: 12,
                  background: '#fafafa',
                }}
              >
                Ładowanie treści szablonu…
              </div>
            ) : showHtmlEditor ? (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 12, color: '#666' }}>
                  Kod HTML
                </span>
                <textarea
                  value={editBodyHtml}
                  onChange={(event) => setEditBodyHtml(event.target.value)}
                  disabled={sending}
                  style={{
                    minHeight: 200,
                    padding: 10,
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 11,
                    lineHeight: 1.5,
                    resize: 'vertical',
                    fontFamily: 'monospace',
                  }}
                />
                <span style={{ fontSize: 11, color: '#888' }}>
                  Po edycji wróć do edytora wizualnego, aby zobaczyć efekt.
                </span>
              </label>
            ) : (
              <MailBodyEditor
                ref={editorRef}
                key={`${selectedId ?? 'draft'}-${editorKey}`}
                sessionId={editorSessionId}
                value={editBodyHtml}
                onChange={setEditBodyHtml}
                disabled={sending}
              />
            )}
          </div>

          <button
            type="button"
            style={{
              width: '100%',
              padding: '10px 12px',
              background:
                sending || !canSendEmail || loadingDraft ? '#999' : '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor:
                sending || !canSendEmail || loadingDraft || !personEmail
                  ? 'not-allowed'
                  : 'pointer',
              fontWeight: 600,
              fontSize: 14,
            }}
            disabled={sending || !canSendEmail || loadingDraft || !personEmail}
            onMouseDown={() => {
              if (!showHtmlEditor) {
                void editorRef.current?.flushHtmlAsync().then((html) => {
                  if (html?.trim()) {
                    setEditBodyHtml(html);
                  }
                });
              }
            }}
            onClick={() => void handleSend()}
          >
            {sending ? 'Wysyłanie…' : 'Wyślij email'}
          </button>

          <p style={{ fontSize: 11, color: '#888', margin: 0 }}>
            {isDefined(recordId)
              ? 'Edytuj treść w wizualnym edytorze, potem wyślij.'
              : 'Wejdź w kartę osoby, potem Szablony.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'template-picker',
  description: 'Picker szablonów maili Owocni',
  component: TemplatePicker,
});
