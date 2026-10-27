// 전략 설정 "실효성 점검" — 입력값이 엔진에서 실제로 작동하는지 화면에서 바로 알려준다(2026-10-22, 웹 strategyCheck.ts와 동일 규칙).
// 값 자체는 바꾸지 않는다(안내만). 기준:
//  - 익절/손절 스코어: 이동평균(0~2)+연속하락(0~2) = 최대 4점 → 기준이 4보다 크면 발동 불가
//  - 시장+종목 등급: 실제 등급은 9~15 → 컷오프 ≥15면 차단 없음, <9면 전부 차단
//  - 변동성 배수: min=max면 값 고정(종목 변동성 미반영)
//  - 리스크 사이징 상한 = riskPerTradePct / (stopLossPct × 변동성배수 최소) → 단일 종목 한도(25%) 이상이면 미작동
type Val = number | string | null | undefined;

export interface StrategyCheckInput {
  scoreStopLossThreshold?: Val;
  scoreTakeProfitThreshold?: Val;
  gradeCutoffBullish?: Val;
  gradeCutoffPullback?: Val;
  volMultMin?: Val;
  volMultMax?: Val;
  riskPerTradePct?: Val;
  stopLossPct?: Val;
  pullbackMinPct?: Val;
  pullbackMaxPct?: Val;
}

export interface StrategyCheckItem {
  level: 'off' | 'warn';   // off = 사실상 꺼짐(의도일 수 있음), warn = 설정 모순
  text: string;
}

const SCORE_MAX = 4;
const GRADE_BEST = 9;
const GRADE_WORST = 15;
const MAX_SINGLE_POSITION_PCT = 25;

const num = (v: Val): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

export function strategyEffectWarnings(f: StrategyCheckInput): StrategyCheckItem[] {
  const out: StrategyCheckItem[] = [];
  const sl = num(f.scoreStopLossThreshold);
  if (sl != null && sl > SCORE_MAX) out.push({ level: 'off', text: `일반 손절(스코어 손절) 꺼짐 — 기준 ${sl}점이 최대 ${SCORE_MAX}점보다 커서 발동하지 않습니다.` });
  const tp = num(f.scoreTakeProfitThreshold);
  if (tp != null && tp > SCORE_MAX) out.push({ level: 'off', text: `스코어 익절 꺼짐 — 기준 ${tp}점이 최대 ${SCORE_MAX}점보다 커서 발동하지 않습니다.` });

  for (const [label, v] of [['불타기', num(f.gradeCutoffBullish)], ['눌림목', num(f.gradeCutoffPullback)]] as const) {
    if (v == null) continue;
    if (v >= GRADE_WORST) out.push({ level: 'off', text: `${label} 등급 컷오프 ${v} — 실제 등급은 ${GRADE_BEST}~${GRADE_WORST}라 아무 후보도 차단하지 않습니다.` });
    else if (v < GRADE_BEST) out.push({ level: 'warn', text: `${label} 등급 컷오프 ${v} — 실제 등급은 ${GRADE_BEST} 이상이라 모든 ${label} 후보가 차단됩니다.` });
  }

  const vmin = num(f.volMultMin), vmax = num(f.volMultMax);
  if (vmin != null && vmax != null) {
    if (vmin > vmax) out.push({ level: 'warn', text: `변동성 배수 최소(${vmin})가 최대(${vmax})보다 큽니다.` });
    else if (vmin === vmax) out.push({ level: 'off', text: `변동성 반영 꺼짐 — 배수가 ${vmin}로 고정돼 손절·익절 폭이 종목 변동성과 무관하게 일정합니다.` });
  }

  const risk = num(f.riskPerTradePct), stop = num(f.stopLossPct);
  if (risk != null && stop != null && stop > 0) {
    const cap = (risk / (stop * (vmin && vmin > 0 ? vmin : 1))) * 100;
    if (cap >= MAX_SINGLE_POSITION_PCT) {
      out.push({ level: 'off', text: `리스크 기반 사이징 미작동 — 상한 ${cap.toFixed(1)}%가 단일 종목 한도 ${MAX_SINGLE_POSITION_PCT}% 이상이라 매수 금액을 줄이지 않습니다.` });
    }
  }

  const pmin = num(f.pullbackMinPct), pmax = num(f.pullbackMaxPct);
  if (pmin != null && pmax != null && pmin > pmax) {
    out.push({ level: 'warn', text: `눌림목 하락폭 최소(${pmin}%)가 최대(${pmax}%)보다 커서 눌림목 진입이 불가능합니다.` });
  }
  return out;
}
