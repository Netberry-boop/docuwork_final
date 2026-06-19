import { PrismaClient, Role } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const superAdminHash = await argon2.hash("superadmin123", { type: argon2.argon2id });
  const managerHash = await argon2.hash("manager123", { type: argon2.argon2id });
  const workerHash = await argon2.hash("worker123", { type: argon2.argon2id });

  // Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@docuwork.app" },
    update: {},
    create: {
      email: "superadmin@docuwork.app",
      passwordHash: superAdminHash,
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
      isEmailVerified: true,
      isActive: true,
    },
  });

  // Manager
  const manager = await prisma.user.upsert({
    where: { email: "manager@docuwork.app" },
    update: {},
    create: {
      email: "manager@docuwork.app",
      passwordHash: managerHash,
      name: "Ananya Sharma",
      role: Role.MANAGER,
      isEmailVerified: true,
      isActive: true,
    },
  });

  // Workers
  const workers = await Promise.all(
    [
      { email: "worker1@docuwork.app", name: "Ravi Kumar" },
      { email: "worker2@docuwork.app", name: "Priya Patel" },
      { email: "worker3@docuwork.app", name: "Arjun Nair" },
    ].map((w) =>
      prisma.user.upsert({
        where: { email: w.email },
        update: {},
        create: {
          email: w.email,
          passwordHash: workerHash,
          name: w.name,
          role: Role.WORKER,
          managedById: manager.id,
          isEmailVerified: true,
          isActive: true,
        },
      })
    )
  );

  // Sample documents
  const doc1 = await prisma.document.create({
    data: {
      name: "1947 Land Records - District A",
      originalName: "land_records_1947.pdf",
      fileType: "application/pdf",
      fileSize: 2_400_000,
      storageUrl: "https://example.com/sample.pdf",
      uploadedById: manager.id,
      pageCount: 45,
    },
  });

  const doc2 = await prisma.document.create({
    data: {
      name: "Medical Records Batch 2024-01",
      originalName: "medical_batch_jan.pdf",
      fileType: "application/pdf",
      fileSize: 1_800_000,
      storageUrl: "https://example.com/sample2.pdf",
      uploadedById: manager.id,
      pageCount: 30,
    },
  });

  // Tasks
  const task1 = await prisma.task.create({
    data: {
      title: "Digitize 1947 Land Records - Pages 1–20",
      description: "Transcribe handwritten entries from the 1947 land survey records.",
      priority: "HIGH",
      status: "IN_PROGRESS",
      paymentAmount: 500,
      estimatedPages: 20,
      documentId: doc1.id,
      workerId: workers[0].id,
      createdById: manager.id,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      instructions: "Preserve all abbreviations. Mark illegible sections with [illegible].",
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: "Digitize Medical Records - Batch January",
      description: "Transcribe patient records and lab reports.",
      priority: "URGENT",
      status: "ASSIGNED",
      paymentAmount: 750,
      estimatedPages: 30,
      documentId: doc2.id,
      workerId: workers[1].id,
      createdById: manager.id,
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  });

  const task3 = await prisma.task.create({
    data: {
      title: "Digitize Land Records - Pages 21–45",
      priority: "MEDIUM",
      status: "ASSIGNED",
      paymentAmount: 625,
      estimatedPages: 25,
      documentId: doc1.id,
      workerId: workers[2].id,
      createdById: manager.id,
    },
  });

  console.log("✅ Seed complete!\n");
  console.log("Login credentials:");
  console.log("  Super Admin:  superadmin@docuwork.app / superadmin123");
  console.log("  Manager:      manager@docuwork.app    / manager123");
  console.log("  Worker 1:     worker1@docuwork.app    / worker123");
  console.log("  Worker 2:     worker2@docuwork.app    / worker123");
  console.log("  Worker 3:     worker3@docuwork.app    / worker123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
