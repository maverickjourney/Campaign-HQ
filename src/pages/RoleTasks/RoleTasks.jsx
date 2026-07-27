import TasksReferencePreview from "../TasksReferencePreview/TasksReferencePreview";
import VolunteerTasks from "../VolunteerTasks/VolunteerTasks";
import { getCampaignExperience } from "../../utils/campaignSession";

export default function RoleTasks() {
  return getCampaignExperience().key === "volunteer"
    ? <VolunteerTasks />
    : <TasksReferencePreview />;
}
