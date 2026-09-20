import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  /** Label of the section awaiting deletion; `null` keeps the dialog closed. */
  sectionLabel: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Confirmation step shown before a page section is removed, so a stray click
 * never wipes out content. Deletion stays recoverable afterwards via the
 * "Restore" toast action and undo.
 */
export function ConfirmDeleteSectionDialog({ sectionLabel, onCancel, onConfirm }: Props) {
  return (
    <AlertDialog
      open={sectionLabel !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this section?</AlertDialogTitle>
          <AlertDialogDescription>
            {sectionLabel ? `“${sectionLabel}” ` : "This section "}
            and everything inside it will be removed from the page layout. You can restore it
            straight after with the Restore button in the confirmation toast, or with undo
            (Ctrl/⌘+Z). Nothing changes for visitors until you save or publish.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Keep section</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Delete section
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
