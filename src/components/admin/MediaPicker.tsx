import { useEffect, useMemo, useState } from "react";
import { Image, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listAdminMedia, type AdminMediaRow } from "@/lib/admin.functions";

export function MediaPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminMediaRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || rows.length > 0) return;
    setLoading(true);
    void listAdminMedia()
      .then(setRows)
      .finally(() => setLoading(false));
  }, [open, rows.length]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.fileName} ${row.altText ?? ""} ${row.tags.join(" ")}`.toLowerCase().includes(needle),
    );
  }, [query, rows]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Image className="mr-2 h-4 w-4" /> Choose from media library
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Choose media</DialogTitle>
            <DialogDescription>
              Select an existing image from the Talk Space media library.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search filename, alt text, or tags…"
              className="pl-9"
            />
          </div>
          <div className="max-h-[55vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No matching media found.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      onChange(row.storagePath);
                      setOpen(false);
                    }}
                    className={`group overflow-hidden rounded-xl border text-left transition hover:border-brand-deep hover:shadow-md ${value === row.storagePath ? "border-brand-deep ring-2 ring-brand-deep/20" : "border-border/70"}`}
                  >
                    <div className="aspect-square bg-muted">
                      {row.publicUrl ? (
                        <img
                          src={row.publicUrl}
                          alt={row.altText ?? row.fileName}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-muted-foreground">
                          <Image className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-medium text-brand-deep">{row.fileName}</p>
                      <p className="mt-1 truncate text-[0.6875rem] text-muted-foreground">
                        {row.altText || "No alt text"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
