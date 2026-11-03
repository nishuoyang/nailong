-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "thumbnail_sm_url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "section" TEXT NOT NULL DEFAULT 'general',
    "batch_id" TEXT,
    "batch_index" INTEGER NOT NULL DEFAULT 0,
    "batch_size" INTEGER NOT NULL DEFAULT 1,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "blur_data_url" TEXT,
    "dominant_color" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Image_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Image" ("blur_data_url", "comment_count", "created_at", "description", "dominant_color", "download_count", "favorite_count", "height", "id", "is_featured", "like_count", "section", "status", "thumbnail_sm_url", "thumbnail_url", "title", "updated_at", "url", "user_id", "view_count", "width") SELECT "blur_data_url", "comment_count", "created_at", "description", "dominant_color", "download_count", "favorite_count", "height", "id", "is_featured", "like_count", "section", "status", "thumbnail_sm_url", "thumbnail_url", "title", "updated_at", "url", "user_id", "view_count", "width" FROM "Image";
DROP TABLE "Image";
ALTER TABLE "new_Image" RENAME TO "Image";
CREATE INDEX "Image_status_created_at_idx" ON "Image"("status", "created_at");
CREATE INDEX "Image_user_id_created_at_idx" ON "Image"("user_id", "created_at");
CREATE INDEX "Image_user_id_status_created_at_idx" ON "Image"("user_id", "status", "created_at");
CREATE INDEX "Image_status_section_created_at_idx" ON "Image"("status", "section", "created_at");
CREATE INDEX "Image_status_like_count_idx" ON "Image"("status", "like_count");
CREATE INDEX "Image_batch_id_batch_index_idx" ON "Image"("batch_id", "batch_index");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
