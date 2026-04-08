"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const now = new Date();
    const expiredFiles = await prisma.uploadFile.findMany({
        where: {
            bizType: client_1.UploadBizType.order_product_image,
            deletedAt: null,
            expiresAt: {
                lte: now,
            },
        },
    });
    let deletedCount = 0;
    let skippedCount = 0;
    for (const file of expiredFiles) {
        if (file.storageDriver === 'local') {
            const relativePath = file.storageKey ||
                (file.fileUrl.startsWith('/uploads/')
                    ? file.fileUrl.replace('/uploads/', '')
                    : file.fileName);
            const absolutePath = (0, node_path_1.join)(process.cwd(), uploadDir, relativePath);
            if ((0, node_fs_1.existsSync)(absolutePath)) {
                await (0, promises_1.unlink)(absolutePath);
                deletedCount += 1;
            }
            else {
                skippedCount += 1;
            }
        }
        else {
            skippedCount += 1;
        }
        await prisma.uploadFile.update({
            where: { id: file.id },
            data: {
                deletedAt: now,
            },
        });
    }
    console.log(JSON.stringify({
        checked: expiredFiles.length,
        deletedCount,
        skippedCount,
        at: now.toISOString(),
    }, null, 2));
}
main()
    .finally(async () => {
    await prisma.$disconnect();
})
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
