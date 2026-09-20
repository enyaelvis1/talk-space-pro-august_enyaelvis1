export function sanitizeContentHtml(value: string | null | undefined) {
  if (!value) return "";

  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(?:script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed|form)>/gi,
      "",
    )
    .replace(/<\/?(?:script|style|iframe|object|embed|form)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:style|srcset|sizes)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, "");
}

export function cleanLegacyPostBodyHtml(value: string | null | undefined) {
  if (!value) return "";
  if (!/data-elementor-type=(["'])wp-post\1/i.test(value)) return value;

  const textWidget = /<div\b[^>]*\belementor-widget-text-editor\b[^>]*>/i.exec(value);
  if (!textWidget) return value;

  const start = textWidget.index + textWidget[0].length;
  const end = [
    value.search(/<div\b[^>]*\belementor-widget-post-info\b[^>]*>/i),
    value.search(/<h[1-6]\b[^>]*>\s*Share:\s*<\/h[1-6]>/i),
    value.search(/<div\b[^>]*\belementor-widget-social-icons\b[^>]*>/i),
  ]
    .filter((index) => index > start)
    .sort((a, b) => a - b)[0];

  const articleHtml = value.slice(start, end ?? value.length);

  return articleHtml
    .replace(
      /<li\b[^>]*style=(["'])[^"']*list-style-type:\s*none[^"']*\1[^>]*>\s*<ul\b[^>]*>\s*<li\b([^>]*)>/gi,
      "<li$2>",
    )
    .replace(/<\/li>\s*<\/ul>\s*<\/li>/gi, "</li>")
    .replace(/<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "")
    .replace(/<\/ul>\s*<ul\b[^>]*>/gi, "")
    .replace(/(?:\s*<\/div>\s*)+$/i, "")
    .trim();
}
