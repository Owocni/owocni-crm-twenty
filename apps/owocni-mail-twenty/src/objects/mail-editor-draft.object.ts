import { defineObject, FieldType } from 'twenty-sdk/define';

/**
 * Ephemeral visual-editor drafts (sessionKey → htmlBody).
 * No navigation menu item — internal sync store only.
 */
export const MAIL_EDITOR_DRAFT_OBJECT_UNIVERSAL_IDENTIFIER =
  'b8c4e2f1-6a3d-4e9b-9c1f-7d2e5a8b0c4d';

export const MAIL_EDITOR_DRAFT_SESSION_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  'c1d5f3a2-7b4e-4f0c-8d2a-8e3f6b9c1d5e';

export const MAIL_EDITOR_DRAFT_HTML_BODY_FIELD_UNIVERSAL_IDENTIFIER =
  'd2e6a4b3-8c5f-401d-9e3b-9f4a7c0d2e6f';

export default defineObject({
  universalIdentifier: MAIL_EDITOR_DRAFT_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'mailEditorDraft',
  namePlural: 'mailEditorDrafts',
  labelSingular: 'Szkic edytora',
  labelPlural: 'Szkice edytora',
  description: 'Tymczasowe szkice treści z edytora wizualnego Owocni Mail',
  icon: 'IconFileText',
  labelIdentifierFieldMetadataUniversalIdentifier:
    MAIL_EDITOR_DRAFT_SESSION_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: MAIL_EDITOR_DRAFT_SESSION_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'sessionKey',
      type: FieldType.TEXT,
      label: 'Session key',
      description: 'Id sesji edytora (picker)',
      icon: 'IconKey',
    },
    {
      universalIdentifier: MAIL_EDITOR_DRAFT_HTML_BODY_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'htmlBody',
      type: FieldType.TEXT,
      label: 'HTML',
      description: 'Treść HTML ze szkicu edytora',
      icon: 'IconCode',
    },
  ],
});
