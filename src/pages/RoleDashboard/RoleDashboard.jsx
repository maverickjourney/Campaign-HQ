import DashboardReferencePreview from "../DashboardReferencePreview/DashboardReferencePreview";
import VolunteerDashboard from "../VolunteerDashboard/VolunteerDashboard";
import { getCampaignExperience } from "../../utils/campaignSession";

export default function RoleDashboard() {
  return getCampaignExperience().key === "volunteer"
    ? <VolunteerDashboard />
    : <DashboardReferencePreview />;
}
