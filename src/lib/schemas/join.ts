import { z } from 'zod';
import { displayNameSchema } from './displayName';

/**
 * Join form schema - validates BOTH client-side (via the form) and server-side
 * (via the joinPool Server Action). Single source of truth per the Zod 4 +
 * Server Actions pattern in CLAUDE.md.
 */
export const joinSchema = z.object({
  invite_code: z.string().trim().min(1, 'invalid_code'),
  display_name: displayNameSchema,
});

export type JoinInput = z.infer<typeof joinSchema>;
