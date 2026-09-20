import { ExternalLink, Mail } from "lucide-react";

import { FIRST_TIME_ASSESSMENT_EMAIL, FIRST_TIME_ASSESSMENTS } from "@/lib/first-time-assessments";
import { cn } from "@/lib/utils";

export function FirstTimeAssessmentLinks({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-brand-mint/40 bg-brand-mint-soft p-5 text-brand-deep",
        className,
      )}
      aria-labelledby="first-time-assessments-title"
    >
      <p className="eyebrow text-brand-deep/70">First-time clients</p>
      <h2 id="first-time-assessments-title" className="mt-2 font-semibold text-brand-deep">
        Complete your assessments before your first session.
      </h2>
      <p className="mt-2 text-sm leading-6 text-brand-deep/75">
        Please complete these links before your first appointment so your therapist has the right
        intake context.
      </p>

      <div className="mt-4 grid gap-2">
        {FIRST_TIME_ASSESSMENTS.map((assessment) => (
          <a
            key={assessment.href}
            href={assessment.href}
            target="_blank"
            rel="noreferrer"
            className="group rounded-xl border border-white/70 bg-white/75 p-3 text-sm transition-colors hover:border-brand-blue/40 hover:bg-white"
          >
            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-brand-deep/60">
              {assessment.label}
            </span>
            <span className="mt-1 flex items-center justify-between gap-3 font-medium text-brand-deep">
              {assessment.title}
              <ExternalLink className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </a>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-white/70 p-3 text-sm text-brand-deep/80">
        <p className="flex gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Forward your 1st assessment result to{" "}
            <a className="text-link" href={`mailto:${FIRST_TIME_ASSESSMENT_EMAIL}`}>
              {FIRST_TIME_ASSESSMENT_EMAIL}
            </a>
            .
          </span>
        </p>
      </div>
    </section>
  );
}
