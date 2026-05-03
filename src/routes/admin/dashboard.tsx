import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ConfigProvider,
  Layout,
  Menu,
  Typography,
  Card,
  List,
  Tag,
  Avatar,
  Spin,
  Button,
  Badge,
  Space,
  Dropdown,
} from "antd";
import {
  Shield,
  Users,
  Route as RouteIcon,
  LogOut,
  LayoutDashboard,
  Settings,
  User,
  MoreVertical,
  Activity,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listActiveTrips, listDriverProfiles } from "@/data/appwrite-repository";
import logo from "@/assets/logo.png";
import { APP_FONT_FAMILY } from "@/lib/fonts";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

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
  const { isAdmin, signOut, user } = useAuth();
  const [activeModule, setActiveModule] = useState("overview");

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: listDriverProfiles,
    enabled: isAdmin,
  });

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["admin-active-trips"],
    queryFn: () => listActiveTrips(200),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <Card className="max-w-md text-center rounded-none border-none shadow-elevated bg-white/90 backdrop-blur-md">
          <Text type="danger" strong className="text-lg">
            ACCESS DENIED
          </Text>
          <p className="mt-2 text-muted-foreground">This workspace is restricted to administrator accounts.</p>
          <Button
            type="primary"
            className="mt-4 rounded-none bg-gradient-primary border-none"
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
          borderRadius: 6,
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
                key: "settings",
                icon: <Settings size={18} />,
                label: "System Settings",
                disabled: true,
              },
            ]}
          />

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <Card className="rounded-none bg-secondary/40 border-none backdrop-blur-md">
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
                {activeModule === "overview"
                  ? "Dashboard Overview"
                  : activeModule === "drivers"
                    ? "Driver Directory"
                    : "Trip Manager"}
              </Title>
              <div className="sm:hidden">
                <img src={logo} alt="Coolpool Logo" className="h-16 w-auto object-contain" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:flex flex-col justify-center">
                <Text strong className="text-sm leading-tight block">
                  System Admin
                </Text>
                <Text className="text-[10px] text-primary font-bold uppercase tracking-wider leading-tight">
                  Root Access
                </Text>
              </div>

              <Dropdown
                menu={{
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
            {activeModule === "overview" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col gap-1">
                  <Title level={2} style={{ margin: 0 }}>
                    Administrator Control
                  </Title>
                  <Text type="secondary" className="text-lg">
                    Monitoring the pulse of Coolpool's intercity ride-sharing network.
                  </Text>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="rounded-none border-none shadow-soft hover:shadow-card transition-base bg-white/80 backdrop-blur-sm group">
                    <Text type="secondary" className="group-hover:text-primary transition-colors">
                      Total Drivers
                    </Text>
                    <Title level={2} style={{ margin: "8px 0" }}>
                      {driversLoading ? <Spin size="small" /> : drivers.length}
                    </Title>
                    <Tag color="purple" className="rounded-none px-3 border-none">
                      Active network
                    </Tag>
                  </Card>
                  <Card className="rounded-none border-none shadow-soft hover:shadow-card transition-base bg-white/80 backdrop-blur-sm group">
                    <Text type="secondary" className="group-hover:text-primary transition-colors">
                      Active Routes
                    </Text>
                    <Title level={2} style={{ margin: "8px 0" }}>
                      {tripsLoading ? <Spin size="small" /> : trips.length}
                    </Title>
                    <Tag color="blue" className="rounded-none px-3 border-none">
                      In progress
                    </Tag>
                  </Card>
                  <Card className="rounded-none border-none shadow-soft hover:shadow-card transition-base bg-white/80 backdrop-blur-sm group">
                    <Text type="secondary" className="group-hover:text-primary transition-colors">
                      Network Health
                    </Text>
                    <Title level={2} style={{ margin: "8px 0" }}>
                      100%
                    </Title>
                    <Tag color="success" className="rounded-none px-3 border-none">
                      All systems operational
                    </Tag>
                  </Card>
                  <Card className="rounded-none border-none shadow-soft hover:shadow-card transition-base bg-white/80 backdrop-blur-sm group">
                    <Text type="secondary" className="group-hover:text-primary transition-colors">
                      Security Alerts
                    </Text>
                    <Title level={2} style={{ margin: "8px 0" }}>
                      0
                    </Title>
                    <Tag color="default" className="rounded-none px-3 border-none">
                      Secure
                    </Tag>
                  </Card>
                </div>

                <div className="grid gap-8 lg:grid-cols-2">
                  <Card className="rounded-none border-none shadow-soft bg-white/80 backdrop-blur-sm p-2 overflow-hidden">
                    <div className="p-4 border-b border-border/60 flex items-center justify-between">
                      <Title level={5} style={{ margin: 0 }}>
                        Recent Driver Registrations
                      </Title>
                      <Button type="link" onClick={() => setActiveModule("drivers")}>
                        Manage All
                      </Button>
                    </div>
                    <List
                      className="px-4"
                      itemLayout="horizontal"
                      loading={driversLoading}
                      dataSource={drivers.slice(0, 4)}
                      renderItem={(driver) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={
                              <Avatar className="bg-gradient-primary">
                                {driver.fullName.charAt(0)}
                              </Avatar>
                            }
                            title={<Text strong>{driver.fullName}</Text>}
                            description={`${driver.city} · ${driver.email}`}
                          />
                          <CheckCircle size={16} className="text-success" />
                        </List.Item>
                      )}
                    />
                  </Card>

                  <Card className="rounded-none border-none shadow-soft bg-white/80 backdrop-blur-sm p-2 overflow-hidden">
                    <div className="p-4 border-b border-border/60 flex items-center justify-between">
                      <Title level={5} style={{ margin: 0 }}>
                        Live Traffic Stream
                      </Title>
                      <Button type="link" onClick={() => setActiveModule("trips")}>
                        View Live Map
                      </Button>
                    </div>
                    <List
                      className="px-4"
                      itemLayout="horizontal"
                      loading={tripsLoading}
                      dataSource={trips.slice(0, 4)}
                      renderItem={(trip) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={
                              <div className="h-10 w-10 rounded-none bg-secondary flex items-center justify-center">
                                <Activity size={18} className="text-primary" />
                              </div>
                            }
                            title={
                              <Text strong>
                                {trip.fromLocation} → {trip.toLocation}
                              </Text>
                            }
                            description={`Seats: ${trip.totalSeats} · ₹${trip.totalPrice}`}
                          />
                          <Tag color="processing" bordered={false}>
                            Live
                          </Tag>
                        </List.Item>
                      )}
                    />
                  </Card>
                </div>
              </div>
            )}

            {activeModule === "drivers" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex flex-col gap-1">
                  <Title level={2} style={{ margin: 0 }}>
                    Driver Directory
                  </Title>
                  <Text type="secondary">Review and manage verified driver profiles across the network.</Text>
                </div>

                <Card className="rounded-none border-none shadow-card bg-white/90 backdrop-blur-md p-2 overflow-hidden">
                  <List
                    className="px-6"
                    loading={driversLoading}
                    itemLayout="vertical"
                    dataSource={drivers}
                    locale={{ emptyText: "No drivers registered yet." }}
                    renderItem={(driver) => (
                      <List.Item
                        actions={[
                          <Button key="edit" type="text" size="small">
                            View Profile
                          </Button>,
                          <Button key="verify" type="text" size="small" className="text-primary">
                            Recertify
                          </Button>,
                          <Button key="more" type="text" icon={<MoreVertical size={14} />} />,
                        ]}
                      >
                        <List.Item.Meta
                          avatar={
                            <Avatar size={48} className="bg-gradient-primary">
                              {driver.fullName.charAt(0)}
                            </Avatar>
                          }
                          title={
                            <Title level={5} style={{ margin: 0 }}>
                              {driver.fullName}
                            </Title>
                          }
                          description={
                            <Space split={<Text type="secondary">·</Text>}>
                              <Text type="secondary">{driver.email}</Text>
                              <Text type="secondary">{driver.phone}</Text>
                              <Text type="secondary">License: {driver.licenseNumber}</Text>
                            </Space>
                          }
                        />
                        <div className="mt-2">
                          <Tag color="purple" bordered={false} className="px-3 rounded-none">
                            {driver.city}
                          </Tag>
                          <Tag color="success" bordered={false} className="px-3 rounded-none">
                            Verified Account
                          </Tag>
                        </div>
                      </List.Item>
                    )}
                  />
                </Card>
              </div>
            )}

            {activeModule === "trips" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex flex-col gap-1">
                  <Title level={2} style={{ margin: 0 }}>
                    Trip Manager
                  </Title>
                  <Text type="secondary">Live monitoring of all scheduled and active intercity routes.</Text>
                </div>

                <Card className="rounded-none border-none shadow-card bg-white/90 backdrop-blur-md p-2 overflow-hidden">
                  <List
                    className="px-6"
                    loading={tripsLoading}
                    dataSource={trips}
                    locale={{ emptyText: "No active trips found." }}
                    renderItem={(trip) => (
                      <List.Item
                        actions={[
                          <Button key="track" type="text" size="small">
                            Track Route
                          </Button>,
                          <Button key="details" type="text" size="small">
                            View Bookings
                          </Button>,
                          <Dropdown
                            key="more"
                            menu={{ items: [{ key: "suspend", label: "Suspend", danger: true }] }}
                          >
                            <Button type="text" icon={<MoreVertical size={14} />} />
                          </Dropdown>,
                        ]}
                      >
                        <List.Item.Meta
                          avatar={
                            <div className="h-12 w-12 rounded-none bg-secondary flex items-center justify-center text-primary">
                              <RouteIcon size={24} />
                            </div>
                          }
                          title={
                            <Title level={5} style={{ margin: 0 }}>
                              {trip.fromLocation} → {trip.toLocation}
                            </Title>
                          }
                          description={
                            <Space split={<Text type="secondary">·</Text>}>
                              <Text type="secondary">
                                Departure: {new Date(trip.departureAt).toLocaleString()}
                              </Text>
                              <Text type="secondary">{trip.totalSeats} seats</Text>
                              <Text strong className="text-primary">
                                ₹{trip.totalPrice}
                              </Text>
                            </Space>
                          }
                        />
                        <Tag
                          color={trip.status === "in_progress" ? "processing" : "blue"}
                          bordered={false}
                          className="capitalize px-3 rounded-none"
                        >
                          {trip.status?.replace("_", " ")}
                        </Tag>
                      </List.Item>
                    )}
                  />
                </Card>
              </div>
            )}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

