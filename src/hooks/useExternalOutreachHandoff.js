import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


function clean(value) {
  return String(
    value || "",
  ).trim();
}


function externalInitials(value) {
  return (
    clean(value)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0] || "",
      )
      .join("")
      .toUpperCase() ||
    "CS"
  );
}


function externalRelativeTime(value) {
  const timestamp =
    new Date(
      value || "",
    ).getTime();

  if (
    !Number.isFinite(
      timestamp,
    )
  ) {
    return "Just now";
  }

  const difference =
    Date.now() -
    timestamp;

  if (
    difference <
    60 * 1000
  ) {
    return "Just now";
  }

  if (
    difference <
    60 * 60 * 1000
  ) {
    return `${Math.max(
      1,
      Math.floor(
        difference /
        (60 * 1000),
      ),
    )}m`;
  }

  if (
    difference <
    24 * 60 * 60 * 1000
  ) {
    return `${Math.max(
      1,
      Math.floor(
        difference /
        (
          60 *
          60 *
          1000
        ),
      ),
    )}h`;
  }

  return new Date(
    timestamp,
  ).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    },
  );
}


function normalizeExternalOutreach(
  outreach,
  files = [],
) {
  const whatsapp =
    clean(
      outreach?.channel,
    ).toLowerCase() ===
    "whatsapp";

  const channel =
    whatsapp
      ? "whatsapp"
      : "sms";

  const channelLabel =
    whatsapp
      ? "WhatsApp"
      : "Text";

  const recipientName =
    clean(
      outreach
        ?.recipient_name,
    ) ||
    "Campaign contact";

  const messageBody =
    clean(
      outreach
        ?.message_body,
    );

  const createdAt =
    outreach
      ?.created_at ||
    new Date()
      .toISOString();

  const activity = [
    {
      id:
        `${outreach.id}-prepared`,

      action:
        `${channelLabel} prepared`,

      detail:
        `Campaign Seat saved this prepared ${channelLabel} message before the external handoff.`,

      time:
        externalRelativeTime(
          createdAt,
        ),
    },
  ];

  if (
    outreach
      ?.opened_at
  ) {
    activity.push({
      id:
        `${outreach.id}-opened`,

      action:
        `${channelLabel} handoff opened`,

      detail:
        `Campaign Seat recorded that the external ${channelLabel} handoff was opened. This does not claim provider delivery.`,

      time:
        externalRelativeTime(
          outreach
            .opened_at,
        ),
    });
  }

  if (
    outreach
      ?.confirmed_sent_at
  ) {
    activity.push({
      id:
        `${outreach.id}-confirmed`,

      action:
        `${channelLabel} confirmed sent`,

      detail:
        `A campaign user confirmed this ${channelLabel} outreach as sent. This is a human confirmation, not provider delivery verification.`,

      time:
        externalRelativeTime(
          outreach
            .confirmed_sent_at,
        ),
    });
  }

  activity.reverse();

  return {
    id:
      `external-outreach-${outreach.id}`,

    externalOutreachId:
      outreach.id,

    contactId:
      outreach
        ?.contact_id ||
      null,

    sender:
      recipientName,

    initials:
      externalInitials(
        recipientName,
      ),

    email:
      "",

    phone:
      clean(
        outreach
          ?.recipient_phone,
      ),

    channel,

    subject:
      `${channelLabel} outreach`,

    preview:
      messageBody.slice(
        0,
        180,
      ),

    time:
      externalRelativeTime(
        createdAt,
      ),

    order:
      new Date(
        createdAt,
      ).getTime(),

    unread:
      false,

    unreadCount:
      0,

    priority:
      false,

    needsResponse:
      false,

    mentions:
      false,

    flagged:
      false,

    archived:
      false,

    tags: [
      channelLabel,
    ],

    external:
      true,

    outreachStatus:
      outreach
        ?.status ||
      "prepared",

    details: {
      organization:
        "Campaign contact",

      role:
        `${channelLabel} outreach`,

      location:
        "",

      lastContact:
        externalRelativeTime(
          createdAt,
        ),
    },

    messages: [
      {
        id:
          `external-message-${outreach.id}`,

        direction:
          "outbound",

        author:
          "You",

        initials:
          "ME",

        time:
          externalRelativeTime(
            createdAt,
          ),

        channel:
          channelLabel,

        body:
          messageBody,
      },
    ],

    files,

    activity,
  };
}


function groupExternalOutreachConversations(
  conversations,
) {
  const grouped =
    new Map();

  (
    Array.isArray(
      conversations,
    )
      ? conversations
      : []
  ).forEach(
    (conversation) => {
      const phoneKey =
        clean(
          conversation
            ?.phone,
        )
          .replace(
            /\D/g,
            "",
          );

      const contactKey =
        clean(
          conversation
            ?.contactId,
        ) ||
        phoneKey ||
        clean(
          conversation
            ?.sender,
        )
          .toLowerCase();

      const threadKey =
        `${
          conversation
            ?.channel ||
          "external"
        }:${contactKey}`;

      const messages =
        (
          conversation
            ?.messages ||
          []
        ).map(
          (message) => ({
            ...message,

            externalOrder:
              Number(
                conversation
                  ?.order ||
                0,
              ),
          }),
        );

      const current =
        grouped.get(
          threadKey,
        );

      if (
        !current
      ) {
        grouped.set(
          threadKey,
          {
            ...conversation,

            id:
              `external-thread-${threadKey}`,

            externalOutreachIds:
              conversation
                ?.externalOutreachId
                ? [
                    conversation
                      .externalOutreachId,
                  ]
                : [],

            messages,

            files: [
              ...(
                conversation
                  ?.files ||
                []
              ),
            ],

            activity: [
              ...(
                conversation
                  ?.activity ||
                []
              ),
            ],
          },
        );

        return;
      }

      if (
        conversation
          ?.externalOutreachId &&
        !current
          .externalOutreachIds
          .includes(
            conversation
              .externalOutreachId,
          )
      ) {
        current
          .externalOutreachIds
          .push(
            conversation
              .externalOutreachId,
          );
      }

      current.messages.push(
        ...messages,
      );

      current.activity.push(
        ...(
          conversation
            ?.activity ||
          []
        ),
      );

      const existingFiles =
        new Set(
          current.files.map(
            (file) =>
              file
                ?.campaignFileId ||
              file?.id ||
              file?.name,
          ),
        );

      (
        conversation
          ?.files ||
        []
      ).forEach(
        (file) => {
          const fileKey =
            file
              ?.campaignFileId ||
            file?.id ||
            file?.name;

          if (
            !fileKey ||
            existingFiles.has(
              fileKey,
            )
          ) {
            return;
          }

          existingFiles.add(
            fileKey,
          );

          current.files.push(
            file,
          );
        },
      );
    },
  );

  return Array.from(
    grouped.values(),
  )
    .map(
      (conversation) => ({
        ...conversation,

        messages:
          [
            ...conversation
              .messages,
          ].sort(
            (
              left,
              right,
            ) =>
              Number(
                left
                  ?.externalOrder ||
                0,
              ) -
              Number(
                right
                  ?.externalOrder ||
                0,
              ),
          ),
      }),
    )
    .sort(
      (
        left,
        right,
      ) =>
        Number(
          right?.order ||
          0,
        ) -
        Number(
          left?.order ||
          0,
        ),
    );
}


export function useExternalOutreachHandoff({
  workspaceId,
}) {
  const [
    outreachConversations,
    setOutreachConversations,
  ] = useState([]);

  const [
    externalHistoryError,
    setExternalHistoryError,
  ] = useState("");

  const [
    externalHistoryLoading,
    setExternalHistoryLoading,
  ] = useState(false);


  const refreshExternalOutreach =
    useCallback(
      async () => {
        if (
          !workspaceId
        ) {
          setOutreachConversations(
            [],
          );

          setExternalHistoryError(
            "",
          );

          return [];
        }

        setExternalHistoryLoading(
          true,
        );

        setExternalHistoryError(
          "",
        );

        try {
          const {
            data,
            error,
          } =
            await supabase
              .from(
                "campaign_external_outreach",
              )
              .select(
                [
                  "id",
                  "workspace_id",
                  "contact_id",
                  "channel",
                  "message_body",
                  "status",
                  "recipient_name",
                  "recipient_phone",
                  "created_at",
                  "opened_at",
                  "confirmed_sent_at",
                ].join(","),
              )
              .eq(
                "workspace_id",
                workspaceId,
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                },
              )
              .limit(
                200,
              );

          if (error) {
            throw error;
          }

          const outreachRows =
            Array.isArray(
              data,
            )
              ? data
              : [];

          const outreachIds =
            outreachRows
              .map(
                (outreach) =>
                  outreach?.id,
              )
              .filter(
                Boolean,
              );

          const filesByOutreach =
            new Map();

          if (
            outreachIds.length
          ) {
            const {
              data:
                attachmentRows,
              error:
                attachmentError,
            } =
              await supabase
                .from(
                  "campaign_communication_attachments",
                )
                .select(
                  "external_outreach_id,file_id",
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .in(
                  "external_outreach_id",
                  outreachIds,
                );

            if (
              attachmentError
            ) {
              throw attachmentError;
            }

            const links =
              Array.isArray(
                attachmentRows,
              )
                ? attachmentRows
                : [];

            const fileIds =
              [
                ...new Set(
                  links
                    .map(
                      (link) =>
                        link?.file_id,
                    )
                    .filter(
                      Boolean,
                    ),
                ),
              ];

            const fileMap =
              new Map();

            if (
              fileIds.length
            ) {
              const {
                data:
                  campaignFiles,
                error:
                  fileError,
              } =
                await supabase
                  .from(
                    "campaign_files",
                  )
                  .select(
                    "id,file_name,size_bytes,mime_type,storage_path",
                  )
                  .eq(
                    "workspace_id",
                    workspaceId,
                  )
                  .in(
                    "id",
                    fileIds,
                  );

              if (
                fileError
              ) {
                throw fileError;
              }

              (
                Array.isArray(
                  campaignFiles,
                )
                  ? campaignFiles
                  : []
              ).forEach(
                (file) => {
                  fileMap.set(
                    file.id,
                    {
                      id:
                        `campaign-file-${file.id}`,

                      campaignFileId:
                        file.id,

                      name:
                        file.file_name,

                      size:
                        Number(
                          file.size_bytes ||
                          0,
                        ),

                      contentType:
                        file.mime_type ||
                        "application/octet-stream",

                      storagePath:
                        file.storage_path,

                      source:
                        "campaign-file",
                    },
                  );
                },
              );
            }

            links.forEach(
              (link) => {
                const file =
                  fileMap.get(
                    link.file_id,
                  );

                if (
                  !file ||
                  !link
                    ?.external_outreach_id
                ) {
                  return;
                }

                const current =
                  filesByOutreach.get(
                    link.external_outreach_id,
                  ) || [];

                current.push(
                  file,
                );

                filesByOutreach.set(
                  link.external_outreach_id,
                  current,
                );
              },
            );
          }

          const normalizedRows =
            outreachRows.map(
              (outreach) =>
                normalizeExternalOutreach(
                  outreach,
                  filesByOutreach.get(
                    outreach.id,
                  ) || [],
                ),
            );

          const normalized =
            groupExternalOutreachConversations(
              normalizedRows,
            );

          setOutreachConversations(
            normalized,
          );

          return normalized;
        } catch (
          historyError
        ) {
          setExternalHistoryError(
            historyError
              ?.message ||
            "Campaign Seat could not load Text and WhatsApp history.",
          );

          return [];
        } finally {
          setExternalHistoryLoading(
            false,
          );
        }
      },
      [
        workspaceId,
      ],
    );


  useEffect(
    () => {
      void refreshExternalOutreach();
    },
    [
      refreshExternalOutreach,
    ],
  );


  const prepareExternalOutreach =
    useCallback(
      async ({
        contactId,
        channel,
        messageBody,
      }) => {
        if (
          !workspaceId ||
          !contactId
        ) {
          throw new Error(
            "Save or select a Campaign Seat contact before preparing Text or WhatsApp outreach.",
          );
        }

        const {
          data,
          error,
        } = await supabase.rpc(
          "prepare_external_outreach",
          {
            target_workspace_id:
              workspaceId,

            target_contact_id:
              contactId,

            target_channel:
              channel,

            target_message_body:
              messageBody,
          },
        );

        if (error) {
          throw error;
        }

        if (
          !data?.outreachId
        ) {
          throw new Error(
            "Campaign Seat prepared the outreach but did not return its tracking ID.",
          );
        }

        await refreshExternalOutreach();

        return data;
      },
      [
        refreshExternalOutreach,
        workspaceId,
      ],
    );


  const markExternalOutreachOpened =
    useCallback(
      async ({
        outreachId,
      }) => {
        if (
          !workspaceId ||
          !outreachId
        ) {
          throw new Error(
            "The prepared outreach could not be opened.",
          );
        }

        const {
          data,
          error,
        } = await supabase.rpc(
          "mark_external_outreach_opened",
          {
            target_workspace_id:
              workspaceId,

            target_outreach_id:
              outreachId,
          },
        );

        if (error) {
          throw error;
        }

        await refreshExternalOutreach();

        return data;
      },
      [
        refreshExternalOutreach,
        workspaceId,
      ],
    );


  const confirmExternalOutreachSent =
    useCallback(
      async ({
        outreachId,
      }) => {
        if (
          !workspaceId ||
          !outreachId
        ) {
          throw new Error(
            "The external outreach could not be confirmed.",
          );
        }

        const {
          data,
          error,
        } = await supabase.rpc(
          "confirm_external_outreach_sent",
          {
            target_workspace_id:
              workspaceId,

            target_outreach_id:
              outreachId,
          },
        );

        if (error) {
          throw error;
        }

        await refreshExternalOutreach();

        return data;
      },
      [
        refreshExternalOutreach,
        workspaceId,
      ],
    );


  return {
    outreachConversations,
    externalHistoryError,
    externalHistoryLoading,
    refreshExternalOutreach,
    prepareExternalOutreach,
    markExternalOutreachOpened,
    confirmExternalOutreachSent,
  };
}
