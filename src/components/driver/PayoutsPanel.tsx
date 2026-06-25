import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Typography, Form, Input, InputNumber, Button, Table, Tag, message, Spin, Modal } from "antd";
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
import { hostNetEarnings, PLATFORM_FEE_PERCENT } from "@/lib/pricing";
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
  const [editingBankDetails, setEditingBankDetails] = useState(false);
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
      setEditingBankDetails(false);
    },
    onError: (error: any) => message.error(error.message || "Failed to save bank details."),
  });

  const requestPayoutMutation = useMutation({
    mutationFn: (amount: number) => {
      if (!userId || !bankAccount) throw new Error("Add your bank details first.");
      return createPayoutRequest({ driverUserId: userId, amount, bankAccount });
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

    const paidOut = payoutRequests
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + r.amount, 0);
    const pending = payoutRequests
      .filter((r) => r.status === "pending" || r.status === "processing")
      .reduce((sum, r) => sum + r.amount, 0);
    const available = Math.max(0, lifetime - paidOut - pending);

    return { lifetime, paidOut, pending, available };
  }, [trips, bookings, payoutRequests]);

  const loading = bankLoading || tripsLoading || bookingsLoading || requestsLoading;

  if (!userId) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          Payouts
        </Title>
        <Text type="secondary">
          Track your earnings and request withdrawals to your bank. Amounts shown are net of the{" "}
          {PLATFORM_FEE_PERCENT}% platform fee.
        </Text>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-none shadow-soft bg-white/80">
          <Text type="secondary">Lifetime earnings</Text>
          <Title level={3} style={{ margin: "4px 0" }}>
            {loading ? <Spin size="small" /> : `₹${earnings.lifetime.toLocaleString("en-IN")}`}
          </Title>
        </Card>
        <Card className="rounded-2xl border-none shadow-soft bg-white/80">
          <Text type="secondary">Available to withdraw</Text>
          <Title level={3} style={{ margin: "4px 0" }} className="!text-emerald-600">
            {loading ? <Spin size="small" /> : `₹${earnings.available.toLocaleString("en-IN")}`}
          </Title>
        </Card>
        <Card className="rounded-2xl border-none shadow-soft bg-white/80">
          <Text type="secondary">Pending requests</Text>
          <Title level={3} style={{ margin: "4px 0" }}>
            {loading ? <Spin size="small" /> : `₹${earnings.pending.toLocaleString("en-IN")}`}
          </Title>
        </Card>
        <Card className="rounded-2xl border-none shadow-soft bg-white/80">
          <Text type="secondary">Already paid out</Text>
          <Title level={3} style={{ margin: "4px 0" }}>
            {loading ? <Spin size="small" /> : `₹${earnings.paidOut.toLocaleString("en-IN")}`}
          </Title>
        </Card>
      </div>

      <Card className="rounded-2xl border-none shadow-soft bg-white/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Banknote size={18} className="text-primary" />
            <Text strong>Bank details</Text>
          </div>
          {bankAccount && !editingBankDetails && (
            <Button size="small" onClick={() => setEditingBankDetails(true)}>
              Edit
            </Button>
          )}
        </div>

        {bankLoading ? (
          <Spin />
        ) : bankAccount && !editingBankDetails ? (
          <div className="text-sm space-y-1">
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
          <Form
            form={bankForm}
            layout="vertical"
            onFinish={(values) => saveBankMutation.mutate(values)}
            className="max-w-md"
          >
            {!bankAccount && (
              <Text type="secondary" className="block mb-3">
                Add your bank details to start requesting payouts.
              </Text>
            )}
            <Form.Item
              label="Account holder name"
              name="accountHolderName"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input placeholder="As per bank records" />
            </Form.Item>
            <Form.Item
              label="Account number"
              name="accountNumber"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input placeholder="Bank account number" />
            </Form.Item>
            <Form.Item
              label="Confirm account number"
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
              <Input placeholder="Re-enter account number" />
            </Form.Item>
            <Form.Item
              label="IFSC code"
              name="ifscCode"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input placeholder="e.g. HDFC0001234" style={{ textTransform: "uppercase" }} />
            </Form.Item>
            <Form.Item label="UPI ID (optional)" name="upiId">
              <Input placeholder="e.g. yourname@okhdfc" />
            </Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" loading={saveBankMutation.isPending}>
                Save bank details
              </Button>
              {bankAccount && (
                <Button onClick={() => setEditingBankDetails(false)}>Cancel</Button>
              )}
            </div>
          </Form>
        )}
      </Card>

      <Card className="rounded-2xl border-none shadow-soft bg-white/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-primary" />
            <Text strong>Request a payout</Text>
          </div>
          <Button
            type="primary"
            disabled={!bankAccount || earnings.available <= 0}
            onClick={() => {
              requestForm.setFieldsValue({ amount: earnings.available });
              setRequestModalOpen(true);
            }}
          >
            Request Payout
          </Button>
        </div>
        {!bankAccount && (
          <Text type="secondary">Add your bank details above before requesting a payout.</Text>
        )}
        {bankAccount && earnings.available <= 0 && (
          <Text type="secondary">No balance available to withdraw right now.</Text>
        )}
      </Card>

      <Card className="rounded-2xl border-none shadow-soft bg-white/80 p-2 overflow-hidden">
        <div className="p-4 flex items-center gap-2">
          <HistoryIcon size={18} className="text-primary" />
          <Text strong>Payout history</Text>
        </div>
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
              title: "Amount",
              dataIndex: "amount",
              key: "amount",
              render: (amount: number) => `₹${amount.toLocaleString("en-IN")}`,
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
      </Card>

      <Modal
        open={requestModalOpen}
        title="Request payout"
        onCancel={() => setRequestModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={requestForm}
          layout="vertical"
          onFinish={(values) => requestPayoutMutation.mutate(values.amount)}
          className="mt-4"
        >
          <Form.Item
            label={`Amount (max ₹${earnings.available.toLocaleString("en-IN")})`}
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
            <InputNumber min={1} max={earnings.available} className="w-full" prefix="₹" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={requestPayoutMutation.isPending} block>
            Submit request
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
