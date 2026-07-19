import { useCallback, useEffect, useState } from "react";

import { supabase } from "../lib/supabase";
import { saveCurrentUserProfile } from "../utils/campaignSession";

function getProfileErrorMessage(error) {
  const message =
    error?.message || "Profile settings could not be saved.";

  if (
    error?.code === "PGRST202" ||
    message.toLowerCase().includes("update_own_campaign_profile")
  ) {
    return "Profile Settings has not been activated yet. Run the Profile Settings SQL in Supabase, then refresh.";
  }

  if (
    error?.code === "42501" ||
    message.toLowerCase().includes("permission")
  ) {
    return "Your account cannot update this campaign profile.";
  }

  return message;
}

export function useProfileSettings({
  userId,
  workspaceId,
  initialName = "",
  initialEmail = "",
}) {
  const [profile, setProfile] = useState({
    fullName: initialName,
    email: initialEmail,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setError("");

    try {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (data) {
        setProfile({
          fullName: data.full_name || initialName,
          email: data.email || initialEmail,
        });
      }
    } catch (profileError) {
      setError(getProfileErrorMessage(profileError));
    } finally {
      setIsLoading(false);
    }
  }, [initialEmail, initialName, userId]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [loadProfile]);

  const updateField = (field, value) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
    setError("");
    setSuccess("");
  };

  const saveProfile = useCallback(async () => {
    const fullName = String(profile.fullName || "").trim();

    if (!fullName) {
      throw new Error("Enter the full name.");
    }

    if (fullName.length > 160) {
      throw new Error("The full name must be 160 characters or fewer.");
    }

    if (!workspaceId) {
      throw new Error("No campaign workspace is selected.");
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: saveError } = await supabase.rpc(
        "update_own_campaign_profile",
        {
          target_workspace_id: workspaceId,
          target_full_name: fullName,
        },
      );

      if (saveError) {
        throw saveError;
      }

      const savedProfile = {
        fullName: data?.full_name || fullName,
        email: data?.email || profile.email,
      };

      setProfile(savedProfile);
      saveCurrentUserProfile({
        name: savedProfile.fullName,
        email: savedProfile.email,
      });
      setSuccess("Your profile has been updated.");

      return savedProfile;
    } catch (saveError) {
      const message = getProfileErrorMessage(saveError);
      setError(message);
      throw new Error(message, { cause: saveError });
    } finally {
      setIsSaving(false);
    }
  }, [profile.email, profile.fullName, workspaceId]);

  return {
    profile,
    isLoading,
    isSaving,
    error,
    success,
    updateField,
    saveProfile,
  };
}
