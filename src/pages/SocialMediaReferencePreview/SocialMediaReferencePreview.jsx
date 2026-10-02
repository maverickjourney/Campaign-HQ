import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Image,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
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
  useSocialMediaWorkspace,
} from "../../hooks/useSocialMediaWorkspace";

import {
  getCurrentUser,
  getCurrentWorkspace,
  hasCampaignPermission,
} from "../../utils/campaignSession";

import styles from "./SocialMediaReferencePreview.module.css";


const SOCIAL_VIEWS =
  new Set([
    "overview",
    "calendar",
    "drafts",
  ]);

const PLATFORM_OPTIONS = [
  {
    key: "facebook",
    label: "Facebook",
    abbreviation: "F",
  },
  {
    key: "instagram",
    label: "Instagram",
    abbreviation: "IG",
  },
  {
    key: "x",
    label: "X",
    abbreviation: "X",
  },
  {
    key: "tiktok",
    label: "TikTok",
    abbreviation: "TT",
  },
];


function titleCase(value) {
  return String(
    value ||
    "",
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


function platformLabel(value) {
  const platform =
    String(
      value ||
      "",
    )
      .trim()
      .toLowerCase();

  if (
    platform === "x"
  ) {
    return "X";
  }

  return titleCase(
    platform,
  );
}


function platformAbbreviation(
  value,
) {
  const match =
    PLATFORM_OPTIONS.find(
      (option) =>
        option.key ===
        value,
    );

  if (match) {
    return match.abbreviation;
  }

  return String(
    value ||
    "?",
  )
    .slice(0, 2)
    .toUpperCase();
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
) {
  const date =
    safeDate(value);

  if (!date) {
    return "Not scheduled";
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


function readSocialLocation() {
  if (
    typeof window ===
    "undefined"
  ) {
    return {
      view:
        "overview",

      postId:
        "",
    };
  }

  const url =
    new URL(
      window.location.href,
    );

  const requestedView =
    url.searchParams.get(
      "social-view",
    );

  return {
    view:
      SOCIAL_VIEWS.has(
        requestedView,
      )
        ? requestedView
        : "overview",

    postId:
      url.searchParams.get(
        "post",
      ) ||
      "",
  };
}


function statusKey(value) {
  return String(
    value ||
    "",
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      "-",
    );
}


export default function SocialMediaReferencePreview() {
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

  const canSend =
    hasCampaignPermission(
      "communications.send",
    );

  const {
    posts,
    metrics,
    loading,
    saving,
    error,
    lastUpdated,
    refresh,
    createDraft,
  } =
    useSocialMediaWorkspace({
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
        readSocialLocation()
          .view,
    );

  const [
    selectedPostId,
    setSelectedPostId,
  ] =
    useState(
      () =>
        readSocialLocation()
          .postId,
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
      title: "",
      body: "",
      postType:
        "standard",
      platforms: [
        "facebook",
        "instagram",
      ],
    });


  const selectedPost =
    selectedPostId
      ? posts.find(
          (post) =>
            post.id ===
            selectedPostId,
        ) ||
        null
      : null;


  const scheduledPosts =
    useMemo(
      () =>
        posts
          .filter(
            (post) =>
              post.status ===
              "scheduled",
          )
          .sort(
            (
              left,
              right,
            ) =>
              (
                safeDate(
                  left
                    .scheduled_at,
                )
                  ?.getTime() ||
                Number.MAX_SAFE_INTEGER
              ) -
              (
                safeDate(
                  right
                    .scheduled_at,
                )
                  ?.getTime() ||
                Number.MAX_SAFE_INTEGER
              ),
          ),
      [
        posts,
      ],
    );


  const draftPosts =
    useMemo(
      () =>
        posts.filter(
          (post) =>
            [
              "draft",
              "review",
              "approved",
            ].includes(
              post.status,
            ),
        ),
      [
        posts,
      ],
    );


  const displayPosts =
    activeView ===
    "calendar"
      ? scheduledPosts
      : activeView ===
        "drafts"
        ? draftPosts
        : posts.slice(
            0,
            8,
          );


  const nextScheduled =
    scheduledPosts[0] ||
    null;


  const applyLocation =
    (
      nextView,
      nextPostId = "",
      {
        replace = false,
      } = {},
    ) => {
      const url =
        new URL(
          window.location.href,
        );

      url.searchParams.set(
        "social-view",
        nextView,
      );

      if (
        nextPostId
      ) {
        url.searchParams.set(
          "post",
          nextPostId,
        );
      } else {
        url.searchParams.delete(
          "post",
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

      setSelectedPostId(
        nextPostId,
      );
    };


  const openPost =
    (post) => {
      applyLocation(
        activeView,
        post.id,
      );
    };


  const closePost =
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
            readSocialLocation();

          setActiveView(
            next.view,
          );

          setSelectedPostId(
            next.postId,
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


  const togglePlatform =
    (platform) => {
      setForm(
        (current) => {
          const selected =
            current.platforms.includes(
              platform,
            );

          return {
            ...current,

            platforms:
              selected
                ? current.platforms.filter(
                    (value) =>
                      value !==
                      platform,
                  )
                : [
                    ...current.platforms,
                    platform,
                  ],
          };
        },
      );
    };


  const handleCreateDraft =
    async (
      event,
    ) => {
      event.preventDefault();

      try {
        const postId =
          await createDraft({
            title:
              form.title,

            body:
              form.body,

            postType:
              form.postType,

            platforms:
              form.platforms,
          });

        setForm({
          title: "",
          body: "",
          postType:
            "standard",
          platforms: [
            "facebook",
            "instagram",
          ],
        });

        setComposerOpen(
          false,
        );

        applyLocation(
          "drafts",
          postId,
        );

        setNotice(
          "Draft saved to the live Campaign Seat Social Media workspace.",
        );
      } catch (
        createError
      ) {
        console.error(
          "[Social Media] draft creation failed",
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


  return (
    <CampaignWorkspaceShell
      activeItem="Social Media"
    >
      <main
        className={
          styles.main
        }
        data-social-command-center="true"
        data-social-live-storage="true"
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
                Content operations
              </span>

              <h1>
                Social Media Command Center
              </h1>

              <p>
                Plan campaign content, coordinate platform
                targets, track review state, and manage the
                publishing calendar from one workspace.
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
                      ? "Live Social Media workspace refreshed."
                      : "Unable to refresh Social Media workspace.",
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
                Create post
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
                  ? "Loading live Social Media records…"
                  : "Live Campaign Seat Social Media storage connected"}
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
            aria-label="Social Media summary"
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
                <MessageSquare
                  size={22}
                />
              </span>

              <span>
                <small>
                  Content records
                </small>

                <strong>
                  {metrics.total}
                </strong>

                <em>
                  Live workspace posts
                </em>
              </span>
            </button>


            <button
              type="button"
              className={
                activeView ===
                "drafts"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "drafts",
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
                  Drafts
                </small>

                <strong>
                  {metrics.drafts}
                </strong>

                <em>
                  Content still being prepared
                </em>
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                applyLocation(
                  "drafts",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <Users
                  size={22}
                />
              </span>

              <span>
                <small>
                  In review
                </small>

                <strong>
                  {metrics.review}
                </strong>

                <em>
                  Communications review queue
                </em>
              </span>
            </button>


            <button
              type="button"
              className={
                activeView ===
                "calendar"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "calendar",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <CalendarDays
                  size={22}
                />
              </span>

              <span>
                <small>
                  Scheduled
                </small>

                <strong>
                  {metrics.scheduled}
                </strong>

                <em>
                  Campaign Seat content calendar
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
                aria-label="Social Media views"
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
                    "calendar"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "calendar",
                    )
                  }
                >
                  Content calendar
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "drafts"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "drafts",
                    )
                  }
                >
                  Drafts &amp; review
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
                      <Sparkles
                        size={19}
                      />
                    </span>

                    <div>
                      <h2>
                        Next scheduled post
                      </h2>

                      <p>
                        Nearest internally scheduled campaign
                        content record.
                      </p>
                    </div>
                  </header>

                  {nextScheduled ? (
                    <button
                      type="button"
                      className={
                        styles.nextPostButton
                      }
                      onClick={() =>
                        openPost(
                          nextScheduled,
                        )
                      }
                    >
                      <div>
                        <strong>
                          {nextScheduled
                            .title ||
                            "Untitled post"}
                        </strong>

                        <span>
                          {formatDateTime(
                            nextScheduled
                              .scheduled_at,
                            timezone,
                          )}
                        </span>
                      </div>

                      <div
                        className={
                          styles.platformStack
                        }
                      >
                        {nextScheduled
                          .targets
                          .map(
                            (target) => (
                              <i
                                key={
                                  target.id
                                }
                              >
                                {platformAbbreviation(
                                  target.platform,
                                )}
                              </i>
                            ),
                          )}
                      </div>

                      <em>
                        Scheduled
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
                        No content scheduled yet
                      </strong>

                      <span>
                        Create the first live campaign draft,
                        then move approved content onto the
                        Campaign Seat content calendar.
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
                          Create first post
                        </button>
                      ) : null}
                    </div>
                  )}
                </section>
              ) : null}


              <SocialPostTable
                posts={
                  displayPosts
                }
                timezone={
                  timezone
                }
                title={
                  activeView ===
                  "calendar"
                    ? "Content calendar"
                    : activeView ===
                      "drafts"
                      ? "Drafts & review"
                      : "Recent content"
                }
                subtitle={
                  activeView ===
                  "calendar"
                    ? "Internally scheduled Campaign Seat content. External provider publishing is not connected."
                    : activeView ===
                      "drafts"
                      ? "Content still being prepared or reviewed."
                      : "Live Social Media records for this campaign workspace."
                }
                selectedPostId={
                  selectedPostId
                }
                onSelect={
                  openPost
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
                      Content work requiring a campaign next
                      action.
                    </p>
                  </div>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "drafts",
                    )
                  }
                >
                  <div>
                    <strong>
                      {metrics.review} posts in review
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
                      "drafts",
                    )
                  }
                >
                  <div>
                    <strong>
                      {metrics.drafts} drafts in progress
                    </strong>

                    <span>
                      Finish content before scheduling
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
                      "overview",
                    )
                  }
                >
                  <div>
                    <strong>
                      {metrics.withoutTargets} without platform targets
                    </strong>

                    <span>
                      Assign intended channels
                    </span>
                  </div>

                  <em>
                    {metrics.withoutTargets}
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
                  <Plus size={18} />
                  Create post
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "drafts",
                    )
                  }
                >
                  <FileText
                    size={18}
                  />
                  Review drafts
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "calendar",
                    )
                  }
                >
                  <CalendarDays
                    size={18}
                  />
                  View content calendar
                </button>
              </section>


              <section
                className={
                  styles.connectionCard
                }
              >
                <span>
                  <Send size={21} />
                </span>

                <div>
                  <strong>
                    Publishing connections
                  </strong>

                  <p>
                    {metrics
                      .publishingConnections} connected
                    social publishing providers. External
                    publishing remains disconnected.
                  </p>

                  {canSend ? (
                    <small>
                      Your role has communications.send
                      authority for future provider-enabled
                      scheduling.
                    </small>
                  ) : null}
                </div>
              </section>
            </aside>
          </section>


          <footer
            className={
              styles.footerNote
            }
          >
            <FileText
              size={16}
            />

            <span>
              V75B stores campaign social content, platform
              targets, review state, and assets in Campaign
              Seat. External social publishing is not
              connected yet.
            </span>
          </footer>
        </div>


        <PostDetailDrawer
          post={
            selectedPost
          }
          postId={
            selectedPostId
          }
          timezone={
            timezone
          }
          onClose={
            closePost
          }
        />


        {composerOpen ? (
          <div
            className={
              styles.modalScrim
            }
            role="presentation"
            onMouseDown={
              (mouseEvent) => {
                if (
                  mouseEvent.target ===
                  mouseEvent.currentTarget
                ) {
                  setComposerOpen(
                    false,
                  );
                }
              }
            }
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
                    Social Media
                  </span>

                  <h2>
                    Create campaign post
                  </h2>
                </div>

                <button
                  type="button"
                  aria-label="Close post composer"
                  onClick={() =>
                    setComposerOpen(
                      false,
                    )
                  }
                >
                  <X size={20} />
                </button>
              </header>


              <label>
                Working title

                <input
                  type="text"
                  maxLength={160}
                  value={
                    form.title
                  }
                  placeholder="Optional internal title"
                  autoFocus
                  onChange={
                    (event) =>
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
                Post content

                <textarea
                  value={
                    form.body
                  }
                  required
                  maxLength={10000}
                  placeholder="Write the campaign content..."
                  onChange={
                    (event) =>
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
                  styles.modalGrid
                }
              >
                <label>
                  Content type

                  <select
                    value={
                      form.postType
                    }
                    onChange={
                      (event) =>
                        setForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            postType:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                  >
                    <option value="standard">
                      Standard
                    </option>

                    <option value="image">
                      Image
                    </option>

                    <option value="video">
                      Video
                    </option>

                    <option value="reel">
                      Reel
                    </option>

                    <option value="story">
                      Story
                    </option>

                    <option value="thread">
                      Thread
                    </option>
                  </select>
                </label>


                <div
                  className={
                    styles.platformPicker
                  }
                >
                  <span>
                    Planned platforms
                  </span>

                  <div>
                    {PLATFORM_OPTIONS.map(
                      (
                        platform,
                      ) => (
                        <button
                          key={
                            platform.key
                          }
                          type="button"
                          data-selected={
                            form.platforms.includes(
                              platform.key,
                            )
                              ? "true"
                              : "false"
                          }
                          onClick={() =>
                            togglePlatform(
                              platform.key,
                            )
                          }
                        >
                          <i>
                            {
                              platform.abbreviation
                            }
                          </i>

                          {
                            platform.label
                          }
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>


              <div
                className={
                  styles.modalInfo
                }
              >
                <Clock3
                  size={17}
                />

                <span>
                  Saving creates a live Campaign Seat draft
                  and internal platform plan only. It does
                  not publish to an external social network.
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
                    saving
                  }
                >
                  <FileText
                    size={17}
                  />

                  {saving
                    ? "Saving…"
                    : "Save draft"}
                </button>
              </footer>
            </form>
          </div>
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}


function SocialPostTable({
  posts,
  timezone,
  title,
  subtitle,
  selectedPostId,
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


      <div
        className={
          styles.postTable
        }
      >
        <div
          className={
            styles.postHeading
          }
        >
          <span>
            Content
          </span>

          <span>
            Platforms
          </span>

          <span>
            Type
          </span>

          <span>
            Schedule
          </span>

          <span>
            Approval
          </span>

          <span>
            Status
          </span>
        </div>


        {posts.length ? (
          posts.map(
            (post) => (
              <article
                key={
                  post.id
                }
                role="button"
                tabIndex={0}
                className={
                  selectedPostId ===
                  post.id
                    ? styles.rowSelected
                    : styles.clickableRow
                }
                onClick={() =>
                  onSelect(
                    post,
                  )
                }
                onKeyDown={
                  (
                    keyboardEvent,
                  ) => {
                    if (
                      keyboardEvent.key ===
                        "Enter" ||
                      keyboardEvent.key ===
                        " "
                    ) {
                      keyboardEvent
                        .preventDefault();

                      onSelect(
                        post,
                      );
                    }
                  }
                }
              >
                <div
                  className={
                    styles.postCell
                  }
                >
                  <span>
                    <MessageSquare
                      size={16}
                    />
                  </span>

                  <div>
                    <strong>
                      {post.title ||
                        "Untitled post"}
                    </strong>

                    <small>
                      {post.body}
                    </small>
                  </div>
                </div>


                <div
                  className={
                    styles.platformStack
                  }
                >
                  {post.targets
                    .length
                    ? post.targets.map(
                        (target) => (
                          <i
                            key={
                              target.id
                            }
                            title={
                              platformLabel(
                                target.platform,
                              )
                            }
                          >
                            {platformAbbreviation(
                              target.platform,
                            )}
                          </i>
                        ),
                      )
                    : (
                        <small>
                          None
                        </small>
                      )}
                </div>


                <span>
                  {titleCase(
                    post.post_type,
                  )}
                </span>


                <span>
                  {post.scheduled_at
                    ? formatDateTime(
                        post.scheduled_at,
                        timezone,
                      )
                    : "Not scheduled"}
                </span>


                <span>
                  {post.approval
                    ? titleCase(
                        post
                          .approval
                          .status,
                      )
                    : "Not linked"}
                </span>


                <em
                  data-status={
                    statusKey(
                      post.status,
                    )
                  }
                >
                  {titleCase(
                    post.status,
                  )}
                </em>
              </article>
            ),
          )
        ) : (
          <div
            className={
              styles.tableEmpty
            }
          >
            <MessageSquare
              size={26}
            />

            <strong>
              No social content in this view
            </strong>

            <span>
              Campaign Seat will display live Social Media
              records here as content is created.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}


function PostDetailDrawer({
  post,
  postId,
  timezone,
  onClose,
}) {
  if (!postId) {
    return null;
  }

  if (!post) {
    return (
      <div
        className={
          styles.detailScrim
        }
        role="presentation"
        onMouseDown={
          (mouseEvent) => {
            if (
              mouseEvent.target ===
              mouseEvent.currentTarget
            ) {
              onClose();
            }
          }
        }
      >
        <aside
          className={
            styles.detailDrawer
          }
          role="dialog"
          aria-modal="true"
          aria-label="Social Media post"
        >
          <header
            className={
              styles.detailHeader
            }
          >
            <div>
              <span>
                Social Media
              </span>

              <h2>
                Post unavailable
              </h2>

              <p>
                This live content record could not be found.
              </p>
            </div>

            <button
              type="button"
              aria-label="Close post details"
              onClick={
                onClose
              }
            >
              <X size={22} />
            </button>
          </header>


          <div
            className={
              styles.detailBody
            }
          >
            <section
              className={
                styles.detailEmpty
              }
            >
              <MessageSquare
                size={28}
              />

              <strong>
                Live post unavailable
              </strong>

              <span>
                This URL does not currently resolve to a
                Social Media record in this campaign
                workspace.
              </span>
            </section>
          </div>
        </aside>
      </div>
    );
  }


  return (
    <div
      className={
        styles.detailScrim
      }
      role="presentation"
      onMouseDown={
        (mouseEvent) => {
          if (
            mouseEvent.target ===
            mouseEvent.currentTarget
          ) {
            onClose();
          }
        }
      }
    >
      <aside
        className={
          styles.detailDrawer
        }
        role="dialog"
        aria-modal="true"
        aria-label="Social Media post"
      >
        <header
          className={
            styles.detailHeader
          }
        >
          <div>
            <span>
              Social content
            </span>

            <h2>
              {post.title ||
                "Untitled post"}
            </h2>

            <p>
              {titleCase(
                post.status,
              )}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close post details"
            onClick={
              onClose
            }
          >
            <X size={22} />
          </button>
        </header>


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
            >
              <MessageSquare
                size={15}
              />

              {titleCase(
                post.post_type,
              )}
            </span>

            <strong>
              {titleCase(
                post.status,
              )}
            </strong>

            <p>
              {post.scheduled_at
                ? formatDateTime(
                    post.scheduled_at,
                    timezone,
                  )
                : "Not scheduled"}
            </p>
          </section>


          <section
            className={
              styles.contentCard
            }
          >
            <small>
              Post content
            </small>

            <p>
              {post.body ||
                "No content recorded."}
            </p>
          </section>


          <section
            className={
              styles.detailGrid
            }
          >
            <div>
              <small>
                Platforms
              </small>

              <strong>
                {post.targets
                  .length
                  ? post.targets
                      .map(
                        (target) =>
                          platformLabel(
                            target.platform,
                          ),
                      )
                      .join(", ")
                  : "No targets"}
              </strong>
            </div>

            <div>
              <small>
                Assets
              </small>

              <strong>
                {post.assetCount}
              </strong>
            </div>

            <div>
              <small>
                Approval
              </small>

              <strong>
                {post.approval
                  ? titleCase(
                      post
                        .approval
                        .status,
                    )
                  : "Not linked"}
              </strong>
            </div>

            <div>
              <small>
                External publishing
              </small>

              <strong>
                Not connected
              </strong>
            </div>

            <div>
              <small>
                Created
              </small>

              <strong>
                {formatDateTime(
                  post.created_at,
                  timezone,
                )}
              </strong>
            </div>

            <div>
              <small>
                Updated
              </small>

              <strong>
                {formatDateTime(
                  post.updated_at,
                  timezone,
                )}
              </strong>
            </div>
          </section>


          <section
            className={
              styles.detailSection
            }
          >
            <div>
              <span
                className={
                  styles.sectionIcon
                }
              >
                <Image
                  size={18}
                />
              </span>

              <div>
                <h3>
                  Campaign content record
                </h3>

                <p>
                  Platform targets and creative assets remain
                  private Campaign Seat workspace data until
                  an external publishing integration is
                  explicitly connected.
                </p>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
