import { describe, expect, it } from 'vitest';
import { createSupportSseParser } from '@/services/support-sse-parser';

describe('createSupportSseParser', () => {
  it('reconstruye eventos divididos entre chunks, con LF y con CRLF', () => {
    const parser = createSupportSseParser();
    expect(parser.push('data: {"type":"message.created","data":{"body":"hola"}}\r\n\r')).toEqual([]);
    expect(parser.push('\n')).toEqual([{ type: 'message.created', data: { body: 'hola' } }]);
    expect(parser.push('data: {"type":"message.read","data":{"sequence":"2"}}\n\n')).toEqual([
      { type: 'message.read', data: { sequence: '2' } },
    ]);
  });

  it('rechaza un evento incompleto que, sin tope, se acumularía en memoria sin límite', () => {
    const parser = createSupportSseParser();
    expect(() => parser.push('data: ' + 'x'.repeat(65_536))).toThrow(/SSE/);
  });

  it('rechaza un evento completo que pasa del tope', () => {
    const parser = createSupportSseParser();
    expect(() => parser.push('data: ' + 'x'.repeat(65_536) + '\n\n')).toThrow(/SSE/);
  });

  it('el tope es por evento: muchos eventos pequeños seguidos no lo disparan', () => {
    const parser = createSupportSseParser();
    const evento = 'data: {"type":"agent.typing","data":{}}\n\n';
    for (let i = 0; i < 5_000; i += 1) expect(parser.push(evento)).toHaveLength(1);
  });

  it('ignora un dato ilegible y procesa el siguiente evento válido', () => {
    const parser = createSupportSseParser();
    expect(parser.push('data: no-json\n\ndata: {"type":"channel.closed","data":{}}\n\n')).toEqual([
      { type: 'channel.closed', data: {} },
    ]);
  });

  it('descarta lo que no tiene la forma { type, data }', () => {
    const parser = createSupportSseParser();
    expect(parser.push('data: {"type":1,"data":{}}\n\ndata: {"type":"x","data":[]}\n\n')).toEqual([]);
  });
});
