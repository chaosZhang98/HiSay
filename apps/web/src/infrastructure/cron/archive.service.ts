import cron from "node-cron";
import type Database from "better-sqlite3";
import type { IMessageRepository } from "../../domain/repositories";

const ARCHIVE_CUTOFF_DAYS = 90;
const DEFAULT_ARCHIVE_SCHEDULE = "0 2 * * *";
const DEFAULT_VACUUM_SCHEDULE = "0 3 */30 * *";

export interface ArchiveServiceOptions {
  archiveSchedule?: string;
  vacuumSchedule?: string;
  cutoffDays?: number;
}

export class ArchiveService {
  private archiveJob?: cron.ScheduledTask;
  private vacuumJob?: cron.ScheduledTask;

  constructor(
    private readonly messages: IMessageRepository,
    private readonly db: Database.Database,
    private readonly options: ArchiveServiceOptions = {},
  ) {}

  start() {
    const archiveSchedule = this.options.archiveSchedule ?? DEFAULT_ARCHIVE_SCHEDULE;
    const vacuumSchedule = this.options.vacuumSchedule ?? DEFAULT_VACUUM_SCHEDULE;

    if (!cron.validate(archiveSchedule)) {
      throw new Error(`Invalid archive cron expression: ${archiveSchedule}`);
    }
    if (!cron.validate(vacuumSchedule)) {
      throw new Error(`Invalid vacuum cron expression: ${vacuumSchedule}`);
    }

    this.archiveJob = cron.schedule(archiveSchedule, async () => {
      const cutoffDays = this.options.cutoffDays ?? ARCHIVE_CUTOFF_DAYS;
      const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);
      try {
        const count = await this.messages.archiveBefore(cutoff);
        console.log(`[archive] archived ${count} messages before ${cutoff.toISOString()}`);
      } catch (err) {
        console.error("[archive] failed to archive messages", err);
      }
    });

    this.vacuumJob = cron.schedule(vacuumSchedule, () => {
      try {
        this.db.exec("VACUUM");
        console.log("[archive] vacuum completed");
      } catch (err) {
        console.error("[archive] vacuum failed", err);
      }
    });
  }

  stop() {
    this.archiveJob?.stop();
    this.vacuumJob?.stop();
  }
}
