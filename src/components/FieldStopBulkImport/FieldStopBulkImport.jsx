import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import {
  useRef,
  useState,
} from "react";
import * as XLSX from "xlsx";

import styles from "./FieldStopBulkImport.module.css";

const MAX_ROWS = 500;

const ALIASES = {
  stopOrder: ["stoporder", "stopnumber", "stop", "order", "sequence"],
  locationLabel: ["locationlabel", "label", "location", "door", "name"],
  addressLine1: ["addressline1", "address1", "streetaddress", "street", "address"],
  addressLine2: ["addressline2", "address2", "apartment", "apt", "suite", "unit"],
  city: ["city", "municipality", "town"],
  state: ["state", "statecode"],
  postalCode: ["postalcode", "zipcode", "zip", "postcode"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "long", "lng", "lon"],
  instructions: ["instructions", "instruction", "notes", "note", "directions"],
};

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
  );
}

function pick(row, aliases) {
  for (const alias of aliases) {
    if (row[alias] !== undefined && clean(row[alias]) !== "") {
      return row[alias];
    }
  }

  return "";
}

function addressKey(row) {
  return [
    row.addressLine1,
    row.addressLine2,
    row.city,
    row.state,
    row.postalCode,
  ]
    .map((value) => clean(value).toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("|");
}

function coordinate(value, minimum, maximum, label, errors) {
  const text = clean(value);

  if (!text) {
    return null;
  }

  const number = Number(text);

  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    errors.push(`${label} must be between ${minimum} and ${maximum}.`);
    return null;
  }

  return number;
}

function buildPreview(rawRows, existingStops, defaultCity, defaultState) {
  const rows = rawRows.map(normalizeRow);

  const existingOrders = new Set(
    existingStops
      .map((stop) => Number(stop.stop_order))
      .filter((value) => Number.isInteger(value) && value > 0),
  );

  const existingAddresses = new Set(
    existingStops
      .map((stop) =>
        addressKey({
          addressLine1: stop.address_line_1,
          addressLine2: stop.address_line_2,
          city: stop.city,
          state: stop.state,
          postalCode: stop.postal_code,
        }),
      )
      .filter(Boolean),
  );

  const explicitOrders = rows.map((row) => {
    const value = clean(pick(row, ALIASES.stopOrder));

    if (!value) {
      return null;
    }

    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : Number.NaN;
  });

  const counts = new Map();

  explicitOrders.forEach((value) => {
    if (Number.isInteger(value)) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  });

  const usedOrders = new Set([
    ...existingOrders,
    ...explicitOrders.filter(Number.isInteger),
  ]);

  let nextOrder = existingOrders.size ? Math.max(...existingOrders) + 1 : 1;
  const seenAddresses = new Set(existingAddresses);

  return rows.map((row, index) => {
    const errors = [];
    const explicitOrder = explicitOrders[index];
    let stopOrder = explicitOrder;

    if (Number.isNaN(explicitOrder)) {
      errors.push("Stop order must be a positive whole number.");
    }

    if (Number.isInteger(explicitOrder)) {
      if (existingOrders.has(explicitOrder)) {
        errors.push(`Stop order ${explicitOrder} already exists on this route.`);
      }

      if ((counts.get(explicitOrder) || 0) > 1) {
        errors.push(`Stop order ${explicitOrder} is duplicated in the file.`);
      }
    }

    if (explicitOrder === null) {
      while (usedOrders.has(nextOrder)) {
        nextOrder += 1;
      }

      stopOrder = nextOrder;
      usedOrders.add(stopOrder);
      nextOrder += 1;
    }

    const result = {
      sourceRow: index + 2,
      stopOrder,
      locationLabel: clean(pick(row, ALIASES.locationLabel)),
      addressLine1: clean(pick(row, ALIASES.addressLine1)),
      addressLine2: clean(pick(row, ALIASES.addressLine2)),
      city: clean(pick(row, ALIASES.city)) || clean(defaultCity),
      state: (clean(pick(row, ALIASES.state)) || clean(defaultState)).toUpperCase(),
      postalCode: clean(pick(row, ALIASES.postalCode)),
      instructions: clean(pick(row, ALIASES.instructions)),
      latitude: null,
      longitude: null,
      errors,
    };

    if (!result.addressLine1) {
      errors.push("Street address is required.");
    }

    if (!result.city) {
      errors.push("City is required.");
    }

    if (!/^[A-Z]{2}$/.test(result.state)) {
      errors.push("State must use a two-letter code.");
    }

    result.latitude = coordinate(
      pick(row, ALIASES.latitude),
      -90,
      90,
      "Latitude",
      errors,
    );

    result.longitude = coordinate(
      pick(row, ALIASES.longitude),
      -180,
      180,
      "Longitude",
      errors,
    );

    const duplicateAddress = addressKey(result);

    if (duplicateAddress && seenAddresses.has(duplicateAddress)) {
      errors.push("This address is already on the route or duplicated in the file.");
    }

    if (duplicateAddress) {
      seenAddresses.add(duplicateAddress);
    }

    return {
      ...result,
      valid: errors.length === 0,
    };
  });
}

function displayAddress(row) {
  return [
    row.addressLine1,
    row.addressLine2,
    [row.city, row.state, row.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

export function FieldStopBulkImport({
  route,
  existingStops = [],
  isSaving,
  onImport,
  onClose,
}) {
  const inputRef = useRef(null);
  const [rawRows, setRawRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [defaultCity, setDefaultCity] = useState("Wellington");
  const [defaultState, setDefaultState] = useState("FL");
  const [localError, setLocalError] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const previewRows = buildPreview(
    rawRows,
    existingStops,
    defaultCity,
    defaultState,
  );

  const validRows = previewRows.filter((row) => row.valid);
  const invalidRows = previewRows.filter((row) => !row.valid);

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsParsing(true);
    setLocalError("");
    setImportedCount(0);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();

      if (!["csv", "xls", "xlsx"].includes(extension)) {
        throw new Error("Choose a CSV, XLS or XLSX file.");
      }

      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.SheetNames[0];

      if (!firstSheet) {
        throw new Error("The spreadsheet does not contain a worksheet.");
      }

      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
        defval: "",
        raw: false,
      });

      if (!rows.length) {
        throw new Error("The first worksheet does not contain any data rows.");
      }

      if (rows.length > MAX_ROWS) {
        throw new Error(`Import no more than ${MAX_ROWS} stops at one time.`);
      }

      setRawRows(rows);
      setFileName(file.name);
    } catch (error) {
      console.error("Bulk stop file could not be read:", error);
      setRawRows([]);
      setFileName("");
      setLocalError(error?.message || "The spreadsheet could not be read.");
    } finally {
      setIsParsing(false);
    }
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        stop_order: 1,
        location_label: "Door 1",
        address_line_1: "123 Main Street",
        address_line_2: "",
        city: "Wellington",
        state: "FL",
        postal_code: "33414",
        latitude: "",
        longitude: "",
        instructions: "Optional gate or location note",
      },
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Field Stops");
    XLSX.writeFile(workbook, "Campaign-HQ-Field-Stops-Import-Template.xlsx");
  };

  const importStops = async () => {
    if (!validRows.length || invalidRows.length) {
      return;
    }

    setLocalError("");

    try {
      const inserted = await onImport(
        route.id,
        validRows.map((row) => ({
          stopOrder: row.stopOrder,
          locationLabel: row.locationLabel,
          addressLine1: row.addressLine1,
          addressLine2: row.addressLine2,
          city: row.city,
          state: row.state,
          postalCode: row.postalCode,
          latitude: row.latitude,
          longitude: row.longitude,
          instructions: row.instructions,
        })),
      );

      setImportedCount(inserted?.length || validRows.length);
    } catch (error) {
      setLocalError(error?.message || "The stops could not be imported.");
    }
  };

  return (
    <div className={styles.layer}>
      <button
        className={styles.overlay}
        type="button"
        onClick={importedCount ? undefined : onClose}
        aria-label="Close bulk stop import"
      />

      <section className={styles.modal} role="dialog" aria-modal="true">
        <header>
          <div className={styles.titleIcon}>
            <FileSpreadsheet size={22} />
          </div>

          <div>
            <span>Route {route.route_order}</span>
            <h2>Import stops into {route.name}</h2>
            <p>Preview and validate every address before anything is saved.</p>
          </div>

          <button
            className={styles.closeButton}
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close bulk stop import"
          >
            <X size={20} />
          </button>
        </header>

        {importedCount ? (
          <div className={styles.successState}>
            <div>
              <CheckCircle2 size={34} />
            </div>
            <span>Import complete</span>
            <h3>{importedCount} stops were added to {route.name}</h3>
            <p>
              The route has refreshed. Campaign HQ automatically checked missing
              addresses for map coordinates, and access remains limited to its
              assigned Volunteer.
            </p>
            <button type="button" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className={styles.toolbar}>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={readFile}
                hidden
              />

              <button
                className={styles.uploadButton}
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isParsing || isSaving}
              >
                {isParsing ? (
                  <LoaderCircle className={styles.spinning} size={18} />
                ) : (
                  <Upload size={18} />
                )}
                Choose spreadsheet
              </button>

              <button type="button" onClick={downloadTemplate}>
                <Download size={18} />
                Download template
              </button>

              <div className={styles.fileStatus}>
                <strong>{fileName || "No file selected"}</strong>
                <small>CSV, XLS or XLSX · Up to {MAX_ROWS} rows</small>
              </div>
            </div>

            <div className={styles.defaults}>
              <label>
                <span>Default city</span>
                <input
                  type="text"
                  value={defaultCity}
                  onChange={(event) => setDefaultCity(event.target.value)}
                />
              </label>

              <label>
                <span>Default state</span>
                <input
                  type="text"
                  value={defaultState}
                  maxLength={2}
                  onChange={(event) =>
                    setDefaultState(event.target.value.slice(0, 2).toUpperCase())
                  }
                />
              </label>

              <div>
                <span>Privacy</span>
                <strong>Parsed locally in Campaign HQ</strong>
                <small>Only validated rows are saved to this route.</small>
              </div>
            </div>

            {localError && (
              <div className={styles.error} role="alert">
                <AlertTriangle size={18} />
                {localError}
              </div>
            )}

            {rawRows.length ? (
              <>
                <div className={styles.summary}>
                  <div><span>File rows</span><strong>{previewRows.length}</strong></div>
                  <div><span>Ready</span><strong>{validRows.length}</strong></div>
                  <div className={invalidRows.length ? styles.invalidSummary : ""}>
                    <span>Needs attention</span><strong>{invalidRows.length}</strong>
                  </div>
                  <div><span>Existing stops</span><strong>{existingStops.length}</strong></div>
                </div>

                <div className={styles.preview}>
                  <table>
                    <thead>
                      <tr>
                        <th>File row</th>
                        <th>Stop</th>
                        <th>Label</th>
                        <th>Address</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr
                          className={row.valid ? "" : styles.invalidRow}
                          key={row.sourceRow}
                        >
                          <td>{row.sourceRow}</td>
                          <td>{row.stopOrder}</td>
                          <td>{row.locationLabel || "—"}</td>
                          <td>
                            <strong>{displayAddress(row)}</strong>
                            {row.instructions && <small>{row.instructions}</small>}
                          </td>
                          <td>
                            {row.valid ? (
                              <span className={styles.readyBadge}>
                                <CheckCircle2 size={14} /> Ready
                              </span>
                            ) : (
                              <div className={styles.rowErrors}>
                                {row.errors.map((error) => (
                                  <span key={error}>{error}</span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <FileSpreadsheet size={34} />
                <strong>Choose a spreadsheet to preview the route stops</strong>
                <p>Street address and city are required. Blank stop orders are assigned automatically.</p>
              </div>
            )}

            <footer>
              <div>
                {invalidRows.length ? (
                  <span className={styles.blockedMessage}>
                    <AlertTriangle size={16} /> Correct every invalid row before importing.
                  </span>
                ) : rawRows.length ? (
                  <span>{validRows.length} validated stops are ready.</span>
                ) : (
                  <span>Nothing has been saved.</span>
                )}
              </div>

              <div>
                <button type="button" onClick={onClose} disabled={isSaving}>Cancel</button>
                <button
                  className={styles.importButton}
                  type="button"
                  onClick={importStops}
                  disabled={
                    isSaving ||
                    isParsing ||
                    !validRows.length ||
                    invalidRows.length > 0
                  }
                >
                  {isSaving ? (
                    <LoaderCircle className={styles.spinning} size={18} />
                  ) : (
                    <Upload size={18} />
                  )}
                  Import {validRows.length} stops
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
