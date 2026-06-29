const PREVIEW_WRAPPER = (bodyHtml: string) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>
  html, body { margin: 0; padding: 0; background: #fff; }
  body { padding: 8px; overflow-x: auto; }
</style></head><body>${bodyHtml}</body></html>`;

type MailBodyPreviewProps = {
  bodyHtml: string;
  height?: number;
};

export const MailBodyPreview = ({
  bodyHtml,
  height = 300,
}: MailBodyPreviewProps) => {
  if (!bodyHtml.trim()) {
    return (
      <div
        style={{
          minHeight: height,
          padding: 10,
          border: '1px solid #eee',
          borderRadius: 6,
          color: '#999',
          fontSize: 12,
          background: '#fafafa',
        }}
      >
        Podgląd pojawi się po załadowaniu szablonu.
      </div>
    );
  }

  return (
    <iframe
      title="Podgląd wiadomości"
      srcDoc={PREVIEW_WRAPPER(bodyHtml)}
      style={{
        display: 'block',
        width: '100%',
        height,
        border: '1px solid #eee',
        borderRadius: 6,
        background: '#fff',
      }}
    />
  );
};
