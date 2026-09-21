import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import type { AdminSiteSettingsWorkspace } from "@/lib/admin.functions";
import type { EmailSettingsDTO } from "@/lib/email.functions";
import type { GoogleAdminSettings } from "@/lib/google.functions";
import type { PaymentSettingsDTO } from "@/lib/payments.functions";
import { requireRequestRole } from "@/lib/server-auth";

export type AdminSettingsWorkspace = AdminSiteSettingsWorkspace & {
  email: EmailSettingsDTO;
  payments: PaymentSettingsDTO;
  google: GoogleAdminSettings;
};

export const getAdminSettingsWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminSettingsWorkspace> => {
    const context = await requireRequestRole("admin");
    const [admin, emailServer, paymentsServer, googleServer] = await Promise.all([
      import("@/lib/admin.functions"),
      import("@/lib/email.server"),
      import("@/lib/payments.server"),
      import("@/lib/google.server"),
    ]);
    const [siteSettings, email, payments, googleOAuth] = await Promise.all([
      admin.loadAdminSiteSettingsWorkspace(context.bag),
      emailServer.loadEmailSettings(),
      paymentsServer.loadPaymentSettings(),
      googleServer.loadGoogleOAuthSettings(),
    ]);
    const google: GoogleAdminSettings = {
      ...googleOAuth,
      redirectUri: `${googleServer.absoluteOrigin(getRequest())}${googleOAuth.redirectPath}`,
    };
    setResponseHeader("Cache-Control", "private, no-store");
    return {
      ...siteSettings,
      email: email as EmailSettingsDTO,
      payments: payments as PaymentSettingsDTO,
      google,
    };
  },
);
