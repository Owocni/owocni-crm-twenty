import { defineObject, FieldType } from 'twenty-sdk/define';

export const MAIL_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER =
  'c38703a1-64df-4241-92d6-dd333304fe47';

export const MAIL_TEMPLATE_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  'a97420cb-fe55-41d5-93b7-5f4d033290db';

export const MAIL_TEMPLATE_SUBJECT_FIELD_UNIVERSAL_IDENTIFIER =
  '7b74d470-0f53-4b03-af1a-a5feb0b55c3f';

export const MAIL_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER =
  '3b30bbdc-c9b1-4e20-a5fc-c283469a8ecd';

export const MAIL_TEMPLATE_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER =
  '2bd64c1f-8092-4590-ad31-23c23006cb3e';

export const MAIL_TEMPLATE_PRIORITY_FIELD_UNIVERSAL_IDENTIFIER =
  '738100ce-e0c4-49f2-a6ec-667a898c37f0';

export const MAIL_TEMPLATE_LEGACY_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '6cb696b1-e2bc-4ff0-868f-73b2f36c8e33';

export const MAIL_TEMPLATE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER =
  '484250d8-f784-42cf-96e7-8ed7efe286e5';

enum MailTemplateCategory {
  SALES = 'SALES',
  WEBSITE = 'WEBSITE',
  HELPDESK = 'HELPDESK',
  LOGO = 'LOGO',
  NAME = 'NAME',
  INVOICE = 'INVOICE',
  CUSTOMER_SERVICE = 'CUSTOMER_SERVICE',
  REMINDER = 'REMINDER',
  GENERAL = 'GENERAL',
}

enum MailTemplatePriority {
  MUST = 'MUST',
  NICE = 'NICE',
}

export default defineObject({
  universalIdentifier: MAIL_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'mailTemplate',
  namePlural: 'mailTemplates',
  labelSingular: 'Szablon maila',
  labelPlural: 'Szablony maili',
  description: 'Szablony maili do użycia przez handlowców Owocni',
  icon: 'IconMailFilled',
  labelIdentifierFieldMetadataUniversalIdentifier:
    MAIL_TEMPLATE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: MAIL_TEMPLATE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'name',
      type: FieldType.TEXT,
      label: 'Nazwa',
      description: 'Nazwa szablonu widoczna w pickerze',
      icon: 'IconAbc',
    },
    {
      universalIdentifier: MAIL_TEMPLATE_SUBJECT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'subjectTemplate',
      type: FieldType.TEXT,
      label: 'Temat',
      description: 'Temat maila; zmienne: {{firstName}}, {{companyName}}',
      icon: 'IconLetterCase',
    },
    {
      universalIdentifier: MAIL_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'bodyHtmlTemplate',
      type: FieldType.RICH_TEXT,
      label: 'Treść HTML',
      description: 'Treść maila z placeholderami',
      icon: 'IconCode',
    },
    {
      universalIdentifier: MAIL_TEMPLATE_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'category',
      type: FieldType.SELECT,
      label: 'Kategoria',
      icon: 'IconTag',
      defaultValue: `'${MailTemplateCategory.GENERAL}'`,
      options: [
        {
          id: '7cabf645-74c6-4c88-8c59-e3b003b6da76',
          value: MailTemplateCategory.SALES,
          label: 'Sprzedaż',
          position: 0,
          color: 'green',
        },
        {
          id: 'eb5744fd-b687-4804-9fa3-ee3783bb7ee0',
          value: MailTemplateCategory.WEBSITE,
          label: 'Strona',
          position: 1,
          color: 'blue',
        },
        {
          id: '740a0f89-19e6-4640-b783-73b26aa24620',
          value: MailTemplateCategory.HELPDESK,
          label: 'Helpdesk',
          position: 2,
          color: 'orange',
        },
        {
          id: '6ca154dc-bfaf-4196-9bee-20013c9f3d47',
          value: MailTemplateCategory.LOGO,
          label: 'Logo',
          position: 3,
          color: 'purple',
        },
        {
          id: '943ca5b1-b6c4-4c64-a54d-04044106d8f7',
          value: MailTemplateCategory.NAME,
          label: 'Nazwa',
          position: 4,
          color: 'pink',
        },
        {
          id: 'ed9cd3d4-f511-40bf-9046-bcd9e56e1a81',
          value: MailTemplateCategory.INVOICE,
          label: 'Faktura',
          position: 5,
          color: 'yellow',
        },
        {
          id: '5ad8104a-3578-4306-9f63-6fad5c320903',
          value: MailTemplateCategory.CUSTOMER_SERVICE,
          label: 'Obsługa',
          position: 6,
          color: 'turquoise',
        },
        {
          id: '0e16b82c-9f69-4376-a69a-30637742f653',
          value: MailTemplateCategory.REMINDER,
          label: 'Przypominajka',
          position: 7,
          color: 'red',
        },
        {
          id: 'f8a1b2c3-d4e5-4789-a8cd-ef0123456789',
          value: MailTemplateCategory.GENERAL,
          label: 'Ogólne',
          position: 8,
          color: 'gray',
        },
      ],
    },
    {
      universalIdentifier: MAIL_TEMPLATE_PRIORITY_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'priority',
      type: FieldType.SELECT,
      label: 'Priorytet',
      icon: 'IconStar',
      defaultValue: `'${MailTemplatePriority.NICE}'`,
      options: [
        {
          id: 'a1b2c3d4-e5f6-4789-a8cd-ef0123456701',
          value: MailTemplatePriority.MUST,
          label: 'MUST',
          position: 0,
          color: 'red',
        },
        {
          id: 'a1b2c3d4-e5f6-4789-a8cd-ef0123456702',
          value: MailTemplatePriority.NICE,
          label: 'NICE',
          position: 1,
          color: 'blue',
        },
      ],
    },
    {
      universalIdentifier: MAIL_TEMPLATE_LEGACY_ID_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'legacyId',
      type: FieldType.NUMBER,
      label: 'BB Legacy ID',
      description: 'ID z better-bitrix (ślad migracji)',
      icon: 'IconHash',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: MAIL_TEMPLATE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'isActive',
      type: FieldType.BOOLEAN,
      label: 'Aktywny',
      icon: 'IconCheck',
      defaultValue: "'true'",
    },
  ],
});
