export interface ConnectionConfig {
  host: string;
  port: number;
  magicToken: string;
  username: string;
  password: string;
  tickers?: string[];
}
