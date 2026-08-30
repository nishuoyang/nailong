#!/usr/bin/env python3
"""
从 MinIO 数据卷重建 Image 数据库记录（数据丢失恢复脚本）。

背景：早期 schema.prisma 将数据库 url 硬编码为 file:./data.db，导致服务实际使用
容器可写层里的 /app/prisma/data.db（镜像内），容器被重建时数据随之丢失。
MinIO 卷中的图片文件完好，本脚本扫描图片文件并重新生成 Image 记录。

前置条件：数据库必须是最新 schema（由容器 entrypoint 的 prisma migrate deploy
自动创建）。若数据库是旧 schema（缺少 created_at / thumbnail_sm_url 等列），
请先删除旧库文件并重新构建容器生成新库，再运行本脚本。

用法（在服务器项目目录执行）：
    docker compose -f docker-compose.prod.yml stop server
    python3 server/scripts/rebuild_images.py
    docker compose -f docker-compose.prod.yml start server
    docker compose -f docker-compose.prod.yml exec redis redis-cli flushdb
"""
import os
import re
import shutil
import sqlite3
import sys
import uuid
from datetime import datetime, timezone

# 可调整的路径
DB_PATH = "/var/lib/docker/volumes/nailonghub_sqlite_data/_data/data.db"
MINIO_DIR = "/var/lib/docker/volumes/nailonghub_minio_data/_data/nailong-images"
URL_PREFIX = "/minio/nailong-images/"
THUMB_MD_SUFFIX = "_thumb_md.jpg"
THUMB_SM_SUFFIX = "_thumb_sm.jpg"

IMAGE_EXTS = (".jpeg", ".jpg", ".png", ".webp")
DB_BACKUP_SUFFIX = ".pre-rebuild.bak"

# 需要的列（最新 schema）
REQUIRED_IMAGE_COLS = {"created_at", "updated_at", "thumbnail_sm_url", "thumbnail_url", "url", "title", "user_id", "status", "section"}
REQUIRED_USER_COLS = {"created_at", "role", "password_hash"}


def table_cols(cur, table: str) -> set:
    return {r[1] for r in cur.execute(f"PRAGMA table_info({table})")}


def main() -> int:
    if not os.path.exists(DB_PATH):
        print(f"[ERR] 数据库不存在: {DB_PATH}")
        print("提示：先 docker compose -f docker-compose.prod.yml up -d 让容器自动建库+seed，再运行本脚本")
        return 1
    if not os.path.isdir(MINIO_DIR):
        print(f"[ERR] MinIO 目录不存在: {MINIO_DIR}")
        print("提示：用 docker volume ls 确认 MinIO 卷名，并修改本脚本 MINIO_DIR")
        return 1

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. 校验表结构（旧 schema 库不能直接使用）
    try:
        img_cols = table_cols(cur, "Image")
        user_cols = table_cols(cur, "User")
    except sqlite3.OperationalError as e:
        print(f"[ERR] 无法读取表结构: {e}")
        return 1

    missing_img = REQUIRED_IMAGE_COLS - img_cols
    missing_user = REQUIRED_USER_COLS - user_cols
    if missing_img or missing_user:
        print("[ERR] 数据库不是最新 schema，缺少列:", sorted(missing_img | missing_user))
        print("请执行以下步骤重建数据库后再运行本脚本：")
        print("  1) mv /var/lib/docker/volumes/nailonghub_sqlite_data/_data/data.db /root/nailonghub/data.legacy.bak.db")
        print("  2) docker compose -f docker-compose.prod.yml up -d --build   # 自动建库并 seed 管理员")
        print("  3) docker compose -f docker-compose.prod.yml stop server")
        print("  4) python3 server/scripts/rebuild_images.py")
        return 1

    # 2. 备份数据库（幂等）
    backup = DB_PATH + DB_BACKUP_SUFFIX
    if not os.path.exists(backup):
        shutil.copy2(DB_PATH, backup)
        print(f"[OK] 数据库已备份 -> {backup}")

    # 3. 修复历史写入的空格格式日期（Prisma SQLite 要求 ISO 8601，如 2026-07-15T22:03:45.495Z）
    def norm_date(v: str) -> str:
        if v and "T" not in v:
            return v.replace(" ", "T") + "Z"
        return v

    fixed_rows = 0
    for rid, ca, ua in cur.execute("SELECT id, created_at, updated_at FROM Image"):
        nca, nua = norm_date(ca or ""), norm_date(ua or "")
        if nca != ca or nua != ua:
            cur.execute("UPDATE Image SET created_at=?, updated_at=? WHERE id=?", (nca, nua, rid))
            fixed_rows += 1
    if fixed_rows:
        conn.commit()
        print(f"[FIX] 已修复日期格式: {fixed_rows} 条记录")

    # 4. 已有 URL（幂等）
    existing = {r[0] for r in cur.execute("SELECT url FROM Image")}
    print(f"[INFO] 数据库中已有图片记录: {len(existing)} 条")

    # 4. 找到管理员用户
    admin = cur.execute(
        "SELECT id, username FROM User WHERE role='admin' ORDER BY created_at LIMIT 1"
    ).fetchone()
    if not admin:
        admin = cur.execute(
            "SELECT id, username FROM User ORDER BY created_at LIMIT 1"
        ).fetchone()
    if not admin:
        print("[ERR] 数据库中没有用户，请用 seed 初始化（docker compose up -d --build）")
        return 1
    admin_id = admin[0]
    print(f"[INFO] 恢复归属用户: {admin[1]} ({admin_id})")

    # 5. 扫描原图文件（排除缩略图）
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

        stem = os.path.splitext(name)[0]
        thumb_md = (
            URL_PREFIX + stem + THUMB_MD_SUFFIX
            if os.path.exists(os.path.join(MINIO_DIR, stem + THUMB_MD_SUFFIX))
            else None
        )
        thumb_sm = (
            URL_PREFIX + stem + THUMB_SM_SUFFIX
            if os.path.exists(os.path.join(MINIO_DIR, stem + THUMB_SM_SUFFIX))
            else None
        )

        # 从文件名提取时间戳（毫秒）作为 createdAt（Prisma SQLite 需要 ISO 8601 格式）
        m = re.match(r"(\d{13})", name)
        if m:
            ts = int(m.group(1))
            created = (
                datetime.fromtimestamp(ts // 1000, tz=timezone.utc)
                .strftime("%Y-%m-%dT%H:%M:%S")
                + f".{ts % 1000:03d}Z"
            )
        else:
            created = (
                datetime.now(tz=timezone.utc)
                .strftime("%Y-%m-%dT%H:%M:%S")
                + f".{datetime.now().microsecond // 1000:03d}Z"
            )
        title = f"恢复图片-{created[:10]}" if m else name
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
    print("接下来：docker compose -f docker-compose.prod.yml start server")
    print("        docker compose -f docker-compose.prod.yml exec redis redis-cli flushdb")
    return 0


if __name__ == "__main__":
    sys.exit(main())
