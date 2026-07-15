import { env } from "@platform/env/server";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";

// Re-export the generated Prisma types so consumers can reference them via the
// `@platform/db` alias instead of reaching into `prisma/generated`.
export type { Prisma, verification_status } from "../prisma/generated/client";

export function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();
export default prisma;
