import { storage } from "./storage";
import type { InsertJobFinancials } from "@shared/schema";

export interface FeeCalculation {
  baseJobAmount: number;       // Company's price per wash
  baseTax: number;             // 5% tax on base amount
  tipAmount: number;           // Tip amount (goes 100% to cleaner)
  tipTax: number;              // 5% tax on tip
  platformFeeAmount: number;   // 3 AED platform fee (customer pays this)
  platformFeeTax: number;      // 5% tax on platform fee
  platformFeeToCompany: number; // 95% of platform fee (2.85 AED goes to company)
  platformRevenue: number;     // 5% of platform fee (0.15 AED deducted from company revenue)
  totalAmount: number;         // (base + platform fee + tip) + tax (what customer pays)
  grossAmount: number;         // Sum of all: baseJobAmount + baseTax + tipAmount + tipTax + platformFeeAmount + platformFeeTax + stripeProcessingFee
  paymentProcessingFeeAmount: number; // Stripe fees
  netPayableAmount: number;    // What company gets: grossAmount - platformFeeAmount - platformFeeTax - stripeProcessingFee
  taxAmount: number;           // Legacy: Total tax (baseTax + tipTax + platformFeeTax)
}

export async function calculateJobFees(
  baseAmount: number, 
  tipAmount: number = 0, 
  platformFee: number = 3.00, 
  packageType: 'pay_per_wash' | 'subscription' = 'pay_per_wash'
): Promise<FeeCalculation> {
  const taxRate = 0.05; // 5% tax
  const stripePercentRate = 0.029; // 2.9%
  const stripeFixedFee = 1.00; // 1 AED
  
  // Breakdown of amounts and their respective taxes
  const baseJobAmount = Number(baseAmount.toFixed(2));
  const baseTax = Number((baseAmount * taxRate).toFixed(2));
  const tipAmountValue = Number(tipAmount.toFixed(2));
  const tipTax = Number((tipAmount * taxRate).toFixed(2));
  
  let platformFeeAmount: number;
  let platformRevenue: number;
  let platformFeeToCompany: number;
  let platformFeeTax: number;
  
  if (packageType === 'subscription') {
    // Subscription package: No platform fee, only processing fees
    platformFeeAmount = 0;
    platformRevenue = 0;
    platformFeeToCompany = 0;
    platformFeeTax = 0;
  } else {
    // Pay Per Wash package: Use configured platform fee
    platformFeeAmount = platformFee;
    platformFeeTax = Number((platformFeeAmount * taxRate).toFixed(2));
    
    // All platform fee goes to platform (100% revenue)
    platformRevenue = platformFeeAmount;
    platformFeeToCompany = 0;
  }
  
  // Total tax = baseTax + tipTax + platformFeeTax
  const taxAmount = Number((baseTax + tipTax + platformFeeTax).toFixed(2));
  
  // Calculate total amount customer pays = base + baseTax + tip + tipTax + platform fee + platformFeeTax
  const totalAmount = Number((baseJobAmount + baseTax + tipAmountValue + tipTax + platformFeeAmount + platformFeeTax).toFixed(2));
  
  // Stripe fees are calculated on the total amount
  const paymentProcessingFeeAmount = Number(
    ((totalAmount * stripePercentRate) + stripeFixedFee).toFixed(2)
  );
  
  // Gross amount = sum of all: baseJobAmount + baseTax + tipAmount + tipTax + platformFeeAmount + platformFeeTax + stripeProcessingFee
  const grossAmount = Number((baseJobAmount + baseTax + tipAmountValue + tipTax + platformFeeAmount + platformFeeTax + paymentProcessingFeeAmount).toFixed(2));
  
  // Net payable = gross - platformFeeAmount - platformFeeTax - stripeProcessingFee
  const netPayableAmount = Number(
    (grossAmount - platformFeeAmount - platformFeeTax - paymentProcessingFeeAmount).toFixed(2)
  );
  
  return {
    baseJobAmount,
    baseTax,
    tipAmount: tipAmountValue,
    tipTax,
    platformFeeAmount,
    platformFeeTax,
    platformFeeToCompany,
    platformRevenue,
    totalAmount,
    grossAmount,
    paymentProcessingFeeAmount,
    netPayableAmount,
    taxAmount,
  };
}

export async function createJobFinancialRecord(
  jobId: number,
  companyId: number,
  cleanerId: number | null,
  baseAmount: number,
  tipAmount: number,
  paidAt: Date,
  platformFee: number = 3.00
): Promise<void> {
  const existing = await storage.getJobFinancialsByJobId(jobId);
  if (existing) {
    return;
  }

  // Get company to determine package type
  const company = await storage.getCompany(companyId);
  const packageType = company?.packageType || 'pay_per_wash';

  const fees = await calculateJobFees(baseAmount, tipAmount, platformFee, packageType);
  
  const financialRecord: InsertJobFinancials = {
    jobId,
    companyId,
    cleanerId,
    baseJobAmount: fees.baseJobAmount.toString(),
    baseTax: fees.baseTax.toString(),
    tipAmount: fees.tipAmount.toString(),
    tipTax: fees.tipTax.toString(),
    platformFeeAmount: fees.platformFeeAmount.toString(),
    platformFeeTax: fees.platformFeeTax.toString(),
    paymentProcessingFeeAmount: fees.paymentProcessingFeeAmount.toString(),
    grossAmount: fees.grossAmount.toString(),
    netPayableAmount: fees.netPayableAmount.toString(),
    taxAmount: fees.taxAmount.toString(),
    platformRevenue: fees.platformRevenue.toString(),
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
