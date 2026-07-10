import 'dotenv/config'

import { PrismaClient } from '@prisma/client'
import { seedNews, seedNewsCategories, seedSections, seedSuperAdminSafe } from './seed.helpers'

const prisma = new PrismaClient()

async function main() {
    await seedSections(prisma)
    await seedNewsCategories(prisma)
    await seedNews(prisma)
    await seedSuperAdminSafe(prisma, {
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD,
    })
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async error => {
        console.error(error)
        await prisma.$disconnect()
        process.exit(1)
    })
