#!/usr/bin/env bash
# Builds the Penpot site the suite of this repository runs against, in a DDEV project: Penpot, the open-source design
# and prototyping platform, self-hosted from the publisher's images (its frontend, its backend and its exporter), with
# PostgreSQL 15 and Valkey beside them:
#   - https://<project>.ddev.site/          Penpot, served by its frontend through DDEV's router;
#   - https://<project>.ddev.site:8026/     DDEV's mail catcher (Mailpit): the mail Penpot sends;
#   - the accounts of the test users, made with the backend's own tool (its prepl, which manage.py talks to), and the
#     team, the projects, the files and a comment the features read, made through Penpot's own API as the accounts.
#
# Environment:
#   PROJECT_NAME          the DDEV project                                (default penpotsteps)
#   PENPOT_VERSION        the release of Penpot's images                  (default 2.19.4)
#   ACCOUNT_PASSWORD      the password of every test account              (default dD.123123ddd)
#   SITE_DIR              where the project goes                          (default a new temporary folder)
#   WEB_HTTP_PORT         the router ports DDEV's own web container moves to, since Penpot's frontend takes the
#   WEB_HTTPS_PORT        project's address                               (default 8093 and 8457)
#   ACCOUNTS_ONLY         1: build nothing, put the accounts back as they were made on the site in SITE_DIR
#   TIDY_ONLY             1: build nothing, remove what a run that was stopped half way left on the site in SITE_DIR
#                         (projects, files and teams named "Webship test …", the trash, invitations to
#                         "webship-test-…" addresses, comments that say "Webship test"), and put the roles of the
#                         members and the onboarding of the accounts back as the build made them
#
# The accounts are configuration: this script makes them and cucumber.js names them; the features never create or
# delete one. Each logs in with its address.
#   owner@example.com    Owner Test    the owner of the team "Design team"
#   admin@example.com    Admin Test    an admin of it: the members, the invitations
#   editor@example.com   Editor Test   an editor: the projects and the files
#   viewer@example.com   Viewer Test   a viewer: reads, comments, inspects
#
# The test site, set up for testing: no telemetry; a password recovery is sent again after one second (Penpot waits
# fifteen minutes by default after a profile changed); the admin console, which needs a service of its own, is off;
# each account has seen the onboarding and the release notes of this version, and each but admin has answered the
# questionnaire of a new profile (a scenario walks admin's without sending it: answers sent once stay for good).
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-penpotsteps}"
PENPOT_VERSION="${PENPOT_VERSION:-2.19.4}"
ACCOUNT_PASSWORD="${ACCOUNT_PASSWORD:-dD.123123ddd}"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"
WEB_HTTP_PORT="${WEB_HTTP_PORT:-8093}"
WEB_HTTPS_PORT="${WEB_HTTPS_PORT:-8457}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_FILES="$(cd "${HERE}/../../site" && pwd)"
HOST="${PROJECT_NAME}.ddev.site"
SITE_URL="https://${HOST}"
# The release notes a profile has seen are those of the main version: 2.19 for 2.19.4.
MAIN_VERSION="$(echo "${PENPOT_VERSION}" | cut -d. -f1-2)"
export ACCOUNT_PASSWORD PENPOT_MAIN_VERSION="${MAIN_VERSION}"

# The accounts, as base64 of a JSON list on the first line of the backend's Python, then the script.
accounts() {
  local payload
  payload="$(python3 -c '
import base64, json, os
p = os.environ["ACCOUNT_PASSWORD"]
accounts = [("Owner Test", "owner@example.com"), ("Admin Test", "admin@example.com"), ("Editor Test", "editor@example.com"), ("Viewer Test", "viewer@example.com")]
print(base64.b64encode(json.dumps([{"fullname": n, "email": e, "password": p} for n, e in accounts]).encode()).decode())')"
  { echo "${payload}"; cat "${SITE_FILES}/penpot-accounts.py"; } \
    | ddev exec -s penpot-backend "python3 -c 'import io, sys; first = sys.stdin.readline(); rest = sys.stdin.read(); sys.stdin = io.StringIO(first); exec(rest)'"
}

# The site's content and the rest, through Penpot's API from this machine.
site() {
  python3 "${SITE_FILES}/penpot-site.py" "${SITE_URL}" "$@"
}

mkdir -p "${SITE_DIR}"
cd "${SITE_DIR}"

if [ "${ACCOUNTS_ONLY:-}" = "1" ]; then
  accounts
  site props team
  exit 0
fi
if [ "${TIDY_ONLY:-}" = "1" ]; then
  # The test content a stopped run left, then the roles and the onboarding of the accounts as the build made them.
  site tidy team props
  exit 0
fi

# A project of this name from an earlier build goes first, with its volumes (Penpot's database and files are volumes
# of the project's own services, named after it).
if ddev describe "${PROJECT_NAME}" > /dev/null 2>&1; then
  ddev delete -Oy "${PROJECT_NAME}" < /dev/null
fi
docker volume rm "ddev-${PROJECT_NAME}-penpot-postgres" "ddev-${PROJECT_NAME}-penpot-assets" > /dev/null 2>&1 || true

# A generic project with no database of DDEV's (Penpot has its own PostgreSQL) and Node.js 24 for a suite run in the
# web container; Penpot's services beside it, from the file of this repository.
ddev config --project-type=generic --project-name="${PROJECT_NAME}" --omit-containers=db --nodejs-version=24 --auto < /dev/null
sed -e "s/HTTP_EXPOSE=8093:80,/HTTP_EXPOSE=${WEB_HTTP_PORT}:80,/" -e "s/HTTPS_EXPOSE=8457:80,/HTTPS_EXPOSE=${WEB_HTTPS_PORT}:80,/" \
  "${SITE_FILES}/docker-compose.penpot.yaml" > .ddev/docker-compose.penpot.yaml
# The release, and a secret key of this site's own.
printf 'PENPOT_VERSION=%s\nPENPOT_SECRET_KEY=%s\n' "${PENPOT_VERSION}" "$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 48)" > .ddev/.env

echo "Starting Penpot ${PENPOT_VERSION}."
ddev start -y < /dev/null

echo "Waiting for the frontend and the backend."
for i in $(seq 1 120); do
  front="$(curl -sk -o /dev/null -w '%{http_code}' "${SITE_URL}/" || true)"
  api="$(curl -sk -o /dev/null -w '%{http_code}' -H 'Accept: application/json' "${SITE_URL}/api/main/methods/get-profile" || true)"
  [ "${front}" = 200 ] && [ "${api}" = 200 ] && break
  sleep 5
done
if [ "${front}" != 200 ] || [ "${api}" != 200 ]; then
  echo "Penpot did not answer: the front page ${front}, the API ${api}." >&2
  ddev logs -s penpot-backend 2>/dev/null | tail -40 >&2 || true
  exit 1
fi

echo "The accounts."
accounts
echo "The team, the projects, the files and a comment."
site props team content
site list

echo "Built Penpot ${PENPOT_VERSION} at ${SITE_URL}, its mail at ${SITE_URL}:8026"
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=${SITE_URL}" >> "${GITHUB_ENV}"
fi
