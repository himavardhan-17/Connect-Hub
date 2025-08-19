
import { Badge } from "@/components/ui/badge";

// The TaskStatus type is now defined directly here.
type TaskStatus = "Pending" | "In Progress" | "Completed";

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const variant = {
    "Completed": "success",
    "In Progress": "secondary",
    "Pending": "destructive",
  }[status] as "success" | "secondary" | "destructive";

  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}
