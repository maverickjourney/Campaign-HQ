import {
  useCallback,
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
    isSaving,
    error,
  };
}
