import { type Cutoffs, INACTIVITY_NOTICE_MS, WARNINGS_PER_RUN } from "../cleanup";
import type { Mailer } from "../mail/mailer";
import { inactiveAccountMail } from "../mail/templates";
import { SITE_PATHS } from "../routes/auth";
import type { AccountStore } from "../store/accounts";

export class WarningError extends Error {}

/**
 * Warns the accounts nearing deletion for inactivity, part of the hourly purge. A warning is
 * marked sent only once the mailer took it: a failed one is tried again an hour later.
 */
export function inactivityWarner(
  store: AccountStore,
  mailer: Mailer,
  siteUrl: string,
): (cutoffs: Cutoffs) => Promise<void> {
  return async (cutoffs) => {
    const accounts = await store.findAccountsToWarn(cutoffs.warnBefore, WARNINGS_PER_RUN);
    // The purge deletes the account once the warning is this old.
    const deleteOn = new Date(cutoffs.now.getTime() + INACTIVITY_NOTICE_MS);
    const failures: string[] = [];
    for (const account of accounts) {
      try {
        await mailer.send(
          inactiveAccountMail(account.email, deleteOn, `${siteUrl}${SITE_PATHS.signIn}`, siteUrl),
        );
      } catch (error: unknown) {
        failures.push(error instanceof Error ? error.message : "unknown");
        continue;
      }
      await store.markInactivityWarned(account.id, cutoffs.now, cutoffs.warnBefore);
    }
    // Without the addresses: the reasons are enough to investigate.
    if (failures.length > 0) {
      throw new WarningError(
        `${failures.length} inactivity warning(s) not sent: ${[...new Set(failures)].join("; ")}`,
      );
    }
  };
}
