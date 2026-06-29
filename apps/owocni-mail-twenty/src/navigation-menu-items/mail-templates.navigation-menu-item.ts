import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import { MAIL_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/objects/mail-template.object';

export const MAIL_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '03f918bf-811d-414a-8fdd-d9dde2bcff29';

export default defineNavigationMenuItem({
  universalIdentifier: MAIL_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Szablony maili',
  icon: 'IconMailFilled',
  position: 1,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: MAIL_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
});
