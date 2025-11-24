import { storage } from "./storage";
import type { InsertJobFinancials } from "@shared/schema";
import { calculateFees, type FeePackageType } from "@shared/fee-calculator";

export interface FeeCalculation {
  baseJobAmount: number;       // Company's price per wash (car wash only)
  basePrice: number;           // Legacy alias for baseJobAmount
  baseTax: number;             // 5% tax on base amount (DEPRECATED - now part of taxAmount)
  tipAmount: number;           // Tip amount (goes 100% to cleaner, VAT-exempt)
  tipTax: number;              // ALWAYS 0 - Tips are VAT-exempt (kept for schema compatibility)
  platformFeeAmount: number;   // Platform fee (varies by package)
  platformFee: number;         // Legacy alias for platformFeeAmount
  platformFeeTax: number;      // 5% tax on platform fee (DEPRECATED - now part of taxAmount)
  platformFeeToCompany: number; // 95% of platform fee (2.85 AED goes to company)
  platformRevenue: number;     // 5% of platform fee (0.15 AED deducted from company revenue)
  servicePrice: number;        // Combined: carWash + platformFee (for customer display)
  totalAmount: number;         // Total customer pays: service + VAT + tip (no VAT on tip)
  taxAmount: number;           // Total VAT (5% of servicePrice ONLY - tips are VAT-exempt)
  grossAmount: number;         // Sum of all amounts before fees/deductions
  paymentProcessingFeeAmount: number; // Stripe fees (total)
  companyStripeFeeShare: number;  // Company's portion of Stripe fee (Package 2 only)
  cleanerStripeFeeShare: number;  // Cleaner's portion of Stripe fee (Package 2 only)
  netPayableAmount: number;    // What company gets after all deductions
  remainingTip: number;        // Tip to cleaner (minus Stripe fee share in Package 2)
}

export async function calculateJobFees(
  baseAmount: number, 
  tipAmount: number = 0, 
  platformFee: number = 3.00, 
  packageType: 'pay_per_wash' | 'subscription' = 'pay_per_wash',
  feePackageType?: FeePackageType
): Promise<FeeCalculation> {
  const stripePercentRate = 0.029; // 2.9%
  const stripeFixedFee = 1.00; // 1 AED
  const taxRate = 0.05; // 5% VAT
  
  // Use shared fee calculator for base pricing
  const baseFees = calculateFees({
    carWashPrice: baseAmount,
    feePackageType: feePackageType || 'custom',
    platformFee: platformFee,
  });
  
  // Add tip calculations  
  const tipAmountValue = Number(tipAmount.toFixed(2));
  // IMPORTANT: Tips are VAT-exempt (no tax on gratuity)
  // tipTax is kept as 0 and persisted for backwards compatibility with existing schema
  const tipTax = 0;
  
  // Total amount customer pays = service price + VAT + tip (no VAT on tip)
  const totalAmount = Number((baseFees.totalAmount + tipAmountValue).toFixed(2));
  
  // Total tax = VAT on service only (tips are VAT-exempt)
  const taxAmount = Number(baseFees.vatAmount.toFixed(2));
  
  // Determine if Stripe fees should be absorbed by company (package2) or passed to customer (others)
  const absorbsStripeFee = (feePackageType || '').toLowerCase() === 'package2';
  
  // Stripe fees are calculated on the total amount
  const paymentProcessingFeeAmount = Number(
    ((totalAmount * stripePercentRate) + stripeFixedFee).toFixed(2)
  );
  
  let platformRevenue: number;
  let platformFeeToCompany: number;
  
  if (packageType === 'subscription') {
    // Subscription: no platform fees charged to customers
    platformRevenue = 0;
    platformFeeToCompany = 0;
  } else {
    // All platform fee goes to platform (100% revenue)
    platformRevenue = baseFees.platformFeeAmount;
    platformFeeToCompany = 0;
  }
  
  // Platform VAT
  const platformFeeTax = Number((baseFees.platformFeeAmount * taxRate).toFixed(2));
  
  // Gross amount and net payable depend on whether Stripe fee is absorbed
  let grossAmount: number;
  let netPayableAmount: number;
  let companyStripeFeeShare = 0;
  let cleanerStripeFeeShare = 0;
  let remainingTip = tipAmountValue; // Tips have no VAT
  
  if (absorbsStripeFee) {
    // Package 2: Customer pays ONLY car wash + VAT + tip (no Stripe fee added to customer)
    // Company absorbs entire Stripe fee, split proportionally between company and cleaner
    // For 15 AED wash + 5 tip (package2 has no platform fee):
    //   - Service price + VAT (company's share) = 15.75
    //   - Tip (cleaner's share, NO VAT on tip) = 5.00
    //   - Total = 20.75
    //   - Stripe fee = 1.60
    //   - Company's proportion = 15.75 / 20.75 = 0.76
    //   - Cleaner's proportion = 5.00 / 20.75 = 0.24
    //   - Company's Stripe fee = 1.60 × 0.76 = 1.22
    //   - Cleaner's Stripe fee = 1.60 × 0.24 = 0.38
    //   - Company net = 15.75 - 1.22 = 14.53
    //   - Cleaner gets (remaining tip) = 5.00 - 0.38 = 4.62
    
    grossAmount = totalAmount;  // Customer pays car wash + VAT + tip (no Stripe fee)
    const companyShare = baseFees.totalAmount;  // Service price + VAT (includes platform fee + VAT)
    const tipNoVAT = tipAmountValue; // Tips have NO VAT
    
    if (tipNoVAT > 0 && totalAmount > 0) {
      // Calculate proportions with full precision
      const companyProportion = companyShare / totalAmount;
      const cleanerProportion = tipNoVAT / totalAmount;
      
      // Split Stripe fee proportionally, then round
      companyStripeFeeShare = Number((paymentProcessingFeeAmount * companyProportion).toFixed(2));
      cleanerStripeFeeShare = Number((paymentProcessingFeeAmount * cleanerProportion).toFixed(2));
      
      // Remaining tip (no VAT) after cleaner's Stripe fee share
      remainingTip = Number((tipNoVAT - cleanerStripeFeeShare).toFixed(2));
    } else {
      // No tip - company absorbs all Stripe fees
      companyStripeFeeShare = paymentProcessingFeeAmount;
      cleanerStripeFeeShare = 0;
      remainingTip = 0;
    }
    
    netPayableAmount = Number((companyShare - companyStripeFeeShare).toFixed(2));
  } else {
    // Other packages: Stripe fee is passed to customer, tip goes to cleaner
    // grossAmount includes service + VAT + tip + Stripe fee (all collected from customer)
    grossAmount = Number((totalAmount + paymentProcessingFeeAmount).toFixed(2));
    
    // Company gets: service - platform fee - platform VAT - Stripe fee (tip excluded, goes to cleaner)
    // Formula: grossAmount - platformFee - platformVAT - stripeFee - tip
    // Simplified: (service + VAT + tip + stripe) - platformFee - allVAT + carWashVAT - stripe - tip
    //           = service - platformFee - platformVAT
    netPayableAmount = Number(
      (grossAmount - baseFees.platformFeeAmount - baseFees.vatAmount + (baseFees.carWashPrice * taxRate) - paymentProcessingFeeAmount - tipAmountValue).toFixed(2)
    );
    companyStripeFeeShare = 0;
    cleanerStripeFeeShare = 0;
    // Cleaner gets full tip (not tracked in netPayableAmount)
    remainingTip = tipAmountValue;
  }
  
  return {
    baseJobAmount: baseFees.carWashPrice,
    basePrice: baseFees.carWashPrice, // Legacy alias
    baseTax: Number((baseFees.carWashPrice * taxRate).toFixed(2)),
    tipAmount: tipAmountValue,
    tipTax,
    platformFeeAmount: baseFees.platformFeeAmount,
    platformFee: baseFees.platformFeeAmount, // Legacy alias
    platformFeeTax: Number((baseFees.platformFeeAmount * taxRate).toFixed(2)),
    platformFeeToCompany,
    platformRevenue,
    servicePrice: baseFees.servicePrice,
    totalAmount,
    taxAmount,
    grossAmount,
    paymentProcessingFeeAmount,
    companyStripeFeeShare,
    cleanerStripeFeeShare,
    netPayableAmount,
    remainingTip,
  };
}

export async function createJobFinancialRecord(
  jobId: number,
  companyId: number,
  cleanerId: number | null,
  baseAmount: number,
  tipAmount: number,
  paidAt: Date,
  platformFee: number = 3.00,
  feePackageType?: FeePackageType
): Promise<void> {
  const existing = await storage.getJobFinancialsByJobId(jobId);
  if (existing) {
    return;
  }

  // Get company to determine package type
  const company = await storage.getCompany(companyId);
  const packageType = company?.packageType || 'pay_per_wash';
  const companyFeePackageType = feePackageType || company?.feePackageType || 'custom';

  const fees = await calculateJobFees(baseAmount, tipAmount, platformFee, packageType, companyFeePackageType);
  
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
    companyStripeFeeShare: fees.companyStripeFeeShare.toString(),
    cleanerStripeFeeShare: fees.cleanerStripeFeeShare.toString(),
    remainingTip: fees.remainingTip.toString(),
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
