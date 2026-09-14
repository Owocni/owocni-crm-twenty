import { RestApiClient } from 'twenty-client-sdk/rest';
import { useEffect, useState } from 'react';
import {
  AppPath,
  openSidePanelPage,
  SidePanelPages,
  useSelectedRecordIds,
  useUserId,
} from 'twenty-sdk/front-component';

import {
  readCachedRobertIdentity,
  ROBERT_DEFAULT_TAB_PATH,
  writeCachedRobertIdentity,
} from 'src/utils/robertDefaultTab';

type RobertTabResponse = {
  ok?: boolean;
  apply?: boolean;
  isRobert?: boolean;
  tabId?: string | null;
  alreadyApplied?: boolean;
};

/** Survives effect re-runs in the same iframe; dies on Email remount (server last-lead decides). */
let lastHandledRecordId: string | null = null;

async function focusOpportunityTab(recordId: string, tabId: string): Promise<void> {
  try {
    await openSidePanelPage({
      to: AppPath.RecordShowPage,
      params: {
        objectNameSingular: 'opportunity',
        objectRecordId: recordId,
      },
      hash: tabId,
      resetNavigationStack: false,
    } as never);
    return;
  } catch {
    // Older host: ViewRecord + tab (already-open side panel).
  }

  await openSidePanelPage({
    page: SidePanelPages.ViewRecord,
    recordId,
    objectNameSingular: 'opportunity',
    resetNavigationStack: false,
    tab: tabId,
  } as never);
}

/**
 * Robert: first paint of a lead in the sidebar → Home (Nowy) or Tasks (rest).
 * After that he can open Email / any tab. Entering a *different* lead applies again.
 * Everyone else keeps Mail. Fail-closed.
 */
export function useRobertDefaultOpportunityTab(): boolean {
  const recordId = useSelectedRecordIds()[0] ?? null;
  const userId = useUserId();
  const [hideMail, setHideMail] = useState(false);

  useEffect(() => {
    if (!recordId) {
      lastHandledRecordId = null;
      setHideMail(false);
      return;
    }

    if (lastHandledRecordId === recordId) {
      setHideMail(false);
      return;
    }

    const cached = readCachedRobertIdentity(userId);
    if (cached === false) {
      lastHandledRecordId = recordId;
      setHideMail(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const client = new RestApiClient();
        const peek = await client.get<RobertTabResponse>(ROBERT_DEFAULT_TAB_PATH, {
          query: { recordId, _ts: String(Date.now()) },
        });

        if (cancelled) {
          return;
        }

        if (typeof peek?.isRobert === 'boolean') {
          writeCachedRobertIdentity(userId, peek.isRobert);
        }

        const apply = Boolean(peek?.ok && peek.apply && peek.tabId);
        if (!apply || !peek.tabId) {
          lastHandledRecordId = recordId;
          setHideMail(false);
          return;
        }

        await client.get<RobertTabResponse>(ROBERT_DEFAULT_TAB_PATH, {
          query: {
            recordId,
            commit: '1',
            _ts: String(Date.now()),
          },
        });

        if (cancelled) {
          return;
        }

        lastHandledRecordId = recordId;
        setHideMail(true);
        await focusOpportunityTab(recordId, peek.tabId);
      } catch {
        if (!cancelled) {
          setHideMail(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recordId, userId]);

  return hideMail;
}
