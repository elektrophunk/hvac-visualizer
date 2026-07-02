import { PrismaClient, EquipmentCategory } from "@prisma/client";
import { EQUIPMENT_DEFAULT_PROMPTS } from "../services/equipment/descriptions";

const prisma = new PrismaClient();

const EQUIPMENT_NAMES: Record<EquipmentCategory, string> = {
  mini_split_head: "Mini-Split Head Unit",
  mini_split_condenser: "Mini-Split Condenser",
  central_air_handler: "Central Air Handler",
  furnace: "Gas Furnace",
  heat_pump_condenser: "Heat Pump Condenser",
  boiler: "Wall-Hung Boiler",
  ductless_cassette: "Ceiling Cassette",
  ventilator: "HRV/ERV Ventilator",
  other: "Other / Custom",
};

async function main() {
  const categories = Object.values(EquipmentCategory);

  for (const category of categories) {
    const equipment = await prisma.equipment.upsert({
      where: { slug: category },
      update: {
        name: EQUIPMENT_NAMES[category],
        prompt_description: EQUIPMENT_DEFAULT_PROMPTS[category],
        is_active: true,
      },
      create: {
        slug: category,
        name: EQUIPMENT_NAMES[category],
        category,
        prompt_description: EQUIPMENT_DEFAULT_PROMPTS[category],
        is_active: true,
      },
    });
    console.log(`Seeded equipment: ${equipment.slug} (${equipment.id})`);
  }

  console.log(`Done — ${categories.length} equipment rows upserted.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
