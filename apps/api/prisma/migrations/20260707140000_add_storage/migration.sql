-- CreateTable
CREATE TABLE "StorageBucket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "StorageBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageObject" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bucketId" TEXT NOT NULL,

    CONSTRAINT "StorageObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageBucket_userId_name_key" ON "StorageBucket"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StorageObject_bucketId_key_key" ON "StorageObject"("bucketId", "key");

-- AddForeignKey
ALTER TABLE "StorageBucket" ADD CONSTRAINT "StorageBucket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageObject" ADD CONSTRAINT "StorageObject_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "StorageBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
