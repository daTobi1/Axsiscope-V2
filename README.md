# Axiscope – Global Master Calibration System

Professional multi-tool calibration framework for Klipper toolchanger systems.

---

## 🚀 Core Features

- Global Master Tool architecture (X/Y/Z reference)
- Dynamic Capture UI per Master
- Relative XY offset transformation
- Robust Z referencing with fallback logic
- Median / Average / Trimmed Z calculation
- Toolchanger-safe workflow
- Backend reference validation
- Select-All calibration logic (Master protected)

---

## 🎯 Master Tool Logic

Default behavior:

- If T0 exists → Master = T0
- Else → Master = smallest available tool

Master responsibilities:
- Reference for Z offsets
- Reference for XY offset display
- Only tool allowed to Capture position

---

## 🔬 Z Offset Calculation

z_offset = z_trigger_tool - z_trigger_master

Master always receives:
z_offset = 0.000

---

## 📐 XY Offset Calculation

RAW_offset = (captured - current_offset) - typed_position
DISPLAY_offset = RAW_tool - RAW_master

Master always displays:
X = 0
Y = 0

---

## 📦 Documentation

See `/docs` folder for:

- Configuration Reference
- Upgrade Guide
- Developer Architecture
- Troubleshooting
- FAQ
- Release Notes

---
## 📦 Installation

curl -sSL https://raw.githubusercontent.com/daTobi1/Axsiscope-V2/main/install.sh | bash


Generated: 2026-02-14 19:40
