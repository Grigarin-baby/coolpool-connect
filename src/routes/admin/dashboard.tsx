import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ConfigProvider,
  Layout,
  Menu,
  Typography,
  Card,
  Avatar,
  Button,
  Badge,
  Dropdown,
} from "antd";
import {
  Users,
  Route as RouteIcon,
  LogOut,
  LayoutDashboard,
  Settings,
  User,
  Activity,
  Image as ImageIcon,
  Car,
  Ticket,
  Wallet,
  UserX,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listActiveTrips } from "@/data/appwrite-repository";
import { BannersManager } from "@/components/admin/BannersManager";
import { DeletedAccountsPanel } from "@/components/admin/DeletedAccountsPanel";
import { OverviewPanel } from "@/components/admin/OverviewPanel";
import { GuestManagementPanel } from "@/components/admin/GuestManagementPanel";
import { HostManagementPanel } from "@/components/admin/HostManagementPanel";
import { DriversPanel } from "@/components/admin/DriversPanel";
import { TripsPanel } from "@/components/admin/TripsPanel";
import { BookingsPanel } from "@/components/admin/BookingsPanel";
import { PayoutsPanel } from "@/components/admin/PayoutsPanel";
import { UserProfileModal } from "@/components/UserProfileModal";
import { getUserDisplayName } from "@/lib/user-display";
import logo from "@/assets/logo.png";
import { APP_FONT_FAMILY } from "@/lib/fonts";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const MODULE_TITLES: Record<string, string> = {
  overview: "Dashboard Overview",
  users: "User Management",
  drivers: "Driver Directory",
  vehicles: "Vehicle Manager",
  trips: "Trip Manager",
  bookings: "Booking Manager",
  pricing: "Pricing Rules",
  payouts: "Payouts",
  banners: "Banners Manager",
};

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — Coolpool" },
      { name: "description", content: "Manage drivers and active trips." },
    ],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const { isAdmin, signOut, user, roles } = useAuth();
  const [activeModule, setActiveModule] = useState("overview");
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["admin-active-trips"],
    queryFn: () => listActiveTrips(200),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <Card className="max-w-md text-center rounded-3xl border-none shadow-elevated bg-white/90 backdrop-blur-md">
          <Text type="danger" strong className="text-lg">
            ACCESS DENIED
          </Text>
          <p className="mt-2 text-muted-foreground">
            This workspace is restricted to administrator accounts.
          </p>
          <Button
            type="primary"
            className="mt-4 rounded-3xl bg-gradient-primary border-none"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#6b46c1",
          borderRadius: 0,
          fontFamily: APP_FONT_FAMILY,
        },
        components: {
          Layout: {
            headerBg: "rgba(255, 255, 255, 0.7)",
            siderBg: "transparent",
            bodyBg: "transparent",
          },
          Menu: {
            itemBg: "transparent",
            itemSelectedBg: "rgba(107, 70, 193, 0.1)",
            itemSelectedColor: "#6b46c1",
          },
        },
      }}
    >
      <Layout className="min-h-screen bg-gradient-hero">
        <Sider
          breakpoint="lg"
          collapsedWidth="0"
          width={280}
          className="border-r border-border/60 backdrop-blur-xl hidden lg:block"
          style={{ position: "sticky", top: 0, height: "100vh", left: 0, zIndex: 100 }}
        >
          <div className="p-6 text-center">
            <img src={logo} alt="Coolpool Logo" className="h-24 w-auto mx-auto object-contain" />
          </div>

          <Menu
            mode="inline"
            selectedKeys={[activeModule]}
            onClick={({ key }) => setActiveModule(key)}
            className="border-none px-2 mt-4"
            items={[
              {
                key: "overview",
                icon: <LayoutDashboard size={18} />,
                label: "Overview",
              },
              {
                key: "guests",
                icon: <Ticket size={18} />,
                label: "Guest Management",
              },
              {
                key: "hosts",
                icon: <Car size={18} />,
                label: "Host Management",
              },
              {
                key: "drivers",
                icon: <Users size={18} />,
                label: "Driver Directory",
              },
              {
                key: "trips",
                icon: <RouteIcon size={18} />,
                label: "Trip Manager",
              },
              {
                key: "bookings",
                icon: <Ticket size={18} />,
                label: "Booking Manager",
              },
              {
                key: "payouts",
                icon: <Wallet size={18} />,
                label: "Payouts",
              },
              {
                key: "banners",
                icon: <ImageIcon size={18} />,
                label: "Banners Manager",
              },
              {
                key: "deleted",
                icon: <UserX size={18} />,
                label: "Deleted Accounts",
              },
            ]}
          />

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <Card className="rounded-3xl bg-secondary/40 border-none backdrop-blur-md">
              <div className="flex items-center gap-3">
                <Badge count={trips.length} overflowCount={99} color="#6b46c1">
                  <Avatar icon={<Activity size={16} />} className="bg-primary/20 text-primary" />
                </Badge>
                <div>
                  <p className="text-xs text-muted-foreground">Active Traffic</p>
                  <p className="text-lg font-bold">{tripsLoading ? "..." : trips.length} routes</p>
                </div>
              </div>
            </Card>
          </div>
        </Sider>

        <Layout>
          <Header className="px-6 flex items-center justify-between border-b border-border/60 backdrop-blur-md sticky top-0 z-10 h-20 bg-background/60">
            <div>
              <Title level={4} style={{ margin: 0 }} className="hidden sm:block">
                {MODULE_TITLES[activeModule] ?? "Dashboard"}
              </Title>
              <div className="sm:hidden">
                <img src={logo} alt="Coolpool Logo" className="h-16 w-auto object-contain" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:flex flex-col justify-center max-w-[180px]">
                <Text strong className="text-sm leading-tight block truncate">
                  {getUserDisplayName(user)}
                </Text>
                <Text className="text-[10px] text-primary font-bold uppercase tracking-wider leading-tight truncate">
                  {user?.email ?? "Administrator"}
                </Text>
              </div>

              <Dropdown
                menu={{
                  onClick: ({ key }) => {
                    if (key === "profile") setProfileModalOpen(true);
                  },
                  items: [
                    { key: "profile", label: "My Profile", icon: <User size={14} /> },
                    { key: "settings", label: "System Config", icon: <Settings size={14} /> },
                    { type: "divider" },
                    {
                      key: "logout",
                      label: "Logout",
                      icon: <LogOut size={14} />,
                      danger: true,
                      onClick: () => void signOut(),
                    },
                  ],
                }}
                trigger={["click"]}
                placement="bottomRight"
              >
                <Badge dot status="processing" offset={[-4, 32]} color="#6b46c1">
                  <Avatar
                    icon={<User size={20} />}
                    className="bg-gradient-primary cursor-pointer shadow-soft border-2 border-white/50"
                    size={40}
                  />
                </Badge>
              </Dropdown>
            </div>
          </Header>

          <Content className="p-6 md:p-10 max-w-7xl mx-auto w-full">
            {activeModule === "overview" && <OverviewPanel onNavigate={setActiveModule} />}
            {activeModule === "guests" && <GuestManagementPanel />}
            {activeModule === "hosts" && <HostManagementPanel />}
            {activeModule === "drivers" && <DriversPanel />}
            {activeModule === "trips" && <TripsPanel />}
            {activeModule === "bookings" && <BookingsPanel />}
            {activeModule === "payouts" && <PayoutsPanel />}
            {activeModule === "banners" && <BannersManager />}
            {activeModule === "deleted" && <DeletedAccountsPanel />}
          </Content>
        </Layout>
      </Layout>

      <UserProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        roles={roles}
      />
    </ConfigProvider>
  );
}
