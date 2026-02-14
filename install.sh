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

if [[ "${EUID}" -eq 0 ]]; then
  echo "Do NOT run as root. Script will request sudo when needed."
  exit 1
fi

echo "Installing Axiscope-V2..."
echo "Repository : ${REPO_URL}"
echo "Branch     : ${BRANCH}"
echo "Install dir: ${INSTALL_DIR}"

# Clean old installation if present
if [[ -d "${INSTALL_DIR}" ]]; then
  echo "Removing existing installation..."
  rm -rf "${INSTALL_DIR}"
fi

echo "Cloning repository..."
git clone -b "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"

cd "${INSTALL_DIR}"

echo "Ensuring python3-venv is installed..."
if ! dpkg -l | grep -q python3-venv; then
  sudo apt-get update
  sudo apt-get install -y python3-venv
fi

echo "Creating virtual environment (robust mode)..."
python3 -m venv --copies "${AXISCOPE_ENV}"

if [[ ! -f "${AXISCOPE_ENV}/bin/activate" ]]; then
  echo "ERROR: Failed to create virtual environment."
  exit 1
fi

# shellcheck disable=SC1090
source "${AXISCOPE_ENV}/bin/activate"

echo "Installing Python dependencies..."
python -m pip install --upgrade pip
python -m pip install flask waitress

deactivate

echo "Creating systemd service..."
cat > "${SERVICE_FILE}" <<EOL
[Unit]
Description=Axiscope - Tool Alignment Interface for Klipper
After=network.target moonraker.service

[Service]
Type=simple
User=${USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/${AXISCOPE_ENV}/bin/python3 -m flask run --host=0.0.0.0 --port=3000
Environment="PATH=${INSTALL_DIR}/${AXISCOPE_ENV}/bin"
Environment="FLASK_APP=app.py"
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOL

sudo cp "${SERVICE_FILE}" "/etc/systemd/system/${SERVICE_NAME}"
sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"

echo "Registering service in moonraker.asvc..."
mkdir -p "$(dirname "${MOONRAKER_ASVC}")"
touch "${MOONRAKER_ASVC}"
grep -qxF "axiscope" "${MOONRAKER_ASVC}" || echo "axiscope" >> "${MOONRAKER_ASVC}"

echo "Adding update_manager block..."
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
  fi
fi

echo "Linking axiscope.py into Klipper..."
if [[ -d "${KLIPPER_EXTRAS}" && -f "${AXISCOPE_EXTRAS_SRC}" ]]; then
  sudo ln -sf "${AXISCOPE_EXTRAS_SRC}" "${AXISCOPE_EXTRAS_DST}"
fi

echo "Restarting services..."
sudo systemctl restart moonraker
sudo systemctl restart klipper

PRINTER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ Axiscope installed successfully!"
echo "Open in browser:"
echo "http://${PRINTER_IP}:3000"
echo ""
echo "Service name: ${SERVICE_NAME}"
