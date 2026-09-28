/**
 * Log Text Classifier
 * Trains a Naive Bayes text classifier on log messages to predict a log field
 */

import { BayesClassifier } from 'natural';
import { ParsedLog } from '../utils/logFiles';

export type ClassifierLabel = 'level' | 'source' | 'technique';

export interface TrainingResult {
  label: ClassifierLabel;
  labels: Array<{ label: string; count: number }>;
  /** Labels left out because they have too few examples to learn from */
  excludedLabels: Array<{ label: string; count: number }>;
  trainSize: number;
  testSize: number;
  /** Share of held-out logs classified correctly */
  accuracy: number;
  /** Accuracy of always predicting the most common label, for comparison */
  baselineAccuracy: number;
  /** Serialized model, loadable with loadTextClassifier */
  model: string;
}

export interface LoadedClassifier {
  label: ClassifierLabel;
  classify(text: string): string;
}

const MODEL_FORMAT = 'log-text-classifier';
const MIN_LABELLED_LOGS = 10;
/** Labels with fewer examples are left out: Naive Bayes over-weights a class seen only a handful of times */
const MIN_EXAMPLES_PER_LABEL = 5;
/** Every Nth labelled log is held out for testing (a deterministic 20% split) */
const TEST_EVERY = 5;

export function labelOf(log: ParsedLog, label: ClassifierLabel): string | undefined {
  switch (label) {
    case 'level':
      return log.level || undefined;
    case 'source':
      return log.source?.name || log.source?.type || undefined;
    case 'technique':
      return log.mitre?.technique || undefined;
  }
}

export function trainTextClassifier(logs: ParsedLog[], label: ClassifierLabel): TrainingResult {
  const allLabelled = logs
    .map(log => ({ text: log.message, value: labelOf(log, label) }))
    .filter((entry): entry is { text: string; value: string } => Boolean(entry.value));

  const allCounts = new Map<string, number>();
  for (const entry of allLabelled) {
    allCounts.set(entry.value, (allCounts.get(entry.value) || 0) + 1);
  }
  const excludedLabels = [...allCounts.entries()]
    .filter(([, count]) => count < MIN_EXAMPLES_PER_LABEL)
    .map(([value, count]) => ({ label: value, count }))
    .sort((a, b) => a.count - b.count || a.label.localeCompare(b.label));
  const excluded = new Set(excludedLabels.map(entry => entry.label));
  const labelled = allLabelled.filter(entry => !excluded.has(entry.value));

  if (labelled.length < MIN_LABELLED_LOGS) {
    throw new Error(`Need at least ${MIN_LABELLED_LOGS} logs with a ${label} to train (found ${labelled.length})`);
  }

  const counts = new Map<string, number>();
  for (const entry of labelled) {
    counts.set(entry.value, (counts.get(entry.value) || 0) + 1);
  }
  if (counts.size < 2) {
    throw new Error(`Need at least 2 distinct ${label} values to train (found ${counts.size})`);
  }

  const train = labelled.filter((_, index) => index % TEST_EVERY !== TEST_EVERY - 1);
  const test = labelled.filter((_, index) => index % TEST_EVERY === TEST_EVERY - 1);

  const classifier = new BayesClassifier();
  for (const entry of train) {
    classifier.addDocument(entry.text, entry.value);
  }
  classifier.train();

  const correct = test.filter(entry => classifier.classify(entry.text) === entry.value).length;
  const trainCounts = new Map<string, number>();
  for (const entry of train) {
    trainCounts.set(entry.value, (trainCounts.get(entry.value) || 0) + 1);
  }
  const majority = [...trainCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const baselineCorrect = test.filter(entry => entry.value === majority).length;

  return {
    label,
    labels: [...counts.entries()]
      .map(([value, count]) => ({ label: value, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    excludedLabels,
    trainSize: train.length,
    testSize: test.length,
    accuracy: test.length > 0 ? correct / test.length : 0,
    baselineAccuracy: test.length > 0 ? baselineCorrect / test.length : 0,
    model: JSON.stringify({ format: MODEL_FORMAT, version: 1, label, classifier })
  };
}

export function loadTextClassifier(model: string): LoadedClassifier {
  let parsed: unknown;
  try {
    parsed = JSON.parse(model);
  } catch {
    throw new Error('Not a saved text classifier model (invalid JSON)');
  }

  const envelope = parsed as { format?: unknown; label?: unknown; classifier?: unknown };
  if (!envelope || envelope.format !== MODEL_FORMAT || typeof envelope.classifier !== 'object' || envelope.classifier === null) {
    throw new Error('Not a saved text classifier model');
  }

  const classifier = BayesClassifier.restore(envelope.classifier as BayesClassifier);
  return {
    label: envelope.label as ClassifierLabel,
    classify: (text: string) => classifier.classify(text)
  };
}
