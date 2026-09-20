export type FormFieldType =
  "text" | "email" | "tel" | "textarea" | "date" | "time" | "select" | "radio" | "hidden";

export type FormFieldDefinition = {
  fieldKey: string;
  label: string;
  placeholder: string;
  helpText: string;
  required: boolean;
  visible: boolean;
  type: FormFieldType;
  options?: string[];
};

export type FormTemplateDefinition = {
  key: string;
  title: string;
  description: string;
  audience: "public" | "internal";
  fields: FormFieldDefinition[];
};

export function getTemplateBaseKey(templateKey: string) {
  return templateKey.replace(/_v\d+$/, "");
}

export function getTemplateVersion(templateKey: string) {
  const match = templateKey.match(/_v(\d+)$/);
  return match ? Number.parseInt(match[1] || "1", 10) : 1;
}

function cloneField(field: FormFieldDefinition): FormFieldDefinition {
  return { ...field };
}

function cloneTemplate(template: FormTemplateDefinition): FormTemplateDefinition {
  return { ...template, fields: template.fields.map(cloneField) };
}

export const DEFAULT_FORM_TEMPLATES: FormTemplateDefinition[] = [
  {
    key: "booking_intake_v1",
    title: "Booking intake",
    description: "Confidential appointment request for clients booking a session.",
    audience: "public",
    fields: [
      {
        fieldKey: "fullName",
        label: "Full name",
        placeholder: "Your full name",
        helpText: "",
        required: true,
        visible: true,
        type: "text",
      },
      {
        fieldKey: "email",
        label: "Email",
        placeholder: "you@example.com",
        helpText: "",
        required: true,
        visible: true,
        type: "email",
      },
      {
        fieldKey: "phone",
        label: "Phone (WhatsApp preferred)",
        placeholder: "+234 800 000 0000",
        helpText: "",
        required: true,
        visible: true,
        type: "tel",
      },
      {
        fieldKey: "serviceId",
        label: "Service",
        placeholder: "Choose a service",
        helpText: "",
        required: true,
        visible: true,
        type: "select",
      },
      {
        fieldKey: "mode",
        label: "Session mode",
        placeholder: "Choose a session mode",
        helpText: "",
        required: true,
        visible: true,
        type: "radio",
      },
      {
        fieldKey: "preferredDate",
        label: "Preferred date",
        placeholder: "Choose a date",
        helpText:
          "Optional — tell us when you'd prefer to meet, and we'll match you to the best available slot.",
        required: false,
        visible: true,
        type: "date",
      },
      {
        fieldKey: "preferredTime",
        label: "Preferred time",
        placeholder: "Choose an available time",
        helpText: "Optional — we can confirm the best slot with your therapist after review.",
        required: false,
        visible: true,
        type: "time",
      },
      {
        fieldKey: "notes",
        label: "Anything you'd like us to know? (Optional)",
        placeholder: "Briefly, what would you like support with?",
        helpText: "Optional notes help us prepare for your session.",
        required: false,
        visible: true,
        type: "textarea",
      },
    ],
  },
  {
    key: "contact_enquiry_v1",
    title: "Contact enquiry",
    description: "General enquiries and support messages from the public contact page.",
    audience: "public",
    fields: [
      {
        fieldKey: "fullName",
        label: "Full name",
        placeholder: "Your full name",
        helpText: "",
        required: true,
        visible: true,
        type: "text",
      },
      {
        fieldKey: "email",
        label: "Email",
        placeholder: "you@example.com",
        helpText: "",
        required: true,
        visible: true,
        type: "email",
      },
      {
        fieldKey: "phone",
        label: "Phone (optional)",
        placeholder: "+234 800 000 0000",
        helpText: "",
        required: false,
        visible: true,
        type: "tel",
      },
      {
        fieldKey: "message",
        label: "How can we help?",
        placeholder: "Tell us a little about what you need.",
        helpText: "We reply within one working day.",
        required: true,
        visible: true,
        type: "textarea",
      },
      {
        fieldKey: "website",
        label: "Website",
        placeholder: "",
        helpText: "Hidden anti-spam field.",
        required: false,
        visible: false,
        type: "hidden",
      },
    ],
  },
  {
    key: "client_profile_v1",
    title: "Client profile",
    description: "Internal client intake and review fields used by the admin team.",
    audience: "internal",
    fields: [
      {
        fieldKey: "fullName",
        label: "Full name",
        placeholder: "Client full name",
        helpText: "",
        required: true,
        visible: true,
        type: "text",
      },
      {
        fieldKey: "email",
        label: "Email",
        placeholder: "client@example.com",
        helpText: "",
        required: true,
        visible: true,
        type: "email",
      },
      {
        fieldKey: "phone",
        label: "Phone",
        placeholder: "+234 800 000 0000",
        helpText: "",
        required: false,
        visible: true,
        type: "tel",
      },
      {
        fieldKey: "assignedTherapist",
        label: "Assigned therapist",
        placeholder: "Choose a therapist",
        helpText: "",
        required: false,
        visible: true,
        type: "select",
      },
      {
        fieldKey: "notes",
        label: "Notes / care summary",
        placeholder: "Staff-only care notes and context",
        helpText: "",
        required: false,
        visible: true,
        type: "textarea",
      },
      {
        fieldKey: "relatedBookings",
        label: "Related bookings",
        placeholder: "Linked appointment records",
        helpText: "",
        required: false,
        visible: true,
        type: "hidden",
      },
    ],
  },
  {
    key: "assessment_wellbeing_v1",
    title: "Wellbeing check-in",
    description: "Approved internal assessment form for light-touch wellbeing screening.",
    audience: "internal",
    fields: [
      {
        fieldKey: "fullName",
        label: "Client full name",
        placeholder: "Full name",
        helpText: "",
        required: true,
        visible: true,
        type: "text",
      },
      {
        fieldKey: "email",
        label: "Email",
        placeholder: "client@example.com",
        helpText: "",
        required: true,
        visible: true,
        type: "email",
      },
      {
        fieldKey: "checkInFocus",
        label: "What would you like to focus on today?",
        placeholder: "Share the main concern or goal.",
        helpText: "",
        required: true,
        visible: true,
        type: "textarea",
      },
      {
        fieldKey: "energyLevel",
        label: "Energy level",
        placeholder: "",
        helpText: "Choose the best match for this week.",
        required: true,
        visible: true,
        type: "radio",
        options: ["Low", "Moderate", "Good", "Strong"],
      },
      {
        fieldKey: "supportNeeds",
        label: "Support needed",
        placeholder: "What would help most right now?",
        helpText: "",
        required: false,
        visible: true,
        type: "textarea",
      },
    ],
  },
  {
    key: "assessment_readiness_v1",
    title: "Therapy readiness review",
    description: "Approved internal assessment form used before matching and scheduling.",
    audience: "internal",
    fields: [
      {
        fieldKey: "fullName",
        label: "Client full name",
        placeholder: "Full name",
        helpText: "",
        required: true,
        visible: true,
        type: "text",
      },
      {
        fieldKey: "presentingConcern",
        label: "Presenting concern",
        placeholder: "What is bringing the client in?",
        helpText: "",
        required: true,
        visible: true,
        type: "textarea",
      },
      {
        fieldKey: "preferredSupport",
        label: "Preferred support style",
        placeholder: "",
        helpText: "Select the approach that best fits this client.",
        required: true,
        visible: true,
        type: "select",
        options: ["Individual therapy", "Couples therapy", "Family support", "Unsure yet"],
      },
      {
        fieldKey: "readiness",
        label: "Readiness for support",
        placeholder: "",
        helpText: "",
        required: true,
        visible: true,
        type: "radio",
        options: ["Ready now", "Need more information", "Prefer a later follow-up"],
      },
      {
        fieldKey: "notes",
        label: "Clinical notes",
        placeholder: "Internal notes and observations",
        helpText: "",
        required: false,
        visible: true,
        type: "textarea",
      },
    ],
  },
];

export function cloneFormTemplates(templates: FormTemplateDefinition[] = DEFAULT_FORM_TEMPLATES) {
  return templates.map(cloneTemplate);
}

export function normalizeFormTemplates(value: unknown): FormTemplateDefinition[] {
  if (!Array.isArray(value)) return cloneFormTemplates();

  const defaultMap = new Map(DEFAULT_FORM_TEMPLATES.map((template) => [template.key, template]));
  const parsed = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const key = typeof row.key === "string" && row.key.trim() ? row.key.trim() : null;
    const title = typeof row.title === "string" && row.title.trim() ? row.title.trim() : null;
    const description =
      typeof row.description === "string" && row.description.trim() ? row.description.trim() : null;
    const audience = row.audience === "internal" ? "internal" : "public";
    const fields = Array.isArray(row.fields)
      ? row.fields.flatMap((field) => {
          if (!field || typeof field !== "object") return [];
          const fieldRow = field as Record<string, unknown>;
          const fieldKey =
            typeof fieldRow.fieldKey === "string" && fieldRow.fieldKey.trim()
              ? fieldRow.fieldKey.trim()
              : null;
          const label =
            typeof fieldRow.label === "string" && fieldRow.label.trim()
              ? fieldRow.label.trim()
              : null;
          if (!fieldKey || !label) return [];
          const fieldType: FormFieldType =
            fieldRow.type === "email" ||
            fieldRow.type === "tel" ||
            fieldRow.type === "textarea" ||
            fieldRow.type === "date" ||
            fieldRow.type === "time" ||
            fieldRow.type === "select" ||
            fieldRow.type === "radio" ||
            fieldRow.type === "hidden"
              ? fieldRow.type
              : "text";
          return [
            {
              fieldKey,
              label,
              placeholder: typeof fieldRow.placeholder === "string" ? fieldRow.placeholder : "",
              helpText: typeof fieldRow.helpText === "string" ? fieldRow.helpText : "",
              required: fieldRow.required !== false,
              visible: fieldRow.visible !== false,
              options: Array.isArray(fieldRow.options)
                ? fieldRow.options
                    .filter((option): option is string => typeof option === "string")
                    .map((option) => option.trim())
                    .filter(Boolean)
                : [],
              type: fieldType,
            } satisfies FormFieldDefinition,
          ];
        })
      : [];
    if (!key || !title || !description || fields.length === 0) return [];
    return [
      {
        key,
        title,
        description,
        audience,
        fields,
      } satisfies FormTemplateDefinition,
    ];
  });

  const seen = new Set(parsed.map((template) => template.key));
  const merged = [
    ...parsed,
    ...DEFAULT_FORM_TEMPLATES.filter((template) => !seen.has(template.key)).map((template) => ({
      ...cloneTemplate(template),
      audience: defaultMap.get(template.key)?.audience ?? template.audience,
    })),
  ];

  return merged.map((template) => cloneTemplate(template));
}

export function getTemplateField(
  template: FormTemplateDefinition | undefined,
  fieldKey: string,
): FormFieldDefinition | undefined {
  return template?.fields.find((field) => field.fieldKey === fieldKey);
}

export function getLatestTemplateByBaseKey(
  templates: FormTemplateDefinition[],
  baseKey: string,
): FormTemplateDefinition | undefined {
  const matches = templates.filter((template) => {
    return getTemplateBaseKey(template.key) === baseKey;
  });
  if (matches.length === 0) return undefined;

  return [...matches].sort((a, b) => {
    return getTemplateVersion(b.key) - getTemplateVersion(a.key);
  })[0];
}

export function duplicateTemplateWithNextVersion(
  template: FormTemplateDefinition,
  existingKeys: string[],
): FormTemplateDefinition {
  const base = getTemplateBaseKey(template.key);
  const currentVersion = getTemplateVersion(template.key);
  let nextVersion = currentVersion + 1;
  let nextKey = `${base}_v${nextVersion}`;
  while (existingKeys.includes(nextKey)) {
    nextVersion += 1;
    nextKey = `${base}_v${nextVersion}`;
  }
  return {
    ...cloneTemplate(template),
    key: nextKey,
  };
}
