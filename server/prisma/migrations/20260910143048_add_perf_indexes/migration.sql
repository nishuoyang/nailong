-- CreateIndex
CREATE INDEX "Download_user_id_created_at_idx" ON "Download"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "Download_image_id_idx" ON "Download"("image_id");

-- CreateIndex
CREATE INDEX "Image_user_id_created_at_idx" ON "Image"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "Image_user_id_status_created_at_idx" ON "Image"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "ImagesOnCategories_categoryId_idx" ON "ImagesOnCategories"("categoryId");

-- CreateIndex
CREATE INDEX "Like_image_id_idx" ON "Like"("image_id");

-- CreateIndex
CREATE INDEX "User_created_at_idx" ON "User"("created_at");

-- CreateIndex
CREATE INDEX "User_bio_status_created_at_idx" ON "User"("bio_status", "created_at");
