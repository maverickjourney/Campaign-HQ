import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

import {
  useFilesCommandCenter,
} from "./useFilesCommandCenter";


const BUCKET_NAME =
  "campaign-files";


function normalizeCampaignFile(
  file,
) {
  return {
    id:
      `campaign-file-${file.id}`,

    campaignFileId:
      file.id,

    name:
      file.file_name,

    size:
      Number(
        file.size_bytes || 0,
      ),

    contentType:
      file.mime_type ||
      "application/octet-stream",

    storagePath:
      file.storage_path,

    source:
      "campaign-file",
  };
}


function providerAttachmentSourceKey(
  file,
  accountKey = "",
) {
  const messageId =
    String(
      file?.providerMessageId ||
      "",
    ).trim();

  const attachmentId =
    String(
      file?.providerAttachmentId ||
      "",
    ).trim();

  if (
    !messageId ||
    !attachmentId
  ) {
    return "";
  }

  const account =
    String(
      accountKey ||
      "mailbox",
    )
      .trim()
      .toLowerCase();

  return [
    account,
    messageId,
    attachmentId,
  ].join(":");
}


export function useCommunicationAttachments({
  workspaceId,
  userId,
}) {
  const {
    uploadFiles,
    isSaving,
    error,
  } = useFilesCommandCenter({
    workspaceId,
    userId,
  });


  const [
    savedProviderFilesByKey,
    setSavedProviderFilesByKey,
  ] = useState({});


  const refreshSavedProviderFiles =
    useCallback(
      async () => {
        if (!workspaceId) {
          setSavedProviderFilesByKey(
            {},
          );

          return {};
        }

        const {
          data:
            linkRows,
          error:
            linkError,
        } =
          await supabase
            .from(
              "campaign_file_context_links",
            )
            .select(
              "file_id, context_key",
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .eq(
              "context_type",
              "inbox_attachment",
            );

        if (linkError) {
          throw linkError;
        }

        const fileIds =
          Array.from(
            new Set(
              (
                linkRows ||
                []
              )
                .map(
                  (row) =>
                    row.file_id,
                )
                .filter(Boolean),
            ),
          );

        if (!fileIds.length) {
          setSavedProviderFilesByKey(
            {},
          );

          return {};
        }

        const {
          data:
            fileRows,
          error:
            fileError,
        } =
          await supabase
            .from(
              "campaign_files",
            )
            .select(
              "id, file_name, storage_path, mime_type, size_bytes, category, uploaded_by, created_at",
            )
            .in(
              "id",
              fileIds,
            );

        if (fileError) {
          throw fileError;
        }

        const filesById =
          new Map(
            (
              fileRows ||
              []
            ).map(
              (file) => [
                file.id,
                normalizeCampaignFile(
                  file,
                ),
              ],
            ),
          );

        const next =
          {};

        (
          linkRows ||
          []
        ).forEach(
          (row) => {
            const file =
              filesById.get(
                row.file_id,
              );

            if (
              row.context_key &&
              file
            ) {
              next[
                row.context_key
              ] =
                file;
            }
          },
        );

        setSavedProviderFilesByKey(
          next,
        );

        return next;
      },
      [
        workspaceId,
      ],
    );


  useEffect(() => {
    if (!workspaceId) {
      return undefined;
    }

    void refreshSavedProviderFiles();

    const channel =
      supabase
        .channel(
          `campaign-file-links-${workspaceId}`,
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",

            schema:
              "public",

            table:
              "campaign_file_context_links",

            filter:
              `workspace_id=eq.${workspaceId}`,
          },
          () => {
            void refreshSavedProviderFiles();
          },
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel,
      );
    };
  }, [
    refreshSavedProviderFiles,
    workspaceId,
  ]);


  const createFileContextLinks =
    useCallback(
      async (
        campaignFiles,
        contexts = [],
      ) => {
        const normalizedContexts =
          (
            Array.isArray(
              contexts,
            )
              ? contexts
              : []
          )
            .map(
              (context) => ({
                type:
                  String(
                    context?.type ||
                    "",
                  ).trim(),

                key:
                  String(
                    context?.key ||
                    "",
                  ).trim(),

                metadata:
                  context
                    ?.metadata ||
                  {},
              }),
            )
            .filter(
              (context) =>
                context.type &&
                context.key,
            );

        if (
          !normalizedContexts
            .length ||
          !campaignFiles
            ?.length
        ) {
          return;
        }

        const rows =
          campaignFiles.flatMap(
            (file) =>
              normalizedContexts.map(
                (context) => ({
                  workspace_id:
                    workspaceId,

                  file_id:
                    file.id,

                  context_type:
                    context.type,

                  context_key:
                    context.key,

                  metadata:
                    context.metadata,

                  created_by:
                    userId,
                }),
              ),
          );

        const {
          error:
            contextError,
        } =
          await supabase
            .from(
              "campaign_file_context_links",
            )
            .upsert(
              rows,
              {
                onConflict:
                  "workspace_id,file_id,context_type,context_key",

                ignoreDuplicates:
                  true,
              },
            );

        if (contextError) {
          throw contextError;
        }
      },
      [
        userId,
        workspaceId,
      ],
    );


  const saveFilesToDocuments =
    useCallback(
      async ({
        files,
        category =
          "Communications",
        contexts = [],
      }) => {
        const selectedFiles =
          Array.from(
            files ||
            [],
          );

        if (
          !selectedFiles.length
        ) {
          return [];
        }

        const uploaded =
          await uploadFiles(
            selectedFiles,
            category,
          );

        await createFileContextLinks(
          uploaded,
          contexts,
        );

        return uploaded.map(
          normalizeCampaignFile,
        );
      },
      [
        createFileContextLinks,
        uploadFiles,
      ],
    );


  const getSavedProviderAttachment =
    useCallback(
      (
        file,
        accountKey = "",
      ) => {
        const sourceKey =
          providerAttachmentSourceKey(
            file,
            accountKey,
          );

        if (!sourceKey) {
          return null;
        }

        return (
          savedProviderFilesByKey[
            sourceKey
          ] ||
          null
        );
      },
      [
        savedProviderFilesByKey,
      ],
    );


  const saveProviderAttachmentToDocuments =
    useCallback(
      async ({
        file,
        blob,
        accountKey = "",
        conversationKey = "",
        metadata = {},
      }) => {
        const sourceKey =
          providerAttachmentSourceKey(
            file,
            accountKey,
          );

        if (!sourceKey) {
          throw new Error(
            "Campaign Seat could not identify this provider attachment.",
          );
        }

        const alreadySaved =
          savedProviderFilesByKey[
            sourceKey
          ];

        if (alreadySaved) {
          return alreadySaved;
        }

        const {
          data:
            existingLink,
          error:
            existingLinkError,
        } =
          await supabase
            .from(
              "campaign_file_context_links",
            )
            .select(
              "file_id",
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .eq(
              "context_type",
              "inbox_attachment",
            )
            .eq(
              "context_key",
              sourceKey,
            )
            .maybeSingle();

        if (existingLinkError) {
          throw existingLinkError;
        }

        if (
          existingLink
            ?.file_id
        ) {
          const {
            data:
              existingFile,
            error:
              existingFileError,
          } =
            await supabase
              .from(
                "campaign_files",
              )
              .select(
                "id, file_name, storage_path, mime_type, size_bytes, category, uploaded_by, created_at",
              )
              .eq(
                "id",
                existingLink
                  .file_id,
              )
              .single();

          if (
            existingFileError
          ) {
            throw existingFileError;
          }

          const normalized =
            normalizeCampaignFile(
              existingFile,
            );

          setSavedProviderFilesByKey(
            (current) => ({
              ...current,
              [sourceKey]:
                normalized,
            }),
          );

          if (conversationKey) {
            await createFileContextLinks(
              [
                existingFile,
              ],
              [
                {
                  type:
                    "inbox_conversation",

                  key:
                    conversationKey,

                  metadata,
                },
              ],
            );
          }

          return normalized;
        }

        if (
          !blob ||
          !(
            blob instanceof
            Blob
          )
        ) {
          throw new Error(
            "Campaign Seat could not read this attachment for saving.",
          );
        }

        const fileName =
          String(
            file?.name ||
            "attachment",
          ).trim() ||
          "attachment";

        const contentType =
          String(
            file
              ?.contentType ||
            blob.type ||
            "application/octet-stream",
          );

        const browserFile =
          new File(
            [
              blob,
            ],
            fileName,
            {
              type:
                contentType,

              lastModified:
                Date.now(),
            },
          );

        const uploaded =
          await uploadFiles(
            [
              browserFile,
            ],
            "Communications",
          );

        const campaignFile =
          uploaded[0];

        if (!campaignFile) {
          throw new Error(
            "Campaign Seat could not save this attachment to Documents.",
          );
        }

        const contexts = [
          {
            type:
              "inbox_attachment",

            key:
              sourceKey,

            metadata: {
              provider_message_id:
                file
                  ?.providerMessageId ||
                null,

              provider_attachment_id:
                file
                  ?.providerAttachmentId ||
                null,

              ...metadata,
            },
          },

          ...(conversationKey
            ? [
                {
                  type:
                    "inbox_conversation",

                  key:
                    conversationKey,

                  metadata,
                },
              ]
            : []),
        ];

        await createFileContextLinks(
          [
            campaignFile,
          ],
          contexts,
        );

        const normalized =
          normalizeCampaignFile(
            campaignFile,
          );

        setSavedProviderFilesByKey(
          (current) => ({
            ...current,
            [sourceKey]:
              normalized,
          }),
        );

        return normalized;
      },
      [
        createFileContextLinks,
        savedProviderFilesByKey,
        uploadFiles,
        workspaceId,
      ],
    );


  const attachFilesToInternalMessage =
    useCallback(
      async ({
        messageId,
        files,
      }) => {
        const selectedFiles =
          Array.from(
            files || [],
          );

        if (
          !selectedFiles.length
        ) {
          return [];
        }

        if (
          !workspaceId ||
          !userId ||
          !messageId
        ) {
          throw new Error(
            "Campaign Seat could not attach the selected files because the internal message ID is missing.",
          );
        }


        const uploaded =
          await uploadFiles(
            selectedFiles,
            "Communications",
          );


        if (
          !uploaded.length
        ) {
          return [];
        }


        const rows =
          uploaded.map(
            (file) => ({
              workspace_id:
                workspaceId,

              file_id:
                file.id,

              internal_message_id:
                messageId,
            }),
          );


        const {
          error: linkError,
        } = await supabase
          .from(
            "campaign_communication_attachments",
          )
          .insert(
            rows,
          );


        if (
          linkError
        ) {
          throw linkError;
        }


        return uploaded.map(
          normalizeCampaignFile,
        );
      },
      [
        uploadFiles,
        userId,
        workspaceId,
      ],
    );


  const attachFilesToExternalOutreach =
    useCallback(
      async ({
        outreachId,
        files,
      }) => {
        const selectedFiles =
          Array.from(
            files || [],
          );

        if (
          !selectedFiles.length
        ) {
          return [];
        }

        if (
          !workspaceId ||
          !userId ||
          !outreachId
        ) {
          throw new Error(
            "The external outreach record is missing the information required to attach files.",
          );
        }


        const uploaded =
          await uploadFiles(
            selectedFiles,
            "Communications",
          );


        const rows =
          uploaded.map(
            (file) => ({
              workspace_id:
                workspaceId,

              file_id:
                file.id,

              external_outreach_id:
                outreachId,
            }),
          );


        const {
          error: linkError,
        } = await supabase
          .from(
            "campaign_communication_attachments",
          )
          .insert(
            rows,
          );


        if (
          linkError
        ) {
          throw linkError;
        }


        return uploaded.map(
          normalizeCampaignFile,
        );
      },
      [
        uploadFiles,
        userId,
        workspaceId,
      ],
    );


  const getCommunicationFileUrl =
    useCallback(
      async (
        file,
        {
          download = false,
        } = {},
      ) => {
        const storagePath =
          file?.storagePath ||
          file?.storage_path;

        const fileName =
          file?.name ||
          file?.file_name ||
          "campaign-file";


        if (
          !storagePath
        ) {
          throw new Error(
            "Campaign Seat could not find this file in private storage.",
          );
        }


        const options =
          download
            ? {
                download:
                  fileName,
              }
            : undefined;


        const {
          data,
          error: signedUrlError,
        } = await supabase
          .storage
          .from(
            BUCKET_NAME,
          )
          .createSignedUrl(
            storagePath,
            90,
            options,
          );


        if (
          signedUrlError
        ) {
          throw signedUrlError;
        }


        return data?.signedUrl ||
          "";
      },
      [],
    );


  const downloadCommunicationFile =
    useCallback(
      async (
        file,
      ) => {
        const signedUrl =
          await getCommunicationFileUrl(
            file,
            {
              download: true,
            },
          );


        if (
          !signedUrl
        ) {
          throw new Error(
            "Campaign Seat could not prepare this file for download.",
          );
        }


        const link =
          document.createElement(
            "a",
          );

        link.href =
          signedUrl;

        link.target =
          "_blank";

        link.rel =
          "noopener noreferrer";

        link.download =
          file?.name ||
          "campaign-file";

        document.body
          .appendChild(
            link,
          );

        link.click();
        link.remove();

        return signedUrl;
      },
      [
        getCommunicationFileUrl,
      ],
    );


  return {
    attachFilesToInternalMessage,
    attachFilesToExternalOutreach,
    getCommunicationFileUrl,
    downloadCommunicationFile,
    saveFilesToDocuments,
    saveProviderAttachmentToDocuments,
    getSavedProviderAttachment,
    refreshSavedProviderFiles,
    isSaving,
    error,
  };
}
