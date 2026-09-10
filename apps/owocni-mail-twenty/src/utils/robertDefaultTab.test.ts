import { beforeEach, describe, expect, it } from 'vitest';

import {
  OWOCNI_OPPORTUNITY_HOME_TAB_ID,
  OWOCNI_OPPORTUNITY_TASKS_TAB_ID,
  ROBERT_LOGIN_EMAIL,
  hasAppliedRobertDefaultTab,
  isRobertLogin,
  markRobertDefaultTabApplied,
  readCachedRobertIdentity,
  robertAppliedStorageKey,
  robertDefaultTabId,
  robertDefaultTabKind,
  writeCachedRobertIdentity,
} from './robertDefaultTab';

describe('isRobertLogin', () => {
  it('matches only robertmank@owocni.pl, ignoring case and space', () => {
    expect(isRobertLogin(ROBERT_LOGIN_EMAIL)).toBe(true);
    expect(isRobertLogin('  RobertMank@Owocni.pl  ')).toBe(true);
    expect(isRobertLogin('marta@owocni.pl')).toBe(false);
    expect(isRobertLogin('gosia@owocni.pl')).toBe(false);
    expect(isRobertLogin('owocni@gmail.com')).toBe(false);
    expect(isRobertLogin(null)).toBe(false);
    expect(isRobertLogin('')).toBe(false);
  });
});

describe('robertDefaultTabId', () => {
  it('opens Home for Nowy and Tasks for every other stage', () => {
    expect(robertDefaultTabKind('NEW')).toBe('home');
    expect(robertDefaultTabId('NEW')).toBe(OWOCNI_OPPORTUNITY_HOME_TAB_ID);
    expect(robertDefaultTabId('new')).toBe(OWOCNI_OPPORTUNITY_HOME_TAB_ID);
    expect(robertDefaultTabKind('CONTACTED')).toBe('tasks');
    expect(robertDefaultTabId('CONTACTED')).toBe(OWOCNI_OPPORTUNITY_TASKS_TAB_ID);
    expect(robertDefaultTabId('QUALIFIED')).toBe(OWOCNI_OPPORTUNITY_TASKS_TAB_ID);
    expect(robertDefaultTabId('WON')).toBe(OWOCNI_OPPORTUNITY_TASKS_TAB_ID);
  });

  it('stays on Mail when stage is missing', () => {
    expect(robertDefaultTabId(null)).toBeNull();
    expect(robertDefaultTabId('')).toBeNull();
    expect(robertDefaultTabId('   ')).toBeNull();
  });
});

describe('session cache', () => {
  const memory = new Map<string, string>();
  const storage: Pick<Storage, 'getItem' | 'setItem'> = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
  };

  beforeEach(() => {
    memory.clear();
  });

  it('remembers Robert identity per user, so impersonate does not inherit admin', () => {
    const adminId = 'admin-user';
    const robertId = 'robert-user';
    expect(readCachedRobertIdentity(null, storage)).toBeNull();
    writeCachedRobertIdentity(adminId, false, storage);
    expect(readCachedRobertIdentity(adminId, storage)).toBe(false);
    expect(readCachedRobertIdentity(robertId, storage)).toBeNull();
    writeCachedRobertIdentity(robertId, true, storage);
    expect(readCachedRobertIdentity(robertId, storage)).toBe(true);
    expect(readCachedRobertIdentity(adminId, storage)).toBe(false);
  });

  it('applies the tab switch once per lead per user', () => {
    const recordId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const robertId = 'robert-user';
    expect(robertAppliedStorageKey(recordId, robertId)).toContain(robertId);
    expect(hasAppliedRobertDefaultTab(recordId, robertId, storage)).toBe(false);
    markRobertDefaultTabApplied(recordId, robertId, storage);
    expect(hasAppliedRobertDefaultTab(recordId, robertId, storage)).toBe(true);
    expect(hasAppliedRobertDefaultTab(recordId, 'admin-user', storage)).toBe(
      false,
    );
  });
});
