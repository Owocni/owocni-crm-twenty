import { defineCommandMenuItem } from 'twenty-sdk/define';

import { TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/template-picker';

export const MAIL_TEMPLATES_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '62d96e6c-f6b6-4a13-a61c-4275c443a189';

export default defineCommandMenuItem({
  universalIdentifier: MAIL_TEMPLATES_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Szablony maili',
  shortLabel: 'Szablony',
  isPinned: true,
  availabilityType: 'GLOBAL_OBJECT_CONTEXT',
  frontComponentUniversalIdentifier: TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
