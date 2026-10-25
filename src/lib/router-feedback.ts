import type { RouterState } from "@tanstack/react-router";

/** Keep feedback visible through both loader work and the pending route commit. */
export function isNavigationPending(state: Pick<RouterState, "isLoading" | "status">) {
  return state.isLoading || state.status === "pending";
}

/** Router boundaries may receive thrown Responses, Errors or arbitrary values. */
export function routeErrorDetails(error: unknown): { message: string; stack?: string } {
  if (error instanceof Response) {
    return { message: `Response ${error.status}${error.url ? ` at ${error.url}` : ""}` };
  }
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}
