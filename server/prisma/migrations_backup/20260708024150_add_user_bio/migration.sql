-- CreateEnum
CREATE TYPE "BioStatus" AS ENUM ('approved', 'pending');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "bio_status" "BioStatus" DEFAULT 'approved';
