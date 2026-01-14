import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  DollarSign,
  FileText,
  User,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const loanPurposes = [
  "Tuition Fees",
  "Books & Supplies",
  "Living Expenses",
  "Technology/Equipment",
  "Study Abroad",
  "Other",
];

const LoanApplication = () => {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: 25000,
    purpose: "",
    description: "",
    tenure: 36,
    monthlyIncome: "",
    hasCoSigner: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setUser({ email: session.user.email || "" });
    };
    checkAuth();
  }, [navigate]);

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculateEMI = () => {
    const principal = formData.amount;
    const rate = 6.5 / 100 / 12; // Monthly interest rate
    const months = formData.tenure;

    const emi =
      (principal * rate * Math.pow(1 + rate, months)) /
      (Math.pow(1 + rate, months) - 1);

    return emi;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      // Here you would submit to the database
      // For now, we'll just show a success message
      
      toast({
        title: "Application Submitted! 🎉",
        description: "We'll review your application and get back to you within 24-48 hours.",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return formData.amount >= 1000 && formData.purpose;
      case 2:
        return formData.tenure >= 6 && formData.monthlyIncome;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const emi = calculateEMI();
  const totalAmount = emi * formData.tenure;
  const totalInterest = totalAmount - formData.amount;

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Button variant="ghost" className="mb-6" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    step >= s
                      ? "gradient-hero text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? <CheckCircle className="h-5 w-5" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-24 sm:w-32 md:w-48 h-1 mx-2 rounded-full transition-colors ${
                      step > s ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-sm text-muted-foreground">Loan Details</span>
            <span className="text-sm text-muted-foreground">Repayment</span>
            <span className="text-sm text-muted-foreground">Review</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              {step === 1 && (
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Loan Details
                    </CardTitle>
                    <CardDescription>
                      Tell us how much you need and what it's for
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label>Loan Amount</Label>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(formData.amount)}
                        </span>
                      </div>
                      <Slider
                        value={[formData.amount]}
                        onValueChange={(value) => handleChange("amount", value[0])}
                        min={1000}
                        max={100000}
                        step={1000}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>$1,000</span>
                        <span>$100,000</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Purpose of Loan</Label>
                      <Select
                        value={formData.purpose}
                        onValueChange={(value) => handleChange("purpose", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                        <SelectContent>
                          {loanPurposes.map((purpose) => (
                            <SelectItem key={purpose} value={purpose}>
                              {purpose}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Additional Details (Optional)</Label>
                      <Textarea
                        placeholder="Provide any additional information about your loan requirement..."
                        value={formData.description}
                        onChange={(e) => handleChange("description", e.target.value)}
                        rows={4}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {step === 2 && (
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Repayment Details
                    </CardTitle>
                    <CardDescription>
                      Choose your repayment tenure and provide income details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label>Repayment Tenure</Label>
                        <span className="text-2xl font-bold text-primary">
                          {formData.tenure} months
                        </span>
                      </div>
                      <Slider
                        value={[formData.tenure]}
                        onValueChange={(value) => handleChange("tenure", value[0])}
                        min={6}
                        max={120}
                        step={6}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>6 months</span>
                        <span>120 months</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Expected Monthly Income (After Graduation)</Label>
                      <Select
                        value={formData.monthlyIncome}
                        onValueChange={(value) => handleChange("monthlyIncome", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select income range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0-2000">Less than $2,000</SelectItem>
                          <SelectItem value="2000-4000">$2,000 - $4,000</SelectItem>
                          <SelectItem value="4000-6000">$4,000 - $6,000</SelectItem>
                          <SelectItem value="6000-8000">$6,000 - $8,000</SelectItem>
                          <SelectItem value="8000+">More than $8,000</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Do you have a co-signer?</Label>
                      <Select
                        value={formData.hasCoSigner}
                        onValueChange={(value) => handleChange("hasCoSigner", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes, I have a co-signer</SelectItem>
                          <SelectItem value="no">No, I don't have a co-signer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Having a co-signer can improve your chances
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            A co-signer with good credit can help you get better interest rates and higher approval chances.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {step === 3 && (
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      Review Application
                    </CardTitle>
                    <CardDescription>
                      Please review your application before submitting
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Loan Amount</span>
                        <span className="font-semibold">{formatCurrency(formData.amount)}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Purpose</span>
                        <span className="font-semibold">{formData.purpose}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Tenure</span>
                        <span className="font-semibold">{formData.tenure} months</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Interest Rate</span>
                        <span className="font-semibold">6.5% p.a.</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Monthly EMI</span>
                        <span className="font-semibold text-primary">{formatCurrency(emi)}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-muted-foreground">Total Interest</span>
                        <span className="font-semibold text-warning">{formatCurrency(totalInterest)}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Eligibility Check Passed
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Based on your profile, you're eligible for this loan. Final approval is subject to document verification.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                disabled={step === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              {step < 3 ? (
                <Button
                  variant="hero"
                  onClick={() => setStep(step + 1)}
                  disabled={!isStepValid()}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  variant="success"
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? "Submitting..." : "Submit Application"}
                  <CheckCircle className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          {/* Sidebar Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 gradient-hero text-primary-foreground">
              <CardHeader>
                <CardTitle className="text-lg">Loan Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="opacity-80">Principal</span>
                  <span className="font-semibold">{formatCurrency(formData.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-80">Interest Rate</span>
                  <span className="font-semibold">6.5% p.a.</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-80">Tenure</span>
                  <span className="font-semibold">{formData.tenure} months</span>
                </div>
                <div className="border-t border-white/20 pt-4">
                  <div className="flex justify-between mb-2">
                    <span className="opacity-80">Monthly EMI</span>
                    <span className="text-xl font-bold">{formatCurrency(emi)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="opacity-60">Total Amount</span>
                    <span className="opacity-80">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LoanApplication;
