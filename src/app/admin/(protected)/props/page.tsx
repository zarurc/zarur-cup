import { adminReadClient } from '@/lib/auth/adminReadClient';
import { getTranslations } from 'next-intl/server';
import { PropAuthoringForm } from '@/components/admin/PropAuthoringForm.client';
import { PropGradeForm } from '@/components/admin/PropGradeForm.client';

/**
 * /admin/props — prop authoring + grading page (ADM-04 + PRP-04 + D-13).
 *
 * Top section: an empty PropAuthoringForm for creating new props.
 * Below: every existing prop_question with two collapsed <details>:
 *   - "Edit prop" → expanded edit form (PropAuthoringForm with `existing`)
 *   - "Grade Props" → expanded grade form (PropGradeForm)
 *
 * Reads use adminReadClient (Pitfall 10). NO requireAdmin() call —
 * parent layout enforces.
 *
 * DB column note: the table column is `points` (smallint), but the
 * in-app Zod schema field is `points_value` (from Plan 02-02). We
 * map at the boundary — the DB read selects `points`, then we expose
 * it as `points_value` to the client form so the wire shape matches
 * the schema the action expects on submit. (createOrUpdateProp.ts does
 * the reverse mapping when writing.)
 */
export default async function AdminPropsPage() {
  const t = await getTranslations('admin.props');
  const svc = await adminReadClient();

  const { data: questions } = await svc
    .from('prop_questions')
    .select(
      'id, prompt_en, prompt_he, answer_type, points, correct_answer, correct_answer_aliases, display_order',
    )
    .order('display_order', { ascending: true });

  return (
    <main className="pi-4 pbs-4 pbe-24">
      <h1 className="text-xl font-bold mbs-2 mbe-4">{t('authorHeading')}</h1>
      <PropAuthoringForm />

      <h2 className="text-base font-bold mbs-6 mbe-3">
        {t('authorHeading')} — existing
      </h2>
      {(questions ?? []).map((q) => (
        <section
          key={q.id}
          className="mbs-4 pbs-4 pbe-4 border-b border-[var(--zc-border)]"
        >
          <h3 className="text-base font-bold">{q.prompt_en}</h3>
          <p className="text-sm text-[var(--zc-muted-foreground)] mbs-1">
            <span dir="rtl">{q.prompt_he}</span> · {q.answer_type} ·{' '}
            <span dir="ltr">{q.points}</span> pts
          </p>
          <details className="mbs-2">
            <summary className="text-sm text-[var(--zc-primary)] cursor-pointer underline">
              Edit prop
            </summary>
            <PropAuthoringForm
              existing={{
                id: q.id,
                prompt_en: q.prompt_en,
                prompt_he: q.prompt_he,
                answer_type: q.answer_type as
                  | 'single_team'
                  | 'single_player'
                  | 'text'
                  | 'yes_no',
                points_value: q.points,
              }}
            />
          </details>
          <details className="mbs-2">
            <summary className="text-sm text-[var(--zc-primary)] cursor-pointer underline">
              {t('gradeHeading')}
            </summary>
            <PropGradeForm
              questionId={q.id}
              initialCorrect={q.correct_answer}
              initialAliases={q.correct_answer_aliases ?? []}
            />
          </details>
        </section>
      ))}
    </main>
  );
}
