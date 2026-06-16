// SERVER-ONLY. Razorpay order creation and payment verification.
// The KEY_SECRET never leaves this file — it is never bundled for the browser.
import { createServerFn } from "@tanstack/react-start";
import Razorpay from "razorpay";
import crypto from "crypto";

function readEnv(name: string): string {
  return (typeof process !== "undefined" ? (process.env?.[name] ?? "") : "").trim();
}

function razorpayClient(): Razorpay {
  const key_id = readEnv("RAZORPAY_KEY_ID");
  const key_secret = readEnv("RAZORPAY_KEY_SECRET");
  if (!key_id || !key_secret) {
    throw new Error("Razorpay credentials missing (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  }
  return new Razorpay({ key_id, key_secret });
}

export interface RazorpayOrderResult {
  order_id: string;
  amount: number;
  currency: string;
}

/**
 * Creates a Razorpay order server-side and returns order_id, amount, currency.
 * Amount must be in paise (INR × 100), minimum 100.
 */
export const createRazorpayOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { amountPaise: number; receipt?: string }) => {
    const amount = Math.round(Number(input?.amountPaise ?? 0));
    if (!Number.isFinite(amount) || amount < 100) {
      throw new Error("Amount must be at least ₹1 (100 paise).");
    }
    return { amountPaise: amount, receipt: input?.receipt ?? `rcpt_${Date.now()}` };
  })
  .handler(async ({ data }): Promise<RazorpayOrderResult> => {
    const rzp = razorpayClient();
    const order = await rzp.orders.create({
      amount: data.amountPaise,
      currency: "INR",
      receipt: data.receipt,
    });
    return {
      order_id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
    };
  });

export interface VerifyPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Verifies the Razorpay payment signature using HMAC-SHA256.
 * Returns { verified: true } on success; throws on mismatch.
 */
export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .inputValidator((input: VerifyPaymentInput) => {
    const order_id = String(input?.razorpay_order_id ?? "").trim();
    const payment_id = String(input?.razorpay_payment_id ?? "").trim();
    const signature = String(input?.razorpay_signature ?? "").trim();
    if (!order_id || !payment_id || !signature) {
      throw new Error("Missing payment verification fields.");
    }
    return { razorpay_order_id: order_id, razorpay_payment_id: payment_id, razorpay_signature: signature };
  })
  .handler(async ({ data }): Promise<{ verified: true }> => {
    const secret = readEnv("RAZORPAY_KEY_SECRET");
    if (!secret) throw new Error("Razorpay secret missing.");

    const body = `${data.razorpay_order_id}|${data.razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");

    if (expected !== data.razorpay_signature) {
      throw new Error("Payment signature verification failed.");
    }
    return { verified: true };
  });
