// backend/src/services/csvParser.ts

/**
 * Parses raw CSV content strings into an array of key-value objects.
 * Handles double quotes, commas within quotes, and standard row lines.
 */
export function parseCsv(csvContent: string): Array<Record<string, string>> {
  const lines: string[] = [];
  let currentLine = "";
  let insideQuotes = false;

  // Split lines while keeping commas/newlines inside quotes intact
  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentLine += char;
    } else if (char === "\n" || char === "\r") {
      if (insideQuotes) {
        currentLine += char;
      } else {
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = "";
        // Skip over \n if this was \r\n
        if (char === "\r" && csvContent[i + 1] === "\n") {
          i++;
        }
      }
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    return [];
  }

  // Parse header line
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

  const records: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      let val = values[index] || "";
      // Strip outer double quotes if present
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      record[header] = val.trim();
    });

    records.push(record);
  }

  return records;
}

/**
 * Parses a single CSV line into an array of column cell values.
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentCell += char; // Keep quotes to deal with them later
    } else if (char === "," && !insideQuotes) {
      cells.push(currentCell);
      currentCell = "";
    } else {
      currentCell += char;
    }
  }
  cells.push(currentCell);

  return cells;
}
