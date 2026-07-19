import Dashboard from "../Dashboard/Dashboard";
import VolunteerDashboard from "../VolunteerDashboard/VolunteerDashboard";
import { getCampaignExperience } from "../../utils/campaignSession";

export default function RoleDashboard() {
  return getCampaignExperience().key === "volunteer"
    ? <VolunteerDashboard />
    : <Dashboard />;
}
