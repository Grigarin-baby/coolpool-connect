import { Modal, Typography, Avatar, Tag, Space, Divider, Card } from "antd";
import { Mail, User as UserIcon, Phone, Calendar, Shield, CheckCircle } from "lucide-react";
import type { Models } from "appwrite";
import type { AppRole } from "@/lib/domain";
import { formatRoleLabel, getUserDisplayName, getUserInitial } from "@/lib/user-display";
import dayjs from "dayjs";

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
  const isDriver = roleTags.includes("driver");
  const isAdmin = roleTags.includes("admin");
  const createdDate = dayjs(user.$createdAt).format("MMM D, YYYY");
  const createdTime = dayjs(user.$createdAt).fromNow();

  return (
    <Modal
      title="My Profile"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      className="profile-modal"
      width={450}
    >
      {/* Header Section with Avatar and Role Badges */}
      <div className="flex flex-col items-center text-center pt-2 pb-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg -mx-6 px-6 py-6">
        <Avatar
          size={80}
          className="bg-gradient-primary text-primary-foreground font-bold text-3xl border-3 border-white shadow-lg"
        >
          {getUserInitial(user)}
        </Avatar>
        <Title level={3} className="!mt-4 !mb-2">
          {displayName}
        </Title>
        {user.email && (
          <Text type="secondary" className="text-sm mb-3">
            {user.email}
          </Text>
        )}
        <Space wrap className="justify-center">
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

      <Divider className="!my-6" />

      {/* Account Details Section */}
      <div className="space-y-4">
        <div>
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-3">
            Account Information
          </Text>

          <dl className="space-y-3 text-sm">
            <div className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
              <UserIcon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Display Name
                </dt>
                <dd className="font-medium break-words text-gray-900 mt-1">
                  {user.name?.trim() || "—"}
                </dd>
              </div>
            </div>

            <div className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
              <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Email
                </dt>
                <dd className="font-medium break-all text-gray-900 mt-1">
                  {user.email || "—"}
                </dd>
              </div>
            </div>

            {user.phone && (
              <div className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                <Phone className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Phone
                  </dt>
                  <dd className="font-medium break-all text-gray-900 mt-1">
                    {user.phone}
                  </dd>
                </div>
              </div>
            )}

            <div className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Member Since
                </dt>
                <dd className="font-medium text-gray-900 mt-1">
                  {createdDate}
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    {createdTime}
                  </span>
                </dd>
              </div>
            </div>

            {(isDriver || isAdmin) && (
              <div className="flex gap-3 items-start p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                <Shield className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                    Status
                  </dt>
                  <dd className="font-medium text-blue-900 mt-1">
                    {isAdmin ? "Administrator Account" : "Verified Host"}
                  </dd>
                </div>
              </div>
            )}
          </dl>
        </div>
      </div>

      <Divider className="!my-6" />

      {/* Account ID Section */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Account ID
        </dt>
        <dd className="font-mono text-xs text-muted-foreground break-all select-all">
          {user.$id}
        </dd>
      </div>

      <Text type="secondary" className="block text-center text-xs mt-6">
        You are signed in to this account on this device.
      </Text>
    </Modal>
  );
}
