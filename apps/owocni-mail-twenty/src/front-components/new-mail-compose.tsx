import { defineFrontComponent } from 'twenty-sdk/define';

import { NEW_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { TemplatePicker } from 'src/ui/mail-picker-app';

/**
 * Blank composer v2 — new thread, no Re: / In-Reply-To.
 * Left-nav page, Opportunity tab, and ⌘K „Nowy mail”.
 */
const NewMailCompose = () => <TemplatePicker surface="compose" />;

export default defineFrontComponent({
  universalIdentifier: NEW_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'new-mail-compose',
  description: 'Nowy mail z composera Owocni — bez odpowiedzi na wątek',
  component: NewMailCompose,
});
