import { Modal, Typography, Avatar, Tag, Space, Divider } from "antd";
import { Mail, User as UserIcon } from "lucide-react";
import type { Models } from "appwrite";
import type { AppRole } from "@/lib/domain";
import { formatRoleLabel, getUserDisplayName, getUserInitial } from "@/lib/user-display";

type AppwriteUser = Models.User<Models.Preferences>;

interface UserProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: AppwriteUser | null;
  roles?: AppRole[];
}

const { Text, Title } = Typography;

export function UserProfileModal({ open, onClose, user, roles = [] }: UserProfileModalProps) {
  if (!user) return null;

  const displayName = getUserDisplayName(user);
  const roleTags = roles.length > 0 ? roles : (["user"] as AppRole[]);

  return (
    <Modal
      title="My profile"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      className="profile-modal"
      width={400}
    >
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <Avatar
          size={72}
          className="bg-gradient-primary text-primary-foreground font-bold text-2xl border-2 border-white/60 shadow-soft"
        >
          {getUserInitial(user)}
        </Avatar>
        <Title level={4} className="!mt-4 !mb-1">
          {displayName}
        </Title>
        {user.name?.trim() && user.email ? (
          <Text type="secondary" className="text-sm">
            {user.email}
          </Text>
        ) : null}
        <Space wrap className="mt-3 justify-center">
          {roleTags.map((role) => (
            <Tag key={role} color={role === "admin" ? "purple" : role === "driver" ? "blue" : "default"}>
              {formatRoleLabel(role)}
            </Tag>
          ))}
        </Space>
      </div>

      <Divider className="!my-4" />

      <dl className="space-y-3 text-sm">
        <div className="flex gap-3 items-start">
          <UserIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display name</dt>
            <dd className="font-medium break-words">{user.name?.trim() || "—"}</dd>
          </div>
        </div>
        <div className="flex gap-3 items-start">
          <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</dt>
            <dd className="font-medium break-all">{user.email || "—"}</dd>
          </div>
        </div>
        <div className="flex gap-3 items-start pl-7">
          <div className="min-w-0 flex-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account ID</dt>
            <dd className="font-mono text-xs text-muted-foreground break-all">{user.$id}</dd>
          </div>
        </div>
      </dl>

      <Text type="secondary" className="block text-center text-xs mt-6">
        You are signed in to this account on this device.
      </Text>
    </Modal>
  );
}
