import { defineCommandMenuItem } from 'twenty-sdk/define';

import { TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/template-picker';

export const MAIL_TEMPLATES_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '62d96e6c-f6b6-4a13-a61c-4275c443a189';

/**
 * Use INSTEAD of native Reply when you want a template.
 * Native Reply replaces the lead panel and clears record context.
 * RECORD_SELECTION → Twenty passes the open lead/thread id.
 */
export default defineCommandMenuItem({
  universalIdentifier: MAIL_TEMPLATES_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Odpisz szablonem',
  shortLabel: 'Szablon',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  frontComponentUniversalIdentifier: TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
