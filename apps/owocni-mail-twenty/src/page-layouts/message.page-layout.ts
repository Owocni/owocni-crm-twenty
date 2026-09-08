import {
  definePageLayout,
  PageLayoutTabLayoutMode,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  MAILBOX_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MESSAGE_MAIL_TAB_UNIVERSAL_IDENTIFIER,
  MESSAGE_MAIL_WIDGET_UNIVERSAL_IDENTIFIER,
  MESSAGE_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/**
 * Message has no system RECORD_PAGE. CANVAS without a full-height widget
 * shows Twenty's empty-grid "Brak danych" when opening the row via ↗.
 * Deploy converts CANVAS+gridPosition to GRID so the panel fills.
 */
export default definePageLayout({
  universalIdentifier: MESSAGE_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Owocni Poczta',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.message.universalIdentifier,
  defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier:
    MESSAGE_MAIL_TAB_UNIVERSAL_IDENTIFIER,
  tabs: [
    {
      universalIdentifier: MESSAGE_MAIL_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Mail',
      position: 10,
      icon: 'IconMail',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier: MESSAGE_MAIL_WIDGET_UNIVERSAL_IDENTIFIER,
          title: ' ',
          type: 'FRONT_COMPONENT',
          gridPosition: { row: 0, column: 0, rowSpan: 12, columnSpan: 12 },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              MAILBOX_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
