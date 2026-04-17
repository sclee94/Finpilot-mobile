export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface User {
  userUid: string;
  userName: string;
  email: string;
  userPhone?: string;
  permission: number;
  status: number;
  loginToken?: string;
}

export interface TradingSession {
  id: string;
  userUid: string;
  strategyConfigId: number;
  mode: 'LIVE' | 'PAPER';
  symbol: string;
  active: number;
  currentPosition: 'NONE' | 'LONG' | 'SHORT';
  barsHeld: number;
  sharesHeld: number | null;
  stopPrice: number | null;
  tpPrice: number | null;
  currentEquity: number | null;
  peakEquity: number;
  createdAt: string;
  lastUpdatedAt: string;
  strategyConfig?: { id: number; title: string } | null;
  userDTO?: { userName?: string } | null;
}

export interface TradeHistory {
  id: string;
  tradingSessionId: string;
  userUid: string;
  strategyConfigId: number | null;
  mode: 'LIVE' | 'PAPER';
  symbol: string;
  symbolName: string | null;
  action: 'BUY' | 'SELL_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';
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
  createdAt: string;
  userName?: string | null;
}
