import { defineCommandMenuItem } from 'twenty-sdk/define';

import { TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/template-picker';

export const MAIL_TEMPLATES_GLOBAL_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  'c1d2e3f4-a5b6-4789-9012-3456789abcde';

/** Fallback when nothing is selected — restore pinned lead or search. */
export default defineCommandMenuItem({
  universalIdentifier:
    MAIL_TEMPLATES_GLOBAL_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Szablony maili',
  shortLabel: 'Szablony',
  isPinned: false,
  availabilityType: 'GLOBAL',
  frontComponentUniversalIdentifier:
    TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
