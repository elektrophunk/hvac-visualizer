import { PrismaClient, EquipmentCategory } from "@prisma/client";
import { EQUIPMENT_DEFAULT_PROMPTS, EQUIPMENT_NAMES } from "../services/equipment/descriptions";

const prisma = new PrismaClient();

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
