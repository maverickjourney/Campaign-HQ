import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Grid2X2,
  History,
  Link2,
  List,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { useLocation } from "react-router-dom";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";
import {
  MAX_CAMPAIGN_FILE_SIZE,
  useFilesCommandCenter,
} from "../../hooks/useFilesCommandCenter";
import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./DocumentsReferencePreview.module.css";

const DOCUMENTS_DEMO_REFERENCE_TIME = Date.now();

const DEMO_DOCUMENTS = [
  {
    id: "document-demo-1",
    file_name: "District_6_Campaign_Plan.pdf",
    storage_path: "demo/district-6-campaign-plan.pdf",
    mime_type: "application/pdf",
    size_bytes: 2840000,
    category: "Campaign Materials",
    uploaded_by: "current-user",
    created_at: new Date(
      DOCUMENTS_DEMO_REFERENCE_TIME -
        1000 * 60 * 48,
    ).toISOString(),
    description:
      "Current campaign strategy, goals, milestones, and leadership responsibilities.",
    version: "Version 4",
    linked_records: [
      "Monday leadership briefing",
      "Finalize campaign launch priorities",
    ],
    activity: [
      "Uploaded by Elizabeth Accomando",
      "Reviewed by campaign leadership",
      "Linked to Monday leadership briefing",
    ],
  },
  {
    id: "document-demo-2",
    file_name: "Community_Forum_Run_of_Show.docx",
    storage_path: "demo/community-forum-run-of-show.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size_bytes: 486000,
    category: "Events",
    uploaded_by: "current-user",
    created_at: new Date(
      DOCUMENTS_DEMO_REFERENCE_TIME -
        1000 * 60 * 60 * 5,
    ).toISOString(),
    description:
      "Speaking order, timing, accessibility notes, and staff assignments for the community forum.",
    version: "Version 2",
    linked_records: [
      "Community forum",
      "Confirm participant list",
    ],
    activity: [
      "Updated by Elizabeth Accomando",
      "Shared with event leadership",
    ],
  },
  {
    id: "document-demo-3",
    file_name: "Volunteer_Shift_Assignments.xlsx",
    storage_path: "demo/volunteer-shifts.xlsx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size_bytes: 1130000,
    category: "Field Operations",
    uploaded_by: "campaign-team",
    created_at: new Date(
      DOCUMENTS_DEMO_REFERENCE_TIME -
        1000 * 60 * 60 * 24,
    ).toISOString(),
    description:
      "Volunteer assignments, staging locations, team captains, and check-in notes.",
    version: "Version 7",
    linked_records: [
      "Weekend canvass launch",
      "Volunteer leadership assignments",
    ],
    activity: [
      "Uploaded by campaign team",
      "Updated after volunteer confirmations",
    ],
  },
  {
    id: "document-demo-4",
    file_name: "Candidate_Headshot_Final.jpg",
    storage_path: "demo/candidate-headshot.jpg",
    mime_type: "image/jpeg",
    size_bytes: 4200000,
    category: "Creative",
    uploaded_by: "campaign-team",
    created_at: new Date(
      DOCUMENTS_DEMO_REFERENCE_TIME -
        1000 * 60 * 60 * 27,
    ).toISOString(),
    description:
      "Approved candidate headshot for digital, print, press, and campaign communications.",
    version: "Approved final",
    linked_records: [
      "Media kit",
      "Campaign website",
    ],
    activity: [
      "Uploaded by communications",
      "Approved for public use",
    ],
  },
  {
    id: "document-demo-5",
    file_name: "July_Mail_Piece_Proof.pdf",
    storage_path: "demo/july-mail-piece-proof.pdf",
    mime_type: "application/pdf",
    size_bytes: 7800000,
    category: "Creative",
    uploaded_by: "campaign-team",
    created_at: new Date(
      DOCUMENTS_DEMO_REFERENCE_TIME -
        1000 * 60 * 60 * 50,
    ).toISOString(),
    description:
      "Printer-ready proof awaiting final campaign review before production.",
    version: "Proof 3",
    linked_records: [
      "Approve July mail-piece proof",
    ],
    activity: [
      "Uploaded by communications",
      "Sent for leadership approval",
    ],
    needs_attention: true,
  },
  {
    id: "document-demo-6",
    file_name: "Weekly_Compliance_Checklist.pdf",
    storage_path: "demo/compliance-checklist.pdf",
    mime_type: "application/pdf",
    size_bytes: 910000,
    category: "Compliance",
    uploaded_by: "campaign-team",
    created_at: new Date(
      DOCUMENTS_DEMO_REFERENCE_TIME -
        1000 * 60 * 60 * 24 * 4,
    ).toISOString(),
    description:
      "Weekly documentation checklist for campaign reporting and record retention.",
    version: "Week 30",
    linked_records: [
      "Approve weekly compliance filing",
    ],
    activity: [
      "Uploaded by campaign treasurer",
      "Added to weekly review",
    ],
  },
  {
    id: "document-demo-7",
    file_name: "Neighborhood_Traffic_Notes.txt",
    storage_path: "demo/traffic-notes.txt",
    mime_type: "text/plain",
    size_bytes: 36000,
    category: "Research",
    uploaded_by: "current-user",
    created_at: new Date(
      DOCUMENTS_DEMO_REFERENCE_TIME -
        1000 * 60 * 60 * 24 * 8,
    ).toISOString(),
    description:
      "Community concerns, resident quotes, and follow-up research for the District 6 traffic plan.",
    version: "Working notes",
    linked_records: [
      "Send revised traffic plan to neighborhood leaders",
    ],
    activity: [
      "Created by Elizabeth Accomando",
      "Updated after community roundtable",
    ],
  },
  {
    id: "document-demo-8",
    file_name: "Archived_Event_Photos.zip",
    storage_path: "demo/archived-event-photos.zip",
    mime_type: "application/zip",
    size_bytes: 24700000,
    category: "Archive",
    uploaded_by: "campaign-team",
    created_at: new Date(
      DOCUMENTS_DEMO_REFERENCE_TIME -
        1000 * 60 * 60 * 24 * 18,
    ).toISOString(),
    description:
      "Original event photos preserved for campaign records and future communications.",
    version: "Archive",
    linked_records: [],
    activity: [
      "Archived by communications",
    ],
  },
];

const TYPE_LABELS = {
  document: "Document",
  image: "Image",
  spreadsheet: "Spreadsheet",
  archive: "Archive",
  other: "Other",
};

function fileType(file) {
  const mimeType = String(
    file?.mime_type || "",
  ).toLowerCase();
  const fileName = String(
    file?.file_name || "",
  ).toLowerCase();

  if (
    mimeType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg)$/.test(fileName)
  ) {
    return "image";
  }

  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    /\.(xlsx?|csv)$/.test(fileName)
  ) {
    return "spreadsheet";
  }

  if (
    mimeType.includes("zip") ||
    mimeType.includes("archive") ||
    /\.(zip|rar|7z|tar|gz)$/.test(fileName)
  ) {
    return "archive";
  }

  if (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.startsWith("text/") ||
    /\.(pdf|docx?|txt|rtf)$/.test(fileName)
  ) {
    return "document";
  }

  return "other";
}

function FileTypeIcon({
  file,
  size = 20,
}) {
  const type = fileType(file);

  if (type === "image") {
    return <FileImage size={size} />;
  }

  if (type === "spreadsheet") {
    return <FileSpreadsheet size={size} />;
  }

  if (type === "archive") {
    return <FileArchive size={size} />;
  }

  return <FileText size={size} />;
}

function formatBytes(value) {
  const bytes = Number(value || 0);

  if (!bytes) {
    return "0 KB";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(
      1,
      Math.round(bytes / 1024),
    )} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(date);
}

function isRecent(file) {
  const created = new Date(
    file.created_at,
  ).getTime();

  return (
    Number.isFinite(created) &&
    DOCUMENTS_DEMO_REFERENCE_TIME - created <=
      1000 * 60 * 60 * 24 * 7
  );
}

export default function DocumentsReferencePreview() {
  const location = useLocation();
  const workspace = getCurrentWorkspace();
  const user = getCurrentUser();

  const demoMode =
    new URLSearchParams(
      location.search,
    ).get("documents-demo") === "1";

  const filesCommandCenter =
    useFilesCommandCenter({
      workspaceId: workspace.id,
      userId: user.id,
    });

  const liveFiles =
    filesCommandCenter.files || [];

  const isLoading =
    filesCommandCenter.isLoading ||
    filesCommandCenter.loading ||
    false;

  const isSaving =
    filesCommandCenter.isSaving ||
    false;

  const loadError =
    filesCommandCenter.error || "";

  const [demoFiles, setDemoFiles] =
    useState(DEMO_DOCUMENTS);

  const [search, setSearch] =
    useState("");

  const [activeView, setActiveView] =
    useState("all");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [typeFilter, setTypeFilter] =
    useState("all");

  const [sortMode, setSortMode] =
    useState("newest");

  const [layout, setLayout] =
    useState("list");

  const [detailsTab, setDetailsTab] =
    useState("overview");

  const [detailsExpanded, setDetailsExpanded] =
    useState(false);

  const [selectedFileId, setSelectedFileId] =
    useState("");

  const [uploadOpen, setUploadOpen] =
    useState(false);

  const [uploadCategory, setUploadCategory] =
    useState("Campaign Materials");

  const [selectedUploadFiles, setSelectedUploadFiles] =
    useState([]);

  const [dragActive, setDragActive] =
    useState(false);

  const [toast, setToast] =
    useState("");

  const fileInputRef = useRef(null);

  const files = demoMode
    ? demoFiles
    : liveFiles;

  // DOCUMENTS_FOCUS_MODE_V3_EXACT
  useEffect(() => {
    const focusMode =
      Boolean(selectedFileId) ||
      uploadOpen;

    const hiddenSupportElements = [];

    const hideSupportElements = () => {
      const candidates =
        document.querySelectorAll(
          [
            "[data-support-launcher]",
            "[data-floating-support]",
            'button[aria-label*="support" i]',
            'button[title*="support" i]',
            '[role="button"][aria-label*="support" i]',
            "button",
          ].join(","),
        );

      candidates.forEach(
        (candidate) => {
          if (
            !(candidate instanceof HTMLElement) ||
            candidate.hasAttribute(
              "data-documents-hidden-support",
            )
          ) {
            return;
          }

          const accessibleLabel = [
            candidate.getAttribute(
              "aria-label",
            ),
            candidate.getAttribute(
              "title",
            ),
            candidate.textContent,
          ]
            .filter(Boolean)
            .join(" ")
            .trim();

          const isSupportLauncher =
            candidate.hasAttribute(
              "data-support-launcher",
            ) ||
            candidate.hasAttribute(
              "data-floating-support",
            ) ||
            /support/i.test(
              accessibleLabel,
            );

          if (!isSupportLauncher) {
            return;
          }

          hiddenSupportElements.push({
            element: candidate,
            displayValue:
              candidate.style.getPropertyValue(
                "display",
              ),
            displayPriority:
              candidate.style.getPropertyPriority(
                "display",
              ),
          });

          candidate.setAttribute(
            "data-documents-hidden-support",
            "true",
          );

          candidate.style.setProperty(
            "display",
            "none",
            "important",
          );
        },
      );
    };

    const restoreSupportElements = () => {
      hiddenSupportElements.forEach(
        ({
          element,
          displayValue,
          displayPriority,
        }) => {
          if (!element.isConnected) {
            return;
          }

          if (displayValue) {
            element.style.setProperty(
              "display",
              displayValue,
              displayPriority,
            );
          } else {
            element.style.removeProperty(
              "display",
            );
          }

          element.removeAttribute(
            "data-documents-hidden-support",
          );
        },
      );
    };

    let observer = null;

    if (focusMode) {
      document.body.dataset.documentsFocus =
        "true";

      hideSupportElements();

      observer = new MutationObserver(
        hideSupportElements,
      );

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true,
        },
      );
    } else {
      delete document.body.dataset.documentsFocus;
    }

    return () => {
      observer?.disconnect();
      restoreSupportElements();
      delete document.body.dataset.documentsFocus;
    };
  }, [
    selectedFileId,
    uploadOpen,
  ]);

  // DOCUMENTS_NOTIFICATION_AUTO_DISMISS_V3_EXACT
  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId =
      window.setTimeout(
        () => {
          setToast("");
        },
        2600,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [toast]);

  const categories = useMemo(() => {
    return [
      ...new Set(
        files
          .map(
            (file) =>
              file.category ||
              "Uncategorized",
          )
          .filter(Boolean),
      ),
    ].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [files]);

  const quickCollections = useMemo(() => {
    const counts = files.reduce(
      (result, file) => {
        const category =
          file.category ||
          "Uncategorized";

        result[category] =
          (result[category] || 0) + 1;

        return result;
      },
      {},
    );

    return Object.entries(counts)
      .sort((a, b) => {
        if (b[1] !== a[1]) {
          return b[1] - a[1];
        }

        return a[0].localeCompare(b[0]);
      })
      .slice(0, 6);
  }, [files]);

  const filteredFiles = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    const nextFiles = files.filter(
      (file) => {
        const type = fileType(file);
        const category =
          file.category ||
          "Uncategorized";

        if (
          activeView === "mine" &&
          file.uploaded_by !== user.id &&
          file.uploaded_by !== "current-user"
        ) {
          return false;
        }

        if (
          activeView === "recent" &&
          !isRecent(file)
        ) {
          return false;
        }

        if (
          activeView === "attention" &&
          !file.needs_attention
        ) {
          return false;
        }

        if (
          categoryFilter !== "all" &&
          category !== categoryFilter
        ) {
          return false;
        }

        if (
          typeFilter !== "all" &&
          type !== typeFilter
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return [
          file.file_name,
          category,
          TYPE_LABELS[type],
          file.description,
          file.version,
          ...(file.linked_records || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      },
    );

    return [...nextFiles].sort(
      (a, b) => {
        if (sortMode === "oldest") {
          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          );
        }

        if (sortMode === "name") {
          return String(
            a.file_name,
          ).localeCompare(
            String(b.file_name),
          );
        }

        if (sortMode === "size") {
          return (
            Number(b.size_bytes || 0) -
            Number(a.size_bytes || 0)
          );
        }

        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      },
    );
  }, [
    activeView,
    categoryFilter,
    files,
    search,
    sortMode,
    typeFilter,
    user.id,
  ]);

  const selectedFile =
    files.find(
      (file) =>
        file.id === selectedFileId,
    ) || null;

  const recentCount =
    files.filter(isRecent).length;

  const documentCount =
    files.filter(
      (file) =>
        fileType(file) === "document",
    ).length;

  const mediaCount =
    files.filter(
      (file) =>
        fileType(file) === "image",
    ).length;

  const storageUsed =
    files.reduce(
      (total, file) =>
        total +
        Number(file.size_bytes || 0),
      0,
    );

  const ownerName = (file) => {
    if (
      file.uploaded_by === user.id ||
      file.uploaded_by === "current-user"
    ) {
      return user.name;
    }

    return "Campaign team";
  };

  const openFileDetails = (fileId) => {
    setSelectedFileId(fileId);
    setDetailsTab("overview");
    setDetailsExpanded(false);
  };

  const closeFileDetails = () => {
    setSelectedFileId("");
    setDetailsTab("overview");
    setDetailsExpanded(false);
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setTypeFilter("all");
    setSortMode("newest");
    setActiveView("all");
  };

  const refreshFiles = async () => {
    if (demoMode) {
      setToast(
        "Local preview data refreshed.",
      );
      return;
    }

    const refresh =
      filesCommandCenter.loadFiles ||
      filesCommandCenter.refreshFiles;

    if (typeof refresh === "function") {
      await refresh();
      setToast(
        "Documents refreshed.",
      );
    }
  };

  const openSecureFile = async (
    file,
    download = false,
  ) => {
    if (demoMode) {
      setToast(
        download
          ? `${file.file_name} download previewed locally.`
          : `${file.file_name} secure preview opened locally.`,
      );
      return;
    }

    if (
      typeof filesCommandCenter.openFile !==
      "function"
    ) {
      setToast(
        "Secure file access is unavailable.",
      );
      return;
    }

    try {
      await filesCommandCenter.openFile(
        file,
        download,
      );
    } catch {
      setToast(
        "The secure file could not be opened.",
      );
    }
  };

  const acceptUploadFiles = (
    incomingFiles,
  ) => {
    const nextFiles = Array.from(
      incomingFiles || [],
    );

    if (!nextFiles.length) {
      return;
    }

    const oversized = nextFiles.find(
      (file) =>
        file.size >
        MAX_CAMPAIGN_FILE_SIZE,
    );

    if (oversized) {
      setToast(
        `${oversized.name} exceeds the 50 MB file limit.`,
      );
      return;
    }

    setSelectedUploadFiles(nextFiles);
  };

  const closeUpload = () => {
    setUploadOpen(false);
    setSelectedUploadFiles([]);
    setDragActive(false);
  };

  const handleUpload = async () => {
    if (!selectedUploadFiles.length) {
      setToast(
        "Choose at least one file.",
      );
      return;
    }

    const category =
      uploadCategory.trim() ||
      "Campaign Materials";

    if (demoMode) {
      const createdAt =
        new Date().toISOString();

      const newFiles =
        selectedUploadFiles.map(
          (file, index) => ({
            id: `document-demo-upload-${Date.now()}-${index}`,
            file_name: file.name,
            storage_path: `demo/${file.name}`,
            mime_type:
              file.type ||
              "application/octet-stream",
            size_bytes: file.size,
            category,
            uploaded_by:
              "current-user",
            created_at: createdAt,
            description:
              "Locally previewed upload. No data was written to Supabase.",
            version: "New upload",
            linked_records: [],
            activity: [
              `Added locally by ${user.name}`,
            ],
          }),
        );

      setDemoFiles(
        (current) => [
          ...newFiles,
          ...current,
        ],
      );

      setToast(
        `${newFiles.length} local preview file${
          newFiles.length === 1
            ? ""
            : "s"
        } added.`,
      );

      closeUpload();
      return;
    }

    if (
      typeof filesCommandCenter.uploadFiles !==
      "function"
    ) {
      setToast(
        "File upload is unavailable.",
      );
      return;
    }

    try {
      await filesCommandCenter.uploadFiles(
        selectedUploadFiles,
        category,
      );

      setToast(
        `${selectedUploadFiles.length} file${
          selectedUploadFiles.length === 1
            ? ""
            : "s"
        } uploaded securely.`,
      );

      closeUpload();
    } catch {
      setToast(
        "The files could not be uploaded.",
      );
    }
  };

  const activeFilters =
    Boolean(search) ||
    categoryFilter !== "all" ||
    typeFilter !== "all" ||
    activeView !== "all";

  return (
    <CampaignWorkspaceShell activeItem="Documents">
      <main
        className={`${styles.page} ${
          selectedFile
            ? styles.pageWithDetails
            : ""
        }`}
      >
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>
              Campaign resources
            </span>

            <h1>Documents</h1>

            <p>
              Keep campaign plans, creative assets,
              research, compliance files, and shared
              materials organized in one secure workspace.
            </p>

            <div className={styles.previewStatus}>
              <CheckCircle2 size={15} />
              {demoMode
                ? "Local preview data"
                : "Private campaign storage"}
            </div>
          </div>

          <div className={styles.heroActions}>
            <label className={styles.heroSearch}>
              <Search size={20} />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search documents…"
              />
            </label>

            <button
              className={styles.secondaryButton}
              type="button"
              onClick={refreshFiles}
            >
              <RefreshCw size={18} />
              Refresh
            </button>

            <button
              className={styles.primaryButton}
              type="button"
              onClick={() =>
                setUploadOpen(true)
              }
            >
              <UploadCloud size={19} />
              Upload
            </button>
          </div>
        </section>

        {loadError && !demoMode && (
          <section className={styles.errorBanner}>
            <AlertTriangle size={18} />
            <span>{loadError}</span>
          </section>
        )}

        <section className={styles.summaryGrid}>
          <button
            type="button"
            className={`${styles.summaryCard} ${
              activeView === "all"
                ? styles.summaryCardActive
                : ""
            }`}
            onClick={() =>
              setActiveView("all")
            }
          >
            <span
              className={styles.summaryIcon}
              data-tone="blue"
            >
              <FolderKanban size={23} />
            </span>

            <span>
              <small>All documents</small>
              <strong>{files.length}</strong>
              <em>
                {formatBytes(storageUsed)} secured
              </em>
            </span>
          </button>

          <button
            type="button"
            className={`${styles.summaryCard} ${
              activeView === "recent"
                ? styles.summaryCardActive
                : ""
            }`}
            onClick={() =>
              setActiveView("recent")
            }
          >
            <span
              className={styles.summaryIcon}
              data-tone="blue"
            >
              <Clock3 size={23} />
            </span>

            <span>
              <small>Recent uploads</small>
              <strong>{recentCount}</strong>
              <em>Added within seven days</em>
            </span>
          </button>

          <button
            type="button"
            className={`${styles.summaryCard} ${
              typeFilter === "document"
                ? styles.summaryCardActive
                : ""
            }`}
            onClick={() => {
              setActiveView("all");
              setTypeFilter(
                typeFilter === "document"
                  ? "all"
                  : "document",
              );
            }}
          >
            <span
              className={styles.summaryIcon}
              data-tone="amber"
            >
              <FileText size={23} />
            </span>

            <span>
              <small>Working documents</small>
              <strong>{documentCount}</strong>
              <em>Plans, briefs, and records</em>
            </span>
          </button>

          <button
            type="button"
            className={`${styles.summaryCard} ${
              typeFilter === "image"
                ? styles.summaryCardActive
                : ""
            }`}
            onClick={() => {
              setActiveView("all");
              setTypeFilter(
                typeFilter === "image"
                  ? "all"
                  : "image",
              );
            }}
          >
            <span
              className={styles.summaryIcon}
              data-tone="green"
            >
              <FileImage size={23} />
            </span>

            <span>
              <small>Media assets</small>
              <strong>{mediaCount}</strong>
              <em>Approved campaign creative</em>
            </span>
          </button>
        </section>

        <section className={styles.quickCollections}>
          <div className={styles.quickCollectionsHeading}>
            <div>
              <small>Quick access</small>
              <strong>Campaign collections</strong>
            </div>

            {categoryFilter !== "all" && (
              <button
                type="button"
                onClick={() =>
                  setCategoryFilter("all")
                }
              >
                View all
              </button>
            )}
          </div>

          <div className={styles.quickCollectionList}>
            {quickCollections.map(
              ([category, count]) => (
                <button
                  key={category}
                  type="button"
                  className={
                    categoryFilter === category
                      ? styles.quickCollectionActive
                      : ""
                  }
                  onClick={() => {
                    setCategoryFilter(category);
                    setActiveView("all");
                  }}
                >
                  <span>
                    <FolderKanban size={18} />
                  </span>

                  <span>
                    <strong>{category}</strong>
                    <small>
                      {count} file
                      {count === 1 ? "" : "s"}
                    </small>
                  </span>
                </button>
              ),
            )}
          </div>
        </section>

        <section
          className={`${styles.workspaceRow} ${
            detailsExpanded
              ? styles.workspaceRowExpanded
              : ""
          }`}
        >
          <section className={styles.library}>
            <nav className={styles.tabs}>
              {[
                ["all", "All documents"],
                ["mine", "My uploads"],
                ["recent", "Recent"],
                ["attention", "Needs attention"],
              ].map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      activeView === value
                        ? styles.activeTab
                        : ""
                    }
                    onClick={() =>
                      setActiveView(value)
                    }
                  >
                    {label}
                  </button>
                ),
              )}
            </nav>

            <div
              className={`${styles.controls} ${styles.documentsToolbar}`}
            >
              <label>
                <FolderKanban size={17} />

                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(
                      event.target.value,
                    )
                  }
                >
                  <option value="all">
                    All collections
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <FileText size={17} />

                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(
                      event.target.value,
                    )
                  }
                >
                  <option value="all">
                    All file types
                  </option>

                  {Object.entries(
                    TYPE_LABELS,
                  ).map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Sort:</span>

                <select
                  value={sortMode}
                  onChange={(event) =>
                    setSortMode(
                      event.target.value,
                    )
                  }
                >
                  <option value="newest">
                    Newest
                  </option>
                  <option value="oldest">
                    Oldest
                  </option>
                  <option value="name">
                    File name
                  </option>
                  <option value="size">
                    File size
                  </option>
                </select>
              </label>

              <div className={styles.layoutToggle}>
                <button
                  type="button"
                  className={
                    layout === "list"
                      ? styles.layoutActive
                      : ""
                  }
                  onClick={() =>
                    setLayout("list")
                  }
                  aria-label="List view"
                >
                  <List size={18} />
                </button>

                <button
                  type="button"
                  className={
                    layout === "grid"
                      ? styles.layoutActive
                      : ""
                  }
                  onClick={() =>
                    setLayout("grid")
                  }
                  aria-label="Grid view"
                >
                  <Grid2X2 size={17} />
                </button>
              </div>
            </div>

            <div className={styles.resultBar}>
              <span>
                <strong>
                  {filteredFiles.length}
                </strong>{" "}
                document
                {filteredFiles.length === 1
                  ? ""
                  : "s"}
              </span>

              {activeFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>

            {isLoading && !demoMode ? (
              <div className={styles.emptyState}>
                <RefreshCw
                  className={styles.spin}
                  size={30}
                />
                <strong>
                  Loading campaign documents
                </strong>
              </div>
            ) : filteredFiles.length ? (
              layout === "list" ? (
                <div className={styles.table}>
                  <div className={styles.tableHeader}>
                    <span>Document</span>
                    <span>Collection</span>
                    <span>Uploaded by</span>
                    <span>Updated</span>
                    <span>Size</span>
                  </div>

                  {filteredFiles.map(
                    (file) => (
                      <button
                        key={file.id}
                        type="button"
                        className={`${styles.tableRow} ${
                          selectedFileId === file.id
                            ? styles.selectedRow
                            : ""
                        }`}
                        onClick={() =>
                          openFileDetails(
                            file.id,
                          )
                        }
                      >
                        <span
                          className={styles.fileCell}
                        >
                          <span
                            className={styles.fileIcon}
                            data-type={fileType(file)}
                          >
                            <FileTypeIcon
                              file={file}
                              size={21}
                            />
                          </span>

                          <span>
                            <strong>
                              {file.file_name}
                            </strong>

                            <small>
                              {TYPE_LABELS[
                                fileType(file)
                              ]}
                              {file.version
                                ? ` · ${file.version}`
                                : ""}
                            </small>
                          </span>
                        </span>

                        <span>
                          {file.category ||
                            "Uncategorized"}
                        </span>

                        <span>
                          {ownerName(file)}
                        </span>

                        <span>
                          {formatDate(
                            file.created_at,
                          )}
                        </span>

                        <span>
                          {formatBytes(
                            file.size_bytes,
                          )}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              ) : (
                <div className={styles.fileGrid}>
                  {filteredFiles.map(
                    (file) => (
                      <button
                        key={file.id}
                        type="button"
                        className={`${styles.fileCard} ${
                          selectedFileId === file.id
                            ? styles.selectedCard
                            : ""
                        }`}
                        onClick={() =>
                          openFileDetails(
                            file.id,
                          )
                        }
                      >
                        <span
                          className={styles.cardPreview}
                          data-type={fileType(file)}
                        >
                          <FileTypeIcon
                            file={file}
                            size={36}
                          />
                        </span>

                        <strong>
                          {file.file_name}
                        </strong>

                        <small>
                          {file.category ||
                            "Uncategorized"}
                        </small>

                        <footer>
                          <span>
                            {formatDate(
                              file.created_at,
                            )}
                          </span>

                          <span>
                            {formatBytes(
                              file.size_bytes,
                            )}
                          </span>
                        </footer>
                      </button>
                    ),
                  )}
                </div>
              )
            ) : (
              <div className={styles.emptyState}>
                <FolderKanban size={34} />

                <strong>
                  No matching documents
                </strong>

                <p>
                  Adjust the filters or upload a
                  campaign file.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setUploadOpen(true)
                  }
                >
                  <UploadCloud size={17} />
                  Upload document
                </button>
              </div>
            )}

            <footer className={styles.libraryFooter}>
              <span>
                Showing {filteredFiles.length} of{" "}
                {files.length} documents
              </span>

              <span>
                Private campaign document management
              </span>
            </footer>
          </section>

          {selectedFile && (
            <aside
              data-documents-focus="true"
              className={`${styles.detailsPanel} ${
                detailsExpanded
                  ? styles.detailsPanelExpanded
                  : ""
              }`}
            >
              <header className={styles.detailsHeader}>
                <div
                  className={styles.detailsIdentity}
                >
                  <span
                    className={styles.fileIcon}
                    data-type={fileType(
                      selectedFile,
                    )}
                  >
                    <FileTypeIcon
                      file={selectedFile}
                      size={22}
                    />
                  </span>

                  <div>
                    <small>Document details</small>

                    <strong>
                      {selectedFile.file_name}
                    </strong>
                  </div>
                </div>

                <div
                  className={styles.detailsHeaderActions}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setDetailsExpanded(
                        (current) => !current,
                      )
                    }
                    aria-label={
                      detailsExpanded
                        ? "Collapse document details"
                        : "Expand document details"
                    }
                  >
                    {detailsExpanded ? (
                      <Minimize2 size={19} />
                    ) : (
                      <Maximize2 size={19} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={closeFileDetails}
                    aria-label="Close document details"
                  >
                    <X size={20} />
                  </button>
                </div>
              </header>

              <div className={styles.detailsActions}>
                <button
                  type="button"
                  onClick={() =>
                    openSecureFile(
                      selectedFile,
                      false,
                    )
                  }
                >
                  <Eye size={17} />
                  Open secure file
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openSecureFile(
                      selectedFile,
                      true,
                    )
                  }
                >
                  <Download size={17} />
                  Download
                </button>
              </div>

              <nav className={styles.detailsTabs}>
                {[
                  ["overview", "Overview"],
                  ["links", "Links"],
                  ["activity", "Activity"],
                  ["security", "Security"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      detailsTab === value
                        ? styles.detailsTabActive
                        : ""
                    }
                    onClick={() =>
                      setDetailsTab(value)
                    }
                  >
                    {label}
                  </button>
                ))}
              </nav>

              <div className={styles.detailsScroll}>
                <section
                  className={styles.documentSummaryStrip}
                >
                  <div>
                    <ShieldCheck size={17} />

                    <span>
                      <small>Storage</small>
                      <strong>Private</strong>
                    </span>
                  </div>

                  <div>
                    <Clock3 size={17} />

                    <span>
                      <small>Updated</small>
                      <strong>
                        {formatDate(
                          selectedFile.created_at,
                        )}
                      </strong>
                    </span>
                  </div>

                  <div>
                    <FolderKanban size={17} />

                    <span>
                      <small>Collection</small>
                      <strong>
                        {selectedFile.category ||
                          "Uncategorized"}
                      </strong>
                    </span>
                  </div>
                </section>

                {detailsTab === "overview" && (
                  <div
                    className={styles.overviewWorkspace}
                  >
                    <section className={styles.previewPanel}>
                      <span
                        className={styles.largeFileIcon}
                        data-type={fileType(
                          selectedFile,
                        )}
                      >
                        <FileTypeIcon
                          file={selectedFile}
                          size={44}
                        />
                      </span>

                      <strong>
                        {
                          TYPE_LABELS[
                            fileType(
                              selectedFile,
                            )
                          ]
                        }{" "}
                        preview
                      </strong>

                      <p>
                        Open the private campaign file
                        through a short-lived secure link.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          openSecureFile(
                            selectedFile,
                            false,
                          )
                        }
                      >
                        <Eye size={16} />
                        Open secure preview
                      </button>
                    </section>

                    <section className={styles.metadata}>
                      <h3>File information</h3>

                      <dl>
                        <div>
                          <dt>File type</dt>
                          <dd>
                            {
                              TYPE_LABELS[
                                fileType(
                                  selectedFile,
                                )
                              ]
                            }
                          </dd>
                        </div>

                        <div>
                          <dt>Size</dt>
                          <dd>
                            {formatBytes(
                              selectedFile.size_bytes,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>Uploaded by</dt>
                          <dd>
                            {ownerName(selectedFile)}
                          </dd>
                        </div>

                        <div>
                          <dt>Uploaded</dt>
                          <dd>
                            {formatDateTime(
                              selectedFile.created_at,
                            )}
                          </dd>
                        </div>

                        {selectedFile.version && (
                          <div>
                            <dt>Current label</dt>
                            <dd>
                              {selectedFile.version}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </section>

                    <section
                      className={styles.descriptionBlock}
                    >
                      <h3>Description</h3>

                      <p>
                        {selectedFile.description ||
                          "No description has been recorded for this file."}
                      </p>
                    </section>
                  </div>
                )}

                {detailsTab === "links" && (
                  <section
                    className={styles.linkedWorkspace}
                  >
                    <header>
                      <span>
                        <Link2 size={18} />
                      </span>

                      <div>
                        <h3>Linked campaign work</h3>
                        <p>
                          See where this document supports
                          campaign operations.
                        </p>
                      </div>
                    </header>

                    {selectedFile.linked_records?.length ? (
                      <div
                        className={styles.linkedRecordList}
                      >
                        {selectedFile.linked_records.map(
                          (record) => (
                            <article key={record}>
                              <FolderKanban size={17} />

                              <div>
                                <strong>{record}</strong>
                                <small>
                                  Linked campaign record
                                </small>
                              </div>
                            </article>
                          ),
                        )}
                      </div>
                    ) : (
                      <div
                        className={styles.drawerEmptyState}
                      >
                        <Link2 size={27} />
                        <strong>
                          No linked records
                        </strong>
                        <p>
                          This file has not been connected
                          to campaign work yet.
                        </p>
                      </div>
                    )}
                  </section>
                )}

                {detailsTab === "activity" && (
                  <section
                    className={styles.activityWorkspace}
                  >
                    <header>
                      <span>
                        <History size={18} />
                      </span>

                      <div>
                        <h3>Document activity</h3>
                        <p>
                          Review the available history for
                          this campaign file.
                        </p>
                      </div>
                    </header>

                    <div
                      className={styles.activityTimeline}
                    >
                      {(selectedFile.activity || [
                        `Uploaded ${formatDateTime(
                          selectedFile.created_at,
                        )}`,
                      ]).map((entry, index) => (
                        <article key={`${entry}-${index}`}>
                          <span>
                            <Clock3 size={15} />
                          </span>

                          <div>
                            <strong>{entry}</strong>
                            <small>
                              Campaign document activity
                            </small>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {detailsTab === "security" && (
                  <section
                    className={styles.securityWorkspace}
                  >
                    <header>
                      <span>
                        <ShieldCheck size={18} />
                      </span>

                      <div>
                        <h3>Security and access</h3>
                        <p>
                          Campaign files stay private and
                          are opened only when requested.
                        </p>
                      </div>
                    </header>

                    <div className={styles.securityGrid}>
                      <article>
                        <ShieldCheck size={21} />

                        <div>
                          <strong>
                            Private storage
                          </strong>
                          <p>
                            This document is stored inside
                            the campaign workspace rather
                            than through a public file URL.
                          </p>
                        </div>
                      </article>

                      <article>
                        <Link2 size={21} />

                        <div>
                          <strong>
                            Short-lived access
                          </strong>
                          <p>
                            Opening and downloading use a
                            temporary signed link generated
                            for the requested action.
                          </p>
                        </div>
                      </article>

                      <article>
                        <Clock3 size={21} />

                        <div>
                          <strong>
                            Recorded upload
                          </strong>
                          <p>
                            Uploaded by{" "}
                            {ownerName(selectedFile)} on{" "}
                            {formatDateTime(
                              selectedFile.created_at,
                            )}.
                          </p>
                        </div>
                      </article>
                    </div>
                  </section>
                )}
              </div>
            </aside>
          )}
        </section>
      </main>

      {uploadOpen && (
        <div
          data-documents-focus="true"
          className={styles.modalBackdrop}
          role="presentation"
        >
          <section
            className={styles.uploadModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="documents-upload-title"
          >
            <header>
              <div>
                <small>Campaign documents</small>
                <h2 id="documents-upload-title">
                  Upload files
                </h2>
              </div>

              <button
                type="button"
                onClick={closeUpload}
                aria-label="Close upload modal"
              >
                <X size={21} />
              </button>
            </header>

            <div className={styles.uploadModalBody}>
              <button
                className={`${styles.dropZone} ${
                  dragActive
                    ? styles.dropZoneActive
                    : ""
                }`}
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  acceptUploadFiles(
                    event.dataTransfer.files,
                  );
                }}
              >
                <UploadCloud size={34} />

                <strong>
                  Drag files here or choose from your
                  computer
                </strong>

                <span>
                  Multiple files are supported. Maximum
                  size: 50 MB per file.
                </span>
              </button>

              <input
                ref={fileInputRef}
                className={styles.hiddenInput}
                type="file"
                multiple
                onChange={(event) =>
                  acceptUploadFiles(
                    event.target.files,
                  )
                }
              />

              <label className={styles.categoryField}>
                <span>Collection / category</span>

                <input
                  value={uploadCategory}
                  onChange={(event) =>
                    setUploadCategory(
                      event.target.value,
                    )
                  }
                  placeholder="Campaign Materials"
                />
              </label>

              <div className={styles.categorySuggestions}>
                <span>Quick collections</span>

                <div>
                  {[
                    ...new Set([
                      "Campaign Materials",
                      "Creative",
                      "Events",
                      "Field Operations",
                      "Compliance",
                      "Research",
                      ...categories,
                    ]),
                  ]
                    .slice(0, 6)
                    .map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={
                          uploadCategory === category
                            ? styles.categorySuggestionActive
                            : ""
                        }
                        onClick={() =>
                          setUploadCategory(category)
                        }
                      >
                        {category}
                      </button>
                    ))}
                </div>
              </div>

              <section className={styles.selectedUploads}>
                <h3>
                  Selected files
                </h3>

                {selectedUploadFiles.length ? (
                  selectedUploadFiles.map(
                    (file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${index}`}
                      >
                        <FileText size={17} />

                        <span>
                          <strong>
                            {file.name}
                          </strong>

                          <small>
                            {formatBytes(
                              file.size,
                            )}
                          </small>
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedUploadFiles(
                              (current) =>
                                current.filter(
                                  (_, itemIndex) =>
                                    itemIndex !== index,
                                ),
                            )
                          }
                          aria-label={`Remove ${file.name}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ),
                  )
                ) : (
                  <p>
                    No files selected.
                  </p>
                )}
              </section>

              <div className={styles.securityNotice}>
                <ShieldCheck size={18} />

                <span>
                  {demoMode
                    ? "Preview uploads remain in local page state and never reach Supabase."
                    : "Uploads are stored privately and opened through temporary secure links."}
                </span>
              </div>
            </div>

            <footer>
              <button
                type="button"
                onClick={closeUpload}
              >
                Cancel
              </button>

              <button
                className={styles.modalSave}
                type="button"
                onClick={handleUpload}
                disabled={
                  isSaving ||
                  !selectedUploadFiles.length
                }
              >
                <UploadCloud size={17} />
                {isSaving
                  ? "Uploading…"
                  : `Upload ${
                      selectedUploadFiles.length ||
                      ""
                    } file${
                      selectedUploadFiles.length === 1
                        ? ""
                        : "s"
                    }`}
              </button>
            </footer>
          </section>
        </div>
      )}

      {toast && (
        <button
          className={`${styles.toast} ${styles.documentsToast}`}
          type="button"
          onClick={() => setToast("")}
        >
          <CheckCircle2 size={17} />
          {toast}
        </button>
      )}
    </CampaignWorkspaceShell>
  );
}
