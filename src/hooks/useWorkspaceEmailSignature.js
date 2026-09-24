import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


const SIGNATURE_IMAGE_BUCKET =
  "campaign-email-signatures";

const MAX_SIGNATURE_IMAGE_BYTES =
  2 * 1024 * 1024;

const SIGNATURE_IMAGE_TYPES =
  new Set([
    "image/png",
    "image/jpeg",
  ]);


const EMPTY_SIGNATURE = {
  workspace_id:
    "",

  signature_name:
    "Campaign signature",

  signature_text:
    "",

  signature_mode:
    "text",

  signature_image_path:
    null,

  signature_image_url:
    "",

  enabled:
    false,

  include_on_new:
    true,

  include_on_reply:
    true,

  created_at:
    null,

  created_by:
    null,

  updated_at:
    null,

  updated_by:
    null,
};


function clean(
  value,
) {
  return String(
    value || "",
  ).trim();
}


function errorMessage(
  error,
  fallback,
) {
  return (
    clean(
      error?.message,
    ) ||
    fallback
  );
}


function normalizeSignatureMode(
  value,
) {
  return value ===
    "image"
    ? "image"
    : "text";
}


function signatureImageExtension(
  file,
) {
  return file?.type ===
    "image/png"
    ? "png"
    : "jpg";
}


function withSignatureImageUrl(
  row,
) {
  if (!row) {
    return row;
  }

  const path =
    clean(
      row.signature_image_path,
    );

  let publicUrl =
    "";

  if (path) {
    const {
      data,
    } =
      supabase
        .storage
        .from(
          SIGNATURE_IMAGE_BUCKET,
        )
        .getPublicUrl(
          path,
        );

    publicUrl =
      clean(
        data?.publicUrl,
      );
  }

  return {
    ...row,

    signature_mode:
      normalizeSignatureMode(
        row.signature_mode,
      ),

    signature_image_path:
      path ||
      null,

    signature_image_url:
      publicUrl,
  };
}


export function
useWorkspaceEmailSignature({
  workspaceId,
}) {
  const [
    signature,
    setSignature,
  ] = useState({
    ...EMPTY_SIGNATURE,

    workspace_id:
      workspaceId ||
      "",
  });

  const [
    exists,
    setExists,
  ] = useState(false);

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


  const loadSignature =
    useCallback(
      async () => {
        if (
          !workspaceId
        ) {
          setSignature({
            ...EMPTY_SIGNATURE,

            workspace_id:
              "",
          });

          setExists(
            false,
          );

          setIsLoading(
            false,
          );

          return null;
        }

        setIsLoading(
          true,
        );

        try {
          const {
            data,
            error:
              queryError,
          } =
            await supabase
              .from(
                "workspace_email_signature_settings",
              )
              .select(
                `
                  workspace_id,
                  signature_name,
                  signature_text,
                  signature_mode,
                  signature_image_path,
                  enabled,
                  include_on_new,
                  include_on_reply,
                  created_at,
                  created_by,
                  updated_at,
                  updated_by
                `,
              )
              .eq(
                "workspace_id",
                workspaceId,
              )
              .maybeSingle();

          if (
            queryError
          ) {
            throw queryError;
          }

          if (data) {
            const normalized =
              withSignatureImageUrl(
                data,
              );

            setSignature(
              normalized,
            );

            setExists(
              true,
            );

            setError(
              "",
            );

            return normalized;
          }

          const empty = {
            ...EMPTY_SIGNATURE,

            workspace_id:
              workspaceId,
          };

          setSignature(
            empty,
          );

          setExists(
            false,
          );

          setError(
            "",
          );

          return null;
        } catch (
          loadError
        ) {
          setError(
            errorMessage(
              loadError,
              "Campaign Seat could not load the email signature.",
            ),
          );

          return null;
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        workspaceId,
      ],
    );


  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          void loadSignature();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    loadSignature,
  ]);


  const saveSignature =
    useCallback(
      async ({
        signatureName,
        signatureText,

        signatureMode =
          "text",

        signatureImageFile =
          null,

        removeSignatureImage =
          false,

        enabled,

        includeOnNew,

        includeOnReply,
      }) => {
        if (
          !workspaceId
        ) {
          throw new Error(
            "No campaign workspace is selected.",
          );
        }

        const normalizedName =
          clean(
            signatureName,
          ) ||
          "Campaign signature";

        const normalizedText =
          String(
            signatureText ||
              "",
          )
            .replace(
              /\r\n/g,
              "\n",
            )
            .replace(
              /\r/g,
              "\n",
            )
            .trim();

        const normalizedMode =
          normalizeSignatureMode(
            signatureMode,
          );

        const existingImagePath =
          clean(
            signature
              ?.signature_image_path,
          );

        const imageFile =
          signatureImageFile &&
          typeof signatureImageFile ===
            "object"
            ? signatureImageFile
            : null;

        if (
          normalizedName.length >
          120
        ) {
          throw new Error(
            "Signature name must be 120 characters or fewer.",
          );
        }

        if (
          normalizedText.length >
          10000
        ) {
          throw new Error(
            "Signature text must be 10,000 characters or fewer.",
          );
        }

        if (imageFile) {
          if (
            !SIGNATURE_IMAGE_TYPES.has(
              imageFile.type,
            )
          ) {
            throw new Error(
              "Upload a PNG or JPG signature image.",
            );
          }

          if (
            imageFile.size >
            MAX_SIGNATURE_IMAGE_BYTES
          ) {
            throw new Error(
              "Signature images can be up to 2 MB.",
            );
          }
        }

        const imageWillExist =
          Boolean(
            imageFile ||
            (
              !removeSignatureImage &&
              existingImagePath
            ),
          );

        if (
          enabled &&
          normalizedMode ===
            "text" &&
          !normalizedText
        ) {
          throw new Error(
            "Enter signature text before enabling the text signature.",
          );
        }

        if (
          enabled &&
          normalizedMode ===
            "image" &&
          !imageWillExist
        ) {
          throw new Error(
            "Upload a signature image before enabling the image signature.",
          );
        }

        setIsSaving(
          true,
        );

        setError(
          "",
        );

        let uploadedImagePath =
          "";

        try {
          let nextImagePath =
            removeSignatureImage
              ? ""
              : existingImagePath;

          if (imageFile) {
            const token =
              globalThis
                .crypto
                ?.randomUUID
                ?.() ||
              (
                `${Date.now()}-` +
                Math.random()
                  .toString(36)
                  .slice(2)
              );

            const extension =
              signatureImageExtension(
                imageFile,
              );

            uploadedImagePath =
              (
                `${workspaceId}/` +
                `${Date.now()}-` +
                `${token}.` +
                extension
              );

            const {
              error:
                uploadError,
            } =
              await supabase
                .storage
                .from(
                  SIGNATURE_IMAGE_BUCKET,
                )
                .upload(
                  uploadedImagePath,
                  imageFile,
                  {
                    cacheControl:
                      "31536000",

                    contentType:
                      imageFile.type,

                    upsert:
                      false,
                  },
                );

            if (
              uploadError
            ) {
              throw uploadError;
            }

            nextImagePath =
              uploadedImagePath;
          }

          const payload = {
            workspace_id:
              workspaceId,

            signature_name:
              normalizedName,

            signature_text:
              normalizedText,

            signature_mode:
              normalizedMode,

            signature_image_path:
              nextImagePath ||
              null,

            enabled:
              Boolean(
                enabled,
              ),

            include_on_new:
              Boolean(
                includeOnNew,
              ),

            include_on_reply:
              Boolean(
                includeOnReply,
              ),
          };

          const {
            data,
            error:
              saveError,
          } =
            await supabase
              .from(
                "workspace_email_signature_settings",
              )
              .upsert(
                payload,
                {
                  onConflict:
                    "workspace_id",
                },
              )
              .select(
                `
                  workspace_id,
                  signature_name,
                  signature_text,
                  signature_mode,
                  signature_image_path,
                  enabled,
                  include_on_new,
                  include_on_reply,
                  created_at,
                  created_by,
                  updated_at,
                  updated_by
                `,
              )
              .single();

          if (
            saveError
          ) {
            throw saveError;
          }

          const normalized =
            withSignatureImageUrl(
              data,
            );

          setSignature(
            normalized,
          );

          setExists(
            true,
          );

          /*
           * Unique upload paths prevent stale cached signatures.
           * Old asset cleanup should never block the save.
           */
          if (
            existingImagePath &&
            existingImagePath !==
              nextImagePath &&
            (
              imageFile ||
              removeSignatureImage
            )
          ) {
            void supabase
              .storage
              .from(
                SIGNATURE_IMAGE_BUCKET,
              )
              .remove([
                existingImagePath,
              ]);
          }

          return normalized;
        } catch (
          saveFailure
        ) {
          /*
           * Avoid orphaned uploads if the database write fails.
           */
          if (
            uploadedImagePath
          ) {
            try {
              await supabase
                .storage
                .from(
                  SIGNATURE_IMAGE_BUCKET,
                )
                .remove([
                  uploadedImagePath,
                ]);
            } catch {
              // Best-effort cleanup only.
            }
          }

          const message =
            errorMessage(
              saveFailure,
              "Campaign Seat could not save the email signature.",
            );

          setError(
            message,
          );

          throw new Error(
            message,
          );
        } finally {
          setIsSaving(
            false,
          );
        }
      },
      [
        signature
          ?.signature_image_path,

        workspaceId,
      ],
    );


  return {
    signature,
    exists,
    isLoading,
    isSaving,
    error,

    refresh:
      loadSignature,

    saveSignature,
  };
}
