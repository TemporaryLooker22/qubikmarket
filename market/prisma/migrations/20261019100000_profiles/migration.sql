-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE "MemberReview" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberReviewReport" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "MemberReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberReview_targetId_role_createdAt_idx" ON "MemberReview"("targetId", "role", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemberReview_authorId_targetId_role_key" ON "MemberReview"("authorId", "targetId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "MemberReviewReport_reviewId_userId_key" ON "MemberReviewReport"("reviewId", "userId");

-- AddForeignKey
ALTER TABLE "MemberReview" ADD CONSTRAINT "MemberReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberReview" ADD CONSTRAINT "MemberReview_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberReviewReport" ADD CONSTRAINT "MemberReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "MemberReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberReviewReport" ADD CONSTRAINT "MemberReviewReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

