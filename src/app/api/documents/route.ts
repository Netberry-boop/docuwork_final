import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, withAuth, paginate, getPagination } from "@/lib/api";
import { uploadFile, validateFileType } from "@/lib/storage";
import { Role } from "@prisma/client";

// Safe hardcoded limit for Vercel functions
const MAX_FILE_SIZE = 4.5 * 1024 * 1024;

// GET /api/documents
export const GET = withAuth(async (req, user) => {
  const { page, limit, skip } = getPagination(req);
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [documents, total] = await Promise.all([
    db.document.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { tasks: true } },
      },
    }),
    db.document.count({ where }),
  ]);

  return paginate(documents, total, page, limit);
});

// POST /api/documents - multipart upload
export const POST = withAuth(async (req, user) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return err("No file provided", 400);
    
    if (file.size > MAX_FILE_SIZE) {
      return err("File too large. Max limit is 4.5MB on Vercel.", 400);
    }
    
    if (!validateFileType(file.type)) {
      return err("Invalid file type. Allowed: PDF, JPG, PNG, TIFF, DOCX", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload directly to Vercel Blob
    const { url } = await uploadFile(buffer, file.name, file.type, "documents");

    // Force explicitly typecasting file size to standard integer values 
    const cleanFileSize = Math.floor(Number(file.size));
    const inputName = formData.get("name") as string;

    const doc = await db.document.create({
      data: {
        name: inputName && inputName.trim() !== "" ? inputName : file.name,
        originalName: file.name,
        fileType: file.type,
        fileSize: cleanFileSize,
        storageUrl: url,
        uploadedById: user!.id,
      },
    });

    await db.auditLog.create({
      data: {
        userId: user!.id,
        action: "DOCUMENT_UPLOADED",
        details: { documentId: doc.id, name: doc.name },
      },
    });

    return ok(doc, 201);
  } catch (error: any) {
    console.error("CRITICAL UPLOAD FAULT:", error);
    return err(error?.message || "Internal Database Server Error", 500);
  }
}, [Role.SUPER_ADMIN, Role.MANAGER]);