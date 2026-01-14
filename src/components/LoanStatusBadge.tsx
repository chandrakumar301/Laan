import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle, XCircle, Banknote, FileText } from "lucide-react";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
  {
    variants: {
      status: {
        pending: "bg-warning/10 text-warning",
        applied: "bg-primary/10 text-primary",
        approved: "bg-success/10 text-success",
        rejected: "bg-destructive/10 text-destructive",
        disbursed: "bg-accent/10 text-accent",
      },
    },
    defaultVariants: {
      status: "pending",
    },
  }
);

interface LoanStatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  className?: string;
}

const statusIcons = {
  pending: Clock,
  applied: FileText,
  approved: CheckCircle,
  rejected: XCircle,
  disbursed: Banknote,
};

const statusLabels = {
  pending: "Pending Review",
  applied: "Application Submitted",
  approved: "Approved",
  rejected: "Rejected",
  disbursed: "Disbursed",
};

export const LoanStatusBadge = ({ status, className }: LoanStatusBadgeProps) => {
  const Icon = statusIcons[status || "pending"];
  const label = statusLabels[status || "pending"];

  return (
    <span className={cn(statusBadgeVariants({ status }), className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
};
