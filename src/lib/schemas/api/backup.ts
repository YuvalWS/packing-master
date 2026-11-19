import { z } from 'zod';

export const CreateBackupRequest = z
  .object({ reason: z.enum(['manual', 'pre-update', 'daily']).optional() })
  .strict();
export type CreateBackupRequest = z.infer<typeof CreateBackupRequest>;
