/** A native, keyboard-accessible link stretched across its positioned review card. */
export function GoogleReviewLink({ url, name }: { url: string; name: string }) {
  let href: string;
  try {
    const destination = new URL(url);
    if (
      !["https:", "http:"].includes(destination.protocol) ||
      destination.username ||
      destination.password
    ) {
      return null;
    }
    href = destination.href;
  } catch {
    return null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Read ${name}'s review on Google (opens in a new tab)`}
      className="mt-3 inline-flex text-sm font-semibold text-brand-deep underline underline-offset-4 after:absolute after:inset-0 after:rounded-[1.75rem] hover:text-brand-blue focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-blue focus-visible:after:ring-offset-4"
    >
      Read on Google
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
