import { listEquipment } from "@/services/equipment/catalog";
import { httpError } from "@/lib/errors";

export async function GET() {
  try {
    const equipment = await listEquipment();
    return Response.json(equipment);
  } catch (err) {
    console.error("[equipment]", err);
    return httpError("Failed to fetch equipment", 500);
  }
}
