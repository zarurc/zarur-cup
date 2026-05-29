import { z } from 'zod';
import { displayNameSchema } from './displayName';

/**
 * Input schema for the admin updateProfileName Server Action (R3 —
 * roster rename). Reuses displayNameSchema so the rules match /join
 * exactly (NFC-normalized, 2-24 chars, letters/digits/spaces, no
 * leading/trailing whitespace).
 */
export const updateProfileNameSchema = z.object({
  target_user_id: z.string().uuid('target_invalid'),
  new_name: displayNameSchema,
});

export type UpdateProfileNameInput = z.infer<typeof updateProfileNameSchema>;
