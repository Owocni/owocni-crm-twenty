import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  NEW_MAIL_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  NEW_MAIL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: NEW_MAIL_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Nowy mail',
  icon: 'IconSend',
  position: 0,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: NEW_MAIL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
