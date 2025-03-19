/**
 * CedroParser - A utility for parsing Cedro financial data messages
 *
 * This parser handles the colon-delimited messages from Cedro's financial data feed
 * and converts them into structured objects with meaningful field names.
 */

// Interface for parsed Cedro message
export interface CedroMessage {
  ticker: string;
  fields: Record<number, string | number>;

  // Common financial data fields with proper typing
  lastModificationTime?: string; // 0: Horário da última modificação (HHMMSS)
  lastModificationDate?: string; // 1: Data da última modificação (YYYYMMDD)
  lastTradePrice?: number; // 2: Preço do último negócio
  bestBidPrice?: number; // 3: Melhor oferta de compra
  bestAskPrice?: number; // 4: Melhor oferta de venda
  lastTradeTime?: string; // 5: Horário do último negócio (HHMMSS)
  currentTradeQuantity?: number; // 6: Quantidade do negócio atual
  lastTradeQuantity?: number; // 7: Quantidade do último negócio
  tradesCount?: number; // 8: Quantidade de negócios realizados
  cumulativeVolume?: number; // 9: Volume acumulado dos negócios
  financialVolume?: number; // 10: Volume financeiro dos negócios
  highPrice?: number; // 11: Maior preço do dia
  lowPrice?: number; // 12: Menor preço do dia
  previousClosePrice?: number; // 13: Preço de fechamento do dia anterior
  openPrice?: number; // 14: Preço de abertura
  variation?: number; // 21: Variação
  average?: number; // 42: Média
  marketCode?: number; // 44: Código do Mercado
  assetTypeCode?: number; // 45: Código do tipo do ativo
  assetPhase?: string; // 88: Fase do grupo do ativo
  assetDescription?: string; // 47: Descrição do ativo
  openInterest?: number; // 100: Quantidade de contratos abertos
  tickDirection?: string; // 106: TickDirection (BMF FIX)
  securityId?: string; // 105: SecurityId (BMF FIX)
  currency?: string; // 116: Moeda utilizada no preço
  securityType?: string; // 117: SecurityType
  tradingCode?: string; // 118: Código de negociação do instrumento
  hourVolumeVariation?: number; // 134: Variação do volume da hora
  dayVolumeVariation?: number; // 135: Variação do volume até a hora
  lastModificationTimeMs?: string; // 142: Horário da última modificação (HHMMSSmmm)
  lastTradeTimeMs?: string; // 143: Horário do último negócio (HHMMSSmmm)

  // Add other fields as needed
  [key: string]: string | number | Record<number, string | number> | undefined;
}

// Known field mappings based on the provided documentation
const FIELD_MAPPINGS: Record<number, string> = {
  0: "lastModificationTime",
  1: "lastModificationDate",
  2: "lastTradePrice",
  3: "bestBidPrice",
  4: "bestAskPrice",
  5: "lastTradeTime",
  6: "currentTradeQuantity",
  7: "lastTradeQuantity",
  8: "tradesCount",
  9: "cumulativeVolume",
  10: "financialVolume",
  11: "highPrice",
  12: "lowPrice",
  13: "previousClosePrice",
  14: "openPrice",
  15: "bestBidTime",
  16: "bestAskTime",
  17: "cumulativeBidVolume",
  18: "cumulativeAskVolume",
  19: "bestBidVolume",
  20: "bestAskVolume",
  21: "variation",
  36: "lastWeekClosePrice",
  37: "lastMonthClosePrice",
  38: "lastYearClosePrice",
  39: "previousDayOpenPrice",
  40: "previousDayHighPrice",
  41: "previousDayLowPrice",
  42: "average",
  43: "vhDaily",
  44: "marketCode",
  45: "assetTypeCode",
  46: "standardLot",
  47: "assetDescription",
  48: "classificationName",
  49: "quotationForm",
  50: "intradayDate",
  51: "lastTradeDate",
  52: "shortAssetDescription",
  53: "canceledTradeId",
  54: "lastTradeDate",
  56: "unattendedOffersDirection",
  57: "unattendedQuantity",
  58: "scheduledOpeningTime",
  59: "rescheduledOpeningTime",
  60: "bestBidBrokerCode",
  61: "bestAskBrokerCode",
  62: "buyBrokerCode",
  63: "sellBrokerCode",
  64: "expirationDate",
  65: "expired",
  66: "totalSecurities",
  67: "instrumentStatus",
  72: "optionType",
  74: "optionDirection",
  81: "parentSymbol",
  82: "theoreticalOpenPrice",
  83: "theoreticalQuantity",
  84: "assetStatus",
  85: "strikePrice",
  86: "priceDiff",
  87: "previousDate",
  88: "assetPhase",
  89: "previousDayAverage",
  90: "marginInterval",
  94: "averageVolume20Days",
  95: "marketCapitalization",
  96: "marketType",
  97: "weekVariation",
  98: "monthVariation",
  99: "yearVariation",
  100: "openInterest",
  101: "businessDaysToExpiration",
  102: "daysToExpiration",
  103: "dayAdjustment",
  104: "previousDayAdjustment",
  105: "securityId",
  106: "tickDirection",
  107: "tunnelUpperLimit",
  108: "tunnelLowerLimit",
  109: "tradingPhase",
  110: "tickSize",
  111: "minTradingVolume",
  112: "minPriceIncrement",
  113: "minOrderQuantity",
  114: "maxOrderQuantity",
  115: "instrumentId",
  116: "currency",
  117: "securityType",
  118: "tradingCode",
  119: "associatedProduct",
  120: "expirationYearMonth",
  121: "optionStrikePrice",
  122: "optionStrikeCurrency",
  123: "contractMultiplier",
  124: "priceTypeCode",
  125: "tradingEndTime",
  126: "assetGroup",
  127: "currentRateAdjustment",
  128: "previousRateAdjustment",
  129: "currentRateAdjustmentDate",
  130: "withdrawalsUntilExpiration",
  134: "hourVolumeVariation",
  135: "dayVolumeVariation",
  136: "sectorCode",
  137: "subsectorCode",
  138: "segmentCode",
  139: "currentRateAdjustmentType",
  140: "referencePrice",
  141: "referencePriceDate",
  142: "lastModificationTimeMs",
  143: "lastTradeTimeMs",
  144: "bestBidTimeMs",
  145: "bestAskTimeMs",
  // Tesouro Direto fields
  200: "unitPrice",
  201: "rateValue",
  202: "minApplicationValue",
  203: "market",
  204: "titleCode",
  205: "typeCode",
  206: "typeName",
  207: "selic",
  208: "issueDate",
  209: "trade",
  210: "baseValue",
  211: "buyRateValue",
  212: "sellRateValue",
  213: "indexerCode",
  214: "indexerName",
  215: "titleName",
};

/**
 * Parse a Cedro message string into a structured object
 * @param message The raw message from Cedro server
 * @returns A structured object with the parsed data
 */
export function parseCedroMessage(message: string): CedroMessage {
  // Check if this is a valid Cedro message
  if (!message.startsWith("T:")) {
    return {
      ticker: message,
      fields: {},
    };
  }

  // Split the message by colons
  const parts = message.split(":");

  // Extract ticker and time
  const ticker = parts[1] as string;
  const time = parts[2] as string;

  // Initialize fields object
  const fields: Record<number, string | number> = {};

  // Process the rest of the parts as field:value pairs
  for (let i = 3; i < parts.length; i += 2) {
    if (i + 1 < parts.length) {
      const fieldId = Number.parseInt(parts[i] as string, 10);
      const rawValue = parts[i + 1] as string;

      // Try to convert numeric values
      const value = !Number.isNaN(Number(rawValue)) ? Number(rawValue) : rawValue;
      fields[fieldId] = value;
    }
  }

  // Create the result object
  const result: CedroMessage = {
    ticker,
    fields,
  };

  // Add time to the result if it exists
  if (time) {
    result.lastModificationTime = time;
  }

  // Add mapped fields with proper types
  for (const [fieldId, fieldName] of Object.entries(FIELD_MAPPINGS)) {
    const numericId = Number.parseInt(fieldId, 10);
    if (fields[numericId] !== undefined) {
      result[fieldName] = fields[numericId];
    }
  }

  return result;
}

/**
 * Format a parsed Cedro message into a human-readable string
 * @param message The parsed Cedro message
 * @returns A formatted string representation
 */
export function formatCedroMessage(message: CedroMessage): string {
  let result = `Ticker: ${message.ticker}\n`;

  // Format main trading data
  if (message.lastTradePrice !== undefined) {
    result += `Último Preço: ${message.lastTradePrice}\n`;
  }

  if (message.variation !== undefined) {
    const changeSign = message.variation >= 0 ? "+" : "";
    result += `Variação: ${changeSign}${message.variation}\n`;
  }

  if (message.highPrice !== undefined && message.lowPrice !== undefined) {
    result += `Máxima/Mínima: ${message.highPrice}/${message.lowPrice}\n`;
  }

  if (message.openPrice !== undefined) {
    result += `Abertura: ${message.openPrice}\n`;
  }

  if (message.previousClosePrice !== undefined) {
    result += `Fechamento Anterior: ${message.previousClosePrice}\n`;
  }

  // Format volume data
  if (message.cumulativeVolume !== undefined) {
    result += `Volume Acumulado: ${message.cumulativeVolume}\n`;
  }

  if (message.tradesCount !== undefined) {
    result += `Negócios: ${message.tradesCount}\n`;
  }

  if (message.financialVolume !== undefined) {
    result += `Volume Financeiro: ${message.financialVolume}\n`;
  }

  // Format bid/ask data
  if (message.bestBidPrice !== undefined && message.bestAskPrice !== undefined) {
    result += `Compra/Venda: ${message.bestBidPrice}/${message.bestAskPrice}\n`;
  }

  // Format time data
  if (message.lastTradeTimeMs !== undefined) {
    // Format milliseconds time (HHMMSSmmm) to a more readable format
    const timeStr = message.lastTradeTimeMs.toString();
    if (timeStr.length >= 6) {
      const hh = timeStr.substring(0, 2);
      const mm = timeStr.substring(2, 4);
      const ss = timeStr.substring(4, 6);
      const ms = timeStr.length > 6 ? `.${timeStr.substring(6)}` : "";
      result += `Horário Último Negócio: ${hh}:${mm}:${ss}${ms}\n`;
    } else {
      result += `Horário Último Negócio: ${message.lastTradeTimeMs}\n`;
    }
  }

  if (message.lastTradeDate !== undefined) {
    // Format date (YYYYMMDD) to a more readable format
    const dateStr = message.lastTradeDate.toString();
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      result += `Data Último Negócio: ${day}/${month}/${year}\n`;
    } else {
      result += `Data Último Negócio: ${message.lastTradeDate}\n`;
    }
  }

  // Add market information
  if (message.marketCode !== undefined) {
    const markets: Record<number, string> = {
      1: "Bovespa",
      2: "Dow Jones",
      3: "BM&F",
      4: "Índices",
      5: "Money",
      6: "Soma",
      7: "Forex",
      8: "Indicators",
      9: "Others",
      10: "Nyse",
      11: "Bats",
      12: "Nasdaq",
    };
    result += `Mercado: ${markets[message.marketCode] || message.marketCode}\n`;
  }

  if (message.assetTypeCode !== undefined) {
    const assetTypes: Record<number, string> = {
      1: "Ativo à vista",
      2: "Opção",
      3: "Índice",
      4: "Commodity",
      5: "Moeda",
      6: "Termo",
      7: "Futuro",
      8: "Leilão",
      9: "Bônus",
      10: "Fracionário",
      13: "ETF",
      17: "Opção sobre futuro",
    };
    result += `Tipo de Ativo: ${assetTypes[message.assetTypeCode] || message.assetTypeCode}\n`;
  }

  if (message.assetPhase !== undefined) {
    const phases: Record<string, string> = {
      P: "Pré abertura",
      A: "Abertura (sessão normal)",
      PN: "Pré fechamento",
      N: "Fechamento",
      E: "Pré abertura do after",
      R: "Abertura After",
      NE: "Fechamento do after",
      F: "Final",
      NO: "Fechado",
      T: "Pausado",
    };
    result += `Fase: ${phases[message.assetPhase] || message.assetPhase}\n`;
  }

  if (message.openInterest !== undefined) {
    result += `Contratos em Aberto: ${message.openInterest}\n`;
  }

  if (message.tickDirection !== undefined) {
    const directions: Record<string, string> = {
      "+": "Alta",
      "0+": "Estável (último movimento foi alta)",
      "-": "Baixa",
      "0-": "Estável (último movimento foi baixa)",
    };
    result += `Direção: ${directions[message.tickDirection] || message.tickDirection}\n`;
  }

  // Add a section for other fields that might be important but not formatted above
  const importantFields = [
    "average",
    "dayAdjustment",
    "hourVolumeVariation",
    "dayVolumeVariation",
    "securityType",
    "currency",
    "tradingCode",
  ];

  let otherFieldsAdded = false;
  for (const field of importantFields) {
    if (message[field] !== undefined && !result.includes(field)) {
      if (!otherFieldsAdded) {
        result += "\nOutros Dados:\n";
        otherFieldsAdded = true;
      }
      result += `  ${field}: ${message[field]}\n`;
    }
  }

  // Add raw fields section for debugging
  result += "\nCampos Originais:\n";
  for (const [fieldId, value] of Object.entries(message.fields)) {
    const fieldName = FIELD_MAPPINGS[Number.parseInt(fieldId, 10)] || `Campo ${fieldId}`;
    result += `  ${fieldId} (${fieldName}): ${value}\n`;
  }

  return result;
}

/**
 * Example usage
 */
export function parseExampleMessage(): void {
  const exampleMessage =
    "T:WINJ25:102635:2:133290:5:102635:6:1:7:1:8:1050609:9:3056682:21:0.346307:42:132918.6:62:3:63:3:86:460:106:0-:134:55.87283:135:82.451066:142:102635388:143:102635387:146:0.406023:147:539!";

  try {
    const parsed = parseCedroMessage(exampleMessage);
    console.log("Parsed Message:");
    console.log(parsed);

    console.log("\nFormatted Message:");
    console.log(formatCedroMessage(parsed));
  } catch (error) {
    console.error("Error parsing message:", error);
  }
}
