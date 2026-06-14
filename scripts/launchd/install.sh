#!/usr/bin/env bash
# scripts/launchd/install.sh
#
# Installs a launchd LaunchAgent that runs `swayam daemon start` on login and
# keeps it running. Logs go to data/daemon.{out,err}.log.
#
# Usage:
#   bash scripts/launchd/install.sh           # install + load
#   bash scripts/launchd/install.sh --uninstall
#
# After install, manage with:
#   launchctl list | grep com.swayam-sevak.daemon
#   launchctl stop com.swayam-sevak.daemon       # stop now
#   launchctl start com.swayam-sevak.daemon      # restart
#   tail -f data/daemon.out.log

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LABEL="com.swayam-sevak.daemon"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
NODE_BIN="$(command -v node || true)"
TSX_ENTRY="$REPO/src/cli/index.ts"

[[ -d "$REPO" ]] || { echo "error: repo not found at $REPO"; exit 1; }

if [[ "${1:-}" == "--uninstall" ]]; then
  if [[ -f "$PLIST" ]]; then
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "uninstalled $LABEL"
  else
    echo "no plist at $PLIST — nothing to uninstall"
  fi
  exit 0
fi

[[ -n "$NODE_BIN" ]] || { echo "error: node not on PATH"; exit 1; }
[[ -f "$TSX_ENTRY" ]] || { echo "error: missing $TSX_ENTRY"; exit 1; }

# We invoke node via tsx directly (no npm wrapper) so the process tree is
# clean and launchd can supervise the actual node process.
TSX_LOADER="$REPO/node_modules/.bin/tsx"
[[ -x "$TSX_LOADER" ]] || {
  echo "error: tsx not built. Run \`npm install\` in $REPO first."
  exit 1
}

mkdir -p "$REPO/data"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${TSX_LOADER}</string>
        <string>${TSX_ENTRY}</string>
        <string>daemon</string>
        <string>start</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${REPO}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <!-- launchd has a minimal PATH; add Homebrew + system bins. -->
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>

    <key>ThrottleInterval</key>
    <integer>30</integer>

    <key>StandardOutPath</key>
    <string>${REPO}/data/daemon.out.log</string>

    <key>StandardErrorPath</key>
    <string>${REPO}/data/daemon.err.log</string>
</dict>
</plist>
EOF

# Load (replace if already loaded).
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "installed: $PLIST"
echo "label:     $LABEL"
echo "logs:      $REPO/data/daemon.{out,err}.log"
echo
echo "manage with:"
echo "  launchctl list | grep $LABEL"
echo "  launchctl stop $LABEL"
echo "  launchctl start $LABEL"
echo "  bash $0 --uninstall"
