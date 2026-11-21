import { DIFFICULTY_FACTORS, LIMITS } from './constants';
import type {
  CycleBlock,
  CyclePlan,
  CycleSettings,
  Discipline,
  SubjectAllocation,
} from './types';

const EPS = 1e-9;
const GRANULARITY = 5;

export interface ShareBounds {
  minShare: number;
  maxShare: number;
  feasible: boolean;
}

export function clampAdjustment(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 1;
  return Math.min(LIMITS.MAX_ADJUSTMENT, Math.max(LIMITS.MIN_ADJUSTMENT, value));
}

export function disciplineScore(
  d: Pick<Discipline, 'weight' | 'difficulty' | 'adjustment'>,
): number {
  const weight = Math.min(LIMITS.MAX_WEIGHT, Math.max(LIMITS.MIN_WEIGHT, d.weight));
  return weight * DIFFICULTY_FACTORS[d.difficulty] * clampAdjustment(d.adjustment);
}

export function computeBounds(
  n: number,
  cycleMinutes: number,
  minBlockMinutes: number,
): ShareBounds {
  if (n <= 0) return { minShare: 0, maxShare: 1, feasible: true };
  if (n === 1) return { minShare: 1, maxShare: 1, feasible: true };
  const equal = 1 / n;
  let minShare = 0.5 * equal;
  const maxShare = n === 2 ? 0.75 : Math.max(equal, Math.min(0.45, 2.5 * equal));
  const absoluteMin = cycleMinutes > 0 ? minBlockMinutes / cycleMinutes : 1;
  let feasible = true;
  if (absoluteMin * n > 1 + EPS) {
    feasible = false;
    minShare = equal;
  } else {
    minShare = Math.max(minShare, absoluteMin);
  }
  return { minShare, maxShare: Math.max(maxShare, minShare), feasible };
}

export function boundedShares(
  scores: number[],
  minShare: number,
  maxShare: number,
): { shares: number[]; clamps: ('min' | 'max' | null)[] } {
  const n = scores.length;
  if (n === 0) return { shares: [], clamps: [] };
  const total = scores.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return { shares: scores.map(() => 1 / n), clamps: scores.map(() => null) };
  }
  const sumFor = (lambda: number) =>
    scores.reduce(
      (acc, s) => acc + Math.min(maxShare, Math.max(minShare, lambda * s)),
      0,
    );

  let lo = 0;
  let hi = 1 / Math.min(...scores.filter((s) => s > 0));
  while (sumFor(hi) < 1 - EPS && hi < 1e12) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (sumFor(mid) < 1) lo = mid;
    else hi = mid;
  }
  const lambda = (lo + hi) / 2;
  const clamps: ('min' | 'max' | null)[] = [];
  const shares = scores.map((s) => {
    const v = lambda * s;
    if (v < minShare - 1e-7) {
      clamps.push('min');
      return minShare;
    }
    if (v > maxShare + 1e-7) {
      clamps.push('max');
      return maxShare;
    }
    clamps.push(null);
    return v;
  });
  const sum = shares.reduce((a, b) => a + b, 0);
  return { shares: shares.map((s) => s / sum), clamps };
}

export function apportionMinutes(
  shares: number[],
  totalMinutes: number,
  minMinutes: number,
  tieBreak: number[] = shares,
  granularity: number = GRANULARITY,
): number[] {
  const n = shares.length;
  if (n === 0) return [];
  const units = Math.floor(totalMinutes / granularity);
  const extra = totalMinutes - units * granularity;
  const ideal = shares.map((s) => s * units);
  const alloc = ideal.map((x) => Math.floor(x + EPS));
  let remaining = units - alloc.reduce((a, b) => a + b, 0);
  const order = ideal
    .map((x, i) => ({ i, frac: x - Math.floor(x + EPS), tie: tieBreak[i] }))
    .sort((a, b) => b.frac - a.frac || b.tie - a.tie || a.i - b.i);
  for (let k = 0; remaining > 0; k = (k + 1) % n) {
    alloc[order[k].i] += 1;
    remaining -= 1;
  }
  const minUnits = Math.ceil(minMinutes / granularity - EPS);
  if (minUnits * n <= units) {
    for (let i = 0; i < n; i++) {
      while (alloc[i] < minUnits) {
        let donor = -1;
        for (let j = 0; j < n; j++) {
          if (alloc[j] > minUnits && (donor === -1 || alloc[j] > alloc[donor])) {
            donor = j;
          }
        }
        if (donor === -1) break;
        alloc[donor] -= 1;
        alloc[i] += 1;
      }
    }
  }
  const minutes = alloc.map((u) => u * granularity);
  if (extra > 0) {
    let largest = 0;
    for (let i = 1; i < n; i++) if (minutes[i] > minutes[largest]) largest = i;
    minutes[largest] += extra;
  }
  return minutes;
}

export function splitIntoBlocks(
  minutes: number,
  preferredSession: number,
  minBlock: number,
  granularity: number = GRANULARITY,
): number[] {
  if (minutes <= 0) return [];
  let k = Math.max(1, Math.round(minutes / Math.max(1, preferredSession)));
  while (k > 1 && minutes / k < minBlock) k--;
  const units = Math.floor(minutes / granularity);
  const extra = minutes - units * granularity;
  if (units < k) k = Math.max(1, units);
  const base = Math.floor(units / k);
  const rem = units % k;
  const blocks: number[] = [];
  for (let j = 0; j < k; j++) {
    blocks.push((base + (j < rem ? 1 : 0)) * granularity);
  }
  blocks[0] += extra;
  return blocks;
}

interface PendingBlock {
  disciplineId: string;
  disciplineName: string;
  theme: Discipline['theme'];
  order: number;
  score: number;
  minutes: number;
  occurrence: number;
  totalForDiscipline: number;
  key: number;
}

export function interleave(blocks: PendingBlock[]): PendingBlock[] {
  const seq = [...blocks].sort(
    (a, b) =>
      a.key - b.key ||
      b.score - a.score ||
      a.order - b.order ||
      a.occurrence - b.occurrence,
  );
  for (let p = 1; p < seq.length; p++) {
    if (seq[p].disciplineId !== seq[p - 1].disciplineId) continue;
    let q = p + 1;
    while (q < seq.length && seq[q].disciplineId === seq[p - 1].disciplineId) q++;
    if (q < seq.length) {
      const [moved] = seq.splice(q, 1);
      seq.splice(p, 0, moved);
    }
  }
  const last = seq.length - 1;
  if (seq.length > 2 && seq[last].disciplineId === seq[0].disciplineId) {
    for (let p = 1; p < last; p++) {
      const block = seq[last];
      if (
        seq[p - 1].disciplineId !== block.disciplineId &&
        seq[p].disciplineId !== block.disciplineId
      ) {
        if (seq[last - 1].disciplineId !== seq[0].disciplineId) {
          seq.splice(last, 1);
          seq.splice(p, 0, block);
        }
        break;
      }
    }
  }
  const counters = new Map<string, number>();
  for (const b of seq) {
    const c = (counters.get(b.disciplineId) ?? 0) + 1;
    counters.set(b.disciplineId, c);
    b.occurrence = c;
  }
  return seq;
}

function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function planSignature(
  disciplines: Discipline[],
  settings: CycleSettings,
): string {
  const active = disciplines.filter((d) => d.inCycle && !d.deletedAt);
  const parts = active.map(
    (d) =>
      `${d.id}:${d.name}:${d.weight}:${d.difficulty}:${d.sessionMinutesOverride ?? '-'}:${clampAdjustment(d.adjustment)}`,
  );
  return hashString(
    `${settings.cycleMinutes}|${settings.sessionMinutes}|${settings.minBlockMinutes}|${parts.join(',')}`,
  );
}

export function computePlan(
  allDisciplines: Discipline[],
  settings: CycleSettings,
  generatedAt: string = new Date().toISOString(),
): CyclePlan {
  const active = allDisciplines.filter((d) => d.inCycle && !d.deletedAt);
  const signature = planSignature(active, settings);
  const totalMinutes = Math.max(0, Math.round(settings.cycleMinutes));
  const warnings: string[] = [];
  const n = active.length;

  if (n === 0 || totalMinutes <= 0) {
    return {
      signature,
      generatedAt,
      totalMinutes,
      allocations: [],
      blocks: [],
      warnings,
    };
  }

  const scores = active.map(disciplineScore);
  const scoreSum = scores.reduce((a, b) => a + b, 0);
  const { minShare, maxShare, feasible } = computeBounds(
    n,
    totalMinutes,
    settings.minBlockMinutes,
  );
  if (!feasible) {
    warnings.push(
      `O tempo do ciclo (${totalMinutes} min) não comporta um bloco mínimo de ${settings.minBlockMinutes} min para cada uma das ${n} disciplinas. O tempo foi dividido igualmente.`,
    );
  }

  const { shares, clamps } = boundedShares(scores, minShare, maxShare);
  const minutes = apportionMinutes(
    shares,
    totalMinutes,
    feasible ? settings.minBlockMinutes : 0,
    scores,
  );

  const allocations: SubjectAllocation[] = [];
  const pending: PendingBlock[] = [];

  active.forEach((d, i) => {
    const session = d.sessionMinutesOverride ?? settings.sessionMinutes;
    const parts = splitIntoBlocks(
      minutes[i],
      session,
      feasible ? settings.minBlockMinutes : 0,
    );
    allocations.push({
      disciplineId: d.id,
      disciplineName: d.name,
      theme: d.theme,
      weight: d.weight,
      difficulty: d.difficulty,
      score: scores[i],
      rawShare: scoreSum > 0 ? scores[i] / scoreSum : 1 / n,
      finalShare: shares[i],
      minutes: minutes[i],
      blocks: parts.length,
      clamped: clamps[i],
    });
    if (minutes[i] === 0) {
      warnings.push(
        `"${d.name}" ficou sem tempo neste ciclo por falta de tempo disponível.`,
      );
    }
    parts.forEach((m, j) => {
      pending.push({
        disciplineId: d.id,
        disciplineName: d.name,
        theme: d.theme,
        order: i,
        score: scores[i],
        minutes: m,
        occurrence: j + 1,
        totalForDiscipline: parts.length,
        key: (j + 0.5) / parts.length,
      });
    });
  });

  const blocks: CycleBlock[] = interleave(pending).map((b, index) => ({
    index,
    disciplineId: b.disciplineId,
    disciplineName: b.disciplineName,
    theme: b.theme,
    plannedMinutes: b.minutes,
    occurrence: b.occurrence,
    totalForDiscipline: b.totalForDiscipline,
  }));

  return {
    signature,
    generatedAt,
    totalMinutes,
    allocations,
    blocks,
    warnings,
  };
}

