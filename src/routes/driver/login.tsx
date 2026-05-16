import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/driver/login")({
  head: () => ({
    meta: [
      { title: "Login — Coolpool" },
      {
        name: "description",
        content: "Common login for admin, driver, and user accounts.",
      },
    ],
  }),
  component: DriverLoginPage,
});

function DriverLoginPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/auth" });
  }, [navigate]);

  return null;
}
