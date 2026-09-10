import { defineFrontComponent } from 'twenty-sdk/define';

import { OPPORTUNITY_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { TemplatePicker } from 'src/ui/mail-picker-app';
import { useRobertDefaultOpportunityTab } from 'src/ui/robert-default-tab';

/**
 * Record-page surface: kanban side panel (thread + Reply) and full record page (composer).
 * Command-menu Odpowiedz keeps using template-picker.tsx directly (archive / rollback).
 * Robert-only: kanban side panel may leave this Mail tab for Home/Tasks.
 */
const OpportunityMailPanel = () => {
  const hideMail = useRobertDefaultOpportunityTab();

  if (hideMail) {
    return null;
  }

  return <TemplatePicker surface="record-page" />;
};

export default defineFrontComponent({
  universalIdentifier: OPPORTUNITY_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'opportunity-mail-panel',
  description: 'Wątek i odpowiedź na karcie Opportunity',
  component: OpportunityMailPanel,
});
