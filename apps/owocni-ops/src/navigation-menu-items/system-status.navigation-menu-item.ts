import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  SYSTEM_STATUS_LAYOUT_UNIVERSAL_IDENTIFIER,
  SYSTEM_STATUS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: SYSTEM_STATUS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: APP_DISPLAY_NAME,
  icon: 'IconHeartbeat',
  position: 20,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: SYSTEM_STATUS_LAYOUT_UNIVERSAL_IDENTIFIER,
});
