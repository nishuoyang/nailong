-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ImageTag" (
    "image_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    PRIMARY KEY ("image_id", "tag_id"),
    CONSTRAINT "ImageTag_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "image_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "image_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Favorite_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Collection_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collection_id" TEXT NOT NULL,
    "image_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionItem_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionItem_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "follower_id" TEXT NOT NULL,
    "following_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Follow_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
INSERT INTO "new_Image" ("created_at", "description", "download_count", "height", "id", "is_featured", "like_count", "section", "status", "thumbnail_sm_url", "thumbnail_url", "title", "updated_at", "url", "user_id", "view_count", "width") SELECT "created_at", "description", "download_count", "height", "id", "is_featured", "like_count", "section", "status", "thumbnail_sm_url", "thumbnail_url", "title", "updated_at", "url", "user_id", "view_count", "width" FROM "Image";
DROP TABLE "Image";
ALTER TABLE "new_Image" RENAME TO "Image";
CREATE INDEX "Image_status_created_at_idx" ON "Image"("status", "created_at");
CREATE INDEX "Image_user_id_created_at_idx" ON "Image"("user_id", "created_at");
CREATE INDEX "Image_user_id_status_created_at_idx" ON "Image"("user_id", "status", "created_at");
CREATE INDEX "Image_status_section_created_at_idx" ON "Image"("status", "section", "created_at");
CREATE INDEX "Image_status_like_count_idx" ON "Image"("status", "like_count");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_created_at_idx" ON "Tag"("created_at");

-- CreateIndex
CREATE INDEX "ImageTag_tag_id_idx" ON "ImageTag"("tag_id");

-- CreateIndex
CREATE INDEX "Comment_image_id_created_at_idx" ON "Comment"("image_id", "created_at");

-- CreateIndex
CREATE INDEX "Comment_user_id_created_at_idx" ON "Comment"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "Favorite_image_id_idx" ON "Favorite"("image_id");

-- CreateIndex
CREATE INDEX "Favorite_user_id_created_at_idx" ON "Favorite"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_user_id_image_id_key" ON "Favorite"("user_id", "image_id");

-- CreateIndex
CREATE INDEX "Collection_user_id_created_at_idx" ON "Collection"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "Collection_is_public_created_at_idx" ON "Collection"("is_public", "created_at");

-- CreateIndex
CREATE INDEX "CollectionItem_image_id_idx" ON "CollectionItem"("image_id");

-- CreateIndex
CREATE INDEX "CollectionItem_collection_id_created_at_idx" ON "CollectionItem"("collection_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collection_id_image_id_key" ON "CollectionItem"("collection_id", "image_id");

-- CreateIndex
CREATE INDEX "Follow_following_id_created_at_idx" ON "Follow"("following_id", "created_at");

-- CreateIndex
CREATE INDEX "Follow_follower_id_created_at_idx" ON "Follow"("follower_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_follower_id_following_id_key" ON "Follow"("follower_id", "following_id");
