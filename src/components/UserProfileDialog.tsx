import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Models } from "appwrite";
import type { AppRole } from "@/lib/domain";
import { formatRoleLabel, getUserDisplayName, getUserInitial } from "@/lib/user-display";

type AppwriteUser = Models.User<Models.Preferences>;

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AppwriteUser | null;
  roles?: AppRole[];
}

export function UserProfileDialog({
  open,
  onOpenChange,
  user,
  roles = [],
}: UserProfileDialogProps) {
  if (!user) return null;

  const displayName = getUserDisplayName(user);
  const roleTags = roles.length > 0 ? roles : (["user"] as AppRole[]);
  const hasName = !!user.name?.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md mx-4 sm:mx-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>My profile</DialogTitle>
          <DialogDescription>Signed in on this device</DialogDescription>
        </DialogHeader>

        {/* Avatar + identity */}
        <div className="flex flex-col items-center text-center pt-4 pb-2">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary text-3xl font-black text-primary-foreground shadow-glow-sm">
            {getUserInitial(user)}
          </div>
          <p className="mt-4 text-2xl font-black tracking-tight">{displayName}</p>
          {hasName && user.email ? (
            <p className="mt-1 text-base text-muted-foreground break-all">{user.email}</p>
          ) : !hasName && user.email ? (
            <p className="mt-1 text-base text-muted-foreground break-all">{user.email}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {roleTags.map((role) => (
              <span
                key={role}
                className="rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm font-bold"
              >
                {formatRoleLabel(role)}
              </span>
            ))}
          </div>
        </div>

        {/* Detail list */}
        <dl className="mt-4 space-y-3 border-t border-border pt-5 text-sm">
          {hasName && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                Name
              </dt>
              <dd className="font-semibold text-right break-all">{user.name!.trim()}</dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
              Email
            </dt>
            <dd className="font-semibold text-right break-all">{user.email || "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
              Account
            </dt>
            <dd className="font-mono text-xs text-muted-foreground text-right break-all">
              {user.$id}
            </dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
