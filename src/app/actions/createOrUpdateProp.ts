'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';
import { propAuthoringSchema } from '@/lib/schemas/propAuthoring';

/**
 * Admin Server Action — author or edit a prop_question (ADM-04, D-13).
 *
 * Two branches:
 *
 *   - INSERT (no `id` in FormData): create a new prop with the supplied
 *     prompts + answer_type + points_value. We generate a unique `code`
 *     for the row because the DB column is NOT NULL and uniquely-indexed
 *     per tournament_id (see 0001_init.sql:135). Admin-authored props get
 *     a `CUSTOM_<timestamp>` code so they can never collide with the
 *     7 seed codes (WINNER, TOP_SCORER, …).
 *
 *   - UPDATE (id present): apply prompt + answer_type + points_value
 *     changes. `code`, `correct_answer`, `correct_answer_aliases`, and
 *     `tournament_id` are intentionally NOT touched — the grade flow
 *     owns correct_answer and aliases; tournament_id is immutable.
 *
 * Schema-to-DB column mapping: the Zod field is `points_value` (the
 * in-app contract from Plan 02-02), but the DB column is `points`
 * (0001_init.sql:139). The mapping happens here so the rest of the app
 * keeps using `points_value` consistently.
 *
 * T-02-06-01: gated by `await requireAdmin()` as the first executable
 * line after imports.
 * T-02-06-06 (XSS): React auto-escapes prompts on render; admin is
 * trusted per Phase 1 D-04 family-trust posture.
 *
 * Mutate-and-navigate per PATTERNS Pattern A — redirect() at the end.
 */

export async function createOrUpdateProp(formData: FormData): Promise<void> {
  await requireAdmin();

  const idRaw = formData.get('id');
  const parsed = propAuthoringSchema.safeParse({
    id: typeof idRaw === 'string' && idRaw.length > 0 ? idRaw : undefined,
    prompt_en: String(formData.get('prompt_en') ?? ''),
    prompt_he: String(formData.get('prompt_he') ?? ''),
    answer_type: String(formData.get('answer_type') ?? ''),
    points_value: String(formData.get('points_value') ?? ''),
  });
  if (!parsed.success) {
    redirect('/admin/props?error=validation' as Route);
  }
  const { id, prompt_en, prompt_he, answer_type, points_value } = parsed.data;

  const svc = createServiceClient();

  if (id) {
    // UPDATE existing — narrow scope, no correct_answer touch.
    const { error } = await svc
      .from('prop_questions')
      .update({
        prompt_en,
        prompt_he,
        answer_type,
        points: points_value,
      })
      .eq('id', id);
    if (error) {
      redirect(
        `/admin/props?error=${encodeURIComponent(error.message)}` as Route,
      );
    }
  } else {
    // INSERT new — need tournament_id and a unique code.
    const { data: t } = await svc
      .from('tournament')
      .select('id')
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!t) {
      redirect('/admin/props?error=no_tournament' as Route);
    }

    // CUSTOM_<timestamp> code — `code` is NOT NULL and unique per
    // tournament_id (0001_init.sql:143). Seed codes are uppercase
    // SCREAMING_CASE (WINNER, TOP_SCORER) so CUSTOM_ prefix never
    // collides. Timestamp gives us a sortable, human-readable suffix
    // (and admin authoring is single-operator per Phase 1 D-04, so
    // millisecond collisions are not a concern).
    const code = `CUSTOM_${Date.now()}`;

    const { error } = await svc.from('prop_questions').insert({
      tournament_id: t.id,
      code,
      prompt_en,
      prompt_he,
      answer_type,
      points: points_value,
      correct_answer: null,
      correct_answer_aliases: [],
    });
    if (error) {
      redirect(
        `/admin/props?error=${encodeURIComponent(error.message)}` as Route,
      );
    }
  }

  // Player feeds + admin tab so the new prop appears immediately.
  revalidatePath('/he/props');
  revalidatePath('/en/props');
  revalidatePath('/admin/props');

  redirect('/admin/props?saved=1' as Route);
}
