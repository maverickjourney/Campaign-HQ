import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const BUCKET_NAME = "campaign-files";
export const MAX_CAMPAIGN_FILE_SIZE = 50 * 1024 * 1024;

function getFilesErrorMessage(error) {
  const message = error?.message || "Campaign files could not be loaded.";

  if (error?.code === "42P01" || message.includes("campaign_files")) {
    return "Files storage has not been activated yet. Run the Files database setup SQL, then refresh this page.";
  }

  if (message.toLowerCase().includes("bucket")) {
    return "The campaign file-storage bucket has not been activated yet. Run the Files database setup SQL, then refresh.";
  }

  return message;
}

function sanitizeFileName(name = "") {
  return (
    name
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "") || "campaign-file"
  );
}

function createStoragePath(workspaceId, fileName) {
  const uniqueId =
    window.crypto?.randomUUID?.() ||
    `${new Date().getTime()}-${Math.random().toString(16).slice(2)}`;

  return `${workspaceId}/${uniqueId}-${sanitizeFileName(fileName)}`;
}

export function useFilesCommandCenter({ workspaceId, userId }) {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadedAtMs, setLoadedAtMs] = useState(0);

  const loadFiles = useCallback(
    async ({ showLoading = false } = {}) => {
      if (!workspaceId) {
        setFiles([]);
        setIsLoading(false);
        return [];
      }

      if (showLoading) setIsLoading(true);
      setError("");

      try {
        const { data, error: filesError } = await supabase
          .from("campaign_files")
          .select(
            "id, workspace_id, file_name, storage_path, mime_type, size_bytes, category, uploaded_by, created_at",
          )
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });

        if (filesError) throw filesError;

        const refreshedAt = new Date();
        setFiles(data || []);
        setLastUpdated(refreshedAt);
        setLoadedAtMs(refreshedAt.getTime());
        return data || [];
      } catch (loadError) {
        setError(getFilesErrorMessage(loadError));
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadFiles({ showLoading: true });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadFiles]);

  const uploadFiles = useCallback(
    async (selectedFiles, category) => {
      const filesToUpload = Array.from(selectedFiles || []);
      if (!filesToUpload.length) return [];

      const oversizedFile = filesToUpload.find(
        (file) => file.size > MAX_CAMPAIGN_FILE_SIZE,
      );

      if (oversizedFile) {
        const sizeError = new Error(
          `${oversizedFile.name} is larger than the 50 MB campaign file limit.`,
        );
        setError(sizeError.message);
        throw sizeError;
      }

      if (!workspaceId || !userId) {
        const sessionError = new Error(
          "The active campaign workspace or user session is missing.",
        );
        setError(sessionError.message);
        throw sessionError;
      }

      setIsSaving(true);
      setError("");
      const uploadedFiles = [];

      try {
        for (const file of filesToUpload) {
          const storagePath = createStoragePath(workspaceId, file.name);
          const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || "application/octet-stream",
            });

          if (uploadError) throw uploadError;

          const { data: metadata, error: metadataError } = await supabase
            .from("campaign_files")
            .insert({
              workspace_id: workspaceId,
              file_name: file.name,
              storage_path: storagePath,
              mime_type: file.type || "application/octet-stream",
              size_bytes: file.size,
              category: category || "Other",
              uploaded_by: userId,
            })
            .select()
            .single();

          if (metadataError) {
            await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
            throw metadataError;
          }

          uploadedFiles.push(metadata);
        }

        await loadFiles();
        return uploadedFiles;
      } catch (uploadError) {
        setError(getFilesErrorMessage(uploadError));
        throw uploadError;
      } finally {
        setIsSaving(false);
      }
    },
    [loadFiles, userId, workspaceId],
  );

  const openFile = useCallback(async (file, download = false) => {
    setError("");

    try {
      const options = download ? { download: file.file_name } : undefined;
      const { data, error: signedUrlError } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(file.storage_path, 90, options);

      if (signedUrlError) throw signedUrlError;

      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      if (download) link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return data.signedUrl;
    } catch (openError) {
      setError(getFilesErrorMessage(openError));
      return null;
    }
  }, []);

  return {
    files,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    loadedAtMs,
    refresh: () => loadFiles({ showLoading: true }),
    uploadFiles,
    openFile,
  };
}
