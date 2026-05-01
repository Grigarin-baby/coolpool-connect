import { useState } from "react";
import { ID } from "appwrite";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { account, appwriteConfig, storage } from "@/integrations/appwrite/client";
import { assignRole, upsertDriverProfile, upsertDriverVehicle } from "@/data/appwrite-repository";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import {
  Button as AntButton,
  Form,
  Input,
  InputNumber,
  Steps,
  Upload,
  type UploadFile,
  type UploadProps,
} from "antd";
import { toast } from "sonner";

export const Route = createFileRoute("/driver/onboarding")({
  head: () => ({
    meta: [
      { title: "Driver onboarding — Coolpool" },
      {
        name: "description",
        content:
          "Complete driver onboarding with personal details, vehicle information, documents, and password setup.",
      },
    ],
  }),
  component: DriverOnboardingPage,
});

type Step = 1 | 2 | 3;

function DriverOnboardingPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [registrationFileList, setRegistrationFileList] = useState<UploadFile[]>([]);
  const [insuranceFileList, setInsuranceFileList] = useState<UploadFile[]>([]);

  const isUserAlreadyExists = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const appwriteError = error as { code?: number; type?: string };
    return appwriteError.code === 409 || appwriteError.type === "user_already_exists";
  };

  const isSessionAlreadyExists = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const appwriteError = error as { code?: number; type?: string };
    return appwriteError.code === 401 && appwriteError.type === "user_session_already_exists";
  };

  const nextStep = async () => {
    if (step === 1) {
      await form.validateFields(["fullName", "email", "phone", "licenseNumber", "city"]);
    }
    if (step === 2) {
      await form.validateFields(["modelName", "plateNumber", "seatCapacity", "color"]);
    }
    if (step < 3) {
      setStep((prev) => (prev + 1) as Step);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as Step);
    }
  };

  const onSubmit = async () => {
    const values = form.getFieldsValue(true) as {
      fullName?: string;
      email?: string;
      phone?: string;
      licenseNumber?: string;
      city?: string;
      modelName?: string;
      plateNumber?: string;
      seatCapacity?: number;
      color?: string;
      password?: string;
      confirmPassword?: string;
    };

    const email = values.email?.trim();
    const fullName = values.fullName?.trim();
    const phone = values.phone?.trim();
    const licenseNumber = values.licenseNumber?.trim();
    const city = values.city?.trim();
    const modelName = values.modelName?.trim();
    const plateNumber = values.plateNumber?.trim();
    const password = values.password ?? "";

    if (!email || !fullName || !phone || !licenseNumber || !city || !modelName || !plateNumber) {
      toast.error("Please complete all required fields before creating account.");
      return;
    }
    if (!password) {
      toast.error("Password is required.");
      return;
    }
    if (registrationFileList.length === 0 || insuranceFileList.length === 0) {
      toast.error("Please upload both registration and insurance documents.");
      return;
    }

    setSubmitting(true);
    try {
      // Ensure onboarding starts from a clean auth state.
      try {
        await account.deleteSession("current");
      } catch {
        // No active session is fine.
      }

      try {
        await account.create(ID.unique(), email, password, fullName);
      } catch (error) {
        if (isUserAlreadyExists(error)) {
          toast.error("This email is already registered. Please use Existing Driver Login.");
          return;
        }
        throw error;
      }

      try {
        await account.createEmailPasswordSession(email, password);
      } catch (error) {
        if (!isSessionAlreadyExists(error)) throw error;
      }
      const me = await account.get();
      const registrationUpload = await storage.createFile(
        appwriteConfig.driverDocsBucketId,
        ID.unique(),
        registrationFileList[0].originFileObj as File,
      );
      const insuranceUpload = await storage.createFile(
        appwriteConfig.driverDocsBucketId,
        ID.unique(),
        insuranceFileList[0].originFileObj as File,
      );

      await upsertDriverProfile({
        userId: me.$id,
        fullName,
        email,
        phone,
        licenseNumber,
        city,
      });
      await upsertDriverVehicle({
        driverUserId: me.$id,
        modelName,
        plateNumber,
        seatCapacity: Number(values.seatCapacity ?? 4),
        color: values.color,
        registrationDoc: registrationUpload.$id,
        insuranceDoc: insuranceUpload.$id,
      });
      await assignRole(me.$id, "driver");
      await account.updatePrefs({
        roles: ["driver"],
        fullName,
      });

      toast.success("Driver account is ready.");
      navigate({ to: "/driver/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete onboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadProps: UploadProps = {
    beforeUpload: () => false,
    maxCount: 1,
    accept: ".pdf,.png,.jpg,.jpeg",
    showUploadList: { showRemoveIcon: true },
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12 max-w-3xl flex-1">
        <Card className="rounded-none border-border/60 p-6 md:p-8 shadow-card">
          <h1 className="text-2xl md:text-3xl font-bold">Driver onboarding</h1>
          <p className="mt-2 text-sm text-muted-foreground">Step {step} of 3</p>
          <Steps
            className="mt-5"
            current={step - 1}
            items={[
              { title: "Personal details" },
              { title: "Vehicle details" },
              { title: "Documents & password" },
            ]}
          />

          <Form
            form={form}
            layout="vertical"
            className="mt-6"
            onFinish={onSubmit}
            initialValues={{ seatCapacity: 4 }}
          >
            {step === 1 && (
              <>
                <Form.Item
                  label="Full name"
                  name="fullName"
                  rules={[{ required: true, message: "Please enter your full name" }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[{ required: true, type: "email", message: "Please enter a valid email" }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Phone"
                  name="phone"
                  rules={[{ required: true, message: "Please enter your phone number" }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Driving license number"
                  name="licenseNumber"
                  rules={[{ required: true, message: "Please enter your license number" }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="City"
                  name="city"
                  rules={[{ required: true, message: "Please enter your city" }]}
                >
                  <Input />
                </Form.Item>
              </>
            )}

            {step === 2 && (
              <>
                <Form.Item
                  label="Vehicle model name"
                  name="modelName"
                  rules={[{ required: true, message: "Please enter vehicle model" }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Plate number"
                  name="plateNumber"
                  rules={[{ required: true, message: "Please enter plate number" }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Seat capacity"
                  name="seatCapacity"
                  rules={[{ required: true, message: "Please enter seat capacity" }]}
                >
                  <InputNumber min={1} max={12} className="w-full" />
                </Form.Item>
                <Form.Item label="Vehicle color (optional)" name="color">
                  <Input />
                </Form.Item>
              </>
            )}

            {step === 3 && (
              <>
                <Form.Item label="Registration document">
                  <Upload
                    {...uploadProps}
                    fileList={registrationFileList}
                    onChange={({ fileList }) => setRegistrationFileList(fileList)}
                    onRemove={() => {
                      setRegistrationFileList([]);
                      return true;
                    }}
                  >
                    <AntButton>Upload registration</AntButton>
                  </Upload>
                </Form.Item>
                <Form.Item label="Insurance document">
                  <Upload
                    {...uploadProps}
                    fileList={insuranceFileList}
                    onChange={({ fileList }) => setInsuranceFileList(fileList)}
                    onRemove={() => {
                      setInsuranceFileList([]);
                      return true;
                    }}
                  >
                    <AntButton>Upload insurance</AntButton>
                  </Upload>
                </Form.Item>
                <Form.Item
                  label="Create password"
                  name="password"
                  rules={[
                    { required: true, min: 6, message: "Password must be at least 6 characters" },
                  ]}
                >
                  <Input.Password />
                </Form.Item>
                <Form.Item
                  label="Confirm password"
                  name="confirmPassword"
                  dependencies={["password"]}
                  rules={[
                    { required: true, message: "Please confirm your password" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue("password") === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error("Passwords do not match"));
                      },
                    }),
                  ]}
                >
                  <Input.Password />
                </Form.Item>
              </>
            )}

            <div className="flex gap-3 pt-2">
              {step > 1 && (
                <AntButton type="default" onClick={prevStep} disabled={submitting}>
                  Back
                </AntButton>
              )}
              {step < 3 ? (
                <AntButton
                  type="primary"
                  className="ml-auto"
                  onClick={() => void nextStep()}
                  disabled={submitting}
                >
                  Proceed
                </AntButton>
              ) : (
                <AntButton
                  type="primary"
                  className="ml-auto"
                  htmlType="submit"
                  loading={submitting}
                >
                  Create driver account
                </AntButton>
              )}
            </div>
          </Form>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}

