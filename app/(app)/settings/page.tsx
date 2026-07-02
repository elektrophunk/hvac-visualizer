import { requireUser } from "@/lib/auth";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <SettingsClient
      email={user.email}
      memberSince={user.created_at.toISOString()}
    />
  );
}
