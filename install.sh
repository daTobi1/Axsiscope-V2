#!/usr/bin/env bash
set -euo pipefail

# ==========================
# Axiscope-V2 Installer
# ==========================

AXISCOPE_ENV="axiscope-env"
INSTALL_DIR="${HOME}/axiscope"
REPO_URL="https://github.com/daTobi1/Axsiscope-V2.git"
BRANCH="main"

SERVICE_NAME="axiscope.service"
SERVICE_FILE="${INSTALL_DIR}/axiscope.service"

MOONRAKER_CONF="${HOME}/printer_data/config/moonraker.conf"
MOONRAKER_ASVC="${HOME}/printer_data/moonraker.asvc"

KLIPPER_EXTRAS="${HOME}/klipper/klippy/extras"
AXISCOPE_EXTRAS_SRC="${INSTALL_DIR}/klippy/extras/axiscope.py"
AXISCOPE_EXTRAS_DST="${KLIPPER_EXTRAS}/axiscope.py"

usage() {
  cat <<EOF
Usage: install.sh [--branch <name>]

Options:
  --branch <name>   Git branch to install (default: main)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown parameter: $1"; usage; exit 1 ;;
  esac
done

if [[ "${EUID}" -eq 0 ]]; then
  echo "Please do not run as root/sudo. The script will ask for sudo when needed."
  exit 1
fi

echo "Installing Axiscope-V2..."
echo "  REPO  : ${REPO_URL}"
echo "  BRANCH: ${BRANCH}"
echo "  DIR   : ${INSTALL_DIR}"

cd "${HOME}"

# Backup existing installation
if [[ -d "${INSTALL_DIR}" ]]; then
  echo "Existing installation found at ${INSTALL_DIR}"
  echo "Backing up to ${INSTALL_DIR}.bak"
  rm -rf "${INSTALL_DIR}.bak" || true
  mv "${INSTALL_DIR}" "${INSTALL_DIR}.bak"
fi

# Clone repository
echo "Cloning repository..."
git clone -b "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"

# Ensure python3-venv
echo "Checking for python3-venv..."
if ! dpkg -l | grep -q "python3-venv"; then
  echo "python3-venv not found. Installing..."
  sudo apt-get update
  sudo apt-get install -y python3-venv
else
  echo "python3-venv is already installed."
fi

# Create venv
echo "Creating virtual environment..."
python3 -m venv "${INSTALL_DIR}/${AXISCOPE_ENV}"

if [[ ! -f "${INSTALL_DIR}/${AXISCOPE_ENV}/bin/activate" ]]; then
  echo "ERROR: venv activation file missing."
  exit 1
fi

# Activate venv
# shellcheck disable=SC1090
source "${INSTALL_DIR}/${AXISCOPE_ENV}/bin/activate"

# Install deps
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install flask waitress

# Create systemd service
echo "Creating systemd service file..."
cat > "${SERVICE_FILE}" <<EOL
[Unit]
Description=Axiscope - Tool Alignment Interface for Klipper
After=network.target moonraker.service
StartLimitIntervalSec=0

[Service]
Type=simple
User=${USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/${AXISCOPE_ENV}/bin/python3 -m flask run --host=0.0.0.0 --port=3000
Environment="PATH=${INSTALL_DIR}/${AXISCOPE_ENV}/bin"
Environment="FLASK_APP=app.py"
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
EOL

echo "Installing service into /etc/systemd/system/..."
sudo cp "${SERVICE_FILE}" "/etc/systemd/system/${SERVICE_NAME}"
sudo systemctl daemon-reload

# Allow service in Moonraker
echo "Adding axiscope to moonraker.asvc..."
mkdir -p "$(dirname "${MOONRAKER_ASVC}")"
touch "${MOONRAKER_ASVC}"
if ! grep -q "^axiscope$" "${MOONRAKER_ASVC}"; then
  echo "axiscope" >> "${MOONRAKER_ASVC}"
fi

# Add update_manager entry
echo "Adding update_manager config to moonraker.conf..."
if [[ -f "${MOONRAKER_CONF}" ]]; then
  if ! grep -q "^\[update_manager axiscope\]" "${MOONRAKER_CONF}"; then
    cat >> "${MOONRAKER_CONF}" <<EOL

[update_manager axiscope]
type: git_repo
path: ${INSTALL_DIR}
origin: ${REPO_URL}
primary_branch: ${BRANCH}
is_system_service: True
managed_services: axiscope
EOL
  else
    echo "update_manager axiscope already exists in moonraker.conf (leaving as is)."
  fi
else
  echo "WARNING: moonraker.conf not found at ${MOONRAKER_CONF} (skipping update_manager)."
fi

# Enable service (start optional)
echo "Enabling axiscope service..."
sudo systemctl enable "${SERVICE_NAME}"
# sudo systemctl start "${SERVICE_NAME}"

echo "Restarting moonraker..."
sudo systemctl restart moonraker

# Link axiscope.py into Klipper extras
echo "Linking axiscope.py into Klipper extras..."
if [[ ! -d "${KLIPPER_EXTRAS}" ]]; then
  echo "WARNING: Klipper extras dir not found at ${KLIPPER_EXTRAS}. Skipping symlink."
else
  if [[ ! -f "${AXISCOPE_EXTRAS_SRC}" ]]; then
    echo "WARNING: axiscope.py not found at ${AXISCOPE_EXTRAS_SRC}. Skipping symlink."
  else
    sudo ln -sf "${AXISCOPE_EXTRAS_SRC}" "${AXISCOPE_EXTRAS_DST}"
    echo "Restarting klipper..."
    sudo systemctl restart klipper
  fi
fi

PRINTER_IP="$(hostname -I | awk '{print $1}')"
echo ""
echo "✅ Installation complete!"
echo "Open: http://${PRINTER_IP}:3000"
echo "Service: ${SERVICE_NAME} (controlled via Mainsail/Fluidd host services)"
