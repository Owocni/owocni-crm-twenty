import { describe, expect, it } from 'vitest';

import { version as packageVersion } from '../../package.json';
import { OWOCNI_MAIL_VERSION } from 'src/constants/appVersion';
import {
  isStaleMailBundle,
  tryReloadStaleHost,
} from './staleMailBundle';

describe('staleMailBundle', () => {
  it('tracks package.json so deploys cannot forget to bump the baked version', () => {
    expect(OWOCNI_MAIL_VERSION).toBe(packageVersion);
    expect(OWOCNI_MAIL_VERSION.length).toBeGreaterThan(0);
  });

  it('treats a different server version as stale', () => {
    expect(isStaleMailBundle('0.1.142', '0.1.141')).toBe(true);
    expect(isStaleMailBundle('0.1.141', '0.1.141')).toBe(false);
    expect(isStaleMailBundle('', '0.1.141')).toBe(false);
    expect(isStaleMailBundle(undefined, '0.1.141')).toBe(false);
  });

  it('does not loop when the host URL already marks this reload', () => {
    const href = 'https://zany-maroon-panther.twenty.com/?owocniMailReload=0.1.142';
    const topWindow = {
      location: {
        href,
        replace: () => {
          throw new Error('must not replace again');
        },
      },
    } as unknown as Window;

    expect(tryReloadStaleHost('0.1.142', topWindow)).toBe('already-tried');
  });
});
