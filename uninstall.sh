#!/usr/bin/env bash
set -euo pipefail

# ==========================
# Axiscope-V2 Uninstaller
# ==========================

INSTALL_DIR="${HOME}/axiscope"
SERVICE_NAME="axiscope.service"

MOONRAKER_CONF="${HOME}/printer_data/config/moonraker.conf"
MOONRAKER_ASVC="${HOME}/printer_data/moonraker.asvc"

KLIPPER_EXTRAS="${HOME}/klipper/klippy/extras"
AXISCOPE_EXTRAS_DST="${KLIPPER_EXTRAS}/axiscope.py"

echo "Uninstalling Axiscope..."

# Stop/disable service
echo "Stopping and disabling service..."
sudo systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
sudo systemctl disable "${SERVICE_NAME}" 2>/dev/null || true

# Remove service file
echo "Removing systemd service..."
sudo rm -f "/etc/systemd/system/${SERVICE_NAME}"
sudo systemctl daemon-reload

# Remove from moonraker.asvc
if [[ -f "${MOONRAKER_ASVC}" ]]; then
  echo "Removing axiscope from moonraker.asvc..."
  sed -i '/^axiscope$/d' "${MOONRAKER_ASVC}"
fi

# Remove update_manager block (from [update_manager axiscope] until next [section] or EOF)
if [[ -f "${MOONRAKER_CONF}" ]]; then
  echo "Removing [update_manager axiscope] block from moonraker.conf..."
  awk '
    BEGIN{skip=0}
    /^\[update_manager axiscope\]/{skip=1; next}
    /^\[.*\]/{if(skip==1){skip=0}}
    skip==0{print}
  ' "${MOONRAKER_CONF}" > "${MOONRAKER_CONF}.tmp"
  mv "${MOONRAKER_CONF}.tmp" "${MOONRAKER_CONF}"
fi

# Remove Klipper extras symlink/file (only if it is a symlink)
echo "Removing Klipper extras link..."
if [[ -L "${AXISCOPE_EXTRAS_DST}" ]]; then
  sudo rm -f "${AXISCOPE_EXTRAS_DST}"
fi

# Remove installation directory
if [[ -d "${INSTALL_DIR}" ]]; then
  echo "Removing install directory: ${INSTALL_DIR}"
  rm -rf "${INSTALL_DIR}"
fi

# Optional: remove backup
if [[ -d "${INSTALL_DIR}.bak" ]]; then
  read -r -p "Backup directory found at ${INSTALL_DIR}.bak. Remove it? (y/N) " reply
  if [[ "${reply}" =~ ^[Yy]$ ]]; then
    rm -rf "${INSTALL_DIR}.bak"
  fi
fi

echo "Restarting moonraker + klipper..."
sudo systemctl restart moonraker || true
sudo systemctl restart klipper || true

echo "✅ Axiscope uninstalled."
