import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { PlatformSetting } from '@shared/schema';

export interface ReceiptData {
  receiptNumber: string;
  jobId: number;
  carPlateNumber: string; // Already formatted (e.g. "Abu Dhabi A 12345")
  customerPhone: string;
  customerEmail?: string;
  locationAddress: string;
  servicePrice: number; // Base car wash price
  platformFee: number; // Platform fee amount
  vatAmount: number; // Total VAT amount
  totalAmount: number; // Total paid
  paymentMethod: string;
  completedAt: Date;
}

export interface GenerateReceiptOptions {
  receiptData: ReceiptData;
  platformSettings: PlatformSetting;
}

/**
 * Generate a PDF receipt and save it to the uploads folder
 * @returns Promise<string> - Path to the generated PDF file
 */
export async function generateReceipt({ receiptData, platformSettings }: GenerateReceiptOptions): Promise<string> {
  // Ensure uploads directory exists
  const uploadsDir = join(process.cwd(), 'uploads', 'receipts');
  await mkdir(uploadsDir, { recursive: true });

  const filename = `receipt-${receiptData.receiptNumber}.pdf`;
  const filePath = join(uploadsDir, filename);

  return new Promise((resolve, reject) => {
    try {
      // Create a PDF document
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = createWriteStream(filePath);

      doc.pipe(stream);

      // Add logo at the top if it exists
      if (platformSettings.logoUrl) {
        const logoPath = join(process.cwd(), platformSettings.logoUrl);
        
        // Check if logo file exists
        if (existsSync(logoPath)) {
          try {
            // Calculate center position for logo
            const logoWidth = 80;
            const logoHeight = 80;
            const pageWidth = doc.page.width;
            const logoX = (pageWidth - logoWidth) / 2;
            
            // Add logo image
            doc.image(logoPath, logoX, doc.y, {
              fit: [logoWidth, logoHeight],
              align: 'center',
            });
            
            doc.moveDown(5); // Add space after logo
          } catch (error) {
            console.error('Error adding logo to receipt:', error);
            // Continue without logo if there's an error
          }
        }
      }

      // Header with company name
      doc.fontSize(24)
        .font('Helvetica-Bold')
        .text(platformSettings.companyName, { align: 'center' });

      doc.moveDown(0.5);

      // Company details
      doc.fontSize(10)
        .font('Helvetica')
        .text(platformSettings.companyAddress, { align: 'center' });

      if (platformSettings.vatRegistrationNumber) {
        doc.text(`VAT Registration Number: ${platformSettings.vatRegistrationNumber}`, { align: 'center' });
      }

      doc.moveDown(1.5);

      // Receipt title
      doc.fontSize(18)
        .font('Helvetica-Bold')
        .text('RECEIPT', { align: 'center' });

      doc.moveDown(1);

      // Receipt details in two columns
      const leftColumn = 70;
      const rightColumn = 320;
      let yPos = doc.y;

      // Left column - Receipt info
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('Receipt Number:', leftColumn, yPos);
      doc.font('Helvetica')
        .text(receiptData.receiptNumber, leftColumn + 100, yPos);

      yPos += 20;
      doc.font('Helvetica-Bold')
        .text('Receipt Date:', leftColumn, yPos);
      doc.font('Helvetica')
        .text(new Date(receiptData.completedAt).toLocaleString('en-AE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }), leftColumn + 100, yPos);

      yPos += 20;
      doc.font('Helvetica-Bold')
        .text('Payment Method:', leftColumn, yPos);
      doc.font('Helvetica')
        .text(receiptData.paymentMethod === 'card' ? 'Card' : receiptData.paymentMethod, leftColumn + 100, yPos);

      // Right column - Car & customer info
      yPos = doc.y - 60; // Reset to top

      doc.font('Helvetica-Bold')
        .text('Car Plate:', rightColumn, yPos);
      doc.font('Helvetica')
        .text(receiptData.carPlateNumber, rightColumn + 80, yPos);

      yPos += 20;
      doc.font('Helvetica-Bold')
        .text('Phone:', rightColumn, yPos);
      doc.font('Helvetica')
        .text(receiptData.customerPhone, rightColumn + 80, yPos);

      if (receiptData.customerEmail) {
        yPos += 20;
        doc.font('Helvetica-Bold')
          .text('Email:', rightColumn, yPos);
        doc.font('Helvetica')
          .text(receiptData.customerEmail, rightColumn + 80, yPos, { width: 200 });
      }

      doc.moveDown(3);

      // Location
      yPos = doc.y;
      doc.font('Helvetica-Bold')
        .text('Service Location:', leftColumn, yPos);
      doc.font('Helvetica')
        .text(receiptData.locationAddress, leftColumn, yPos + 15, { width: 470 });

      doc.moveDown(2);

      // Service details table
      const tableTop = doc.y;
      const tableLeft = 70;
      const tableWidth = 470;

      // Table header background
      doc.rect(tableLeft, tableTop, tableWidth, 25)
        .fillAndStroke('#1E40AF', '#1E40AF');

      // Table header text
      doc.fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#FFFFFF')
        .text('Description', tableLeft + 10, tableTop + 8, { width: 240 })
        .text('Amount (AED)', tableLeft + 260, tableTop + 8, { width: 200, align: 'right' });

      // Reset fill color for table body
      doc.fillColor('#000000');

      let currentY = tableTop + 25;

      // Service cost row (car wash price + platform fee)
      const serviceCost = receiptData.servicePrice + receiptData.platformFee;
      
      doc.fontSize(10)
        .font('Helvetica')
        .text('Car Wash Service', tableLeft + 10, currentY + 8, { width: 240 })
        .text(serviceCost.toFixed(2), tableLeft + 260, currentY + 8, { width: 200, align: 'right' });

      doc.rect(tableLeft, currentY, tableWidth, 25).stroke('#CCCCCC');
      currentY += 25;

      // VAT row (use actual VAT amount from financials)
      doc.font('Helvetica')
        .text('VAT (5%)', tableLeft + 10, currentY + 8, { width: 240 })
        .text(receiptData.vatAmount.toFixed(2), tableLeft + 260, currentY + 8, { width: 200, align: 'right' });

      doc.rect(tableLeft, currentY, tableWidth, 25).stroke('#CCCCCC');
      currentY += 25;

      // Total row with background
      doc.rect(tableLeft, currentY, tableWidth, 30)
        .fillAndStroke('#F3F4F6', '#CCCCCC');

      doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Total', tableLeft + 10, currentY + 10, { width: 240 })
        .text(`AED ${receiptData.totalAmount.toFixed(2)}`, tableLeft + 260, currentY + 10, { width: 200, align: 'right' });

      doc.moveDown(3);

      // Footer
      doc.fontSize(9)
        .font('Helvetica')
        .fillColor('#666666')
        .text('Thank you for using Washapp.ae!', { align: 'center' });

      doc.moveDown(0.5);
      doc.fontSize(8)
        .text('This is a computer-generated receipt and does not require a signature.', { align: 'center' });

      // Finalize the PDF
      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate a unique receipt number
 * Format: RCP-YYYYMMDD-XXXXX
 */
export function generateReceiptNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  
  return `RCP-${year}${month}${day}-${random}`;
}
