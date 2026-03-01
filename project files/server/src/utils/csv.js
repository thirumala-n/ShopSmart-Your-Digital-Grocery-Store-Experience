const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return '';
  const cell = String(value);
  if (/[",\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
};

const toCsv = (headers, rows) => {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const lines = rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(','));
  return [headerLine, ...lines].join('\n');
};

module.exports = {
  toCsv
};
