import { defineFrontComponent } from 'twenty-sdk/define';

import { MAILBOX_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { TemplatePicker } from 'src/ui/mail-picker-app';

/**
 * Record-page surface for Poczta (Message). Peek + Odpowiedz in the side panel.
 * Do not reuse opportunity-mail-panel — that Odpowiedz navigates to a lead.
 */
const MailboxMailPanel = () => <TemplatePicker surface="mailbox-record" />;

export default defineFrontComponent({
  universalIdentifier: MAILBOX_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'mailbox-mail-panel',
  description: 'Wątek i odpowiedź w Poczcie',
  component: MailboxMailPanel,
});
