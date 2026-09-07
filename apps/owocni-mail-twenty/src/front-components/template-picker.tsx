import { defineFrontComponent } from 'twenty-sdk/define';

import {
  TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  TemplatePicker,
} from 'src/ui/mail-picker-app';

export {
  FREE_COMPOSE_TEMPLATE_ID,
  TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  TemplatePicker,
} from 'src/ui/mail-picker-app';

export default defineFrontComponent({
  universalIdentifier: TEMPLATE_PICKER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'template-picker',
  description: 'Picker szablonów maili Owocni',
  component: TemplatePicker,
});
