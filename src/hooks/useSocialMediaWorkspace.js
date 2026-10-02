import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


const EMPTY_METRICS = {
  total: 0,
  drafts: 0,
  review: 0,
  scheduled: 0,
  published: 0,
  withoutTargets: 0,
  publishingConnections: 0,
};


function socialIntegration(
  integration,
) {
  const values = [
    integration?.provider,
    integration?.integration_type,
    integration?.display_name,
  ]
    .map(
      (value) =>
        String(
          value ||
          "",
        )
          .trim()
          .toLowerCase(),
    )
    .filter(Boolean);

  return values.some(
    (value) =>
      [
        "facebook",
        "instagram",
        "tiktok",
        "linkedin",
        "threads",
        "youtube",
        "twitter",
        "social",
        "social_media",
      ].some(
        (signal) =>
          value.includes(
            signal,
          ),
      ),
  );
}


export function useSocialMediaWorkspace({
  workspaceId,
  currentUserId,
}) {
  const [
    posts,
    setPosts,
  ] = useState([]);

  const [
    metrics,
    setMetrics,
  ] = useState(
    EMPTY_METRICS,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  const refreshTimerRef =
    useRef(null);


  const refresh =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (!workspaceId) {
          setPosts([]);
          setMetrics(
            EMPTY_METRICS,
          );
          setLoading(false);
          setError(
            "No campaign workspace is selected.",
          );

          return false;
        }

        if (showLoading) {
          setLoading(true);
        }

        try {
          const [
            postsResult,
            targetsResult,
            assetsResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "campaign_social_posts",
                )
                .select(
                  [
                    "id",
                    "workspace_id",
                    "title",
                    "body",
                    "post_type",
                    "status",
                    "scheduled_at",
                    "published_at",
                    "owner_user_id",
                    "approval_id",
                    "metadata",
                    "created_by",
                    "updated_by",
                    "created_at",
                    "updated_at",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .neq(
                  "status",
                  "archived",
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  },
                ),

              supabase
                .from(
                  "campaign_social_post_targets",
                )
                .select(
                  [
                    "id",
                    "workspace_id",
                    "post_id",
                    "platform",
                    "target_key",
                    "display_name",
                    "status",
                    "scheduled_at",
                    "published_at",
                    "external_post_id",
                    "external_url",
                    "last_error",
                    "metadata",
                    "created_at",
                    "updated_at",
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
                      true,
                  },
                ),

              supabase
                .from(
                  "campaign_social_post_assets",
                )
                .select(
                  "id,post_id,file_id,asset_role,sort_order",
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                ),
            ]);

          if (
            postsResult.error
          ) {
            throw postsResult.error;
          }

          if (
            targetsResult.error
          ) {
            throw targetsResult.error;
          }

          if (
            assetsResult.error
          ) {
            throw assetsResult.error;
          }


          const rawPosts =
            Array.isArray(
              postsResult.data,
            )
              ? postsResult.data
              : [];

          const rawTargets =
            Array.isArray(
              targetsResult.data,
            )
              ? targetsResult.data
              : [];

          const rawAssets =
            Array.isArray(
              assetsResult.data,
            )
              ? assetsResult.data
              : [];


          const approvalIds = [
            ...new Set(
              rawPosts
                .map(
                  (post) =>
                    post.approval_id,
                )
                .filter(Boolean),
            ),
          ];

          let approvalRows =
            [];

          if (
            approvalIds.length
          ) {
            const {
              data:
                approvalsData,
              error:
                approvalsError,
            } =
              await supabase
                .from(
                  "approvals",
                )
                .select(
                  "id,status,due_at,reviewed_at",
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .in(
                  "id",
                  approvalIds,
                );

            if (
              !approvalsError &&
              Array.isArray(
                approvalsData,
              )
            ) {
              approvalRows =
                approvalsData;
            }
          }


          const approvalById =
            new Map(
              approvalRows.map(
                (approval) => [
                  approval.id,
                  approval,
                ],
              ),
            );

          const targetsByPost =
            new Map();

          rawTargets.forEach(
            (target) => {
              if (
                !targetsByPost.has(
                  target.post_id,
                )
              ) {
                targetsByPost.set(
                  target.post_id,
                  [],
                );
              }

              targetsByPost
                .get(
                  target.post_id,
                )
                .push(
                  target,
                );
            },
          );

          const assetsByPost =
            new Map();

          rawAssets.forEach(
            (asset) => {
              assetsByPost.set(
                asset.post_id,
                (
                  assetsByPost.get(
                    asset.post_id,
                  ) ||
                  0
                ) +
                  1,
              );
            },
          );


          let integrations =
            [];

          try {
            const {
              data:
                integrationsData,
            } =
              await supabase
                .from(
                  "workspace_integrations",
                )
                .select(
                  "id,provider,integration_type,status,display_name,capabilities",
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .eq(
                  "status",
                  "connected",
                );

            integrations =
              (
                Array.isArray(
                  integrationsData,
                )
                  ? integrationsData
                  : []
              ).filter(
                socialIntegration,
              );
          } catch {
            integrations =
              [];
          }


          const normalizedPosts =
            rawPosts.map(
              (post) => ({
                ...post,

                targets:
                  targetsByPost.get(
                    post.id,
                  ) ||
                  [],

                assetCount:
                  assetsByPost.get(
                    post.id,
                  ) ||
                  0,

                approval:
                  post.approval_id
                    ? approvalById.get(
                        post.approval_id,
                      ) ||
                      null
                    : null,
              }),
            );


          const nextMetrics = {
            total:
              normalizedPosts.length,

            drafts:
              normalizedPosts.filter(
                (post) =>
                  post.status ===
                  "draft",
              ).length,

            review:
              normalizedPosts.filter(
                (post) =>
                  post.status ===
                    "review" ||
                  (
                    post.approval &&
                    post.approval
                      .status ===
                      "pending"
                  ),
              ).length,

            scheduled:
              normalizedPosts.filter(
                (post) =>
                  post.status ===
                  "scheduled",
              ).length,

            published:
              normalizedPosts.filter(
                (post) =>
                  post.status ===
                  "published",
              ).length,

            withoutTargets:
              normalizedPosts.filter(
                (post) =>
                  !post.targets
                    .length,
              ).length,

            publishingConnections:
              integrations.length,
          };


          setPosts(
            normalizedPosts,
          );

          setMetrics(
            nextMetrics,
          );

          setError("");
          setLastUpdated(
            new Date(),
          );
          setLoading(false);

          return true;
        } catch (
          loadError
        ) {
          console.error(
            "[Social Media] workspace load failed",
            loadError,
          );

          setError(
            loadError?.message ||
            "Unable to load the Social Media workspace.",
          );

          setLoading(false);

          return false;
        }
      },
      [
        workspaceId,
      ],
    );


  useEffect(
    () => {
      const timeout =
        window.setTimeout(
          () => {
            void refresh({
              showLoading:
                true,
            });
          },
          0,
        );

      return () =>
        window.clearTimeout(
          timeout,
        );
    },
    [
      refresh,
    ],
  );


  useEffect(
    () => {
      if (!workspaceId) {
        return undefined;
      }

      const scheduleRefresh =
        () => {
          window.clearTimeout(
            refreshTimerRef.current,
          );

          refreshTimerRef.current =
            window.setTimeout(
              () => {
                void refresh();
              },
              250,
            );
        };

      const channel =
        supabase
          .channel(
            `social-media-command-center-${workspaceId}`,
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema:
                "public",
              table:
                "campaign_social_posts",
              filter:
                `workspace_id=eq.${workspaceId}`,
            },
            scheduleRefresh,
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema:
                "public",
              table:
                "campaign_social_post_targets",
              filter:
                `workspace_id=eq.${workspaceId}`,
            },
            scheduleRefresh,
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema:
                "public",
              table:
                "campaign_social_post_assets",
              filter:
                `workspace_id=eq.${workspaceId}`,
            },
            scheduleRefresh,
          )
          .subscribe();

      return () => {
        window.clearTimeout(
          refreshTimerRef.current,
        );

        supabase
          .removeChannel(
            channel,
          );
      };
    },
    [
      refresh,
      workspaceId,
    ],
  );


  const createDraft =
    useCallback(
      async ({
        title,
        body,
        postType,
        platforms,
      }) => {
        if (!workspaceId) {
          throw new Error(
            "No campaign workspace is selected.",
          );
        }

        const cleanBody =
          String(
            body ||
            "",
          ).trim();

        if (!cleanBody) {
          throw new Error(
            "Post content is required.",
          );
        }

        const targets =
          Array.from(
            new Set(
              (
                Array.isArray(
                  platforms,
                )
                  ? platforms
                  : []
              )
                .map(
                  (platform) =>
                    String(
                      platform ||
                      "",
                    )
                      .trim()
                      .toLowerCase(),
                )
                .filter(Boolean),
            ),
          );

        if (
          !targets.length
        ) {
          throw new Error(
            "Choose at least one planned platform.",
          );
        }

        let actorId =
          currentUserId ||
          "";

        if (!actorId) {
          const {
            data:
              authData,
          } =
            await supabase
              .auth
              .getUser();

          actorId =
            authData
              ?.user
              ?.id ||
            "";
        }

        if (!actorId) {
          throw new Error(
            "Your campaign session could not be verified.",
          );
        }

        setSaving(true);

        try {
          const {
            data:
              post,
            error:
              postError,
          } =
            await supabase
              .from(
                "campaign_social_posts",
              )
              .insert({
                workspace_id:
                  workspaceId,

                title:
                  String(
                    title ||
                    "",
                  ).trim() ||
                  null,

                body:
                  cleanBody,

                post_type:
                  postType ||
                  "standard",

                status:
                  "draft",

                owner_user_id:
                  actorId,

                created_by:
                  actorId,

                updated_by:
                  actorId,
              })
              .select(
                "id",
              )
              .single();

          if (
            postError
          ) {
            throw postError;
          }

          const targetRows =
            targets.map(
              (platform) => ({
                workspace_id:
                  workspaceId,

                post_id:
                  post.id,

                platform,

                target_key:
                  "primary",

                display_name:
                  platform ===
                  "x"
                    ? "X"
                    : platform
                        .charAt(0)
                        .toUpperCase() +
                      platform.slice(1),

                status:
                  "planned",

                created_by:
                  actorId,

                updated_by:
                  actorId,
              }),
            );

          const {
            error:
              targetsError,
          } =
            await supabase
              .from(
                "campaign_social_post_targets",
              )
              .insert(
                targetRows,
              );

          if (
            targetsError
          ) {
            throw targetsError;
          }

          await refresh();

          return post.id;
        } finally {
          setSaving(false);
        }
      },
      [
        currentUserId,
        refresh,
        workspaceId,
      ],
    );


  return {
    posts,
    metrics,
    loading,
    saving,
    error,
    lastUpdated,
    refresh,
    createDraft,
  };
}
