export function isStaffEmail(email: string, list: string | undefined): boolean {
  if (!list) return false;
  const wanted = email.trim().toLowerCase();
  return list.split(",").some((e) => e.trim().toLowerCase() === wanted);
}
