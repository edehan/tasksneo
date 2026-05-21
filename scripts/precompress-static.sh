#!/usr/bin/env sh
set -eu

if [ "$#" -eq 0 ]; then
	printf 'Usage: %s <dir> [dir...]\n' "$0" >&2
	exit 2
fi

for command_name in zstd brotli gzip; do
	if ! command -v "$command_name" >/dev/null 2>&1; then
		printf 'Missing required command: %s\n' "$command_name" >&2
		exit 1
	fi
done

for root in "$@"; do
	if [ ! -d "$root" ]; then
		printf 'Static asset directory not found: %s\n' "$root" >&2
		exit 1
	fi
done

find "$@" -type f \( \
	-name '*.html' -o \
	-name '*.js' -o \
	-name '*.mjs' -o \
	-name '*.css' -o \
	-name '*.json' -o \
	-name '*.webmanifest' -o \
	-name '*.svg' -o \
	-name '*.txt' -o \
	-name '*.xml' \
\) ! -name '*.gz' ! -name '*.br' ! -name '*.zst' -exec sh -c '
	set -eu
	for file do
		zstd -q -f -19 -o "$file.zst" "$file"
		brotli -f -q 11 -o "$file.br" "$file"
		gzip -9 -c "$file" > "$file.gz"
	done
' sh {} +
