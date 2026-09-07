import { defineFrontComponent } from 'twenty-sdk/define';

import { OPPORTUNITY_ACTIONS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { OpportunityActionsStrip } from 'src/ui/opportunity-actions';

const OpportunityActions = () => <OpportunityActionsStrip />;

export default defineFrontComponent({
  universalIdentifier: OPPORTUNITY_ACTIONS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'opportunity-actions',
  description: 'Przyjmij SQL / odrzuć leada — znika albo robi się nieaktywny',
  component: OpportunityActions,
});
