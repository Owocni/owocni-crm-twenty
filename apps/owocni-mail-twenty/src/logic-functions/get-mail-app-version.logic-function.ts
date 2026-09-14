import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { OWOCNI_MAIL_VERSION } from 'src/constants/appVersion';

/**
 * Live app version from the currently deployed logic-function bundle.
 * Front-component JS is cached immutably by checksum — this route is not.
 * Stale composer tabs compare and ask for Cmd+Shift+R.
 */
const handler = async (_event: RoutePayload) => {
  return {
    ok: true,
    version: OWOCNI_MAIL_VERSION,
  };
};

export default defineLogicFunction({
  universalIdentifier: 'e4b7c1a8-2d5f-4a9e-8c3b-1f6d9a0e2b47',
  name: 'get-mail-app-version',
  description: 'Returns the live Owocni Mail version so stale cached composers can reload',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/app-version',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
