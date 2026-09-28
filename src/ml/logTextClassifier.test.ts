import { labelOf, loadTextClassifier, trainTextClassifier } from './logTextClassifier';

function sampleLogs(): Array<{ message: string; level: string; source: { name: string }; mitre?: { technique: string } }> {
  const logs = [];
  for (let i = 0; i < 40; i++) {
    logs.push({ message: `Failed password for user u${i} from host`, level: 'WARN', source: { name: 'auth' }, mitre: { technique: 'T1110' } });
    logs.push({ message: `Request GET /page/${i} completed 200`, level: 'INFO', source: { name: 'web' } });
    logs.push({ message: `Disk quota exceeded on volume ${i} error`, level: 'ERROR', source: { name: 'server' } });
  }
  return logs;
}

describe('labelOf', () => {
  it('reads the level, source name or MITRE technique', () => {
    const log = { message: 'x', level: 'WARN', source: { name: 'auth', type: 'authentication' }, mitre: { technique: 'T1110' } };

    expect(labelOf(log, 'level')).toBe('WARN');
    expect(labelOf(log, 'source')).toBe('auth');
    expect(labelOf(log, 'technique')).toBe('T1110');
    expect(labelOf({ message: 'x' }, 'technique')).toBeUndefined();
  });
});

describe('trainTextClassifier', () => {
  it('trains on message text and reports held-out accuracy against a majority baseline', () => {
    const result = trainTextClassifier(sampleLogs(), 'level');

    expect(result.trainSize + result.testSize).toBe(120);
    expect(result.testSize).toBe(24);
    expect(result.accuracy).toBe(1);
    expect(result.baselineAccuracy).toBeCloseTo(1 / 3, 1);
    expect(result.labels.map(l => l.label).sort()).toEqual(['ERROR', 'INFO', 'WARN']);
  });

  it('is deterministic', () => {
    const first = trainTextClassifier(sampleLogs(), 'source');
    const second = trainTextClassifier(sampleLogs(), 'source');

    expect(second.accuracy).toBe(first.accuracy);
    expect(second.model).toBe(first.model);
  });

  it('only uses logs that have the label', () => {
    const result = trainTextClassifier(sampleLogs().map((log, i) => (i % 2 === 0 ? log : { ...log, level: undefined as unknown as string })), 'level');

    expect(result.trainSize + result.testSize).toBe(60);
  });

  it('leaves out labels with too few examples to learn from, and reports them', () => {
    const logs = [...sampleLogs(), { message: 'Kernel panic detected', level: 'CRITICAL', source: { name: 'server' } }];

    const result = trainTextClassifier(logs, 'level');

    expect(result.excludedLabels).toEqual([{ label: 'CRITICAL', count: 1 }]);
    expect(result.labels.map(l => l.label)).not.toContain('CRITICAL');
    expect(result.accuracy).toBe(1);
  });

  it('needs at least two distinct labels and enough labelled logs', () => {
    const oneLabel = sampleLogs().map(log => ({ ...log, level: 'INFO' }));

    expect(() => trainTextClassifier(oneLabel, 'level')).toThrow('Need at least 2 distinct level values');
    expect(() => trainTextClassifier(sampleLogs().slice(0, 5), 'level')).toThrow('Need at least 10 logs with a level');
  });
});

describe('loadTextClassifier', () => {
  it('restores a saved model that classifies new text', () => {
    const { model } = trainTextClassifier(sampleLogs(), 'source');

    const classifier = loadTextClassifier(model);

    expect(classifier.classify('Failed password for user admin')).toBe('auth');
    expect(classifier.classify('Request GET /home completed')).toBe('web');
  });

  it('rejects text that is not a saved model', () => {
    expect(() => loadTextClassifier('{"not":"a model"}')).toThrow('Not a saved text classifier model');
  });
});
