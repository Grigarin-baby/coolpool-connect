import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Table,
  Tag,
  Space,
  Button,
  Select,
  Modal,
  Form,
  Input,
  message,
  Drawer,
} from "antd";
import { CheckCircle2, XCircle, Clock3, WalletCards } from "lucide-react";
import { listDriverProfiles, listAllTrips, listAllBookings } from "@/data/appwrite-repository";
import { hostNetEarnings, estimateFeeFromNet, PLATFORM_FEE_PERCENT } from "@/lib/pricing";
import type { PayoutRequest, PayoutStatus } from "@/lib/domain";
import { listPayoutRequestsAsAdmin, updatePayoutRequestAsAdmin } from "./adminUserApi";

const { Title, Text } = Typography;

const STATUS_COLORS: Record<PayoutStatus, string> = {
  pending: "warning",
  processing: "processing",
  paid: "success",
  rejected: "error",
};

function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return `••••${accountNumber.slice(-4)}`;
}

function formatMoney(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN");
}

/** Platform commission for a request: stored at request time, or estimated for legacy rows. */
function feeFor(r: PayoutRequest): { fee: number; isEstimate: boolean } {
  if (r.platformFee != null) return { fee: r.platformFee, isEstimate: false };
  return { fee: estimateFeeFromNet(r.amount), isEstimate: true };
}

function CommissionCell({ request }: { request: PayoutRequest }) {
  const { fee, isEstimate } = feeFor(request);
  return (
    <Text type="secondary" italic={isEstimate}>
      {isEstimate ? "≈" : ""}
      {formatMoney(fee)}
    </Text>
  );
}

export function PayoutsPanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "processing" | "rejected">(
    "all",
  );
  const [actionRequest, setActionRequest] = useState<PayoutRequest | null>(null);
  const [actionType, setActionType] = useState<"paid" | "rejected" | null>(null);
  const [detailHostId, setDetailHostId] = useState<string | null>(null);
  const [detailRequestId, setDetailRequestId] = useState<string | null>(null);
  const [form] = Form.useForm<{ paymentReference?: string; adminNote?: string }>();

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["admin-payout-requests"],
    queryFn: () => listPayoutRequestsAsAdmin(500),
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: listDriverProfiles,
  });

  const { data: trips = [] } = useQuery({
    queryKey: ["admin-all-trips"],
    queryFn: () => listAllTrips(1000),
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["admin-all-bookings"],
    queryFn: () => listAllBookings(1000),
  });

  const driverNameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    drivers.forEach((d) => map.set(d.userId, d.fullName));
    return map;
  }, [drivers]);

  // Net earnings per host = 95% of (price × seats) for non-cancelled bookings
  // on their COMPLETED trips — same rule as the host dashboard/payout panel.
  const earnedByHost = useMemo(() => {
    const grossByHost = new Map<string, number>();
    const completedTripHost = new Map<string, string>();
    for (const t of trips) {
      if (t.status === "completed") completedTripHost.set(t.id, t.hostId);
    }
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const host = completedTripHost.get(b.tripId);
      if (!host) continue;
      grossByHost.set(host, (grossByHost.get(host) ?? 0) + b.segmentPrice * b.seatsBooked);
    }
    const net = new Map<string, number>();
    for (const [host, gross] of grossByHost) net.set(host, hostNetEarnings(gross));
    return net;
  }, [trips, bookings]);

  const paidByHost = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of requests) {
      if (r.status === "paid") m.set(r.driverUserId, (m.get(r.driverUserId) ?? 0) + r.amount);
    }
    return m;
  }, [requests]);

  // Platform commission per host, split by whether it's already realized
  // (paid payouts) or still open (pending/processing requests).
  const commissionByHost = useMemo(() => {
    const paid = new Map<string, number>();
    const open = new Map<string, number>();
    for (const r of requests) {
      const { fee } = feeFor(r);
      if (r.status === "paid") paid.set(r.driverUserId, (paid.get(r.driverUserId) ?? 0) + fee);
      else if (r.status === "pending" || r.status === "processing")
        open.set(r.driverUserId, (open.get(r.driverUserId) ?? 0) + fee);
    }
    return { paid, open };
  }, [requests]);

  const openByHost = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of requests) {
      if (r.status === "pending" || r.status === "processing")
        m.set(r.driverUserId, (m.get(r.driverUserId) ?? 0) + r.amount);
    }
    return m;
  }, [requests]);

  const availableFor = (userId: string) =>
    Math.max(
      0,
      (earnedByHost.get(userId) ?? 0) -
        (paidByHost.get(userId) ?? 0) -
        (openByHost.get(userId) ?? 0),
    );
  const rawAvailableFor = (userId: string) =>
    (earnedByHost.get(userId) ?? 0) - (paidByHost.get(userId) ?? 0) - (openByHost.get(userId) ?? 0);

  // Ledger: one row per host who has earned or transacted.
  const ledger = useMemo(() => {
    const ids = new Set<string>([
      ...earnedByHost.keys(),
      ...paidByHost.keys(),
      ...openByHost.keys(),
    ]);
    return [...ids]
      .map((userId) => ({
        userId,
        name: driverNameByUserId.get(userId) || "Unknown",
        earned: earnedByHost.get(userId) ?? 0,
        paid: paidByHost.get(userId) ?? 0,
        pending: openByHost.get(userId) ?? 0,
        available: availableFor(userId),
        commission:
          (commissionByHost.paid.get(userId) ?? 0) + (commissionByHost.open.get(userId) ?? 0),
      }))
      .sort((a, b) => b.earned - a.earned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earnedByHost, paidByHost, openByHost, commissionByHost, driverNameByUserId]);

  const totalEarnings = useMemo(
    () => [...earnedByHost.values()].reduce((s, v) => s + v, 0),
    [earnedByHost],
  );

  const updateMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      status: PayoutStatus;
      paymentReference?: string;
      adminNote?: string;
    }) =>
      updatePayoutRequestAsAdmin(vars.id, {
        status: vars.status,
        paymentReference: vars.paymentReference,
        adminNote: vars.adminNote,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-payout-requests"] });
      message.success("Payout request updated.");
      setActionRequest(null);
      setActionType(null);
      form.resetFields();
    },
    onError: (error: any) => message.error(error.message || "Failed to update payout request."),
  });

  const processingMutation = useMutation({
    mutationFn: (id: string) => updatePayoutRequestAsAdmin(id, { status: "processing" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-payout-requests"] });
      message.success("Marked as processing.");
    },
    onError: (error: any) => message.error(error.message || "Failed to update payout request."),
  });

  const activeRequests = useMemo(() => requests.filter((r) => r.status !== "paid"), [requests]);

  const paidRequests = useMemo(() => requests.filter((r) => r.status === "paid"), [requests]);

  const filteredRequests =
    statusFilter === "all"
      ? activeRequests
      : activeRequests.filter((r) => r.status === statusFilter);

  const totalPending = requests
    .filter((r) => r.status === "pending" || r.status === "processing")
    .reduce((sum, r) => sum + r.amount, 0);

  const totalPaid = requests
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + r.amount, 0);

  const totalCommissionOpen = requests
    .filter((r) => r.status === "pending" || r.status === "processing")
    .reduce((sum, r) => sum + feeFor(r).fee, 0);

  const totalCommissionPaid = requests
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + feeFor(r).fee, 0);

  const openRequestCount = requests.filter(
    (r) => r.status === "pending" || r.status === "processing",
  ).length;

  const openAction = (record: PayoutRequest, type: "paid" | "rejected") => {
    setActionRequest(record);
    setActionType(type);
    form.resetFields();
  };

  const openDetails = (record: PayoutRequest) => {
    setDetailHostId(record.driverUserId);
    setDetailRequestId(record.id);
  };

  const submitAction = (values: { paymentReference?: string; adminNote?: string }) => {
    if (!actionRequest || !actionType) return;
    if (actionType === "paid") {
      const payableHeadroom = rawAvailableFor(actionRequest.driverUserId) + actionRequest.amount;
      if (actionRequest.amount > payableHeadroom) {
        message.error(
          `Cannot pay ${formatMoney(actionRequest.amount)}. Only ${formatMoney(Math.max(0, payableHeadroom))} is payable after earlier payouts.`,
        );
        setActionRequest(null);
        setActionType(null);
        form.resetFields();
        return;
      }
    }
    updateMutation.mutate({
      id: actionRequest.id,
      status: actionType,
      paymentReference: values.paymentReference,
      adminNote: values.adminNote,
    });
  };

  const detailRequests = useMemo(
    () => requests.filter((r) => r.driverUserId === detailHostId),
    [requests, detailHostId],
  );

  const detailRequest =
    detailRequests.find((r) => r.id === detailRequestId) ?? detailRequests[0] ?? null;
  const detailHostName = detailHostId ? driverNameByUserId.get(detailHostId) || "Unknown" : "";
  const detailOpenRequests = detailRequests.filter(
    (r) => r.status === "pending" || r.status === "processing",
  );
  const detailPaidRequests = detailRequests.filter((r) => r.status === "paid");
  const detailRejectedRequests = detailRequests.filter((r) => r.status === "rejected");
  const detailEarned = detailHostId ? (earnedByHost.get(detailHostId) ?? 0) : 0;
  const detailPaid = detailHostId ? (paidByHost.get(detailHostId) ?? 0) : 0;
  const detailOpen = detailHostId ? (openByHost.get(detailHostId) ?? 0) : 0;
  const detailAvailable = detailHostId ? availableFor(detailHostId) : 0;

  const renderPayoutActions = (record: PayoutRequest) => {
    if (record.status !== "pending" && record.status !== "processing") {
      return (
        <Text type="secondary">
          {record.processedAt ? new Date(record.processedAt).toLocaleDateString("en-IN") : "—"}
        </Text>
      );
    }

    const payableHeadroom = rawAvailableFor(record.driverUserId) + record.amount;
    const canPay = record.amount <= payableHeadroom;

    return (
      <Space direction="vertical" size="small">
        {record.status === "pending" && (
          <Button
            size="small"
            icon={<Clock3 size={14} />}
            loading={processingMutation.isPending}
            onClick={(event) => {
              event.stopPropagation();
              processingMutation.mutate(record.id);
            }}
          >
            Mark Processing
          </Button>
        )}
        <Button
          type="primary"
          size="small"
          icon={<CheckCircle2 size={14} />}
          disabled={!canPay}
          title={
            canPay
              ? undefined
              : `Only ${formatMoney(Math.max(0, payableHeadroom))} is payable after earlier payouts`
          }
          onClick={(event) => {
            event.stopPropagation();
            if (!canPay) {
              message.error(
                `Cannot pay ${formatMoney(record.amount)}. Only ${formatMoney(Math.max(0, payableHeadroom))} is payable after earlier payouts.`,
              );
              return;
            }
            openAction(record, "paid");
          }}
        >
          Mark Paid
        </Button>
        {!canPay && (
          <Text type="danger" className="text-xs">
            Over request by {formatMoney(record.amount - Math.max(0, payableHeadroom))}
          </Text>
        )}
        <Button
          danger
          size="small"
          icon={<XCircle size={14} />}
          onClick={(event) => {
            event.stopPropagation();
            openAction(record, "rejected");
          }}
        >
          Reject
        </Button>
      </Space>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          Payouts
        </Title>
        <Text type="secondary">
          Review payout requests from hosts/drivers and mark them as paid once you've sent the money
          manually.
        </Text>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md">
          <Text type="secondary">Total host earnings</Text>
          <Title level={3} style={{ margin: "4px 0" }} className="!text-emerald-600">
            ₹{totalEarnings.toLocaleString("en-IN")}
          </Title>
        </Card>
        <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md">
          <Text type="secondary">Open requests</Text>
          <Title level={3} style={{ margin: "4px 0" }}>
            {openRequestCount}
          </Title>
        </Card>
        <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md">
          <Text type="secondary">Pending + processing amount</Text>
          <Title level={3} style={{ margin: "4px 0" }}>
            ₹{totalPending.toLocaleString("en-IN")}
          </Title>
        </Card>
        <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md">
          <Text type="secondary">Total paid out</Text>
          <Title level={3} style={{ margin: "4px 0" }}>
            ₹{totalPaid.toLocaleString("en-IN")}
          </Title>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md">
          <Text type="secondary">Platform commission — open ({PLATFORM_FEE_PERCENT}%)</Text>
          <Title level={3} style={{ margin: "4px 0" }} className="!text-amber-600">
            ₹{totalCommissionOpen.toLocaleString("en-IN")}
          </Title>
          <Text type="secondary" className="text-xs">
            Across pending/processing requests
          </Text>
        </Card>
        <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md">
          <Text type="secondary">Platform commission — realized ({PLATFORM_FEE_PERCENT}%)</Text>
          <Title level={3} style={{ margin: "4px 0" }} className="!text-amber-600">
            ₹{totalCommissionPaid.toLocaleString("en-IN")}
          </Title>
          <Text type="secondary" className="text-xs">
            Across paid payouts. Compare against Overview → Platform earnings, which counts every
            completed-trip booking (incl. earnings not yet withdrawn).
          </Text>
        </Card>
      </div>

      <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md p-2 overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <Text strong>Payout requests</Text>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 180 }}
            options={[
              { value: "all", label: "All requests" },
              { value: "pending", label: "Pending" },
              { value: "processing", label: "Processing" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
        </div>
        <Table
          rowKey="id"
          loading={requestsLoading || driversLoading}
          dataSource={filteredRequests}
          locale={{ emptyText: "No payout requests yet." }}
          pagination={{ pageSize: 10 }}
          onRow={(record) => ({
            onClick: () => openDetails(record),
            className: "cursor-pointer",
          })}
          columns={[
            {
              title: "Driver/Host",
              key: "driver",
              render: (_, r) => {
                const earned = earnedByHost.get(r.driverUserId) ?? 0;
                const rawAvailable = rawAvailableFor(r.driverUserId);
                // For an open request, availability excludes all open requests.
                // Add this one back without clamping negatives, otherwise prior
                // overpayments look payable.
                const headroom =
                  rawAvailable +
                  (r.status === "pending" || r.status === "processing" ? r.amount : 0);
                const ok = r.amount <= headroom;
                return (
                  <div>
                    <Text strong>{driverNameByUserId.get(r.driverUserId) || "Unknown"}</Text>
                    <div className="text-xs text-muted-foreground">
                      Earned ₹{earned.toLocaleString("en-IN")}
                    </div>
                    {(r.status === "pending" || r.status === "processing") && (
                      <div
                        className={`text-xs font-semibold ${ok ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {ok
                          ? `✓ ₹${r.amount} of ₹${headroom.toLocaleString("en-IN")} available`
                          : `⚠ ₹${r.amount} > ₹${Math.max(0, headroom).toLocaleString("en-IN")} payable`}
                      </div>
                    )}
                  </div>
                );
              },
            },
            {
              title: "Amount",
              dataIndex: "amount",
              key: "amount",
              render: (amount: number) => formatMoney(amount),
            },
            {
              title: "Platform commission",
              key: "platformFee",
              render: (_, r) => <CommissionCell request={r} />,
            },
            {
              title: "Bank details",
              key: "bank",
              render: (_, r) => (
                <div className="text-sm">
                  <div>{r.accountHolderName}</div>
                  <div className="text-muted-foreground">
                    {maskAccountNumber(r.accountNumber)} · {r.ifscCode}
                  </div>
                  {r.upiId && <div className="text-muted-foreground">UPI: {r.upiId}</div>}
                </div>
              ),
            },
            {
              title: "Requested",
              dataIndex: "requestedAt",
              key: "requestedAt",
              render: (date: string) => formatDateTime(date),
            },
            {
              title: "Status",
              key: "status",
              render: (_, r) => (
                <div className="flex flex-col gap-1">
                  <Tag
                    color={STATUS_COLORS[r.status]}
                    bordered={false}
                    className="capitalize w-fit"
                  >
                    {r.status}
                  </Tag>
                  {r.paymentReference && (
                    <Text type="secondary" className="text-xs">
                      Ref: {r.paymentReference}
                    </Text>
                  )}
                  {r.adminNote && (
                    <Text type="secondary" className="text-xs">
                      Note: {r.adminNote}
                    </Text>
                  )}
                </div>
              ),
            },
            {
              title: "Actions",
              key: "actions",
              render: (_, r) => renderPayoutActions(r),
            },
          ]}
        />
      </Card>

      <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md p-2 overflow-hidden">
        <div className="p-4">
          <Text strong>Paid payouts</Text>
          <div className="text-xs text-muted-foreground">
            Completed transfers are kept here, away from active payout requests.
          </div>
        </div>
        <Table
          rowKey="id"
          loading={requestsLoading || driversLoading}
          dataSource={paidRequests}
          locale={{ emptyText: "No paid payouts yet." }}
          pagination={{ pageSize: 10 }}
          onRow={(record) => ({
            onClick: () => openDetails(record),
            className: "cursor-pointer",
          })}
          columns={[
            {
              title: "Driver/Host",
              key: "driver",
              render: (_, r) => (
                <div>
                  <Text strong>{driverNameByUserId.get(r.driverUserId) || "Unknown"}</Text>
                  <div className="text-xs text-muted-foreground">
                    Paid from request dated {new Date(r.requestedAt).toLocaleDateString("en-IN")}
                  </div>
                </div>
              ),
            },
            {
              title: "Amount",
              dataIndex: "amount",
              key: "amount",
              render: (amount: number) => formatMoney(amount),
            },
            {
              title: "Platform commission",
              key: "platformFee",
              render: (_, r) => <CommissionCell request={r} />,
            },
            {
              title: "Bank snapshot",
              key: "bank",
              render: (_, r) => (
                <div className="text-sm">
                  <div>{r.accountHolderName}</div>
                  <div className="text-muted-foreground">
                    {maskAccountNumber(r.accountNumber)} · {r.ifscCode}
                  </div>
                  {r.upiId && <div className="text-muted-foreground">UPI: {r.upiId}</div>}
                </div>
              ),
            },
            {
              title: "Paid on",
              key: "processedAt",
              render: (_, r) => formatDateTime(r.processedAt),
            },
            {
              title: "Reference",
              key: "reference",
              render: (_, r) => (
                <div className="text-sm">
                  <Text strong>{r.paymentReference || "—"}</Text>
                  {r.adminNote && <div className="text-muted-foreground">Note: {r.adminNote}</div>}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md p-2 overflow-hidden">
        <div className="p-4">
          <Text strong>Earnings by host</Text>
          <div className="text-xs text-muted-foreground">
            Net earnings from completed trips, what's been paid, and what's available to withdraw.
          </div>
        </div>
        <Table
          rowKey="userId"
          loading={requestsLoading || driversLoading}
          dataSource={ledger}
          locale={{ emptyText: "No host earnings yet." }}
          pagination={{ pageSize: 10 }}
          onRow={(record) => ({
            onClick: () => {
              setDetailHostId(record.userId);
              setDetailRequestId(null);
            },
            className: "cursor-pointer",
          })}
          columns={[
            {
              title: "Host",
              dataIndex: "name",
              key: "name",
              render: (v: string) => <Text strong>{v}</Text>,
            },
            { title: "Earned (net)", key: "earned", render: (_, r) => formatMoney(r.earned) },
            { title: "Paid out", key: "paid", render: (_, r) => formatMoney(r.paid) },
            { title: "Pending", key: "pending", render: (_, r) => formatMoney(r.pending) },
            {
              title: "Commission generated",
              key: "commission",
              render: (_, r) => <Text type="secondary">{formatMoney(r.commission)}</Text>,
            },
            {
              title: "Available",
              key: "available",
              render: (_, r) => (
                <Text strong className="!text-emerald-600">
                  {formatMoney(r.available)}
                </Text>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        open={!!detailHostId}
        width={620}
        title={
          <div className="flex items-center gap-2">
            <WalletCards size={18} />
            <span>{detailHostName} payout details</span>
          </div>
        }
        onClose={() => {
          setDetailHostId(null);
          setDetailRequestId(null);
        }}
      >
        {detailHostId && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Earned", detailEarned],
                ["Open", detailOpen],
                ["Paid", detailPaid],
                ["Available", detailAvailable],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-xl font-bold">{formatMoney(Number(value))}</div>
                </div>
              ))}
            </div>

            {detailRequest && (
              <section className="rounded-3xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <Text strong>Selected request</Text>
                    <div className="text-xs text-muted-foreground">
                      Requested {formatDateTime(detailRequest.requestedAt)}
                    </div>
                  </div>
                  <Tag
                    color={STATUS_COLORS[detailRequest.status]}
                    bordered={false}
                    className="capitalize"
                  >
                    {detailRequest.status}
                  </Tag>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Amount (net to host)</div>
                    <div className="font-bold">{formatMoney(detailRequest.amount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Platform commission ({PLATFORM_FEE_PERCENT}%)
                    </div>
                    <div className="font-semibold">
                      <CommissionCell request={detailRequest} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Gross amount</div>
                    <div className="font-semibold">
                      {detailRequest.grossAmount != null
                        ? formatMoney(detailRequest.grossAmount)
                        : `≈${formatMoney(detailRequest.amount + feeFor(detailRequest).fee)}`}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Processed</div>
                    <div className="font-semibold">{formatDateTime(detailRequest.processedAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Account holder</div>
                    <div className="font-semibold">{detailRequest.accountHolderName || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Account number</div>
                    <div className="font-semibold">{detailRequest.accountNumber || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">IFSC</div>
                    <div className="font-semibold">{detailRequest.ifscCode || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">UPI ID</div>
                    <div className="font-semibold">{detailRequest.upiId || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Payment reference</div>
                    <div className="font-semibold">{detailRequest.paymentReference || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Admin note</div>
                    <div className="font-semibold">{detailRequest.adminNote || "—"}</div>
                  </div>
                </div>
                <div className="mt-4">{renderPayoutActions(detailRequest)}</div>
              </section>
            )}

            <section className="space-y-3">
              <div>
                <Text strong>Pending payments</Text>
                <div className="text-xs text-muted-foreground">
                  Requests waiting for processing or manual transfer.
                </div>
              </div>
              {detailOpenRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No pending payouts for this host.
                </div>
              ) : (
                detailOpenRequests.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    className="w-full rounded-2xl border border-border bg-white p-4 text-left transition hover:border-primary/60"
                    onClick={() => setDetailRequestId(request.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold">{formatMoney(request.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(request.requestedAt)}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {request.accountHolderName} · {request.accountNumber || "No account"} ·{" "}
                          {request.ifscCode || "No IFSC"}
                        </div>
                        {request.upiId && (
                          <div className="text-sm text-muted-foreground">UPI: {request.upiId}</div>
                        )}
                      </div>
                      <Tag
                        color={STATUS_COLORS[request.status]}
                        bordered={false}
                        className="capitalize"
                      >
                        {request.status}
                      </Tag>
                    </div>
                  </button>
                ))
              )}
            </section>

            <section className="space-y-3">
              <div>
                <Text strong>Paid history</Text>
                <div className="text-xs text-muted-foreground">
                  Completed manual transfers and their references.
                </div>
              </div>
              {detailPaidRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No paid payout history yet.
                </div>
              ) : (
                detailPaidRequests.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    className="w-full rounded-2xl border border-border bg-white p-4 text-left transition hover:border-primary/60"
                    onClick={() => setDetailRequestId(request.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold">{formatMoney(request.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          Requested {formatDateTime(request.requestedAt)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Paid {formatDateTime(request.processedAt)}
                        </div>
                        <div className="mt-2 text-sm">
                          Ref:{" "}
                          <span className="font-semibold">{request.paymentReference || "—"}</span>
                        </div>
                        {request.adminNote && (
                          <div className="text-sm text-muted-foreground">
                            Note: {request.adminNote}
                          </div>
                        )}
                      </div>
                      <Tag color="success" bordered={false}>
                        Paid
                      </Tag>
                    </div>
                  </button>
                ))
              )}
            </section>

            {detailRejectedRequests.length > 0 && (
              <section className="space-y-3">
                <Text strong>Rejected history</Text>
                {detailRejectedRequests.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    className="w-full rounded-2xl border border-border bg-white p-4 text-left transition hover:border-primary/60"
                    onClick={() => setDetailRequestId(request.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold">{formatMoney(request.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          Rejected {formatDateTime(request.processedAt)}
                        </div>
                        {request.adminNote && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            Note: {request.adminNote}
                          </div>
                        )}
                      </div>
                      <Tag color="error" bordered={false}>
                        Rejected
                      </Tag>
                    </div>
                  </button>
                ))}
              </section>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={!!actionRequest}
        title={actionType === "paid" ? "Mark payout as paid" : "Reject payout request"}
        onCancel={() => {
          setActionRequest(null);
          setActionType(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={submitAction} className="mt-4">
          {actionType === "paid" && (
            <Form.Item
              label="Payment reference (UTR / Transaction ID)"
              name="paymentReference"
              rules={[{ required: true, message: "Enter the transfer reference number" }]}
            >
              <Input placeholder="e.g. 308812345678" />
            </Form.Item>
          )}
          <Form.Item label="Note (optional)" name="adminNote">
            <Input.TextArea
              rows={3}
              placeholder={
                actionType === "paid" ? "Any internal notes…" : "Reason for rejecting this request"
              }
            />
          </Form.Item>
          <Button
            type="primary"
            danger={actionType === "rejected"}
            htmlType="submit"
            loading={updateMutation.isPending}
            block
          >
            {actionType === "paid" ? "Confirm Paid" : "Confirm Reject"}
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
