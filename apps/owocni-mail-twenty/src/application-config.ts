import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  SMSAPI_OAUTH_TOKEN_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    SMSAPI_OAUTH_TOKEN: {
      universalIdentifier: SMSAPI_OAUTH_TOKEN_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Token OAuth SMSAPI (Bitwarden). Tylko funkcje serwerowe — nigdy composer.',
      isSecret: true,
    },
  },
});
