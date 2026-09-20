import { z } from "zod";
import { RESEARCH_DOMAINS } from "@/lib/domains";

const password = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(100, "Password too long")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Password must contain at least one letter and one digit");

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
const optionalEmail = email.optional().or(z.literal(""));

export const registerSchema = z.object({
  portalKey: z.string().trim().min(8, "Enter the portal key you were given").max(64),
  name: z.string().trim().min(2, "Enter your full name").max(120),
  email,
  password,
  registrationNo: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "New password must differ from the current one",
    path: ["newPassword"],
  });

export const proposalSchema = z.object({
  title: z.string().trim().min(5, "Title is too short").max(300),
  domain: z.enum(RESEARCH_DOMAINS, "Pick a research domain from the list"),
});

export const reviewSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    remarks: z.string().trim().max(5000).optional().default(""),
  })
  .refine((v) => v.decision === "APPROVE" || v.remarks.length > 0, {
    message: "Remarks are required when rejecting",
    path: ["remarks"],
  });

export const committeeSchema = z.object({
  dcMemberIds: z
    .array(z.uuid("Invalid DC member id"))
    .min(2, "Select at least 2 DC members")
    .max(5, "Select at most 5 DC members")
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate DC members"),
});

export const coSupervisorSchema = z.object({
  coSupervisorId: z.uuid().nullable(),
});

/** DC members are a pool R&D curates; they never log in. */
export const dcMemberCreateSchema = z.object({
  name: z.string().trim().min(2, "Enter the member's name").max(120),
  email: optionalEmail,
  department: z.string().trim().max(120).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  affiliation: z.string().trim().max(160).optional().or(z.literal("")),
});

export const dcMemberUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: optionalEmail,
  department: z.string().trim().max(120).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  affiliation: z.string().trim().max(160).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
});

export const staffUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
});

export const portalKeyGenSchema = z.object({
  count: z.number().int().min(1).max(50).default(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const allocateSupervisorSchema = z.object({
  studentId: z.uuid(),
  staffId: z.uuid(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, "Invalid reset link").max(200),
  password,
});

const uploadFile = {
  fileName: z.string().trim().min(1, "Missing file name").max(255),
  contentType: z.string().trim().min(1).max(100),
  size: z.number().int().positive(),
};

/** Step 1 of an upload: ask for a presigned PUT URL. */
export const uploadIntentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("milestone"), applicationId: z.uuid(), docType: z.string().min(1).max(60), ...uploadFile }),
  z.object({ kind: z.literal("proposal"), ...uploadFile }),
]);

/** Step 2 of an upload: record the object that was PUT to storage. */
export const registerDocumentSchema = z.object({
  key: z.string().min(10).max(400),
});
