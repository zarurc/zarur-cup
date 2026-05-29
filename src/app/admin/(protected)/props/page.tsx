import { adminReadClient } from '@/lib/auth/adminReadClient';
import { getTranslations } from 'next-intl/server';
import { PropAuthoringForm } from '@/components/admin/PropAuthoringForm.client';
import { PropGradeForm } from '@/components/admin/PropGradeForm.client';
import { AdminToast } from '@/components/admin/AdminToast.client';
import { resolveAdminToast } from '@/lib/admin/toast';

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
type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPropsPage({ searchParams }: PageProps) {
  const t = await getTranslations('admin.props');
  const svc = await adminReadClient();
  const toast = resolveAdminToast(await searchParams);

  const { data: questions } = await svc
    .from('prop_questions')
    .select(
      'id, prompt_en, prompt_he, answer_type, points, correct_answer, correct_answer_aliases, display_order',
    )
    .order('display_order', { ascending: true });

  // Teams roster — fed to PropGradeForm so single_team grading is a
  // dropdown of real teams instead of a raw-UUID typing exercise. Sorted
  // by code so the picker is alphabetical / scannable.
  const { data: teams } = await svc
    .from('teams')
    .select('id, code, name_en')
    .order('code', { ascending: true });
  const teamList = teams ?? [];

  return (
    <main className="pi-4 pbs-4 pbe-24">
      {toast && (
        <AdminToast
          key={`${toast.tone}:${toast.message}`}
          tone={toast.tone}
          message={toast.message}
        />
      )}
      <h1 className="text-xl font-bold mbs-2 mbe-4">{t('authorHeading')}</h1>
      <PropAuthoringForm />

      <h2 className="text-base font-bold mbs-6 mbe-3">Existing questions</h2>
      {(questions ?? []).map((q) => (
        <section
          key={q.id}
          className="mbs-4 pbs-4 pbe-4 border-b border-[var(--zc-border)]"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-bold flex-1">{q.prompt_en}</h3>
            {q.correct_answer !== null ? (
              <span
                className="shrink-0 text-xs font-bold pi-2 pbs-1 pbe-1 rounded-full bg-[var(--zc-integrity-ok)] text-white tabular-nums"
                aria-label="Graded"
              >
                ✓ Graded
              </span>
            ) : (
              <span
                className="shrink-0 text-xs font-bold pi-2 pbs-1 pbe-1 rounded-full bg-[var(--zc-muted)] text-[var(--zc-muted-foreground)]"
                aria-label="Ungraded"
              >
                Ungraded
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--zc-muted-foreground)] mbs-1">
            <span dir="rtl">{q.prompt_he}</span> · {q.answer_type} ·{' '}
            <span dir="ltr">{q.points}</span> pts
          </p>
          <details className="mbs-3 group">
            <summary className="list-none inline-flex items-center gap-1 pi-3 pbs-1 pbe-1 text-sm font-bold text-[var(--zc-primary)] border border-[var(--zc-border)] rounded-full cursor-pointer hover:bg-[var(--zc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]">
              Edit prop
              <span
                aria-hidden
                className="text-[var(--zc-muted-foreground)] transition-transform duration-150 group-open:rotate-180"
              >
                ▾
              </span>
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
          <details className="mbs-2 mis-2 group">
            <summary className="list-none inline-flex items-center gap-1 pi-3 pbs-1 pbe-1 text-sm font-bold text-[var(--zc-primary)] border border-[var(--zc-border)] rounded-full cursor-pointer hover:bg-[var(--zc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]">
              {t('gradeHeading')}
              <span
                aria-hidden
                className="text-[var(--zc-muted-foreground)] transition-transform duration-150 group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <PropGradeForm
              questionId={q.id}
              answerType={
                q.answer_type as
                  | 'single_team'
                  | 'single_player'
                  | 'text'
                  | 'yes_no'
              }
              initialCorrect={q.correct_answer}
              initialAliases={q.correct_answer_aliases ?? []}
              teams={teamList}
            />
          </details>
        </section>
      ))}
    </main>
  );
}
