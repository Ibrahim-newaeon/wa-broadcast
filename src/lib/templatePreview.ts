// Pure helpers for previewing a template message — no DB/queue imports.

/**
 * Substitute {{n}} placeholders with the values entered on the broadcast form.
 * Missing/blank values keep the {{n}} placeholder so the operator can see
 * what's still unfilled.
 */
export function substituteTemplateVars(body: string, values: readonly (string | null | undefined)[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (raw, n: string) => {
    const v = values[Number(n) - 1]?.trim();
    return v ? v : raw;
  });
}

/**
 * Turn a broadcast-form variable entry into its preview display: a literal
 * shows as-is; a `field:xyz` mapping shows as a ⟨xyz⟩ token (the real value
 * differs per contact); blank stays blank (keeps the placeholder).
 */
export function previewVarValue(entry: string): string {
  const v = entry.trim();
  if (!v) return "";
  return v.startsWith("field:") ? `⟨${v.slice(6).trim() || "field"}⟩` : v;
}
