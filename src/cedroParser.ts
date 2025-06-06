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
  bestBidTime?: string; // 15: Horário da melhor oferta de compra
  bestAskTime?: string; // 16: Horário da melhor oferta de venda
  cumulativeBidVolume?: number; // 17: Volume acumulado de ofertas de compra
  cumulativeAskVolume?: number; // 18: Volume acumulado de ofertas de venda
  bestBidVolume?: number; // 19: Volume da melhor oferta de compra
  bestAskVolume?: number; // 20: Volume da melhor oferta de venda
  variation?: number; // 21: Variação
  lastWeekClosePrice?: number; // 36: Preço de fechamento da semana anterior
  lastMonthClosePrice?: number; // 37: Preço de fechamento do mês anterior
  lastYearClosePrice?: number; // 38: Preço de fechamento do ano anterior
  previousDayOpenPrice?: number; // 39: Preço de abertura do dia anterior
  previousDayHighPrice?: number; // 40: Maior preço do dia anterior
  previousDayLowPrice?: number; // 41: Menor preço do dia anterior
  average?: number; // 42: Média
  vhDaily?: number; // 43: VH Diário
  marketCode?: number; // 44: Código do Mercado
  assetTypeCode?: number; // 45: Código do tipo do ativo
  standardLot?: number; // 46: Lote padrão
  assetDescription?: string; // 47: Descrição do ativo
  classificationName?: string; // 48: Nome da classificação
  quotationForm?: string; // 49: Forma de cotação
  intradayDate?: string; // 50: Data intraday
  lastTradeDate?: string; // 51/54: Data do último negócio
  shortAssetDescription?: string; // 52: Descrição curta do ativo
  canceledTradeId?: string; // 53: ID do negócio cancelado
  unattendedOffersDirection?: string; // 56: Direção de ofertas não atendidas
  unattendedQuantity?: number; // 57: Quantidade não atendida
  scheduledOpeningTime?: string; // 58: Horário de abertura programado
  rescheduledOpeningTime?: string; // 59: Horário de abertura reprogramado
  bestBidBrokerCode?: string; // 60: Código da corretora da melhor oferta de compra
  bestAskBrokerCode?: string; // 61: Código da corretora da melhor oferta de venda
  buyBrokerCode?: string; // 62: Código da corretora compradora
  sellBrokerCode?: string; // 63: Código da corretora vendedora
  expirationDate?: string; // 64: Data de expiração
  expired?: boolean; // 65: Expirado
  totalSecurities?: number; // 66: Total de títulos
  instrumentStatus?: string; // 67: Status do instrumento
  optionType?: string; // 72: Tipo de opção
  optionDirection?: string; // 74: Direção da opção
  parentSymbol?: string; // 81: Símbolo pai
  theoreticalOpenPrice?: number; // 82: Preço teórico de abertura
  theoreticalQuantity?: number; // 83: Quantidade teórica
  assetStatus?: string; // 84: Status do ativo
  strikePrice?: number; // 85: Preço de exercício
  priceDiff?: number; // 86: Diferença de preço
  previousDate?: string; // 87: Data anterior
  assetPhase?: string; // 88: Fase do grupo do ativo
  previousDayAverage?: number; // 89: Média do dia anterior
  marginInterval?: number; // 90: Intervalo de margem
  averageVolume20Days?: number; // 94: Volume médio de 20 dias
  marketCapitalization?: number; // 95: Capitalização de mercado
  marketType?: string; // 96: Tipo de mercado
  weekVariation?: number; // 97: Variação da semana
  monthVariation?: number; // 98: Variação do mês
  yearVariation?: number; // 99: Variação do ano
  openInterest?: number; // 100: Quantidade de contratos abertos
  businessDaysToExpiration?: number; // 101: Dias úteis para expiração
  daysToExpiration?: number; // 102: Dias para expiração
  dayAdjustment?: number; // 103: Ajuste do dia
  previousDayAdjustment?: number; // 104: Ajuste do dia anterior
  securityId?: string; // 105: SecurityId (BMF FIX)
  tickDirection?: string; // 106: TickDirection (BMF FIX)
  tunnelUpperLimit?: number; // 107: Limite superior do túnel
  tunnelLowerLimit?: number; // 108: Limite inferior do túnel
  tradingPhase?: string; // 109: Fase de negociação
  tickSize?: number; // 110: Tamanho do tick
  minTradingVolume?: number; // 111: Volume mínimo de negociação
  minPriceIncrement?: number; // 112: Incremento mínimo de preço
  minOrderQuantity?: number; // 113: Quantidade mínima de ordem
  maxOrderQuantity?: number; // 114: Quantidade máxima de ordem
  instrumentId?: string; // 115: ID do instrumento
  currency?: string; // 116: Moeda utilizada no preço
  securityType?: string; // 117: SecurityType
  tradingCode?: string; // 118: Código de negociação do instrumento
  associatedProduct?: string; // 119: Produto associado
  expirationYearMonth?: string; // 120: Ano e mês de expiração
  optionStrikePrice?: number; // 121: Preço de exercício da opção
  optionStrikeCurrency?: string; // 122: Moeda do preço de exercício da opção
  contractMultiplier?: number; // 123: Multiplicador do contrato
  priceTypeCode?: string; // 124: Código do tipo de preço
  tradingEndTime?: string; // 125: Horário de término da negociação
  assetGroup?: string; // 126: Grupo do ativo
  currentRateAdjustment?: number; // 127: Ajuste de taxa atual
  previousRateAdjustment?: number; // 128: Ajuste de taxa anterior
  currentRateAdjustmentDate?: string; // 129: Data do ajuste de taxa atual
  withdrawalsUntilExpiration?: number; // 130: Retiradas até a expiração
  hourVolumeVariation?: number; // 134: Variação do volume da hora
  dayVolumeVariation?: number; // 135: Variação do volume até a hora
  sectorCode?: string; // 136: Código do setor
  subsectorCode?: string; // 137: Código do subsetor
  segmentCode?: string; // 138: Código do segmento
  currentRateAdjustmentType?: string; // 139: Tipo de ajuste de taxa atual
  referencePrice?: number; // 140: Preço de referência
  referencePriceDate?: string; // 141: Data do preço de referência
  lastModificationTimeMs?: string; // 142: Horário da última modificação (HHMMSSmmm)
  lastTradeTimeMs?: string; // 143: Horário do último negócio (HHMMSSmmm)
  bestBidTimeMs?: string; // 144: Horário da melhor oferta de compra (HHMMSSmmm)
  bestAskTimeMs?: string; // 145: Horário da melhor oferta de venda (HHMMSSmmm)
  variationUsingPreviousDayAdjustment?: number; // 146: Variação utilizando o ajuste do dia anterior
  diffFromPreviousDayAdjustment?: number; // 147: Diff (Preço Atual - Ajuste do dia anterior)
  tunnelUpperAuctionLimit?: number; // 148: Tunnel Upper Auction Limit
  tunnelLowerAuctionLimit?: number; // 149: Tunnel Lower Auction Limit
  tunnelUpperRejectionLimit?: number; // 150: Tunnel Upper Rejection Limit
  tunnelLowerRejectionLimit?: number; // 151: Tunnel Lower Rejection Limit
  tunnelUpperStaticLimit?: number; // 152: Tunnel Upper Static Limit
  tunnelLowerStaticLimit?: number; // 153: Tunnel Lower Static Limit
  expirationFullDate?: string; // 154: Data em que o ativo estará expirado (YYYYMMDD)
  weekLowPrice?: number; // 155: Mínima da semana
  weekHighPrice?: number; // 156: Máxima da semana
  monthLowPrice?: number; // 157: Mínima do mês
  monthHighPrice?: number; // 158: Máxima do mês
  yearLowPrice?: number; // 159: Mínima do ano
  yearHighPrice?: number; // 160: Máxima do ano

  // Tesouro Direto fields
  unitPrice?: number; // 200: Preço unitário
  rateValue?: number; // 201: Valor da taxa
  minApplicationValue?: number; // 202: Valor mínimo de aplicação
  market?: string; // 203: Mercado
  titleCode?: string; // 204: Código do título
  typeCode?: string; // 205: Código do tipo
  typeName?: string; // 206: Nome do tipo
  selic?: number; // 207: Selic
  issueDate?: string; // 208: Data de emissão
  trade?: boolean; // 209: Negociação
  baseValue?: number; // 210: Valor base
  buyRateValue?: number; // 211: Valor da taxa de compra
  sellRateValue?: number; // 212: Valor da taxa de venda
  indexerCode?: string; // 213: Código do indexador
  indexerName?: string; // 214: Nome do indexador
  titleName?: string; // 215: Nome do título

  // This catch-all property allows for any additional fields that might be added in the future
  [key: string]:
    | string
    | number
    | boolean
    | Record<number, string | number>
    | undefined;
}

// Known field mappings based on the provided documentation
export const FIELD_MAPPINGS: Record<number, string> = {
  0: 'lastModificationTime',
  1: 'lastModificationDate',
  2: 'lastTradePrice',
  3: 'bestBidPrice',
  4: 'bestAskPrice',
  5: 'lastTradeTime',
  6: 'currentTradeQuantity',
  7: 'lastTradeQuantity',
  8: 'tradesCount',
  9: 'cumulativeVolume',
  10: 'financialVolume',
  11: 'highPrice',
  12: 'lowPrice',
  13: 'previousClosePrice',
  14: 'openPrice',
  15: 'bestBidTime',
  16: 'bestAskTime',
  17: 'cumulativeBidVolume',
  18: 'cumulativeAskVolume',
  19: 'bestBidVolume',
  20: 'bestAskVolume',
  21: 'variation',
  36: 'lastWeekClosePrice',
  37: 'lastMonthClosePrice',
  38: 'lastYearClosePrice',
  39: 'previousDayOpenPrice',
  40: 'previousDayHighPrice',
  41: 'previousDayLowPrice',
  42: 'average',
  43: 'vhDaily',
  44: 'marketCode',
  45: 'assetTypeCode',
  46: 'standardLot',
  47: 'assetDescription',
  48: 'classificationName',
  49: 'quotationForm',
  50: 'intradayDate',
  51: 'lastTradeDate',
  52: 'shortAssetDescription',
  53: 'canceledTradeId',
  54: 'lastTradeDate',
  56: 'unattendedOffersDirection',
  57: 'unattendedQuantity',
  58: 'scheduledOpeningTime',
  59: 'rescheduledOpeningTime',
  60: 'bestBidBrokerCode',
  61: 'bestAskBrokerCode',
  62: 'buyBrokerCode',
  63: 'sellBrokerCode',
  64: 'expirationDate',
  65: 'expired',
  66: 'totalSecurities',
  67: 'instrumentStatus',
  72: 'optionType',
  74: 'optionDirection',
  81: 'parentSymbol',
  82: 'theoreticalOpenPrice',
  83: 'theoreticalQuantity',
  84: 'assetStatus',
  85: 'strikePrice',
  86: 'priceDiff',
  87: 'previousDate',
  88: 'assetPhase',
  89: 'previousDayAverage',
  90: 'marginInterval',
  94: 'averageVolume20Days',
  95: 'marketCapitalization',
  96: 'marketType',
  97: 'weekVariation',
  98: 'monthVariation',
  99: 'yearVariation',
  100: 'openInterest',
  101: 'businessDaysToExpiration',
  102: 'daysToExpiration',
  103: 'dayAdjustment',
  104: 'previousDayAdjustment',
  105: 'securityId',
  106: 'tickDirection',
  107: 'tunnelUpperLimit',
  108: 'tunnelLowerLimit',
  109: 'tradingPhase',
  110: 'tickSize',
  111: 'minTradingVolume',
  112: 'minPriceIncrement',
  113: 'minOrderQuantity',
  114: 'maxOrderQuantity',
  115: 'instrumentId',
  116: 'currency',
  117: 'securityType',
  118: 'tradingCode',
  119: 'associatedProduct',
  120: 'expirationYearMonth',
  121: 'optionStrikePrice',
  122: 'optionStrikeCurrency',
  123: 'contractMultiplier',
  124: 'priceTypeCode',
  125: 'tradingEndTime',
  126: 'assetGroup',
  127: 'currentRateAdjustment',
  128: 'previousRateAdjustment',
  129: 'currentRateAdjustmentDate',
  130: 'withdrawalsUntilExpiration',
  134: 'hourVolumeVariation',
  135: 'dayVolumeVariation',
  136: 'sectorCode',
  137: 'subsectorCode',
  138: 'segmentCode',
  139: 'currentRateAdjustmentType',
  140: 'referencePrice',
  141: 'referencePriceDate',
  142: 'lastModificationTimeMs',
  143: 'lastTradeTimeMs',
  144: 'bestBidTimeMs',
  145: 'bestAskTimeMs',
  146: 'variationUsingPreviousDayAdjustment',
  147: 'diffFromPreviousDayAdjustment',
  148: 'tunnelUpperAuctionLimit',
  149: 'tunnelLowerAuctionLimit',
  150: 'tunnelUpperRejectionLimit',
  151: 'tunnelLowerRejectionLimit',
  152: 'tunnelUpperStaticLimit',
  153: 'tunnelLowerStaticLimit',
  154: 'expirationFullDate',
  155: 'weekLowPrice',
  156: 'weekHighPrice',
  157: 'monthLowPrice',
  158: 'monthHighPrice',
  159: 'yearLowPrice',
  160: 'yearHighPrice',
  // Tesouro Direto fields
  200: 'unitPrice',
  201: 'rateValue',
  202: 'minApplicationValue',
  203: 'market',
  204: 'titleCode',
  205: 'typeCode',
  206: 'typeName',
  207: 'selic',
  208: 'issueDate',
  209: 'trade',
  210: 'baseValue',
  211: 'buyRateValue',
  212: 'sellRateValue',
  213: 'indexerCode',
  214: 'indexerName',
  215: 'titleName',
};

/**
 * Parse a Cedro message string into a structured object
 * @param message The raw message from Cedro server
 * @returns A structured object with the parsed data
 */
export function parseCedroMessage(message: string): CedroMessage {
  // Check if this is a valid Cedro message
  if (!message.startsWith('T:')) {
    return {
      ticker: message,
      fields: {},
    };
  }

  // remove the last character if it is !
  const parts = message.endsWith('!')
    ? message.slice(0, -1).split(':')
    : message.split(':');

  // Extract ticker and time
  if (parts.length < 3) {
    throw new Error('Invalid message format');
  }
  const ticker = parts[1] || '';
  const time = parts[2];

  // Initialize fields object
  const fields: Record<number, string | number> = {};

  // Process the rest of the parts as field:value pairs
  let i = 3;
  while (i < parts.length) {
    const [fieldPart, valuePart] = parts.slice(i, i + 2);
    if (fieldPart && valuePart) {
      const fieldId = Number.parseInt(fieldPart, 10);
      const rawValue = valuePart;

      // Try to convert numeric values
      const value = !Number.isNaN(Number(rawValue))
        ? Number(rawValue)
        : rawValue;
      fields[fieldId] = value;
    }
    i += 2;
  }
  // Create the result object
  const result: CedroMessage = {
    ticker,
    fields,
  };

  // Add time to the result if it exists
  if (time) {
    result.fields[0] = time;
  }

  return result;
}

export function humanizeCedroMessage(message: CedroMessage): CedroMessage {
  for (const [fieldId, fieldName] of Object.entries(FIELD_MAPPINGS)) {
    const numericId = Number.parseInt(fieldId, 10);
    if (message.fields[numericId] !== undefined) {
      message[fieldName] = message.fields[numericId];
    }
  }
  return message;
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
    const changeSign = message.variation >= 0 ? '+' : '';
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
  if (
    message.bestBidPrice !== undefined &&
    message.bestAskPrice !== undefined
  ) {
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
      const ms = timeStr.length > 6 ? `.${timeStr.substring(6)}` : '';
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
      1: 'Bovespa',
      2: 'Dow Jones',
      3: 'BM&F',
      4: 'Índices',
      5: 'Money',
      6: 'Soma',
      7: 'Forex',
      8: 'Indicators',
      9: 'Others',
      10: 'Nyse',
      11: 'Bats',
      12: 'Nasdaq',
    };
    result += `Mercado: ${markets[message.marketCode] || message.marketCode}\n`;
  }

  if (message.assetTypeCode !== undefined) {
    const assetTypes: Record<number, string> = {
      1: 'Ativo à vista',
      2: 'Opção',
      3: 'Índice',
      4: 'Commodity',
      5: 'Moeda',
      6: 'Termo',
      7: 'Futuro',
      8: 'Leilão',
      9: 'Bônus',
      10: 'Fracionário',
      13: 'ETF',
      17: 'Opção sobre futuro',
    };
    result += `Tipo de Ativo: ${assetTypes[message.assetTypeCode] || message.assetTypeCode}\n`;
  }

  if (message.assetPhase !== undefined) {
    const phases: Record<string, string> = {
      P: 'Pré abertura',
      A: 'Abertura (sessão normal)',
      PN: 'Pré fechamento',
      N: 'Fechamento',
      E: 'Pré abertura do after',
      R: 'Abertura After',
      NE: 'Fechamento do after',
      F: 'Final',
      NO: 'Fechado',
      T: 'Pausado',
    };
    result += `Fase: ${phases[message.assetPhase] || message.assetPhase}\n`;
  }

  if (message.openInterest !== undefined) {
    result += `Contratos em Aberto: ${message.openInterest}\n`;
  }

  if (message.tickDirection !== undefined) {
    const directions: Record<string, string> = {
      '+': 'Alta',
      '0+': 'Estável (último movimento foi alta)',
      '-': 'Baixa',
      '0-': 'Estável (último movimento foi baixa)',
    };
    result += `Direção: ${directions[message.tickDirection] || message.tickDirection}\n`;
  }

  // Add section for price limits
  if (
    message.tunnelUpperAuctionLimit !== undefined ||
    message.tunnelLowerAuctionLimit !== undefined ||
    message.tunnelUpperRejectionLimit !== undefined ||
    message.tunnelLowerRejectionLimit !== undefined ||
    message.tunnelUpperStaticLimit !== undefined ||
    message.tunnelLowerStaticLimit !== undefined
  ) {
    result += '\nLimites de Preço:\n';

    if (message.tunnelUpperAuctionLimit !== undefined) {
      result += `  Limite Superior de Leilão: ${message.tunnelUpperAuctionLimit}\n`;
    }
    if (message.tunnelLowerAuctionLimit !== undefined) {
      result += `  Limite Inferior de Leilão: ${message.tunnelLowerAuctionLimit}\n`;
    }
    if (message.tunnelUpperRejectionLimit !== undefined) {
      result += `  Limite Superior de Rejeição: ${message.tunnelUpperRejectionLimit}\n`;
    }
    if (message.tunnelLowerRejectionLimit !== undefined) {
      result += `  Limite Inferior de Rejeição: ${message.tunnelLowerRejectionLimit}\n`;
    }
    if (message.tunnelUpperStaticLimit !== undefined) {
      result += `  Limite Superior Estático: ${message.tunnelUpperStaticLimit}\n`;
    }
    if (message.tunnelLowerStaticLimit !== undefined) {
      result += `  Limite Inferior Estático: ${message.tunnelLowerStaticLimit}\n`;
    }
  }

  // Add section for historical price ranges
  if (
    message.weekLowPrice !== undefined ||
    message.weekHighPrice !== undefined ||
    message.monthLowPrice !== undefined ||
    message.monthHighPrice !== undefined ||
    message.yearLowPrice !== undefined ||
    message.yearHighPrice !== undefined
  ) {
    result += '\nFaixas de Preço Histórico:\n';

    if (
      message.weekLowPrice !== undefined &&
      message.weekHighPrice !== undefined
    ) {
      result += `  Semana: ${message.weekLowPrice} - ${message.weekHighPrice}\n`;
    } else {
      if (message.weekLowPrice !== undefined) {
        result += `  Mínima da Semana: ${message.weekLowPrice}\n`;
      }
      if (message.weekHighPrice !== undefined) {
        result += `  Máxima da Semana: ${message.weekHighPrice}\n`;
      }
    }

    if (
      message.monthLowPrice !== undefined &&
      message.monthHighPrice !== undefined
    ) {
      result += `  Mês: ${message.monthLowPrice} - ${message.monthHighPrice}\n`;
    } else {
      if (message.monthLowPrice !== undefined) {
        result += `  Mínima do Mês: ${message.monthLowPrice}\n`;
      }
      if (message.monthHighPrice !== undefined) {
        result += `  Máxima do Mês: ${message.monthHighPrice}\n`;
      }
    }

    if (
      message.yearLowPrice !== undefined &&
      message.yearHighPrice !== undefined
    ) {
      result += `  Ano: ${message.yearLowPrice} - ${message.yearHighPrice}\n`;
    } else {
      if (message.yearLowPrice !== undefined) {
        result += `  Mínima do Ano: ${message.yearLowPrice}\n`;
      }
      if (message.yearHighPrice !== undefined) {
        result += `  Máxima do Ano: ${message.yearHighPrice}\n`;
      }
    }
  }

  // Add expiration date if available
  if (message.expirationFullDate !== undefined) {
    const dateStr = message.expirationFullDate.toString();
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      result += `Data de Expiração: ${day}/${month}/${year}\n`;
    } else {
      result += `Data de Expiração: ${message.expirationFullDate}\n`;
    }
  }

  // Add variation and diff from previous day adjustment
  if (message.variationUsingPreviousDayAdjustment !== undefined) {
    result += `Variação (Ajuste Anterior): ${(message.variationUsingPreviousDayAdjustment * 100).toFixed(2)}%\n`;
  }

  if (message.diffFromPreviousDayAdjustment !== undefined) {
    result += `Diferença do Ajuste Anterior: ${message.diffFromPreviousDayAdjustment}\n`;
  }

  // Add a section for other fields that might be important but not formatted above
  const importantFields = [
    'average',
    'dayAdjustment',
    'hourVolumeVariation',
    'dayVolumeVariation',
    'securityType',
    'currency',
    'tradingCode',
  ];

  let otherFieldsAdded = false;
  for (const field of importantFields) {
    if (message[field] !== undefined && !result.includes(field)) {
      if (!otherFieldsAdded) {
        result += '\nOutros Dados:\n';
        otherFieldsAdded = true;
      }
      result += `  ${field}: ${message[field]}\n`;
    }
  }

  // Add raw fields section for debugging
  result += '\nCampos Originais:\n';
  for (const [fieldId, value] of Object.entries(message.fields)) {
    const fieldName =
      FIELD_MAPPINGS[Number.parseInt(fieldId, 10)] || `Campo ${fieldId}`;
    result += `  ${fieldId} (${fieldName}): ${value}\n`;
  }

  return result;
}

/**
 * Example usage
 */
export function parseExampleMessage(): void {
  const exampleMessage =
    'T:WINJ25:102635:2:133290:5:102635:6:1:7:1:8:1050609:9:3056682:21:0.346307:42:132918.6:62:3:63:3:86:460:106:0-:134:55.87283:135:82.451066:142:102635388:143:102635387:146:0.406023:147:539!';

  try {
    const parsed = parseCedroMessage(exampleMessage);
    console.log('Parsed Message:');
    console.log(parsed);

    console.log('\nFormatted Message:');
    console.log(formatCedroMessage(parsed));
  } catch (error) {
    console.error('Error parsing message:', error);
  }
}
