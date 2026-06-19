import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const FROM = process.env.SMTP_FROM!;

export async function sendVerificationEmail(email: string, token: string) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Verify your DocuWork email",
    html: emailTemplate("Verify Your Email", `
      <p>Click the button below to verify your email address.</p>
      <a href="${link}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Verify Email</a>
      <p>Link expires in 24 hours.</p>
    `),
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Reset your DocuWork password",
    html: emailTemplate("Reset Password", `
      <p>You requested a password reset. Click below to proceed.</p>
      <a href="${link}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Reset Password</a>
      <p>Link expires in 1 hour. Ignore if you didn't request this.</p>
    `),
  });
}

export async function sendTaskAssignedEmail(
  email: string,
  workerName: string,
  taskTitle: string,
  taskId: string
) {
  const link = `${APP_URL}/worker/workspace/${taskId}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `New task assigned: ${taskTitle}`,
    html: emailTemplate("New Task Assigned", `
      <p>Hi ${workerName},</p>
      <p>A new digitization task has been assigned to you: <strong>${taskTitle}</strong></p>
      <a href="${link}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Start Working</a>
    `),
  });
}

function emailTemplate(title: string, content: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:40px 20px">
      <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <h2 style="color:#1e293b;margin:0 0 24px">${title}</h2>
        ${content}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
        <p style="color:#94a3b8;font-size:13px;margin:0">DocuWork — Document Digitization Platform</p>
      </div>
    </body>
    </html>
  `;
}
