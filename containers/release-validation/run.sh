#!/bin/sh
set -u

case "${RELEASE_ID:-}" in
  ""|*[!A-Za-z0-9._-]*)
    echo "release capsule requires a safe RELEASE_ID" >&2
    exit 64
    ;;
esac

workspace="${SHOPPP_CAPSULE_WORKSPACE_ROOT:-/workspace}"
evidence="${SHOPPP_CAPSULE_EVIDENCE_ROOT:-/evidence}"

test -f "${workspace}/.release-source.json" || {
  echo "release capsule source identity is missing" >&2
  exit 65
}
test -d "${evidence}" && test -w "${evidence}" || {
  echo "release capsule evidence mount is not writable" >&2
  exit 66
}

(cd "${workspace}" && bun run release:validate -- --release-id "${RELEASE_ID}")
status=$?
report="${workspace}/artifacts/releases/${RELEASE_ID}.json"
if ! test -f "${report}"; then
  echo "release capsule validation produced no report" >&2
  exit 67
fi
umask 077
temporary="${evidence}/.${RELEASE_ID}.json.tmp.$$"
final="${evidence}/${RELEASE_ID}.json"
cp "${report}" "${temporary}" || exit 68
if ! ln "${temporary}" "${final}"; then
  rm -f "${temporary}"
  echo "release capsule evidence already exists or cannot be finalized" >&2
  exit 69
fi
rm -f "${temporary}"
exit "${status}"
