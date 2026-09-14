import { version as packageVersion } from '../../package.json';

/** Baked into every front-component bundle. Must match package.json (enforced by test). */
export const OWOCNI_MAIL_VERSION: string = packageVersion;

export const MAIL_APP_VERSION_PATH = '/s/mail/app-version';
export const STALE_BUNDLE_RELOAD_PARAM = 'owocniMailReload';
