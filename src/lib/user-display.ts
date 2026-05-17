import type { Models } from "appwrite";
import type { AppRole } from "@/lib/domain";

type UserLike = Pick<Models.User<Models.Preferences>, "name" | "email"> | null | undefined;

export function getUserDisplayName(user: UserLike): string {
  const name = user?.name?.trim();
  if (name) return name;
  const email = user?.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Signed-in user";
}

export function getUserInitial(user: UserLike): string {
  const name = user?.name?.trim();
  if (name) return name[0]!.toUpperCase();
  const email = user?.email?.trim();
  if (email) return email[0]!.toUpperCase();
  return "U";
}

export function formatRoleLabel(role: AppRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "driver":
      return "Host";
    case "user":
      return "Passenger";
    default:
      return role;
  }
}
