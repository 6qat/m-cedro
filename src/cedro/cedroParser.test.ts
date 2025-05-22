import { expect, test, describe } from 'bun:test';
import { parseCedroMessage, formatCedroMessage } from './cedroParser';

describe('Cedro Parser', () => {
  // Sample test messages
  const sampleMessage1 =
    'T:WINJ25:102635:2:133290:5:102635:6:1:7:1:8:1050609:9:3056682:21:0.346307:42:132918.6:62:3:63:3:86:460:106:0-:134:55.87283:135:82.451066:142:102635388:143:102635387:146:0.406023:147:539!';
  const sampleMessage2 =
    'T:WINJ25:110753:1:20250319:2:133470:3:133465:4:133470:5:110753:6:1:7:1:8:1502355:9:4484954:10:119218618356:11:133630:12:132530:13:132830:14:132540:15:000000:16:000000:17:91:18:321:19:1:20:19:21:0.481819:36:130085:37:124850:38:123951:39:131865:40:133160:41:131490:42:133064:43:15.773961:44:3:45:7:46:1:47:MINI INDICE ABR/25:48:0:49:1:50:00000000000000:51:00000000000000:52:0:53:0:54:20250319:56:0:57:0:58:000000:59:000000:60:120:61:3:62:4090:63:4090:64:20250416:65:0:66:1352594:67:101:72:0:74:0:81:0:82:0:83:0:84:0:85:0:86:640:87:20250319:88:A:94:11488952:95:0:96:RT:97:125025.000000:98:129390.000000:99:141708.920000:100:1352594:101:20:102:28:103:132751:104:132751:105:100000194025:106:+:107:146025:108:119480:109:0:110:0:111:0:112:5:113:1:114:25000:115:0:116:BRL:117:FUT:118:130:119:2:120:202504:121:0:122:0:123:0.2:124:0:125:20250416221500:126:W1:127:0:128:0:129:20250318:130:20:134:9.080824:135:81.650862:136:0:137:0:138:-1:139:D1:140:0:141:0:142:110753120:143:110753120:144:000000000:145:000000000:146:0.541616:147:719:148:0.5%:149:-0.5%:150:1%:151:-1%:152:0:153:0:154:20250416:155:0:156:133630:157:132530:158:133630:159:132530:160:133630!';
  const nonCedroMessage = 'Welcome to Cedro Financial Data Feed';

  test('should parse a Cedro message correctly', () => {
    const result = parseCedroMessage(sampleMessage1);

    // Check basic structure
    expect(result).toBeDefined();
    expect(result.ticker).toBe('WINJ25');
    expect(typeof result.fields).toBe('object');

    // Check specific fields
    expect(result.lastTradePrice).toBe(133290);
    expect(result.lastTradeTime).toBe('102635');
    expect(result.tradesCount).toBe(1050609);
    expect(result.cumulativeVolume).toBe(3056682);
    expect(result.variation).toBe(0.346307);
    expect(result.tickDirection).toBe('0-');
    expect(result.openInterest).toBe(539);
  });

  test('should parse a complex Cedro message with many fields', () => {
    const result = parseCedroMessage(sampleMessage2);

    // Check basic structure
    expect(result).toBeDefined();
    expect(result.ticker).toBe('WINJ25');

    // Check some specific fields from the complex message
    expect(result.lastModificationTime).toBe('110753');
    expect(result.lastModificationDate).toBe('20250319');
    expect(result.lastTradePrice).toBe(133470);
    expect(result.bestBidPrice).toBe(133465);
    expect(result.bestAskPrice).toBe(133470);
    expect(result.highPrice).toBe(133630);
    expect(result.lowPrice).toBe(132530);
    expect(result.assetDescription).toBe('MINI INDICE ABR/25');
    expect(result.marketCode).toBe(3); // BM&F
    expect(result.assetTypeCode).toBe(7); // Futuro
    expect(result.assetPhase).toBe('A'); // Abertura (sessão normal)
    expect(result.currency).toBe('BRL');
    expect(result.securityType).toBe('FUT');
  });

  test('should handle non-Cedro messages gracefully', () => {
    const result = parseCedroMessage(nonCedroMessage);

    // Should return an object with the message as ticker and empty fields
    expect(result).toBeDefined();
    expect(result.ticker).toBe('Welcome to Cedro Financial Data Feed');
    expect(Object.keys(result.fields).length).toBe(0);
  });

  test('should format a Cedro message into readable text', () => {
    const parsed = parseCedroMessage(sampleMessage1);
    const formatted = formatCedroMessage(parsed);

    // Check that the formatted output contains key information
    expect(formatted).toContain('Ticker: WINJ25');
    expect(formatted).toContain('Último Preço: 133290');
    expect(formatted).toContain('Variação: +0.346307');
    expect(formatted).toContain('Contratos em Aberto: 539');

    // The formatted output should be a non-empty string
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(100);
  });

  test('should handle field extraction correctly', () => {
    // Test with a message that has specific fields we want to verify
    const specificMessage =
      'T:WINJ25:121711:3:133510:4:133515:17:129:18:85:19:15:20:23:60:39:61:39:142:121711186!';
    const result = parseCedroMessage(specificMessage);

    expect(result.ticker).toBe('WINJ25');
    expect(result.lastModificationTime).toBe('121711');
    expect(result.bestBidPrice).toBe(133510);
    expect(result.bestAskPrice).toBe(133515);
    expect(result.cumulativeVolume).toBe(129);
    expect(result.lastTradeQuantity).toBe(15);
    expect(result.lastModificationTimeMs).toBe('121711186');
  });
});
