import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { AlertCircle, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAdminAssessmentSubmission } from "@/lib/clients.functions";
import type { FormFieldDefinition, FormTemplateDefinition } from "@/lib/form-templates";

function initialFieldValues(template: FormTemplateDefinition, clientName: string) {
  return template.fields.reduce<Record<string, string>>((accumulator, field) => {
    accumulator[field.fieldKey] = field.fieldKey === "fullName" && clientName ? clientName : "";
    return accumulator;
  }, {});
}

function renderFieldInput(
  field: FormFieldDefinition,
  value: string,
  onChange: (value: string) => void,
) {
  if (!field.visible || field.type === "hidden") return null;

  const commonProps = {
    id: field.fieldKey,
    value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(event.target.value),
    className: "mt-1",
  };

  return (
    <label key={field.fieldKey} htmlFor={field.fieldKey} className="space-y-2 text-sm">
      <span className="font-medium text-brand-deep">
        {field.label}
        {field.required ? <span className="text-danger"> *</span> : null}
      </span>
      {field.type === "textarea" ? (
        <Textarea {...commonProps} rows={4} placeholder={field.placeholder || undefined} />
      ) : field.type === "select" || field.type === "radio" ? (
        <select
          {...commonProps}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{field.placeholder || `Choose ${field.label.toLowerCase()}`}</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <Input
          {...commonProps}
          type={field.type}
          placeholder={field.placeholder || undefined}
          autoComplete="off"
        />
      )}
      {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
    </label>
  );
}

export function AdminAssessmentCapture({
  clientId,
  clientName,
  assessmentTemplates,
}: {
  clientId: string;
  clientName: string;
  assessmentTemplates: FormTemplateDefinition[];
}) {
  const router = useRouter();
  const [templateKey, setTemplateKey] = useState(assessmentTemplates[0]?.key ?? "");
  const [values, setValues] = useState<Record<string, string>>(
    assessmentTemplates[0] ? initialFieldValues(assessmentTemplates[0], clientName) : {},
  );
  const [saving, setSaving] = useState(false);

  const currentTemplate = useMemo(
    () => assessmentTemplates.find((template) => template.key === templateKey) ?? null,
    [assessmentTemplates, templateKey],
  );

  useEffect(() => {
    if (!assessmentTemplates.length) return;
    const nextTemplate =
      assessmentTemplates.find((template) => template.key === templateKey) ??
      assessmentTemplates[0];
    if (nextTemplate.key !== templateKey) {
      setTemplateKey(nextTemplate.key);
    }
    setValues(initialFieldValues(nextTemplate, clientName));
  }, [assessmentTemplates, clientName, templateKey]);

  const updateField = (fieldKey: string, value: string) => {
    setValues((current) => ({ ...current, [fieldKey]: value }));
  };

  const submitAssessment = async () => {
    if (!currentTemplate) return;
    const missingField = currentTemplate.fields.find(
      (field) => field.visible && field.required && !values[field.fieldKey]?.trim(),
    );
    if (missingField) {
      toast.error(`${missingField.label} is required.`);
      return;
    }

    setSaving(true);
    try {
      await createAdminAssessmentSubmission({
        data: {
          clientId,
          templateKey: currentTemplate.key,
          subjectName: clientName || null,
          subjectEmail: null,
          payload: values,
        },
      });
      toast.success("Assessment record saved.");
      setValues(initialFieldValues(currentTemplate, clientName));
      router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the assessment record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl text-brand-deep">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-mint-soft text-brand-deep">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          Assessment capture
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Save an internal assessment record directly into the secure intake ledger. These
          submissions stay staff-only and appear alongside booking and contact snapshots.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {assessmentTemplates.length ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Staff only</Badge>
              <Badge variant="outline">Secure intake</Badge>
              <Badge variant="outline">{assessmentTemplates.length} approved templates</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="space-y-2 text-sm font-medium text-brand-deep">
                Assessment template
                <Select value={templateKey} onValueChange={setTemplateKey}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose an assessment template" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessmentTemplates.map((template) => (
                      <SelectItem key={template.key} value={template.key}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (currentTemplate) {
                    setValues(initialFieldValues(currentTemplate, clientName));
                  }
                }}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Reset form
              </Button>
            </div>

            {currentTemplate ? (
              <div className="rounded-2xl border border-border/60 bg-brand-blue-soft/25 p-4">
                <p className="font-medium text-brand-deep">{currentTemplate.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{currentTemplate.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currentTemplate.fields.length} questions · {currentTemplate.key}
                </p>
              </div>
            ) : null}

            {currentTemplate ? (
              <div className="grid gap-4 md:grid-cols-2">
                {currentTemplate.fields.map((field) =>
                  renderFieldInput(field, values[field.fieldKey] ?? "", (value) =>
                    updateField(field.fieldKey, value),
                  ),
                )}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-blue/20 bg-brand-blue-soft/35 px-4 py-3 text-sm text-brand-deep">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  Saved assessments are written to the secure intake ledger and will appear below in
                  the client&apos;s snapshot history.
                </p>
              </div>
              <Button type="button" onClick={() => void submitAssessment()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save assessment
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <h3 className="mt-3 font-semibold text-brand-deep">No approved assessment templates</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add or approve an internal assessment template before saving assessment records.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
