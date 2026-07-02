import { prisma } from "@/lib/prisma";
import type { Equipment } from "@/types/equipment";

export async function listEquipment(): Promise<Equipment[]> {
  const rows = await prisma.equipment.findMany({
    where: { is_active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    category: r.category as Equipment["category"],
    manufacturer: r.manufacturer ?? null,
    model_number: r.model_number ?? null,
    btu_rating: r.btu_rating ?? null,
    thumbnail_url: r.thumbnail_url ?? null,
    prompt_description: r.prompt_description,
    metadata: r.metadata as Record<string, unknown>,
    is_active: r.is_active,
  }));
}

export async function getEquipmentById(id: string): Promise<Equipment | null> {
  const row = await prisma.equipment.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category as Equipment["category"],
    manufacturer: row.manufacturer ?? null,
    model_number: row.model_number ?? null,
    btu_rating: row.btu_rating ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    prompt_description: row.prompt_description,
    metadata: row.metadata as Record<string, unknown>,
    is_active: row.is_active,
  };
}

export function buildEquipmentDescription(equipment: Equipment): string {
  return equipment.prompt_description;
}
