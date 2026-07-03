import { requireUserWithOrg } from "@/lib/auth";
import CompanyClient from "./CompanyClient";

export default async function CompanySettingsPage() {
  const { org } = await requireUserWithOrg();

  return (
    <CompanyClient
      initial={{
        name: org.name,
        phone: org.phone,
        license_number: org.license_number,
        address: org.address,
        website: org.website,
        brand_color: org.brand_color,
        logo_url: org.logo_url,
      }}
    />
  );
}
