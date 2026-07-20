import {
  definePageLayoutTab,
  PageLayoutTabLayoutMode,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/template-picker';

/**
 * Tab on Opportunity record page — widget gets opportunity id from layout,
 * so Szablony work without Twenty command-menu selection (Kanban → lead).
 */
export default definePageLayoutTab({
  universalIdentifier: 'f1a2b3c4-d5e6-4789-a012-3456789abc01',
  pageLayoutUniversalIdentifier:
    STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.opportunityRecordPage
      .universalIdentifier,
  title: 'Szablony',
  position: 35,
  icon: 'IconMail',
  layoutMode: PageLayoutTabLayoutMode.CANVAS,
  widgets: [
    {
      universalIdentifier: 'f1a2b3c4-d5e6-4789-a012-3456789abc02',
      title: ' ',
      type: 'FRONT_COMPONENT',
      gridPosition: { row: 0, column: 0, rowSpan: 12, columnSpan: 12 },
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier:
          TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      },
    },
  ],
});
