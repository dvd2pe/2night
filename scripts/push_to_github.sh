#!/bin/bash
# Push del progetto verso github.com/dvd2pe/2night.
# Il token NON viene salvato su file: passa da variabile d'ambiente
#   GITHUB_TOKEN=<il-tuo-token> bash scripts/push_to_github.sh "messaggio commit"
# e resta solo nella sessione corrente della shell.
set -e
REPO_DIR="/home/z/my-project/source/2night"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN non impostato: usa GITHUB_TOKEN=<token> $0 <msg>" >&2
  exit 1
fi

# sincronizza il progetto corrente nel repo (stesse cartelle del commit iniziale)
cd /home/z/my-project
rsync -a public/ "$REPO_DIR/public/"
rsync -a src/ "$REPO_DIR/src/"
rsync -a scripts/ "$REPO_DIR/scripts/"
rsync -a prisma/ "$REPO_DIR/prisma/"
for f in package.json next.config.ts eslint.config.mjs postcss.config.mjs tailwind.config.ts tsconfig.json components.json bun.lock .gitignore; do
  cp -f "$f" "$REPO_DIR/$f" 2>/dev/null || true
done

cd "$REPO_DIR"
git add -A
if git diff --cached --quiet; then
  echo "nessuna modifica da commitare"
else
  git commit -m "${1:-Aggiornamento progetto}"
fi
# token solo nell'URL del singolo push: mai scritto in .git/config o file
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/dvd2pe/2night.git" main
echo "push completato"
