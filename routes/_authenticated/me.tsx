import { createFileRoute, Link } from "@tanstack/react-router";
import { StandardPage } from "@/components/layout/page";
import { VolunteerProfile } from "@/components/volunteer-profile";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({ meta: [{ title: "Your profile · Kindred" }, { name: "description", content: "Your verified volunteer profile and credential wallet." }] }),
  component: Me,
});

function Me() {
  const { user } = useAuth();
  return (
    <StandardPage
      eyebrow="Profile"
      title="Your volunteer CV"
      lead="One profile every charity trusts."
      actions={user ? <Button asChild variant="secondary"><Link to="/v/$id" params={{ id: user.id }}>View public</Link></Button> : undefined}
    >
      {user && <VolunteerProfile userId={user.id} editable />}
    </StandardPage>
  );
}
