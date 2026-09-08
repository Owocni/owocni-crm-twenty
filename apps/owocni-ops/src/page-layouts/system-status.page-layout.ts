import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  SYSTEM_STATUS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  SYSTEM_STATUS_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  SYSTEM_STATUS_LAYOUT_UNIVERSAL_IDENTIFIER,
  SYSTEM_STATUS_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default definePageLayout({
  universalIdentifier: SYSTEM_STATUS_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: APP_DISPLAY_NAME,
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: SYSTEM_STATUS_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Przegląd',
      position: 0,
      icon: 'IconHeartbeat',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: SYSTEM_STATUS_WIDGET_UNIVERSAL_IDENTIFIER,
          title: ' ',
          type: 'FRONT_COMPONENT',
          position: {
            layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
            index: 0,
          },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              SYSTEM_STATUS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
