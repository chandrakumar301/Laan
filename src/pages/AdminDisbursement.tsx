import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";

interface DisbursementRequest {
  id: string;
  user_email: string;
  loan_id: string;
  amount: number;
  status: "pending" | "approved" | "disbursed" | "rejected";
  requested_at: string;
  admin_notes?: string;
  rejection_reason?: string;
}

const AdminDisbursement = () => {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [requests, setRequests] = useState<DisbursementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<DisbursementRequest | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "disbursed" | "rejected">("all");
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

      // Check if admin
      if (session.user.email !== "edufund0099@gmail.com") {
        navigate("/dashboard");
        return;
      }

      setUser({ email: session.user.email });
      await fetchRequests();
    };

    checkAuth();
  }, [navigate]);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/disbursement-requests`);
      const data = await response.json();

      if (data.ok) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      toast({
        title: "Error",
        description: "Failed to load disbursement requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!selectedRequest) return;

    setActionLoading(id);
    try {
      const response = await fetch(`${API_BASE}/api/admin/disbursement-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: notes }),
      });

      if (!response.ok) throw new Error("Failed to approve");

      toast({
        title: "Success",
        description: "Disbursement request approved",
      });

      setNotes("");
      setSelectedRequest(null);
      await fetchRequests();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to approve",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisburse = async (id: string) => {
    if (!selectedRequest) return;

    setActionLoading(id);
    try {
      const response = await fetch(`${API_BASE}/api/admin/disbursement-requests/${id}/disburse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to disburse");

      toast({
        title: "Success",
        description: "Loan disbursed successfully",
      });

      setSelectedRequest(null);
      await fetchRequests();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to disburse",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!selectedRequest) return;

    setActionLoading(id);
    try {
      const response = await fetch(`${API_BASE}/api/admin/disbursement-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (!response.ok) throw new Error("Failed to reject");

      toast({
        title: "Success",
        description: "Disbursement request rejected",
      });

      setRejectionReason("");
      setSelectedRequest(null);
      await fetchRequests();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to reject",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "approved":
        return <CheckCircle className="w-4 h-4 text-yellow-600" />;
      case "disbursed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-blue-100 text-blue-800";
      case "disbursed":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredRequests = requests.filter(
    (req) => statusFilter === "all" || req.status === statusFilter
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading disbursement requests...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={true} />

      <main className="flex-1 py-12 px-4 bg-gradient-to-b from-blue-50 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Disbursement Requests</h1>
            <p className="text-gray-600">Manage and process loan disbursement requests</p>
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {["all", "pending", "approved", "disbursed", "rejected"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                onClick={() => setStatusFilter(status as any)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>

          {/* Requests Grid */}
          {filteredRequests.length === 0 ? (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6 text-center">
                <p className="text-gray-700">No disbursement requests found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{request.user_email}</h3>
                          <Badge className={`capitalize flex items-center gap-1 ${getStatusColor(request.status)}`}>
                            {getStatusIcon(request.status)}
                            {request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">Loan ID: {request.loan_id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600 flex items-center gap-2">
                          <DollarSign className="w-6 h-6" />
                          ₹{request.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(request.requested_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Admin Notes */}
                    {request.admin_notes && (
                      <div className="mb-4 p-3 bg-blue-50 rounded text-sm">
                        <p className="font-medium text-blue-900">Admin Notes:</p>
                        <p className="text-blue-800">{request.admin_notes}</p>
                      </div>
                    )}

                    {/* Rejection Reason */}
                    {request.rejection_reason && (
                      <div className="mb-4 p-3 bg-red-50 rounded text-sm">
                        <p className="font-medium text-red-900">Rejection Reason:</p>
                        <p className="text-red-800">{request.rejection_reason}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {request.status === "pending" && (
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              className="text-green-600 hover:text-green-700 border-green-200"
                              onClick={() => setSelectedRequest(request)}
                            >
                              Approve
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Approve Disbursement Request</DialogTitle>
                              <DialogDescription>
                                User: {request.user_email} | Amount: ₹{request.amount}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium">Admin Notes (Optional)</label>
                                <Textarea
                                  placeholder="Add any notes for the user..."
                                  value={notes}
                                  onChange={(e) => setNotes(e.target.value)}
                                  className="mt-2"
                                />
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setNotes("");
                                    setSelectedRequest(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => handleApprove(request.id)}
                                  disabled={actionLoading === request.id}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {actionLoading === request.id ? "Approving..." : "Approve"}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              className="text-red-600 hover:text-red-700 border-red-200"
                              onClick={() => setSelectedRequest(request)}
                            >
                              Reject
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reject Disbursement Request</DialogTitle>
                              <DialogDescription>
                                User: {request.user_email} | Amount: ₹{request.amount}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium">Rejection Reason *</label>
                                <Textarea
                                  placeholder="Explain why this request is being rejected..."
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  className="mt-2"
                                  required
                                />
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setRejectionReason("");
                                    setSelectedRequest(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => handleReject(request.id)}
                                  disabled={!rejectionReason || actionLoading === request.id}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {actionLoading === request.id ? "Rejecting..." : "Reject"}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}

                    {request.status === "approved" && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            className="bg-green-600 hover:bg-green-700 w-full"
                            onClick={() => setSelectedRequest(request)}
                          >
                            Disburse Loan
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Confirm Disbursement</DialogTitle>
                            <DialogDescription>
                              This action will transfer ₹{request.amount} to {request.user_email}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
                              <p className="text-sm text-yellow-800">
                                ⚠️ Ensure bank details are verified before disbursing.
                              </p>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                onClick={() => setSelectedRequest(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => handleDisburse(request.id)}
                                disabled={actionLoading === request.id}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {actionLoading === request.id ? "Processing..." : "Confirm Disbursement"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminDisbursement;
