import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { PersonContext } from 'src/utils/personContext';
import { toReplySubject } from 'src/utils/replySubject';

export const TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '2d49aa61-2a83-485b-856d-c3d26885cae5';

type MailTemplateSummary = {
  id: string;
  name: string;
  category: string;
  priority: string;
  subjectTemplate: string;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBodyHtml, setEditBodyHtml] = useState('');
  const [editorSessionId, setEditorSessionId] = useState(() => crypto.randomUUID());
  const editorRef = useRef<MailBodyEditorHandle>(null);
  const replySubjectRef = useRef<string | null>(null);
  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([]);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadSearchHits, setLeadSearchHits] = useState<RecipientSearchHit[]>([]);
  const [leadSearchLoading, setLeadSearchLoading] = useState(false);
  const [resolvedRecordId, setResolvedRecordId] = useState<string | null>(null);
  const [subjectFromTemplate, setSubjectFromTemplate] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendCountdown, setSendCountdown] = useState<number | null>(null);
  const sendCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const [draftError, setDraftError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const personEmail = recipientEmail.trim() || person?.email || '';
  const effectiveRecordId =
    person?.id && person.id !== 'scraped'
      ? person.id
      : resolvedRecordId || contextRecordId;
  const isReplyContext = Boolean(replySubject);

  replySubjectRef.current = replySubject;

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId],
  );

  // When Reply context arrives after template was already opened, force Re: subject.
  useEffect(() => {
    if (!replySubject || !selectedId) {
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
        } catch {
          // optional dropdown only
        }
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

    const loadReadiness = async () => {
      try {
        const client = new RestApiClient();
        const readiness = await client.get<SendReadinessResponse>(
          '/s/mail/send-readiness',
        );

        if (cancelled) {
          return;
        }

        setCanSendEmail(Boolean(readiness.canSend));
        setSendBlockedReason(readiness.reason ?? null);
        setConnectedAccountHandle(readiness.accountHandle ?? null);
        setConnectedAccountId(readiness.connectedAccountId ?? null);
      } catch {
        if (!cancelled) {
          setCanSendEmail(false);
          setSendBlockedReason(
            'Nie udało się sprawdzić konta email. Odśwież panel lub sprawdź Settings → Accounts.',
          );
        }
      }
    };

    void loadList();
    void loadReadiness();

    return () => {
      cancelled = true;
    };
  }, [
    contextRecordId,
    resolvedContext.source,
    resolvedContext.scrapedEmail,
    mergedSelectedIds.join(','),
  ]);

  const handleSelectTemplate = async (template: MailTemplateSummary) => {
    const nextSessionId = crypto.randomUUID();

    setSelectedId(template.id);
    setEditSubject('');
    setEditBodyHtml('');
    setEditorSessionId(nextSessionId);
    setDraftError(null);
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

      setEditBodyHtml(bodyHtml);
      setEditorSessionId(nextSessionId);

      // Seed server draft immediately (same LF memory the iframe will update).
      try {
        const bytes = new TextEncoder().encode(bodyHtml);
        let binary = '';
        for (const byte of bytes) {
          binary += String.fromCharCode(byte);
        }
        await client.post('/s/mail/editor-draft', {
          sessionId: nextSessionId,
          htmlBase64: btoa(binary),
          html: bodyHtml.slice(0, 50_000),
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

    const subject = (
      replySubjectRef.current
        ? toReplySubject(replySubjectRef.current)
        : editSubject
    ).trim() || editSubject.trim();

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
        recordId: effectiveRecordId ?? undefined,
        to: personEmail,
        subject,
        htmlBody: bodyHtml,
        htmlBodyBase64: encodeHtmlBodyBase64(bodyHtml),
        templateId: selected.id,
        connectedAccountId: connectedAccountId ?? undefined,
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

  const startSendCountdown = () => {
    if (!selected || !personEmail || sending || sendCountdown !== null) {
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
            Zamknij natywny Reply i użyj <strong>Szablon</strong> albo zakładki
            Szablony na leadzie.
          </span>
        ) : null}
      </div>

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

      {!selected ? (
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
            value={recipientEmail}
            onChange={(event) => {
              setRecipientEmail(event.target.value);
              setEmailSource('manual');
            }}
            placeholder="email@klienta.pl"
            disabled={sending}
          />
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

      <div
        style={{
          overflowY: 'auto',
          flex: selected ? '0 0 auto' : 1,
          maxHeight: selected ? 120 : undefined,
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
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              flexShrink: 0,
            }}
          >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 12, color: '#666' }}>
              Do
              {canSendEmail && connectedAccountHandle ? (
                <span style={{ fontWeight: 400, color: '#888' }}>
                  {' '}
                  · z: {connectedAccountHandle}
                </span>
              ) : null}
            </span>
            <input
              style={{
                padding: '6px 8px',
                border: `1px solid ${personEmail ? '#ddd' : '#f87171'}`,
                borderRadius: 5,
                fontSize: 13,
              }}
              value={recipientEmail}
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
                  (odpowiedź — z wątku)
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
              onChange={(event) => setEditSubject(event.target.value)}
              placeholder="Temat wiadomości"
              disabled={loadingDraft || sending || sendCountdown !== null}
            />
          </label>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              padding: '0 16px 8px',
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
            }}
          >
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
            <button
              type="button"
              style={{
                width: '100%',
                padding: '10px 12px',
                background:
                  sending || !canSendEmail || loadingDraft || !personEmail
                    ? '#999'
                    : '#4f46e5',
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
              onClick={startSendCountdown}
            >
              {sending ? 'Wysyłanie…' : 'Wyślij email'}
            </button>
          )}
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
