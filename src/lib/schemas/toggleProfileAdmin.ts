import { z } from 'zod';

/**
 * Input schema for the admin toggleProfileAdmin Server Action (R4 —
 * promote/demote). `make_admin` arrives as a FormData string; we coerce
 * to boolean via z.enum so unexpected values don't sneak through.
 */
export const toggleProfileAdminSchema = z.object({
  target_user_id: z.string().uuid('target_invalid'),
  make_admin: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true'),
});

export type ToggleProfileAdminInput = z.infer<typeof toggleProfileAdminSchema>;
