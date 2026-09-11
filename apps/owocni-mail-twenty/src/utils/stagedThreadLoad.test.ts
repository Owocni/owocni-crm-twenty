import { describe, expect, it } from 'vitest';

import {
  hrefsWantFullMailLoad,
  shouldUseStagedThreadLoad,
} from './stagedThreadLoad';

describe('hrefsWantFullMailLoad', () => {
  it('trips on owocniMailLoad=full', () => {
    expect(
      hrefsWantFullMailLoad([
        'https://zany-maroon-panther.twenty.com/objects/opportunities?owocniMailLoad=full',
      ]),
    ).toBe(true);
  });

  it('ignores compose-only query', () => {
    expect(
      hrefsWantFullMailLoad([
        'https://zany-maroon-panther.twenty.com/object/opportunity/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?owocniCompose=1',
      ]),
    ).toBe(false);
  });
});

describe('shouldUseStagedThreadLoad', () => {
  const kanban = [
    'https://zany-maroon-panther.twenty.com/objects/opportunities',
  ];

  it('runs on the record Mail tab by default', () => {
    expect(
      shouldUseStagedThreadLoad({
        onRecordSurface: true,
        hrefs: kanban,
      }),
    ).toBe(true);
  });

  it('stays off in the command-menu picker', () => {
    expect(
      shouldUseStagedThreadLoad({
        onRecordSurface: false,
        hrefs: kanban,
      }),
    ).toBe(false);
  });

  it('rolls back when the constant is off', () => {
    expect(
      shouldUseStagedThreadLoad({
        enabled: false,
        onRecordSurface: true,
        hrefs: kanban,
      }),
    ).toBe(false);
  });

  it('rolls back with ?owocniMailLoad=full', () => {
    expect(
      shouldUseStagedThreadLoad({
        onRecordSurface: true,
        hrefs: [
          'https://zany-maroon-panther.twenty.com/objects/opportunities?owocniMailLoad=full',
        ],
      }),
    ).toBe(false);
  });
});
