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
  hasAppliedRobertDefaultTab,
  markRobertDefaultTabApplied,
  readCachedRobertIdentity,
  ROBERT_DEFAULT_TAB_PATH,
  writeCachedRobertIdentity,
} from 'src/utils/robertDefaultTab';

type RobertTabResponse = {
  ok?: boolean;
  apply?: boolean;
  isRobert?: boolean;
  tabId?: string | null;
};

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
 * Robert lands on Home (Nowy) or Tasks (rest) when the Mail tab mounts
 * (workspace default). Everyone else keeps Mail. Fail-closed.
 *
 * Do not gate on host URL — the Mail FC iframe often cannot read parent
 * location, so a kanban check would skip the switch entirely.
 */
export function useRobertDefaultOpportunityTab(): boolean {
  const recordId = useSelectedRecordIds()[0] ?? null;
  const userId = useUserId();
  const [hideMail, setHideMail] = useState(
    () => readCachedRobertIdentity(userId) === true,
  );

  useEffect(() => {
    if (!recordId) {
      setHideMail(false);
      return;
    }

    if (hasAppliedRobertDefaultTab(recordId, userId)) {
      setHideMail(false);
      return;
    }

    const cached = readCachedRobertIdentity(userId);
    if (cached === false) {
      setHideMail(false);
      return;
    }

    let cancelled = false;
    if (cached === true) {
      setHideMail(true);
    }

    void (async () => {
      try {
        const client = new RestApiClient();
        const data = await client.get<RobertTabResponse>(ROBERT_DEFAULT_TAB_PATH, {
          query: { recordId },
        });

        if (cancelled) {
          return;
        }

        const apply = Boolean(data?.ok && data.apply && data.tabId);
        if (typeof data?.isRobert === 'boolean') {
          writeCachedRobertIdentity(userId, data.isRobert);
        }

        if (!apply || !data.tabId) {
          setHideMail(false);
          return;
        }

        setHideMail(true);
        await focusOpportunityTab(recordId, data.tabId);
        markRobertDefaultTabApplied(recordId, userId);
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
