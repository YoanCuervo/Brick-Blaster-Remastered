/** Facts shared by the legal pages, in one place so they never drift. */

/** Address published for the legal notice and for data protection requests. */
export const CONTACT_EMAIL: string | null = "contact@brickblaster.fr";

/** Date of the last change to any legal page. */
export const LEGAL_UPDATED = "22 novembre 2026";

/**
 * Days the nightly MySQL dumps stay in OVH Object Storage. Set by the infra repository's
 * lifecycle rule, which must match this value.
 */
export const BACKUP_RETENTION_DAYS = 30;

/**
 * Upper bound on how long a line stays in the API's logs. Docker rotates them by size only:
 * deploy/compose.yaml and deploy/README.md (§ Logs) explain why that size means this many days.
 */
export const SERVER_LOG_RETENTION_DAYS = 30;
