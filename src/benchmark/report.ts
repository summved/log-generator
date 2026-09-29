/**
 * Plain-text rendering of a benchmark report.
 */

import { Measurement } from './measure';
import { OutputMeasurement } from './outputs';
import { BenchmarkReport } from './runBenchmark';

const number = (value: number): string => Math.round(value).toLocaleString('en-US');

function row(name: string, m: Measurement, extra = ''): string {
  return `  ${name.padEnd(22)}${number(m.logsPerSecond).padStart(12)} logs/s ${m.mbPerSecond.toFixed(2).padStart(9)} MB/s ${number(m.bytesPerLog).padStart(7)} B/log${extra}`;
}

function section(title: string, rows: string[]): string[] {
  return ['', title, ...rows];
}

function deliveredShare(m: OutputMeasurement): string {
  const share = m.logs > 0 ? Math.round((m.delivered / m.logs) * 100) : 0;
  return `   ${number(m.delivered)} delivered (${share}%)`;
}

export function renderReport(report: BenchmarkReport): string {
  const lines = [
    'Log Generator benchmark',
    `  ${report.system.cpuModel}, ${report.system.cpus} CPUs, ${report.system.platform}, Node ${report.system.node}`,
    `  ${report.durationPerMeasurementMs / 1000}s per measurement, started ${report.startedAt}`
  ];

  if (report.generators || report.mixed) {
    lines.push(...section('Generators (single thread, generation only)', [
      ...(report.generators || []).map(m => row(m.name, m)),
      ...(report.mixed ? [row(report.mixed.name, report.mixed)] : [])
    ]));
    if (report.timestampLeadSeconds && report.timestampLeadSeconds > 0) {
      lines.push(`  ⚠️  Newest generated timestamp was ${report.timestampLeadSeconds}s ahead of the clock: timestamps advance 1 ms per log`);
      lines.push('      when more than one log is created in the same millisecond, so they drift ahead at high rates.');
    }
  }

  if (report.formats) {
    lines.push(...section('Formats (single thread, formatting only)', report.formats.map(m => row(m.name, m))));
  }

  if (report.outputs) {
    lines.push(...section('Outputs (generate + format + send + history copy, local receivers on 127.0.0.1)',
      report.outputs.map(m => row(m.name, m, deliveredShare(m)))));
  }

  if (report.workers && report.workers.length > 0) {
    lines.push(...section(`Worker threads (all generators, generate + format as ${report.workerFormat || 'json'}, no output)`,
      report.workers.map(m => row(m.name, m))));
    const peak = report.workers.reduce((best, m) => (m.logsPerSecond > best.logsPerSecond ? m : best));
    lines.push('', `Peak: ${number(peak.logsPerSecond)} logs/s with ${peak.name} (${number(peak.logsPerSecond * 60)} logs/min, ${number((peak.logsPerSecond * 3600 * peak.bytesPerLog) / 1024 ** 3)} GB/hour)`);
  }

  return lines.join('\n');
}
