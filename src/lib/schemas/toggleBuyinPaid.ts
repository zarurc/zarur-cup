import { z } from 'zod';

export const toggleBuyinPaidSchema = z.object({
  target_user_id: z.string().uuid('target_invalid'),
  paid: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true'),
});

export type ToggleBuyinPaidInput = z.infer<typeof toggleBuyinPaidSchema>;
