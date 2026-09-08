import { defineFrontComponent } from 'twenty-sdk/define';

import { SIGNATURE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { SignatureEditorApp } from 'src/ui/signature-editor-app';

export default defineFrontComponent({
  universalIdentifier: SIGNATURE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'signature-editor',
  description: 'Edytor HTML stopki maila (kolory, Kod HTML)',
  component: SignatureEditorApp,
});
