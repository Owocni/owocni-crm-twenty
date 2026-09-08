import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import { MAIL_SIGNATURE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/objects/mail-signature.object';

export const MAIL_SIGNATURES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '14c58f38-4c0e-4f43-a591-d64cb22fa40d';

export default defineNavigationMenuItem({
  universalIdentifier:
    MAIL_SIGNATURES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Stopki maili',
  icon: 'IconPencil',
  position: 2,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: MAIL_SIGNATURE_OBJECT_UNIVERSAL_IDENTIFIER,
});
