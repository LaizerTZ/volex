import * as XLSX from 'xlsx';
import { POLineItem, InvoiceRecord } from '../types';

// Helper to sanitize header strings
const normalizeHeader = (header: string): string => {
  return header
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
};

const parseNumber = (val: any, fallback = 0): number => {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? fallback : parsed;
};

const parseDateString = (val: any): string => {
  if (!val) {
    return new Date().toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    // Excel serial date to JS date
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return str;
};

export const parseExcelPOData = async (file: File): Promise<POLineItem[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to json array of objects
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          throw new Error('The uploaded file contains no data rows.');
        }

        const items: POLineItem[] = rawRows.map((row, index) => {
          // Find matching keys dynamically
          const keys = Object.keys(row);

          const findValue = (possibleNames: string[]): any => {
            const normalizedPossible = possibleNames.map(normalizeHeader);
            for (const key of keys) {
              const normKey = normalizeHeader(key);
              if (normalizedPossible.some(p => normKey.includes(p) || p.includes(normKey))) {
                return row[key];
              }
            }
            return '';
          };

          const customerName = String(
            findValue(['CUSTOMER NAME', 'CUSTOMER', 'CLIENT', 'CLIENT NAME', 'BUYER']) || 'Unknown Customer'
          ).trim();

          const destination = String(
            findValue(['DESTINATION', 'LOCATION', 'DELIVERY DESTINATION', 'SITE', 'SHIP TO', 'DELIVERY LOCATION']) || 'Default Location'
          ).trim();

          const poNumber = String(
            findValue(['PURCHASE ORDER NUMBER', 'PURCHASE ORDER', 'PO NUMBER', 'PO #', 'PO NO', 'PURCHASE ORDE', 'LPONUMBER', 'LPO NO', 'LPO']) || `PO-${index + 1}`
          ).trim();

          const contract = String(
            findValue(['CONTRACT', 'CONTRACT NUMBER', 'CONTRACT NO', 'AGREEMENT', 'AGREEMENT NO']) || 'N/A'
          ).trim();

          const itemDescription = String(
            findValue(['ITEM DESCRIPTION', 'DESCRIPTION', 'ITEM', 'PRODUCT', 'PART DESCRIPTION', 'PART NAME']) || `Item ${index + 1}`
          ).trim();

          const rawDate = findValue(['DATE(lpo)', 'DATE(LPO)', 'DATE (LPO)', 'DATE(lpc)', 'DATE', 'PO DATE', 'LPO DATE', 'ORDER DATE']);
          const date = parseDateString(rawDate);

          const unitOfMeasure = String(
            findValue(['UNIT OF MEAS', 'UNIT OF MEASURE', 'UOM', 'UNIT', 'U/M', 'MEASURE']) || 'PCS'
          ).trim();

          const quantity = parseNumber(
            findValue(['QUANTITY(lpo)', 'QUANTITY(LPO)', 'QUANTITY(lp', 'QUANTITY', 'QTY', 'QTY(LPO)', 'ORDER QTY']),
            1
          );

          const unitCost = parseNumber(
            findValue(['UNIT COST', 'COST', 'UNIT_COST', 'BUYING PRICE']),
            0
          );

          let unitPrice = parseNumber(
            findValue(['UNIT PRICE', 'PRICE', 'RATE', 'UNIT_PRICE', 'SELLING PRICE']),
            0
          );

          // If unit price not provided but unit cost is, default unit price to unit cost
          if (unitPrice === 0 && unitCost > 0) {
            unitPrice = unitCost;
          }

          let valueBeforeVat = parseNumber(
            findValue(['VALUE BEFORE VAT', 'VALULUE BEFORE VAT', 'TOTAL BEFORE VAT', 'AMOUNT BEFORE VAT', 'SUBTOTAL', 'VALUE EXCL VAT']),
            0
          );

          // If not in excel, calculate: quantity * unitPrice
          if (valueBeforeVat === 0 && quantity > 0 && unitPrice > 0) {
            valueBeforeVat = Math.round(quantity * unitPrice * 100) / 100;
          }

          let vatAmount = parseNumber(
            findValue(['VAT', 'VAT AMOUNT', 'VAT(18%)', 'VAT VALUE', 'TAX', 'TAX AMOUNT']),
            0
          );

          // Default standard VAT rate (e.g., 18%)
          const vatRate = 0.18;
          if (vatAmount === 0 && valueBeforeVat > 0) {
            vatAmount = Math.round(valueBeforeVat * vatRate * 100) / 100;
          }

          let valueAfterVat = parseNumber(
            findValue(['VALUE AFTER VAT', 'VAT AFTER VAT', 'TOTAL AFTER VAT', 'AMOUNT AFTER VAT', 'GRAND TOTAL', 'TOTAL', 'VALUE INCL VAT']),
            0
          );

          if (valueAfterVat === 0) {
            valueAfterVat = Math.round((valueBeforeVat + vatAmount) * 100) / 100;
          }

          return {
            id: `pol-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
            customerName,
            destination,
            poNumber,
            contract,
            itemDescription,
            date,
            unitOfMeasure,
            quantity: Math.max(0, quantity),
            unitCost,
            unitPrice,
            valueBeforeVat,
            vatRate,
            vatAmount,
            valueAfterVat,
          };
        });

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const generateSampleExcelTemplate = () => {
  const sampleHeaders = [
    {
      'CUSTOMER NAME': 'Acme Engineering Ltd',
      'DESTINATION': 'Dar es Salaam Port - Site A',
      'PURCHASE ORDER NUMBER': 'PO-2026-8801',
      'CONTRACT': 'CNT-EAST-091',
      'ITEM DESCRIPTION': 'High-Grade Steel Reinforcement Bars 16mm',
      'DATE(lpo)': '2026-08-15',
      'UNIT OF MEAS': 'TONS',
      'QUANTITY(lpo)': 50,
      'UNIT COST': 850.00,
      'UNIT PRICE': 980.00,
      'VALUE BEFORE VAT': 49000.00,
      'VAT': 8820.00,
      'VALUE AFTER VAT': 57820.00,
    },
    {
      'CUSTOMER NAME': 'Acme Engineering Ltd',
      'DESTINATION': 'Dar es Salaam Port - Site A',
      'PURCHASE ORDER NUMBER': 'PO-2026-8801',
      'CONTRACT': 'CNT-EAST-091',
      'ITEM DESCRIPTION': 'Hydraulic Valve Assembly Type 4B',
      'DATE(lpo)': '2026-08-15',
      'UNIT OF MEAS': 'PCS',
      'QUANTITY(lpo)': 20,
      'UNIT COST': 340.00,
      'UNIT PRICE': 420.00,
      'VALUE BEFORE VAT': 8400.00,
      'VAT': 1512.00,
      'VALUE AFTER VAT': 9912.00,
    },
    {
      'CUSTOMER NAME': 'Global Mining & Energy Corp',
      'DESTINATION': 'Mwanza Goldfield Logistics Hub',
      'PURCHASE ORDER NUMBER': 'PO-2026-9042',
      'CONTRACT': 'CNT-MINE-442',
      'ITEM DESCRIPTION': 'Heavy Duty Conveyor Belt 1200mm (50m roll)',
      'DATE(lpo)': '2026-08-20',
      'UNIT OF MEAS': 'ROLLS',
      'QUANTITY(lpo)': 15,
      'UNIT COST': 1200.00,
      'UNIT PRICE': 1450.00,
      'VALUE BEFORE VAT': 21750.00,
      'VAT': 3915.00,
      'VALUE AFTER VAT': 25665.00,
    },
    {
      'CUSTOMER NAME': 'Global Mining & Energy Corp',
      'DESTINATION': 'Mwanza Goldfield Logistics Hub',
      'PURCHASE ORDER NUMBER': 'PO-2026-9042',
      'CONTRACT': 'CNT-MINE-442',
      'ITEM DESCRIPTION': 'Industrial Lubricant Synthetic 200L Drum',
      'DATE(lpo)': '2026-08-20',
      'UNIT OF MEAS': 'DRUMS',
      'QUANTITY(lpo)': 40,
      'UNIT COST': 180.00,
      'UNIT PRICE': 230.00,
      'VALUE BEFORE VAT': 9200.00,
      'VAT': 1656.00,
      'VALUE AFTER VAT': 10856.00,
    },
    {
      'CUSTOMER NAME': 'Kilimanjaro Agro Industries',
      'DESTINATION': 'Arusha Depot Warehouse 2',
      'PURCHASE ORDER NUMBER': 'PO-2026-7730',
      'CONTRACT': 'CNT-AGRO-108',
      'ITEM DESCRIPTION': 'Drip Irrigation Poly Tubing 16mm (500m)',
      'DATE(lpo)': '2026-08-25',
      'UNIT OF MEAS': 'COILS',
      'QUANTITY(lpo)': 100,
      'UNIT COST': 45.00,
      'UNIT PRICE': 60.00,
      'VALUE BEFORE VAT': 6000.00,
      'VAT': 1080.00,
      'VALUE AFTER VAT': 7080.00,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleHeaders);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PO_Data');

  XLSX.writeFile(wb, 'PO_Upload_Template.xlsx');
};

export const exportPOsToExcel = (items: POLineItem[], filename = 'PO_Master_Data.xlsx') => {
  const exportData = items.map((item) => ({
    'CUSTOMER NAME': item.customerName,
    'DESTINATION': item.destination,
    'PURCHASE ORDER NUMBER': item.poNumber,
    'CONTRACT': item.contract,
    'ITEM DESCRIPTION': item.itemDescription,
    'DATE(lpo)': item.date,
    'UNIT OF MEAS': item.unitOfMeasure,
    'QUANTITY(lpo)': item.quantity,
    'INVOICED QTY': item.invoicedQuantity || 0,
    'REMAINING QTY': item.remainingQuantity !== undefined ? item.remainingQuantity : item.quantity,
    'STATUS': item.status || 'UNINVOICED',
    'UNIT COST': item.unitCost,
    'UNIT PRICE': item.unitPrice,
    'VALUE BEFORE VAT': item.valueBeforeVat,
    'VAT': item.vatAmount,
    'VALUE AFTER VAT': item.valueAfterVat,
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PO_Summary');
  XLSX.writeFile(wb, filename);
};

export const exportInvoicesToExcel = (invoices: InvoiceRecord[], filename = 'Invoices_Database.xlsx') => {
  const flattenedRows: any[] = [];
  
  invoices.forEach(inv => {
    inv.lines.forEach((line, idx) => {
      flattenedRows.push({
        'INVOICE NUMBER': inv.invoiceNumber,
        'INVOICE DATE': inv.invoiceDate,
        'PURCHASE ORDER NUMBER': inv.poNumber,
        'CUSTOMER NAME': inv.customerName,
        'DESTINATION': inv.destination,
        'CONTRACT': inv.contract,
        'PO DATE': inv.poDate,
        'LINE ITEM #': idx + 1,
        'ITEM DESCRIPTION': line.itemDescription,
        'UOM': line.unitOfMeasure,
        'INVOICED QUANTITY': line.invoicedQuantity,
        'ORIGINAL PO QTY': line.poQuantity,
        'UNIT PRICE': line.unitPrice,
        'LINE VALUE BEFORE VAT': line.valueBeforeVat,
        'LINE VAT': line.vatAmount,
        'LINE VALUE AFTER VAT': line.valueAfterVat,
        'TOTAL INVOICE BEFORE VAT': inv.subtotalBeforeVat,
        'TOTAL INVOICE VAT': inv.totalVat,
        'TOTAL INVOICE AFTER VAT': inv.totalAfterVat,
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(flattenedRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
  XLSX.writeFile(wb, filename);
};
