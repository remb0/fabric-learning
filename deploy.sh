#!/bin/sh
set -eu

SERVICE="fabric-dp700"
BRANCH="main"

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

for command_name in git docker; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Fout: vereist commando ontbreekt: %s\n' "$command_name" >&2
    exit 1
  fi
done

if [ "$(git branch --show-current)" != "$BRANCH" ]; then
  printf 'Fout: deploy.sh verwacht branch %s. Huidige branch: %s\n' "$BRANCH" "$(git branch --show-current)" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  printf 'Fout: er staan lokale wijzigingen in %s. Commit, bewaar of verwijder die eerst.\n' "$SCRIPT_DIR" >&2
  git status --short >&2
  exit 1
fi

printf 'Nieuwe code ophalen van origin/%s...\n' "$BRANCH"
git fetch origin "$BRANCH"
if ! git merge-base --is-ancestor HEAD "origin/$BRANCH"; then
  printf 'Fout: lokale branch en origin/%s zijn uiteen gelopen. Los dit eerst handmatig op.\n' "$BRANCH" >&2
  exit 1
fi
git pull --ff-only origin "$BRANCH"

if ! docker compose config --services | grep -qx "$SERVICE"; then
  printf 'Fout: Compose-service %s is niet gevonden.\n' "$SERVICE" >&2
  exit 1
fi

printf 'Container voor commit %s bouwen...\n' "$(git rev-parse --short HEAD)"
docker compose build --pull "$SERVICE"
docker compose up -d --force-recreate "$SERVICE"

printf 'Controleren of de container de bijgewerkte appbestanden bevat...\n'
docker compose exec -T "$SERVICE" sh -ec '
  test -s /app/pb_public/index.html
  test -s /app/pb_public/certifications.js
  grep -q "MICROSOFT DP EXAMS" /app/pb_public/index.html
  grep -q "examChosen:false" /app/pb_public/index.html
'

printf '\nDeploy voltooid: commit %s\n' "$(git rev-parse --short HEAD)"
docker compose ps "$SERVICE"
printf '\nRecente logs:\n'
docker compose logs --tail=30 "$SERVICE"
