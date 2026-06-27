import logo from "@/assets/logo.png";

/**
 * Full-site takeover. Rendered instead of <Outlet/> in the root route when
 * SITE_LOCKED=true — no nav, no links out, nothing else mounts underneath.
 */
export function SiteLockScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-hero px-6 text-center">
      <img src={logo} alt="Coolpool" className="h-14 w-auto object-contain" />
      <p className="mt-8 max-w-md text-lg font-semibold text-foreground">{message}</p>
    </div>
  );
}
