import * as React from "react";
import { CalendarDays } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateInputProps = Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> & {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  iconLabel?: string;
  wrapperClassName?: string;
};

const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
const displayPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function parseIsoDate(value?: string) {
  if (!value || !isoPattern.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }
  return date;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDisplayDate(value?: string) {
  const date = parseIsoDate(value);
  if (!date) return value ?? "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}/${date.getFullYear()}`;
}

function fromDisplayDate(value: string) {
  const match = displayPattern.exec(value.trim());
  if (!match) return null;
  const [, dayRaw, monthRaw, yearRaw] = match;
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return toIsoDate(date);
}

function isBeforeMin(date: Date, min?: string) {
  const minDate = parseIsoDate(min);
  if (!minDate) return false;
  return date < minDate;
}

function emitDateChange(
  input: HTMLInputElement,
  value: string,
  onChange?: DateInputProps["onChange"],
) {
  if (!onChange) return;
  const previous = input.value;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  onChange({
    target: input,
    currentTarget: input,
  } as React.ChangeEvent<HTMLInputElement>);
  setter?.call(input, previous);
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      className,
      iconLabel = "Open calendar",
      wrapperClassName,
      value = "",
      min,
      onChange,
      onBlur,
      placeholder = "dd/mm/yyyy",
      disabled,
      ...props
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [open, setOpen] = React.useState(false);
    const [displayValue, setDisplayValue] = React.useState(() => toDisplayDate(value));
    const selected = React.useMemo(() => parseIsoDate(value), [value]);

    React.useEffect(() => {
      setDisplayValue(toDisplayDate(value));
    }, [value]);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextDisplay = event.target.value;
      setDisplayValue(nextDisplay);
      const parsed = fromDisplayDate(nextDisplay);
      if (parsed || !nextDisplay.trim()) {
        emitDateChange(event.currentTarget, parsed ?? "", onChange);
      }
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      const parsed = fromDisplayDate(displayValue);
      if (parsed) {
        setDisplayValue(toDisplayDate(parsed));
        emitDateChange(event.currentTarget, parsed, onChange);
      } else if (!displayValue.trim()) {
        emitDateChange(event.currentTarget, "", onChange);
      } else {
        setDisplayValue(toDisplayDate(value));
      }
      onBlur?.(event);
    };

    const handleSelect = (date?: Date) => {
      if (!date || disabled) return;
      const next = toIsoDate(date);
      setDisplayValue(toDisplayDate(next));
      if (inputRef.current) emitDateChange(inputRef.current, next, onChange);
      setOpen(false);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <div className={cn("relative", wrapperClassName)}>
          <Input
            {...props}
            ref={setRefs}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={displayValue}
            min={undefined}
            placeholder={placeholder}
            disabled={disabled}
            onChange={handleTextChange}
            onBlur={handleBlur}
            className={cn("h-11 pr-12 text-base md:text-base", className)}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={iconLabel}
              className="absolute inset-y-1.5 right-1.5 inline-flex aspect-square items-center justify-center rounded-md text-brand-deep transition-colors hover:bg-surface-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled}
            >
              <CalendarDays className="h-5 w-5" aria-hidden />
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            disabled={(date) => isBeforeMin(date, min === undefined ? undefined : String(min))}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>
    );
  },
);
DateInput.displayName = "DateInput";

export { DateInput };
