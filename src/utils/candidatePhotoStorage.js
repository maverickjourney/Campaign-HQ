import {
  supabase,
} from "../lib/supabase";


export const CANDIDATE_PHOTO_BUCKET =
  "candidate-photos";

export const LEGACY_CANDIDATE_PHOTO_BUCKET =
  "campaign-files";

export const MAX_CANDIDATE_PHOTO_SIZE =
  5 * 1024 * 1024;


function sanitizeFileName(
  value = "",
) {
  return (
    String(value)
      .trim()
      .replace(
        /\s+/g,
        "-",
      )
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "",
      ) ||
    "candidate-photo"
  );
}


export async function createCandidatePhotoSignedUrl(
  storagePath,
  expiresIn = 300,
) {
  const path =
    String(
      storagePath || "",
    ).trim();

  if (!path) {
    return "";
  }


  const buckets = [
    CANDIDATE_PHOTO_BUCKET,
    LEGACY_CANDIDATE_PHOTO_BUCKET,
  ];


  for (
    const bucket
    of buckets
  ) {
    try {
      const {
        data,
        error,
      } =
        await supabase.storage
          .from(
            bucket,
          )
          .createSignedUrl(
            path,
            expiresIn,
          );

      if (
        !error &&
        data?.signedUrl
      ) {
        return data.signedUrl;
      }
    } catch {
      // Try the legacy bucket next.
    }
  }


  return "";
}


export async function uploadCandidatePhoto(
  file,
) {
  if (!file) {
    throw new Error(
      "Choose a candidate photo.",
    );
  }


  if (
    !String(
      file.type || "",
    ).startsWith(
      "image/",
    )
  ) {
    throw new Error(
      "Choose a supported image file.",
    );
  }


  if (
    file.size >
    MAX_CANDIDATE_PHOTO_SIZE
  ) {
    throw new Error(
      "Choose a candidate photo smaller than 5 MB.",
    );
  }


  const {
    data: {
      user,
    },
    error:
      userError,
  } =
    await supabase.auth
      .getUser();


  if (
    userError ||
    !user?.id
  ) {
    throw new Error(
      "A signed-in Campaign Seat session is required.",
    );
  }


  const uniqueId =
    window.crypto
      ?.randomUUID?.() ||
    `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;


  const storagePath =
    `${user.id}/${uniqueId}-${sanitizeFileName(
      file.name,
    )}`;


  const {
    error:
      uploadError,
  } =
    await supabase.storage
      .from(
        CANDIDATE_PHOTO_BUCKET,
      )
      .upload(
        storagePath,
        file,
        {
          cacheControl:
            "3600",

          upsert:
            false,

          contentType:
            file.type ||
            "application/octet-stream",
        },
      );


  if (uploadError) {
    throw uploadError;
  }


  const previewUrl =
    await createCandidatePhotoSignedUrl(
      storagePath,
      600,
    );


  return {
    storagePath,
    previewUrl,
  };
}


export async function persistWorkspaceCandidatePhoto({
  workspaceId,
  storagePath,
}) {
  if (!workspaceId) {
    throw new Error(
      "No campaign workspace is selected.",
    );
  }


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "set_workspace_candidate_photo",
      {
        target_workspace_id:
          workspaceId,

        target_candidate_photo_path:
          storagePath ||
          null,
      },
    );


  if (error) {
    throw error;
  }


  const savedPath =
    data
      ?.candidate_photo_path ||
    "";


  const previewUrl =
    await createCandidatePhotoSignedUrl(
      savedPath,
      600,
    );


  window.dispatchEvent(
    new CustomEvent(
      "campaign-seat-candidate-photo-updated",
      {
        detail: {
          storagePath:
            savedPath,

          previewUrl:
            previewUrl ||
            "",
        },
      },
    ),
  );


  return {
    storagePath:
      savedPath,

    previewUrl:
      previewUrl ||
      "",
  };
}


export async function dataUrlToCandidatePhotoFile(
  dataUrl,
) {
  const value =
    String(
      dataUrl || "",
    );

  if (
    !value.startsWith(
      "data:image/",
    )
  ) {
    throw new Error(
      "The existing profile-photo preview is not a supported image.",
    );
  }


  const response =
    await fetch(
      value,
    );

  const blob =
    await response.blob();


  return new File(
    [
      blob,
    ],
    "candidate-profile-photo",
    {
      type:
        blob.type ||
        "image/jpeg",
    },
  );
}
