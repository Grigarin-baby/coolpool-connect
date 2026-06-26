import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Modal, Form, Input, Segmented, message } from "antd";
import { UserPlus, KeyRound } from "lucide-react";
import { createUserAsAdmin, resetUserPassword } from "./adminUserApi";

/** "+ Create" button + modal. role fixes whether it creates a host or guest. */
export function CreateUserButton({ role }: { role: "host" | "guest" }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();

  const submit = async (v: any) => {
    setBusy(true);
    try {
      await createUserAsAdmin({
        name: v.name,
        email: v.email,
        phone: v.phone,
        password: v.password,
        gender: v.gender,
        role,
      });
      message.success(`${role === "host" ? "Host" : "Guest"} created.`);
      setOpen(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
    } catch (e: any) {
      message.error(e?.message || "Failed to create user.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="primary" icon={<UserPlus size={15} />} onClick={() => setOpen(true)}>
        Create {role}
      </Button>
      <Modal
        open={open}
        title={`Create ${role}`}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={submit} className="mt-4">
          <Form.Item label="Full name" name="name" rules={[{ required: true }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: "email" }]}>
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item label="Phone" name="phone">
            <Input inputMode="numeric" maxLength={10} placeholder="10-digit mobile" />
          </Form.Item>
          <Form.Item label="Gender" name="gender" initialValue="male">
            <Segmented options={[{ label: "Male", value: "male" }, { label: "Female", value: "female" }]} />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, min: 8, message: "At least 8 characters" }]}
          >
            <Input.Password placeholder="Starting password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={busy} block>
            Create {role}
          </Button>
        </Form>
      </Modal>
    </>
  );
}

/** "Reset password" button + modal for a specific user. */
export function ResetPasswordButton({ userId, block }: { userId: string; block?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();

  const submit = async (v: any) => {
    setBusy(true);
    try {
      await resetUserPassword(userId, v.password);
      message.success("Password updated.");
      setOpen(false);
      form.resetFields();
    } catch (e: any) {
      message.error(e?.message || "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button icon={<KeyRound size={14} />} block={block} onClick={() => setOpen(true)}>
        Reset password
      </Button>
      <Modal open={open} title="Set a new password" onCancel={() => setOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={submit} className="mt-4">
          <Form.Item
            label="New password"
            name="password"
            rules={[{ required: true, min: 8, message: "At least 8 characters" }]}
          >
            <Input.Password placeholder="New password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={busy} block>
            Update password
          </Button>
        </Form>
      </Modal>
    </>
  );
}
