import { prisma } from "@/lib/prisma";
import type { Equipment, EquipmentMetadata } from "@/types/equipment";

export async function listEquipment(): Promise<Equipment[]> {
  const rows = await prisma.equipment.findMany({
    where: { is_active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return rows.map((r) => ({
    ...r,
    metadata: r.metadata as unknown as EquipmentMetadata,
    model_number: r.model_number ?? null,
    btu_rating: r.btu_rating ?? null,
    thumbnail_url: r.thumbnail_url ?? null,
  }));
}

export async function getEquipmentById(id: string): Promise<Equipment | null> {
  const row = await prisma.equipment.findUnique({ where: { id } });
  if (!row) return null;
  return {
    ...row,
    metadata: row.metadata as unknown as EquipmentMetadata,
    model_number: row.model_number ?? null,
    btu_rating: row.btu_rating ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
  };
}

export function buildEquipmentSpec(equipment: Equipment): string {
  const parts = [equipment.name, equipment.manufacturer];
  if (equipment.btu_rating) parts.push(`${equipment.btu_rating} BTU`);
  return parts.join(", ");
}
