-- Files moved from Vercel Blob (public URLs) to S3-compatible object storage.
-- Only object keys are stored now; the pathname columns are redundant.
ALTER TABLE "MilestoneDocument" RENAME COLUMN "fileUrl" TO "storageKey";
ALTER TABLE "MilestoneDocument" DROP COLUMN "pathname";

ALTER TABLE "StudentProfile" RENAME COLUMN "proposalFileUrl" TO "proposalStorageKey";
ALTER TABLE "StudentProfile" DROP COLUMN "proposalPathname";

-- Forgot-password flow: single-use, time-limited tokens (hash only).
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
