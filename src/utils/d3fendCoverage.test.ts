import { analyzeD3fendCoverage, listD3fendTechniques, parseLogLines } from './d3fendCoverage';
import { D3FENDMapper } from './d3fendMapper';

jest.mock('./logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

describe('listD3fendTechniques', () => {
  it('lists every supported technique with its category', () => {
    const techniques = listD3fendTechniques();

    expect(techniques.map(t => t.technique).sort()).toEqual([...D3FENDMapper.getSupportedTechniques()].sort());
    for (const technique of techniques) {
      expect(D3FENDMapper.getSupportedCategories()).toContain(technique.category);
    }
  });

  it('filters by category, case-insensitively', () => {
    const detect = listD3fendTechniques('detect');

    expect(detect.length).toBeGreaterThan(0);
    expect(detect.every(t => t.category === 'Detect')).toBe(true);
  });

  it('rejects an unknown category and names the valid ones', () => {
    expect(() => listD3fendTechniques('Teleport')).toThrow(/Unknown D3FEND category "Teleport".*Detect/);
  });
});

describe('analyzeD3fendCoverage', () => {
  it('counts explicit d3fend tags and messages the mapper recognises', () => {
    const report = analyzeD3fendCoverage([
      { message: 'anything', metadata: {}, d3fend: { technique: 'D3-NTA', category: 'Detect', subcategory: 'Network Traffic Analysis', description: 'x' } },
      { message: 'Malware detected in attachment.exe', metadata: {} },
      { message: 'Malware detected in invoice.pdf.exe', metadata: {} },
      { message: 'User alice logged in', metadata: {} }
    ]);

    expect(report.totalLogs).toBe(4);
    expect(report.logsWithDefense).toBe(3);
    const fileAnalysis = D3FENDMapper.mapLogToDefensiveTechnique('malware detected')!;
    expect(report.techniques[0]).toEqual(expect.objectContaining({ technique: fileAnalysis.technique, count: 2 }));
    expect(report.techniques.map(t => t.technique)).toContain('D3-NTA');
    expect(report.categories.Detect).toBe(3);
  });

  it('lists supported techniques that never appear', () => {
    const report = analyzeD3fendCoverage([{ message: 'Malware detected', metadata: {} }]);
    const seen = report.techniques.map(t => t.technique);

    expect(report.unseenTechniques.length).toBe(D3FENDMapper.getSupportedTechniques().length - seen.length);
    expect(report.unseenTechniques.some(t => seen.includes(t))).toBe(false);
  });

  it('handles an empty input', () => {
    const report = analyzeD3fendCoverage([]);

    expect(report).toEqual(expect.objectContaining({ totalLogs: 0, logsWithDefense: 0, techniques: [] }));
    expect(report.unseenTechniques.length).toBe(D3FENDMapper.getSupportedTechniques().length);
  });
});

describe('parseLogLines', () => {
  it('parses JSON lines and counts lines that are not log entries', () => {
    const text = [
      JSON.stringify({ message: 'one', metadata: {} }),
      '',
      'not json',
      JSON.stringify({ unrelated: true }),
      JSON.stringify({ message: 'two' })
    ].join('\n');

    const { logs, skipped } = parseLogLines(text);

    expect(logs.map(l => l.message)).toEqual(['one', 'two']);
    expect(skipped).toBe(2);
  });
});
