export const EDITOR_DRAFT_PATH = '/s/mail/editor-draft';

export function resolveEditorDraftUrl(): string {
  const origin = globalThis.location?.origin?.trim();

  if (origin) {
    return `${origin}${EDITOR_DRAFT_PATH}`;
  }

  return EDITOR_DRAFT_PATH;
}
