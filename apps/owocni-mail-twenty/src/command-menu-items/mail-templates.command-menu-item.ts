import { defineCommandMenuItem } from 'twenty-sdk/define';

import { TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/template-picker';

export const MAIL_TEMPLATES_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '62d96e6c-f6b6-4a13-a61c-4275c443a189';

/**
 * ADR #22: normal reply from own mailbox (default free compose).
 * Native Twenty Reply on leads@ threads stays broken — use this instead.
 * Archive: kanban side panel uses opportunity-mail-panel (RECORD_PAGE).
 * This command item stays as rollback / fallback composer.
 */
export default defineCommandMenuItem({
  universalIdentifier: MAIL_TEMPLATES_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Odpowiedz',
  shortLabel: 'Odpowiedz',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  frontComponentUniversalIdentifier: TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
