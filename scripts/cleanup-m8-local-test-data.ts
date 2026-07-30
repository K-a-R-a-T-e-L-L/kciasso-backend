import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();
const url = process.env.DATABASE_URL ?? "";
const parsed = new URL(url);
if (process.env.ALLOW_LOCAL_TEST_ADMIN_PROVISION !== "true" || !["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.pathname.slice(1) !== "kciasso_backend_dev") {
  throw new Error("Refusing M8 cleanup outside guarded local database");
}

const prisma = new PrismaClient();
async function main() {
try {
  const users = await prisma.user.findMany({ where: { email: { startsWith: "mantine-m8-", endsWith: "@local.test" } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  const pageSections = await prisma.pageSection.findMany({ where: { internal_name: { startsWith: "[M8 " } }, select: { id: true } });
  const news = await prisma.news.findMany({ where: { author_id: { in: userIds } }, select: { id: true, cover_media_id: true } });
  const newsIds = news.map((item) => item.id);
  const mediaIds = [...new Set(news.map((item) => item.cover_media_id).filter((id): id is number => id !== null))];
  const documents = await prisma.document.findMany({ where: { created_by_id: { in: userIds } }, select: { id: true, current_version_id: true } });
  const documentIds = documents.map((item) => item.id);
  const versions = await prisma.documentVersion.findMany({ where: { document_id: { in: documentIds } }, select: { id: true, stored_file_id: true } });
  const versionIds = versions.map((item) => item.id);
  const storedFileIds = [...new Set(versions.map((item) => item.stored_file_id).filter((id): id is number => id !== null))];

  await prisma.$transaction(async (tx) => {
    if (pageSections.length) await tx.pageSection.deleteMany({ where: { id: { in: pageSections.map((item) => item.id) } } });
    if (newsIds.length) await tx.news.deleteMany({ where: { id: { in: newsIds } } });
    if (mediaIds.length) await tx.newsMedia.deleteMany({ where: { id: { in: mediaIds } } });
    if (versionIds.length) await tx.documentShareLink.deleteMany({ where: { document_version_id: { in: versionIds } } });
    if (documentIds.length) {
      await tx.document.updateMany({ where: { id: { in: documentIds } }, data: { current_version_id: null } });
      await tx.documentPlacement.deleteMany({ where: { document_id: { in: documentIds } } });
      await tx.documentVersion.deleteMany({ where: { id: { in: versionIds } } });
      await tx.document.deleteMany({ where: { id: { in: documentIds } } });
    }
    if (storedFileIds.length) await tx.storedFile.deleteMany({ where: { id: { in: storedFileIds } } });
    if (userIds.length) {
      await tx.userSectionPermission.deleteMany({ where: { user_id: { in: userIds } } });
      await tx.session.deleteMany({ where: { user_id: { in: userIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });
  console.log(`m8-cleanup users=${userIds.length} news=${newsIds.length} documents=${documentIds.length} pageSections=${pageSections.length}`);
} finally { await prisma.$disconnect(); }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
