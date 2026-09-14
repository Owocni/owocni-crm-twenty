import { defineCommandMenuItem } from 'twenty-sdk/define';

import {
  NEW_MAIL_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  NEW_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/** Always available — compose a new thread without opening Odpowiedz. */
export default defineCommandMenuItem({
  universalIdentifier: NEW_MAIL_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Nowy mail',
  shortLabel: 'Nowy mail',
  isPinned: false,
  availabilityType: 'GLOBAL',
  frontComponentUniversalIdentifier:
    NEW_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
