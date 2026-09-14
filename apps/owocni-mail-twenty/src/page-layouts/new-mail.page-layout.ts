import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  NEW_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  NEW_MAIL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  NEW_MAIL_PAGE_TAB_UNIVERSAL_IDENTIFIER,
  NEW_MAIL_PAGE_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default definePageLayout({
  universalIdentifier: NEW_MAIL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Nowy mail',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: NEW_MAIL_PAGE_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Nowy mail',
      position: 0,
      icon: 'IconSend',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier: NEW_MAIL_PAGE_WIDGET_UNIVERSAL_IDENTIFIER,
          title: ' ',
          type: 'FRONT_COMPONENT',
          gridPosition: { row: 0, column: 0, rowSpan: 12, columnSpan: 12 },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              NEW_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
