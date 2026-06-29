import { defineView, ViewType } from 'twenty-sdk/define';

import {
  MAIL_TEMPLATE_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER,
  MAIL_TEMPLATE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
  MAIL_TEMPLATE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  MAIL_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MAIL_TEMPLATE_PRIORITY_FIELD_UNIVERSAL_IDENTIFIER,
  MAIL_TEMPLATE_SUBJECT_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/objects/mail-template.object';

export const ALL_MAIL_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER =
  '9e21e5dc-9645-4a5b-b500-c1bd2a031a41';

export default defineView({
  universalIdentifier: ALL_MAIL_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Wszystkie szablony',
  objectUniversalIdentifier: MAIL_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconMailFilled',
  position: 0,
  fields: [
    {
      universalIdentifier: '11111111-1111-4111-8111-111111111101',
      fieldMetadataUniversalIdentifier: MAIL_TEMPLATE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      position: 0,
      isVisible: true,
      size: 260,
    },
    {
      universalIdentifier: '11111111-1111-4111-8111-111111111102',
      fieldMetadataUniversalIdentifier: MAIL_TEMPLATE_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER,
      position: 1,
      isVisible: true,
      size: 120,
    },
    {
      universalIdentifier: '11111111-1111-4111-8111-111111111103',
      fieldMetadataUniversalIdentifier: MAIL_TEMPLATE_PRIORITY_FIELD_UNIVERSAL_IDENTIFIER,
      position: 2,
      isVisible: true,
      size: 90,
    },
    {
      universalIdentifier: '11111111-1111-4111-8111-111111111104',
      fieldMetadataUniversalIdentifier: MAIL_TEMPLATE_SUBJECT_FIELD_UNIVERSAL_IDENTIFIER,
      position: 3,
      isVisible: true,
      size: 320,
    },
    {
      universalIdentifier: '11111111-1111-4111-8111-111111111105',
      fieldMetadataUniversalIdentifier: MAIL_TEMPLATE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      position: 4,
      isVisible: true,
      size: 80,
    },
  ],
});
