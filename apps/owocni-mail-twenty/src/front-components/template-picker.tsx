import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RestApiClient, RestApiClientError } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  closeSidePanel,
  enqueueSnackbar,
  useFrontComponentExecutionContext,
  useRecordId,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

import {
  MailBodyEditor,
  type MailBodyEditorHandle,
} from 'src/front-components/mail-body-editor';
import {
  extractRecordIdFromHostUrl,
  readCachedMailContext,
  scrapeHostMailContext,
  writeCachedMailContext,
} from 'src/utils/hostMailContext';
import type { PersonContext, ReplyMessagePreview } from 'src/utils/personContext';
import { createId } from 'src/utils/createId';
import { buildAttachmentPickerSrcDoc } from 'src/utils/attachmentPickerFrame';
import {
  ATTACHMENT_UPLOAD_PATH,
  formatFileSize,
  MAX_EMAIL_ATTACHMENTS,
  parseAttachmentFrameMessage,
  type EmailAttachmentRef,
} from 'src/utils/emailAttachmentShared';
import { resolveAccessToken } from 'src/utils/resolveAccessToken';
import { resolveSendSubject, toReplySubject } from 'src/utils/replySubject';
import {
  applySignatureForNewBody,
  hasSignatureMarker,
  isEmptyComposeHtml,
  swapSignatureOnFromChange,
} from 'src/utils/mailSignature';

export const TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '2d49aa61-2a83-485b-856d-c3d26885cae5';

/** Synthetic selection — free reply / compose (ADR #22), not a DB template. */
export const FREE_COMPOSE_TEMPLATE_ID = '__owocni_free_compose__';

type MailTemplateSummary = {
  id: string;
  name: string;
  category: string;
  priority: string;
  subjectTemplate: string;
};

const FREE_COMPOSE_SUMMARY: MailTemplateSummary = {
  id: FREE_COMPOSE_TEMPLATE_ID,
  name: 'Odpowiedź (bez szablonu)',
  category: 'FREE',
  priority: 'MUST',
  subjectTemplate: '',
};

type RecentRecipient = {
  email: string;
  subject: string;
  messageId?: string;
  role?: string;
};

type SuggestedReply = {
  email: string;
  subject: string;
  messageId: string | null;
  threadId: string | null;
  role: string | null;
};

type RecipientSearchHit = {
  recordId: string;
  kind: 'opportunity' | 'person';
  label: string;
  email: string;
  companyName?: string;
};

type PickerDataResponse = {
  templates: MailTemplateSummary[];
  person: PersonContext | null;
  replySubject?: string | null;
  replyMessage?: ReplyMessagePreview | null;
  contextKind?: string | null;
  contextRecordId?: string | null;
  recentRecipients?: RecentRecipient[];
  suggestedReply?: SuggestedReply | null;
  debug?: Record<string, unknown>;
};

type TemplateDraftResponse = {
  subject?: string;
  body?: string;
  bodyHtml?: string;
  subjectFromTemplate?: boolean;
  error?: string;
};

type AllowedSendAccount = {
  id: string;
  handle: string;
};

type SendReadinessResponse = {
  canSend?: boolean;
  reason?: string | null;
  accountHandle?: string | null;
  connectedAccountId?: string | null;
  allowedAccounts?: AllowedSendAccount[];
  currentUserEmail?: string | null;
  continuationHandles?: string[];
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

function formatMessageDate(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Host-injected CSS so the compose overlay can cover the CRM viewport (Remote DOM cannot portal). */
const COMPOSE_FULLSCREEN_CSS = `
.owocni-mail-fs-root,
.owocni-mail-fs-root:popover-open {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  z-index: 2147483000 !important;
  background: #ffffff !important;
  overflow: hidden !important;
}
.owocni-mail-fs-split {
  display: flex !important;
  flex-direction: row !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  min-width: 0 !important;
}
.owocni-mail-fs-left {
  flex: 1 1 42% !important;
  min-width: 280px !important;
  max-width: 48% !important;
  border-right: 1px solid #e5e7eb !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  background: #f8fafc !important;
}
.owocni-mail-fs-right {
  flex: 1 1 58% !important;
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  min-height: 0 !important;
  overflow: hidden !important;
  background: #fff !important;
}
.owocni-mail-fs-stacked {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
}
.owocni-mail-fs-stacked .owocni-mail-fs-left {
  max-width: none !important;
  min-width: 0 !important;
  flex: 0 0 38% !important;
  border-right: none !important;
  border-bottom: 1px solid #e5e7eb !important;
}
@media (max-width: 860px) {
  .owocni-mail-fs-split {
    flex-direction: column !important;
  }
  .owocni-mail-fs-left {
    max-width: none !important;
    min-width: 0 !important;
    flex: 0 0 38% !important;
    border-right: none !important;
    border-bottom: 1px solid #e5e7eb !important;
  }
}
`;

type OriginalMessageBodyProps = {
  replyMessage: ReplyMessagePreview | null;
  replySubject: string | null;
  fillHeight?: boolean;
};

const OriginalMessageBody = ({
  replyMessage,
  replySubject,
  fillHeight = false,
}: OriginalMessageBodyProps) => {
  if (!replyMessage?.text) {
    return (
      <div
        style={{
          marginTop: fillHeight ? 0 : 8,
          fontSize: 12,
          color: '#64748b',
          lineHeight: 1.45,
          padding: fillHeight ? 12 : 0,
        }}
      >
        Treść wiadomości nie jest dostępna w CRM
        {fillHeight ? '.' : ' — sprawdź wątek maili po lewej stronie.'}
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: fillHeight ? 0 : 8,
        fontSize: 13,
        color: '#334155',
        lineHeight: 1.5,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flex: fillHeight ? 1 : undefined,
        padding: fillHeight ? 16 : 0,
        boxSizing: 'border-box',
      }}
    >
      {replyMessage.fromLabel || replyMessage.fromEmail ? (
        <div style={{ marginBottom: 4, flexShrink: 0 }}>
          <strong>Od:</strong> {replyMessage.fromLabel}
          {replyMessage.fromEmail &&
          replyMessage.fromEmail !== replyMessage.fromLabel
            ? ` (${replyMessage.fromEmail})`
            : ''}
        </div>
      ) : null}
      {replyMessage.receivedAt ? (
        <div style={{ marginBottom: 4, flexShrink: 0 }}>
          <strong>Data:</strong> {formatMessageDate(replyMessage.receivedAt)}
        </div>
      ) : null}
      {(replyMessage.subject || replySubject) && (
        <div style={{ marginBottom: 8, flexShrink: 0 }}>
          <strong>Temat:</strong>{' '}
          {replyMessage.subject || toReplySubject(replySubject ?? '')}
        </div>
      )}
      <div
        style={{
          maxHeight: fillHeight ? undefined : 220,
          flex: fillHeight ? 1 : undefined,
          minHeight: 0,
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          padding: '10px 12px',
          borderRadius: 4,
          background: '#fff',
          border: '1px solid #e2e8f0',
        }}
      >
        {replyMessage.text}
      </div>
    </div>
  );
};

const HEADER_ACTION_BUTTON_STYLE = {
  fontSize: 12,
  padding: '4px 10px',
  border: '1px solid #ddd',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
} as const;

/** Inline fallback — host CSS for class names can arrive a frame late in Remote DOM. */
const COMPOSE_FULLSCREEN_ROOT_STYLE = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100vw',
  height: '100vh',
  maxWidth: 'none',
  maxHeight: 'none',
  margin: 0,
  zIndex: 2147483000,
  background: '#ffffff',
  overflow: 'hidden',
} as const;

type PopoverHostElement = HTMLElement & {
  showPopover: () => void;
  hidePopover: () => void;
};

function asPopoverHost(node: HTMLElement | null): PopoverHostElement | null {
  if (!node || typeof (node as PopoverHostElement).showPopover !== 'function') {
    return null;
  }
  return node as PopoverHostElement;
}

function closeComposePopover(node: HTMLElement | null) {
  const popover = asPopoverHost(node);
  if (popover) {
    try {
      popover.hidePopover();
    } catch {
      // already closed
    }
  }
  try {
    node?.removeAttribute('popover');
  } catch {
    // Remote DOM proxy may not expose attributes
  }
}

function openComposePopover(node: HTMLElement | null): boolean {
  const popover = asPopoverHost(node);
  if (!popover) {
    return false;
  }
  try {
    popover.setAttribute('popover', 'manual');
    popover.showPopover();
    if (typeof getComputedStyle === 'function') {
      const display = getComputedStyle(popover).display;
      if (display === 'none') {
        closeComposePopover(popover);
        return false;
      }
    }
    return true;
  } catch {
    closeComposePopover(popover);
    return false;
  }
}

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

function encodeHtmlBodyBase64(html: string): string {
  const bytes = new TextEncoder().encode(html);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

/** Prefer an explicit source; only then fall back. Never prefer a longer stale template over a shorter intentional edit. */
function pickBestBodyHtml(
  preferred: string | null | undefined,
  ...fallbacks: Array<string | null | undefined>
): string {
  if (preferred?.trim()) {
    return preferred.trim();
  }

  for (const candidate of fallbacks) {
    if (candidate?.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function resolveContextRecordId(
  recordId: string | null,
  selectedRecordIds: string[],
): {
  recordId: string | null;
  source: string | null;
  scrapedEmail: string | null;
  scrapedSubject: string | null;
  candidateRecordIds: string[];
} {
  if (recordId) {
    return {
      recordId,
      source: 'selection',
      scrapedEmail: null,
      scrapedSubject: null,
      candidateRecordIds: [recordId, ...selectedRecordIds],
    };
  }

  if (selectedRecordIds.length >= 1) {
    return {
      recordId: selectedRecordIds[0],
      source: 'selection',
      scrapedEmail: null,
      scrapedSubject: null,
      candidateRecordIds: selectedRecordIds,
    };
  }

  const scraped = scrapeHostMailContext();
  if (scraped.recordId) {
    return {
      recordId: scraped.recordId,
      source: scraped.source,
      scrapedEmail: scraped.email,
      scrapedSubject: scraped.replySubject,
      candidateRecordIds: [
        scraped.recordId,
        ...scraped.candidateRecordIds,
      ],
    };
  }

  const fromUrl = extractRecordIdFromHostUrl();
  if (fromUrl) {
    return {
      recordId: fromUrl,
      source: 'url',
      scrapedEmail: scraped.email,
      scrapedSubject: scraped.replySubject,
      candidateRecordIds: [fromUrl, ...scraped.candidateRecordIds],
    };
  }

  const cached = readCachedMailContext();
  if (cached?.recordId && cached.recordId !== 'scraped') {
    return {
      recordId: cached.recordId,
      source: 'cache',
      scrapedEmail: scraped.email || cached.email || null,
      scrapedSubject: scraped.replySubject || cached.replySubject || null,
      candidateRecordIds: [cached.recordId, ...scraped.candidateRecordIds],
    };
  }

  return {
    recordId: null,
    source: scraped.email || scraped.replySubject ? scraped.source : null,
    scrapedEmail: scraped.email || cached?.email || null,
    scrapedSubject: scraped.replySubject || cached?.replySubject || null,
    candidateRecordIds: scraped.candidateRecordIds,
  };
}

const TemplatePicker = () => {
  const recordId = useRecordId();
  const selectedRecordIds = useSelectedRecordIds();
  const executionRecordIds = useFrontComponentExecutionContext(
    (context) => context.selectedRecordIds,
  );
  const executionRecordId = useFrontComponentExecutionContext(
    (context) => context.recordId,
  );

  // Merge all Twenty context sources — Reply often clears one of them.
  const mergedSelectedIds = useMemo(() => {
    const ids = [
      ...selectedRecordIds,
      ...executionRecordIds,
      ...(executionRecordId ? [executionRecordId] : []),
      ...(recordId ? [recordId] : []),
    ];
    return [...new Set(ids.filter(Boolean))];
  }, [selectedRecordIds, executionRecordIds, executionRecordId, recordId]);

  const resolvedContext = useMemo(
    () =>
      resolveContextRecordId(
        executionRecordId || recordId,
        mergedSelectedIds,
      ),
    [executionRecordId, recordId, mergedSelectedIds],
  );
  const contextRecordId = resolvedContext.recordId;

  const [templates, setTemplates] = useState<MailTemplateSummary[]>([]);
  const [person, setPerson] = useState<PersonContext | null>(null);
  // Do not seed from global mailbox / stale cache without a real recordId.
  const [replySubject, setReplySubject] = useState<string | null>(() => {
    if (!contextRecordId) {
      return resolvedContext.scrapedSubject || null;
    }
    const cached = readCachedMailContext();
    if (cached?.recordId === contextRecordId) {
      return resolvedContext.scrapedSubject || cached.replySubject || null;
    }
    return resolvedContext.scrapedSubject || null;
  });
  const [contextKind, setContextKind] = useState<string | null>(null);
  const [emailSource, setEmailSource] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(() => {
    if (!contextRecordId) {
      return resolvedContext.scrapedEmail || '';
    }
    const cached = readCachedMailContext();
    if (cached?.recordId === contextRecordId) {
      return resolvedContext.scrapedEmail || cached.email || '';
    }
    return resolvedContext.scrapedEmail || '';
  });
  const [canSendEmail, setCanSendEmail] = useState(false);
  const [sendBlockedReason, setSendBlockedReason] = useState<string | null>(null);
  const [connectedAccountHandle, setConnectedAccountHandle] = useState<
    string | null
  >(null);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(
    null,
  );
  const [allowedSendAccounts, setAllowedSendAccounts] = useState<
    AllowedSendAccount[]
  >([]);
  // ADR #22: open straight into free reply — templates only via „Wstaw szablon”.
  const [selectedId, setSelectedId] = useState<string | null>(
    FREE_COMPOSE_TEMPLATE_ID,
  );
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBodyHtml, setEditBodyHtml] = useState('<p><br></p>');
  const [editorSessionId, setEditorSessionId] = useState(() => createId());
  const editorRef = useRef<MailBodyEditorHandle>(null);
  const signatureSeededForSessionRef = useRef<string | null>(null);
  const replySubjectRef = useRef<string | null>(null);
  const editSubjectRef = useRef('');
  const subjectTouchedRef = useRef(false);
  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([]);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadSearchHits, setLeadSearchHits] = useState<RecipientSearchHit[]>([]);
  const [leadSearchLoading, setLeadSearchLoading] = useState(false);
  const [resolvedRecordId, setResolvedRecordId] = useState<string | null>(null);
  const [subjectFromTemplate, setSubjectFromTemplate] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendCountdown, setSendCountdown] = useState<number | null>(null);
  const sendCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const [draftError, setDraftError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [replyMessageId, setReplyMessageId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState<ReplyMessagePreview | null>(
    null,
  );
  const [attachments, setAttachments] = useState<
    Array<EmailAttachmentRef & { size?: number }>
  >([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentPickerSrcDoc, setAttachmentPickerSrcDoc] = useState('');
  const [attachmentToken, setAttachmentToken] = useState('');
  const [composerExpanded, setComposerExpanded] = useState(false);
  const overlayRootRef = useRef<HTMLDivElement | null>(null);

  const personEmail = recipientEmail.trim() || person?.email?.trim() || '';
  const displayRecipientEmail =
    recipientEmail.trim() || person?.email?.trim() || '';
  const effectiveRecordId =
    person?.id && person.id !== 'scraped'
      ? person.id
      : resolvedRecordId || contextRecordId;
  const isReplyContext = Boolean(replySubject);

  replySubjectRef.current = replySubject;
  editSubjectRef.current = editSubject;

  // Keep „Do” input in sync with resolved lead / thread context (picker showed empty while send used person.email).
  useEffect(() => {
    const resolved = person?.email?.trim();
    if (!resolved || recipientEmail.trim()) {
      return;
    }
    setRecipientEmail(resolved);
  }, [person?.email, recipientEmail]);

  const selected = useMemo(() => {
    if (selectedId === FREE_COMPOSE_TEMPLATE_ID) {
      return FREE_COMPOSE_SUMMARY;
    }

    return templates.find((template) => template.id === selectedId) ?? null;
  }, [templates, selectedId]);

  const enterFreeCompose = (subjectHint?: string | null) => {
    subjectTouchedRef.current = false;
    setSelectedId(FREE_COMPOSE_TEMPLATE_ID);
    const nextSessionId = createId();
    signatureSeededForSessionRef.current = connectedAccountHandle
      ? nextSessionId
      : null;
    setEditBodyHtml(
      applySignatureForNewBody('<p><br></p>', connectedAccountHandle),
    );
    setEditorSessionId(nextSessionId);
    setLoadingDraft(false);
    setDraftError(null);
    setAttachments([]);
    setAttachmentError(null);
    const subj = subjectHint?.trim() || replySubjectRef.current?.trim() || null;
    if (subj) {
      setEditSubject(toReplySubject(subj));
    } else {
      setEditSubject('');
    }
    setSubjectFromTemplate(false);
  };

  // Prefill Re:/Odp: from the thread. Never overwrite a subject the user already typed.
  useEffect(() => {
    if (!replySubject || !selectedId || subjectTouchedRef.current) {
      return;
    }

    setEditSubject(toReplySubject(replySubject));
    setSubjectFromTemplate(false);
  }, [replySubject, selectedId]);

  // Search leads/people when Twenty did not pass record context.
  useEffect(() => {
    const query = leadSearchQuery.trim();
    if (query.length < 2 || personEmail) {
      setLeadSearchHits([]);
      return;
    }

    let cancelled = false;
    const timer = globalThis.setTimeout(() => {
      void (async () => {
        setLeadSearchLoading(true);
        try {
          const client = new RestApiClient();
          const result = await client.get<{ hits?: RecipientSearchHit[] }>(
            '/s/mail/search-recipients',
            { query: { q: query } },
          );
          if (!cancelled) {
            setLeadSearchHits(result.hits ?? []);
          }
        } catch {
          if (!cancelled) {
            setLeadSearchHits([]);
          }
        } finally {
          if (!cancelled) {
            setLeadSearchLoading(false);
          }
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [leadSearchQuery, personEmail]);

  useEffect(() => {
    let cancelled = false;

    const loadList = async () => {
      setLoadingList(true);
      setListError(null);

      try {
        const client = new RestApiClient();
        const candidates = [
          contextRecordId,
          ...resolvedContext.candidateRecordIds,
        ].filter((id, index, all): id is string => Boolean(id) && all.indexOf(id) === index);

        // Fast path: templates first (no mailbox scan).
        let data = await client.get<PickerDataResponse>('/s/mail/picker-data', {
          query: {
            skipRecent: '1',
            ...(candidates[0] ? { recordId: candidates[0] } : {}),
            ...(resolvedContext.scrapedEmail
              ? { email: resolvedContext.scrapedEmail }
              : {}),
          },
        });

        if (cancelled) {
          return;
        }

        setTemplates(data.templates ?? []);

        // Try other candidate record IDs until we get an email or reply subject.
        for (let i = 1; i < candidates.length; i += 1) {
          if (data.person?.email || data.replySubject) {
            break;
          }

          try {
            const next = await client.get<PickerDataResponse>(
              '/s/mail/picker-data',
              {
                query: {
                  skipRecent: '1',
                  recordId: candidates[i],
                },
              },
            );
            if (next.person?.email || next.replySubject) {
              data = {
                ...data,
                person: next.person ?? data.person,
                replySubject: next.replySubject ?? data.replySubject,
                contextKind: next.contextKind ?? data.contextKind,
                contextRecordId: candidates[i],
                debug: {
                  ...(data.debug ?? {}),
                  resolvedViaCandidate: candidates[i],
                  candidateDebug: next.debug,
                },
              };
              break;
            }
          } catch {
            // try next candidate
          }
        }

        if (cancelled) {
          return;
        }

        setPerson(data.person ?? null);

        // No hooks (typical after native Reply) — restore last pinned lead/thread.
        if (!data.person?.email && !data.replySubject && candidates.length === 0) {
          try {
            const pinned = await client.get<{
              ok?: boolean;
              context?: { recordId?: string } | null;
              person?: PersonContext | null;
              replySubject?: string | null;
              contextKind?: string | null;
            }>('/s/mail/active-context');

            if (pinned.person?.email || pinned.replySubject || pinned.context?.recordId) {
              data = {
                ...data,
                person: pinned.person ?? data.person,
                replySubject: pinned.replySubject ?? data.replySubject,
                contextKind: pinned.contextKind ?? 'activeContext',
                contextRecordId: pinned.context?.recordId ?? data.contextRecordId,
                debug: {
                  ...(data.debug ?? {}),
                  restoredFromActiveContext: pinned.context,
                },
              };
              if (pinned.context?.recordId) {
                setResolvedRecordId(pinned.context.recordId);
              }
              setPerson(data.person ?? null);
            }
          } catch {
            // no pinned context
          }
        }

        const applyResolvedContext = (payload: {
          personEmail?: string | null;
          replySubject?: string | null;
          replyMessage?: ReplyMessagePreview | null;
          contextKind?: string | null;
          recentRecipients?: RecentRecipient[];
          debug?: Record<string, unknown>;
          /** Never auto-applied — dropdown only. */
          mailboxSuggestions?: RecentRecipient[];
        }) => {
          if (payload.recentRecipients) {
            setRecentRecipients(payload.recentRecipients);
          }
          if (payload.mailboxSuggestions) {
            setRecentRecipients(payload.mailboxSuggestions);
          }

          // ONLY trusted sources — never global mailbox "latest thread"
          // (that caused wrong lead: patrycjabierka instead of Gryla).
          const fromPerson =
            payload.personEmail?.trim() ||
            data.person?.email?.trim() ||
            '';
          const fromScrape = resolvedContext.scrapedEmail?.trim() || '';
          const cached = readCachedMailContext();
          const cacheMatches =
            Boolean(cached?.recordId) &&
            (cached!.recordId === data.contextRecordId ||
              cached!.recordId === contextRecordId ||
              candidates.includes(cached!.recordId));
          const fromCache = cacheMatches ? cached?.email?.trim() || '' : '';

          const nextEmail = fromPerson || fromScrape || fromCache;
          const source =
            (fromPerson && (payload.contextKind || data.contextKind || 'person')) ||
            (fromScrape && 'scrape') ||
            (fromCache && 'cache') ||
            null;

          const finalReply =
            payload.replySubject?.trim() ||
            resolvedContext.scrapedSubject?.trim() ||
            (cacheMatches ? cached?.replySubject?.trim() || null : null) ||
            null;

          if (finalReply) {
            setReplySubject(finalReply);
          } else {
            setReplySubject(null);
          }

          if (payload.replyMessage) {
            setReplyMessage(payload.replyMessage);
            if (payload.replyMessage.messageId) {
              setReplyMessageId(payload.replyMessage.messageId);
            }
          }

          setContextKind(
            payload.contextKind ||
              data.contextKind ||
              (typeof source === 'string' ? source : null) ||
              resolvedContext.source ||
              null,
          );
          setEmailSource(typeof source === 'string' ? source : null);

          if (nextEmail) {
            setRecipientEmail(nextEmail);
          }

          const pinRecordId =
            data.contextRecordId || contextRecordId || candidates[0] || null;

          if (nextEmail && pinRecordId) {
            writeCachedMailContext({
              recordId: pinRecordId,
              email: nextEmail,
              replySubject: finalReply || undefined,
            });
            void client
              .post('/s/mail/active-context', {
                recordId: pinRecordId,
                email: nextEmail,
                replySubject: finalReply || undefined,
              })
              .catch(() => undefined);
          }
        };

        applyResolvedContext({
          personEmail: data.person?.email,
          replySubject: data.replySubject,
          replyMessage: data.replyMessage ?? null,
          contextKind: data.contextKind,
          debug: data.debug,
        });

        // Load mailbox list only for manual dropdown — never autofill from it.
        try {
          const suggestion = await client.get<{
            suggestedReply?: SuggestedReply | null;
            recentRecipients?: RecentRecipient[];
            debug?: Record<string, unknown>;
          }>('/s/mail/suggested-reply');

          if (!cancelled && suggestion.recentRecipients?.length) {
            setRecentRecipients(suggestion.recentRecipients);
          }

          // Never copy suggestedReply.messageId into In-Reply-To.
          // That query is "latest threads in the workspace", not this lead.

          // Thread reply: subject known but CRM person missing — use mailbox peer when subjects align.
          if (
            !cancelled &&
            !recipientEmail.trim() &&
            !data.person?.email?.trim() &&
            suggestion.suggestedReply?.email?.trim() &&
            (data.contextKind === 'message' ||
              data.contextKind === 'messageThread' ||
              Boolean(data.replySubject?.trim()))
          ) {
            const sr = suggestion.suggestedReply;
            const hint = data.replySubject?.trim() || replySubjectRef.current?.trim() || '';
            const srSubject = sr.subject?.trim() || '';
            const subjectsAlign =
              !hint ||
              !srSubject ||
              toReplySubject(srSubject) === toReplySubject(hint);

            if (subjectsAlign) {
              setRecipientEmail(sr.email.trim());
              setEmailSource('thread');
              if (sr.subject?.trim() && !hint) {
                const nextSubject = toReplySubject(sr.subject);
                setReplySubject(nextSubject);
                replySubjectRef.current = nextSubject;
              }
            }
          }
        } catch {
          // optional dropdown only
        }

        // ADR #22: default = free reply from own mailbox (not template picker).
        if (!cancelled) {
          const replyHint =
            data.replySubject?.trim() ||
            resolvedContext.scrapedSubject?.trim() ||
            null;
          setSelectedId(FREE_COMPOSE_TEMPLATE_ID);
          const nextSessionId = createId();
          signatureSeededForSessionRef.current = connectedAccountHandle
            ? nextSessionId
            : null;
          setEditBodyHtml(
            applySignatureForNewBody('<p><br></p>', connectedAccountHandle),
          );
          setEditorSessionId(nextSessionId);
          setLoadingDraft(false);
          setDraftError(null);
          setSubjectFromTemplate(false);
          if (replyHint) {
            setEditSubject(toReplySubject(replyHint));
          }
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setListError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
        // Still keep free compose so Reply is usable without templates.
        enterFreeCompose(
          resolvedContext.scrapedSubject?.trim() ||
            replySubjectRef.current ||
            null,
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
  }, [
    contextRecordId,
    resolvedContext.source,
    resolvedContext.scrapedEmail,
    mergedSelectedIds.join(','),
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadReadiness = async () => {
      try {
        const client = new RestApiClient();
        const query: Record<string, string> = {};

        if (effectiveRecordId) {
          query.recordId = effectiveRecordId;
        }

        if (personEmail) {
          query.email = personEmail;
        }

        const readiness = await client.get<SendReadinessResponse>(
          '/s/mail/send-readiness',
          Object.keys(query).length > 0 ? { query } : undefined,
        );

        if (cancelled) {
          return;
        }

        const allowed = Array.isArray(readiness.allowedAccounts)
          ? readiness.allowedAccounts
          : [];

        setAllowedSendAccounts(allowed);
        setCanSendEmail(Boolean(readiness.canSend));
        setSendBlockedReason(readiness.reason ?? null);
        setConnectedAccountHandle(readiness.accountHandle ?? null);
        setConnectedAccountId(readiness.connectedAccountId ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setCanSendEmail(false);
          setAllowedSendAccounts([]);
          setSendBlockedReason(
            getApiErrorMessage(loadError) ||
              'Nie udało się sprawdzić konta email. Odśwież panel lub sprawdź Settings → Accounts.',
          );
        }
      }
    };

    void loadReadiness();

    return () => {
      cancelled = true;
    };
  }, [effectiveRecordId, personEmail]);

  useEffect(() => {
    if (!connectedAccountHandle) {
      return;
    }

    setEditBodyHtml((current) => {
      if (hasSignatureMarker(current)) {
        signatureSeededForSessionRef.current = editorSessionId;
        const swapped = swapSignatureOnFromChange(
          current,
          connectedAccountHandle,
        );

        if (swapped !== current) {
          queueMicrotask(() => {
            editorRef.current?.setHtml(swapped);
          });
        }

        return swapped;
      }

      if (signatureSeededForSessionRef.current === editorSessionId) {
        return current;
      }

      const next = applySignatureForNewBody(current, connectedAccountHandle);
      signatureSeededForSessionRef.current = editorSessionId;

      if (next !== current) {
        const remountEmpty = isEmptyComposeHtml(current);
        queueMicrotask(() => {
          if (remountEmpty) {
            setEditorSessionId(createId());
          } else {
            editorRef.current?.setHtml(next);
          }
        });
      }

      return next;
    });
  }, [connectedAccountHandle, editorSessionId]);

  const handleSelectTemplate = async (template: MailTemplateSummary) => {
    const nextSessionId = createId();
    const knownRecipient =
      recipientEmail.trim() || person?.email?.trim() || '';
    if (knownRecipient && !recipientEmail.trim()) {
      setRecipientEmail(knownRecipient);
    }

    subjectTouchedRef.current = false;
    setSelectedId(template.id);
    setEditSubject('');
    setEditBodyHtml('');
    setEditorSessionId(nextSessionId);
    setDraftError(null);
    setAttachments([]);
    setAttachmentError(null);
    setLoadingDraft(true);

    try {
      const client = new RestApiClient();
      const draftQuery: Record<string, string> = {
        templateId: template.id,
      };

      if (effectiveRecordId) {
        draftQuery.recordId = effectiveRecordId;
      }

      if (personEmail) {
        draftQuery.email = personEmail;
      }

      const draft = await client.get<TemplateDraftResponse>('/s/mail/template', {
        query: draftQuery,
      });

      if (draft.error) {
        throw new Error(draft.error);
      }

      const bodyHtml = draft.bodyHtml ?? draft.body ?? '';
      const activeReply = replySubjectRef.current?.trim() || null;
      const replyLikeSource =
        emailSource === 'manualRecent' ||
        contextKind === 'message' ||
        contextKind === 'messageThread';

      // Reply / thread subject always wins over template subject.
      if (activeReply) {
        setEditSubject(toReplySubject(activeReply));
        setSubjectFromTemplate(false);
      } else if (replyLikeSource) {
        setEditSubject('');
        setSubjectFromTemplate(false);
      } else {
        setEditSubject(draft.subject ?? '');
        setSubjectFromTemplate(Boolean(draft.subjectFromTemplate));
      }

      // eslint-disable-next-line no-console
      console.log('[OwocniMailPicker] template-subject', {
        templateSubject: draft.subject ?? null,
        activeReply,
        emailSource,
        contextKind,
        replyLikeSource,
        applied: activeReply
          ? toReplySubject(activeReply)
          : replyLikeSource
            ? '(empty-wait-for-thread)'
            : (draft.subject ?? ''),
      });

      const signedBody = applySignatureForNewBody(
        bodyHtml,
        connectedAccountHandle,
      );
      signatureSeededForSessionRef.current = connectedAccountHandle
        ? nextSessionId
        : null;
      setEditBodyHtml(signedBody);
      setEditorSessionId(nextSessionId);

      // Seed server draft immediately (same LF memory the iframe will update).
      try {
        const bytes = new TextEncoder().encode(signedBody);
        let binary = '';
        for (const byte of bytes) {
          binary += String.fromCharCode(byte);
        }
        await client.post('/s/mail/editor-draft', {
          sessionId: nextSessionId,
          htmlBase64: btoa(binary),
          html: signedBody.slice(0, 50_000),
        });
      } catch {
        // non-fatal — editor will seed on mount
      }
    } catch (loadError) {
      setDraftError(
        loadError instanceof Error ? loadError.message : String(loadError),
      );
    } finally {
      setLoadingDraft(false);
    }
  };

  const applyRecentRecipient = (recipient: RecentRecipient) => {
    subjectTouchedRef.current = false;
    setRecipientEmail(recipient.email);
    setEmailSource('manualRecent');
    if (recipient.subject) {
      const nextSubject = toReplySubject(recipient.subject);
      setReplySubject(nextSubject);
      replySubjectRef.current = nextSubject;
      if (selectedId) {
        setEditSubject(nextSubject);
        setSubjectFromTemplate(false);
      }
    }
  };

  const applySearchHit = async (hit: RecipientSearchHit) => {
    subjectTouchedRef.current = false;
    setRecipientEmail(hit.email);
    setEmailSource('leadSearch');
    setResolvedRecordId(hit.recordId);
    setLeadSearchQuery('');
    setLeadSearchHits([]);
    setContextKind(hit.kind);

    try {
      const client = new RestApiClient();
      const data = await client.get<PickerDataResponse>('/s/mail/picker-data', {
        query: {
          skipRecent: '1',
          recordId: hit.recordId,
          email: hit.email,
        },
      });

      if (data.person) {
        setPerson(data.person);
      } else {
        setPerson({
          id: hit.recordId,
          firstName: '',
          lastName: '',
          clientName: hit.label,
          email: hit.email,
          companyName: hit.companyName ?? '',
        });
      }

      const nextReply = data.replySubject?.trim() || null;
      if (nextReply) {
        setReplySubject(nextReply);
        replySubjectRef.current = nextReply;
        if (selectedId) {
          setEditSubject(toReplySubject(nextReply));
          setSubjectFromTemplate(false);
        }
      }

      if (data.contextKind) {
        setContextKind(data.contextKind);
      }

      writeCachedMailContext({
        recordId: hit.recordId,
        email: hit.email,
        replySubject: nextReply || undefined,
      });

      try {
        await client.post('/s/mail/active-context', {
          recordId: hit.recordId,
          email: hit.email,
          replySubject: nextReply || undefined,
          objectNameSingular: hit.kind,
        });
      } catch {
        // non-fatal
      }
    } catch {
      // search resolve failed — email already set from hit
    }
  };

  const clearSendCountdown = () => {
    if (sendCountdownTimerRef.current) {
      clearInterval(sendCountdownTimerRef.current);
      sendCountdownTimerRef.current = null;
    }
    setSendCountdown(null);
  };

  const performSend = async () => {
    if (!selected || !personEmail) {
      return;
    }

    // Await iframe/server flush — sync flushHtml is often stale in Twenty sandbox.
    const flushed = (await editorRef.current?.flushHtmlAsync()) ?? '';
    const bodyHtml = pickBestBodyHtml(flushed, editBodyHtml);

    if (bodyHtml.trim()) {
      setEditBodyHtml(bodyHtml);
    }

    const subject = resolveSendSubject(
      editSubjectRef.current,
      replySubjectRef.current,
    );

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
        from?: string;
      }>('/s/mail/send-template', {
        recordId: effectiveRecordId ?? undefined,
        to: personEmail,
        subject,
        htmlBody: bodyHtml,
        htmlBodyBase64: encodeHtmlBodyBase64(bodyHtml),
        templateId:
          selected.id === FREE_COMPOSE_TEMPLATE_ID ? undefined : selected.id,
        connectedAccountId: connectedAccountId ?? undefined,
        inReplyToMessageId: replyMessageId ?? undefined,
        files: attachments.map(({ id, name }) => ({ id, name })),
      });

      if (!result.ok) {
        throw new Error(result.error ?? 'Nie udało się wysłać maila.');
      }

      const fromEditor = result.bodySource === 'client';
      await enqueueSnackbar({
        message: fromEditor
          ? `Wysłano do ${result.to ?? personEmail} (${result.bodyLength ?? bodyHtml.length} znaków z edytora).`
          : `Wysłano do ${result.to ?? personEmail} (szablon z bazy — edycja nie dotarła!).`,
        variant: fromEditor ? 'success' : 'warning',
        duration: fromEditor ? 6000 : 12000,
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

  const SEND_COUNTDOWN_SECONDS = 15;

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((entry) => entry.id !== id));
  };

  // Overlay / send lock — includes in-flight upload.
  const attachmentPickerDisabled =
    sending ||
    loadingDraft ||
    uploadingAttachments ||
    attachments.length >= MAX_EMAIL_ATTACHMENTS ||
    sendCountdown !== null;

  // Remounting the iframe aborts fetch. Never bake `uploadingAttachments` into srcDoc.
  const attachmentPickerLocked =
    sending ||
    loadingDraft ||
    attachments.length >= MAX_EMAIL_ATTACHMENTS ||
    sendCountdown !== null;

  useEffect(() => {
    if (!selected) {
      setAttachmentPickerSrcDoc('');
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      try {
        const token = await resolveAccessToken();
        if (cancelled) {
          return;
        }
        setAttachmentToken(token);
        setAttachmentPickerSrcDoc(
          buildAttachmentPickerSrcDoc({
            sessionId: editorSessionId,
            accessToken: token,
            disabled: attachmentPickerLocked,
          }),
        );
      } catch {
        if (!cancelled) {
          setAttachmentPickerSrcDoc(
            buildAttachmentPickerSrcDoc({
              sessionId: editorSessionId,
              accessToken: attachmentToken,
              disabled: true,
            }),
          );
        }
      }
    };

    void refresh();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, editorSessionId, attachmentPickerLocked]);

  useEffect(() => {
    if (!selected || !editorSessionId) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      const parsed = parseAttachmentFrameMessage(event.data, editorSessionId);

      if (!parsed) {
        return;
      }

      if (parsed.uploading === true) {
        setUploadingAttachments(true);
      }

      if (parsed.uploading === false) {
        setUploadingAttachments(false);
      }

      if (parsed.file?.id && parsed.file.name) {
        setAttachmentError(null);
        setAttachments((prev) => {
          if (prev.some((entry) => entry.id === parsed.file?.id)) {
            return prev;
          }

          return [...prev, parsed.file!].slice(0, MAX_EMAIL_ATTACHMENTS);
        });
        return;
      }

      if (parsed.error) {
        setAttachmentError(parsed.error);
        void enqueueSnackbar({
          message: parsed.error,
          variant: 'error',
        });
      }
    };

    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [selected, editorSessionId]);

  useEffect(() => {
    if (!selected || !editorSessionId) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const client = new RestApiClient();
        const data = await client.post<{
          ok?: boolean;
          files?: Array<EmailAttachmentRef & { size?: number }>;
          uploading?: number;
        }>(ATTACHMENT_UPLOAD_PATH, {
          action: 'list',
          sessionId: editorSessionId,
        });

        if (cancelled) {
          return;
        }

        // Store may live on another isolate — never clear busy from an empty poll.
        if ((data.uploading ?? 0) > 0) {
          setUploadingAttachments(true);
        }

        const incoming = Array.isArray(data.files) ? data.files : [];

        if (incoming.length === 0) {
          return;
        }

        const acceptedIds: string[] = [];

        setAttachments((prev) => {
          const next = [...prev];

          for (const file of incoming) {
            if (!file?.id || !file?.name) {
              continue;
            }

            acceptedIds.push(file.id);

            if (next.some((entry) => entry.id === file.id)) {
              continue;
            }

            next.push({
              id: file.id,
              name: file.name,
              size: file.size,
            });
          }

          return next.slice(0, MAX_EMAIL_ATTACHMENTS);
        });

        if (acceptedIds.length > 0) {
          setAttachmentError(null);
          await client.post(ATTACHMENT_UPLOAD_PATH, {
            action: 'ack',
            sessionId: editorSessionId,
            ids: acceptedIds,
          });
        }
      } catch {
        // ignore transient poll errors
      }
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selected, editorSessionId]);

  const startSendCountdown = () => {
    if (
      !selected ||
      !personEmail ||
      sending ||
      sendCountdown !== null ||
      uploadingAttachments
    ) {
      return;
    }

    if (!canSendEmail) {
      void enqueueSnackbar({
        message:
          sendBlockedReason ??
          'Nie można wysłać — sprawdź konto email w Settings → Accounts.',
        variant: 'error',
        duration: 12000,
      });
      return;
    }

    clearSendCountdown();
    let remaining = SEND_COUNTDOWN_SECONDS;
    setSendCountdown(remaining);

    sendCountdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (sendCountdownTimerRef.current) {
          clearInterval(sendCountdownTimerRef.current);
          sendCountdownTimerRef.current = null;
        }
        setSendCountdown(null);
        void performSend();
        return;
      }
      setSendCountdown(remaining);
    }, 1000);
  };

  const cancelSendCountdown = () => {
    clearSendCountdown();
  };

  const sendNow = () => {
    clearSendCountdown();
    void performSend();
  };

  useEffect(() => {
    return () => {
      if (sendCountdownTimerRef.current) {
        clearInterval(sendCountdownTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!composerExpanded) {
      closeComposePopover(overlayRootRef.current);
      return;
    }

    let cancelled = false;
    let frame = 0;
    let attempts = 0;

    const tryOpen = () => {
      if (cancelled) {
        return;
      }
      const node = overlayRootRef.current;
      if (!node) {
        if (attempts++ < 24) {
          frame = requestAnimationFrame(tryOpen);
        }
        return;
      }
      openComposePopover(node);
    };

    tryOpen();

    return () => {
      cancelled = true;
      if (frame) {
        cancelAnimationFrame(frame);
      }
      closeComposePopover(overlayRootRef.current);
    };
  }, [composerExpanded]);

  useEffect(() => {
    if (!composerExpanded) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setComposerExpanded(false);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [composerExpanded]);

  const visibleTemplates = templates
    .filter((template) => !categoryFilter || template.category === categoryFilter)
    .filter(
      (template) =>
        !query || template.name.toLowerCase().includes(query.toLowerCase()),
    );

  const categories = CATEGORY_ORDER.filter((category) =>
    templates.some((template) => template.category === category),
  );

  const showOriginalPane = Boolean(
    composerExpanded && (replyMessage?.text || isReplyContext),
  );
  const useWideSplit =
    showOriginalPane &&
    (typeof window === 'undefined' || window.innerWidth >= 860);
  const rootClassName = composerExpanded ? 'owocni-mail-fs-root' : undefined;
  const composeSplitClassName = composerExpanded
    ? showOriginalPane
      ? 'owocni-mail-fs-split'
      : 'owocni-mail-fs-stacked'
    : undefined;

  return (
    <div
      ref={overlayRootRef}
      className={rootClassName}
      style={{
        fontFamily: 'sans-serif',
        fontSize: 14,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        ...(composerExpanded ? COMPOSE_FULLSCREEN_ROOT_STYLE : null),
      }}
    >
      <style>{COMPOSE_FULLSCREEN_CSS}</style>
      {listError ? (
        <div
          style={{
            padding: '8px 16px',
            background: '#fef2f2',
            color: '#b00020',
            fontSize: 12,
            borderBottom: '1px solid #fecaca',
          }}
        >
          Szablony niedostępne ({listError}). Możesz pisać od zera.
        </div>
      ) : null}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <strong>Odpowiedz</strong>
        {connectedAccountHandle ? (
          <span
            style={{
              fontSize: 11,
              color: '#166534',
              background: '#dcfce7',
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            From: {connectedAccountHandle}
          </span>
        ) : null}
        {isReplyContext ? (
          <span
            style={{
              fontSize: 11,
              color: '#166534',
              background: '#dcfce7',
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            Odpowiedź
          </span>
        ) : null}
        {personEmail ? (
          <span style={{ fontSize: 11, color: '#666' }}>
            → {personEmail}
            {replySubject
              ? ` · ${toReplySubject(replySubject).slice(0, 36)}`
              : ''}
          </span>
        ) : !contextRecordId && !resolvedRecordId ? (
          <span style={{ fontSize: 11, color: '#b45309', maxWidth: 480 }}>
            Brak kontekstu leada — wpisz email odbiorcy albo zamknij natywny Reply
            i otwórz <strong>Odpowiedz</strong> z karty leada.
          </span>
        ) : null}
        {selected ? (
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              title={
                composerExpanded
                  ? 'Wróć do panelu bocznego'
                  : 'Otwórz wiadomość źródłową i edytor na cały ekran'
              }
              style={{
                ...HEADER_ACTION_BUTTON_STYLE,
                background: composerExpanded ? '#eef2ff' : '#fff',
                borderColor: composerExpanded ? '#6366f1' : '#ddd',
                color: composerExpanded ? '#3730a3' : '#333',
                fontWeight: composerExpanded ? 600 : 400,
                cursor: sending ? 'not-allowed' : 'pointer',
              }}
              disabled={sending}
              onClick={() => setComposerExpanded((open) => !open)}
            >
              {composerExpanded ? 'Zamknij pełne okno' : 'Pełne okno'}
            </button>
            {selected.id === FREE_COMPOSE_TEMPLATE_ID ? (
              <button
                type="button"
                style={HEADER_ACTION_BUTTON_STYLE}
                disabled={sending}
                onClick={() => {
                  setComposerExpanded(false);
                  setSelectedId(null);
                }}
              >
                Wstaw szablon
              </button>
            ) : (
              <button
                type="button"
                style={HEADER_ACTION_BUTTON_STYLE}
                disabled={sending}
                onClick={() => enterFreeCompose(replySubject)}
              >
                Bez szablonu
              </button>
            )}
          </div>
        ) : null}
      </div>

      {selected?.id !== FREE_COMPOSE_TEMPLATE_ID && !composerExpanded ? (
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 16px',
          borderBottom: '1px solid #eee',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          style={{
            flex: 1,
            minWidth: 120,
            padding: '6px 10px',
            border: '1px solid #ddd',
            borderRadius: 6,
            fontSize: 13,
          }}
          placeholder="Szukaj szablonu…"
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
      ) : null}

      {!selected && !composerExpanded ? (
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          background: personEmail ? '#fafafa' : '#fff7ed',
        }}
      >
        <button
          type="button"
          style={{
            width: '100%',
            padding: '10px 12px',
            background: '#166534',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 4,
          }}
          disabled={sending}
          onClick={() => enterFreeCompose(replySubject)}
        >
          Pisz od zera (ze swojej skrzynki)
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 12, color: '#666' }}>Do</span>
          <input
            style={{
              flex: 1,
              minWidth: 180,
              padding: '6px 8px',
              border: `1px solid ${personEmail ? '#ddd' : '#f87171'}`,
              borderRadius: 5,
              fontSize: 13,
            }}
            value={displayRecipientEmail}
            onChange={(event) => {
              setRecipientEmail(event.target.value);
              setEmailSource('manual');
            }}
            placeholder="email@klienta.pl"
            disabled={sending}
          />
          {displayRecipientEmail && person?.clientName ? (
            <span style={{ fontSize: 11, color: '#166534' }}>
              {person.clientName}
              {person.companyName ? ` · ${person.companyName}` : ''}
            </span>
          ) : null}
          {emailSource === 'manualRecent' && personEmail ? (
            <span style={{ fontSize: 11, color: '#b45309' }}>
              Wybrane ręcznie ze skrzynki — nie z tego leada automatycznie
            </span>
          ) : null}
          {emailSource === 'leadSearch' && personEmail ? (
            <span style={{ fontSize: 11, color: '#166534' }}>
              Z wyszukiwania leada
            </span>
          ) : null}
          {recentRecipients.length > 0 ? (
            <select
              style={{
                padding: '6px 8px',
                border: '1px solid #ddd',
                borderRadius: 5,
                fontSize: 12,
                maxWidth: 280,
              }}
              defaultValue=""
              disabled={sending}
              onChange={(event) => {
                const email = event.target.value;
                const recipient = recentRecipients.find(
                  (entry) => entry.email === email,
                );
                if (recipient) {
                  applyRecentRecipient(recipient);
                }
              }}
            >
              <option value="">Skrzynka (ręczne)…</option>
              {recentRecipients.map((recipient) => (
                <option key={recipient.email} value={recipient.email}>
                  {recipient.email}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        {!personEmail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              style={{
                padding: '6px 8px',
                border: '1px solid #f59e0b',
                borderRadius: 5,
                fontSize: 13,
              }}
              value={leadSearchQuery}
              onChange={(event) => setLeadSearchQuery(event.target.value)}
              placeholder="Szukaj leada / osoby (np. Gryla)…"
              disabled={sending}
            />
            {leadSearchLoading ? (
              <span style={{ fontSize: 11, color: '#666' }}>Szukam…</span>
            ) : null}
            {leadSearchHits.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  maxHeight: 160,
                  overflowY: 'auto',
                  border: '1px solid #eee',
                  borderRadius: 5,
                  background: '#fff',
                }}
              >
                {leadSearchHits.map((hit) => (
                  <button
                    key={`${hit.kind}-${hit.recordId}`}
                    type="button"
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      borderBottom: '1px solid #f3f3f3',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                    onClick={() => void applySearchHit(hit)}
                  >
                    <strong>{hit.label}</strong>
                    <span style={{ color: '#666' }}>
                      {' '}
                      · {hit.email}
                      {hit.kind === 'opportunity' ? ' · lead' : ' · osoba'}
                      {hit.companyName ? ` · ${hit.companyName}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            ) : leadSearchQuery.trim().length >= 2 && !leadSearchLoading ? (
              <span style={{ fontSize: 11, color: '#888' }}>
                Brak wyników dla „{leadSearchQuery.trim()}”
              </span>
            ) : null}
          </div>
        ) : null}
        {isReplyContext ? (
          <span style={{ fontSize: 11, color: '#166534' }}>
            Temat odpowiedzi: {toReplySubject(replySubject ?? '')}
          </span>
        ) : null}
      </div>
      ) : null}

      {selected?.id !== FREE_COMPOSE_TEMPLATE_ID && !composerExpanded ? (
      <div
        style={{
          overflowY: 'auto',
          flex: selected ? '0 0 auto' : 1,
          maxHeight: selected ? 120 : undefined,
          minHeight: 0,
        }}
      >
        {loadingList ? (
          <div style={{ padding: 20, color: '#999' }}>Ładuję szablony…</div>
        ) : visibleTemplates.length === 0 ? (
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
      ) : null}

      {selected && (
        <div
          className={composeSplitClassName}
          style={{
            borderTop: '1px solid #eee',
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: useWideSplit ? 'row' : 'column',
            overflow: 'hidden',
          }}
        >
          {showOriginalPane ? (
            <div
              className="owocni-mail-fs-left"
              style={
                useWideSplit
                  ? {
                      flex: '1 1 42%',
                      minWidth: 280,
                      maxWidth: '48%',
                      borderRight: '1px solid #e5e7eb',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      background: '#f8fafc',
                    }
                  : {
                      flex: '0 0 38%',
                      minWidth: 0,
                      maxWidth: 'none',
                      borderBottom: '1px solid #e5e7eb',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      background: '#f8fafc',
                    }
              }
            >
              <div
                style={{
                  flexShrink: 0,
                  padding: '12px 16px',
                  borderBottom: '1px solid #e2e8f0',
                  fontWeight: 600,
                  fontSize: 13,
                  color: '#1e3a8a',
                }}
              >
                Wiadomość, na którą odpowiadasz
              </div>
              <OriginalMessageBody
                replyMessage={replyMessage}
                replySubject={replySubject}
                fillHeight
              />
            </div>
          ) : null}
          <div
            className={composerExpanded ? 'owocni-mail-fs-right' : undefined}
            style={{
              flex: useWideSplit ? '1 1 58%' : 1,
              minHeight: 0,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: composerExpanded ? '#fff' : undefined,
            }}
          >
          <div
            style={{
              flexShrink: 0,
              maxHeight: composerExpanded ? undefined : '42%',
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
            }}
          >
          <div
            style={{
              padding: '12px 16px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
          {displayRecipientEmail ? (
            <div
              style={{
                padding: composerExpanded ? '6px 10px' : '8px 10px',
                borderRadius: 6,
                background: '#ecfdf5',
                border: '1px solid #86efac',
                fontSize: 13,
                color: '#14532d',
              }}
            >
              <strong>Odpowiedź do:</strong> {displayRecipientEmail}
              {person?.clientName ? (
                <span style={{ color: '#166534' }}>
                  {' '}
                  ({person.clientName}
                  {person.companyName ? ` · ${person.companyName}` : ''})
                </span>
              ) : null}
            </div>
          ) : null}
          {!composerExpanded && (replyMessage?.text || isReplyContext) ? (
            <details
              open={false}
              style={{
                border: '1px solid #dbeafe',
                borderRadius: 6,
                background: '#f8fafc',
                padding: '8px 10px',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                  color: '#1e3a8a',
                }}
              >
                Wiadomość, na którą odpowiadasz
                {replyMessage?.subject
                  ? ` · ${replyMessage.subject.slice(0, 48)}`
                  : replySubject
                    ? ` · ${toReplySubject(replySubject).slice(0, 48)}`
                    : ''}
              </summary>
              <OriginalMessageBody
                replyMessage={replyMessage}
                replySubject={replySubject}
              />
            </details>
          ) : null}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'flex-start',
            }}
          >
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                flex: 1,
                minWidth: 160,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 12, color: '#666' }}>
                Do
              </span>
              <input
                style={{
                  padding: '6px 8px',
                  border: `1px solid ${personEmail ? '#ddd' : '#f87171'}`,
                  borderRadius: 5,
                  fontSize: 13,
                }}
                value={displayRecipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                placeholder="email@klienta.pl"
                disabled={sending || sendCountdown !== null}
              />
              {!personEmail ? (
                <span style={{ fontSize: 11, color: '#b00020' }}>
                  Nie wykryto emaila — wybierz z listy ostatnich albo wpisz ręcznie.
                </span>
              ) : null}
            </label>

            {allowedSendAccounts.length > 0 ? (
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  flex: 1,
                  minWidth: 160,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 12, color: '#666' }}>
                  Od
                </span>
                <select
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #ddd',
                    borderRadius: 5,
                    fontSize: 13,
                    background: '#fff',
                  }}
                  value={connectedAccountId ?? ''}
                  onChange={(event) => {
                    const nextId = event.target.value || null;
                    const match = allowedSendAccounts.find(
                      (account) => account.id === nextId,
                    );
                    const nextHandle = match?.handle ?? null;

                    setConnectedAccountId(nextId);
                    setConnectedAccountHandle(nextHandle);
                    setEditBodyHtml((current) => {
                      const next = swapSignatureOnFromChange(
                        current,
                        nextHandle,
                      );

                      if (next !== current) {
                        queueMicrotask(() => {
                          editorRef.current?.setHtml(next);
                        });
                      }

                      return next;
                    });
                  }}
                  disabled={sending || sendCountdown !== null}
                >
                  {allowedSendAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.handle}
                    </option>
                  ))}
                </select>
              </label>
            ) : canSendEmail && connectedAccountHandle ? (
              <span
                style={{
                  fontSize: 12,
                  color: '#666',
                  paddingTop: 22,
                  flexShrink: 0,
                }}
              >
                Od: {connectedAccountHandle}
              </span>
            ) : null}
          </div>

          {!personEmail && recentRecipients.length > 0 ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 12, color: '#666' }}>
                Ostatni odbiorcy
              </span>
              <select
                style={{
                  padding: '6px 8px',
                  border: '1px solid #ddd',
                  borderRadius: 5,
                  fontSize: 13,
                }}
                defaultValue=""
                disabled={sending || sendCountdown !== null}
                onChange={(event) => {
                  const email = event.target.value;
                  const recipient = recentRecipients.find(
                    (entry) => entry.email === email,
                  );
                  if (recipient) {
                    applyRecentRecipient(recipient);
                  }
                }}
              >
                <option value="">Wybierz email…</option>
                {recentRecipients.map((recipient) => (
                  <option key={recipient.email} value={recipient.email}>
                    {recipient.email}
                    {recipient.subject ? ` — ${recipient.subject.slice(0, 40)}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

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
              {isReplyContext ? (
                <span style={{ fontWeight: 400, color: '#166534' }}>
                  {' '}
                  (z wątku — możesz zmienić)
                </span>
              ) : !subjectFromTemplate && editSubject ? (
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
              onChange={(event) => {
                subjectTouchedRef.current = true;
                setEditSubject(event.target.value);
              }}
              placeholder="Temat wiadomości"
              disabled={loadingDraft || sending || sendCountdown !== null}
            />
          </label>
          </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              padding: '0 16px 12px',
            }}
          >
            {loadingDraft ? (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
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
            ) : (
              <MailBodyEditor
                ref={editorRef}
                sessionId={editorSessionId}
                value={editBodyHtml}
                onChange={setEditBodyHtml}
                disabled={sending || sendCountdown !== null}
              />
            )}
          </div>

          <div
            style={{
              flexShrink: 0,
              padding: '12px 16px 16px',
              borderTop: '1px solid #eee',
              background: '#fff',
              position: 'relative',
              zIndex: 5,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
          {attachmentError ? (
            <div
              role="alert"
              style={{
                fontSize: 12,
                lineHeight: 1.4,
                color: '#b91c1c',
              }}
            >
              {attachmentError}
            </div>
          ) : null}
          {attachments.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              {attachments.map((file) => (
                <span
                  key={file.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    maxWidth: '100%',
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    fontSize: 12,
                    color: '#374151',
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 220,
                    }}
                    title={file.name}
                  >
                    {file.name}
                    {typeof file.size === 'number'
                      ? ` (${formatFileSize(file.size)})`
                      : ''}
                  </span>
                  <button
                    type="button"
                    aria-label={`Usuń ${file.name}`}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor:
                        sending || sendCountdown !== null
                          ? 'not-allowed'
                          : 'pointer',
                      color: '#6b7280',
                      padding: 0,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                    disabled={sending || sendCountdown !== null}
                    onClick={() => removeAttachment(file.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {sendCountdown !== null ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 12,
                background: '#fff7ed',
                border: '1px solid #fdba74',
                borderRadius: 6,
              }}
            >
              <span style={{ fontSize: 13, color: '#9a3412', fontWeight: 600 }}>
                Wysyłka za {sendCountdown}s
              </span>
              {editSubject.trim() ? (
                <span style={{ fontSize: 12, color: '#9a3412' }}>
                  Temat: {editSubject.trim()}
                </span>
              ) : null}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: sending ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                  disabled={sending}
                  onClick={sendNow}
                >
                  Wyślij teraz
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: '#fff',
                    color: '#9a3412',
                    border: '1px solid #fdba74',
                    borderRadius: 6,
                    cursor: sending ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                  disabled={sending}
                  onClick={cancelSendCountdown}
                >
                  Anuluj
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <div
                title="Dodaj załącznik"
                aria-label="Dodaj załącznik"
                style={{
                  width: 44,
                  flexShrink: 0,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: '#fff',
                  opacity: attachmentPickerDisabled ? 0.55 : 1,
                }}
              >
                {attachmentPickerSrcDoc ? (
                  <iframe
                    title="Dodaj załącznik"
                    srcDoc={attachmentPickerSrcDoc}
                    style={{
                      width: 44,
                      height: 42,
                      border: 'none',
                      display: 'block',
                      pointerEvents: attachmentPickerDisabled
                        ? 'none'
                        : 'auto',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 42,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9ca3af',
                      fontSize: 12,
                    }}
                  >
                    …
                  </div>
                )}
              </div>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background:
                    sending ||
                    !canSendEmail ||
                    loadingDraft ||
                    !personEmail ||
                    uploadingAttachments
                      ? '#999'
                      : '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor:
                    sending ||
                    !canSendEmail ||
                    loadingDraft ||
                    !personEmail ||
                    uploadingAttachments
                      ? 'not-allowed'
                      : 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                }}
                disabled={
                  sending ||
                  !canSendEmail ||
                  loadingDraft ||
                  !personEmail ||
                  uploadingAttachments
                }
                onClick={startSendCountdown}
              >
                {uploadingAttachments
                  ? 'Dodaję plik…'
                  : sending
                    ? 'Wysyłanie…'
                    : attachments.length > 0
                      ? `Wyślij email (${attachments.length})`
                      : 'Wyślij email'}
              </button>
            </div>
          )}
          </div>
        </div>
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
