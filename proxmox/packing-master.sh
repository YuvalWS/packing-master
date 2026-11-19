#!/usr/bin/env bash
# Create a small Debian LXC on a Proxmox VE host and install packing-master in it: Node.js
# and MariaDB run natively under systemd (no Docker), about 1.5 GB of disk in use.
# Laid out like the community Proxmox VE helper scripts:
# Default / Advanced / saved settings in a text UI, the choices saved for next time.
#
# On the Proxmox host shell, as root (the repository is private, so copy the script over):
#   scp proxmox/packing-master.sh root@<proxmox-host>:/root/     (from your checkout)
#   bash /root/packing-master.sh
#
# Inside an existing packing-master container the same command updates it.
#
# The container pulls the code with a read-only GitHub deploy key it generates; the script
# shows the public key and waits while you add it on GitHub. A public repository is cloned
# over HTTPS without a key.
#
# Without a terminal (or with NONINTERACTIVE=1) every setting comes from the environment or
# the defaults: CTID, CT_HOSTNAME, CT_STORAGE, TEMPLATE_STORAGE, DISK_GB, MEMORY_MB, CORES,
# BRIDGE, IP_CONFIG, GATEWAY, HTTP_PORT, REPO (owner/name on GitHub), BRANCH.
set -Eeuo pipefail

APP="Packing Master"
BRANCH="${BRANCH:-main}"
DEFAULTS_FILE="/usr/local/community-scripts/defaults/packing-master.vars"
BACKTITLE="packing-master LXC helper"

YW=$'\e[33m' GN=$'\e[1;92m' RD=$'\e[01;31m' BL=$'\e[36m' CL=$'\e[m'
msg_info() { printf ' %s… %s' "${YW}" "$1${CL}"; }
msg_ok() { printf '\r\e[K %s✔%s %s\n' "${GN}" "${CL}" "$1"; }
msg_error() { printf '\r\e[K %s✖%s %s\n' "${RD}" "${CL}" "$1" >&2; }

CREATED_CTID=""
ct_note() {
  if [[ -n $CREATED_CTID ]]; then
    echo "  Container $CREATED_CTID was created and is left as it is. To remove it: pct stop $CREATED_CTID; pct destroy $CREATED_CTID"
  fi
}
on_error() {
  local code=$? line=$1 cmd=$2
  msg_error "failed (exit $code) at line $line: $cmd"
  ct_note
  exit "$code"
}
trap 'on_error $LINENO "$BASH_COMMAND"' ERR
cancelled() { echo; msg_error "cancelled, nothing was changed"; ct_note; exit 0; }

header() {
  clear 2>/dev/null || true
  cat <<'EOF'
    ____             __   _                __  ___           __
   / __ \____ ______/ /__(_)___  ____ _   /  |/  /___ ______/ /____  _____
  / /_/ / __ `/ ___/ //_/ / __ \/ __ `/  / /|_/ / __ `/ ___/ __/ _ \/ ___/
 / ____/ /_/ / /__/ ,< / / / / / /_/ /  / /  / / /_/ (__  ) /_/  __/ /
/_/    \__,_/\___/_/|_/_/_/ /_/\__, /  /_/  /_/\__,_/____/\__/\___/_/
                              /____/
EOF
}

# ---- inside an existing container: update -----------------------------------------------
if ! command -v pct >/dev/null 2>&1; then
  if [[ -x /usr/local/bin/update && -d /opt/packing-master ]]; then
    exec /usr/local/bin/update
  fi
  echo "Run this on a Proxmox VE host (or inside a packing-master container to update it)." >&2
  exit 1
fi
[[ $EUID -eq 0 ]] || { echo "Run as root." >&2; exit 1; }

INTERACTIVE=1
if [[ ! -t 0 || "${NONINTERACTIVE:-0}" == 1 ]] || ! command -v whiptail >/dev/null; then
  INTERACTIVE=0
fi

# ---- saved defaults: KEY=VALUE lines, parsed (never sourced) ------------------------------
declare -A SAVED=()
if [[ -f $DEFAULTS_FILE ]]; then
  while IFS='=' read -r key value; do
    [[ $key =~ ^[a-z_]+$ ]] || continue
    value=${value%\"}; value=${value#\"}
    SAVED[$key]=$value
  done <"$DEFAULTS_FILE"
fi
saved() { local v=${SAVED[$1]:-}; printf '%s' "${v:-$2}"; }

first_storage() { pvesm status -content "$1" 2>/dev/null | awk 'NR>1 && $3=="active" {print $1; exit}'; }

# Built-in defaults. Idle use is ~150 MB RAM; the build (npm + vite) on install/update
# wants ~1 GB, so the swap covers the peak.
var_cpu=2 var_ram=1024 var_disk=4 var_brg=vmbr0 var_net=dhcp var_gateway=""
var_hostname=packing-master
var_container_storage=$(first_storage rootdir)
var_template_storage=$(first_storage vztmpl)
pm_http_port=80
pm_repo=${REPO:-}

SETTINGS=(var_cpu var_ram var_disk var_brg var_net var_gateway var_hostname var_container_storage
          var_template_storage pm_http_port pm_repo)
load_saved() {
  for k in "${SETTINGS[@]}"; do
    printf -v "$k" '%s' "$(saved "$k" "${!k}")"
  done
}

# ---- whiptail helpers (each returns the answer on stdout; Cancel ends the script) --------
input() { # title text default
  whiptail --backtitle "$BACKTITLE" --title "$1" --inputbox "$2" 10 72 "$3" 3>&1 1>&2 2>&3 || cancelled
}
storage_menu() { # content-type current what
  local items=() name type avail
  while read -r name type _ _ _ avail _; do
    items+=("$name" "$type, $((avail / 1024 / 1024)) GB free")
  done < <(pvesm status -content "$1" 2>/dev/null | awk 'NR>1 && $3=="active"')
  if [[ ${#items[@]} -le 2 ]]; then printf '%s' "${items[0]:-$2}"; return; fi
  whiptail --backtitle "$BACKTITLE" --title "Storage" --default-item "$2" \
    --menu "Storage for the $3:" 16 72 6 "${items[@]}" 3>&1 1>&2 2>&3 || cancelled
}
bridge_menu() {
  local items=() b
  for b in $(ip -o link show type bridge 2>/dev/null | awk -F': ' '{print $2}' | cut -d@ -f1); do
    items+=("$b" "")
  done
  if [[ ${#items[@]} -le 2 ]]; then printf '%s' "${items[0]:-$1}"; return; fi
  whiptail --backtitle "$BACKTITLE" --title "Network" --default-item "$1" \
    --menu "Bridge:" 14 50 5 "${items[@]}" 3>&1 1>&2 2>&3 || cancelled
}

container_settings() {
  CTID=$(input "Container ID" "Container ID:" "$CTID")
  var_hostname=$(input "Hostname" "Hostname:" "$var_hostname")
  var_cpu=$(input "CPU" "CPU cores:" "$var_cpu")
  var_ram=$(input "Memory" "Memory in MB (1024 is plenty; updates build the app inside the container):" "$var_ram")
  var_disk=$(input "Disk" "Disk size in GB (about 1.5 GB is used; the rest is room for backups and updates):" "$var_disk")
  var_container_storage=$(storage_menu rootdir "$var_container_storage" "container disk")
  var_template_storage=$(storage_menu vztmpl "$var_template_storage" "Debian template")
  var_brg=$(bridge_menu "$var_brg")
  var_net=$(input "IPv4" "dhcp, or a static address with prefix (192.168.1.50/24).
A static address (or a DHCP reservation) keeps the URL stable." "$var_net")
  if [[ $var_net != dhcp ]]; then
    var_gateway=$(input "Gateway" "Gateway address:" "$var_gateway")
  fi
  pm_http_port=$(input "Web port" "Port for the web app inside your LAN:" "$pm_http_port")
}

save_defaults() {
  mkdir -p "$(dirname "$DEFAULTS_FILE")"
  {
    echo "# packing-master helper defaults. Written $(date -Iseconds)."
    for k in "${SETTINGS[@]}"; do printf '%s="%s"\n' "$k" "${!k}"; done
  } >"$DEFAULTS_FILE"
  chmod 600 "$DEFAULTS_FILE"
}

# ---- gather the settings ------------------------------------------------------------------
header
CTID=${CTID:-$(pvesh get /cluster/nextid)}
if [[ $INTERACTIVE -eq 1 ]]; then
  whiptail --backtitle "$BACKTITLE" --title "$APP LXC" --yesno \
    "This creates a new $APP container: the packing-list web app with its MariaDB database (no Docker, small footprint), with backups and an Update button in its Settings page.\n\nProceed?" 12 72 || cancelled
  menu=("1" "Default settings" "2" "Advanced settings")
  [[ -f $DEFAULTS_FILE ]] && menu+=("3" "My saved defaults")
  choice=$(whiptail --backtitle "$BACKTITLE" --title "Settings" --menu "Choose:" 13 60 3 "${menu[@]}" 3>&1 1>&2 2>&3) || cancelled
  case $choice in
    1) ;;
    2) load_saved; container_settings ;;
    3) load_saved ;;
  esac
  [[ $choice == 1 ]] && pm_repo=$(saved pm_repo "$pm_repo")
  if [[ $choice == 2 || -z $pm_repo ]]; then
    pm_repo=$(input "GitHub repository" "The repository to install, as owner/name:" "$pm_repo")
  fi
  summary="Container $CTID ($var_hostname): $var_cpu cores, $var_ram MB, $var_disk GB on $var_container_storage
Network: $var_brg, ${var_net}${var_gateway:+, gateway $var_gateway}
Web port: $pm_http_port
Code: github.com/$pm_repo ($BRANCH)"
  whiptail --backtitle "$BACKTITLE" --title "Create it?" --yesno "$summary" 14 76 || cancelled
  # The repository is remembered even without "save as defaults": it is asked for otherwise.
  if [[ $choice != 2 ]]; then SAVE_REPO_ONLY=1; fi
  if [[ $choice == 2 ]] && whiptail --backtitle "$BACKTITLE" --title "Save as defaults?" --yesno \
      "Save these settings as your defaults for next time?\n($DEFAULTS_FILE)" 10 72; then
    save_defaults
  fi
else
  load_saved
  CT_ENV=(CT_HOSTNAME:var_hostname CORES:var_cpu MEMORY_MB:var_ram DISK_GB:var_disk CT_STORAGE:var_container_storage
          TEMPLATE_STORAGE:var_template_storage BRIDGE:var_brg IP_CONFIG:var_net GATEWAY:var_gateway
          HTTP_PORT:pm_http_port REPO:pm_repo)
  for pair in "${CT_ENV[@]}"; do
    env_name=${pair%%:*} var=${pair#*:}
    if [[ -n ${!env_name:-} ]]; then printf -v "$var" '%s' "${!env_name}"; fi
  done
fi

[[ $pm_repo =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { msg_error "set the repository as owner/name (REPO=owner/packing-master)"; exit 1; }
REPO=$pm_repo
if [[ ${SAVE_REPO_ONLY:-0} == 1 && ${SAVED[pm_repo]:-} != "$pm_repo" ]]; then
  if [[ -f $DEFAULTS_FILE ]]; then
    grep -v '^pm_repo=' "$DEFAULTS_FILE" >"$DEFAULTS_FILE.tmp" || true
    mv "$DEFAULTS_FILE.tmp" "$DEFAULTS_FILE"
  else
    mkdir -p "$(dirname "$DEFAULTS_FILE")"
  fi
  printf 'pm_repo="%s"
' "$pm_repo" >>"$DEFAULTS_FILE"
  chmod 600 "$DEFAULTS_FILE"
fi
[[ -n $var_container_storage && -n $var_template_storage ]] || { msg_error "no storage found for containers or templates"; exit 1; }
if pct status "$CTID" >/dev/null 2>&1; then msg_error "container $CTID already exists"; exit 1; fi
[[ $pm_http_port =~ ^[0-9]+$ ]] || { msg_error "web port must be a number"; exit 1; }

# ---- create the container -------------------------------------------------------------
msg_info "Finding the Debian template"
pveam update >/dev/null 2>&1 || true
TEMPLATE=$(pveam available --section system | awk '{print $2}' | grep -E '^debian-1[2-9]-standard' | sort -V | tail -1 || true)
[[ -n $TEMPLATE ]] || { msg_error "no Debian template available from pveam"; exit 1; }
if ! pveam list "$var_template_storage" | grep -q "$TEMPLATE"; then
  pveam download "$var_template_storage" "$TEMPLATE" >/dev/null
fi
msg_ok "Template $TEMPLATE"

msg_info "Creating container $CTID"
GW_OPT=""
[[ $var_net != dhcp && -n $var_gateway ]] && GW_OPT=",gw=$var_gateway"
# nesting: systemd's service sandboxing inside an unprivileged LXC.
pct create "$CTID" "$var_template_storage:vztmpl/$TEMPLATE" \
  --hostname "$var_hostname" \
  --cores "$var_cpu" --memory "$var_ram" --swap 1024 \
  --rootfs "$var_container_storage:$var_disk" \
  --net0 "name=eth0,bridge=$var_brg,ip=$var_net$GW_OPT" \
  --unprivileged 1 --features nesting=1 \
  --onboot 1 --timezone host --tags packing-master \
  --description "packing-master: https://github.com/$REPO" >/dev/null
CREATED_CTID=$CTID
pct start "$CTID"
msg_ok "Created container $CTID"

msg_info "Waiting for the network"
for _ in $(seq 1 30); do
  pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break
  sleep 2
done
pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 || { msg_error "container $CTID has no network/DNS"; ct_note; exit 1; }
msg_ok "Network is up"

LOG=/tmp/packing-master-install-$CTID.log
msg_info "Installing git"
pct exec "$CTID" -- bash -c "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl ca-certificates openssh-client" >"$LOG" 2>&1
msg_ok "git installed"

# ---- repository access ------------------------------------------------------------------
REPO_URL="https://github.com/$REPO.git"
if ! pct exec "$CTID" -- env GIT_TERMINAL_PROMPT=0 git ls-remote "$REPO_URL" >/dev/null 2>&1; then
  REPO_URL="git@github.com:$REPO.git"
  pct exec "$CTID" -- bash -c '
    install -d -m 700 /root/.ssh
    [[ -f /root/.ssh/packing-master_deploy ]] || ssh-keygen -q -t ed25519 -N "" -C "packing-master@$(hostname)" -f /root/.ssh/packing-master_deploy
    ssh-keyscan -t ed25519 github.com >>/root/.ssh/known_hosts 2>/dev/null'
  PUBKEY=$(pct exec "$CTID" -- cat /root/.ssh/packing-master_deploy.pub)
  key_works() {
    pct exec "$CTID" -- env GIT_SSH_COMMAND="ssh -i /root/.ssh/packing-master_deploy -o IdentitiesOnly=yes" \
      git ls-remote "$REPO_URL" >/dev/null 2>&1
  }
  ADD_KEY_TEXT="The repository is private. Add this read-only deploy key on GitHub:
https://github.com/$REPO/settings/keys/new   (title: $var_hostname, leave 'Allow write access' OFF)

$PUBKEY"
  echo
  echo "$ADD_KEY_TEXT"
  echo
  until key_works; do
    if [[ $INTERACTIVE -eq 1 ]]; then
      whiptail --backtitle "$BACKTITLE" --title "GitHub deploy key" --yes-button "I added it" --no-button "Cancel" \
        --yesno "$ADD_KEY_TEXT\n\n(The key is also printed in the terminal, for copying.)" 18 100 || cancelled
    else
      echo "waiting for the deploy key to be added…"
      sleep 15
    fi
  done
  msg_ok "GitHub deploy key works"
fi

msg_info "Installing (a few minutes: Node.js, MariaDB, then building the app)"
if ! pct exec "$CTID" -- env REPO_URL="$REPO_URL" BRANCH="$BRANCH" HTTP_PORT="$pm_http_port" bash -c '
    set -e
    if [[ -f /root/.ssh/packing-master_deploy ]]; then
      export GIT_SSH_COMMAND="ssh -i /root/.ssh/packing-master_deploy -o IdentitiesOnly=yes"
    fi
    [[ -d /opt/packing-master/.git ]] || git clone --quiet --branch "$BRANCH" "$REPO_URL" /opt/packing-master
    bash /opt/packing-master/proxmox/install.sh' >>"$LOG" 2>&1; then
  msg_error "installation failed; the last lines of $LOG:"
  tail -25 "$LOG" >&2
  ct_note
  exit 1
fi
msg_ok "Installed"

IP=$(pct exec "$CTID" -- hostname -I | awk '{print $1}')
PORT_SUFFIX=""
[[ $pm_http_port == 80 ]] || PORT_SUFFIX=":$pm_http_port"
echo
msg_ok "$APP is running in container $CTID"
echo "   ${BL}Web app:${CL}  ${GN}http://$IP$PORT_SUFFIX${CL}   (LAN only, no password)"
echo "   ${BL}Restore:${CL}  Settings → Backups → upload a backup made on your dev machine"
echo "   ${BL}AI API:${CL}   http://$IP$PORT_SUFFIX/llms.txt"
echo "   ${BL}Logs:${CL}     pct exec $CTID -- journalctl -u packing-master -f"
echo "   ${BL}Update:${CL}   the Update button in Settings, or: pct exec $CTID -- update"
