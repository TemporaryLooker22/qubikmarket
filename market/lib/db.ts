import { PrismaClient } from "@prisma/client";

// Une seule connexion à la base, réutilisée même quand Next.js recharge le code en développement
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
