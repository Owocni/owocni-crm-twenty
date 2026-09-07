import { defineFrontComponent } from 'twenty-sdk/define';

import { ACCEPT_SQL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { AcceptSqlCommand } from 'src/ui/opportunity-actions';

export default defineFrontComponent({
  universalIdentifier: ACCEPT_SQL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'accept-sql',
  description: 'Potwierdzenie Przyjmij jako SQL',
  isHeadless: true,
  component: AcceptSqlCommand,
});
