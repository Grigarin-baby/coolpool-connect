import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Form,
  Input,
  InputNumber,
  Button,
  Table,
  Tag,
  message,
  Spin,
  Modal,
} from "antd";
import { Wallet, Banknote, History as HistoryIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  getBankAccount,
  upsertBankAccount,
  listPayoutRequestsByDriver,
  createPayoutRequest,
  listHostTrips,
  listHostBookings,
} from "@/data/appwrite-repository";
import {
  hostNetEarnings,
  PLATFORM_FEE_PERCENT,
  estimateGrossFromNet,
  estimateFeeFromNet,
} from "@/lib/pricing";
import type { PayoutStatus } from "@/lib/domain";

const { Title, Text } = Typography;

const STATUS_COLORS: Record<PayoutStatus, string> = {
  pending: "warning",
  processing: "processing",
  paid: "success",
  rejected: "error",
};

interface BankAccountFormValues {
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  upiId?: string;
}

export function PayoutsPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.$id;
  const [bankForm] = Form.useForm<BankAccountFormValues>();
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestForm] = Form.useForm<{ amount: number }>();

  const { data: bankAccount, isLoading: bankLoading } = useQuery({
    queryKey: ["bank-account", userId],
    queryFn: () => (userId ? getBankAccount(userId) : Promise.resolve(null)),
    enabled: !!userId,
  });

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["host-trips", userId],
    queryFn: () => (userId ? listHostTrips(userId) : Promise.resolve([])),
    enabled: !!userId,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["host-bookings", userId],
    queryFn: () => (userId ? listHostBookings(userId) : Promise.resolve([])),
    enabled: !!userId,
  });

  const { data: payoutRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["payout-requests", userId],
    queryFn: () => (userId ? listPayoutRequestsByDriver(userId) : Promise.resolve([])),
    enabled: !!userId,
  });

  useEffect(() => {
    if (bankAccount) {
      bankForm.setFieldsValue({
        accountHolderName: bankAccount.accountHolderName,
        accountNumber: bankAccount.accountNumber,
        confirmAccountNumber: bankAccount.accountNumber,
        ifscCode: bankAccount.ifscCode,
        upiId: bankAccount.upiId ?? undefined,
      });
    }
  }, [bankAccount, bankForm]);

  const saveBankMutation = useMutation({
    mutationFn: (values: BankAccountFormValues) => {
      if (!userId) throw new Error("Not logged in");
      return upsertBankAccount({
        driverUserId: userId,
        accountHolderName: values.accountHolderName,
        accountNumber: values.accountNumber,
        ifscCode: values.ifscCode.toUpperCase(),
        upiId: values.upiId || null,
      });
    },
    onSuccess: () => {
      message.success("Bank details saved.");
      void queryClient.invalidateQueries({ queryKey: ["bank-account", userId] });
      setBankModalOpen(false);
    },
    onError: (error: any) => message.error(error.message || "Failed to save bank details."),
  });

  const requestPayoutMutation = useMutation({
    mutationFn: (amount: number) => {
      if (!userId || !bankAccount) throw new Error("Add your bank details first.");
      // The 5% fee is a flat percentage, so the gross behind any net amount
      // the host chooses to withdraw is exactly amount / 0.95 — snapshot it
      // now so the commission never has to be reverse-estimated later.
      const grossAmount = estimateGrossFromNet(amount);
      return createPayoutRequest({ driverUserId: userId, amount, grossAmount, bankAccount });
    },
    onSuccess: () => {
      message.success("Payout requested. We'll process it soon.");
      void queryClient.invalidateQueries({ queryKey: ["payout-requests", userId] });
      setRequestModalOpen(false);
      requestForm.resetFields();
    },
    onError: (error: any) => message.error(error.message || "Failed to request payout."),
  });

  // Lifetime earnings = gross from non-cancelled bookings on COMPLETED trips
  // (a host earns once the ride actually happens), NET of the platform
  // commission. Matches the dashboard's "Total Earnings" exactly.
  const earnings = useMemo(() => {
    const completedTripIds = new Set(
      trips.filter((t) => t.status === "completed").map((t) => t.id),
    );
    const relevantBookings = bookings.filter(
      (b) => completedTripIds.has(b.tripId) && b.status !== "cancelled",
    );
    const gross = relevantBookings.reduce((sum, b) => sum + b.segmentPrice * b.seatsBooked, 0);
    const lifetime = hostNetEarnings(gross);
    const lifetimeCommission = Math.max(0, gross - lifetime);

    const paidOutRaw = payoutRequests
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + r.amount, 0);
    const pending = payoutRequests
      .filter((r) => r.status === "pending" || r.status === "processing")
      .reduce((sum, r) => sum + r.amount, 0);
    const overpaid = Math.max(0, paidOutRaw - lifetime);
    const available = Math.max(0, lifetime - paidOutRaw - pending);

    return { lifetime, lifetimeCommission, paidOut: paidOutRaw, pending, available, overpaid };
  }, [trips, bookings, payoutRequests]);

  const loading = bankLoading || tripsLoading || bookingsLoading || requestsLoading;

  if (!userId) return null;

  return (
    <div className="space-y-7 sm:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={1} className="!text-3xl sm:!text-4xl !font-extrabold" style={{ margin: 0 }}>
          Payouts
        </Title>
        <Text type="secondary" className="text-base">
          Track your earnings and request withdrawals to your bank. Amounts shown are net of the{" "}
          {PLATFORM_FEE_PERCENT}% platform fee.
          {!loading && earnings.lifetimeCommission > 0 && (
            <>
              {" "}
              You've paid ₹{earnings.lifetimeCommission.toLocaleString("en-IN")} in platform fees so
              far.
            </>
          )}
        </Text>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card className="rounded-2xl border-none shadow-soft bg-white/80">
          <Text type="secondary" className="text-base font-semibold">
            Lifetime earnings
          </Text>
          <Title level={2} className="!text-3xl !font-extrabold" style={{ margin: "4px 0" }}>
            {loading ? <Spin size="small" /> : `₹${earnings.lifetime.toLocaleString("en-IN")}`}
          </Title>
        </Card>
        <Card className="rounded-2xl border-none shadow-soft bg-white/80">
          <Text type="secondary" className="text-base font-semibold">
            Platform commission paid ({PLATFORM_FEE_PERCENT}%)
          </Text>
          <Title
            level={2}
            className="!text-3xl !font-extrabold !text-amber-600"
            style={{ margin: "4px 0" }}
          >
            {loading ? (
              <Spin size="small" />
            ) : (
              `₹${earnings.lifetimeCommission.toLocaleString("en-IN")}`
            )}
          </Title>
        </Card>
        <Card className="rounded-2xl border-none shadow-soft bg-white/80">
          <Text type="secondary" className="text-base font-semibold">
            Available to withdraw
          </Text>
          <Title
            level={2}
            className="!text-3xl !font-extrabold !text-emerald-600"
            style={{ margin: "4px 0" }}
          >
            {loading ? <Spin size="small" /> : `₹${earnings.available.toLocaleString("en-IN")}`}
          </Title>
        </Card>
        <Card className="rounded-2xl border-none shadow-soft bg-white/80">
          <Text type="secondary" className="text-base font-semibold">
            Pending requests
          </Text>
          <Title level={2} className="!text-3xl !font-extrabold" style={{ margin: "4px 0" }}>
            {loading ? <Spin size="small" /> : `₹${earnings.pending.toLocaleString("en-IN")}`}
          </Title>
        </Card>
        <Card className="rounded-2xl border-none shadow-soft bg-white/80">
          <Text type="secondary" className="text-base font-semibold">
            Already paid out
          </Text>
          <Title level={2} className="!text-3xl !font-extrabold" style={{ margin: "4px 0" }}>
            {loading ? <Spin size="small" /> : `₹${earnings.paidOut.toLocaleString("en-IN")}`}
          </Title>
          {!loading && earnings.overpaid > 0 && (
            <Text type="danger" className="text-sm font-semibold">
              Overpaid by ₹{earnings.overpaid.toLocaleString("en-IN")}
            </Text>
          )}
        </Card>
      </div>

      {!loading && earnings.overpaid > 0 && (
        <Card className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 shadow-soft">
          <Text type="danger" strong>
            Paid payouts exceed completed-trip earnings by ₹
            {earnings.overpaid.toLocaleString("en-IN")}.
          </Text>
          <div className="text-sm text-rose-700/80">
            New payout requests are locked until the ledger is corrected or more completed earnings
            are added.
          </div>
        </Card>
      )}

      <Card className="rounded-2xl border-none shadow-soft bg-white/80">
        <div className="flex items-center justify-between mb-5 gap-3">
          <div className="flex items-center gap-2">
            <Banknote size={22} className="text-primary" />
            <Text strong className="text-lg font-bold">
              Bank details
            </Text>
          </div>
          {bankAccount && (
            <Button
              size="large"
              className="rounded-2xl font-semibold"
              onClick={() => setBankModalOpen(true)}
            >
              Edit
            </Button>
          )}
        </div>

        {bankLoading ? (
          <Spin />
        ) : bankAccount ? (
          <div className="text-base space-y-3">
            <div>
              <Text type="secondary">Account holder: </Text>
              <Text strong>{bankAccount.accountHolderName}</Text>
            </div>
            <div>
              <Text type="secondary">Account number: </Text>
              <Text strong>•••• {bankAccount.accountNumber.slice(-4)}</Text>
            </div>
            <div>
              <Text type="secondary">IFSC: </Text>
              <Text strong>{bankAccount.ifscCode}</Text>
            </div>
            {bankAccount.upiId && (
              <div>
                <Text type="secondary">UPI ID: </Text>
                <Text strong>{bankAccount.upiId}</Text>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-stretch sm:items-start gap-3">
            <Text type="secondary" className="text-base">
              Add your bank details to start requesting payouts.
            </Text>
            <Button
              type="primary"
              size="large"
              block
              className="sm:w-auto rounded-2xl font-semibold h-12"
              onClick={() => setBankModalOpen(true)}
            >
              Add bank details
            </Button>
          </div>
        )}
      </Card>

      <Card className="rounded-2xl border-none shadow-soft bg-white/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
          <div className="flex items-center gap-2">
            <Wallet size={22} className="text-primary" />
            <Text strong className="text-lg font-bold">
              Request a payout
            </Text>
          </div>
          <Button
            type="primary"
            size="large"
            block
            disabled={!bankAccount || earnings.available <= 0}
            className="sm:w-auto rounded-2xl font-semibold h-12"
            onClick={() => {
              requestForm.setFieldsValue({ amount: earnings.available });
              setRequestModalOpen(true);
            }}
          >
            Request Payout
          </Button>
        </div>
        {!bankAccount && (
          <Text type="secondary" className="text-base block mt-3">
            Add your bank details above before requesting a payout.
          </Text>
        )}
        {bankAccount && earnings.available <= 0 && (
          <Text type="secondary" className="text-base block mt-3">
            No balance available to withdraw right now.
          </Text>
        )}
      </Card>

      <Card className="rounded-2xl border-none shadow-soft bg-white/80 p-2 overflow-hidden">
        <div className="px-3 pt-3 pb-4 sm:p-4 flex items-center gap-2">
          <HistoryIcon size={22} className="text-primary" />
          <Text strong className="text-lg font-bold">
            Payout history
          </Text>
        </div>

        {/* Mobile: stacked cards instead of a cramped table */}
        <div className="sm:hidden px-2 pb-2 space-y-3">
          {requestsLoading ? (
            <div className="py-6 flex justify-center">
              <Spin />
            </div>
          ) : payoutRequests.length === 0 ? (
            <div className="py-6 text-center">
              <Text type="secondary">No payout requests yet.</Text>
            </div>
          ) : (
            payoutRequests.map((r) => {
              const fee = r.platformFee ?? estimateFeeFromNet(r.amount);
              const isEstimate = r.platformFee == null;
              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-black/5 bg-white p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Text className="text-lg font-bold">₹{r.amount.toLocaleString("en-IN")}</Text>
                    <Tag
                      color={STATUS_COLORS[r.status]}
                      bordered={false}
                      className="capitalize text-sm"
                    >
                      {r.status}
                    </Tag>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(r.requestedAt).toLocaleDateString("en-IN")}
                  </div>
                  <div className="text-sm">
                    <Text type="secondary">Platform commission: </Text>
                    <Text type="secondary" italic={isEstimate}>
                      {isEstimate ? "≈" : ""}₹{fee.toLocaleString("en-IN")}
                    </Text>
                  </div>
                  {r.paymentReference && (
                    <div className="text-sm">
                      <Text type="secondary">Reference: </Text>
                      <Text>{r.paymentReference}</Text>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop / tablet: table */}
        <div className="hidden sm:block">
          <Table
            rowKey="id"
            loading={requestsLoading}
            dataSource={payoutRequests}
            locale={{ emptyText: "No payout requests yet." }}
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: "Date",
                dataIndex: "requestedAt",
                key: "requestedAt",
                render: (date: string) => new Date(date).toLocaleDateString("en-IN"),
              },
              {
                title: "Amount (net)",
                dataIndex: "amount",
                key: "amount",
                render: (amount: number) => `₹${amount.toLocaleString("en-IN")}`,
              },
              {
                title: "Platform commission",
                key: "platformFee",
                render: (_, r) => {
                  const fee = r.platformFee ?? estimateFeeFromNet(r.amount);
                  const isEstimate = r.platformFee == null;
                  return (
                    <Text type="secondary" italic={isEstimate}>
                      {isEstimate ? "≈" : ""}₹{fee.toLocaleString("en-IN")}
                    </Text>
                  );
                },
              },
              {
                title: "Status",
                key: "status",
                render: (_, r) => (
                  <Tag color={STATUS_COLORS[r.status]} bordered={false} className="capitalize">
                    {r.status}
                  </Tag>
                ),
              },
              {
                title: "Reference",
                dataIndex: "paymentReference",
                key: "paymentReference",
                render: (ref?: string | null) => ref || "—",
              },
            ]}
          />
        </div>
      </Card>

      <Modal
        open={bankModalOpen}
        title={<span className="text-xl font-bold">Bank details</span>}
        onCancel={() => {
          setBankModalOpen(false);
          bankForm.resetFields();
          if (bankAccount) {
            bankForm.setFieldsValue({
              accountHolderName: bankAccount.accountHolderName,
              accountNumber: bankAccount.accountNumber,
              confirmAccountNumber: bankAccount.accountNumber,
              ifscCode: bankAccount.ifscCode,
              upiId: bankAccount.upiId ?? undefined,
            });
          }
        }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form
          form={bankForm}
          layout="vertical"
          onFinish={(values) => saveBankMutation.mutate(values)}
          className="mt-4"
        >
          {!bankAccount && (
            <Text type="secondary" className="block mb-4 text-base">
              Add your bank details to start requesting payouts.
            </Text>
          )}
          <Form.Item
            label={<span className="text-base font-semibold">Account holder name</span>}
            name="accountHolderName"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input
              size="large"
              className="rounded-2xl h-14 text-lg"
              placeholder="As per bank records"
            />
          </Form.Item>
          <Form.Item
            label={<span className="text-base font-semibold">Account number</span>}
            name="accountNumber"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input
              size="large"
              className="rounded-2xl h-14 text-lg"
              placeholder="Bank account number"
            />
          </Form.Item>
          <Form.Item
            label={<span className="text-base font-semibold">Confirm account number</span>}
            name="confirmAccountNumber"
            dependencies={["accountNumber"]}
            rules={[
              { required: true, message: "Required" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("accountNumber") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Account numbers do not match"));
                },
              }),
            ]}
          >
            <Input
              size="large"
              className="rounded-2xl h-14 text-lg"
              placeholder="Re-enter account number"
            />
          </Form.Item>
          <Form.Item
            label={<span className="text-base font-semibold">IFSC code</span>}
            name="ifscCode"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input
              size="large"
              className="rounded-2xl h-14 text-lg"
              placeholder="e.g. HDFC0001234"
              style={{ textTransform: "uppercase" }}
            />
          </Form.Item>
          <Form.Item
            label={
              <span className="text-base font-semibold">
                UPI ID <span className="text-sm font-normal text-muted-foreground">(optional)</span>
              </span>
            }
            name="upiId"
          >
            <Input
              size="large"
              className="rounded-2xl h-14 text-lg"
              placeholder="e.g. yourname@okhdfc"
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={saveBankMutation.isPending}
            className="bg-gradient-primary border-none rounded-2xl h-14 font-bold text-lg shadow-glow mt-2"
          >
            Save bank details
          </Button>
        </Form>
      </Modal>

      <Modal
        open={requestModalOpen}
        title={<span className="text-xl font-bold">Request payout</span>}
        onCancel={() => setRequestModalOpen(false)}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form
          form={requestForm}
          layout="vertical"
          onFinish={(values) => requestPayoutMutation.mutate(values.amount)}
          className="mt-4"
        >
          <Form.Item
            label={
              <span className="text-base font-semibold">
                Amount (max ₹{earnings.available.toLocaleString("en-IN")})
              </span>
            }
            name="amount"
            rules={[
              { required: true, message: "Required" },
              {
                validator(_, value) {
                  if (value > 0 && value <= earnings.available) return Promise.resolve();
                  return Promise.reject(new Error("Enter an amount within your available balance"));
                },
              },
            ]}
          >
            <InputNumber
              min={1}
              max={earnings.available}
              className="w-full rounded-2xl h-14 text-lg"
              size="large"
              prefix="₹"
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const amount = Number(getFieldValue("amount")) || 0;
              if (amount <= 0) return null;
              const fee = estimateFeeFromNet(amount);
              const gross = amount + fee;
              return (
                <Text type="secondary" className="block mb-4 text-sm">
                  Gross ₹{gross.toLocaleString("en-IN")} → platform commission ₹
                  {fee.toLocaleString("en-IN")} ({PLATFORM_FEE_PERCENT}%) → you receive ₹
                  {amount.toLocaleString("en-IN")}.
                </Text>
              );
            }}
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={requestPayoutMutation.isPending}
            className="bg-gradient-primary border-none rounded-2xl h-14 font-bold text-lg shadow-glow mt-2"
          >
            Submit request
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
