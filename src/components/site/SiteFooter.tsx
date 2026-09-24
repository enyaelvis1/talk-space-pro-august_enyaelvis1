import { Link, useMatch } from "@tanstack/react-router";
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Twitter, Youtube } from "lucide-react";
import { TS, WHATSAPP_HREF } from "@/lib/talkspace";
import { DEFAULT_FOOTER_SETTINGS, DEFAULT_SITE_DETAILS } from "@/lib/content.functions";
import { BrandWordmark } from "@/components/site/BrandWordmark";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

function formatFooterText(text: string, year: number, brandName: string) {
  return text.replaceAll("{year}", String(year)).replaceAll("{brandName}", brandName);
}

function isInternalHref(href: string) {
  return href.startsWith("/");
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  const shell = useMatch({
    from: "__root__",
    shouldThrow: false,
    select: (match) => match.loaderData,
  });
  const details = shell?.details ?? DEFAULT_SITE_DETAILS;
  const footer = shell?.footer ?? DEFAULT_FOOTER_SETTINGS;

  const socials = [
    { href: details.facebook, label: "Facebook", icon: Facebook },
    { href: details.twitter, label: "Twitter / X", icon: Twitter },
    { href: details.instagram, label: "Instagram", icon: Instagram },
    { href: details.linkedin, label: "LinkedIn", icon: Linkedin },
    { href: details.youtube, label: "YouTube", icon: Youtube },
  ];
  const footerOffices = footer.offices.length
    ? footer.offices
    : footer.contactAddress.trim()
      ? footer.contactAddress.split(/\n+/).map((line) => ({ name: "", addressLines: [line] }))
      : TS.addresses.map((address) => ({ name: address.city, addressLines: [...address.lines] }));

  return (
    <footer className="border-t border-border/60 bg-brand-deep text-white">
      <div className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-white/80">
            <span className="font-semibold text-white">{footer.crisisHeading}</span>{" "}
            {footer.crisisText}
          </p>
          {isInternalHref(footer.crisisCtaHref) ? (
            <Link
              to={footer.crisisCtaHref}
              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 font-medium text-brand-deep transition-colors hover:bg-white/90"
            >
              {footer.crisisCtaLabel} →
            </Link>
          ) : (
            <a
              href={footer.crisisCtaHref}
              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 font-medium text-brand-deep transition-colors hover:bg-white/90"
            >
              {footer.crisisCtaLabel} →
            </a>
          )}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_2fr] lg:gap-12 lg:px-8">
        <div>
          <Link
            to="/"
            className="inline-flex flex-col items-start gap-1"
            aria-label="Talk Space, home"
          >
            <span className="rounded-lg bg-white px-3 py-2 text-brand-deep">
              <BrandWordmark
                brandName={details.brandName}
                logoPath={details.logoPath}
                size="footer"
              />
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm text-white/78">
            {details.tagline}. {footer.description}
          </p>

          <ul className="mt-6 space-y-3 text-sm text-white/85">
            {footerOffices.map((office, index) => (
              <li key={`${office.name}-${index}`} className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 flex-none text-brand-mint" aria-hidden />
                <span>
                  {office.name ? <strong className="block text-white">{office.name}</strong> : null}
                  {office.addressLines.join(", ")}
                </span>
              </li>
            ))}
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-brand-mint" aria-hidden />
              <a
                href={`tel:${details.phone.replace(/\s+/g, "")}`}
                className="inline-flex min-h-6 items-center transition-colors hover:text-brand-mint"
              >
                {details.phone}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Chat with Talk Space ${details.whatsapp}`}
                title={`Chat with Talk Space ${details.whatsapp}`}
                className="inline-flex min-h-6 items-center gap-2 transition-colors hover:text-brand-mint"
              >
                <WhatsAppIcon className="mt-0.5 h-4 w-4 text-brand-mint" aria-hidden />
                <span className="text-white/85">{details.whatsapp}</span>
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-brand-mint" aria-hidden />
              <a
                href={`mailto:${details.email}`}
                className="transition-colors hover:text-brand-mint"
              >
                {details.email}
              </a>
            </li>
          </ul>

          {footer.showSocialLinks ? (
            <div className="mt-6 flex items-center gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {footer.sections.map((section) => (
            <div key={section.title}>
              <h3 className="eyebrow text-white/70">{section.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {isInternalHref(link.to) ? (
                      <Link
                        to={link.to}
                        className="text-sm text-white/85 transition-colors hover:text-brand-mint"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.to}
                        className="text-sm text-white/85 transition-colors hover:text-brand-mint"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-white/72 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>{formatFooterText(footer.bottomLeft, year, details.brandName)}</p>
          <p>{formatFooterText(footer.bottomRight, year, details.brandName)}</p>
        </div>
      </div>
    </footer>
  );
}
