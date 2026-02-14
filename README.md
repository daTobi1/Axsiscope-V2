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

Quick installation using curl:

```bash
curl -sSL https://raw.githubusercontent.com/daTobi1/Axsiscope-V2/main/install.sh | bash
```

The install script will:

- Create Python virtual environment
- Install required dependencies
- Set up the systemd service
- Configure Moonraker integration

🗑️ Uninstallation

Quick uninstall using curl:

```bash
curl -sSL https://raw.githubusercontent.com/daTobi1/Axsiscope-V2/main/uninstall.sh | bash
```

The uninstall script will:

- Stop and disable the Axiscope systemd service
- Remove the service file
- Remove the Axiscope installation directory
- Remove Moonraker service registration (moonraker.asvc)
- Remove the [update_manager axiscope] section from moonraker.conf
- Remove the Klipper extras symlink
- Restart Moonraker and Klipper

## Configuration

If you want to use automatic Z calibration, add the following to your `printer.cfg`:

```ini
[axiscope]

# -------------------------------------------------
# Web Interface
# -------------------------------------------------
# http://your-printer-ip:3000
# Example: http://192.168.178.60:3000/

# -------------------------------------------------
# Probe / Z-Switch
# -------------------------------------------------
pin: PG10                      # Endstop pin

# Z-switch trigger position (XY)
zswitch_x_pos: 31.35
zswitch_y_pos: -4.61

# Z height at which the switch triggers
zswitch_z_pos: 3.0             # previously: 1.83

# -------------------------------------------------
# Safety / Motion Settings
# -------------------------------------------------
# Lift above trigger height before every probe
# Start-Z = max(zswitch_z_pos + lift_z, safe_start_z)
lift_z: 5.0

# Absolute minimum start Z height
safe_start_z: 7.0

# Movement speeds (conservative = less bouncing)
move_speed: 80
z_move_speed: 6

# -------------------------------------------------
# Sampling / Accuracy
# -------------------------------------------------
# Target number of samples per batch
samples: 5 #If us trimmed this count must be minimum 5

# Maximum allowed deviation within a batch (mm)
samples_tolerance: 0.005

# Maximum attempts if tolerance is not reached immediately
samples_max_count: 20

# Z-offset calculation method per sample batch:
#   median   = robust against outliers (recommended)
#   average  = mean value (smoother, but sensitive to outliers)
#   trimmed  = trimmed mean (removes extreme values on both ends)
z_calc_method: trimmed

# For "trimmed" mode: number of values removed per side
z_trim_count: 1

# -------------------------------------------------
# Recovery against "Probe triggered prior to movement"
# -------------------------------------------------
# Additional Z lift between EACH sample
recover_lift_mm: 3.0

# Short pause after recovery lift (ms)
recover_pause_ms: 150

# Maximum recovery attempts per sample
recover_max_attempts: 4

# -------------------------------------------------
# Macros (executed with context)
# -------------------------------------------------
start_gcode:
  M118 Starting calibration
  G28
  QUAD_GANTRY_LEVEL
  G28 Z
  #CLEAN_NOZZLE

before_pickup_gcode:
  M118 Before pickup

after_pickup_gcode:
  M118 After pickup
  #CLEAN_NOZZLE

finish_gcode:
  M118 Calibration complete

```

### Finding the Endstop Position

To correctly configure the endstop position for Z calibration:

1. Home your printer with T0 selected
2. Using the jog controls in your printer interface, carefully position the nozzle directly centered over the endstop pin
3. Note the current X, Y, and Z positions displayed in your interface
4. Use these values for `zswitch_x_pos` and `zswitch_y_pos` in your configuration
5. For `zswitch_z_pos`, add 3mm to your current Z position (If using multiple hotends of varying lengths, add additional clearance as needed.)

Example: If your position readings are X:226.71, Y:-18.46, Z:4.8, then configure:
```
zswitch_x_pos: 226.71
zswitch_y_pos: -18.46
zswitch_z_pos: 7.8  # 4.8 + 3mm clearance
```

### G-code Macro Options

Axiscope now supports templated G-code macros with full Jinja template support.

- **start_gcode**: Executed at the beginning of calibration
- **before_pickup_gcode**: Executed before each tool change
- **after_pickup_gcode**: Executed after each tool change
- **finish_gcode**: Executed after calibration is complete

Generated: 2026-02-14 19:40
