import { summarizeDocumentJob } from "../src/lib/jobs/summarize";
import prisma from "../src/lib/prisma";

async function main() {
  const doc = await prisma.document.findFirst();
  if (!doc) {
    console.log("No documents found in the database.");
    return;
  }
  
  console.log(`Triggering summary for document: ${doc.id}`);
  await summarizeDocumentJob(doc.id, doc.extractedText || "");
  
  const updatedDoc = await prisma.document.findUnique({ where: { id: doc.id } });
  console.log("--- FINAL DB SAVED SUMMARY ---");
  console.log(updatedDoc?.summary);
}

main().catch(console.error).finally(() => prisma.$disconnect());
