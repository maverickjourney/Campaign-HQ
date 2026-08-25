import {
  supabase,
} from "../lib/supabase";


export const CANDIDATE_PHOTO_BUCKET =
  "candidate-photos";

export const LEGACY_CANDIDATE_PHOTO_BUCKET =
  "campaign-files";


/*
 * A user can select a normal high-resolution phone photo.
 * Campaign Seat optimizes it BEFORE uploading.
 */
export const MAX_CANDIDATE_PHOTO_SOURCE_SIZE =
  20 * 1024 * 1024;


/*
 * Kept for compatibility with any existing imports.
 */
export const MAX_CANDIDATE_PHOTO_SIZE =
  MAX_CANDIDATE_PHOTO_SOURCE_SIZE;


/*
 * 1600px gives us enough resolution for:
 * - Campaign HQ portrait
 * - Retina / high-DPI screens
 * - profile views
 *
 * without shipping the original 8–20 megapixel image.
 */
const MAX_CANDIDATE_PHOTO_EDGE =
  1600;


/*
 * Aim for roughly 1.25 MB or less.
 * Most candidate photos will land far below this.
 */
const TARGET_CANDIDATE_PHOTO_BYTES =
  1.25 * 1024 * 1024;


/*
 * Storage bucket itself is capped at 5 MB.
 * Optimized output should never approach this,
 * but this remains a final safety guard.
 */
const MAX_OPTIMIZED_PHOTO_BYTES =
  5 * 1024 * 1024;


const SIGNED_URL_EXPIRY_BUFFER_MS =
  30 * 1000;


const signedUrlCache =
  new Map();


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


function withoutExtension(
  value,
) {
  return String(
    value || "",
  )
    .replace(
      /\.[^.]+$/,
      "",
    )
    .replace(
      /\.+$/,
      "",
    ) ||
    "candidate-photo";
}


function canvasToBlob(
  canvas,
  type,
  quality,
) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error(
                  "The candidate photo could not be compressed.",
                ),
              );

              return;
            }

            resolve(
              blob,
            );
          },
          type,
          quality,
        );
      } catch (
        error
      ) {
        reject(
          error,
        );
      }
    },
  );
}


async function decodeCandidatePhoto(
  file,
) {
  if (
    typeof createImageBitmap ===
    "function"
  ) {
    try {
      const bitmap =
        await createImageBitmap(
          file,
          {
            imageOrientation:
              "from-image",
          },
        );

      return {
        source:
          bitmap,

        width:
          bitmap.width,

        height:
          bitmap.height,

        cleanup: () => {
          bitmap.close?.();
        },
      };
    } catch {
      /*
       * Fall through to the regular browser image decoder.
       */
    }
  }


  const objectUrl =
    URL.createObjectURL(
      file,
    );

  const image =
    new Image();

  image.decoding =
    "async";


  try {
    await new Promise(
      (
        resolve,
        reject,
      ) => {
        image.onload =
          resolve;

        image.onerror =
          () =>
            reject(
              new Error(
                "This image format could not be prepared. Choose a JPEG, PNG or WebP photo.",
              ),
            );

        image.src =
          objectUrl;
      },
    );


    return {
      source:
        image,

      width:
        image.naturalWidth,

      height:
        image.naturalHeight,

      cleanup: () => {
        URL.revokeObjectURL(
          objectUrl,
        );
      },
    };
  } catch (
    error
  ) {
    URL.revokeObjectURL(
      objectUrl,
    );

    throw error;
  }
}


function getScaledDimensions(
  sourceWidth,
  sourceHeight,
  maxEdge,
) {
  const width =
    Number(
      sourceWidth,
    );

  const height =
    Number(
      sourceHeight,
    );


  if (
    !Number.isFinite(
      width,
    ) ||
    !Number.isFinite(
      height,
    ) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      "The candidate photo dimensions are invalid.",
    );
  }


  const longestEdge =
    Math.max(
      width,
      height,
    );


  const scale =
    Math.min(
      1,
      maxEdge /
        longestEdge,
    );


  return {
    width:
      Math.max(
        1,
        Math.round(
          width *
            scale,
        ),
      ),

    height:
      Math.max(
        1,
        Math.round(
          height *
            scale,
        ),
      ),
  };
}


function drawCandidatePhoto(
  decoded,
  width,
  height,
) {
  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width =
    width;

  canvas.height =
    height;


  const context =
    canvas.getContext(
      "2d",
      {
        alpha:
          true,
      },
    );


  if (!context) {
    throw new Error(
      "This browser could not prepare the candidate photo.",
    );
  }


  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";


  context.drawImage(
    decoded.source,
    0,
    0,
    width,
    height,
  );


  return canvas;
}


async function encodeCandidatePhoto(
  canvas,
  quality,
) {
  /*
   * WebP is substantially smaller than the source JPG/PNG
   * in modern browsers and supports transparency.
   */
  try {
    const webp =
      await canvasToBlob(
        canvas,
        "image/webp",
        quality,
      );

    if (
      webp?.type ===
      "image/webp"
    ) {
      return webp;
    }
  } catch {
    /*
     * Older browser fallback below.
     */
  }


  return canvasToBlob(
    canvas,
    "image/jpeg",
    quality,
  );
}


export async function optimizeCandidatePhoto(
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
    MAX_CANDIDATE_PHOTO_SOURCE_SIZE
  ) {
    throw new Error(
      "Choose a candidate photo smaller than 20 MB.",
    );
  }


  const decoded =
    await decodeCandidatePhoto(
      file,
    );


  try {
    /*
     * Start at 1600px and step down only when necessary.
     * This avoids both huge uploads and unnecessary quality loss.
     */
    const edgeSteps = [
      1600,
      1440,
      1280,
      1120,
    ];


    const qualitySteps = [
      0.84,
      0.78,
      0.72,
      0.66,
    ];


    let bestBlob =
      null;

    let bestWidth =
      0;

    let bestHeight =
      0;


    for (
      const requestedEdge
      of edgeSteps
    ) {
      const maxEdge =
        Math.min(
          requestedEdge,
          MAX_CANDIDATE_PHOTO_EDGE,
        );


      const dimensions =
        getScaledDimensions(
          decoded.width,
          decoded.height,
          maxEdge,
        );


      const canvas =
        drawCandidatePhoto(
          decoded,
          dimensions.width,
          dimensions.height,
        );


      for (
        const quality
        of qualitySteps
      ) {
        const blob =
          await encodeCandidatePhoto(
            canvas,
            quality,
          );


        bestBlob =
          blob;

        bestWidth =
          dimensions.width;

        bestHeight =
          dimensions.height;


        if (
          blob.size <=
          TARGET_CANDIDATE_PHOTO_BYTES
        ) {
          break;
        }
      }


      canvas.width =
        1;

      canvas.height =
        1;


      if (
        bestBlob &&
        bestBlob.size <=
        TARGET_CANDIDATE_PHOTO_BYTES
      ) {
        break;
      }
    }


    if (!bestBlob) {
      throw new Error(
        "The candidate photo could not be optimized.",
      );
    }


    if (
      bestBlob.size >
      MAX_OPTIMIZED_PHOTO_BYTES
    ) {
      throw new Error(
        "The candidate photo remained too large after optimization. Choose another image.",
      );
    }


    const originalName =
      sanitizeFileName(
        file.name ||
        "candidate-photo",
      );


    const baseName =
      withoutExtension(
        originalName,
      );


    const extension =
      bestBlob.type ===
      "image/webp"
        ? "webp"
        : "jpg";


    const optimizedFile =
      new File(
        [
          bestBlob,
        ],
        `${baseName}.${extension}`,
        {
          type:
            bestBlob.type,

          lastModified:
            Date.now(),
        },
      );


    return {
      file:
        optimizedFile,

      width:
        bestWidth,

      height:
        bestHeight,

      originalSizeBytes:
        file.size,

      optimizedSizeBytes:
        optimizedFile.size,
    };
  } finally {
    decoded.cleanup?.();
  }
}


export async function createCandidatePhotoSignedUrl(
  storagePath,
  expiresIn = 21600,
) {
  const path =
    String(
      storagePath || "",
    ).trim();


  if (!path) {
    return "";
  }


  const cached =
    signedUrlCache.get(
      path,
    );


  if (
    cached &&
    cached.expiresAt >
      (
        Date.now() +
        SIGNED_URL_EXPIRY_BUFFER_MS
      )
  ) {
    return cached.url;
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
        const url =
          data.signedUrl;


        signedUrlCache.set(
          path,
          {
            url,

            expiresAt:
              Date.now() +
              Math.max(
                60,
                expiresIn -
                  30,
              ) *
                1000,
          },
        );


        return url;
      }
    } catch {
      /*
       * Canonical bucket did not contain this path.
       * Try the legacy campaign-files bucket next.
       */
    }
  }


  return "";
}


export async function uploadCandidatePhoto(
  sourceFile,
) {
  const {
    file,
    width,
    height,
    originalSizeBytes,
    optimizedSizeBytes,
  } =
    await optimizeCandidatePhoto(
      sourceFile,
    );


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
          /*
           * Every upload has a unique UUID path,
           * so it is safe to cache aggressively.
           */
          cacheControl:
            "31536000",

          upsert:
            false,

          contentType:
            file.type ||
            "image/webp",
        },
      );


  if (uploadError) {
    throw uploadError;
  }


  const previewUrl =
    await createCandidatePhotoSignedUrl(
      storagePath,
      21600,
    );


  return {
    storagePath,

    previewUrl,

    width,

    height,

    originalSizeBytes,

    optimizedSizeBytes,
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
      21600,
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
