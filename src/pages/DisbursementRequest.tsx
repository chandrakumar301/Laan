import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DollarSign, CheckCircle } from "lucide-react";

interface Loan {
  id: string;
  student_name: string;
  amount: number;
  status: string;
  disbursement_status: string;
}

const DisbursementRequest = () => {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bankDetails, setBankDetails] = useState({
    accountNumber: "",
    accountHolder: "",
    bankName: "",
    ifscCode: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      setUser({ email: session.user.email || "" });

      // Fetch user's approved loans
      try {
        const { data: userLoans } = await supabase
          .from("loans")
          .select("*")
          .eq("student_email", session.user.email || "")
          .eq("status", "approved")
          .is("disbursement_status", null);

        setLoans(userLoans || []);
      } catch (err) {
        console.error("Failed to fetch loans:", err);
        toast({
          title: "Error",
          description: "Failed to load loans",
          variant: "destructive",
        });
      }

      setLoading(false);
    };

    checkAuth();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLoan || !bankDetails.accountNumber) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: "Error",
          description: "Session expired. Please login again.",
          variant: "destructive",
        });
        return;
      }

      const loan = loans.find(l => l.id === selectedLoan);
      if (!loan) {
        toast({
          title: "Error",
          description: "Loan not found",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`${API_BASE}/api/disbursement-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          loanId: selectedLoan,
          amount: loan.amount,
          bankAccountNumber: bankDetails.accountNumber,
          bankAccountHolder: bankDetails.accountHolder,
          bankName: bankDetails.bankName,
          ifscCode: bankDetails.ifscCode,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit disbursement request");
      }

      toast({
        title: "Success",
        description: "Disbursement request submitted. Admin will review it soon.",
      });

      // Reset form
      setSelectedLoan(null);
      setBankDetails({
        accountNumber: "",
        accountHolder: "",
        bankName: "",
        ifscCode: "",
      });

      // Refresh loans
      const { data: updatedLoans } = await supabase
        .from("loans")
        .select("*")
        .eq("student_email", session.user.email || "")
        .eq("status", "approved")
        .is("disbursement_status", null);

      setLoans(updatedLoans || []);
    } catch (err) {
      console.error("Submission error:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit request",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={false} />

      <main className="flex-1 py-12 px-4 bg-gradient-to-b from-blue-50 to-transparent">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Request Loan Disbursement</h1>
            <p className="text-gray-600">Submit your bank details for approved loans</p>
          </div>

          {loans.length === 0 ? (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                  <p className="text-gray-700">You have no approved loans pending disbursement.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Available Loans</CardTitle>
                <CardDescription>Select a loan and provide your bank details</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Loan Selection */}
                  <div className="space-y-3">
                    <Label>Select Loan</Label>
                    <div className="space-y-2">
                      {loans.map((loan) => (
                        <label
                          key={loan.id}
                          className={`flex items-center p-4 border rounded-lg cursor-pointer transition ${
                            selectedLoan === loan.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="loan"
                            value={loan.id}
                            checked={selectedLoan === loan.id}
                            onChange={(e) => setSelectedLoan(e.target.value)}
                            className="w-4 h-4"
                          />
                          <div className="ml-4 flex-1">
                            <p className="font-medium">{loan.student_name}</p>
                            <p className="text-sm text-gray-600">₹{loan.amount.toLocaleString()}</p>
                          </div>
                          <DollarSign className="w-5 h-5 text-blue-600" />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Bank Details */}
                  {selectedLoan && (
                    <div className="space-y-4 border-t pt-6">
                      <h3 className="font-semibold">Bank Account Details</h3>

                      <div className="space-y-2">
                        <Label htmlFor="accountHolder">Account Holder Name *</Label>
                        <Input
                          id="accountHolder"
                          placeholder="Full name on bank account"
                          value={bankDetails.accountHolder}
                          onChange={(e) =>
                            setBankDetails({ ...bankDetails, accountHolder: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="accountNumber">Account Number *</Label>
                        <Input
                          id="accountNumber"
                          placeholder="Enter account number"
                          value={bankDetails.accountNumber}
                          onChange={(e) =>
                            setBankDetails({ ...bankDetails, accountNumber: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="bankName">Bank Name *</Label>
                          <Input
                            id="bankName"
                            placeholder="e.g., HDFC Bank"
                            value={bankDetails.bankName}
                            onChange={(e) =>
                              setBankDetails({ ...bankDetails, bankName: e.target.value })
                            }
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="ifscCode">IFSC Code *</Label>
                          <Input
                            id="ifscCode"
                            placeholder="e.g., HDFC0000001"
                            value={bankDetails.ifscCode}
                            onChange={(e) =>
                              setBankDetails({ ...bankDetails, ifscCode: e.target.value })
                            }
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/dashboard")}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!selectedLoan || submitting}
                      className="flex-1"
                    >
                      {submitting ? "Submitting..." : "Request Disbursement"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default DisbursementRequest;
