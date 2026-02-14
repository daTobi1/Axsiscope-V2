/* =========================================================
   Axiscope tools.js (Global Master + Master Capture moves)
   - Uses printerIp from index.js
   - UI:
       Tools list:
         - Master tool row shows CAPTURE + Captured Position panel
         - Non-master rows show XY inputs + offsets panel
       Calibration UI:
         Box 1: Tools to calibrate (Select All default ON)
         Box 2: Reference (Master) tool (single select, default T0 if exists else min tool)
         Z calc dropdown
   - Global Master behavior:
       - X/Y "New" values are displayed relative to selected master (master => 0)
       - CAPTURE UI is displayed on the master row (moves with master selection)
   ========================================================= */

// --------------------------
// Global state
// --------------------------
let axiscopeMasterTool = null; // remembers user selection across rerenders (null => auto default)

// --------------------------
// Templates
// --------------------------

// Master row: shows CAPTURE + Captured Position
const masterToolItem = ({tool_number, disabled, tc_disabled}) => `
<li class="list-group-item bg-body-tertiary p-2">
  <div class="container">
    <div class="row">
      <div class="col-2">
        <button 
          type="button"
          class="btn btn-secondary btn-sm w-100 h-100 ${tc_disabled}"
          id="toolchange"
          name="T${tool_number}"
          data-tool="${tool_number}"
        >
          <h1>T${tool_number}</h1>
        </button>
      </div>

      <div class="col-6">
        <div class="border border-secondary-subtle rounded p-2 bg-dark h-100 d-flex flex-column justify-content-center">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fs-6">Master Capture</span>
            <small class="text-secondary" id="master-status-badge">Master: T${tool_number}</small>
          </div>
          <button 
            type="button" 
            class="btn btn-sm btn-secondary fs-6 border text-center w-100 ${disabled}" 
            style="padding-bottom:10px; padding-top:10px;" 
            id="capture-pos"
          >
            CAPTURE <br/> CURRENT <br/> POSITION
          </button>
          <small class="text-secondary mt-2">
            Tip: switch to Master tool first (tool must be active).
          </small>
        </div>
      </div>

      <div class="col-4">
        <div class="border border-secondary-subtle rounded p-2 bg-dark h-100">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fs-6">Captured Position</span>
          </div>

          <div class="row">
            <div class="col-4"><small>X:</small></div>
            <div class="col-8 text-end"><span id="captured-x"><small></small></span></div>
          </div>
          <div class="row">
            <div class="col-4"><small>Y:</small></div>
            <div class="col-8 text-end"><span id="captured-y"><small></small></span></div>
          </div>
          <div class="row">
            <div class="col-4"><small>Z:</small></div>
            <div class="col-8 text-end"><span id="captured-z"><small></small></span></div>
          </div>

          <hr class="my-2"/>

          <div class="row">
            <div class="col-6"><small>Z-Trigger:</small></div>
            <div class="col-6 text-end"><span id="T${tool_number}-z-trigger"><small>-</small></span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</li>
`;

// Non-master row: XY input + offsets panel
const nonMasterToolItem = ({tool_number, cx_offset, cy_offset, disabled, tc_disabled}) => `
<li class="list-group-item bg-body-tertiary p-2">
  <div class="container">
    <div class="row">

      <div class="col-2">
        <button 
          type="button"
          class="btn btn-secondary btn-sm w-100 h-100 ${tc_disabled}"
          id="toolchange"
          name="T${tool_number}"
          data-tool="${tool_number}"
        >
          <h1>T${tool_number}</h1>
        </button>
      </div>

      <div class="col-6">

        <div class="row pb-3">
          <div class="input-group ps-1 pe-1">
            <button class="btn btn-secondary ${disabled}" type="button" id="T${tool_number}-fetch-x" data-axis="x" data-tool="${tool_number}">X</button>
            <input type="number" name="T${tool_number}-x-pos"
                   class="form-control"
                   placeholder="0.0"
                   data-axis="x"
                   data-tool="${tool_number}"
                   ${disabled}>
          </div>
        </div>

        <div class="row">
          <div class="input-group ps-1 pe-1">
            <button class="btn btn-secondary ${disabled}" type="button" id="T${tool_number}-fetch-y" data-axis="y" data-tool="${tool_number}">Y</button>
            <input type="number" name="T${tool_number}-y-pos"
                   class="form-control"
                   placeholder="0.0"
                   data-axis="y"
                   data-tool="${tool_number}"
                   ${disabled}>
          </div>
        </div>

      </div>

      <div class="col-4 border rounded bg-dark">
        <div class="row">
          <div class="col-6 pt-2 pb-2">
            <div class="row pb-1">
              <span class="fs-6 lh-sm text-secondary"><small>Current X</small></span>
              <span class="fs-5 lh-sm text-secondary" id="T${tool_number}-x-offset"><small>${cx_offset}</small></span>
            </div>
            <div class="row">
              <span class="fs-6 lh-sm text-secondary"><small>Current Y</small></span>
              <span class="fs-5 lh-sm text-secondary" id="T${tool_number}-y-offset"><small>${cy_offset}</small></span>
            </div>

            <div class="z-fields d-none mt-2">
              <div class="row">
                <span class="fs-6 lh-sm text-secondary"><small>Z-Trigger</small></span>
                <span class="fs-5 lh-sm text-secondary" id="T${tool_number}-z-trigger"><small>-</small></span>
              </div>
            </div>
          </div>

          <div class="col-6 pt-2 pb-2">
            <div class="row pb-1">
              <span class="fs-6 lh-sm"><small>New X</small></span>
              <span class="fs-5 lh-sm" id="T${tool_number}-x-new" data-raw="0.000"><small>0.0</small></span>
            </div>
            <div class="row pb-1">
              <span class="fs-6 lh-sm"><small>New Y</small></span>
              <span class="fs-5 lh-sm" id="T${tool_number}-y-new" data-raw="0.000"><small>0.0</small></span>
            </div>
            <div class="row pb-1">
              <span class="fs-6 lh-sm"><small>New Z</small></span>
              <span class="fs-5 lh-sm" id="T${tool_number}-z-new"><small>0.0</small></span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</li>
`;

// --------------------------
// Helpers
// --------------------------
function printerUrl(ip, path) {
  return `http://${ip}${path}`;
}

function computeDefaultRef(toolNumbers) {
  const sorted = [...toolNumbers].sort((a, b) => a - b);
  if (axiscopeMasterTool !== null && sorted.includes(axiscopeMasterTool)) return axiscopeMasterTool;
  if (sorted.includes(0)) return 0;
  return sorted.length ? sorted[0] : 0;
}

function getSelectedReferenceTool(fallback = 0) {
  // From DOM if present
  const $checked = $(".calibrate-ref-checkbox:checked").first();
  if ($checked.length) {
    const v = parseInt($checked.val(), 10);
    return Number.isNaN(v) ? fallback : v;
  }

  // Otherwise from remembered state
  if (axiscopeMasterTool !== null) return axiscopeMasterTool;
  return fallback;
}

function syncSelectAllState() {
  const $all = $(".calibrate-tool-checkbox");
  const $checked = $(".calibrate-tool-checkbox:checked");
  if ($all.length === 0) {
    $("#calibrate-select-all").prop("checked", false);
    return;
  }
  $("#calibrate-select-all").prop("checked", $checked.length === $all.length);
}

// --------------------------
// Global Master for XY (display)
// --------------------------
function applyMasterReferenceXY(axis) {
  const master = getSelectedReferenceTool(0);
  const $masterEl = $(`#T${master}-${axis}-new`);
  const masterRaw = parseFloat($masterEl.attr("data-raw")) || 0.0;

  $('button#toolchange').each(function(){
    const tool = $(this).data("tool");
    const $el = $(`#T${tool}-${axis}-new`);
    if (!$el.length) return; // master row doesn't have these fields

    const raw = parseFloat($el.attr("data-raw")) || 0.0;
    let rel = raw - masterRaw;
    if (parseInt(tool, 10) === parseInt(master, 10)) rel = 0.0;

    $el.find('>:first-child').text(rel.toFixed(3));
  });
}

// --------------------------
// Probe results (Z)
// --------------------------
function getProbeResults() {
  return $.get(printerUrl(printerIp, "/printer/objects/query?axiscope"))
    .then(function(data){
      return data?.result?.status?.axiscope?.probe_results || {};
    })
    .catch(function(err){
      console.error("Probe result fetch failed:", err);
      return {};
    });
}

function updateProbeResults(tool, probeResults) {
  if (probeResults[tool]) {
    const result = probeResults[tool];
    if (typeof result.z_trigger === "number") {
      $(`#T${tool}-z-trigger small`).text(result.z_trigger.toFixed(3));
    }
    if (typeof result.z_offset === "number") {
      $(`#T${tool}-z-new small`).text(result.z_offset.toFixed(3));
    }
  }
}

function startProbeResultsUpdates() {
  updateAllProbeResults();
  setInterval(updateAllProbeResults, 2000);
}

function updateAllProbeResults() {
  getProbeResults().then(function(probeResults) {
    $('button#toolchange').each(function(){
      const tool = $(this).data("tool");
      updateProbeResults(tool, probeResults);
    });
  });
}

// --------------------------
// Calibration UI
// --------------------------
function calibrateButton(toolNumbers = [], enabled = false) {
  const sortedTools = [...toolNumbers].sort((a, b) => a - b);
  const defaultRef = computeDefaultRef(sortedTools);

  const toolsToCalibrateMarkup = sortedTools.map((tool) => `
    <div class="form-check form-check-inline me-3 mb-1">
      <input class="form-check-input calibrate-tool-checkbox"
             type="checkbox"
             id="calibrate-tool-${tool}"
             value="${tool}"
             checked>
      <label class="form-check-label" for="calibrate-tool-${tool}">T${tool}</label>
    </div>
  `).join('');

  const referenceMarkup = sortedTools.map((tool) => `
    <div class="form-check form-check-inline me-3 mb-1">
      <input class="form-check-input calibrate-ref-checkbox"
             type="checkbox"
             id="calibrate-ref-${tool}"
             value="${tool}"
             ${tool === defaultRef ? 'checked' : ''}>
      <label class="form-check-label" for="calibrate-ref-${tool}">T${tool}</label>
    </div>
  `).join('');

  const buttonClass = enabled ? "btn-primary" : "btn-secondary";
  const disabledAttr = enabled ? "" : "disabled";

  return `
<li class="list-group-item bg-body-tertiary p-2">
  <div class="container">

    <div class="row pb-2">
      <div class="col-12">
        <div class="border border-secondary-subtle rounded p-2 bg-dark">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fs-6">Tools to calibrate</span>
            <div class="form-check mb-0">
              <input class="form-check-input" type="checkbox" id="calibrate-select-all" checked>
              <label class="form-check-label" for="calibrate-select-all">
                <small class="text-secondary">Select all</small>
              </label>
            </div>
          </div>
          <div>${toolsToCalibrateMarkup}</div>
        </div>
      </div>
    </div>

    <div class="row pb-2">
      <div class="col-12">
        <div class="border border-secondary-subtle rounded p-2 bg-dark">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="fs-6">Reference (Master) tool</span>
            <small class="text-secondary">Default: ${defaultRef === 0 ? 'T0' : `T${defaultRef}`}</small>
          </div>
          <div>${referenceMarkup}</div>
        </div>
      </div>
    </div>

    <div class="row pb-2">
      <div class="col-12">
        <div class="border border-secondary-subtle rounded p-2 bg-dark">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="fs-6">Z calculation</span>
            <small class="text-secondary">Applied per tool trigger batch</small>
          </div>
          <select id="z-calc-method" class="form-select form-select-sm w-auto d-inline-block">
            <option value="median" selected>Median</option>
            <option value="average">Average</option>
            <option value="trimmed">Trimmed mean</option>
          </select>
        </div>
      </div>
    </div>

    <div class="row">
      <div class="col-12">
        <button class="btn ${buttonClass} w-100"
                id="calibrate-all-btn"
                onclick="calibrateAllTools()"
                ${disabledAttr}>
          CALIBRATE Z-OFFSETS
        </button>
      </div>
    </div>

  </div>
</li>`;
}

function calibrateAllTools() {
  const selectedTools = $(".calibrate-tool-checkbox:checked")
    .map(function(){ return parseInt(this.value, 10); })
    .get()
    .filter(v => !Number.isNaN(v));

  const refTool = getSelectedReferenceTool(0);

  if (!selectedTools.includes(refTool)) selectedTools.unshift(refTool);

  const method = $("#z-calc-method").val() || "median";

  const url = printerUrl(printerIp,
    `/printer/gcode/script?script=CALIBRATE_ALL_Z_OFFSETS TOOLS=${selectedTools.join(",")} Z_CALC=${method} REF=${refTool}`
  );

  $.get(url)
    .done(function(){
      console.log("Started calibration:", selectedTools, "ref:", refTool, "method:", method);
    })
    .fail(function(err){
      console.error("Calibration failed:", err);
    });
}

// --------------------------
// UI event handlers (Select All, Reference change)
// --------------------------
$(document).on("change", "#calibrate-select-all", function () {
  const checked = $(this).is(":checked");
  $(".calibrate-tool-checkbox").prop("checked", checked);

  // Always include reference tool
  const refTool = getSelectedReferenceTool(0);
  $(`#calibrate-tool-${refTool}`).prop("checked", true);

  syncSelectAllState();
});

$(document).on("change", ".calibrate-tool-checkbox", function () {
  const refTool = getSelectedReferenceTool(0);
  $(`#calibrate-tool-${refTool}`).prop("checked", true);
  syncSelectAllState();
});

$(document).on("change", ".calibrate-ref-checkbox", function () {
  // single-select
  $(".calibrate-ref-checkbox").not(this).prop("checked", false);
  $(this).prop("checked", true);

  const refVal = parseInt($(this).val(), 10);
  if (!Number.isNaN(refVal)) axiscopeMasterTool = refVal;

  // make sure ref is included
  $(`#calibrate-tool-${refVal}`).prop("checked", true);

  // IMPORTANT: rerender tools so CAPTURE + Captured Position moves to master row
  getTools();
});

// --------------------------
// Tool change URL
// --------------------------
function toolChangeURL(tool) {
  // If no captured values yet, just toolchange sequence
  var x_pos = $("#captured-x").find(":first-child").text();
  var y_pos = $("#captured-y").find(":first-child").text();
  var z_pos = $("#captured-z").find(":first-child").text();

  x_pos = parseFloat(x_pos);
  y_pos = parseFloat(y_pos);
  z_pos = parseFloat(z_pos);

  if (isNaN(x_pos) || isNaN(y_pos) || isNaN(z_pos)) {
    var url = printerUrl(printerIp, "/printer/gcode/script?script=AXISCOPE_BEFORE_PICKUP_GCODE");
    url = url + "%0AT" + tool;
    url = url + "%0AAXISCOPE_AFTER_PICKUP_GCODE";
    return url;
  }

  // Non-master can override by typed input
  const master = getSelectedReferenceTool(0);
  if (String(tool) !== String(master)) {
    var tool_x = parseFloat($("input[name=T"+tool+"-x-pos]").val()) || 0.0;
    var tool_y = parseFloat($("input[name=T"+tool+"-y-pos]").val()) || 0.0;
    if (tool_x !== 0.0 && tool_y !== 0.0) {
      x_pos = tool_x;
      y_pos = tool_y;
    }
  }

  x_pos = x_pos.toFixed(3);
  y_pos = y_pos.toFixed(3);
  z_pos = z_pos.toFixed(3);

  var url = printerUrl(printerIp, "/printer/gcode/script?script=AXISCOPE_BEFORE_PICKUP_GCODE");
  url = url + "%0AT" + tool;
  url = url + "%0AAXISCOPE_AFTER_PICKUP_GCODE";
  url = url + "%0ASAVE_GCODE_STATE NAME=RESTORE_POS";
  url = url + "%0AG90";
  url = url + "%0AG0 Z" + z_pos + " F3000";
  url = url + "%0AG0 X" + x_pos + " Y" + y_pos + " F12000";
  url = url + "%0ARESTORE_GCODE_STATE NAME=RESTORE_POS";
  return url;
}

// --------------------------
// Tool list loader
// --------------------------
function getTools() {
  $.get(printerUrl(printerIp, "/printer/objects/query?toolchanger"))
    .done(function(data){

      const tool_names   = data.result.status.toolchanger.tool_names;
      const tool_numbers = data.result.status.toolchanger.tool_numbers;
      const active_tool  = data.result.status.toolchanger.tool_number;

      // Determine master tool (robust default)
      const master = computeDefaultRef(tool_numbers);

      // Build query for all tool objects
      let queryUrl = "/printer/objects/query?";
      tool_names.forEach(name => queryUrl += name + "&");
      queryUrl = queryUrl.slice(0,-1);

      $.get(printerUrl(printerIp, queryUrl))
        .done(function(toolData){

          $("#tool-list").html("");

          // Render tools: master row uses capture template, others normal
          tool_numbers.forEach(function(tool_number, i){
            const toolObj = toolData.result.status[tool_names[i]];
            const cx = toolObj.gcode_x_offset.toFixed(3);
            const cy = toolObj.gcode_y_offset.toFixed(3);

            const disabled = tool_number !== active_tool ? "disabled" : "";
            const tc_disabled = tool_number === active_tool ? "disabled" : "";

            if (tool_number === master) {
              $("#tool-list").append(
                masterToolItem({tool_number, disabled, tc_disabled})
              );
            } else {
              $("#tool-list").append(
                nonMasterToolItem({
                  tool_number,
                  cx_offset: cx,
                  cy_offset: cy,
                  disabled,
                  tc_disabled
                })
              );
            }
          });

          // Add calibration UI
          getProbeResults().then(function(results){
            const hasResults = Object.keys(results).length > 0;
            $("#tool-list").append(calibrateButton(tool_numbers, hasResults));

            // Ensure exactly one reference checked (master)
            $(".calibrate-ref-checkbox").prop("checked", false);
            $(`#calibrate-ref-${master}`).prop("checked", true);

            // Ensure master included in tools
            $(`#calibrate-tool-${master}`).prop("checked", true);
            syncSelectAllState();

            // Update badge in master row (if visible)
            $("#master-status-badge").text(`Master: T${master}`);

            // Show z-fields if axiscope present
            $.get(printerUrl(printerIp, "/printer/objects/query?axiscope"))
              .then(function(ax){
                const hasProbe = ax?.result?.status?.axiscope?.probe_results != null;
                if (hasProbe) $('.z-fields').removeClass('d-none');
              })
              .catch(()=>{});
          });

          // Refresh probe numbers
          updateAllProbeResults();
        });

    });
}

// --------------------------
// Offset calc (RAW -> master-referenced display)
// --------------------------
function updateOffset(tool, axis) {
  const $newEl = $(`#T${tool}-${axis}-new`);
  if (!$newEl.length) return; // master row doesn't have XY fields

  var position = parseFloat($("input[name=T"+tool+"-"+axis+"-pos]").val()) || 0.0;
  var capturedText = $("#captured-"+axis).find(":first-child").text();

  if (position !== 0.0 && capturedText !== "") {
    const captured_pos = parseFloat(capturedText);
    const old_offset = parseFloat($(`#T${tool}-${axis}-offset`).text());

    let new_offset = (captured_pos - old_offset) - position;

    // Preserve your previous sign-flip behavior
    if (new_offset < 0) new_offset = Math.abs(new_offset);
    else new_offset = -new_offset;

    const rawTxt = new_offset.toFixed(3);
    $newEl.attr("data-raw", rawTxt);
    $newEl.find(">:first-child").text(rawTxt);
  } else {
    $newEl.attr("data-raw", "0.000");
    $newEl.find(">:first-child").text("0.0");
  }

  applyMasterReferenceXY(axis);
}

// --------------------------
// Button + input handlers
// --------------------------
$(document).on("click", "button", function() {
  if ($(this).is("#capture-pos")) {
    // capture current live position
    const x_pos = parseFloat($("#pos-x").text()).toFixed(3);
    const y_pos = parseFloat($("#pos-y").text()).toFixed(3);
    const z_pos = parseFloat($("#pos-z").text()).toFixed(3);

    $("#captured-x").find(">:first-child").text(x_pos);
    $("#captured-y").find(">:first-child").text(y_pos);
    $("#captured-z").find(">:first-child").text(z_pos);

    applyMasterReferenceXY("x");
    applyMasterReferenceXY("y");
  } else if ($(this).is("#toolchange")) {
    const url = toolChangeURL($(this).data("tool"));
    $.get(url);
  } else if ($(this).data("axis")) {
    const tool = $(this).data("tool");
    const axis = $(this).data("axis");
    const position = $(`#pos-${axis}`).text();
    $(`input[name=T${tool}-${axis}-pos]`).val(position);
    updateOffset(tool, axis);
  }
});

$(document).on("change", "input[type=number]", function() {
  const tool = $(this).data("tool");
  const axis = $(this).data("axis");
  updateOffset(tool, axis);
});

// --------------------------
// Start periodic updates
// --------------------------
startProbeResultsUpdates();
