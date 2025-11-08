import { storage } from "./storage";
import type { InsertJobFinancials } from "@shared/schema";

export interface FeeCalculation {
  baseAmount: number;         // Company's price per wash
  taxAmount: number;           // 5% tax on (base + platform fee + tip)
  tipAmount: number;           // Tip amount (goes 100% to cleaner)
  platformFeeAmount: number;   // 3 AED platform fee (customer pays this)
  platformFeeToCompany: number; // 95% of platform fee (2.85 AED goes to company)
  platformRevenue: number;     // 5% of platform fee (0.15 AED deducted from company revenue)
  totalAmount: number;         // (base + platform fee + tip) + tax (what customer pays)
  grossAmount: number;         // base + tax + platformFeeAmount (revenue before platform fee deduction)
  paymentProcessingFeeAmount: number; // Stripe fees
  netPayableAmount: number;    // What company gets: gross - platformRevenue - stripe fees
}

export async function calculateJobFees(baseAmount: number, tipAmount: number = 0): Promise<FeeCalculation> {
  const taxRate = 0.05; // 5% tax
  const platformFeeAmount = 3.00; // Flat 3 AED platform fee
  const platformRevenueRate = 0.05; // Platform gets 5% of platform fee
  const stripePercentRate = 0.029; // 2.9%
  const stripeFixedFee = 1.00; // 1 AED
  
  // Platform fee split: 5% to platform (deducted from revenue), 95% to company
  const platformRevenue = Number((platformFeeAmount * platformRevenueRate).toFixed(2));
  const platformFeeToCompany = Number((platformFeeAmount * (1 - platformRevenueRate)).toFixed(2));
  
  // Calculate subtotal (before tax)
  const subtotal = baseAmount + platformFeeAmount + tipAmount;
  
  // Tax is 5% on (base + platform fee + tip)
  const taxAmount = Number((subtotal * taxRate).toFixed(2));
  
  // Total amount customer pays = subtotal + tax
  const totalAmount = Number((subtotal + taxAmount).toFixed(2));
  
  // Gross amount includes full platform fee (before platform's share is deducted)
  const grossAmount = Number((baseAmount + taxAmount + platformFeeAmount).toFixed(2));
  
  // Stripe fees are calculated on the total amount
  const paymentProcessingFeeAmount = Number(
    ((totalAmount * stripePercentRate) + stripeFixedFee).toFixed(2)
  );
  
  // Net payable = gross - platform's share - stripe fees
  // (Company receives base + tax + platformFeeToCompany - stripe fees)
  const netPayableAmount = Number(
    (grossAmount - platformRevenue - paymentProcessingFeeAmount).toFixed(2)
  );
  
  return {
    baseAmount,
    taxAmount,
    tipAmount,
    platformFeeAmount,
    platformFeeToCompany,
    platformRevenue,
    totalAmount,
    grossAmount,
    paymentProcessingFeeAmount,
    netPayableAmount,
  };
}

export async function createJobFinancialRecord(
  jobId: number,
  companyId: number,
  cleanerId: number | null,
  baseAmount: number,
  tipAmount: number,
  paidAt: Date
): Promise<void> {
  const existing = await storage.getJobFinancialsByJobId(jobId);
  if (existing) {
    return;
  }

  const fees = await calculateJobFees(baseAmount, tipAmount);
  
  const financialRecord: InsertJobFinancials = {
    jobId,
    companyId,
    cleanerId,
    grossAmount: fees.grossAmount.toString(),
    taxAmount: fees.taxAmount.toString(),
    tipAmount: fees.tipAmount.toString(),
    platformFeeAmount: fees.platformFeeAmount.toString(),
    platformRevenue: fees.platformRevenue.toString(),
    paymentProcessingFeeAmount: fees.paymentProcessingFeeAmount.toString(),
    netPayableAmount: fees.netPayableAmount.toString(),
    currency: "AED",
    paidAt,
  };
  
  await storage.createJobFinancials(financialRecord);
}

// Helper to generate unique transaction reference numbers
export function generateTransactionReference(type: string, id: number): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${type.toUpperCase()}-${id}-${timestamp}-${random}`;
}
