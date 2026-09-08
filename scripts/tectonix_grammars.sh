#!/usr/bin/env bash
# Build the tree-sitter grammars tectonix needs to read this repository, from
# pinned commits, into ~/.tectonix/plugins/<lang>/grammars/<platform>.<ext>.
#
#   bash scripts/tectonix_grammars.sh        # build (Linux / macOS, needs cc)
#   bash scripts/tectonix_grammars.sh --id   # print the fingerprint of the pins
#
# Why this exists: tectonix downloads prebuilt grammars from a GitHub release
# of DevomB/Tectonix, and no such release is published. Without grammars it
# still "scans" — counts files and lines, finds zero functions and zero
# imports — and reports a flattering score for an empty graph. That is what
# the first CI runs recorded. The workflow builds these instead and refuses to
# score until they load.
#
# Every pin is a commit, not a branch, so two runs of the workflow parse the
# same way. Bumping a pin changes the fingerprint, which changes the `tool`
# stamp in the history file, which makes scripts/tectonix_history.py re-score
# every commit under the new grammars rather than mixing two readings.
set -euo pipefail

# <lang>=<github repo>@<commit>[:<subdir holding src/>]
PINS=(
  "typescript=tree-sitter/tree-sitter-typescript@75b3874edb2dc714fb1fd77a32013d0f8699989f:typescript"
  "javascript=tree-sitter/tree-sitter-javascript@58404d8cf191d69f2674a8fd507bd5776f46cb11"
  "json=tree-sitter/tree-sitter-json@254c42a6476413b776221e03982ac8ae159eeb72"
  "python=tree-sitter/tree-sitter-python@26855eabccb19c6abf499fbc5b8dc7cc9ab8bc64"
  "rust=tree-sitter/tree-sitter-rust@77a3747266f4d621d0757825e6b11edcbf991ca5"
  "ocaml=tree-sitter/tree-sitter-ocaml@a4ce49a6c17e88e7ca8350cfb666749d9a5c6630:grammars/ocaml"
  "css=tree-sitter/tree-sitter-css@dda5cfc5722c429eaba1c910ca32c2c0c5bb1a3f"
  "yaml=tree-sitter-grammars/tree-sitter-yaml@a1c4812a73ec5e089de8e441fdea3a921e8d5079"
  "toml=tree-sitter-grammars/tree-sitter-toml@64b56832c2cffe41758f28e05c756a3a98d16f41"
  "markdown=tree-sitter-grammars/tree-sitter-markdown@a0a00f817d02412bd92c54d316f164d827b57b5c:tree-sitter-markdown"
)

if [ "${1:-}" = "--id" ]; then
  printf '%s\n' "${PINS[@]}" | sha256sum | cut -c1-12
  exit 0
fi

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)  PLATFORM=linux-x86_64;  EXT=so ;;
  Linux-aarch64) PLATFORM=linux-aarch64; EXT=so ;;
  Darwin-arm64)  PLATFORM=darwin-arm64;  EXT=dylib ;;
  Darwin-x86_64) PLATFORM=darwin-x86_64; EXT=dylib ;;
  *) echo "unsupported platform $(uname -s)-$(uname -m); build on Linux or macOS" >&2; exit 1 ;;
esac

OUT="${TECTONIX_PLUGINS_DIR:-$HOME/.tectonix/plugins}"
WORK="${TECTONIX_GRAMMAR_WORK:-${TMPDIR:-/tmp}/tectonix-grammars}"
mkdir -p "$OUT" "$WORK"

for spec in "${PINS[@]}"; do
  lang="${spec%%=*}"
  rest="${spec#*=}"
  repo="${rest%%@*}"
  rest="${rest#*@}"
  sha="${rest%%:*}"
  sub=""
  [ "$rest" != "$sha" ] && sub="${rest#*:}"

  dir="$WORK/$lang"
  if [ ! -d "$dir/.git" ]; then git init -q "$dir"; fi
  if ! git -C "$dir" cat-file -e "$sha^{commit}" 2>/dev/null; then
    git -C "$dir" fetch -q --depth 1 "https://github.com/$repo" "$sha"
  fi
  git -C "$dir" checkout -q "$sha"

  src="$dir/${sub:+$sub/}src"
  [ -f "$src/parser.c" ] || { echo "$lang: no parser.c under $src" >&2; exit 1; }

  objs=("$dir/parser.o")
  cc -c -fPIC -O2 -w -I "$src" "$src/parser.c" -o "$dir/parser.o"
  if [ -f "$src/scanner.c" ]; then
    cc -c -fPIC -O2 -w -I "$src" "$src/scanner.c" -o "$dir/scanner.o"
    objs+=("$dir/scanner.o")
  fi
  link=cc
  if [ -f "$src/scanner.cc" ]; then
    c++ -c -fPIC -O2 -w -I "$src" "$src/scanner.cc" -o "$dir/scanner_cc.o"
    objs+=("$dir/scanner_cc.o")
    link=c++
  fi

  mkdir -p "$OUT/$lang/grammars"
  "$link" -shared "${objs[@]}" -o "$OUT/$lang/grammars/$PLATFORM.$EXT"
  echo "built $lang @ ${sha:0:7}${sub:+ ($sub)} -> $OUT/$lang/grammars/$PLATFORM.$EXT"
done
