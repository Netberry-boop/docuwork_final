import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/auth"; // Adjust this path to where your hashPassword function lives!

const prisma = new PrismaClient();

async function main() {
  // Choose your initial admin credentials here
  const adminEmail = "admin@docuwork.com";
  const adminPassword = "SuperSecurePassword123!"; 

  console.log("Hashing password...");
  const passwordHash = await hashPassword(adminPassword);

  console.log("Creating default SUPER_ADMIN user...");
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "System Admin",
      passwordHash: passwordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log(`
  🚀 Success! Admin user created.
  =====================================
  Email:    ${adminEmail}
  Password: ${adminPassword}
  =====================================
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });