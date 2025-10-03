import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SessionDetails } from "@/components/SessionDetails";
import { useNavigate } from "react-router-dom";

export default function PreparationDetails() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  if (!sessionId) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-muted-foreground">
          Session non trouvée
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SessionDetails 
        sessionId={sessionId} 
        onBack={() => navigate("/preparation")}
      />
    </DashboardLayout>
  );
}
