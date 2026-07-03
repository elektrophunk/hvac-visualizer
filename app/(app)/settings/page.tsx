import { requireUserWithOrg } from "@/lib/auth";
import { getPeriodRenderCount } from "@/lib/usage";
import { planConfig } from "@/services/billing/plans";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const { user, org } = await requireUserWithOrg();
  const config = planConfig(org.plan);
  const used = await getPeriodRenderCount(org).catch(() => 0);

  return (
    <SettingsClient
      email={user.email}
      memberSince={user.created_at.toISOString()}
      plan={org.plan}
      planLabel={config.label}
      rendersUsed={used}
      renderLimit={org.render_limit || config.renderLimit}
      periodEnd={org.current_period_end?.toISOString() ?? null}
      hasStripeCustomer={!!org.stripe_customer_id}
    />
  );
}
