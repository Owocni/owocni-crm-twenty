/**
 * Workspace entity IDs of the live „Owocni Opportunity” RECORD_PAGE tabs.
 * These are NOT the app universal identifiers — `openSidePanelPage({ tab })`
 * and the side-panel tab list use the stored pageLayoutTab.id.
 * Home matches `deploy_opportunity_record_page.py` HOME_TAB_ID.
 */
export const OWOCNI_OPPORTUNITY_HOME_TAB_ID =
  'f1159d4a-06ed-4934-a362-7b3991017c96';
export const OWOCNI_OPPORTUNITY_TASKS_TAB_ID =
  '235c65be-3ce3-450f-8eee-8d95c4ea6228';

export type RobertDefaultTabKind = 'home' | 'tasks';

/** Workspace login — only this mailbox gets a non-Mail default tab on the lejek. */
export const ROBERT_LOGIN_EMAIL = 'robertmank@owocni.pl';

export const ROBERT_DEFAULT_TAB_PATH = '/s/mail/robert-default-tab';

export const ROBERT_IDENTITY_STORAGE_KEY = 'owocni-robert-login-v1';
export const ROBERT_APPLIED_STORAGE_PREFIX = 'owocni-robert-tab-applied-v2:';

export function normalizeEmail(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function isRobertLogin(email: string | null | undefined): boolean {
  return normalizeEmail(email) === ROBERT_LOGIN_EMAIL;
}

/** Per-user keys so impersonate does not inherit “not Robert” from the admin session. */
export function robertIdentityStorageKey(
  userId: string | null | undefined,
): string | null {
  const id = String(userId || '').trim();
  return id ? `${ROBERT_IDENTITY_STORAGE_KEY}:${id}` : null;
}

export function robertAppliedStorageKey(
  recordId: string,
  userId?: string | null,
): string {
  const id = String(userId || '').trim();
  return id
    ? `${ROBERT_APPLIED_STORAGE_PREFIX}${id}:${recordId}`
    : `${ROBERT_APPLIED_STORAGE_PREFIX}${recordId}`;
}

export function robertDefaultTabKind(
  stage: string | null | undefined,
): RobertDefaultTabKind | null {
  const value = String(stage || '')
    .trim()
    .toUpperCase();

  if (!value) {
    return null;
  }

  return value === 'NEW' ? 'home' : 'tasks';
}

/**
 * Home for Nowy, Tasks for every other known stage.
 * Empty / unknown stage → null (stay on workspace default Mail).
 */
export function robertDefaultTabId(
  stage: string | null | undefined,
): string | null {
  const kind = robertDefaultTabKind(stage);

  if (kind === 'home') {
    return OWOCNI_OPPORTUNITY_HOME_TAB_ID;
  }

  if (kind === 'tasks') {
    return OWOCNI_OPPORTUNITY_TASKS_TAB_ID;
  }

  return null;
}

export type CachedRobertIdentity = boolean | null;

export function readCachedRobertIdentity(
  userId: string | null | undefined,
  storage: Pick<Storage, 'getItem'> | null | undefined = globalThis.sessionStorage,
): CachedRobertIdentity {
  const key = robertIdentityStorageKey(userId);
  if (!key) {
    return null;
  }

  try {
    const raw = storage?.getItem(key);
    if (raw === '1') {
      return true;
    }
    if (raw === '0') {
      return false;
    }
  } catch {
    // ignore
  }

  return null;
}

export function writeCachedRobertIdentity(
  userId: string | null | undefined,
  isRobert: boolean,
  storage: Pick<Storage, 'setItem'> | null | undefined = globalThis.sessionStorage,
): void {
  const key = robertIdentityStorageKey(userId);
  if (!key) {
    return;
  }

  try {
    storage?.setItem(key, isRobert ? '1' : '0');
  } catch {
    // ignore
  }
}

export function hasAppliedRobertDefaultTab(
  recordId: string,
  userId?: string | null,
  storage: Pick<Storage, 'getItem'> | null | undefined = globalThis.sessionStorage,
): boolean {
  if (!recordId) {
    return false;
  }

  try {
    return storage?.getItem(robertAppliedStorageKey(recordId, userId)) === '1';
  } catch {
    return false;
  }
}

export function markRobertDefaultTabApplied(
  recordId: string,
  userId?: string | null,
  storage: Pick<Storage, 'setItem'> | null | undefined = globalThis.sessionStorage,
): void {
  if (!recordId) {
    return;
  }

  try {
    storage?.setItem(robertAppliedStorageKey(recordId, userId), '1');
  } catch {
    // ignore
  }
}
