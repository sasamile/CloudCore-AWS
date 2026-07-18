import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as bcrypt from 'bcrypt'

async function main() {
  const adapter = new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://zyncloud:zyncloud@localhost:5432/zyncloud',
  })
  const prisma = new PrismaClient({ adapter })

  const email = 'nspes2020@gmail.com'
  const password = await bcrypt.hash('Sa722413', 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password,
      name: 'Nspes',
      emailVerified: true,
      mfaEnabled: false,
    },
    create: {
      email,
      password,
      name: 'Nspes',
      emailVerified: true,
      mfaEnabled: false,
    },
  })

  console.log(
    JSON.stringify(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        mfaEnabled: user.mfaEnabled,
      },
      null,
      2,
    ),
  )

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
