import { defineCommandMenuItem } from 'twenty-sdk/define';

import { TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/template-picker';

export const MAIL_TEMPLATES_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '62d96e6c-f6b6-4a13-a61c-4275c443a189';

/**
 * ADR #22: Poczta pinned action. Clicking a message shows thread peek
 * (same as leads) then Odpowiedz opens the split composer.
 * Native Twenty Reply on leads@ threads stays broken — use this instead.
 */
export default defineCommandMenuItem({
  universalIdentifier: MAIL_TEMPLATES_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Odpowiedz',
  shortLabel: 'Odpowiedz',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  frontComponentUniversalIdentifier: TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
