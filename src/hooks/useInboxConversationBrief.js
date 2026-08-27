import {
  useCallback,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


function conversationMessages(
  conversation,
) {
  return (
    Array.isArray(
      conversation?.messages,
    )
      ? conversation.messages
      : []
  )
    .slice(-24)
    .map(
      (message) => ({
        direction:
          String(
            message?.direction ||
            "",
          ),

        author:
          String(
            message?.author ||
            "",
          ),

        channel:
          String(
            message?.channel ||
            "",
          ),

        time:
          String(
            message?.time ||
            "",
          ),

        body:
          String(
            message?.body ||
            "",
          ).slice(
            0,
            3500,
          ),
      }),
    );
}


export function useInboxConversationBrief({
  workspaceId,
}) {
  const [
    briefsByKey,
    setBriefsByKey,
  ] = useState({});

  const [
    loadingKey,
    setLoadingKey,
  ] = useState("");

  const [
    errorsByKey,
    setErrorsByKey,
  ] = useState({});


  const generateBrief =
    useCallback(
      async ({
        conversationKey,
        conversation,
        contact,
        workflow,
      }) => {
        if (
          !workspaceId ||
          !conversationKey ||
          !conversation
        ) {
          return null;
        }

        setLoadingKey(
          conversationKey,
        );

        setErrorsByKey(
          (current) => ({
            ...current,
            [conversationKey]:
              "",
          }),
        );

        try {
          const {
            data,
            error,
          } =
            await supabase
              .functions
              .invoke(
                "inbox-conversation-ai",
                {
                  body: {
                    workspaceId,

                    conversation: {
                      sender:
                        conversation
                          .sender ||
                        "",

                      email:
                        conversation
                          .email ||
                        "",

                      channel:
                        conversation
                          .channel ||
                        "",

                      subject:
                        conversation
                          .subject ||
                        "",

                      contact:
                        contact
                          ? {
                              name:
                                contact
                                  .full_name ||
                                "",

                              organization:
                                contact
                                  .organization ||
                                "",

                              type:
                                contact
                                  .contact_type ||
                                "",

                              notes:
                                contact
                                  .notes ||
                                "",

                              tags:
                                contact
                                  .tags ||
                                [],
                            }
                          : null,

                      workflow:
                        workflow
                          ? {
                              status:
                                workflow
                                  .workflow_status ||
                                "",

                              is_vip:
                                Boolean(
                                  workflow
                                    .is_vip,
                                ),

                              follow_up_at:
                                workflow
                                  .follow_up_at ||
                                null,

                              snoozed_until:
                                workflow
                                  .snoozed_until ||
                                null,
                            }
                          : null,

                      messages:
                        conversationMessages(
                          conversation,
                        ),
                    },
                  },
                },
              );

          if (error) {
            throw error;
          }

          if (
            data?.success !==
              true ||
            !data?.brief
          ) {
            throw new Error(
              data?.error ||
                "Campaign Seat could not generate this brief.",
            );
          }

          const generated = {
            ...data.brief,

            generatedAt:
              new Date()
                .toISOString(),
          };

          setBriefsByKey(
            (current) => ({
              ...current,
              [conversationKey]:
                generated,
            }),
          );

          return generated;
        } catch (
          generateError
        ) {
          const message =
            generateError
              ?.context
              ?.body
              ?.error ||
            generateError
              ?.message ||
            "Campaign Seat could not generate this brief.";

          setErrorsByKey(
            (current) => ({
              ...current,
              [conversationKey]:
                message,
            }),
          );

          return null;
        } finally {
          setLoadingKey(
            (current) =>
              current ===
              conversationKey
                ? ""
                : current,
          );
        }
      },
      [
        workspaceId,
      ],
    );


  return {
    briefsByKey,

    loadingKey,

    errorsByKey,

    generateBrief,
  };
}
