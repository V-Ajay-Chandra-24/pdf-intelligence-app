import prisma from "../src/lib/prisma";

async function main() {
  console.log("Connecting to database to clear DocumentChunk embeddings...");
  try {
    const result = await prisma.$executeRaw`DELETE FROM "DocumentChunk"`;
    console.log(`Successfully cleared embeddings. Deleted ${result} rows.`);
    console.log("Documents will be re-embedded on their next chat query under the active LLM_PROVIDER.");
  } catch (error) {
    console.error("Failed to clear embeddings:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
