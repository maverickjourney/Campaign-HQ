import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const EMPTY = { contacts: [] };

function contactError(error) {
  const message = error?.message || "Campaign contacts could not be loaded.";
  if (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.toLowerCase().includes("campaign_contacts")
  ) {
    return "The Contacts database setup has not been activated yet. Run the Contacts SQL, then refresh.";
  }
  if (
    error?.code === "42501" ||
    message.toLowerCase().includes("permission")
  ) {
    return "Your current campaign role is not authorized to change contacts.";
  }
  return message;
}

export function useContactsCommandCenter({ workspaceId, userId }) {
  const [state, setState] = useState(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const refreshTimerRef = useRef(null);

  const loadContacts = useCallback(
    async ({ showLoading = false } = {}) => {
      if (!workspaceId || !userId) {
        setState(EMPTY);
        setError("The active campaign workspace or user session is missing.");
        setIsLoading(false);
        return [];
      }

      if (showLoading) setIsLoading(true);

      try {
        const { data, error: loadError } = await supabase
          .from("campaign_contacts")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false });

        if (loadError) throw loadError;

        setState({ contacts: data || [] });
        setError("");
        setLastUpdated(new Date());
        return data || [];
      } catch (loadError) {
        setError(contactError(loadError));
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [userId, workspaceId],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadContacts({ showLoading: true });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadContacts]);

  useEffect(() => {
    if (!workspaceId || !userId) return undefined;

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        loadContacts();
      }, 250);
    };

    const channel = supabase
      .channel(`campaign-contacts-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_contacts",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [loadContacts, userId, workspaceId]);

  const saveContact = useCallback(
    async (record) => {
      const fullName = String(record.fullName || "").trim();
      if (!fullName) throw new Error("Enter the contact’s full name.");

      const current = state.contacts.find((item) => item.id === record.id);
      const now = new Date().toISOString();

      const payload = {
        workspace_id: workspaceId,
        full_name: fullName,
        email: String(record.email || "").trim() || null,
        phone: String(record.phone || "").trim() || null,
        organization: String(record.organization || "").trim() || null,
        contact_type: record.contactType || "supporter",
        assigned_to: record.assignedTo || null,
        precinct: String(record.precinct || "").trim() || null,
        source: String(record.source || "").trim() || null,
        status: record.status || "active",
        notes: String(record.notes || "").trim() || null,
        tags: Array.isArray(record.tags) ? record.tags : [],
        last_contact_at: record.lastContactAt || null,
        next_follow_up_at: record.nextFollowUpAt || null,
        email_consent: Boolean(record.emailConsent),
        email_consent_at: record.emailConsent
          ? current?.email_consent_at || now
          : null,
        sms_consent: Boolean(record.smsConsent),
        sms_consent_at: record.smsConsent
          ? current?.sms_consent_at || now
          : null,
        consent_source: String(record.consentSource || "").trim() || null,
        updated_by: userId,
      };

      setIsSaving(true);
      setError("");

      try {
        const result = record.id
          ? await supabase
              .from("campaign_contacts")
              .update(payload)
              .eq("id", record.id)
              .eq("workspace_id", workspaceId)
              .select()
              .single()
          : await supabase
              .from("campaign_contacts")
              .insert({ ...payload, created_by: userId })
              .select()
              .single();

        if (result.error) throw result.error;
        await loadContacts();
        return result.data;
      } catch (saveError) {
        const message = contactError(saveError);
        setError(message);
        throw new Error(message, { cause: saveError });
      } finally {
        setIsSaving(false);
      }
    },
    [loadContacts, state.contacts, userId, workspaceId],
  );

  const importContacts = useCallback(
    async (records) => {
      if (!records?.length) return [];
      setIsSaving(true);
      setError("");
      const imported = [];

      try {
        for (let index = 0; index < records.length; index += 250) {
          const chunk = records.slice(index, index + 250);
          const { data, error: importError } = await supabase
            .from("campaign_contacts")
            .insert(
              chunk.map((record) => ({
                ...record,
                workspace_id: workspaceId,
                created_by: userId,
                updated_by: userId,
              })),
            )
            .select();

          if (importError) throw importError;
          imported.push(...(data || []));
        }

        await loadContacts();
        return imported;
      } catch (importError) {
        const message = contactError(importError);
        setError(message);
        throw new Error(message, { cause: importError });
      } finally {
        setIsSaving(false);
      }
    },
    [loadContacts, userId, workspaceId],
  );

  const archiveContact = useCallback(
    async (contactId) => {
      setIsSaving(true);
      setError("");

      try {
        const { data, error: archiveError } = await supabase
          .from("campaign_contacts")
          .update({ status: "inactive", updated_by: userId })
          .eq("id", contactId)
          .eq("workspace_id", workspaceId)
          .select()
          .single();

        if (archiveError) throw archiveError;
        await loadContacts();
        return data;
      } catch (archiveError) {
        const message = contactError(archiveError);
        setError(message);
        throw new Error(message, { cause: archiveError });
      } finally {
        setIsSaving(false);
      }
    },
    [loadContacts, userId, workspaceId],
  );

  return {
    contacts: state.contacts,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh: () => loadContacts({ showLoading: true }),
    saveContact,
    importContacts,
    archiveContact,
  };
}
