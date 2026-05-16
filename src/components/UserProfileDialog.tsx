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

export function UserProfileDialog({ open, onOpenChange, user, roles = [] }: UserProfileDialogProps) {
  if (!user) return null;

  const displayName = getUserDisplayName(user);
  const roleTags = roles.length > 0 ? roles : (["user"] as AppRole[]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>My profile</DialogTitle>
          <DialogDescription>Signed in on this device</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center text-center pt-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-xl font-bold text-primary-foreground">
            {getUserInitial(user)}
          </div>
          <p className="mt-4 text-lg font-semibold">{displayName}</p>
          {user.email ? <p className="text-sm text-muted-foreground">{user.email}</p> : null}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {roleTags.map((role) => (
              <span
                key={role}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {formatRoleLabel(role)}
              </span>
            ))}
          </div>
        </div>

        <dl className="mt-6 space-y-4 border-t border-border pt-6 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display name</dt>
            <dd className="mt-1 font-medium">{user.name?.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</dt>
            <dd className="mt-1 font-medium break-all">{user.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account ID</dt>
            <dd className="mt-1 font-mono text-xs text-muted-foreground break-all">{user.$id}</dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
