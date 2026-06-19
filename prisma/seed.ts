import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";

const prisma = new PrismaClient();

async function main() {
  const accounts = [
    {
      email: "superadmin@docuwork.app",
      password: "superadmin123",
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
    },
    {
      email: "manager@docuwork.app",
      password: "manager123",
      name: "Priya Manager",
      role: Role.MANAGER,
    },
    {
      email: "worker1@docuwork.app",
      password: "worker123",
      name: "Worker One",
      role: Role.WORKER,
      managerEmail: "manager@docuwork.app",
    },
    {
      email: "worker2@docuwork.app",
      password: "worker123",
      name: "Worker Two",
      role: Role.WORKER,
      managerEmail: "manager@docuwork.app",
    },
    {
      email: "worker3@docuwork.app",
      password: "worker123",
      name: "Worker Three",
      role: Role.WORKER,
      managerEmail: "manager@docuwork.app",
    },
  ];

  const managersByEmail = new Map<string, string>();

  for (const account of accounts.filter((a) => a.role !== Role.WORKER)) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        role: account.role,
        isActive: true,
        isEmailVerified: true,
      },
      create: {
        email: account.email,
        name: account.name,
        passwordHash: await hashPassword(account.password),
        role: account.role,
        isActive: true,
        isEmailVerified: true,
      },
    });

    if (account.role === Role.MANAGER) {
      managersByEmail.set(account.email, user.id);
    }
  }

  for (const account of accounts.filter((a) => a.role === Role.WORKER)) {
    const managedById = account.managerEmail
      ? managersByEmail.get(account.managerEmail)
      : undefined;

    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        role: account.role,
        managedById,
        isActive: true,
        isEmailVerified: true,
      },
      create: {
        email: account.email,
        name: account.name,
        passwordHash: await hashPassword(account.password),
        role: account.role,
        managedById,
        isActive: true,
        isEmailVerified: true,
      },
    });
  }

  console.log("Seeded DocuWork demo accounts:");
  for (const account of accounts) {
    console.log(`${account.role}: ${account.email} / ${account.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
