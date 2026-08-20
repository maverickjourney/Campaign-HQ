import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


const EMPTY_SIGNATURE = {
  workspace_id:
    "",
  signature_name:
    "Campaign signature",
  signature_text:
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
      workspaceId || "",
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

          if (
            data
          ) {
            setSignature(
              data,
            );

            setExists(
              true,
            );
          } else {
            setSignature({
              ...EMPTY_SIGNATURE,
              workspace_id:
                workspaceId,
            });

            setExists(
              false,
            );
          }

          setError(
            "",
          );

          return (
            data ||
            null
          );
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
            signatureText || "",
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

        if (
          enabled &&
          !normalizedText
        ) {
          throw new Error(
            "Enter signature text before enabling the signature.",
          );
        }

        setIsSaving(
          true,
        );

        setError(
          "",
        );

        try {
          const payload = {
            workspace_id:
              workspaceId,

            signature_name:
              normalizedName,

            signature_text:
              normalizedText,

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

          setSignature(
            data,
          );

          setExists(
            true,
          );

          return data;
        } catch (
          saveFailure
        ) {
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
            {
              cause:
                saveFailure,
            },
          );
        } finally {
          setIsSaving(
            false,
          );
        }
      },
      [
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
