import { Fragment } from 'react';
import { SlotRow, type BracketSlotForView } from '@/components/bracket/SlotRow';

type BracketTreeLabels = {
  round32: string;
  round16: string;
  quarter: string;
  semi: string;
  final: string;
  third: string;
  champion: string;
  winnerLabel: string;
  championTbdLabel: string;
  tieAtNinetyLabel: string;
  placeholderPrefix: (raw: string) => string;
};

const STAGE_ORDER = [
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final',
  'third_place',
  'champion',
] as const;

const HEADING_KEY_BY_STAGE: Record<(typeof STAGE_ORDER)[number], keyof BracketTreeLabels> = {
  round_of_32: 'round32',
  round_of_16: 'round16',
  quarter_final: 'quarter',
  semi_final: 'semi',
  final: 'final',
  third_place: 'third',
  champion: 'champion',
};

/**
 * Column-of-rounds bracket layout (D-47). Each stage is a heading + a
 * vertical list of SlotRow cards. Mobile-first; column-of-rounds avoids
 * SVG positioning gymnastics and works identically in HE RTL and EN LTR.
 *
 * Server component — zero client JS shipped for this route.
 */
export function BracketTree({
  slots,
  locale,
  labels,
}: {
  slots: BracketSlotForView[];
  locale: 'he' | 'en';
  labels: BracketTreeLabels;
}) {
  const grouped = Object.fromEntries(
    STAGE_ORDER.map((s) => [s, slots.filter((x) => x.stage === s)]),
  ) as Record<(typeof STAGE_ORDER)[number], BracketSlotForView[]>;

  const slotLabels = {
    winnerLabel: labels.winnerLabel,
    championTbdLabel: labels.championTbdLabel,
    tieAtNinetyLabel: labels.tieAtNinetyLabel,
    placeholderPrefix: labels.placeholderPrefix,
  };

  return (
    <div className="mi-auto max-is-2xl pi-4 pbe-24">
      {STAGE_ORDER.map((stage) => {
        const stageSlots = grouped[stage];
        if (stageSlots.length === 0) return null;
        const headingKey = HEADING_KEY_BY_STAGE[stage];
        const heading = labels[headingKey] as string;
        return (
          <Fragment key={stage}>
            <h2 className="text-lg font-bold text-[var(--zc-primary)] mbs-6 mbe-2">
              {heading}
            </h2>
            <ul className="grid grid-cols-1 gap-2 mbe-2">
              {stageSlots.map((slot) => (
                <SlotRow
                  key={slot.slot_code}
                  slot={slot}
                  locale={locale}
                  labels={slotLabels}
                />
              ))}
            </ul>
          </Fragment>
        );
      })}
    </div>
  );
}
