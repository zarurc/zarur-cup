import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireMember } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { EmptyStateCard } from '@/components/layout/EmptyStateCard';
import {
  BracketTree,
} from '@/components/bracket/BracketTree';
import type { BracketSlotForView } from '@/components/bracket/SlotRow';

type Props = { params: Promise<{ locale: string }> };

/**
 * /[locale]/bracket — read-only knockout tree view (D-40 + D-47 + BRK-VIEW-01..05).
 *
 * Replaces the Phase 1 EmptyStateCard placeholder. Server component; ONE
 * Supabase relational query joins bracket_slots → fixtures → teams
 * (home, away, resolved). The query returns ~32 rows; response ~5-10KB.
 *
 * Live-fill: the existing /admin/matches saveResult Server Action calls
 * revalidatePath('/[he|en]/bracket') after each Save Result (see
 * src/lib/scoring/sweepAndUpsert.ts REVALIDATE_PATHS — Plan 02-11 Task 5
 * adds /bracket entries; Plan 02-10 already updated /me/props entries).
 *
 * Layout: column-of-rounds — one section per stage, top-down (works
 * identically in HE RTL and EN LTR; no SVG positioning math).
 */
export default async function BracketPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const safeLocale: 'he' | 'en' = locale === 'he' ? 'he' : 'en';
  await requireMember(safeLocale);
  const t = await getTranslations('bracket');
  const tPh = await getTranslations('bracketPlaceholders');
  const supabase = await createClient();

  // Single relational SELECT. The PostgREST embed syntax joins server-side
  // — one round trip, ~5-10KB response at 32 slots.
  const { data: slotsRaw } = await supabase
    .from('bracket_slots')
    .select(
      `slot_code, stage, parent_slot_id,
       resolved_team:resolved_team_id ( id, code, name_en, name_he ),
       fixture:fixture_id (
         external_match_no, kickoff_at, result_home_90min, result_away_90min,
         home_placeholder, away_placeholder,
         home_team:home_team_id ( id, code, name_en, name_he ),
         away_team:away_team_id ( id, code, name_en, name_he )
       )`,
    )
    .order('stage', { ascending: true })
    .order('slot_code', { ascending: true });

  if (!slotsRaw || slotsRaw.length === 0) {
    return (
      <EmptyStateCard heading={t('emptyHeading')} body={t('emptyBody')} />
    );
  }

  // Generated PostgREST types widen embedded relations to `unknown[]` or
  // similar in some configurations; cast to the view shape we control.
  const slots = slotsRaw as unknown as BracketSlotForView[];

  // Localized placeholder lookup. Raw values come from data/wc2026/fixtures.csv
  // (WINNER_GROUP_A, RUNNER_UP_GROUP_B, R32_M1_W, R16_M1_W, etc.). The
  // messages bundle (Task 4) maps each to a localized label; fallback to
  // the raw string if no key matches.
  const placeholderPrefix = (raw: string): string => {
    if (!raw) return '—';
    const key = `key_${raw.toLowerCase()}`;
    try {
      return tPh(key as never);
    } catch {
      return raw;
    }
  };

  return (
    <BracketTree
      slots={slots}
      locale={safeLocale}
      labels={{
        round32: t('round32'),
        round16: t('round16'),
        quarter: t('quarter'),
        semi: t('semi'),
        final: t('final'),
        third: t('third'),
        champion: t('champion'),
        winnerLabel: t('winnerLabel'),
        championTbdLabel: t('championTbdLabel'),
        tieAtNinetyLabel: t('tieAtNinetyLabel'),
        placeholderPrefix,
      }}
    />
  );
}
