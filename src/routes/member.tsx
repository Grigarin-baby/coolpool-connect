import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseTravelerResumeRedirectParam } from "@/lib/travelerResumeRedirect";

/** Legacy `/member` URL → `/members` (traveler portal). */
export const Route = createFileRoute("/member")({
  beforeLoad: ({ search }) => {
    const raw = (search as Record<string, unknown>).redirect;
    const next = parseTravelerResumeRedirectParam(raw);
    throw redirect({
      to: "/members",
      search: next ? { redirect: next } : { redirect: undefined },
    });
  },
  component: () => null,
});
