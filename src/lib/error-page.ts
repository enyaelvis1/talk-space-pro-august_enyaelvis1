function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ErrorPageDetail = {
  message: string;
  name?: string;
  stack?: string;
  cause?: string;
  path?: string;
};

// Turns whatever was thrown (Error, Response, string, object) into readable detail.
export function describeError(error: unknown, path?: string): ErrorPageDetail {
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    return {
      name: error.name,
      message: error.message || String(error),
      ...(error.stack ? { stack: error.stack } : {}),
      ...(cause ? { cause: cause instanceof Error ? cause.message : String(cause) } : {}),
      ...(path ? { path } : {}),
    };
  }
  if (error instanceof Response) {
    return {
      name: "Response",
      message: `HTTP ${error.status} ${error.statusText}${error.url ? ` at ${error.url}` : ""}`,
      ...(path ? { path } : {}),
    };
  }
  if (typeof error === "string") {
    return { name: "Error", message: error, ...(path ? { path } : {}) };
  }
  let message: string;
  try {
    message = JSON.stringify(error);
  } catch {
    message = String(error);
  }
  return { name: "Error", message: message ?? "Unknown error", ...(path ? { path } : {}) };
}

export function renderErrorPage(detail?: ErrorPageDetail): string {
  const headline = detail?.message
    ? escapeHtml(detail.message)
    : "Something went wrong on our end.";
  const meta = [
    detail?.name ? `Type: ${detail.name}` : "",
    detail?.path ? `Request: ${detail.path}` : "",
    detail?.cause ? `Cause: ${detail.cause}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const trace = [meta, detail?.stack ?? ""].filter(Boolean).join("\n\n").trim();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 44rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.25rem; }
      .msg { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; text-align: left; background: #fff; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.75rem 1rem; color: #b91c1c; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
      details { text-align: left; margin: 0.75rem 0 1.25rem; }
      summary { cursor: pointer; color: #4b5563; font-size: 13px; }
      pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: #111; color: #e5e7eb; border-radius: 0.5rem; padding: 0.75rem 1rem; overflow-x: auto; white-space: pre-wrap; word-break: break-word; max-height: 20rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>${detail?.message ? "The server reported this error:" : "Something went wrong on our end."}</p>
      ${detail?.message ? `<div class="msg">${headline}</div>` : ""}
      ${trace ? `<details open><summary>Technical details</summary><pre>${escapeHtml(trace)}</pre></details>` : ""}
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
