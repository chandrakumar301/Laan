import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingUp, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface EMICalculatorProps {
  initialAmount?: number;
  initialRate?: number;
  initialTenure?: number;
}

export const EMICalculator = ({
  initialAmount = 50000,
  initialRate = 8.5,
  initialTenure = 36,
}: EMICalculatorProps) => {
  const [loanAmount, setLoanAmount] = useState(initialAmount);
  const [interestRate, setInterestRate] = useState(initialRate);
  const [tenure, setTenure] = useState(initialTenure);
  const [emi, setEmi] = useState(0);
  const [totalInterest, setTotalInterest] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    // EMI Formula: EMI = [P x R x (1+R)^N] / [(1+R)^N - 1]
    const principal = loanAmount;
    const monthlyRate = interestRate / 100 / 12;
    const months = tenure;

    if (monthlyRate === 0) {
      const calculatedEmi = principal / months;
      setEmi(calculatedEmi);
      setTotalInterest(0);
      setTotalAmount(principal);
    } else {
      const emiValue =
        (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1);
      const totalAmountValue = emiValue * months;
      const totalInterestValue = totalAmountValue - principal;

      setEmi(emiValue);
      setTotalInterest(totalInterestValue);
      setTotalAmount(totalAmountValue);
    }
  }, [loanAmount, interestRate, tenure]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const principalPercentage = (loanAmount / totalAmount) * 100;
  const interestPercentage = (totalInterest / totalAmount) * 100;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Calculator Inputs */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Loan Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Loan Amount */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Loan Amount</Label>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(loanAmount)}
              </span>
            </div>
            <Slider
              value={[loanAmount]}
              onValueChange={(value) => setLoanAmount(value[0])}
              min={1000}
              max={200000}
              step={1000}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>₹1,000</span>
              <span>₹200,000</span>
            </div>
          </div>

          {/* Interest Rate */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Interest Rate (Annual)</Label>
              <span className="text-lg font-bold text-primary">{interestRate}%</span>
            </div>
            <Slider
              value={[interestRate]}
              onValueChange={(value) => setInterestRate(value[0])}
              min={1}
              max={20}
              step={0.1}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1%</span>
              <span>20%</span>
            </div>
          </div>

          {/* Tenure */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Loan Tenure</Label>
              <span className="text-lg font-bold text-primary">{tenure} months</span>
            </div>
            <Slider
              value={[tenure]}
              onValueChange={(value) => setTenure(value[0])}
              min={6}
              max={120}
              step={6}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>6 months</span>
              <span>120 months</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-6">
        {/* EMI Card */}
        <motion.div
          key={emi}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="gradient-hero text-primary-foreground">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm opacity-90 mb-1">Monthly EMI</p>
                <p className="text-4xl font-bold">{formatCurrency(emi)}</p>
                <p className="text-sm opacity-75 mt-2">
                  for {tenure} months
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Breakdown */}
        <Card className="card-elevated">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Principal Amount</span>
              </div>
              <span className="font-semibold">{formatCurrency(loanAmount)}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-warning" />
                <span className="text-sm text-muted-foreground">Total Interest</span>
              </div>
              <span className="font-semibold text-warning">{formatCurrency(totalInterest)}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-success" />
                <span className="text-sm text-muted-foreground">Total Amount</span>
              </div>
              <span className="font-bold text-lg">{formatCurrency(totalAmount)}</span>
            </div>

            {/* Visual Breakdown */}
            <div className="pt-4">
              <div className="flex h-3 rounded-full overflow-hidden">
                <div
                  className="bg-primary transition-all duration-300"
                  style={{ width: `${principalPercentage}%` }}
                />
                <div
                  className="bg-warning transition-all duration-300"
                  style={{ width: `${interestPercentage}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Principal ({principalPercentage.toFixed(1)}%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-warning" />
                  Interest ({interestPercentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
