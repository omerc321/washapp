import { storage } from "./storage";
import type { InsertJobFinancials } from "@shared/schema";

export interface FeeCalculation {
  baseAmount: number;         // Company's price per wash
  taxAmount: number;           // 5% tax
  platformFeeAmount: number;   // 3 AED platform fee
  totalAmount: number;         // base + tax + platform fee (what customer pays)
  grossAmount: number;         // base + tax (revenue to company before fees)
  paymentProcessingFeeAmount: number; // Stripe fees
  netPayableAmount: number;    // What company gets after all fees
}

export async function calculateJobFees(baseAmount: number): Promise<FeeCalculation> {
  const taxRate = 0.05; // 5% tax
  const platformFeeAmount = 3.00; // Flat 3 AED platform fee
  const stripePercentRate = 0.029; // 2.9%
  const stripeFixedFee = 1.00; // 1 AED
  
  // Calculate tax on base amount
  const taxAmount = Number((baseAmount * taxRate).toFixed(2));
  
  // Gross amount is base + tax (this is company's revenue before fees)
  const grossAmount = Number((baseAmount + taxAmount).toFixed(2));
  
  // Total amount customer pays = base + tax + platform fee
  const totalAmount = Number((grossAmount + platformFeeAmount).toFixed(2));
  
  // Stripe fees are calculated on the total amount
  const paymentProcessingFeeAmount = Number(
    ((totalAmount * stripePercentRate) + stripeFixedFee).toFixed(2)
  );
  
  // Net payable to company = gross - platform fee - stripe fees
  const netPayableAmount = Number(
    (grossAmount - platformFeeAmount - paymentProcessingFeeAmount).toFixed(2)
  );
  
  return {
    baseAmount,
    taxAmount,
    platformFeeAmount,
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
  paidAt: Date
): Promise<void> {
  const existing = await storage.getJobFinancialsByJobId(jobId);
  if (existing) {
    return;
  }

  const fees = await calculateJobFees(baseAmount);
  
  const financialRecord: InsertJobFinancials = {
    jobId,
    companyId,
    cleanerId,
    grossAmount: fees.grossAmount.toString(),
    taxAmount: fees.taxAmount.toString(),
    platformFeeAmount: fees.platformFeeAmount.toString(),
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
