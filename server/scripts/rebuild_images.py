#!/usr/bin/env python3
"""
从 MinIO 数据卷重建 Image 数据库记录（数据丢失恢复脚本）。

背景：早期 schema.prisma 将数据库 url 硬编码为 file:./data.db，导致服务实际使用
容器可写层里的 /app/prisma/data.db（镜像内），容器被重建时数据随之丢失。
MinIO 卷中的图片文件完好，本脚本扫描图片文件并重新生成 Image 记录。

用法（在服务器项目目录执行，先停止 server 容器）：
    docker compose -f docker-compose.prod.yml stop server
    python3 server/scripts/rebuild_images.py
    docker compose -f docker-compose.prod.yml up -d --build
    docker compose -f docker-compose.prod.yml exec redis redis-cli flushdb
"""
import os
import re
import shutil
import sqlite3
import sys
import uuid
from datetime import datetime

# 可调整的路径
DB_PATH = "/var/lib/docker/volumes/nailonghub_sqlite_data/_data/data.db"
MINIO_DIR = "/var/lib/docker/volumes/nailonghub_minio_data/_data/nailong-images"
URL_PREFIX = "/minio/nailong-images/"
THUMB_MD_SUFFIX = "_thumb_md.jpg"
THUMB_SM_SUFFIX = "_thumb_sm.jpg"

IMAGE_EXTS = (".jpeg", ".jpg", ".png", ".webp")
DB_BACKUP_SUFFIX = ".pre-rebuild.bak"


def main() -> int:
    if not os.path.exists(DB_PATH):
        print(f"[ERR] 数据库不存在: {DB_PATH}")
        print("提示：先 docker compose -f docker-compose.prod.yml up -d 生成卷后再运行，或手动指定路径")
        return 1
    if not os.path.isdir(MINIO_DIR):
        print(f"[ERR] MinIO 目录不存在: {MINIO_DIR}")
        print("提示：用 docker volume ls 确认 MinIO 卷名，再修改本脚本 MINIO_DIR")
        return 1

    # 1. 备份数据库
    backup = DB_PATH + DB_BACKUP_SUFFIX
    if not os.path.exists(backup):
        shutil.copy2(DB_PATH, backup)
        print(f"[OK] 数据库已备份 -> {backup}")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 2. 已有 URL（幂等）
    existing = {r[0] for r in cur.execute("SELECT url FROM Image")}
    print(f"[INFO] 数据库中已有图片记录: {len(existing)} 条")

    # 3. 找到管理员用户
    admin = cur.execute(
        "SELECT id, username FROM User WHERE role='admin' ORDER BY createdAt LIMIT 1"
    ).fetchone()
    if not admin:
        admin = cur.execute(
            "SELECT id, username FROM User ORDER BY createdAt LIMIT 1"
        ).fetchone()
    if not admin:
        print("[ERR] 数据库中没有用户，请先在管理后台注册管理员")
        return 1
    admin_id = admin[0]
    print(f"[INFO] 恢复归属用户: {admin[1]} ({admin_id})")

    # 4. 扫描原图文件（排除缩略图）
    files = sorted(os.listdir(MINIO_DIR))
    originals = [
        f
        for f in files
        if f.lower().endswith(IMAGE_EXTS) and "_thumb_" not in f
    ]
    print(f"[INFO] MinIO 中找到原图: {len(originals)} 张")

    inserted = 0
    skipped = 0
    for name in originals:
        url = URL_PREFIX + name
        if url in existing:
            skipped += 1
            continue

        md = THUMB_MD_SUFFIX
        sm = THUMB_SM_SUFFIX
        # 原图扩展名可能非 jpg，但缩略图统一为 .jpg
        stem = os.path.splitext(name)[0]
        thumb_md = URL_PREFIX + stem + md if os.path.exists(os.path.join(MINIO_DIR, stem + md)) else None
        thumb_sm = URL_PREFIX + stem + sm if os.path.exists(os.path.join(MINIO_DIR, stem + sm)) else None

        # 从文件名提取时间戳（毫秒）作为 createdAt
        m = re.match(r"(\d{13})", name)
        created = (
            datetime.fromtimestamp(int(m.group(1)) / 1000)
            if m
            else datetime.now()
        )
        title = m and f"恢复图片-{created.strftime('%Y-%m-%d')}" or name
        description = "图片文件由数据恢复脚本自动重建，原标题与互动数据已随旧容器丢失。"

        cur.execute(
            """INSERT INTO Image
               (id, title, description, url, thumbnail_url, thumbnail_sm_url,
                user_id, status, section, is_featured, like_count, download_count,
                view_count, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 'general', 0, 0, 0, 0, ?, ?)""",
            (
                str(uuid.uuid4()),
                title,
                description,
                url,
                thumb_md,
                thumb_sm,
                admin_id,
                created,
                created,
            ),
        )
        inserted += 1

    conn.commit()
    total = cur.execute("SELECT COUNT(*) FROM Image").fetchone()[0]
    conn.close()
    print(f"[DONE] 新增 {inserted} 条，跳过（已存在）{skipped} 条，数据库现有图片总数 {total}")
    print("接下来：docker compose -f docker-compose.prod.yml up -d --build，并清空 Redis 旧缓存")
    return 0


if __name__ == "__main__":
    sys.exit(main())
