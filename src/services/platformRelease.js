import { supabase } from "../lib/supabase";

export async function deployCampaignSeatApp({
  releaseNote = "",
} = {}) {
  const {
    data,
    error,
  } = await supabase.functions.invoke(
    "platform-app-release",
    {
      body: {
        releaseNote:
          String(releaseNote || "")
            .trim()
            .slice(0, 500),
      },
    },
  );

  if (error) {
    throw new Error(
      error.message ||
      "The App release could not be started.",
    );
  }

  if (!data?.ok) {
    throw new Error(
      data?.error ||
      "The App release could not be started.",
    );
  }

  return data;
}
