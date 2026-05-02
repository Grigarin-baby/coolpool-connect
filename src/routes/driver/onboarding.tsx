import { useState } from "react";
import { ID } from "appwrite";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { account, appwriteConfig, storage } from "@/integrations/appwrite/client";
import { assignRole, upsertDriverProfile, upsertDriverVehicle } from "@/data/appwrite-repository";
import { useAuth } from "@/hooks/useAuth";
import { Form, Input, InputNumber, Upload, type UploadFile, type UploadProps } from "antd";
import { toast } from "sonner";
import {
  User, Mail, Phone, CreditCard, MapPin, Car, Hash, Users, Palette,
  FileText, Shield, Lock, ChevronRight, ChevronLeft, Sparkles, CheckCircle,
} from "lucide-react";

export const Route = createFileRoute("/driver/onboarding")({
  head: () => ({
    meta: [
      { title: "Ride Host onboarding — Coolpool" },
      { name: "description", content: "Complete ride host onboarding with personal details, vehicle information, documents, and password setup." },
    ],
  }),
  component: DriverOnboardingPage,
});

type Step = 1 | 2 | 3;

const STEPS = [
  { label: "Personal", icon: User },
  { label: "Vehicle", icon: Car },
  { label: "Documents", icon: Shield },
];

function calcPasswordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const strengthLabel = ["", "Weak", "Fair", "Strong", "Very Strong"];
const strengthColor = ["", "#ef4444", "#f59e0b", "#10b981", "#6366f1"];

function DriverOnboardingPage() {
  const navigate = useNavigate();
  const { user, refreshRoles } = useAuth();
  const [form] = Form.useForm();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [registrationFileList, setRegistrationFileList] = useState<UploadFile[]>([]);
  const [insuranceFileList, setInsuranceFileList] = useState<UploadFile[]>([]);
  const [password, setPassword] = useState("");
  const pwStrength = calcPasswordStrength(password);

  // Live vehicle preview
  const modelWatch = Form.useWatch("modelName", form) as string | undefined;
  const plateWatch = Form.useWatch("plateNumber", form) as string | undefined;
  const colorWatch = Form.useWatch("color", form) as string | undefined;
  const seatsWatch = Form.useWatch("seatCapacity", form) as number | undefined;

  const isUserAlreadyExists = (e: unknown) => {
    const err = e as { code?: number; type?: string };
    return err?.code === 409 || err?.type === "user_already_exists";
  };
  const isSessionAlreadyExists = (e: unknown) => {
    const err = e as { code?: number; type?: string };
    return err?.code === 401 && err?.type === "user_session_already_exists";
  };

  const nextStep = async () => {
    if (step === 1) await form.validateFields(["fullName","email","phone","licenseNumber","city"]);
    if (step === 2) await form.validateFields(["modelName","plateNumber","seatCapacity"]);
    if (step < 3) setStep((p) => (p + 1) as Step);
  };
  const prevStep = () => { if (step > 1) setStep((p) => (p - 1) as Step); };

  const onSubmit = async () => {
    const v = form.getFieldsValue(true) as Record<string, string | number>;
    const email = String(v.email ?? "").trim();
    const fullName = String(v.fullName ?? "").trim();
    const phone = String(v.phone ?? "").trim();
    const licenseNumber = String(v.licenseNumber ?? "").trim();
    const city = String(v.city ?? "").trim();
    const modelName = String(v.modelName ?? "").trim();
    const plateNumber = String(v.plateNumber ?? "").trim();
    const pw = String(v.password ?? "");

    if (!email || !fullName || !phone || !licenseNumber || !city || !modelName || !plateNumber) {
      toast.error("Please complete all required fields."); return;
    }
    if (!user && !pw) { toast.error("Password is required."); return; }
    if (registrationFileList.length === 0 || insuranceFileList.length === 0) {
      toast.error("Please upload both documents."); return;
    }

    setSubmitting(true);
    try {
      let userId = user?.$id;
      if (!user) {
        try { await account.deleteSession("current"); } catch { /* ok */ }
        try {
          await account.create(ID.unique(), email, pw, fullName);
        } catch (err) {
          if (isUserAlreadyExists(err)) {
            toast.error("Email already registered. Please log in first."); return;
          }
          throw err;
        }
        try { await account.createEmailPasswordSession(email, pw); }
        catch (err) { if (!isSessionAlreadyExists(err)) throw err; }
        userId = (await account.get()).$id;
      }
      if (!userId) throw new Error("User ID missing.");

      const regUp = await storage.createFile(appwriteConfig.driverDocsBucketId, ID.unique(), registrationFileList[0].originFileObj as File);
      const insUp = await storage.createFile(appwriteConfig.driverDocsBucketId, ID.unique(), insuranceFileList[0].originFileObj as File);

      await upsertDriverProfile({ userId, fullName, email, phone, licenseNumber, city });
      await upsertDriverVehicle({
        driverUserId: userId, modelName, plateNumber,
        seatCapacity: Number(v.seatCapacity ?? 4),
        color: v.color ? String(v.color) : undefined,
        registrationDoc: regUp.$id, insuranceDoc: insUp.$id,
      });
      await assignRole(userId, "driver");
      const existingRoles: string[] = user?.prefs?.roles || [];
      await account.updatePrefs({ ...(user?.prefs || {}), roles: Array.from(new Set([...existingRoles, "driver"])), fullName });
      await refreshRoles();
      toast.success("Ride Host account is ready.");
      navigate({ to: "/driver/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to complete onboarding.");
    } finally { setSubmitting(false); }
  };

  const uploadProps: UploadProps = { beforeUpload: () => false, maxCount: 1, accept: ".pdf,.png,.jpg,.jpeg" };

  return (
    <div className="min-h-screen bg-gradient-hero flex">
      {/* ── Left hero panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between p-10 bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 relative overflow-hidden shrink-0">
        {/* decorative blobs */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-0 w-56 h-56 bg-indigo-400/20 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <span className="text-white font-bold text-xl">Coolpool</span>
          </div>

          <h2 className="text-4xl font-extrabold text-white leading-tight">
            Start earning on<br />your own schedule.
          </h2>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">
            Join thousands of ride hosts sharing their daily routes and covering trip costs effortlessly.
          </p>

          <div className="mt-10 space-y-5">
            {[
              { icon: "💰", title: "Earn per seat", desc: "Set your own price per passenger" },
              { icon: "🗺️", title: "Share your route", desc: "Post trips you're already taking" },
              { icon: "🛡️", title: "Trusted community", desc: "OTP-verified bookings only" },
            ].map((b) => (
              <div key={b.title} className="flex items-start gap-4">
                <span className="text-2xl">{b.icon}</span>
                <div>
                  <p className="text-white font-semibold">{b.title}</p>
                  <p className="text-white/60 text-sm">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step tracker on left panel */}
        <div className="relative z-10 space-y-3">
          {STEPS.map((s, i) => {
            const idx = i + 1;
            const done = step > idx;
            const active = step === idx;
            return (
              <div key={s.label} className={`flex items-center gap-3 transition-all ${active ? "opacity-100" : "opacity-50"}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                  ${done ? "bg-emerald-400 text-white" : active ? "bg-white text-purple-700" : "bg-white/20 text-white"}`}>
                  {done ? <CheckCircle size={16} /> : idx}
                </div>
                <span className={`text-sm font-medium ${active ? "text-white" : "text-white/60"}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-5 pt-6 pb-4">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg">Coolpool</span>
        </div>

        {/* Mobile progress bar */}
        <div className="lg:hidden px-5 mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Step {step} of 3 — {STEPS[step - 1].label}
            </span>
            <span className="text-xs text-muted-foreground">{Math.round((step / 3) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Scrollable form area */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 lg:px-12 py-6 pb-32 lg:pb-10">
          <div className="max-w-lg mx-auto lg:max-w-none">
            {/* Desktop heading */}
            <div className="hidden lg:block mb-8">
              <h1 className="text-3xl font-extrabold text-gray-900">Ride Host onboarding</h1>
              <p className="mt-1 text-gray-500">Step {step} of 3 — {STEPS[step - 1].label}</p>
              {/* Desktop step dots */}
              <div className="flex items-center gap-2 mt-4">
                {STEPS.map((_, i) => (
                  <div key={i} className={`h-2 rounded-full transition-all duration-500 ${step > i + 1 ? "bg-emerald-500 w-6" : step === i + 1 ? "bg-primary w-8" : "bg-gray-200 w-6"}`} />
                ))}
              </div>
            </div>

            {/* Mobile heading */}
            <h1 className="lg:hidden text-2xl font-extrabold text-gray-900 mb-6">Ride Host onboarding</h1>

            <Form form={form} layout="vertical" onFinish={onSubmit} initialValues={{ seatCapacity: 4 }}>

              {/* ── STEP 1: Personal details ── */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-400">
                  <p className="text-sm text-muted-foreground mb-6">Tell us about yourself so passengers can trust you.</p>
                  {[
                    { name: "fullName", label: "Full name", icon: User, placeholder: "Ashiq Rahman", rules: [{ required: true, message: "Required" }] },
                    { name: "email", label: "Email address", icon: Mail, placeholder: "you@email.com", rules: [{ required: true, type: "email" as const, message: "Valid email required" }] },
                    { name: "phone", label: "Phone number", icon: Phone, placeholder: "+91 98765 43210", rules: [{ required: true, message: "Required" }] },
                    { name: "licenseNumber", label: "Driving license number", icon: CreditCard, placeholder: "TN01 20150012345", rules: [{ required: true, message: "Required" }] },
                    { name: "city", label: "City", icon: MapPin, placeholder: "Chennai", rules: [{ required: true, message: "Required" }] },
                  ].map((f) => (
                    <Form.Item key={f.name} name={f.name} label={<span className="font-semibold text-gray-700 text-sm">{f.label}</span>} rules={f.rules} className="mb-0">
                      <Input
                        size="large"
                        placeholder={f.placeholder}
                        prefix={<f.icon size={16} className="text-gray-400 mr-1" />}
                        className="h-14 rounded-2xl text-base border-gray-200 focus:border-primary"
                      />
                    </Form.Item>
                  ))}
                </div>
              )}

              {/* ── STEP 2: Vehicle details ── */}
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-400">
                  <p className="text-sm text-muted-foreground mb-2">Add your vehicle so passengers know what to look for.</p>

                  {/* Live Vehicle Card Preview */}
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-5 text-white mb-6 shadow-xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none" />
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">Vehicle Preview</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Live Preview</p>
                        </div>
                      </div>
                      <Car size={28} className="text-white/20" />
                    </div>
                    <p className="text-xl font-bold relative z-10">{modelWatch || "Your Vehicle"}</p>
                    <p className="text-gray-400 text-sm relative z-10">{colorWatch || "Color"} · {seatsWatch || 4} seats</p>
                    <div className="mt-4 bg-white/10 rounded-2xl p-3 border border-white/10 relative z-10">
                      <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-0.5">Plate</p>
                      <p className="text-white font-mono text-lg tracking-widest">{plateWatch || "XX 00 XX 0000"}</p>
                    </div>
                  </div>

                  {[
                    { name: "modelName", label: "Vehicle model", icon: Car, placeholder: "Honda City, Swift Dzire…", rules: [{ required: true, message: "Required" }] },
                    { name: "plateNumber", label: "Plate number", icon: Hash, placeholder: "TN 01 AB 1234", rules: [{ required: true, message: "Required" }], className: "font-mono tracking-widest" },
                    { name: "color", label: "Color (optional)", icon: Palette, placeholder: "White, Black, Silver…", rules: [] },
                  ].map((f) => (
                    <Form.Item key={f.name} name={f.name} label={<span className="font-semibold text-gray-700 text-sm">{f.label}</span>} rules={f.rules} className="mb-0">
                      <Input
                        size="large"
                        placeholder={f.placeholder}
                        prefix={<f.icon size={16} className="text-gray-400 mr-1" />}
                        className={`h-14 rounded-2xl text-base border-gray-200 ${f.className ?? ""}`}
                      />
                    </Form.Item>
                  ))}

                  <Form.Item name="seatCapacity" label={<span className="font-semibold text-gray-700 text-sm">Seat capacity</span>} rules={[{ required: true, message: "Required" }]} className="mb-0">
                    <div className="flex items-center gap-4 mt-1">
                      <button type="button" onClick={() => { const v = Number(form.getFieldValue("seatCapacity") ?? 4); if (v > 1) form.setFieldValue("seatCapacity", v - 1); }} className="h-14 w-14 rounded-2xl bg-gray-100 text-2xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0">−</button>
                      <div className="flex-1 h-14 rounded-2xl border border-gray-200 flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">{seatsWatch ?? 4}</span>
                        <span className="text-gray-400 ml-2 text-sm">seats</span>
                      </div>
                      <button type="button" onClick={() => { const v = Number(form.getFieldValue("seatCapacity") ?? 4); if (v < 12) form.setFieldValue("seatCapacity", v + 1); }} className="h-14 w-14 rounded-2xl bg-gray-100 text-2xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0">+</button>
                    </div>
                  </Form.Item>
                </div>
              )}

              {/* ── STEP 3: Documents & password ── */}
              {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-400">
                  <p className="text-sm text-muted-foreground">Upload your vehicle documents and set a secure password.</p>

                  {/* Registration doc */}
                  <div>
                    <p className="font-semibold text-gray-700 text-sm mb-2">Registration document</p>
                    <Upload {...uploadProps} fileList={registrationFileList} onChange={({ fileList }) => setRegistrationFileList(fileList)} onRemove={() => { setRegistrationFileList([]); return true; }}>
                      <button type="button" className={`w-full h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors ${registrationFileList.length > 0 ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-gray-50 hover:border-primary hover:bg-primary/5"}`}>
                        {registrationFileList.length > 0 ? (<><CheckCircle size={22} className="text-emerald-500" /><span className="text-sm font-medium text-emerald-600">Document uploaded</span></>) : (<><FileText size={22} className="text-gray-400" /><span className="text-sm text-gray-500">Upload registration (PDF / image)</span></>)}
                      </button>
                    </Upload>
                  </div>

                  {/* Insurance doc */}
                  <div>
                    <p className="font-semibold text-gray-700 text-sm mb-2">Insurance document</p>
                    <Upload {...uploadProps} fileList={insuranceFileList} onChange={({ fileList }) => setInsuranceFileList(fileList)} onRemove={() => { setInsuranceFileList([]); return true; }}>
                      <button type="button" className={`w-full h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors ${insuranceFileList.length > 0 ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-gray-50 hover:border-primary hover:bg-primary/5"}`}>
                        {insuranceFileList.length > 0 ? (<><CheckCircle size={22} className="text-emerald-500" /><span className="text-sm font-medium text-emerald-600">Document uploaded</span></>) : (<><Shield size={22} className="text-gray-400" /><span className="text-sm text-gray-500">Upload insurance (PDF / image)</span></>)}
                      </button>
                    </Upload>
                  </div>

                  {/* Password (only for new users) */}
                  {!user && (
                    <div className="space-y-4">
                      <Form.Item name="password" label={<span className="font-semibold text-gray-700 text-sm">Create password</span>} rules={[{ required: true, min: 8, message: "Min 8 characters" }]} className="mb-0">
                        <Input.Password
                          size="large"
                          placeholder="Min 8 characters"
                          prefix={<Lock size={16} className="text-gray-400 mr-1" />}
                          className="h-14 rounded-2xl text-base border-gray-200"
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </Form.Item>

                      {/* Strength meter */}
                      {password && (
                        <div className="space-y-2">
                          <div className="flex gap-1.5">
                            {[1,2,3,4].map((n) => (
                              <div key={n} className="h-1.5 flex-1 rounded-full transition-all duration-300" style={{ background: n <= pwStrength ? strengthColor[pwStrength] : "#e5e7eb" }} />
                            ))}
                          </div>
                          <p className="text-xs font-semibold" style={{ color: strengthColor[pwStrength] }}>{strengthLabel[pwStrength]}</p>
                          <div className="space-y-1">
                            {[
                              { check: password.length >= 8, label: "At least 8 characters" },
                              { check: /[A-Z]/.test(password), label: "One uppercase letter" },
                              { check: /[0-9]/.test(password), label: "One number" },
                            ].map((r) => (
                              <div key={r.label} className="flex items-center gap-2">
                                <div className={`h-4 w-4 rounded-full flex items-center justify-center ${r.check ? "bg-emerald-100" : "bg-gray-100"}`}>
                                  {r.check && <CheckCircle size={12} className="text-emerald-600" />}
                                </div>
                                <span className={`text-xs ${r.check ? "text-emerald-700 font-medium" : "text-gray-400"}`}>{r.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Form.Item
                        name="confirmPassword"
                        label={<span className="font-semibold text-gray-700 text-sm">Confirm password</span>}
                        dependencies={["password"]}
                        rules={[{ required: true, message: "Required" }, ({ getFieldValue }) => ({ validator(_, v) { return !v || getFieldValue("password") === v ? Promise.resolve() : Promise.reject(new Error("Passwords do not match")); } })]}
                        className="mb-0"
                      >
                        <Input.Password size="large" placeholder="Repeat password" prefix={<Lock size={16} className="text-gray-400 mr-1" />} className="h-14 rounded-2xl text-base border-gray-200" />
                      </Form.Item>
                    </div>
                  )}
                </div>
              )}

            </Form>
          </div>
        </div>

        {/* ── Sticky bottom action bar ── */}
        <div className="fixed bottom-0 left-0 right-0 lg:relative lg:bottom-auto bg-white/90 backdrop-blur-md border-t border-gray-100 px-5 sm:px-8 lg:px-12 py-4 lg:py-6 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
          <div className="max-w-lg mx-auto lg:max-w-none flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                disabled={submitting}
                className="h-14 px-5 rounded-2xl border-2 border-gray-200 font-semibold text-gray-600 flex items-center gap-2 hover:border-gray-300 transition-colors shrink-0"
              >
                <ChevronLeft size={18} /> Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => void nextStep()}
                disabled={submitting}
                className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98]"
              >
                Continue <ChevronRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onSubmit()}
                disabled={submitting}
                className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-70 disabled:scale-100"
              >
                {submitting ? (
                  <><span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Creating account…</>
                ) : (
                  <><Sparkles size={18} /> Create Ride Host account</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
