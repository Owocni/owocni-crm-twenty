import {
  defineCommandMenuItem,
  none,
  selectedRecords,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  ACCEPT_SQL_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  ACCEPT_SQL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: ACCEPT_SQL_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Przyjmij jako SQL',
  shortLabel: 'SQL',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  frontComponentUniversalIdentifier:
    ACCEPT_SQL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  // Hide after bizSqlConfirmed — native pinned workflows cannot do this.
  conditionalAvailabilityExpression: none(selectedRecords, 'bizSqlConfirmed'),
});
