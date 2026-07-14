// ---------------------------------------------------------------------------
// Database seed
//
// Bootstraps the baseline rows every environment needs before the proving /
// proof-queue pipeline can run:
//   1. the `games` row for "card-wars"
//   2. one `circuits` row per circuit, populated from the compiled circuit JSON
//      and its registered verification key (hex + hash)
//
// Idempotent: the game is upserted and each circuit is updated-or-created, so
// the script is safe to re-run. A circuit whose VK files are missing/empty
// (i.e. `registerVk` hasn't run yet) is warned about and skipped rather than
// aborting the whole seed.
//
// Run directly, e.g. `tsx packages/db/src/seed.ts`.
// ---------------------------------------------------------------------------

import fs from "fs/promises";
import { circuitJsonPath, vkHexPath, vkHashPath } from "@platform/circuits";
import prisma from "./index";

// Circuits to seed. Kept as plain strings (rather than importing `CircuitKind`
// from @platform/proving-setup) to avoid a db → proving-setup → db cycle.
const CIRCUITS_TO_SEED = ["shuffle"];

const GAME_NAME = "card-wars";

async function main() {
  console.log("Seeding database...");
  const now = new Date();

  // -------------------------------------------------------------------------
  // 1. Create or ensure the Game exists
  // -------------------------------------------------------------------------
  const game = await prisma.games.upsert({
    where: { name: GAME_NAME },
    update: {},
    create: {
      id: crypto.randomUUID(),
      name: GAME_NAME,
      updated_at: now,
    },
  });
  console.log(`[db] Game initialized: ${game.name} (${game.id})`);

  // -------------------------------------------------------------------------
  // 2. Seed each circuit from its compiled JSON + verification key files
  // -------------------------------------------------------------------------
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const circuitName of CIRCUITS_TO_SEED) {
    console.log(`[db] Processing ${circuitName}...`);

    try {
      // Compiled circuit (ACIR + bytecode + ABI).
      const jsonContent = await fs.readFile(circuitJsonPath(circuitName), "utf8");
      const compiledCircuit = JSON.parse(jsonContent);

      // Raw verification key (hex), trimmed of any trailing newline.
      const vkHexContent = await fs.readFile(vkHexPath(circuitName), "utf8");

      // Registered VK hash — Kurier returns it either flat or nested under meta.
      const vkHashContent = await fs.readFile(vkHashPath(circuitName), "utf8");
      const vkHashObj = JSON.parse(vkHashContent);
      const vkHash = vkHashObj.vkHash || vkHashObj.meta?.vkHash;

      if (!vkHash) {
        throw new Error(`vkHash not found in ${circuitName}_vkHash.json`);
      }

      // No @unique on (game_id, circuit_name), so look up explicitly before
      // deciding between update and create.
      const existingCircuit = await prisma.circuits.findFirst({
        where: { game_id: game.id, circuit_name: circuitName },
      });

      if (existingCircuit) {
        await prisma.circuits.update({
          where: { id: existingCircuit.id },
          data: {
            compiled_circuit: compiledCircuit,
            verification_key: vkHexContent.trim(),
            vk_hash: vkHash,
            updated_at: now,
          },
        });
        updated += 1;
        console.log(`[db] Updated circuit: ${circuitName}`);
      } else {
        await prisma.circuits.create({
          data: {
            id: crypto.randomUUID(),
            game_id: game.id,
            circuit_name: circuitName,
            compiled_circuit: compiledCircuit,
            verification_key: vkHexContent.trim(),
            vk_hash: vkHash,
            updated_at: now,
          },
        });
        created += 1;
        console.log(`[db] Created circuit: ${circuitName}`);
      }
    } catch (e: any) {
      // Missing/empty circuit or VK files (e.g. registerVk not run yet) land
      // here — skip this circuit but keep seeding the rest.
      skipped += 1;
      console.warn(`[db] Skipping circuit ${circuitName}. Error: ${e.message}`);
    }
  }

  console.log(
    `[db] Circuits — created: ${created}, updated: ${updated}, skipped: ${skipped}`,
  );
  console.log("Seeding complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
