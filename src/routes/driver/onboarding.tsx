import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Spin } from "antd";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/driver/onboarding")({
  component: RedirectToAuth,
});

function RedirectToAuth() {
  const navigate = useNavigate();
  const { user, loading, isDriver } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (isDriver) {
          void navigate({ to: "/driver/dashboard" });
        } else {
          // If they are logged in but not a driver, send them to /auth
          // so they can provide their phone number and become a host.
          void navigate({ to: "/auth" });
        }
      } else {
        void navigate({ to: "/auth" });
      }
    }
  }, [user, loading, isDriver, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
      <Spin size="large" tip="Redirecting to the new onboarding flow..." />
    </div>
  );
}
