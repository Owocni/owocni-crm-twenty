import {
  definePageLayout,
  PageLayoutTabLayoutMode,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  MAILBOX_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MESSAGE_THREAD_MAIL_TAB_UNIVERSAL_IDENTIFIER,
  MESSAGE_THREAD_MAIL_WIDGET_UNIVERSAL_IDENTIFIER,
  MESSAGE_THREAD_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/**
 * Same as Message / Opportunity Mail: CANVAS, not GRID.
 */
export default definePageLayout({
  universalIdentifier: MESSAGE_THREAD_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Owocni Wątek',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.messageThread.universalIdentifier,
  defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier:
    MESSAGE_THREAD_MAIL_TAB_UNIVERSAL_IDENTIFIER,
  tabs: [
    {
      universalIdentifier: MESSAGE_THREAD_MAIL_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Mail',
      position: 10,
      icon: 'IconMail',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier: MESSAGE_THREAD_MAIL_WIDGET_UNIVERSAL_IDENTIFIER,
          title: ' ',
          type: 'FRONT_COMPONENT',
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
