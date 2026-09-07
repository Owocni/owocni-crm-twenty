import { defineFrontComponent } from 'twenty-sdk/define';

import { REJECT_LEAD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { RejectLeadForm } from 'src/ui/opportunity-actions';

export default defineFrontComponent({
  universalIdentifier: REJECT_LEAD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'reject-lead',
  description: 'Formularz Odrzuć leada',
  component: RejectLeadForm,
});
