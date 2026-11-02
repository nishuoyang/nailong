-- CreateTable
CREATE TABLE "Meme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "mood" TEXT NOT NULL DEFAULT 'fish',
    "tags" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'user',
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Meme_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Meme_code_key" ON "Meme"("code");

-- CreateIndex
CREATE INDEX "Meme_status_created_at_idx" ON "Meme"("status", "created_at");

-- CreateIndex
CREATE INDEX "Meme_status_mood_idx" ON "Meme"("status", "mood");

-- CreateIndex
CREATE INDEX "Meme_user_id_created_at_idx" ON "Meme"("user_id", "created_at");
