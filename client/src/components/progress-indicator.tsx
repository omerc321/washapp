import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export default function ProgressIndicator({ currentStep, totalSteps, steps }: ProgressIndicatorProps) {
  return (
    <div className="w-full px-4 py-6" data-testid="progress-indicator">
      {/* Step Indicators */}
      <div className="flex items-center justify-between mb-3">
        {steps.map((_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          
          return (
            <div key={stepNumber} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center relative">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.3, type: "spring" }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                    isCompleted
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                      : isCurrent
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                  data-testid={`step-indicator-${stepNumber}`}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.4, type: "spring" }}
                    >
                      <Check className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    stepNumber
                  )}
                </motion.div>
              </div>
              
              {/* Connector Line */}
              {index < totalSteps - 1 && (
                <div className="flex-1 h-1 mx-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isCompleted ? 1 : 0 }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 origin-left"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Step Labels */}
      <div className="flex items-start justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === currentStep;
          
          return (
            <motion.div
              key={stepNumber}
              initial={false}
              animate={{
                opacity: isCurrent ? 1 : 0.5,
              }}
              className="flex-1 text-center"
            >
              <p className={`text-xs font-medium ${
                isCurrent ? "text-foreground" : "text-muted-foreground"
              }`}>
                {step}
              </p>
            </motion.div>
          );
        })}
      </div>
      
      {/* Current Step Text */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-4 text-center"
      >
        <p className="text-sm text-muted-foreground" data-testid="step-counter">
          Step {currentStep} of {totalSteps}
        </p>
      </motion.div>
    </div>
  );
}
