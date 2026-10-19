-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitor" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "referrer" TEXT,
    "campaign" TEXT,
    "country" TEXT,
    "device" TEXT NOT NULL DEFAULT 'desktop',
    "browser" TEXT,
    "os" TEXT,
    "locale" TEXT,
    "bot" TEXT,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitor" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "results" INTEGER NOT NULL,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");

-- CreateIndex
CREATE INDEX "PageView_visitor_createdAt_idx" ON "PageView"("visitor", "createdAt");

-- CreateIndex
CREATE INDEX "SearchLog_createdAt_idx" ON "SearchLog"("createdAt");

