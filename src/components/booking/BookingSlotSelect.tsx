import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatSlotTime, slotKey, type BookingSlot } from "@/lib/booking-slots";

export function BookingSlotSelect({
  slots,
  value,
  onValueChange,
  disabled,
  invalid,
  placeholder,
}: {
  slots: BookingSlot[];
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id="preferredTime" aria-invalid={invalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {slots.map((slot) => (
          <SelectItem key={slotKey(slot)} value={slotKey(slot)}>
            {formatSlotTime(slot)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
