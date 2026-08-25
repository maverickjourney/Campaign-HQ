import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

import {
  createCandidatePhotoSignedUrl,
} from "../utils/candidatePhotoStorage";


import {
  saveWorkspace,
} from "../utils/campaignSession";

const EMPTY_PROFILE = {
  candidateName: "",
  candidateBio: "",
  candidatePhotoPath: "",
  candidatePublicEmail: "",
  candidatePublicPhone: "",
  publicCampaignName: "",
  legalCommitteeName: "",
  officeSought: "",
  officeLevel: "",
  districtLabel: "",
  jurisdictionName: "",
  jurisdictionType: "",
  primaryElectionDate: "",
  generalElectionDate: "",
  timezone: "America/New_York",
  campaignEmail: "",
  campaignPhone: "",
  websiteUrl: "",
  disclaimerText: "",
};

function normalizeProfile(
  row = {},
  fallback = {},
) {
  return {
    candidateName:
      row.candidate_name ??
      row.candidateName ??
      fallback.candidateName ??
      "",

    candidateBio:
      row.candidate_bio ??
      row.candidateBio ??
      fallback.candidateBio ??
      "",

    candidatePhotoPath:
      row.candidate_photo_path ??
      row.candidatePhotoPath ??
      fallback.candidatePhotoPath ??
      "",

    candidatePublicEmail:
      row.candidate_public_email ??
      row.candidatePublicEmail ??
      fallback.candidatePublicEmail ??
      "",

    candidatePublicPhone:
      row.candidate_public_phone ??
      row.candidatePublicPhone ??
      fallback.candidatePublicPhone ??
      "",

    publicCampaignName:
      row.name ??
      row.publicCampaignName ??
      fallback.publicCampaignName ??
      "",

    legalCommitteeName:
      row.legal_committee_name ??
      row.legalCommitteeName ??
      fallback.legalCommitteeName ??
      "",

    officeSought:
      row.office_sought ??
      row.officeSought ??
      fallback.officeSought ??
      "",

    officeLevel:
      row.office_level ??
      row.officeLevel ??
      fallback.officeLevel ??
      "",

    districtLabel:
      row.district_label ??
      row.districtLabel ??
      fallback.districtLabel ??
      "",

    jurisdictionName:
      row.jurisdiction_name ??
      row.jurisdictionName ??
      fallback.jurisdictionName ??
      "",

    jurisdictionType:
      row.jurisdiction_type ??
      row.jurisdictionType ??
      fallback.jurisdictionType ??
      "",

    primaryElectionDate:
      row.primary_election_date ??
      row.primaryElectionDate ??
      fallback.primaryElectionDate ??
      "",

    generalElectionDate:
      row.general_election_date ??
      row.generalElectionDate ??
      fallback.generalElectionDate ??
      "",

    timezone:
      row.timezone ??
      fallback.timezone ??
      "America/New_York",

    campaignEmail:
      row.campaign_email ??
      row.campaignEmail ??
      fallback.campaignEmail ??
      "",

    campaignPhone:
      row.campaign_phone ??
      row.campaignPhone ??
      fallback.campaignPhone ??
      "",

    websiteUrl:
      row.website_url ??
      row.websiteUrl ??
      fallback.websiteUrl ??
      "",

    disclaimerText:
      row.disclaimer_text ??
      row.disclaimerText ??
      fallback.disclaimerText ??
      "",
  };
}

function getCandidateProfileErrorMessage(
  error,
) {
  const message =
    error?.message ||
    "Candidate profile could not be updated.";

  const normalized =
    message.toLowerCase();

  if (
    normalized.includes("aal2") ||
    normalized.includes("mfa") ||
    normalized.includes(
      "two-step",
    )
  ) {
    return "Complete two-step verification before changing the candidate profile.";
  }

  if (
    error?.code === "42501" ||
    normalized.includes(
      "cannot manage",
    ) ||
    normalized.includes(
      "not authorized",
    )
  ) {
    return "Your campaign role is not authorized to manage the candidate profile.";
  }

  if (
    error?.code === "PGRST202" ||
    normalized.includes(
      "manage_candidate_campaign_profile",
    )
  ) {
    return "Candidate profile management is not available in the connected database.";
  }

  return message;
}

export function useCandidateProfileManagement({
  workspaceId,
  initialWorkspace,
}) {
  const initialProfile = {
    ...EMPTY_PROFILE,
    candidateName:
      initialWorkspace?.candidateName ||
      "",
    publicCampaignName:
      initialWorkspace?.name ||
      "",
    jurisdictionName:
      initialWorkspace?.location ||
      "",
  };

  const [
    profile,
    setProfile,
  ] = useState(
    initialProfile,
  );

  const [
    savedProfile,
    setSavedProfile,
  ] = useState(
    initialProfile,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    photoPreviewUrl,
    setPhotoPreviewUrl,
  ] = useState("");

  const loadPhotoPreview =
    useCallback(
      async (storagePath) => {
        if (!storagePath) {
          setPhotoPreviewUrl("");
          return "";
        }

        try {
          const url =
            await createCandidatePhotoSignedUrl(
              storagePath,
              300,
            );

          setPhotoPreviewUrl(
            url,
          );

          return url;
        } catch {
          setPhotoPreviewUrl(
            "",
          );
          return "";
        }
      },
      [],
    );

  const loadProfile =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (!workspaceId) {
          setError(
            "No campaign workspace is selected.",
          );
          setIsLoading(false);
          return null;
        }

        if (showLoading) {
          setIsLoading(true);
        }

        setError("");

        try {
          const {
            data,
            error: loadError,
          } = await supabase
            .from("workspaces")
            .select(`
              id,
              name,
              candidate_name,
              candidate_bio,
              candidate_photo_path,
              candidate_public_email,
              candidate_public_phone,
              legal_committee_name,
              office_sought,
              office_level,
              district_label,
              jurisdiction_name,
              jurisdiction_type,
              primary_election_date,
              general_election_date,
              timezone,
              campaign_email,
              campaign_phone,
              website_url,
              disclaimer_text
            `)
            .eq(
              "id",
              workspaceId,
            )
            .single();

          if (loadError) {
            throw loadError;
          }

          const normalized =
            normalizeProfile(
              data,
              initialProfile,
            );

          setProfile(
            normalized,
          );

          setSavedProfile(
            normalized,
          );

          await loadPhotoPreview(
            normalized
              .candidatePhotoPath,
          );

          return normalized;
        } catch (loadError) {
          setError(
            getCandidateProfileErrorMessage(
              loadError,
            ),
          );

          return null;
        } finally {
          setIsLoading(false);
        }
      },
      [
        workspaceId,
        initialWorkspace?.name,
        initialWorkspace?.location,
        initialWorkspace?.candidateName,
        loadPhotoPreview,
      ],
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadProfile({
            showLoading: true,
          });
        },
        0,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [loadProfile]);

  const updateField =
    useCallback(
      (field, value) => {
        setProfile(
          (current) => ({
            ...current,
            [field]: value,
          }),
        );

        setError("");
        setSuccess("");
      },
      [],
    );

  const setCandidatePhoto =
    useCallback(
      async (storagePath) => {
        updateField(
          "candidatePhotoPath",
          storagePath || "",
        );

        const previewUrl =
          await loadPhotoPreview(
            storagePath,
          );

        window.dispatchEvent(
          new CustomEvent(
            "campaign-seat-candidate-photo-updated",
            {
              detail: {
                storagePath:
                  storagePath || "",
                previewUrl:
                  previewUrl || "",
              },
            },
          ),
        );
      },
      [
        loadPhotoPreview,
        updateField,
      ],
    );

  const resetChanges =
    useCallback(() => {
      setProfile(
        savedProfile,
      );

      setError("");
      setSuccess("");

      void loadPhotoPreview(
        savedProfile
          .candidatePhotoPath,
      ).then(
        (previewUrl) => {
          window.dispatchEvent(
            new CustomEvent(
              "campaign-seat-candidate-photo-updated",
              {
                detail: {
                  storagePath:
                    savedProfile
                      .candidatePhotoPath ||
                    "",
                  previewUrl:
                    previewUrl || "",
                },
              },
            ),
          );
        },
      );
    }, [
      savedProfile,
      loadPhotoPreview,
    ]);

  const saveCandidateProfile =
    useCallback(
      async () => {
        const candidateName =
          String(
            profile
              .candidateName ||
              "",
          ).trim();

        if (!candidateName) {
          throw new Error(
            "Enter the candidate name.",
          );
        }

        if (
          candidateName.length >
          160
        ) {
          throw new Error(
            "Candidate name must be 160 characters or fewer.",
          );
        }

        if (
          profile.candidateBio
            .trim().length >
          4000
        ) {
          throw new Error(
            "Candidate biography must be 4000 characters or fewer.",
          );
        }

        if (!workspaceId) {
          throw new Error(
            "No campaign workspace is selected.",
          );
        }

        setIsSaving(true);
        setError("");
        setSuccess("");

        try {
          const {
            data,
            error: saveError,
          } =
            await supabase.rpc(
              "manage_candidate_campaign_profile",
              {
                target_workspace_id:
                  workspaceId,

                target_candidate_name:
                  candidateName,

                target_candidate_bio:
                  profile
                    .candidateBio
                    .trim() ||
                  null,

                target_candidate_photo_path:
                  profile
                    .candidatePhotoPath ||
                  null,

                target_candidate_public_email:
                  profile
                    .candidatePublicEmail
                    .trim() ||
                  null,

                target_candidate_public_phone:
                  profile
                    .candidatePublicPhone
                    .trim() ||
                  null,

                target_public_campaign_name:
                  profile
                    .publicCampaignName
                    .trim() ||
                  null,

                target_legal_committee_name:
                  profile
                    .legalCommitteeName
                    .trim() ||
                  null,

                target_office_sought:
                  profile
                    .officeSought
                    .trim() ||
                  null,

                target_office_level:
                  profile.officeLevel ||
                  null,

                target_district_label:
                  profile
                    .districtLabel
                    .trim() ||
                  null,

                target_jurisdiction_name:
                  profile
                    .jurisdictionName
                    .trim() ||
                  null,

                target_jurisdiction_type:
                  profile
                    .jurisdictionType ||
                  null,

                target_primary_election_date:
                  profile
                    .primaryElectionDate ||
                  null,

                target_general_election_date:
                  profile
                    .generalElectionDate ||
                  null,

                target_timezone:
                  profile.timezone ||
                  null,

                target_campaign_email:
                  profile
                    .campaignEmail
                    .trim() ||
                  null,

                target_campaign_phone:
                  profile
                    .campaignPhone
                    .trim() ||
                  null,

                target_website_url:
                  profile
                    .websiteUrl
                    .trim() ||
                  null,

                target_disclaimer_text:
                  profile
                    .disclaimerText
                    .trim() ||
                  null,
              },
            );

          if (saveError) {
            throw saveError;
          }

          const normalized =
            normalizeProfile(
              data || {},
              profile,
            );

          setProfile(
            normalized,
          );

          setSavedProfile(
            normalized,
          );

          saveWorkspace({
            id:
              workspaceId,

            name:
              normalized
                .publicCampaignName,

            description:
              [
                normalized
                  .officeSought,
                normalized
                  .districtLabel,
              ]
                .filter(Boolean)
                .join(", "),

            location:
              normalized
                .jurisdictionName,

            election_date:
              normalized
                .primaryElectionDate ||
              normalized
                .generalElectionDate,

            candidate_name:
              normalized
                .candidateName,

            candidate_photo_path:
              normalized
                .candidatePhotoPath,
          });

          await loadPhotoPreview(
            normalized
              .candidatePhotoPath,
          );

          setSuccess(
            "Candidate profile updated.",
          );

          return normalized;
        } catch (saveError) {
          const message =
            getCandidateProfileErrorMessage(
              saveError,
            );

          setError(message);

          throw new Error(
            message,
            {
              cause:
                saveError,
            },
          );
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadPhotoPreview,
        profile,
        workspaceId,
      ],
    );

  const hasChanges =
    JSON.stringify(
      profile,
    ) !==
    JSON.stringify(
      savedProfile,
    );

  return {
    profile,
    photoPreviewUrl,
    isLoading,
    isSaving,
    error,
    success,
    hasChanges,
    updateField,
    setCandidatePhoto,
    resetChanges,
    refresh: () =>
      loadProfile({
        showLoading: true,
      }),
    saveCandidateProfile,
  };
}
