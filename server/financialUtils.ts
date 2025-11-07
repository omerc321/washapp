import { storage } from "./storage";
import type { InsertJobFinancials } from "@shared/schema";

export interface FeeCalculation {
  grossAmount: number;
  platformFeeAmount: number;
  paymentProcessingFeeAmount: number;
  netPayableAmount: number;
}

export async function calculateJobFees(grossAmount: number): Promise<FeeCalculation> {
  const platformFeeAmount = 3.00;
  const stripePercentRate = 0.029;
  const stripeFixedFee = 1.00;
  
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
    currency: "AED",
    paidAt,
  };
  
  await storage.createJobFinancials(financialRecord);
}
