import { useEffect } from "react";

import type { PublicSiteDetails } from "@/lib/content.functions";

export function SiteAppearance({ details }: { details: PublicSiteDetails }) {
  useEffect(() => {
    if (details.faviconPath) {
      document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
        link.href = details.faviconPath!;
      });
    }
    if (details.socialImagePath) {
      document
        .querySelectorAll<HTMLMetaElement>('meta[property="og:image"], meta[name="twitter:image"]')
        .forEach((meta) => {
          meta.content = details.socialImagePath!;
        });
    }
  }, [details.faviconPath, details.socialImagePath]);

  return null;
}
