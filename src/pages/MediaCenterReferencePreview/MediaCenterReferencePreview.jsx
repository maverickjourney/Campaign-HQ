
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Mail,
  Mic2,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  useMediaCenterWorkspace,
} from "../../hooks/useMediaCenterWorkspace";

import {
  getCurrentUser,
  getCurrentWorkspace,
  hasCampaignPermission,
} from "../../utils/campaignSession";

import styles from "./MediaCenterReferencePreview.module.css";


const MEDIA_VIEWS =
  new Set([
    "overview",
    "materials",
    "requests",
    "coverage",
  ]);

const MATERIAL_TYPES =
  new Set([
    "press_release",
    "talking_point",
    "briefing",
    "statement",
  ]);

const ITEM_TYPE_LABELS = {
  press_release:
    "Press release",

  media_request:
    "Media request",

  talking_point:
    "Talking points",

  coverage_mention:
    "Coverage mention",

  briefing:
    "Briefing",

  statement:
    "Statement",

  other:
    "Other",
};

const ITEM_TYPE_ABBREVIATIONS = {
  press_release:
    "PR",

  media_request:
    "REQ",

  talking_point:
    "TP",

  coverage_mention:
    "CV",

  briefing:
    "BR",

  statement:
    "ST",

  other:
    "OT",
};

const ITEM_TYPE_OPTIONS = [
  "press_release",
  "media_request",
  "talking_point",
  "briefing",
  "statement",
  "coverage_mention",
  "other",
];


function itemTypeLabel(
  value,
) {
  return (
    ITEM_TYPE_LABELS[
      value
    ] ||
    "Media record"
  );
}


function itemTypeAbbreviation(
  value,
) {
  return (
    ITEM_TYPE_ABBREVIATIONS[
      value
    ] ||
    "MC"
  );
}


function statusLabel(value) {
  return String(
    value ||
    "draft",
  )
    .replace(
      /_/g,
      " ",
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}


function statusKey(value) {
  return String(
    value ||
    "",
  )
    .trim()
    .toLowerCase()
    .replace(
      /_/g,
      "-",
    )
    .replace(
      /\s+/g,
      "-",
    );
}


function safeDate(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}


function formatDateTime(
  value,
  timezone,
  fallback = "—",
) {
  const date =
    safeDate(value);

  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone:
        timezone ||
        "America/New_York",
    },
  ).format(date);
}


function formatTime(
  value,
  timezone,
) {
  const date =
    value instanceof Date
      ? value
      : safeDate(
          value,
        );

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      timeZone:
        timezone ||
        "America/New_York",
    },
  ).format(date);
}


function readMediaLocation() {
  if (
    typeof window ===
    "undefined"
  ) {
    return {
      view:
        "overview",

      itemId:
        "",
    };
  }

  const url =
    new URL(
      window.location.href,
    );

  const requestedView =
    url.searchParams.get(
      "media-view",
    );

  return {
    view:
      MEDIA_VIEWS.has(
        requestedView,
      )
        ? requestedView
        : "overview",

    itemId:
      url.searchParams.get(
        "media-item",
      ) ||
      "",
  };
}


export default function MediaCenterReferencePreview() {
  const workspace =
    getCurrentWorkspace();

  const currentUser =
    getCurrentUser();

  const timezone =
    workspace?.timezone ||
    "America/New_York";

  const canManage =
    hasCampaignPermission(
      "communications.manage",
    );

  const {
    items,
    metrics,
    loading,
    saving,
    error,
    lastUpdated,
    refresh,
    createDraft,
  } =
    useMediaCenterWorkspace({
      workspaceId:
        workspace?.id ||
        "",

      currentUserId:
        currentUser?.id ||
        "",
    });


  const [
    activeView,
    setActiveView,
  ] =
    useState(
      () =>
        readMediaLocation()
          .view,
    );

  const [
    selectedItemId,
    setSelectedItemId,
  ] =
    useState(
      () =>
        readMediaLocation()
          .itemId,
    );

  const [
    composerOpen,
    setComposerOpen,
  ] =
    useState(false);

  const [
    notice,
    setNotice,
  ] =
    useState("");

  const [
    form,
    setForm,
  ] =
    useState({
      itemType:
        "press_release",

      title:
        "",

      outlet:
        "",

      summary:
        "",

      body:
        "",
    });


  const selectedItem =
    selectedItemId
      ? items.find(
          (item) =>
            item.id ===
            selectedItemId,
        ) ||
        null
      : null;


  const materialItems =
    useMemo(
      () =>
        items.filter(
          (item) =>
            MATERIAL_TYPES.has(
              item.item_type,
            ),
        ),
      [
        items,
      ],
    );

  const requestItems =
    useMemo(
      () =>
        items.filter(
          (item) =>
            item.item_type ===
            "media_request",
        ),
      [
        items,
      ],
    );

  const coverageItems =
    useMemo(
      () =>
        items.filter(
          (item) =>
            item.item_type ===
            "coverage_mention",
        ),
      [
        items,
      ],
    );

  const nextDeadline =
    useMemo(
      () =>
        items
          .filter(
            (item) =>
              item.due_at &&
              ![
                "closed",
                "published",
                "archived",
              ].includes(
                item.status,
              ),
          )
          .sort(
            (
              left,
              right,
            ) =>
              (
                safeDate(
                  left.due_at,
                )
                  ?.getTime() ||
                Number.MAX_SAFE_INTEGER
              ) -
              (
                safeDate(
                  right.due_at,
                )
                  ?.getTime() ||
                Number.MAX_SAFE_INTEGER
              ),
          )[0] ||
        null,
      [
        items,
      ],
    );


  const displayItems =
    activeView ===
    "materials"
      ? materialItems
      : activeView ===
        "requests"
        ? requestItems
        : activeView ===
          "coverage"
          ? coverageItems
          : items.slice(
              0,
              10,
            );


  const applyLocation =
    (
      nextView,
      nextItemId = "",
      {
        replace = false,
      } = {},
    ) => {
      const url =
        new URL(
          window.location.href,
        );

      url.searchParams.set(
        "media-view",
        nextView,
      );

      if (
        nextItemId
      ) {
        url.searchParams.set(
          "media-item",
          nextItemId,
        );
      } else {
        url.searchParams.delete(
          "media-item",
        );
      }

      const nextUrl =
        `${url.pathname}${url.search}${url.hash}`;

      window.history[
        replace
          ? "replaceState"
          : "pushState"
      ](
        {},
        "",
        nextUrl,
      );

      setActiveView(
        nextView,
      );

      setSelectedItemId(
        nextItemId,
      );
    };


  const openItem =
    (item) => {
      applyLocation(
        activeView,
        item.id,
      );
    };


  const closeItem =
    () => {
      applyLocation(
        activeView,
        "",
        {
          replace: true,
        },
      );
    };


  useEffect(
    () => {
      const syncHistory =
        () => {
          const next =
            readMediaLocation();

          setActiveView(
            next.view,
          );

          setSelectedItemId(
            next.itemId,
          );

          setComposerOpen(
            false,
          );
        };

      window.addEventListener(
        "popstate",
        syncHistory,
      );

      return () => {
        window.removeEventListener(
          "popstate",
          syncHistory,
        );
      };
    },
    [],
  );


  const handleCreateDraft =
    async (
      event,
    ) => {
      event.preventDefault();

      try {
        const itemId =
          await createDraft({
            itemType:
              form.itemType,

            title:
              form.title,

            summary:
              form.summary,

            body:
              form.body,

            outlet:
              form.outlet,
          });

        const nextView =
          form.itemType ===
          "media_request"
            ? "requests"
            : form.itemType ===
              "coverage_mention"
              ? "coverage"
              : "materials";

        setForm({
          itemType:
            "press_release",

          title:
            "",

          outlet:
            "",

          summary:
            "",

          body:
            "",
        });

        setComposerOpen(
          false,
        );

        applyLocation(
          nextView,
          itemId,
        );

        setNotice(
          "Draft saved to the live Campaign Seat Media Center workspace.",
        );
      } catch (
        createError
      ) {
        console.error(
          "[Media Center] draft creation failed",
          createError,
        );

        setNotice(
          `Unable to save draft: ${
            createError?.message ||
            "campaign access denied"
          }`,
        );
      }
    };


  const tableTitle =
    activeView ===
    "materials"
      ? "Press & materials"
      : activeView ===
        "requests"
        ? "Media requests"
        : activeView ===
          "coverage"
          ? "Coverage mentions"
          : "Recent media activity";

  const tableSubtitle =
    activeView ===
    "materials"
      ? "Live press releases, talking points, briefings, and statements."
      : activeView ===
        "requests"
        ? "Interview and media-response work tracked inside Campaign Seat."
        : activeView ===
          "coverage"
          ? "Campaign coverage records stored in the Media Center."
          : "Live Media Center records for this campaign workspace.";


  return (
    <CampaignWorkspaceShell
      activeItem="Media Center"
    >
      <main
        className={
          styles.main
        }
        data-media-command-center="true"
        data-media-live-storage="true"
      >
        <div
          className={
            styles.canvas
          }
        >
          <section
            className={
              styles.hero
            }
          >
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                Communications operations
              </span>

              <h1>
                Media Center Command Center
              </h1>

              <p>
                Coordinate press materials, media requests,
                campaign statements, approved assets, contacts,
                and coverage records from one operational workspace.
              </p>
            </div>

            <div
              className={
                styles.heroActions
              }
            >
              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={async () => {
                  const result =
                    await refresh({
                      showLoading:
                        true,
                    });

                  setNotice(
                    result
                      ? "Live Media Center workspace refreshed."
                      : "Unable to refresh Media Center workspace.",
                  );
                }}
              >
                <RefreshCw
                  size={18}
                />
                Refresh
              </button>

              <button
                type="button"
                className={
                  styles.primaryButton
                }
                disabled={
                  !canManage
                }
                onClick={() =>
                  setComposerOpen(
                    true,
                  )
                }
              >
                <Plus
                  size={18}
                />
                Create media record
              </button>
            </div>
          </section>


          <div
            className={
              [
                styles.liveStatus,
                error
                  ? styles.liveStatusError
                  : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            {error ? (
              <X size={16} />
            ) : (
              <CheckCircle2
                size={16}
              />
            )}

            <span>
              {error
                ? error
                : loading
                  ? "Loading live Media Center records…"
                  : "Live Campaign Seat Media Center storage connected"}
            </span>

            {lastUpdated ? (
              <small>
                Updated{" "}
                {formatTime(
                  lastUpdated,
                  timezone,
                )}
              </small>
            ) : null}
          </div>


          {notice ? (
            <div
              className={
                styles.notice
              }
              role="status"
            >
              <CheckCircle2
                size={16}
              />

              <span>
                {notice}
              </span>

              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() =>
                  setNotice(
                    "",
                  )
                }
              >
                <X size={15} />
              </button>
            </div>
          ) : null}


          <section
            className={
              styles.metrics
            }
            aria-label="Media Center summary"
          >
            <button
              type="button"
              className={
                activeView ===
                "overview"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "overview",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <FolderKanban
                  size={22}
                />
              </span>

              <span>
                <small>
                  Media records
                </small>

                <strong>
                  {metrics.total}
                </strong>

                <em>
                  Live operational records
                </em>
              </span>
            </button>


            <button
              type="button"
              className={
                activeView ===
                "materials"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "materials",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <FileText
                  size={22}
                />
              </span>

              <span>
                <small>
                  Press materials
                </small>

                <strong>
                  {metrics.materials}
                </strong>

                <em>
                  Releases, briefings &amp; statements
                </em>
              </span>
            </button>


            <button
              type="button"
              className={
                activeView ===
                "requests"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "requests",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <Mail
                  size={22}
                />
              </span>

              <span>
                <small>
                  Open requests
                </small>

                <strong>
                  {metrics.openRequests}
                </strong>

                <em>
                  Media responses in progress
                </em>
              </span>
            </button>


            <button
              type="button"
              className={
                activeView ===
                "coverage"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "coverage",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <Mic2
                  size={22}
                />
              </span>

              <span>
                <small>
                  Coverage mentions
                </small>

                <strong>
                  {metrics.coverage}
                </strong>

                <em>
                  Stored campaign coverage records
                </em>
              </span>
            </button>
          </section>


          <section
            className={
              styles.workspace
            }
          >
            <div
              className={
                styles.primaryColumn
              }
            >
              <nav
                className={
                  styles.tabs
                }
                aria-label="Media Center views"
              >
                <button
                  type="button"
                  className={
                    activeView ===
                    "overview"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "overview",
                    )
                  }
                >
                  Overview
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "materials"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "materials",
                    )
                  }
                >
                  Press &amp; materials
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "requests"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "requests",
                    )
                  }
                >
                  Requests
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "coverage"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "coverage",
                    )
                  }
                >
                  Coverage
                </button>
              </nav>


              {activeView ===
              "overview" ? (
                <section
                  className={
                    styles.nextCard
                  }
                >
                  <header>
                    <span
                      className={
                        styles.sectionIcon
                      }
                    >
                      <Clock3
                        size={19}
                      />
                    </span>

                    <div>
                      <h2>
                        Next media deadline
                      </h2>

                      <p>
                        Nearest due Media Center record requiring
                        campaign attention.
                      </p>
                    </div>
                  </header>

                  {nextDeadline ? (
                    <button
                      type="button"
                      className={
                        styles.nextPostButton
                      }
                      onClick={() =>
                        openItem(
                          nextDeadline,
                        )
                      }
                    >
                      <div>
                        <strong>
                          {nextDeadline.title}
                        </strong>

                        <span>
                          {formatDateTime(
                            nextDeadline.due_at,
                            timezone,
                            "No deadline",
                          )}
                        </span>
                      </div>

                      <div
                        className={
                          styles.platformStack
                        }
                      >
                        <i>
                          {itemTypeAbbreviation(
                            nextDeadline.item_type,
                          )}
                        </i>
                      </div>

                      <em>
                        {statusLabel(
                          nextDeadline.status,
                        )}
                      </em>
                    </button>
                  ) : (
                    <div
                      className={
                        styles.emptyState
                      }
                    >
                      <CalendarDays
                        size={28}
                      />

                      <strong>
                        No media deadlines yet
                      </strong>

                      <span>
                        Create the first live Media Center draft.
                        Deadlines and response workflows can then
                        be coordinated from Campaign Seat.
                      </span>

                      {canManage ? (
                        <button
                          type="button"
                          onClick={() =>
                            setComposerOpen(
                              true,
                            )
                          }
                        >
                          Create first media record
                        </button>
                      ) : null}
                    </div>
                  )}
                </section>
              ) : null}


              <MediaItemTable
                items={
                  displayItems
                }
                timezone={
                  timezone
                }
                title={
                  tableTitle
                }
                subtitle={
                  tableSubtitle
                }
                selectedItemId={
                  selectedItemId
                }
                onSelect={
                  openItem
                }
              />
            </div>


            <aside
              className={
                styles.rightRail
              }
            >
              <section
                className={
                  styles.attentionCard
                }
              >
                <header>
                  <span>
                    <Sparkles
                      size={19}
                    />
                  </span>

                  <div>
                    <h2>
                      Needs attention
                    </h2>

                    <p>
                      Communications work requiring a campaign
                      next action.
                    </p>
                  </div>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "materials",
                    )
                  }
                >
                  <div>
                    <strong>
                      {metrics.review} records in review
                    </strong>

                    <span>
                      Communications approval workflow
                    </span>
                  </div>

                  <em>
                    {metrics.review}
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "overview",
                    )
                  }
                >
                  <div>
                    <strong>
                      {metrics.drafts} drafts in progress
                    </strong>

                    <span>
                      Finish internal media preparation
                    </span>
                  </div>

                  <em>
                    {metrics.drafts}
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "requests",
                    )
                  }
                >
                  <div>
                    <strong>
                      {metrics.unlinkedRequests} requests without contacts
                    </strong>

                    <span>
                      Link the reporter or requester record
                    </span>
                  </div>

                  <em>
                    {metrics.unlinkedRequests}
                  </em>
                </button>
              </section>


              <section
                className={
                  styles.quickCard
                }
              >
                <header>
                  <h2>
                    Quick actions
                  </h2>
                </header>

                <button
                  type="button"
                  disabled={
                    !canManage
                  }
                  onClick={() =>
                    setComposerOpen(
                      true,
                    )
                  }
                >
                  <Plus
                    size={16}
                  />
                  Create media record
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "materials",
                    )
                  }
                >
                  <FileText
                    size={16}
                  />
                  Review press materials
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "requests",
                    )
                  }
                >
                  <Mail
                    size={16}
                  />
                  Review media requests
                </button>
              </section>


              <section
                className={
                  styles.connectionCard
                }
              >
                <span>
                  <FolderKanban
                    size={21}
                  />
                </span>

                <div>
                  <strong>
                    Media operations status
                  </strong>

                  <p>
                    Campaign Seat Media Center records are
                    connected to live workspace storage.
                  </p>

                  <small>
                    Media contacts: {metrics.mediaContacts}
                    {" · "}
                    Approved assets: {metrics.approvedAssets}
                    {" · "}
                    External press distribution and media
                    monitoring: Not connected
                  </small>
                </div>
              </section>
            </aside>
          </section>


          <div
            className={
              styles.footerNote
            }
          >
            <CheckCircle2
              size={16}
            />

            <span>
              Media Center is using live Campaign Seat storage.
              External press distribution, journalist outreach,
              and automated media-monitoring providers are not
              connected in V76B.
            </span>
          </div>
        </div>


        {composerOpen ? (
          <div
            className={
              styles.modalScrim
            }
            role="presentation"
            onMouseDown={(
              event,
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setComposerOpen(
                  false,
                );
              }
            }}
          >
            <form
              className={
                styles.modal
              }
              onSubmit={
                handleCreateDraft
              }
            >
              <header>
                <div>
                  <span>
                    Live Media Center
                  </span>

                  <h2>
                    Create media record
                  </h2>
                </div>

                <button
                  type="button"
                  aria-label="Close Media Center composer"
                  onClick={() =>
                    setComposerOpen(
                      false,
                    )
                  }
                >
                  <X
                    size={18}
                  />
                </button>
              </header>


              <div
                className={
                  styles.modalGrid
                }
              >
                <label>
                  Record type

                  <select
                    value={
                      form.itemType
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          itemType:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  >
                    {ITEM_TYPE_OPTIONS.map(
                      (itemType) => (
                        <option
                          key={
                            itemType
                          }
                          value={
                            itemType
                          }
                        >
                          {itemTypeLabel(
                            itemType,
                          )}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Outlet / publication

                  <input
                    type="text"
                    value={
                      form.outlet
                    }
                    maxLength={200}
                    placeholder="Optional"
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          outlet:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </label>
              </div>


              <label>
                Title

                <input
                  type="text"
                  required
                  maxLength={200}
                  value={
                    form.title
                  }
                  placeholder="Working title"
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        title:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>


              <label>
                Summary

                <textarea
                  value={
                    form.summary
                  }
                  maxLength={5000}
                  placeholder="Optional internal summary"
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        summary:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>


              <label>
                Working content / notes

                <textarea
                  value={
                    form.body
                  }
                  maxLength={50000}
                  placeholder="Draft content, request details, talking points, or internal notes"
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        body:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>


              <div
                className={
                  styles.modalInfo
                }
              >
                <CheckCircle2
                  size={16}
                />

                <span>
                  Save draft writes this record to the live
                  Campaign Seat Media Center. It does not send,
                  distribute, publish, or contact anyone externally.
                </span>
              </div>


              <footer>
                <button
                  type="button"
                  onClick={() =>
                    setComposerOpen(
                      false,
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={
                    styles.modalSubmit
                  }
                  disabled={
                    saving ||
                    !form.title.trim()
                  }
                >
                  {saving
                    ? "Saving…"
                    : "Save draft"}
                </button>
              </footer>
            </form>
          </div>
        ) : null}


        {selectedItemId ? (
          <MediaDetailDrawer
            item={
              selectedItem
            }
            loading={
              loading
            }
            timezone={
              timezone
            }
            onClose={
              closeItem
            }
          />
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}


function MediaItemTable({
  items,
  timezone,
  title,
  subtitle,
  selectedItemId,
  onSelect,
}) {
  return (
    <section
      className={
        styles.tablePanel
      }
    >
      <header
        className={
          styles.tableHeader
        }
      >
        <div>
          <h2>
            {title}
          </h2>

          <p>
            {subtitle}
          </p>
        </div>
      </header>

      {!items.length ? (
        <div
          className={
            styles.tableEmpty
          }
        >
          <FolderKanban
            size={27}
          />

          <strong>
            No Media Center records here yet
          </strong>

          <span>
            This view is backed by live Campaign Seat storage.
            New records will appear here after they are created.
          </span>
        </div>
      ) : (
        <>
          <div
            className={
              styles.postHeading
            }
          >
            <span>
              Item
            </span>

            <span>
              Type
            </span>

            <span>
              Status
            </span>

            <span>
              Outlet
            </span>

            <span>
              Due
            </span>

            <span>
              Updated
            </span>
          </div>

          <div
            className={
              styles.postTable
            }
          >
            {items.map(
              (item) => (
                <article
                  key={
                    item.id
                  }
                  role="button"
                  tabIndex={0}
                  className={
                    selectedItemId ===
                    item.id
                      ? styles.rowSelected
                      : styles.clickableRow
                  }
                  onClick={() =>
                    onSelect(
                      item,
                    )
                  }
                  onKeyDown={(
                    event,
                  ) => {
                    if (
                      event.key ===
                        "Enter" ||
                      event.key ===
                        " "
                    ) {
                      event.preventDefault();

                      onSelect(
                        item,
                      );
                    }
                  }}
                >
                  <div
                    className={
                      styles.postCell
                    }
                  >
                    <span>
                      <FileText
                        size={17}
                      />
                    </span>

                    <div>
                      <strong>
                        {item.title}
                      </strong>

                      <small>
                        {item.summary ||
                          item.body ||
                          `${item.contacts.length} linked contacts · ${item.assetCount} assets`}
                      </small>
                    </div>
                  </div>

                  <span>
                    {itemTypeLabel(
                      item.item_type,
                    )}
                  </span>

                  <em
                    data-status={
                      statusKey(
                        item.status,
                      )
                    }
                  >
                    {statusLabel(
                      item.status,
                    )}
                  </em>

                  <span>
                    {item.outlet ||
                      "—"}
                  </span>

                  <span>
                    {formatDateTime(
                      item.due_at,
                      timezone,
                      "—",
                    )}
                  </span>

                  <span>
                    {formatDateTime(
                      item.updated_at,
                      timezone,
                      "—",
                    )}
                  </span>
                </article>
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}


function MediaDetailDrawer({
  item,
  loading,
  timezone,
  onClose,
}) {
  return (
    <div
      className={
        styles.detailScrim
      }
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <aside
        className={
          styles.detailDrawer
        }
        aria-label="Media Center record details"
      >
        <header
          className={
            styles.detailHeader
          }
        >
          <div>
            <span>
              Media Center
            </span>

            <h2>
              {item
                ? item.title
                : loading
                  ? "Loading media record…"
                  : "Media record unavailable"}
            </h2>

            {item ? (
              <p>
                {itemTypeLabel(
                  item.item_type,
                )}
                {" · "}
                Created{" "}
                {formatDateTime(
                  item.created_at,
                  timezone,
                )}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Close media details"
            onClick={
              onClose
            }
          >
            <X
              size={19}
            />
          </button>
        </header>


        {!item ? (
          <div
            className={
              styles.detailBody
            }
          >
            <div
              className={
                styles.detailEmpty
              }
            >
              <FolderKanban
                size={30}
              />

              <strong>
                {loading
                  ? "Loading record"
                  : "Record not found"}
              </strong>

              <span>
                {loading
                  ? "Campaign Seat is loading the live Media Center record."
                  : "This deep link does not currently resolve to a Media Center record in this workspace."}
              </span>
            </div>
          </div>
        ) : (
          <div
            className={
              styles.detailBody
            }
          >
            <section
              className={
                styles.detailHero
              }
            >
              <span
                className={
                  styles.detailStatus
                }
                data-status={
                  statusKey(
                    item.status,
                  )
                }
              >
                <CheckCircle2
                  size={14}
                />

                {statusLabel(
                  item.status,
                )}
              </span>

              <strong>
                {itemTypeAbbreviation(
                  item.item_type,
                )}
              </strong>

              <p>
                {itemTypeLabel(
                  item.item_type,
                )}
              </p>
            </section>


            {(item.summary ||
              item.body) ? (
              <section
                className={
                  styles.contentCard
                }
              >
                <small>
                  Working content
                </small>

                {item.summary ? (
                  <p>
                    {item.summary}
                  </p>
                ) : null}

                {item.body ? (
                  <p>
                    {item.body}
                  </p>
                ) : null}
              </section>
            ) : null}


            <section
              className={
                styles.detailGrid
              }
            >
              <div>
                <small>
                  Type
                </small>

                <strong>
                  {itemTypeLabel(
                    item.item_type,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Status
                </small>

                <strong>
                  {statusLabel(
                    item.status,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Outlet
                </small>

                <strong>
                  {item.outlet ||
                    "Not set"}
                </strong>
              </div>

              <div>
                <small>
                  Due
                </small>

                <strong>
                  {formatDateTime(
                    item.due_at,
                    timezone,
                    "Not set",
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Contacts
                </small>

                <strong>
                  {item.contacts.length}
                </strong>
              </div>

              <div>
                <small>
                  Assets
                </small>

                <strong>
                  {item.assetCount}
                </strong>
              </div>
            </section>


            <section
              className={
                styles.detailSection
              }
            >
              <div>
                <Users
                  size={19}
                />

                <div>
                  <h3>
                    Linked contacts
                  </h3>

                  <p>
                    {item.contacts.length
                      ? item.contacts
                          .map(
                            (link) =>
                              link.contact
                                ?.full_name ||
                              link.contact
                                ?.organization ||
                              "Campaign contact",
                          )
                          .join(", ")
                      : "No contacts linked to this Media Center record yet."}
                  </p>
                </div>
              </div>
            </section>


            <section
              className={
                styles.detailSection
              }
            >
              <div>
                <CheckCircle2
                  size={19}
                />

                <div>
                  <h3>
                    Approval
                  </h3>

                  <p>
                    {item.approval
                      ? `Linked communications approval: ${statusLabel(
                          item.approval
                            .status,
                        )}`
                      : "No communications approval is linked."}
                  </p>
                </div>
              </div>
            </section>


            <section
              className={
                styles.detailSection
              }
            >
              <div>
                <Mail
                  size={19}
                />

                <div>
                  <h3>
                    External distribution
                  </h3>

                  <p>
                    Not connected. V76B stores and coordinates
                    Media Center operations inside Campaign Seat
                    only; it does not distribute press materials,
                    contact reporters, or ingest external coverage.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
