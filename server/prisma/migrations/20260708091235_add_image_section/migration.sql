-- CreateEnum
CREATE TYPE "ImageSection" AS ENUM ('general', 'other');

-- AlterTable
ALTER TABLE "images" ADD COLUMN     "section" "ImageSection" NOT NULL DEFAULT 'general';
