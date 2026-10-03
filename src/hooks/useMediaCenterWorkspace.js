
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


const MATERIAL_TYPES =
  new Set([
    "press_release",
    "talking_point",
    "briefing",
    "statement",
  ]);

const ALLOWED_TYPES =
  new Set([
    "press_release",
    "media_request",
    "talking_point",
    "coverage_mention",
    "briefing",
    "statement",
    "other",
  ]);

const EMPTY_METRICS = {
  total: 0,
  materials: 0,
  drafts: 0,
  review: 0,
  openRequests: 0,
  coverage: 0,
  published: 0,
  mediaContacts: 0,
  approvedAssets: 0,
  unlinkedRequests: 0,
};


export function useMediaCenterWorkspace({
  workspaceId,
  currentUserId,
}) {
  const [
    items,
    setItems,
  ] = useState([]);

  const [
    mediaContacts,
    setMediaContacts,
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


  const refresh =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (!workspaceId) {
          setItems([]);
          setMediaContacts([]);
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
            itemsResult,
            linksResult,
            assetsResult,
            mediaContactsResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "campaign_media_items",
                )
                .select(
                  [
                    "id",
                    "workspace_id",
                    "item_type",
                    "title",
                    "summary",
                    "body",
                    "status",
                    "outlet",
                    "source_url",
                    "due_at",
                    "occurred_at",
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
                  "campaign_media_item_contacts",
                )
                .select(
                  [
                    "id",
                    "workspace_id",
                    "media_item_id",
                    "contact_id",
                    "relation_type",
                    "notes",
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
                  "campaign_media_item_assets",
                )
                .select(
                  [
                    "id",
                    "workspace_id",
                    "media_item_id",
                    "file_id",
                    "asset_role",
                    "status",
                    "approval_id",
                    "sort_order",
                    "caption",
                    "alt_text",
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
                  "campaign_contacts",
                )
                .select(
                  [
                    "id",
                    "full_name",
                    "email",
                    "phone",
                    "organization",
                    "contact_type",
                    "status",
                    "tags",
                    "updated_at",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .eq(
                  "contact_type",
                  "media",
                )
                .order(
                  "full_name",
                  {
                    ascending:
                      true,
                  },
                ),
            ]);

          if (itemsResult.error) {
            throw itemsResult.error;
          }

          if (linksResult.error) {
            throw linksResult.error;
          }

          if (assetsResult.error) {
            throw assetsResult.error;
          }

          if (mediaContactsResult.error) {
            throw mediaContactsResult.error;
          }


          const rawItems =
            Array.isArray(
              itemsResult.data,
            )
              ? itemsResult.data
              : [];

          const rawLinks =
            Array.isArray(
              linksResult.data,
            )
              ? linksResult.data
              : [];

          const rawAssets =
            Array.isArray(
              assetsResult.data,
            )
              ? assetsResult.data
              : [];

          const rawMediaContacts =
            Array.isArray(
              mediaContactsResult.data,
            )
              ? mediaContactsResult.data
              : [];


          const contactById =
            new Map(
              rawMediaContacts.map(
                (contact) => [
                  contact.id,
                  contact,
                ],
              ),
            );

          const linkedContactIds = [
            ...new Set(
              rawLinks
                .map(
                  (link) =>
                    link.contact_id,
                )
                .filter(Boolean),
            ),
          ];

          const missingContactIds =
            linkedContactIds.filter(
              (contactId) =>
                !contactById.has(
                  contactId,
                ),
            );

          if (
            missingContactIds.length
          ) {
            const {
              data:
                linkedContactsData,
              error:
                linkedContactsError,
            } =
              await supabase
                .from(
                  "campaign_contacts",
                )
                .select(
                  [
                    "id",
                    "full_name",
                    "email",
                    "phone",
                    "organization",
                    "contact_type",
                    "status",
                    "tags",
                    "updated_at",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .in(
                  "id",
                  missingContactIds,
                );

            if (
              linkedContactsError
            ) {
              throw linkedContactsError;
            }

            (
              Array.isArray(
                linkedContactsData,
              )
                ? linkedContactsData
                : []
            ).forEach(
              (contact) => {
                contactById.set(
                  contact.id,
                  contact,
                );
              },
            );
          }


          const approvalIds = [
            ...new Set(
              [
                ...rawItems.map(
                  (item) =>
                    item.approval_id,
                ),

                ...rawAssets.map(
                  (asset) =>
                    asset.approval_id,
                ),
              ].filter(Boolean),
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
                  "id,status,due_at,reviewed_at,title",
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
              approvalsError
            ) {
              throw approvalsError;
            }

            approvalRows =
              Array.isArray(
                approvalsData,
              )
                ? approvalsData
                : [];
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


          const linksByItem =
            new Map();

          rawLinks.forEach(
            (link) => {
              if (
                !linksByItem.has(
                  link.media_item_id,
                )
              ) {
                linksByItem.set(
                  link.media_item_id,
                  [],
                );
              }

              linksByItem
                .get(
                  link.media_item_id,
                )
                .push({
                  ...link,

                  contact:
                    contactById.get(
                      link.contact_id,
                    ) ||
                    null,
                });
            },
          );


          const assetsByItem =
            new Map();

          rawAssets.forEach(
            (asset) => {
              if (
                !asset.media_item_id
              ) {
                return;
              }

              if (
                !assetsByItem.has(
                  asset.media_item_id,
                )
              ) {
                assetsByItem.set(
                  asset.media_item_id,
                  [],
                );
              }

              assetsByItem
                .get(
                  asset.media_item_id,
                )
                .push({
                  ...asset,

                  approval:
                    asset.approval_id
                      ? approvalById.get(
                          asset.approval_id,
                        ) ||
                        null
                      : null,
                });
            },
          );


          const normalizedItems =
            rawItems.map(
              (item) => {
                const contacts =
                  linksByItem.get(
                    item.id,
                  ) ||
                  [];

                const assets =
                  assetsByItem.get(
                    item.id,
                  ) ||
                  [];

                return {
                  ...item,

                  contacts,

                  assets,

                  assetCount:
                    assets.length,

                  approval:
                    item.approval_id
                      ? approvalById.get(
                          item.approval_id,
                        ) ||
                        null
                      : null,
                };
              },
            );


          const nextMetrics = {
            total:
              normalizedItems.length,

            materials:
              normalizedItems.filter(
                (item) =>
                  MATERIAL_TYPES.has(
                    item.item_type,
                  ),
              ).length,

            drafts:
              normalizedItems.filter(
                (item) =>
                  item.status ===
                  "draft",
              ).length,

            review:
              normalizedItems.filter(
                (item) =>
                  item.status ===
                    "review" ||
                  item.approval
                    ?.status ===
                    "pending",
              ).length,

            openRequests:
              normalizedItems.filter(
                (item) =>
                  item.item_type ===
                    "media_request" &&
                  [
                    "open",
                    "in_progress",
                  ].includes(
                    item.status,
                  ),
              ).length,

            coverage:
              normalizedItems.filter(
                (item) =>
                  item.item_type ===
                  "coverage_mention",
              ).length,

            published:
              normalizedItems.filter(
                (item) =>
                  item.status ===
                  "published",
              ).length,

            mediaContacts:
              rawMediaContacts.length,

            approvedAssets:
              rawAssets.filter(
                (asset) =>
                  asset.status ===
                  "approved",
              ).length,

            unlinkedRequests:
              normalizedItems.filter(
                (item) =>
                  item.item_type ===
                    "media_request" &&
                  [
                    "open",
                    "in_progress",
                  ].includes(
                    item.status,
                  ) &&
                  !item.contacts.length,
              ).length,
          };


          setItems(
            normalizedItems,
          );

          setMediaContacts(
            rawMediaContacts,
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
            "[Media Center] workspace load failed",
            loadError,
          );

          setError(
            loadError?.message ||
            "Unable to load the Media Center workspace.",
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


  const createDraft =
    useCallback(
      async ({
        itemType,
        title,
        summary,
        body,
        outlet,
      }) => {
        if (!workspaceId) {
          throw new Error(
            "No campaign workspace is selected.",
          );
        }

        const cleanType =
          String(
            itemType ||
            "press_release",
          )
            .trim()
            .toLowerCase();

        if (
          !ALLOWED_TYPES.has(
            cleanType,
          )
        ) {
          throw new Error(
            "Choose a valid Media Center record type.",
          );
        }

        const cleanTitle =
          String(
            title ||
            "",
          ).trim();

        if (!cleanTitle) {
          throw new Error(
            "A title is required.",
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
              item,
            error:
              itemError,
          } =
            await supabase
              .from(
                "campaign_media_items",
              )
              .insert({
                workspace_id:
                  workspaceId,

                item_type:
                  cleanType,

                title:
                  cleanTitle,

                summary:
                  String(
                    summary ||
                    "",
                  ).trim() ||
                  null,

                body:
                  String(
                    body ||
                    "",
                  ).trim() ||
                  null,

                outlet:
                  String(
                    outlet ||
                    "",
                  ).trim() ||
                  null,

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
            itemError
          ) {
            throw itemError;
          }

          await refresh();

          return item.id;
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
    items,
    mediaContacts,
    metrics,
    loading,
    saving,
    error,
    lastUpdated,
    refresh,
    createDraft,
  };
}
