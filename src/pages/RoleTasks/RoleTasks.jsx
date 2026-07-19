import Tasks from "../Tasks/Tasks";
import VolunteerTasks from "../VolunteerTasks/VolunteerTasks";
import { getCampaignExperience } from "../../utils/campaignSession";

export default function RoleTasks() {
  return getCampaignExperience().key === "volunteer"
    ? <VolunteerTasks />
    : <Tasks />;
}
