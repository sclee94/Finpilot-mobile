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
}

export interface TradingSession {
  id: string;
  userUid: string;
  strategyConfigId: number | null;
  mode: 'LIVE' | 'PAPER';
  symbol: string;
  active: number;
  currentPosition: 'NONE' | 'LONG' | 'SHORT';
  barsHeld: number;
  sharesHeld: number | null;
  stopPrice: number | null;
  tpPrice: number | null;
  cooldownBarsLeft: number;
  consecSlCount: number;
  currentEquity: number | null;
  peakEquity: number;
  avgEntryPrice: number | null;
  addCount: number | null;
  isStrategyUpdate: number;
  createdAt: string;
  lastUpdatedAt: string;
  strategyConfig?: { id: number; title: string } | null;
  userDTO?: { userName?: string } | null;
}

export interface StrategyConfig {
  id: number;
  userUid?: string;
  title: string;
  symbol: string;
  initialCapital: number;
  riskPerTrade: number;
  usePrevBarSignal?: boolean;
  adxThreshold?: number;
  adxSidewaysFloor?: number;
  adxPersist?: number;
  diGapMin?: number;
  rsiLongEntry?: number;
  rsiLongFloor?: number;
  rsiShortEntry?: number;
  rsiOversoldEntry?: number;
  maxAddCount?: number;
  atrSlMult?: number;
  atrTpMult?: number;
  minHoldBars?: number;
  slCooldownBars?: number;
  consecSlLimit?: number;
  maxDdStop?: number;
  commission?: number;
  slippage?: number;
  indicatorWindow?: number;
  tradingDaysPerYear?: number;
  isUse: number;
  menuGrade?: number;
  createdAt?: string;
  userDTO?: { userName?: string } | null;
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

export interface TradeHistory {
  id: string;
  tradingSessionId: string;
  userUid: string;
  strategyConfigId: number | null;
  mode: 'LIVE' | 'PAPER';
  symbol: string;
  symbolName: string | null;
  action: 'BUY' | 'SELL_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'ADD_LONG' | 'ADD_SHORT';
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
