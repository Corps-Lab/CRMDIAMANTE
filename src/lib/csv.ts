import Papa from "papaparse";

export type CsvRow = Record<string, string>;

export function parseCsv(file: File): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (results.errors.length) {
          reject(results.errors.map((e) => e.message).join("; "));
        } else {
          resolve(results.data as CsvRow[]);
        }
      },
      error: (err) => reject(err),
    });
  });
}

export const get = (row: CsvRow, key: string) => row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()] ?? "";
