export const PROGRESS_ADMIN_EMAIL = "enyaelvis@gmail.com";

export function hasProgressAccess(
  role: string | null | undefined,
  email: string | null | undefined = null,
) {
  return role === "admin" && email?.trim().toLowerCase() === PROGRESS_ADMIN_EMAIL;
}
