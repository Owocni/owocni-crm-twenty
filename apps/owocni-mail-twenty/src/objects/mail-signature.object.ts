import { defineObject, FieldType } from 'twenty-sdk/define';

export const MAIL_SIGNATURE_OBJECT_UNIVERSAL_IDENTIFIER =
  'e53351e3-10b5-4fb8-a44b-072c7be42bb0';

export const MAIL_SIGNATURE_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  'a4390535-ba76-4ebb-8d8c-75a426ad44e3';

export const MAIL_SIGNATURE_MAILBOX_HANDLE_FIELD_UNIVERSAL_IDENTIFIER =
  '188fe2dc-1085-4a78-b682-854f404d4e6d';

export const MAIL_SIGNATURE_BODY_FIELD_UNIVERSAL_IDENTIFIER =
  '5fb3ec43-3c39-465d-9248-f1347b6c17f0';

export const MAIL_SIGNATURE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER =
  '26aac222-901e-4dd3-92bc-42b2c3f0b592';

export default defineObject({
  universalIdentifier: MAIL_SIGNATURE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'mailSignature',
  namePlural: 'mailSignatures',
  labelSingular: 'Stopka maila',
  labelPlural: 'Stopki maili',
  description:
    'Stopka wstawiana do edytora Owocni Mail według skrzynki Nadawcy. Każdy edytuje swoją tutaj — nie w Szablonach maili.',
  icon: 'IconPencil',
  labelIdentifierFieldMetadataUniversalIdentifier:
    MAIL_SIGNATURE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: MAIL_SIGNATURE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'name',
      type: FieldType.TEXT,
      label: 'Osoba',
      description: 'Kto jest na stopce (np. Marta Słowik)',
      icon: 'IconAbc',
    },
    {
      universalIdentifier:
        MAIL_SIGNATURE_MAILBOX_HANDLE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'mailboxHandle',
      type: FieldType.TEXT,
      label: 'Skrzynki',
      description:
        'Adres Od, do którego należy stopka. Kilka skrzynek: rozdziel przecinkiem (np. studio@owocni.pl, leads@owocni.pl)',
      icon: 'IconMail',
    },
    {
      universalIdentifier: MAIL_SIGNATURE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'bodyHtml',
      type: FieldType.RICH_TEXT,
      label: 'Treść (nie edytować tutaj)',
      description:
        'Nie klikać ołówka. Edycja tylko w zakładce Stopka — pełny edytor HTML.',
      icon: 'IconCode',
    },
    {
      universalIdentifier: MAIL_SIGNATURE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'isActive',
      type: FieldType.BOOLEAN,
      label: 'Aktywna',
      icon: 'IconCheck',
      defaultValue: "'true'",
    },
  ],
});
