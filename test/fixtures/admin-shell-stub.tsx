import type { ReactNode } from "react";

// Authentication is tested separately; this harness mounts real dashboard content.
export function AdminWorkspaceShell({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
