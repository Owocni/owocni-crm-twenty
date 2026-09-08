import { beforeEach, describe, expect, it } from 'vitest';

import {
  breakOutToHostUrl,
  buildOpportunityRecordShowPath,
  buildOpportunityRecordShowUrl,
  consumeMailComposeIntent,
  hostHrefsWantMailCompose,
  hostRecordSurfaceFromHrefs,
  isSidePanelMailSurface,
  markMailComposeIntent,
  stripMailComposeQueryFromHref,
} from './hostMailContext';

describe('hostRecordSurfaceFromHrefs', () => {
  it('treats /object/opportunity/:id as the full record page', () => {
    expect(
      hostRecordSurfaceFromHrefs([
        'https://zany-maroon-panther.twenty.com/object/opportunity/7874c080-30c2-46c0-934c-905926d918e0',
      ]),
    ).toBe('show');
  });

  it('treats kanban /objects/opportunities as the side-panel host', () => {
    expect(
      hostRecordSurfaceFromHrefs([
        'https://zany-maroon-panther.twenty.com/objects/opportunities',
      ]),
    ).toBe('index');
  });

  it('treats kanban as index even if the iframe also has /object/…', () => {
    expect(
      hostRecordSurfaceFromHrefs([
        'https://zany-maroon-panther.twenty.com/objects/opportunities',
        'https://zany-maroon-panther.twenty.com/object/opportunity/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      ]),
    ).toBe('index');
  });

  it('treats the full record page as show when that href is first', () => {
    expect(
      hostRecordSurfaceFromHrefs([
        'https://zany-maroon-panther.twenty.com/object/opportunity/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?owocniCompose=1',
        'https://zany-maroon-panther.twenty.com/objects/opportunities',
      ]),
    ).toBe('show');
  });

  it('returns unknown when there is no Twenty path', () => {
    expect(hostRecordSurfaceFromHrefs(['https://example.com/'])).toBe('unknown');
  });
});

describe('consumeMailComposeIntent', () => {
  const recordId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    globalThis.sessionStorage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
      key: () => null,
      get length() {
        return memory.size;
      },
    } as Storage;
  });

  it('lets the full page after Odpowiedz open the composer once', () => {
    markMailComposeIntent(recordId);
    expect(consumeMailComposeIntent(recordId)).toBe(true);
    expect(consumeMailComposeIntent(recordId)).toBe(false);
  });

  it('does not reopen the composer on a later lead click', () => {
    markMailComposeIntent(recordId);
    const stored = JSON.parse(
      globalThis.sessionStorage.getItem('owocni-mail-compose-intent-v1') ?? '{}',
    ) as { recordId: string; at: number };
    stored.at = Date.now() - 60_000;
    globalThis.sessionStorage.setItem(
      'owocni-mail-compose-intent-v1',
      JSON.stringify(stored),
    );
    expect(consumeMailComposeIntent(recordId)).toBe(false);
    expect(consumeMailComposeIntent(recordId)).toBe(false);
  });
});

describe('hostHrefsWantMailCompose', () => {
  it('is true only after Odpowiedz added owocniCompose=1', () => {
    expect(
      hostHrefsWantMailCompose([
        'https://app.twenty.com/object/opportunity/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      ]),
    ).toBe(false);
    expect(
      hostHrefsWantMailCompose([
        'https://app.twenty.com/object/opportunity/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?owocniCompose=1',
      ]),
    ).toBe(true);
  });
});

describe('stripMailComposeQueryFromHref', () => {
  it('drops owocniCompose and keeps viewId plus mail tab hash', () => {
    expect(
      stripMailComposeQueryFromHref(
        'https://app.twenty.com/object/opportunity/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?owocniCompose=1&viewId=ba6ac841-c293-4744-855b-3a99ee135743#ccf6a315-7856-471d-8ed6-125f27d8ff96',
      ),
    ).toBe(
      'https://app.twenty.com/object/opportunity/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?viewId=ba6ac841-c293-4744-855b-3a99ee135743#ccf6a315-7856-471d-8ed6-125f27d8ff96',
    );
  });

  it('leaves URLs without the compose flag unchanged', () => {
    const href =
      'https://app.twenty.com/object/opportunity/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    expect(stripMailComposeQueryFromHref(href)).toBe(href);
  });
});

describe('breakOutToHostUrl', () => {
  it('is a no-op without a document (node / worker)', () => {
    expect(breakOutToHostUrl('https://example.com/object/opportunity/x')).toBe(
      false,
    );
  });
});

describe('buildOpportunityRecordShowUrl', () => {
  it('opens the full record URL with compose query', () => {
    expect(
      buildOpportunityRecordShowUrl(
        'https://zany-maroon-panther.twenty.com/',
        'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      ),
    ).toBe(
      'https://zany-maroon-panther.twenty.com/object/opportunity/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?owocniCompose=1&viewId=ba6ac841-c293-4744-855b-3a99ee135743#ccf6a315-7856-471d-8ed6-125f27d8ff96',
    );
  });

  it('builds a same-origin path the host <a> can follow', () => {
    expect(
      buildOpportunityRecordShowPath(
        'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      ),
    ).toBe(
      '/object/opportunity/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?owocniCompose=1&viewId=ba6ac841-c293-4744-855b-3a99ee135743#ccf6a315-7856-471d-8ed6-125f27d8ff96',
    );
  });
});

describe('isSidePanelMailSurface', () => {
  it('treats kanban index as the side panel even when wide', () => {
    expect(
      isSidePanelMailSurface({ surface: 'index', width: 1400 }),
    ).toBe(true);
  });

  it('treats /object/ show as the full page even when narrow', () => {
    expect(
      isSidePanelMailSurface({ surface: 'show', width: 400 }),
    ).toBe(false);
  });

  it('defaults unknown+narrow (typical FC sandbox in the drawer) to side panel', () => {
    expect(
      isSidePanelMailSurface({ surface: 'unknown', width: 420 }),
    ).toBe(true);
    expect(
      isSidePanelMailSurface({ surface: 'unknown', width: 0 }),
    ).toBe(true);
  });

  it('treats unknown+wide as the full record page', () => {
    expect(
      isSidePanelMailSurface({ surface: 'unknown', width: 960 }),
    ).toBe(false);
  });
});
