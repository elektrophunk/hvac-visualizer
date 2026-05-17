import { listEquipment } from "@/services/equipment/catalog";
import NewRenderClient from "./NewRenderClient";

export default async function NewRenderPage() {
  const equipment = await listEquipment().catch(() => []);
  return <NewRenderClient equipment={equipment} />;
}
