export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface PageResponse<T> {
  content: T[];
  totalCount: number;
  currentPage: number;
  totalPage: number;
  hasNext: boolean;
  size: number;
}

export interface User {
  userUid: string;
  userName: string;
  email: string;
  userPhone?: string;
  password?: string;
  permission: number;
  status: number;
  loginToken?: string;
  loginDate?: string;
  createdAt?: string;
  kisAppKey?: string;
  kisAppSecret?: string;
  kisAccountNo?: string;
  kisAccountProduct?: string;
  kisAccessToken?: string;
  kisTokenExpiredAt?: string;
  fcmToken?: string;
  kisPaperAppKey?: string;
  kisPaperAppSecret?: string;
  kisPaperAccountNo?: string;
  kisPaperAccountProduct?: string;
  kisPaperAccessToken?: string;
  kisPaperTokenExpiredAt?: string;
  tradingIntervalMinutes?: number; // 자동매매 판단 주기(분) — 5/10/15/30 중 선택, 기본 15
}

/**
 * trading_session 테이블 매핑 (KOSPI 거래량+모멘텀 전략)
 * currentPosition: 'NONE' | 'LONG' (공매도 없음)
 * currentEquity: 현재잔고 / initialBalance 비율
 * initialBalance: 수익률 계산 기준점 — 세션 생성/초기화 시점의 실제 KIS 잔고 (자동 캡처)
 */
export interface TradingSession {
  id: string;
  userUid: string;
  strategyConfigId: number | null;
  mode: 'LIVE' | 'PAPER';
  symbol: string;
  symbolName: string | null;
  active: number;
  currentPosition: 'NONE' | 'LONG';
  sharesHeld: number | null;
  avgEntryPrice: number | null;
  currentEquity: number | null;
  initialBalance: number | null;
  isStrategyUpdate: number;
  isForceCloseEnabled: number;
  createdAt: string;
  lastUpdatedAt: string;
  strategyConfig?: {
    id: number;
    name?: string | null;
    takeProfitPct?: number;
    stopLossPct?: number;
    pullbackMinPct?: number;
    pullbackMaxPct?: number;
    buyingVolumeRatio?: number;
    stopLossVolumeRatio?: number;
    pullbackVolumeRatio?: number;
  } | null;
  userDTO?: { userName?: string } | null;
}

/** strategy_config 테이블 매핑 (KOSPI 전략, 유저별 커스텀 가능) */
export interface StrategyConfig {
  id?: number;
  userUid?: string | null;      // 소유자 — null이면 관리자 지정 추천(공용) 전략
  isPublic?: number;            // 1=모두 사용 가능(공용), 0=본인 전용
  name?: string | null;         // 전략 이름
  takeProfitPct?: number;       // 즉시 익절 기준 % (당일 시가 대비)
  stopLossPct?: number;         // 즉시 손절 기준 % (매수가 대비)
  pullbackMinPct?: number;      // 눌림목 최소 하락폭 % (당일 고가 대비)
  pullbackMaxPct?: number;      // 눌림목 최대 하락폭 % (당일 고가 대비)
  buyingVolumeRatio?: number;   // 불타기 거래량 기준 % (현재 >= 평균 × ratio/100)
  stopLossVolumeRatio?: number; // 손절 거래량 기준 % (현재 >= 평균 × ratio/100)
  pullbackVolumeRatio?: number; // 눌림목 거래량 기준 % (현재 <= 평균 × ratio/100)
  rsiOversold?: number;               // 눌림목 매수 보너스 RSI(14) 과매도 기준 (미만이면 보너스)
  rsiOverbought?: number;             // 익절 조기청산 RSI(14) 과매수 기준 (초과면 강화)
  rsiExitMinGainPct?: number;         // RSI 과매수 조기청산 발동 최소 수익률 % (매수가 대비)
  scoreTakeProfitThreshold?: number;  // 익절 스코어링 매도 문턱값 (0~4점 만점)
  scoreStopLossThreshold?: number;    // 손절 스코어링 매도 문턱값 (0~4점 만점)
  volBaselineCv?: number;             // 변동성 배수 산출 기준 ATR%(평범한 30분 True Range 변동률) — 필드명은 과거 CV% 시절 그대로 유지
  volMultMin?: number;                // 변동성 배수 하한
  volMultMax?: number;                // 변동성 배수 상한
  stopLossCooldownMinutes?: number;   // 손절 후 재진입 쿨다운 (분)
  adxPeriod?: number;                 // ADX 계산 기간 (기본 14)
  adxThreshold?: number;              // ADX 추세강도 진입 게이트 문턱값 (미만이면 신규진입 차단, 청산엔 미적용)
  pullbackTrendMaDays?: number;       // 눌림목 일봉 추세 게이트 — N일 이동평균 (현재가가 이 위에 있어야 눌림목 인정)
  riskPerTradePct?: number;           // 트레이드당 리스크 상한 % (계좌총액 기준) — 손절 시 이 비율만 잃도록 매수금액을 ATR 기반으로 캡
  gradeCutoffBullish?: number;        // 시장+종목 상대강도 필터 — 불타기 컷오프 (등급이 이보다 나쁘면 차단, 기본 12)
  gradeCutoffPullback?: number;       // 시장+종목 상대강도 필터 — 눌림목 컷오프 (등급이 이보다 나쁘면 차단, 기본 14)
  enableDayLowBuy?: number;           // 당일 저점 매수 ON/OFF (1=ON, 0/null=OFF) — 기존 불타기/눌림목과 병행 동작
  dayLowBufferPct?: number;           // 당일 저가 대비 허용 오차 % (0=정확히 같아야 인정)
  dayLowRequireRsiOversold?: number;  // 당일저점 매수에 RSI 과매도(rsiOversold 기준) 조건 추가 요구 여부 (1=요구)
  createdAt?: string;
}

/** strategy_menu 테이블 매핑 (매수 등급별 매수 비율) */
export interface StrategyMenu {
  id: number;
  name: string;       // 예: "불타기 1등급"
  menuType: 'BULLISH' | 'PULLBACK' | 'DAYLOW' | 'TAKE_PROFIT' | 'STOP_LOSS';
  menuGrade: number;
  buyRatio: number | null; // 매수 비율 % — 매도/제외 등급은 null
  createdAt: string;
}

export interface BacktestTrade {
  id: number;
  backtestResultId: number;
  userUid: string;
  tradeNo: number;
  symbol: string;
  direction: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  addCount?: number;
  buyEvents?: string; // JSON 문자열 — addCount>0일 때만 파싱해서 사용
  positionSizePct: number;
  result: string;
  returnPct: number;
  equity: number;
}

export interface BacktestResult {
  id: number;
  userUid: string;
  userName?: string;
  strategyConfigId: number | null;
  symbol: string;
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  totalTrades: number;
  winRate: number;
  returnPct: number;
  mddPct: number;
  sharpe: number | null;
  sharpeNote: string | null;
  strategyTitle?: string | null;
  createdAt: string;
  trades?: BacktestTrade[];
}

/** symbol_universe 테이블 매핑 (실전투자 종목 선택 리스트, 카테고리별) */
export interface SymbolUniverse {
  symbol:         string;
  symbolName:     string;
  category:       'KOSPI200' | 'NASDAQ100' | 'INDEX';
  lastPrice:      number | null;
  marketCap:      number | null;
  priceUpdatedAt: string | null;
}

export interface TradeHistory {
  id: string;
  tradingSessionId: string;
  userUid: string;
  strategyConfigId: number | null;
  mode: 'LIVE' | 'PAPER';
  symbol: string;
  symbolName: string | null;
  action: 'BUY' | 'SELL' | 'ADD_LONG' | 'SELL_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';
  shares: number;
  orderStatus: 'SUCCESS' | 'FAILED';
  entryPrice: number | null;
  entryAt: string | null;
  exitPrice: number | null;
  exitAt: string | null;
  realizedPnl: number | null;
  stopPrice: number | null;
  tpPrice: number | null;
  barsHeld: number | null;
  currentEquity: number | null;
  peakEquity: number | null;
  errorMessage: string | null;
  menuGrade: number | null;
  createdAt: string;
  userName?: string | null;
}

/**
 * 종목 추천(스크리너) — POST /api/screener/recommend 응답.
 * 자동매매와 분리된 읽기전용 기능(trading_session 미생성) — "추가" 액션을 눌러야만
 * insertTradingSession으로 이어짐.
 */
export interface ScreenerRecommendation {
  symbol: string;
  symbolName: string | null;
  direction: 'BULLISH' | 'PULLBACK' | 'MEANREVERT';
  currentPrice: number;
  patternGrade: number | null;  // 패턴 점수 등급(1~2, strategy_menu 매칭용) — MEANREVERT는 항상 null
  patternScore: number | null;
  marketGrade: number | null;   // 시장+종목 상대강도 등급(1~15, 낮을수록 좋음) — MEANREVERT는 항상 null
  validated: boolean;           // true=평균회귀(research/holdout 검증됨) / false=불타기·눌림목(참고용, 방향예측력 미검증)
  strategyConfigId: number | null;  // "추가" 시 이 ID를 그대로 써야 함(방향별로 다른 전략에 연결됨)
}

export interface ScreenerResult {
  scannedCount: number;
  skippedNoDataCount: number;
  recommendations: ScreenerRecommendation[];
}
