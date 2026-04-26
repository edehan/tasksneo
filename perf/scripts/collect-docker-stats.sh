#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-perf/results/run-$(date +%Y%m%d-%H%M%S)}"
INTERVAL="${2:-5}"
mkdir -p "$OUT_DIR"

OUT_FILE="$OUT_DIR/docker-stats.csv"
echo "timestamp,name,cpu_percent,mem_usage,mem_limit,mem_percent,net_io,block_io,pids" > "$OUT_FILE"

echo "writing docker stats to $OUT_FILE every ${INTERVAL}s"
while true; do
  ts="$(date -Iseconds)"
  docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}},{{.PIDs}}' \
    | awk -v ts="$ts" 'BEGIN{FS=","; OFS=","} {
      split($3, mem, " / ");
      print ts,$1,$2,mem[1],mem[2],$4,$5,$6,$7
    }' >> "$OUT_FILE"
  sleep "$INTERVAL"
done
