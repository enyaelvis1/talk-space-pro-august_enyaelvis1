import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { clearFormDraft, loadFormDraft, saveFormDraft } from "@/lib/form-drafts";
import { INTAKE_CONSENT_TEXT } from "@/lib/intake-consent";
import { getTemplateField, type FormTemplateDefinition } from "@/lib/form-templates";
import { submitContactMessage } from "@/lib/contact.functions";

export const CONTACT_DRAFT_KEY = "talk-space.contact-draft.v1";

export function ContactEnquiryForm({ template }: { template: FormTemplateDefinition }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const completion = useMemo(() => {
    const requiredFields = [fullName, email, message];
    const completedFields = requiredFields.filter((value) => value.trim().length > 0).length;
    const percent = Math.round((completedFields / requiredFields.length) * 100);
    return {
      completedFields,
      totalFields: requiredFields.length,
      percent,
      ready: percent === 100,
    };
  }, [email, fullName, message]);

  useEffect(() => {
    const draft = loadFormDraft<{
      fullName: string;
      email: string;
      phone: string;
      message: string;
      consent: boolean;
    }>(CONTACT_DRAFT_KEY);
    if (draft) {
      setFullName(draft.data.fullName ?? "");
      setEmail(draft.data.email ?? "");
      setPhone(draft.data.phone ?? "");
      setMessage(draft.data.message ?? "");
      setConsent(Boolean(draft.data.consent));
      setDraftUpdatedAt(draft.updatedAt);
      toast.info("We restored your saved message draft.");
    }
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded || done) return;
    const timeout = window.setTimeout(() => {
      saveFormDraft(CONTACT_DRAFT_KEY, { fullName, email, phone, message, consent });
      setDraftUpdatedAt(new Date().toISOString());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [consent, draftLoaded, done, email, fullName, message, phone]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      toast.error("Please acknowledge the privacy policy before sending.");
      return;
    }
    setSubmitting(true);
    try {
      await submitContactMessage({
        data: {
          fullName,
          email,
          phone,
          message,
          templateKey: template.key,
          website,
          consentAcknowledged: consent,
        },
      });
      setDone(true);
      setFullName("");
      setEmail("");
      setPhone("");
      setMessage("");
      setConsent(false);
      clearFormDraft(CONTACT_DRAFT_KEY);
      setDraftUpdatedAt(null);
      toast.success("Message sent. Our care team will be in touch shortly.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-8 text-center">
        <h2 className="text-xl font-semibold text-brand-deep">Thank you</h2>
        <p className="mt-2 text-muted-foreground">
          We've received your message and will respond within one working day.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 rounded-3xl border border-border/60 bg-card p-6 shadow-soft-warm sm:p-8"
      noValidate
    >
      {draftUpdatedAt ? (
        <div className="rounded-lg border border-brand-blue/30 bg-brand-blue-soft/60 px-4 py-3 text-sm text-brand-deep">
          <p className="font-medium">Saved draft restored</p>
          <p className="text-xs text-brand-deep/75">
            Last saved{" "}
            {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(draftUpdatedAt),
            )}
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-brand-blue/30 bg-brand-blue-soft/60 px-4 py-3 text-brand-deep">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">{completion.ready ? "Ready to submit" : "In progress"}</p>
            <p className="text-xs text-brand-deep/75">
              {completion.completedFields} of {completion.totalFields} required details complete
            </p>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-brand-deep">
            {completion.percent}%
          </span>
        </div>
        <Progress
          value={completion.percent}
          aria-label="Contact form completion"
          className="mt-3 h-2"
        />
      </div>

      <div className="grid gap-1">
        <h2 className="font-display text-2xl text-brand-deep">{template.title}</h2>
        <p className="text-sm text-muted-foreground">
          {template.description} We reply within one working day. For emergencies, please use{" "}
          <a href="/emergency-support" className="text-link">
            our crisis resources
          </a>
          .
        </p>
      </div>

      {/* Honeypot */}
      <div className="hidden">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="fullName">
            {getTemplateField(template, "fullName")?.label ?? "Full name"}
          </Label>
          <Input
            id="fullName"
            required={getTemplateField(template, "fullName")?.required ?? true}
            minLength={2}
            maxLength={100}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={getTemplateField(template, "fullName")?.placeholder || undefined}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="email">{getTemplateField(template, "email")?.label ?? "Email"}</Label>
          <Input
            id="email"
            type="email"
            required={getTemplateField(template, "email")?.required ?? true}
            maxLength={255}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={getTemplateField(template, "email")?.placeholder || undefined}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="phone">
          {getTemplateField(template, "phone")?.label ?? "Phone (optional)"}
        </Label>
        <Input
          id="phone"
          type="tel"
          required={getTemplateField(template, "phone")?.required ?? false}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={30}
          placeholder={getTemplateField(template, "phone")?.placeholder || undefined}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="message">
          {getTemplateField(template, "message")?.label ?? "How can we help?"}
        </Label>
        <Textarea
          id="message"
          required={getTemplateField(template, "message")?.required ?? true}
          minLength={10}
          maxLength={2000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={getTemplateField(template, "message")?.placeholder || undefined}
          className="mt-1"
        />
        {getTemplateField(template, "message")?.helpText ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {getTemplateField(template, "message")?.helpText}
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
        <Checkbox
          id="consent"
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked === true)}
          className="mt-0.5"
        />
        <div className="space-y-1">
          <Label htmlFor="consent" className="text-sm font-medium text-brand-deep">
            I acknowledge the privacy policy <span className="text-danger">*</span>
          </Label>
          <p className="text-xs leading-6 text-muted-foreground">
            {INTAKE_CONSENT_TEXT}{" "}
            <a href="/privacy-policy" className="text-link">
              Review the privacy policy
            </a>
            .
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="terracotta"
          size="pill"
          disabled={submitting || !consent}
          className="shadow-soft-warm"
        >
          {submitting ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
