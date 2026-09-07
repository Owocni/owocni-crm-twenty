import { defineFrontComponent } from 'twenty-sdk/define';

import { OPPORTUNITY_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { TemplatePicker } from 'src/ui/mail-picker-app';

/**
 * Record-page surface: kanban side panel (thread + Reply) and full record page (composer).
 * Command-menu Odpowiedz keeps using template-picker.tsx directly (archive / rollback).
 */
const OpportunityMailPanel = () => <TemplatePicker surface="record-page" />;

export default defineFrontComponent({
  universalIdentifier: OPPORTUNITY_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'opportunity-mail-panel',
  description: 'Wątek i odpowiedź na karcie Opportunity',
  component: OpportunityMailPanel,
});
