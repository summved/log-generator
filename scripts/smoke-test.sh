#!/bin/bash
# End-to-end smoke test: runs every CLI command, npm script alias, the built CLI and the examples,
# each with a hard timeout. HTTP and syslog output go to local receivers on 127.0.0.1.
#
# Usage: scripts/smoke-test.sh [output-dir]      (or: npm run test:smoke)
# Results: <output-dir>/results.tsv, one log per check in <output-dir>/logs/. Exits 1 if any check fails.
set -u
REPO=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:-$(mktemp -d "${TMPDIR:-/tmp}/log-generator-smoke.XXXXXX")}
mkdir -p "$OUT/logs" "$OUT/data/current" "$OUT/data/historical" "$OUT/cfg"
cd "$REPO" || exit 1
export ENABLE_MONITORING=false
CLI="node_modules/.bin/ts-node src/cli.ts"
HTTP_RX=${SMOKE_HTTP_PORT:-18080}
UDP_RX=${SMOKE_UDP_PORT:-15514}

# Copies of the configs with storage in $OUT (leaves logs/ untouched) and outputs on the local receivers
for f in default extreme-performance high-performance-worker-test siem-http-test siem-syslog-test; do
  sed -e "s#\./logs/current#$OUT/data/current#g" -e "s#\./logs/historical#$OUT/data/historical#g" \
      -e "s#http://localhost:8000/post#http://127.0.0.1:$HTTP_RX/post#" -e "s#port: 514#port: $UDP_RX#" \
      "src/config/$f.yaml" > "$OUT/cfg/$f.yaml"
done
cp logs/historical/test_sample.jsonl "$OUT/data/historical/"

printf "name\texpect\texit\tsecs\tverdict\n" > "$OUT/results.tsv"
# t <name> <timeout-seconds> <expect: ok|fail> <command...>
t() {
  local name=$1 to=$2 expect=$3; shift 3
  local start verdict code secs
  start=$(date +%s)
  perl -e "alarm $to; exec @ARGV" -- "$@" > "$OUT/logs/$name.log" 2>&1
  code=$?; secs=$(( $(date +%s) - start ))
  if [ $code -eq 142 ]; then verdict=TIMEOUT
  elif [ "$expect" = ok ] && [ $code -eq 0 ]; then verdict=PASS
  elif [ "$expect" = fail ] && [ $code -ne 0 ]; then verdict=PASS
  else verdict=FAIL; fi
  printf "%s\t%s\t%s\t%s\t%s\n" "$name" "$expect" "$code" "$secs" "$verdict" >> "$OUT/results.tsv"
  printf "%-28s %s\n" "$name" "$verdict"
}
# check <name> <condition-description> <shell test>: records a non-command assertion
check() {
  local name=$1 verdict=FAIL
  if eval "$3"; then verdict=PASS; fi
  printf "%s\t%s\t-\t0\t%s\n" "$name" "$2" "$verdict" >> "$OUT/results.tsv"
  printf "%-28s %s\n" "$name" "$verdict"
}
count() { node -p "require('$OUT/receivers.json').$1"; }

echo "Smoke test output: $OUT"
# --- core / config
t help 60 ok $CLI --help
t validate-config 60 ok $CLI validate-config
t status 60 ok $CLI status
t config-show 60 ok $CLI config --show
t config-get 60 ok $CLI config --get generators.endpoint.frequency
t init 60 ok $CLI init -o "$OUT/init-config.yaml"
# --- generation
t generate 90 ok $CLI generate -c "$OUT/cfg/default.yaml" --duration 10s
t generate-mitre-technique 90 ok $CLI generate -c "$OUT/cfg/default.yaml" --duration 8s --mitre-technique T1110
t generate-mitre-enabled 90 ok $CLI generate -c "$OUT/cfg/default.yaml" --duration 8s --mitre-enabled
t replay 90 ok $CLI replay -c "$OUT/cfg/default.yaml" -f test_sample.jsonl -s 100
t analyze 90 ok $CLI analyze -f test_sample.jsonl
t mitre-list 60 ok $CLI mitre-list
t mitre-coverage 90 ok $CLI mitre-coverage -f test_sample.jsonl
# --- attack chains
t chains-help 60 ok $CLI attack-chains
t chains-list 60 ok $CLI attack-chains:list
t chains-info-id 60 ok $CLI attack-chains:info apt29-cozy-bear-campaign
t chains-info-alias 60 ok $CLI attack-chains:info apt29-cozy-bear
t chains-execute-insider 120 ok $CLI attack-chains:execute malicious-insider-data-theft --speed 1000 --output-dir "$OUT/chain-insider"
t chains-execute-apt29 120 ok $CLI attack-chains:execute apt29-cozy-bear-campaign --speed 1000 --output-dir "$OUT/chain-apt29"
t chains-execute-ryuk-alias 120 ok $CLI attack-chains:execute ransomware-ryuk --speed 1000 --output-dir "$OUT/chain-ryuk"
t chains-execute-unknown 60 fail $CLI attack-chains:execute no-such-chain --speed 1000
t chains-status 60 ok $CLI attack-chains:status
t chains-abort-unknown 60 fail $CLI attack-chains:abort not-a-real-execution
t chains-coverage 60 ok $CLI attack-chains:coverage
t chains-execute-ai 90 ok $CLI attack-chains:execute-ai ryuk-ransomware-campaign --mode enhanced --ai-level basic
t chains-training 120 ok $CLI attack-chains:training ryuk-ransomware-campaign --variations 2 --delay 100
t chains-preview 90 ok $CLI attack-chains:preview ryuk-ransomware-campaign
t chains-ai-options 60 ok $CLI attack-chains:ai-options ryuk-ransomware-campaign
t chains-ai-statistics 60 ok $CLI attack-chains:ai-statistics
# --- SOC / D3FEND
t soc-help 60 ok $CLI soc-simulation
t soc-scenarios 60 ok $CLI soc-simulation:scenarios
t soc-run 90 ok $CLI soc-simulation:run incident-response -c "$OUT/cfg/default.yaml" -d 8s
t soc-d3fend-coverage 60 ok $CLI soc-simulation:d3fend-coverage
# --- ML (learn/generate use the default profile path; the profile is removed afterwards)
t ml-help 60 ok $CLI ml-patterns
t ml-status 60 ok $CLI ml-patterns:status
t ml-learn 180 ok $CLI ml-patterns:learn logs/historical/ml_test_sample.jsonl --min-samples 10
t ml-generate 90 ok $CLI ml-patterns:generate linux-server --count 5
t ml-generate-unknown 60 fail $CLI ml-patterns:generate no-such-source --count 5
rm -f models/ml-patterns/profile.json
t ml-analyze 120 ok $CLI ml-patterns:analyze logs/historical/test_sample.jsonl
t ml-config-show 60 ok $CLI ml-patterns:config --show
t ml-reset-prompt 60 ok $CLI ml-patterns:reset
# --- performance / outputs
t perf-disk 90 ok $CLI performance-test --mode disk --duration 5s -c "$OUT/cfg/extreme-performance.yaml"
t perf-worker 90 ok $CLI performance-test --mode worker --duration 5s -c "$OUT/cfg/high-performance-worker-test.yaml"
node scripts/smoke-receivers.js "$HTTP_RX" "$UDP_RX" "$OUT/receivers.json" & RX=$!
sleep 1
t perf-http 90 ok $CLI performance-test --mode http --duration 5s -c "$OUT/cfg/siem-http-test.yaml"
t perf-syslog 90 ok $CLI performance-test --mode syslog --duration 5s -c "$OUT/cfg/siem-syslog-test.yaml"
sleep 1; kill $RX 2>/dev/null; wait $RX 2>/dev/null
check http-logs-received "receiver got HTTP logs" '[ "$(count httpLogs)" -gt 0 ] && [ "$(count httpParseErrors)" -eq 0 ]'
check syslog-logs-received "receiver got syslog messages" '[ "$(count syslogMessages)" -gt 0 ]'
# --- npm scripts that point at CLI commands
for c in d3fend-list d3fend-coverage ml-patterns:train-nlp ml-patterns:test-anomaly ml-patterns:forecast ml-patterns:threat-intel; do
  t "script-$c" 60 ok $CLI "$c"
done
# --- built CLI + examples
t build 180 ok npm run build
t dist-help 60 ok node dist/cli.js --help
t dist-status 60 ok node dist/cli.js status
for e in basic-usage d3fend-integration-demo ai-attack-chain-demo ml-enhanced-demo; do
  t "example-$e" 60 ok node "examples/$e.js"
done

total=$(( $(wc -l < "$OUT/results.tsv") - 1 ))
failed=$(awk -F'\t' 'NR > 1 && $5 != "PASS"' "$OUT/results.tsv")
echo
if [ -n "$failed" ]; then
  echo "❌ $(echo "$failed" | wc -l | tr -d ' ') of $total checks failed (logs in $OUT/logs):"
  echo "$failed" | cut -f1,5
  exit 1
fi
echo "✅ All $total checks passed"
