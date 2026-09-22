import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Loader2,
  Mail,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_FORM_TEMPLATES,
  duplicateTemplateWithNextVersion,
  type FormFieldDefinition,
  type FormTemplateDefinition,
} from "@/lib/form-templates";
import { canonicalUrl } from "@/lib/seo";
import {
  getAdminFormsWorkspace,
  updateAdminFormTemplates,
  type AdminPendingIntakeSubmission,
} from "@/lib/admin.functions";
import { sendIntakeFormReminder } from "@/lib/email.functions";

export const Route = createFileRoute("/_authenticated/admin/forms")({
  loader: async () => {
    return getAdminFormsWorkspace();
  },
  head: () => ({
    meta: [{ title: "Forms | Talk Space Admin" }, { name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/forms") }],
  }),
  component: FormsAdminRoute,
});

const FIELD_KIND_LABELS: Record<FormFieldDefinition["type"], string> = {
  text: "Text",
  email: "Email",
  tel: "Phone",
  textarea: "Paragraph",
  date: "Date",
  time: "Time",
  select: "Select",
  radio: "Choice",
  hidden: "Hidden",
};

const TEMPLATE_NOTES: Record<string, string> = {
  booking_intake_v1:
    "Public booking form. Changes here update the labels and helper text on /book.",
  contact_enquiry_v1:
    "Public contact form. Changes here update the labels and helper text on /contact.",
  client_profile_v1: "Internal admin record shape. This does not render on the public site yet.",
  assessment_wellbeing_v1: "Approved internal assessment form for pre-intake wellbeing screening.",
  assessment_readiness_v1: "Approved internal assessment form used before matching and scheduling.",
};

function cloneTemplates(templates: FormTemplateDefinition[]): FormTemplateDefinition[] {
  return templates.map((template) => ({
    ...template,
    fields: template.fields.map((field) => ({ ...field })),
  }));
}

function fieldLabel(field: FormFieldDefinition) {
  return `${field.label}${field.required ? " *" : ""}`;
}

function FormsAdminRoute() {
  const { templates: saved, pendingForms } = Route.useLoaderData() as {
    templates: FormTemplateDefinition[];
    pendingForms: AdminPendingIntakeSubmission[];
  };
  const [templates, setTemplates] = useState<FormTemplateDefinition[]>(
    saved.length ? saved : cloneTemplates(DEFAULT_FORM_TEMPLATES),
  );
  const [saving, setSaving] = useState(false);
  const [activeKey, setActiveKey] = useState(saved[0]?.key ?? DEFAULT_FORM_TEMPLATES[0].key);

  useEffect(() => {
    const next = saved.length ? cloneTemplates(saved) : cloneTemplates(DEFAULT_FORM_TEMPLATES);
    setTemplates(next);
    setActiveKey((current) =>
      next.some((template) => template.key === current) ? current : (next[0]?.key ?? ""),
    );
  }, [saved]);

  const templateMap = useMemo(
    () => new Map(templates.map((template) => [template.key, template])),
    [templates],
  );
  const assessmentTemplates = templates.filter((template) =>
    template.key.startsWith("assessment_"),
  );
  const pendingTemplates = useMemo(
    () => new Map(templates.map((template) => [template.key, template.title])),
    [templates],
  );

  const updateTemplate = (templateIndex: number, patch: Partial<FormTemplateDefinition>) =>
    setTemplates((current) =>
      current.map((template, index) =>
        index === templateIndex ? { ...template, ...patch } : template,
      ),
    );

  const updateField = (
    templateIndex: number,
    fieldIndex: number,
    patch: Partial<FormFieldDefinition>,
  ) =>
    setTemplates((current) =>
      current.map((template, index) => {
        if (index !== templateIndex) return template;
        return {
          ...template,
          fields: template.fields.map((field, idx) =>
            idx === fieldIndex ? { ...field, ...patch } : field,
          ),
        };
      }),
    );

  const moveField = (templateIndex: number, fieldIndex: number, direction: -1 | 1) =>
    setTemplates((current) =>
      current.map((template, index) => {
        if (index !== templateIndex) return template;
        const nextIndex = fieldIndex + direction;
        if (nextIndex < 0 || nextIndex >= template.fields.length) return template;
        const nextFields = [...template.fields];
        [nextFields[fieldIndex], nextFields[nextIndex]] = [
          nextFields[nextIndex],
          nextFields[fieldIndex],
        ];
        return { ...template, fields: nextFields };
      }),
    );

  const addField = (templateIndex: number) =>
    setTemplates((current) =>
      current.map((template, index) => {
        if (index !== templateIndex) return template;
        const fieldNumber = template.fields.length + 1;
        return {
          ...template,
          fields: [
            ...template.fields,
            {
              fieldKey: `field_${fieldNumber}`,
              label: `New question ${fieldNumber}`,
              placeholder: "",
              helpText: "",
              required: false,
              visible: true,
              type: "text" as const,
              options: [],
            },
          ],
        };
      }),
    );

  const removeField = (templateIndex: number, fieldIndex: number) =>
    setTemplates((current) =>
      current.map((template, index) => {
        if (index !== templateIndex || template.fields.length <= 1) return template;
        return {
          ...template,
          fields: template.fields.filter((_, idx) => idx !== fieldIndex),
        };
      }),
    );

  const resetTemplate = (templateKey: string) => {
    const fallback = DEFAULT_FORM_TEMPLATES.find((template) => template.key === templateKey);
    if (!fallback) return;
    setTemplates((current) =>
      current.map((template) =>
        template.key === templateKey ? cloneTemplates([fallback])[0] : template,
      ),
    );
    toast.success(`${fallback.title} reset to the default template.`);
  };

  const duplicateTemplate = (templateKey: string) => {
    const template = templateMap.get(templateKey);
    if (!template) return;
    const duplicate = duplicateTemplateWithNextVersion(
      template,
      templates.map((item) => item.key),
    );
    setTemplates((current) => [...current, duplicate]);
    setActiveKey(duplicate.key);
    toast.success(`Created ${duplicate.key}.`);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminFormTemplates({ data: { templates } });
      toast.success("Form templates saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save form templates.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Admin · Content</p>
            <h1 className="display-1 mt-3 text-brand-deep">Forms and question editor</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Edit the booking, contact, and internal intake questions from one place. Public forms
              read these labels and helper texts directly from saved templates.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTemplates(cloneTemplates(DEFAULT_FORM_TEMPLATES))}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restore defaults
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save templates
            </Button>
          </div>
        </header>

        <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Pending forms</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Incomplete intake submissions waiting for review or continuation.
              </p>
            </div>
            <div className="rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-brand-deep">
              {pendingForms.length} pending
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {pendingForms.length ? (
              pendingForms.map((submission) => (
                <PendingFormCard
                  key={submission.id}
                  submission={submission}
                  templateTitle={
                    pendingTemplates.get(submission.templateKey) ?? submission.templateKey
                  }
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background p-6 text-sm text-muted-foreground lg:col-span-2">
                No pending intake submissions right now. New drafts and in-progress forms will show
                up here.
              </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-border/60 bg-brand-blue-soft/35 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Template registry</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Duplicate a template to create the next version, or adjust fields in place to
                  update the current form copy.
                </p>
              </div>
              <div className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs text-brand-deep">
                {templates.length} templates loaded
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border/60 bg-brand-blue-soft/35 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Approved assessment forms</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  These are the internal screening and readiness forms approved for use by the care
                  team.
                </p>
              </div>
              <span className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs text-brand-deep">
                {assessmentTemplates.length} approved
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {assessmentTemplates.map((template) => (
                <div key={template.key} className="rounded-2xl border border-border/60 bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-brand-deep">{template.title}</h3>
                    <span className="rounded-full bg-accent-terracotta-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-terracotta">
                      Approved
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {template.fields.length} questions · {template.key}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <Tabs value={activeKey} onValueChange={setActiveKey} className="mt-5">
            <TabsList className="h-auto flex-wrap gap-2 bg-transparent p-0">
              {templates.map((template) => (
                <TabsTrigger
                  key={template.key}
                  value={template.key}
                  className="border border-border/70 bg-muted/30 px-4 py-2 text-sm data-[state=active]:bg-brand-deep data-[state=active]:text-white"
                >
                  {template.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {templates.map((template, templateIndex) => (
              <TabsContent key={template.key} value={template.key} className="mt-6">
                <article className="space-y-6 rounded-3xl border border-border/70 bg-background p-5 shadow-soft-warm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-semibold text-brand-deep">{template.title}</h2>
                        <span className="rounded-full bg-accent-terracotta-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent-terracotta">
                          {template.key}
                        </span>
                        <span className="rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs text-brand-deep">
                          {template.audience === "internal" ? "Internal only" : "Public form"}
                        </span>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                        {template.description}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {TEMPLATE_NOTES[template.key] ?? "Template ready for editing."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => duplicateTemplate(template.key)}
                      >
                        <CopyPlus className="mr-2 h-4 w-4" />
                        Duplicate version
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => resetTemplate(template.key)}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border/60 bg-card p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field
                            label="Template key"
                            value={template.key}
                            onChange={(value) => updateTemplate(templateIndex, { key: value })}
                            helper="Keep this stable if the template is already in use."
                          />
                          <Field
                            label="Template title"
                            value={template.title}
                            onChange={(value) => updateTemplate(templateIndex, { title: value })}
                          />
                        </div>
                        <div className="mt-4">
                          <Label htmlFor={`template-description-${template.key}`}>
                            Description
                          </Label>
                          <Textarea
                            id={`template-description-${template.key}`}
                            className="mt-1"
                            value={template.description}
                            onChange={(event) =>
                              updateTemplate(templateIndex, { description: event.target.value })
                            }
                            rows={3}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        {template.fields.map((field, fieldIndex) => (
                          <section
                            key={field.fieldKey}
                            className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-muted/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-deep">
                                  {FIELD_KIND_LABELS[field.type]}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {field.fieldKey}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => moveField(templateIndex, fieldIndex, -1)}
                                  disabled={fieldIndex === 0}
                                  aria-label={`Move ${field.label} up`}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => moveField(templateIndex, fieldIndex, 1)}
                                  disabled={fieldIndex === template.fields.length - 1}
                                  aria-label={`Move ${field.label} down`}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeField(templateIndex, fieldIndex)}
                                  disabled={template.fields.length <= 1}
                                  aria-label={`Remove ${field.label}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                              <Field
                                id={`label-${template.key}-${field.fieldKey}`}
                                label="Question label"
                                value={field.label}
                                onChange={(value) =>
                                  updateField(templateIndex, fieldIndex, { label: value })
                                }
                              />
                              <Field
                                id={`placeholder-${template.key}-${field.fieldKey}`}
                                label="Placeholder"
                                value={field.placeholder}
                                onChange={(value) =>
                                  updateField(templateIndex, fieldIndex, { placeholder: value })
                                }
                              />
                            </div>

                            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label htmlFor={`type-${template.key}-${field.fieldKey}`}>
                                  Field type
                                </Label>
                                <Select
                                  value={field.type}
                                  onValueChange={(value: FormFieldDefinition["type"]) =>
                                    updateField(templateIndex, fieldIndex, {
                                      type: value,
                                      options:
                                        value === "select" || value === "radio"
                                          ? (field.options ?? [])
                                          : [],
                                    })
                                  }
                                >
                                  <SelectTrigger id={`type-${template.key}-${field.fieldKey}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(FIELD_KIND_LABELS).map(([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        {label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Field
                                id={`field-key-${template.key}-${field.fieldKey}`}
                                label="Field key"
                                value={field.fieldKey}
                                onChange={(value) =>
                                  updateField(templateIndex, fieldIndex, { fieldKey: value })
                                }
                                helper="Keep this stable after submissions exist."
                              />
                            </div>

                            {field.type === "select" || field.type === "radio" ? (
                              <div className="mt-4">
                                <Label htmlFor={`options-${template.key}-${field.fieldKey}`}>
                                  Options
                                </Label>
                                <Textarea
                                  id={`options-${template.key}-${field.fieldKey}`}
                                  className="mt-1"
                                  rows={3}
                                  value={(field.options ?? []).join("\n")}
                                  onChange={(event) =>
                                    updateField(templateIndex, fieldIndex, {
                                      options: event.target.value
                                        .split("\n")
                                        .map((option) => option.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  placeholder="One option per line"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Add one choice per line. These choices appear on the form.
                                </p>
                              </div>
                            ) : null}

                            <div className="mt-4">
                              <Label htmlFor={`help-${template.key}-${field.fieldKey}`}>
                                Helper text
                              </Label>
                              <Textarea
                                id={`help-${template.key}-${field.fieldKey}`}
                                className="mt-1"
                                rows={2}
                                value={field.helpText}
                                onChange={(event) =>
                                  updateField(templateIndex, fieldIndex, {
                                    helpText: event.target.value,
                                  })
                                }
                              />
                            </div>

                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                              <ToggleField
                                label="Required"
                                description="Show as required on the public form."
                                checked={field.required}
                                onCheckedChange={(checked) =>
                                  updateField(templateIndex, fieldIndex, { required: checked })
                                }
                              />
                              <ToggleField
                                label="Visible"
                                description="Hide if this should stay internal or be used as a honeypot."
                                checked={field.visible}
                                onCheckedChange={(checked) =>
                                  updateField(templateIndex, fieldIndex, { visible: checked })
                                }
                              />
                            </div>
                          </section>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => addField(templateIndex)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add question
                        </Button>
                      </div>
                    </div>

                    <aside className="space-y-4">
                      <div className="rounded-2xl border border-border/60 bg-brand-blue-soft/40 p-4">
                        <p className="eyebrow">Live preview</p>
                        <div className="mt-4 space-y-3">
                          {template.fields
                            .filter((field) => field.visible)
                            .map((field) => (
                              <div
                                key={field.fieldKey}
                                className="rounded-2xl border border-border/60 bg-card p-3"
                              >
                                <p className="text-sm font-medium text-brand-deep">
                                  {fieldLabel(field)}
                                </p>
                                {field.helpText ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {field.helpText}
                                  </p>
                                ) : null}
                                <p className="mt-2 rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                                  {field.placeholder || "No placeholder set."}
                                </p>
                                {field.options?.length ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {field.options.map((option) => (
                                      <span
                                        key={option}
                                        className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] text-brand-deep"
                                      >
                                        {option}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                        <p className="font-semibold text-brand-deep">How this is used</p>
                        <ul className="mt-2 list-disc space-y-2 pl-4">
                          <li>Booking and contact pages read the saved field labels directly.</li>
                          <li>
                            Versioning is handled by duplicating a template and updating the key.
                          </li>
                          <li>
                            Internal templates stay in the same registry for future secure intake
                            work.
                          </li>
                        </ul>
                      </div>
                    </aside>
                  </div>
                </article>
              </TabsContent>
            ))}
          </Tabs>
        </section>

        <div className="sticky bottom-4 z-10 flex justify-end rounded-2xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur">
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save templates
          </Button>
        </div>
      </main>
    </AdminWorkspaceShell>
  );
}

const pendingDateFormatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatPendingDate(value: string) {
  return pendingDateFormatter.format(new Date(value));
}

function pendingSourceLabel(source: AdminPendingIntakeSubmission["source"]) {
  switch (source) {
    case "booking":
      return "Booking intake";
    case "contact":
      return "Contact enquiry";
    case "assessment":
      return "Assessment";
  }
}

function summarizePayload(payload: Record<string, unknown>) {
  const entries = Object.entries(payload)
    .filter(([, value]) => typeof value === "string" && String(value).trim().length > 0)
    .slice(0, 3);
  return entries.length
    ? entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ")
    : "No preview available yet.";
}

function PendingFormCard({
  submission,
  templateTitle,
}: {
  submission: AdminPendingIntakeSubmission;
  templateTitle: string;
}) {
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderSentAt, setReminderSentAt] = useState(submission.reminderSentAt);

  const sendReminder = async () => {
    setSendingReminder(true);
    try {
      const result = await sendIntakeFormReminder({ data: { submissionId: submission.id } });
      setReminderSentAt(result.sentAt);
      toast.success(`Reminder sent to ${submission.subjectEmail}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the reminder.");
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <article className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-brand-deep">
            {submission.subjectName ?? "Untitled submission"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {templateTitle} · v{submission.templateVersion}
          </p>
        </div>
        <Badge className="rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-[0.6875rem] font-medium text-warning">
          {submission.completionState === "in_progress" ? "In progress" : "Draft"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/80">Source</p>
          <p className="mt-1 text-brand-deep">{pendingSourceLabel(submission.source)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/80">Updated</p>
          <p className="mt-1 text-brand-deep">{formatPendingDate(submission.updatedAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/80">Contact</p>
          <p className="mt-1 text-brand-deep">{submission.subjectEmail ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/80">Linked</p>
          <p className="mt-1 text-brand-deep">
            {submission.clientId ? "Client record" : submission.appointmentId ? "Appointment" : "—"}
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-surface-page p-3 text-sm text-brand-deep">
        {summarizePayload(submission.payload)}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {submission.clientId ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/clients/$clientId" params={{ clientId: submission.clientId }}>
              Open client
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={() => void sendReminder()}
          disabled={sendingReminder || !submission.subjectEmail}
        >
          {sendingReminder ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Mail className="mr-2 h-4 w-4" aria-hidden />
          )}
          Send reminder
        </Button>
        <span className="text-xs text-muted-foreground">
          {reminderSentAt
            ? `Last reminder ${formatPendingDate(reminderSentAt)}`
            : `Created ${formatPendingDate(submission.createdAt)}`}
        </span>
      </div>
    </article>
  );
}

function Field({
  id: providedId,
  label,
  value,
  onChange,
  helper,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
}) {
  const id = providedId ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <label
      htmlFor={id}
      className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 bg-background p-4"
    >
      <div>
        <p className="font-medium text-brand-deep">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}
