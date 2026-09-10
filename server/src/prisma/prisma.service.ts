import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.applySqlitePragmas();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * SQLite 运行参数调优。
   *
   * 背景：默认 journal_mode=delete 下，写事务会取得排他锁并阻塞所有读事务。
   * 本项目的图片详情页每次 GET 都会执行 viewCount+1（写操作），因此并发访问时
   * 读请求会被写请求阻塞。WAL 模式下读与写互不阻塞。
   *
   * 各 PRAGMA 的生效范围不同，这点很关键：
   *   - journal_mode 持久化在数据库文件头，设置一次即长期有效（重启后仍是 WAL）；
   *   - busy_timeout / synchronous 是「按连接」生效的，Prisma 连接池中的其它连接
   *     不会被这一条语句覆盖，因此这里只是尽力而为；主要收益来自 WAL。
   *
   * 注意：WAL 依赖共享内存，数据库必须位于支持字节范围锁的本地文件系统
   * （Docker 命名卷 / 本地 ext4 均可；NFS/SMB/9p 等网络文件系统不支持）。
   */
  private async applySqlitePragmas() {
    const url = process.env.DATABASE_URL ?? '';
    // 仅在能确定不是 SQLite 时跳过；未设置时仍尝试（失败会被下面的 catch 兜住）
    if (url && !url.startsWith('file:')) return;

    try {
      // 注意：SQLite 的 PRAGMA 设置语句会「返回一行结果」（返回设置后的新值），
      // 因此必须用 $queryRawUnsafe；用 $executeRawUnsafe 会报
      // "Execute returned results, which is not allowed in SQLite"。
      const [modeRow] = await this.$queryRawUnsafe<Array<{ journal_mode: string }>>(
        'PRAGMA journal_mode=WAL',
      );
      const mode = modeRow?.journal_mode?.toLowerCase();
      if (mode === 'wal') {
        this.logger.log('SQLite journal_mode=WAL 已启用（读写互不阻塞）');
      } else {
        this.logger.warn(
          `SQLite journal_mode 仍为 "${mode}"，WAL 未生效（数据库所在文件系统可能不支持共享内存）`,
        );
      }

      // PRAGMA 设置语句的返回值形态并不一致（易踩坑）：
      //   PRAGMA journal_mode=WAL      -> 回一行 [{journal_mode:'wal'}]
      //   PRAGMA busy_timeout=5000     -> 回一行 [{timeout:5000}]
      //   PRAGMA synchronous=NORMAL    -> 回空集 []（但确实已生效）
      // 因此设置完后统一「读回」实际值来校验，而不是依赖 setter 的返回值。
      await this.$queryRawUnsafe('PRAGMA busy_timeout=5000');
      await this.$queryRawUnsafe('PRAGMA synchronous=NORMAL');

      const [timeoutRow] = await this.$queryRawUnsafe<Array<{ timeout: number | bigint }>>(
        'PRAGMA busy_timeout',
      );
      const [syncRow] = await this.$queryRawUnsafe<Array<{ synchronous: number | bigint }>>(
        'PRAGMA synchronous',
      );
      this.logger.debug(
        `SQLite busy_timeout=${timeoutRow?.timeout}ms synchronous=${syncRow?.synchronous}(1=NORMAL)`,
      );
    } catch (err) {
      // 调优失败不应导致服务无法启动
      this.logger.warn(
        `SQLite PRAGMA 设置失败，服务继续启动：${(err as Error)?.message ?? err}`,
      );
    }
  }
}
