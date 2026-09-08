import { defineView, ViewOpenRecordIn, ViewType } from 'twenty-sdk/define';

import {
  MAIL_SIGNATURE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
  MAIL_SIGNATURE_MAILBOX_HANDLE_FIELD_UNIVERSAL_IDENTIFIER,
  MAIL_SIGNATURE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  MAIL_SIGNATURE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/objects/mail-signature.object';

export const ALL_MAIL_SIGNATURES_VIEW_UNIVERSAL_IDENTIFIER =
  '3cc220b0-ed47-4418-a524-749f9016a72c';

export default defineView({
  universalIdentifier: ALL_MAIL_SIGNATURES_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Wszystkie stopki',
  objectUniversalIdentifier: MAIL_SIGNATURE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconPencil',
  position: 0,
  openRecordIn: ViewOpenRecordIn.RECORD_PAGE,
  fields: [
    {
      universalIdentifier: '7c4c4759-4dc0-49f7-8215-d051607c0248',
      fieldMetadataUniversalIdentifier:
        MAIL_SIGNATURE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      position: 0,
      isVisible: true,
      size: 220,
    },
    {
      universalIdentifier: 'c0b0e597-63b5-4008-aa12-9d5c08a5b503',
      fieldMetadataUniversalIdentifier:
        MAIL_SIGNATURE_MAILBOX_HANDLE_FIELD_UNIVERSAL_IDENTIFIER,
      position: 1,
      isVisible: true,
      size: 320,
    },
    {
      universalIdentifier: '029baaca-e0c8-4bf0-96d5-ee42cca03d1c',
      fieldMetadataUniversalIdentifier:
        MAIL_SIGNATURE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      position: 2,
      isVisible: true,
      size: 90,
    },
  ],
});
