import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

declare global {
  var pool: Pool | undefined;
  var prisma: PrismaClient | undefined;
}

// Ensure pool is only created once in development
const pool = global.pool || new Pool({ connectionString, max: 5 });
if (process.env.NODE_ENV !== 'production') global.pool = pool;

const adapter = new PrismaPg(pool);
const prisma = global.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

export default prisma;
