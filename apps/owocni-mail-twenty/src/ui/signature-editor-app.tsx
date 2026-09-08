import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import {
  enqueueSnackbar,
  useRecordId,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

import {
  MailBodyEditor,
  type MailBodyEditorHandle,
} from 'src/front-components/mail-body-editor';
import { createId } from 'src/utils/createId';

type SignatureRecord = {
  id: string;
  name: string;
  mailboxHandle: string;
  bodyHtml: string;
  error?: string;
};

export const SignatureEditorApp = () => {
  const hookRecordId = useRecordId();
  const selectedIds = useSelectedRecordIds();
  const recordId = hookRecordId || selectedIds[0] || null;
  const editorRef = useRef<MailBodyEditorHandle>(null);
  const [sessionId, setSessionId] = useState(() => createId());
  const [name, setName] = useState('');
  const [mailboxHandle, setMailboxHandle] = useState('');
  const [bodyHtml, setBodyHtml] = useState('<p><br></p>');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) {
      setLoading(false);
      setError('Otwórz stopkę z listy Stopki maili.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const client = new RestApiClient();
        const data = await client.get<SignatureRecord>('/s/mail/signature', {
          query: { recordId },
        });

        if (cancelled) {
          return;
        }

        if (data.error) {
          throw new Error(data.error);
        }

        setName(data.name ?? '');
        setMailboxHandle(data.mailboxHandle ?? '');
        setBodyHtml(data.bodyHtml?.trim() ? data.bodyHtml : '<p><br></p>');
        setSessionId(createId());
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  const save = async () => {
    if (!recordId || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const html =
        (await editorRef.current?.flushHtmlAsync()) ?? bodyHtml;
      const client = new RestApiClient();
      const result = await client.post<{
        ok?: boolean;
        error?: string;
        bodyHtml?: string;
      }>('/s/mail/signature-save', {
        recordId,
        name,
        mailboxHandle,
        bodyHtml: html,
      });

      if (result.ok === false || result.error) {
        throw new Error(result.error ?? 'Zapis nieudany');
      }

      if (result.bodyHtml) {
        setBodyHtml(result.bodyHtml);
      }

      await enqueueSnackbar({
        message: 'Stopka zapisana. Kolejna odpowiedź weźmie nową treść.',
        variant: 'success',
        duration: 5000,
      });
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : String(saveError);
      setError(message);
      await enqueueSnackbar({
        message,
        variant: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: 16,
        boxSizing: 'border-box',
        fontFamily: 'Inter, system-ui, sans-serif',
        gap: 12,
        background: '#fafafa',
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          Edytor stopki
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#666' }}>
          Wejście: lista <strong>Stopki maili</strong> → kliknij <strong>imię</strong>{' '}
          (nie ołówek przy treści). Tu są kolory i Kod HTML. Na końcu{' '}
          <strong>Zapisz stopkę</strong>.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: 8,
          alignItems: 'end',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>
            Osoba
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={loading || saving}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>
            Skrzynki
          </span>
          <input
            value={mailboxHandle}
            onChange={(event) => setMailboxHandle(event.target.value)}
            disabled={loading || saving}
            placeholder="np. marta@owocni.pl"
            style={inputStyle}
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={loading || saving || !recordId}
          style={{
            height: 36,
            padding: '0 16px',
            border: 'none',
            borderRadius: 6,
            background: loading || saving || !recordId ? '#c7d2fe' : '#4f46e5',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: loading || saving || !recordId ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Zapisuję…' : 'Zapisz stopkę'}
        </button>
      </div>

      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: '#b00020' }}>{error}</p>
      ) : null}

      <div
        style={{
          flex: 1,
          minHeight: 280,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: 8,
          overflow: 'hidden',
          padding: 8,
        }}
      >
        {loading ? (
          <p style={{ margin: 16, color: '#888', fontSize: 13 }}>
            Ładuję stopkę…
          </p>
        ) : (
          <MailBodyEditor
            ref={editorRef}
            value={bodyHtml}
            onChange={setBodyHtml}
            disabled={saving}
            sessionId={sessionId}
          />
        )}
      </div>
    </div>
  );
};

const inputStyle: CSSProperties = {
  height: 36,
  padding: '0 10px',
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: 13,
};
