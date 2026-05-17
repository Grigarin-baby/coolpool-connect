import { Modal, Typography, Avatar, Tag, Space, Button } from "antd";
import { CheckCircle, LogOut } from "lucide-react";
import type { Models } from "appwrite";
import type { AppRole } from "@/lib/domain";
import { formatRoleLabel, getUserDisplayName, getUserInitial } from "@/lib/user-display";

type AppwriteUser = Models.User<Models.Preferences>;

interface UserProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: AppwriteUser | null;
  roles?: AppRole[];
  onSignOut?: () => void;
}

const { Text, Title } = Typography;

export function UserProfileModal({
  open,
  onClose,
  user,
  roles = [],
  onSignOut,
}: UserProfileModalProps) {
  if (!user) return null;

  const displayName = getUserDisplayName(user);
  const roleTags = roles.length > 0 ? roles : (["user"] as AppRole[]);

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      className="profile-modal"
      width={360}
    >
      <div className="flex flex-col items-center text-center pt-2 pb-1">
        <Avatar
          size={64}
          className="bg-gradient-primary text-primary-foreground font-bold text-2xl border-2 border-white shadow"
        >
          {getUserInitial(user)}
        </Avatar>
        <Title level={4} className="!mt-3 !mb-1">
          {displayName}
        </Title>
        {user.email && (
          <Text type="secondary" className="text-sm">
            {user.email}
          </Text>
        )}
        <Space wrap className="justify-center mt-3">
          {roleTags.map((role) => (
            <Tag
              key={role}
              color={role === "admin" ? "purple" : role === "driver" ? "blue" : "default"}
              icon={role === "driver" || role === "admin" ? <CheckCircle size={12} /> : undefined}
            >
              {formatRoleLabel(role)}
            </Tag>
          ))}
        </Space>
      </div>

      {onSignOut && (
        <Button
          danger
          block
          size="large"
          icon={<LogOut size={16} />}
          className="mt-6"
          onClick={() => {
            onClose();
            onSignOut();
          }}
        >
          Logout
        </Button>
      )}
    </Modal>
  );
}
