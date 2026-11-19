#!/usr/bin/env bash
# Install or update packing-master on Debian 12+ (for example in the LXC that
# proxmox/packing-master.sh creates). Lightweight on purpose: Node.js and MariaDB run
# natively under systemd, no Docker. Safe to run again: it never overwrites the env file,
# the database or the backups.
#
#   first install (from a checkout):  bash /opt/packing-master/proxmox/install.sh
#   update:                           update            (installed to /usr/local/bin by this script)
#
# First-install settings: HTTP_PORT (default 80). Later, edit /etc/packing-master/env.
set -euo pipefail

APP_DIR=/opt/packing-master
DATA_DIR=/var/lib/packing-master
CONF_DIR=/etc/packing-master
ENV_FILE=$CONF_DIR/env
CONTROL=$DATA_DIR/control
DEPLOY_KEY=/root/.ssh/packing-master_deploy
SVC_USER=packing-master
NODE_MAJOR=22

# Colors only on a terminal: the web UI shows update.log as plain text.
if [[ -t 1 ]]; then B=$'\e[1;34m' R=$'\e[1;31m' N=$'\e[0m'; else B='' R='' N=''; fi
msg() { printf '%s==>%s %s\n' "$B" "$N" "$*"; }
die() { printf '%serror:%s %s\n' "$R" "$N" "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root"
command -v apt-get >/dev/null || die "this installer needs Debian or Ubuntu (apt-get)"
[[ -d $APP_DIR/.git ]] || die "$APP_DIR is not a git checkout (proxmox/packing-master.sh clones it)"

export DEBIAN_FRONTEND=noninteractive
need=()
for p in git curl ca-certificates jq gnupg mariadb-server; do
  dpkg -s "$p" >/dev/null 2>&1 || need+=("$p")
done
if [[ ${#need[@]} -gt 0 ]]; then
  msg "Installing system packages: ${need[*]}"
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends "${need[@]}" >/dev/null
fi

if ! command -v node >/dev/null || [[ $(node -p 'process.versions.node.split(".")[0]') -lt $NODE_MAJOR ]]; then
  msg "Installing Node.js $NODE_MAJOR (NodeSource)"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
    >/etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
fi

if ! id "$SVC_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$SVC_USER"
fi
install -d -m 0755 "$DATA_DIR"
install -d -m 0750 -o "$SVC_USER" -g "$SVC_USER" "$DATA_DIR/backups" "$CONTROL"
install -d -m 0750 -o root -g "$SVC_USER" "$CONF_DIR"

# ---- MariaDB: small footprint, one database, one user --------------------------------
cat >/etc/mysql/mariadb.conf.d/90-packing-master.cnf <<'EOF'
# Written by packing-master's install.sh: a tiny database needs a tiny server.
[mysqld]
bind-address = 127.0.0.1
innodb_buffer_pool_size = 64M
performance_schema = OFF
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
EOF
systemctl enable --quiet mariadb
systemctl restart mariadb

if [[ ! -f $ENV_FILE ]]; then
  db_pass=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-24)
  (umask 027; cat >"$ENV_FILE" <<EOF
# packing-master settings (systemd EnvironmentFile). Written $(date -Iseconds).
NODE_ENV=production
HOST=0.0.0.0
PORT=${HTTP_PORT:-80}
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=packing
DB_PASS=$db_pass
DB_NAME=packing
RUN_MIGRATIONS=1
BACKUP_DIR=$DATA_DIR/backups
CONTROL_DIR=$CONTROL
# Backup uploads are bigger than adapter-node's 512K default.
BODY_SIZE_LIMIT=50M
# Behind a Cloudflare tunnel the original scheme arrives in this header.
PROTOCOL_HEADER=x-forwarded-proto
EOF
  )
  msg "Created $ENV_FILE (database password generated)"
fi
chown root:"$SVC_USER" "$ENV_FILE"
chmod 0640 "$ENV_FILE"
# Write stdin to a file via rename: `update` runs while this script regenerates it, and bash
# reads a running script incrementally, so the old file must stay intact.
put() { local tmp; tmp=$(mktemp "$1.XXXX"); cat >"$tmp"; chmod "${2:-0644}" "$tmp"; mv -f "$tmp" "$1"; }
envget() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -1; }
DB_PASS=$(envget DB_PASS)
PORT=$(envget PORT)
PORT=${PORT:-80}

mysql --protocol=socket <<EOF
CREATE DATABASE IF NOT EXISTS packing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'packing'@'localhost' IDENTIFIED BY '$DB_PASS';
CREATE USER IF NOT EXISTS 'packing'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
ALTER USER 'packing'@'localhost' IDENTIFIED BY '$DB_PASS';
ALTER USER 'packing'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON packing.* TO 'packing'@'localhost';
GRANT ALL PRIVILEGES ON packing.* TO 'packing'@'127.0.0.1';
FLUSH PRIVILEGES;
EOF

# ---- build ----------------------------------------------------------------------------
[[ -f $DEPLOY_KEY ]] && git -C "$APP_DIR" config core.sshCommand \
  "ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

msg "Building $(git -C "$APP_DIR" log -1 --format='%h %cs %s') (a minute or two)"
systemctl stop packing-master 2>/dev/null || true
BUILD_LOG=$DATA_DIR/build.log
# An old build must never mask a failed one. The steps are chained with && because
# `set -e` does not apply inside a subshell whose status `if` tests.
rm -rf "$APP_DIR/build"
if ! (
  cd "$APP_DIR" &&
  npm ci --no-audit --no-fund --loglevel=error &&
  npm run build &&
  npm prune --omit=dev --no-audit --no-fund --loglevel=error &&
  npm cache clean --force --loglevel=error
) >"$BUILD_LOG" 2>&1; then
  tail -40 "$BUILD_LOG" >&2
  die "build failed (full output: $BUILD_LOG)"
fi

# ---- services -------------------------------------------------------------------------
put /etc/systemd/system/packing-master.service <<EOF
[Unit]
Description=packing-master web app
After=network-online.target mariadb.service
Wants=network-online.target
Requires=mariadb.service

[Service]
User=$SVC_USER
Group=$SVC_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node $APP_DIR/build
Restart=always
RestartSec=3
# Port 80 without running as root.
AmbientCapabilities=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA_DIR/backups $CONTROL

[Install]
WantedBy=multi-user.target
EOF

put /usr/local/bin/update 0755 <<EOF
#!/usr/bin/env bash
# Update packing-master to the latest commit: back up the data, pull, rebuild, restart.
# Rolls back to the previous commit if the new version does not come up healthy.
set -euo pipefail
APP=$APP_DIR
BACKUPS=$DATA_DIR/backups
echo "== update started \$(date -Iseconds)"

echo "== backing up the data"
if ! curl -fsS -m 120 -X POST -H 'content-type: application/json' -d '{"reason":"pre-update"}' \\
     "http://127.0.0.1:$PORT/api/backups"; then
  echo "app backup failed; taking a raw mysqldump instead"
  out="\$BACKUPS/raw-pre-update-\$(date +%Y%m%d-%H%M%S).sql.gz"
  mysqldump --single-transaction packing | gzip >"\$out"
  echo "wrote \$out"
fi
echo

PREV=\$(git -C "\$APP" rev-parse HEAD)
git -C "\$APP" fetch --quiet origin
git -C "\$APP" reset --quiet --hard "origin/\$(git -C "\$APP" rev-parse --abbrev-ref HEAD)"
NEW=\$(git -C "\$APP" rev-parse HEAD)
echo "== \${PREV:0:7} -> \${NEW:0:7}"
git -C "\$APP" log --format='   %h %s' "\$PREV..\$NEW" | head -30

if ! bash "\$APP/proxmox/install.sh"; then
  echo "== the new version failed; rolling back to \${PREV:0:7}"
  git -C "\$APP" reset --quiet --hard "\$PREV"
  bash "\$APP/proxmox/install.sh"
  echo "== rolled back. The pre-update backup is in \$BACKUPS"
  exit 1
fi
echo "== update finished \$(date -Iseconds)"
EOF

put /usr/local/bin/packing-master-check 0755 <<EOF
#!/usr/bin/env bash
# Look for a newer commit; writes $CONTROL/latest.json for the app's Settings page.
set -uo pipefail
APP=$APP_DIR
branch=\$(git -C "\$APP" rev-parse --abbrev-ref HEAD)
now=\$(date -Iseconds)
tmp=$CONTROL/latest.json.tmp
if err=\$(git -C "\$APP" fetch --quiet origin 2>&1); then
  latest=\$(git -C "\$APP" rev-parse "origin/\$branch")
  changes=\$(git -C "\$APP" log --format=%s "HEAD..origin/\$branch" | head -30 | jq -R . | jq -s .)
  jq -n --arg c "\$latest" --arg t "\$now" --argjson ch "\$changes" \\
    '{commit: \$c, checked_at: \$t, changes: \$ch, error: null}' >"\$tmp"
else
  jq -n --arg t "\$now" --arg e "\$err" '{commit: null, checked_at: \$t, changes: [], error: \$e}' >"\$tmp"
fi
chown $SVC_USER:$SVC_USER "\$tmp"
mv "\$tmp" $CONTROL/latest.json
EOF

# The app's "Update" / "Check" buttons only write request files into $CONTROL; these
# path units see them and run the work as root. The request is removed first, so each
# runs once; update output goes to update.log, which the app shows.
put /etc/systemd/system/packing-master-update.service <<EOF
[Unit]
Description=Update packing-master (requested from its web UI)

[Service]
Type=oneshot
ExecStartPre=/bin/rm -f $CONTROL/update-request
ExecStart=/bin/bash -c '/usr/local/bin/update >$CONTROL/update.log 2>&1'
TimeoutStartSec=30min
EOF
put /etc/systemd/system/packing-master-update.path <<EOF
[Unit]
Description=Watch for an update request from the packing-master web UI

[Path]
PathExists=$CONTROL/update-request

[Install]
WantedBy=multi-user.target
EOF
put /etc/systemd/system/packing-master-check.service <<EOF
[Unit]
Description=Check for a newer packing-master version

[Service]
Type=oneshot
ExecStartPre=/bin/rm -f $CONTROL/check-request
ExecStart=/usr/local/bin/packing-master-check
EOF
put /etc/systemd/system/packing-master-check.path <<EOF
[Unit]
Description=Watch for a version-check request from the packing-master web UI

[Path]
PathExists=$CONTROL/check-request

[Install]
WantedBy=multi-user.target
EOF
put /etc/systemd/system/packing-master-backup.service <<EOF
[Unit]
Description=Daily packing-master backup

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -fsS -m 120 -X POST -H 'content-type: application/json' -d '{"reason":"daily"}' http://127.0.0.1:$PORT/api/backups
EOF
put /etc/systemd/system/packing-master-backup.timer <<EOF
[Unit]
Description=Daily packing-master backup (the app keeps the last 14)

[Timer]
OnCalendar=*-*-* 03:30
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --quiet packing-master
systemctl enable --quiet --now packing-master-update.path packing-master-check.path packing-master-backup.timer
systemctl restart packing-master

msg "Waiting for the app to become healthy"
healthy=0
for _ in $(seq 1 60); do
  if curl -fsS -m 5 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 2
done
if [[ $healthy -ne 1 ]]; then
  journalctl -u packing-master -n 40 --no-pager >&2 || true
  die "the app did not become healthy on port $PORT"
fi

# Which commit is installed, for the app's Settings page (it cannot run git itself).
jq -n --arg c "$(git -C "$APP_DIR" rev-parse HEAD)" --arg d "$(git -C "$APP_DIR" log -1 --format=%cI)" \
  --arg b "$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)" --arg r "$(git -C "$APP_DIR" remote get-url origin)" \
  '{commit: $c, date: $d, branch: $b, repo: $r}' >"$CONTROL/installed.json"
chown "$SVC_USER:$SVC_USER" "$CONTROL/installed.json"
rm -f "$CONTROL/latest.json"

IP=$(hostname -I | awk '{print $1}')
msg "Running: http://$IP$([[ $PORT == 80 ]] || echo ":$PORT")  ($(git -C "$APP_DIR" log -1 --format='%h %cs'))"
msg "Logs: journalctl -u packing-master -f   Update: update   Disk: $(du -sh "$APP_DIR" | cut -f1) app"
