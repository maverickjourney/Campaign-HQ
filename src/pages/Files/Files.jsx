import { useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  HardDrive,
  Layers3,
  Menu,
  RefreshCw,
  Search,
  UploadCloud,
} from "lucide-react";
import { CampaignSidebar } from "../../components/CampaignSidebar/CampaignSidebar";
import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";
import { CampaignDateTime } from "../../components/CampaignDateTime/CampaignDateTime";
import {
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";
import { useFilesCommandCenter } from "../../hooks/useFilesCommandCenter";
import shellStyles from "../Tasks/Tasks.module.css";
import styles from "./Files.module.css";

const FILE_CATEGORIES = [
  "Campaign Materials",
  "Brand & Design",
  "Events",
  "Field",
  "Volunteers",
  "Finance",
  "Compliance",
  "Research",
  "Other",
];

function formatFileSize(value = 0) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatFileDate(value) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getFileExtension(fileName = "") {
  const parts = fileName.split(".");
  return parts.length < 2 ? "FILE" : parts.pop()?.toUpperCase() || "FILE";
}

function getFileIcon(file) {
  const mimeType = file.mime_type || "";
  const extension = getFileExtension(file.file_name);

  if (mimeType.startsWith("image/")) return FileImage;
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    ["CSV", "XLS", "XLSX"].includes(extension)
  ) {
    return FileSpreadsheet;
  }
  if (
    mimeType.includes("zip") ||
    ["ZIP", "RAR", "7Z"].includes(extension)
  ) {
    return FileArchive;
  }
  return FileText;
}

function formatUpdatedTime(value) {
  if (!value) return "Waiting for sync";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default function Files() {
  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();
  const roleLabel = getRoleLabel();
  const leadershipAccess = /candidate|consultant|manager|owner/i.test(roleLabel);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [uploadCategory, setUploadCategory] = useState("Campaign Materials");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const {
    files,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    loadedAtMs,
    refresh,
    uploadFiles,
    openFile,
  } = useFilesCommandCenter({ workspaceId: workspace.id, userId: user.id });

  const filteredFiles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return files.filter((file) => {
      const fileName = String(file.file_name || "").toLowerCase();
      const category = String(file.category || "");
      const matchesSearch =
        !normalizedSearch ||
        fileName.includes(normalizedSearch) ||
        category.toLowerCase().includes(normalizedSearch);
      const matchesCategory =
        categoryFilter === "All" || category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, files, search]);

  const totalStorage = files.reduce(
    (total, file) => total + Number(file.size_bytes || 0),
    0,
  );
  const categoriesInUse = new Set(files.map((file) => file.category)).size;
  const recentCutoff = loadedAtMs
    ? loadedAtMs - 7 * 24 * 60 * 60 * 1000
    : null;
  const recentFiles =
    recentCutoff === null
      ? 0
      : files.filter(
          (file) => new Date(file.created_at).getTime() >= recentCutoff,
        ).length;

  const handleUpload = async (selectedFiles) => {
    try {
      await uploadFiles(selectedFiles, uploadCategory);
    } catch {
      // Detailed upload errors are displayed by the hook.
    }
  };

  const handleInputChange = async (event) => {
    await handleUpload(event.target.files);
    event.target.value = "";
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragging(false);
    await handleUpload(event.dataTransfer.files);
  };

  return (
    <div className={styles.app}>
      <CampaignSidebar
        activePage="Files"
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        styles={shellStyles}
        accessDescription="Organize campaign materials, documents and shared creative assets."
        showLeadership={leadershipAccess}
      />

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.menuButton}
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <div>
              <span className={styles.breadcrumb}>
                Campaign HQ <ChevronRight size={13} /> Files
              </span>
              <strong>Campaign file library</strong>
            </div>
          </div>

          <div className={styles.topbarActions}>
            <CampaignDateTime />

            <CampaignSearch />

            <ActivityCenter />
            <div className={styles.syncStatus}>
              <span />
              {isLoading
                ? "Synchronizing files"
                : lastUpdated
                  ? `Updated ${formatUpdatedTime(
                      lastUpdated,
                    )}`
                  : "Waiting for sync"}
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.pageHeader}>
            <div>
              <span className={styles.eyebrow}>Campaign assets</span>
              <h1>Files</h1>
              <p>
                Keep campaign documents, creative materials and operational
                resources organized in one secure workspace.
              </p>
            </div>
            <button
              className={styles.uploadButton}
              type="button"
              disabled={isSaving}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={18} />
              {isSaving ? "Uploading…" : "Upload files"}
            </button>
          </section>

          {error && (
            <section className={styles.errorBanner} role="alert">
              <FileText size={20} />
              <div>
                <strong>Files need attention</strong>
                <p>{error}</p>
              </div>
              <button type="button" onClick={refresh}>Retry</button>
            </section>
          )}

          <section className={styles.summaryGrid} aria-label="Files summary">
            <article>
              <div><FolderKanban size={21} /></div>
              <span>Total files</span>
              <strong>{isLoading ? "—" : files.length}</strong>
              <p>Shared campaign assets</p>
            </article>
            <article>
              <div><HardDrive size={21} /></div>
              <span>Storage used</span>
              <strong>{isLoading ? "—" : formatFileSize(totalStorage)}</strong>
              <p>Across this workspace</p>
            </article>
            <article>
              <div><Clock3 size={21} /></div>
              <span>Recent uploads</span>
              <strong>{isLoading ? "—" : recentFiles}</strong>
              <p>Added in the last 7 days</p>
            </article>
            <article>
              <div><Layers3 size={21} /></div>
              <span>Categories</span>
              <strong>{isLoading ? "—" : categoriesInUse}</strong>
              <p>Active file collections</p>
            </article>
          </section>

          <section className={styles.uploadPanel}>
            <div
              className={`${styles.dropZone} ${
                isDragging ? styles.dropZoneActive : ""
              }`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
            >
              <div className={styles.dropIcon}><UploadCloud size={27} /></div>
              <div>
                <strong>Drop campaign files here</strong>
                <p>Or choose files from your computer. Up to 50 MB per file.</p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => fileInputRef.current?.click()}
              >
                Browse files
              </button>
            </div>

            <label className={styles.categorySelect}>
              <span>Upload to category</span>
              <select
                value={uploadCategory}
                onChange={(event) => setUploadCategory(event.target.value)}
              >
                {FILE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>

            <input
              ref={fileInputRef}
              className={styles.fileInput}
              type="file"
              multiple
              onChange={handleInputChange}
            />
          </section>

          <section className={styles.libraryPanel}>
            <header className={styles.libraryHeader}>
              <div>
                <span>File library</span>
                <h2>Campaign materials</h2>
              </div>
              <button
                className={styles.refreshButton}
                type="button"
                disabled={isLoading}
                onClick={refresh}
                title="Refresh files"
              >
                <RefreshCw
                  size={17}
                  className={isLoading ? styles.spinning : ""}
                />
              </button>
            </header>

            <div className={styles.controls}>
              <label className={styles.searchWrap}>
                <Search size={18} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search files or categories"
                />
              </label>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter files by category"
              >
                <option value="All">All categories</option>
                {FILE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <span className={styles.resultCount}>
                {filteredFiles.length} {filteredFiles.length === 1 ? "file" : "files"}
              </span>
            </div>

            {isLoading && (
              <div className={styles.loadingState}>
                <RefreshCw size={23} className={styles.spinning} />
                <strong>Loading campaign files…</strong>
              </div>
            )}

            {!isLoading && filteredFiles.length > 0 && (
              <div className={styles.fileList}>
                <div className={styles.fileListHeader}>
                  <span>File</span><span>Category</span><span>Uploaded</span>
                  <span>Size</span><span>Actions</span>
                </div>
                {filteredFiles.map((file) => {
                  const FileIcon = getFileIcon(file);
                  const uploadedBy =
                    file.uploaded_by === user.id ? user.name : "Campaign team";

                  return (
                    <article className={styles.fileRow} key={file.id}>
                      <div className={styles.fileIdentity}>
                        <div className={styles.fileIcon}><FileIcon size={21} /></div>
                        <div>
                          <strong title={file.file_name}>{file.file_name}</strong>
                          <span>{getFileExtension(file.file_name)}</span>
                        </div>
                      </div>
                      <span className={styles.categoryBadge}>{file.category}</span>
                      <div className={styles.uploadMeta}>
                        <strong>{uploadedBy}</strong>
                        <span>{formatFileDate(file.created_at)}</span>
                      </div>
                      <span className={styles.fileSize}>
                        {formatFileSize(file.size_bytes)}
                      </span>
                      <div className={styles.fileActions}>
                        <button
                          type="button"
                          onClick={() => openFile(file, false)}
                          title="Open file"
                          aria-label={`Open ${file.file_name}`}
                        >
                          <ExternalLink size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openFile(file, true)}
                          title="Download file"
                          aria-label={`Download ${file.file_name}`}
                        >
                          <Download size={17} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {!isLoading && filteredFiles.length === 0 && (
              <div className={styles.emptyState}>
                <div><FolderKanban size={28} /></div>
                <h3>{files.length ? "No matching files" : "No campaign files yet"}</h3>
                <p>
                  {files.length
                    ? "Adjust the search or category filter."
                    : "Upload the first campaign document, design or operational resource."}
                </p>
                {!files.length && (
                  <button type="button" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud size={17} /> Upload a file
                  </button>
                )}
              </div>
            )}
          </section>

          <footer className={styles.footer}>
            <span>Campaign HQ Files</span>
            <span>Secure workspace storage</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
