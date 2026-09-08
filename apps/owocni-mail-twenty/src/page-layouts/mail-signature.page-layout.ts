import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  MAIL_SIGNATURE_EDITOR_TAB_UNIVERSAL_IDENTIFIER,
  MAIL_SIGNATURE_EDITOR_WIDGET_UNIVERSAL_IDENTIFIER,
  MAIL_SIGNATURE_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  SIGNATURE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { MAIL_SIGNATURE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/objects/mail-signature.object';

export default definePageLayout({
  universalIdentifier: MAIL_SIGNATURE_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Owocni Stopka',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: MAIL_SIGNATURE_OBJECT_UNIVERSAL_IDENTIFIER,
  defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier:
    MAIL_SIGNATURE_EDITOR_TAB_UNIVERSAL_IDENTIFIER,
  tabs: [
    {
      universalIdentifier: MAIL_SIGNATURE_EDITOR_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Stopka',
      position: 0,
      icon: 'IconPencil',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier: MAIL_SIGNATURE_EDITOR_WIDGET_UNIVERSAL_IDENTIFIER,
          title: ' ',
          type: 'FRONT_COMPONENT',
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              SIGNATURE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
