'use client';

import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';

interface ExportButtonProps {
  data: any[];
  filename?: string;
  exportType?: 'csv' | 'json' | 'pdf';
}

export default function ExportButton({
  data,
  filename = 'export',
  exportType = 'csv',
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const escapeCSVValue = (value: string): string => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // RFC 4180: Fields containing commas, quotes, or newlines must be quoted
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const exportToCSV = () => {
    if (data.length === 0) return;

    setExporting(true);
    try {
      // Get headers from first object
      const headers = Object.keys(data[0]);
      const csvRows = [];

      // Add headers (escaped)
      csvRows.push(headers.map(escapeCSVValue).join(','));

      // Add data rows
      for (const row of data) {
        const values = headers.map((header) => {
          const value = row[header];
          // Handle nested objects and arrays
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return escapeCSVValue(JSON.stringify(value));
          // Escape commas and quotes using the same function
          return escapeCSVValue(String(value));
        });
        csvRows.push(values.join(','));
      }

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const exportToJSON = () => {
    setExporting(true);
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = () => {
    // PDF export would require a library like jsPDF or pdfkit
    // For now, show a message
    alert('PDF export coming soon. Please use CSV or JSON export for now.');
  };

  const handleExport = () => {
    switch (exportType) {
      case 'csv':
        exportToCSV();
        break;
      case 'json':
        exportToJSON();
        break;
      case 'pdf':
        exportToPDF();
        break;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={exporting || data.length === 0}
      >
        {exporting ? (
          'Exporting...'
        ) : exportType === 'csv' ? (
          <>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export CSV
          </>
        ) : exportType === 'json' ? (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Export JSON
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </>
        )}
      </Button>
    </div>
  );
}

