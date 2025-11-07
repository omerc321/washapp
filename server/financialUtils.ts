import { storage } from "./storage";
import type { InsertJobFinancials } from "@shared/schema";

export interface FeeCalculation {
  grossAmount: number;
  platformFeeAmount: number;
  paymentProcessingFeeAmount: number;
  netPayableAmount: number;
}

export async function calculateJobFees(grossAmount: number): Promise<FeeCalculation> {
  const feeSettings = await storage.getCurrentFeeSettings();
  
  const platformFeeRate = Number(feeSettings.platformFeeRate);
  const stripePercentRate = Number(feeSettings.stripePercentRate);
  const stripeFixedFee = Number(feeSettings.stripeFixedFee);
  
  const platformFeeAmount = Number((grossAmount * platformFeeRate).toFixed(2));
  const paymentProcessingFeeAmount = Number(
    ((grossAmount * stripePercentRate) + stripeFixedFee).toFixed(2)
  );
  const netPayableAmount = Number(
    (grossAmount - platformFeeAmount - paymentProcessingFeeAmount).toFixed(2)
  );
  
  return {
    grossAmount,
    platformFeeAmount,
    paymentProcessingFeeAmount,
    netPayableAmount,
  };
}

export async function createJobFinancialRecord(
  jobId: number,
  companyId: number,
  cleanerId: number | null,
  grossAmount: number,
  paidAt: Date
): Promise<void> {
  const existing = await storage.getJobFinancialsByJobId(jobId);
  if (existing) {
    return;
  }

  const fees = await calculateJobFees(grossAmount);
  
  const financialRecord: InsertJobFinancials = {
    jobId,
    companyId,
    cleanerId,
    grossAmount: fees.grossAmount.toString(),
    platformFeeAmount: fees.platformFeeAmount.toString(),
    paymentProcessingFeeAmount: fees.paymentProcessingFeeAmount.toString(),
    netPayableAmount: fees.netPayableAmount.toString(),
    currency: "USD",
    paidAt,
  };
  
  await storage.createJobFinancials(financialRecord);
}
