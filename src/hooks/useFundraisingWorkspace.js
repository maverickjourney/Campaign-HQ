import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


function fundraisingKey(value) {
  return String(
    value ||
    "",
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}


function money(value) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  ).format(
    Number(value || 0),
  );
}


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


function contributionTypeValue(value) {
  const normalized =
    String(
      value ||
      "",
    )
      .trim()
      .toLowerCase();

  if (
    normalized ===
    "in person"
  ) {
    return "in_person";
  }

  if (
    [
      "online",
      "recurring",
      "mobile",
      "check",
      "cash",
      "other",
    ].includes(
      normalized,
    )
  ) {
    return normalized;
  }

  return "other";
}


function formatDateTime(
  value,
  timezone,
) {
  if (!value) {
    return {
      date: "—",
      time: "—",
    };
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return {
      date: "—",
      time: "—",
    };
  }

  return {
    date:
      new Intl.DateTimeFormat(
        "en-US",
        {
          month: "short",
          day: "numeric",
          timeZone:
            timezone ||
            "America/New_York",
        },
      ).format(date),

    time:
      new Intl.DateTimeFormat(
        "en-US",
        {
          hour: "numeric",
          minute: "2-digit",
          timeZone:
            timezone ||
            "America/New_York",
        },
      ).format(date),
  };
}


function formatDateOnly(value) {
  if (!value) {
    return "No due date";
  }

  const parts =
    String(value)
      .split("-")
      .map(Number);

  if (
    parts.length !== 3 ||
    parts.some(
      (part) =>
        !Number.isFinite(part),
    )
  ) {
    return value;
  }

  const [
    year,
    month,
    day,
  ] = parts;

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    ),
  );
}


function initialsFor(name) {
  return String(
    name ||
    "",
  )
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part
          .charAt(0)
          .toUpperCase(),
    )
    .join("") ||
    "DN";
}


function segmentFromTags(tags) {
  const rows =
    Array.isArray(tags)
      ? tags
      : [];

  const match =
    rows.find(
      (tag) =>
        String(tag)
          .toLowerCase()
          .startsWith(
            "fundraising-segment:",
          ),
    );

  if (!match) {
    return "";
  }

  return titleCase(
    String(match)
      .split(":")
      .slice(1)
      .join(":"),
  );
}


function donorMapKey({
  contactId,
  name,
}) {
  if (contactId) {
    return `contact:${contactId}`;
  }

  return `name:${fundraisingKey(name)}`;
}


function normalizeContribution({
  row,
  goalNameById,
  timezone,
}) {
  const formatted =
    formatDateTime(
      row.received_at,
      timezone,
    );

  return {
    id: row.id,

    donor:
      row.donor_name_snapshot ||
      "Unnamed donor",

    donorContactId:
      row.donor_contact_id ||
      "",

    initials:
      initialsFor(
        row.donor_name_snapshot,
      ),

    amount:
      Number(
        row.amount_cents ||
        0,
      ) /
      100,

    date:
      formatted.date,

    time:
      formatted.time,

    type:
      titleCase(
        row.contribution_type,
      ),

    campaign:
      row.goal_id
        ? (
            goalNameById.get(
              row.goal_id,
            ) ||
            "Fundraising goal"
          )
        : "Unassigned",

    status:
      titleCase(
        row.status,
      ),

    receiptStatus:
      row.receipt_status ||
      "pending",

    isRecurring:
      Boolean(
        row.is_recurring,
      ) ||
      row.contribution_type ===
        "recurring",

    receivedAt:
      row.received_at,
  };
}


function buildDonors({
  contacts,
  contributions,
  pledges,
  timezone,
}) {
  const records =
    new Map();

  const ensureRecord = ({
    contactId = "",
    name = "",
    email = "",
    phone = "",
    segment = "",
  }) => {
    const safeName =
      String(
        name ||
        "Unnamed donor",
      ).trim() ||
      "Unnamed donor";

    const key =
      donorMapKey({
        contactId,
        name: safeName,
      });

    if (
      !records.has(key)
    ) {
      records.set(
        key,
        {
          id:
            contactId ||
            fundraisingKey(
              safeName,
            ),

          contactId,

          name:
            safeName,

          initials:
            initialsFor(
              safeName,
            ),

          email:
            email ||
            "",

          phone:
            phone ||
            "",

          segment:
            segment ||
            "",

          lifetimeAmount:
            0,

          giftCount:
            0,

          lastAt:
            "",

          hasRecurring:
            false,
        },
      );
    }

    const record =
      records.get(key);

    if (
      contactId &&
      !record.contactId
    ) {
      record.contactId =
        contactId;
      record.id =
        contactId;
    }

    if (
      email &&
      !record.email
    ) {
      record.email =
        email;
    }

    if (
      phone &&
      !record.phone
    ) {
      record.phone =
        phone;
    }

    if (
      segment &&
      !record.segment
    ) {
      record.segment =
        segment;
    }

    return record;
  };


  for (
    const contact of contacts
  ) {
    ensureRecord({
      contactId:
        contact.id,

      name:
        contact.full_name,

      email:
        contact.email,

      phone:
        contact.phone,

      segment:
        segmentFromTags(
          contact.tags,
        ) ||
        "Active",
    });
  }


  for (
    const contribution of contributions
  ) {
    const record =
      ensureRecord({
        contactId:
          contribution
            .donor_contact_id,

        name:
          contribution
            .donor_name_snapshot,

        email:
          contribution
            .donor_email_snapshot,

        phone:
          contribution
            .donor_phone_snapshot,
      });

    if (
      contribution.status ===
      "completed"
    ) {
      record.lifetimeAmount +=
        Number(
          contribution
            .amount_cents ||
          0,
        ) /
        100;

      record.giftCount +=
        1;

      const receivedAt =
        contribution
          .received_at ||
        "";

      if (
        receivedAt &&
        (
          !record.lastAt ||
          receivedAt >
            record.lastAt
        )
      ) {
        record.lastAt =
          receivedAt;
      }
    }

    if (
      contribution
        .is_recurring ||
      contribution
        .contribution_type ===
        "recurring"
    ) {
      record.hasRecurring =
        true;
    }
  }


  for (
    const pledge of pledges
  ) {
    ensureRecord({
      contactId:
        pledge
          .donor_contact_id,

      name:
        pledge
          .donor_name_snapshot,

      email:
        pledge
          .donor_email_snapshot,

      phone:
        pledge
          .donor_phone_snapshot,
    });
  }


  return Array.from(
    records.values(),
  )
    .map(
      (record) => {
        const formatted =
          record.lastAt
            ? formatDateTime(
                record.lastAt,
                timezone,
              )
            : null;

        return {
          id:
            record.id,

          contactId:
            record.contactId,

          name:
            record.name,

          initials:
            record.initials,

          lifetime:
            money(
              record
                .lifetimeAmount,
            ),

          gifts:
            String(
              record
                .giftCount,
            ),

          last:
            formatted
              ? formatted.date
              : "No gifts yet",

          segment:
            record.segment ||
            (
              record.hasRecurring
                ? "Recurring"
                : "Active"
            ),

          email:
            record.email,

          phone:
            record.phone,

          hasRecurring:
            record.hasRecurring,
        };
      },
    )
    .sort(
      (left, right) => {
        if (
          left.last ===
          "No gifts yet" &&
          right.last !==
          "No gifts yet"
        ) {
          return 1;
        }

        if (
          right.last ===
          "No gifts yet" &&
          left.last !==
          "No gifts yet"
        ) {
          return -1;
        }

        return left.name
          .localeCompare(
            right.name,
          );
      },
    );
}


const EMPTY_METRICS = {
  totalRaised: 0,
  fundraisingGoal: 0,
  recurringDonorCount: 0,
  recurringRaised: 0,
  pendingReceipts: 0,
  sentReceipts: 0,
  openPledges: 0,
  incompleteDonors: 0,
  nextPledgeDue: "",
};


export function useFundraisingWorkspace({
  enabled,
  workspaceId,
  timezone,
  currentUserId,
  currentUserName,
}) {
  const [
    contributions,
    setContributions,
  ] = useState([]);

  const [
    donors,
    setDonors,
  ] = useState([]);

  const [
    goals,
    setGoals,
  ] = useState([]);

  const [
    pledges,
    setPledges,
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
  ] = useState(
    Boolean(enabled),
  );

  const [
    error,
    setError,
  ] = useState("");


  const refresh =
    useCallback(
      async () => {
        if (
          !enabled
        ) {
          setLoading(false);
          setError("");

          return true;
        }

        if (
          !workspaceId
        ) {
          setLoading(false);

          setError(
            "No active campaign workspace is available.",
          );

          return false;
        }

        setLoading(true);
        setError("");

        try {
          const [
            goalsResult,
            contributionsResult,
            pledgesResult,
            contactsResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "campaign_fundraising_goals",
                )
                .select(
                  [
                    "id",
                    "name",
                    "goal_amount_cents",
                    "currency",
                    "status",
                    "sort_order",
                    "starts_on",
                    "ends_on",
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
                  "sort_order",
                  {
                    ascending:
                      true,
                  },
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
                  "campaign_contributions",
                )
                .select(
                  [
                    "id",
                    "workspace_id",
                    "donor_contact_id",
                    "donor_name_snapshot",
                    "donor_email_snapshot",
                    "donor_phone_snapshot",
                    "goal_id",
                    "amount_cents",
                    "currency",
                    "received_at",
                    "contribution_type",
                    "status",
                    "is_recurring",
                    "source",
                    "receipt_status",
                    "receipt_sent_at",
                    "created_at",
                    "updated_at",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .order(
                  "received_at",
                  {
                    ascending:
                      false,
                  },
                )
                .limit(1000),

              supabase
                .from(
                  "campaign_pledges",
                )
                .select(
                  [
                    "id",
                    "workspace_id",
                    "donor_contact_id",
                    "donor_name_snapshot",
                    "donor_email_snapshot",
                    "donor_phone_snapshot",
                    "goal_id",
                    "amount_cents",
                    "currency",
                    "due_date",
                    "owner_user_id",
                    "status",
                    "fulfilled_contribution_id",
                    "fulfilled_at",
                    "source",
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
                  "cancelled",
                )
                .order(
                  "due_date",
                  {
                    ascending:
                      true,
                    nullsFirst:
                      false,
                  },
                )
                .limit(500),

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
                    "contact_type",
                    "status",
                    "tags",
                    "created_at",
                    "updated_at",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .eq(
                  "contact_type",
                  "donor",
                )
                .order(
                  "updated_at",
                  {
                    ascending:
                      false,
                  },
                ),
            ]);

          if (
            goalsResult.error
          ) {
            throw goalsResult.error;
          }

          if (
            contributionsResult.error
          ) {
            throw contributionsResult.error;
          }

          if (
            pledgesResult.error
          ) {
            throw pledgesResult.error;
          }

          const goalRows =
            Array.isArray(
              goalsResult.data,
            )
              ? goalsResult.data
              : [];

          const contributionRows =
            Array.isArray(
              contributionsResult.data,
            )
              ? contributionsResult.data
              : [];

          const pledgeRows =
            Array.isArray(
              pledgesResult.data,
            )
              ? pledgesResult.data
              : [];

          /*
           * Finance access must not depend on broad Contacts
           * access. If contact RLS hides the donor directory,
           * donor relationships are still reconstructed from
           * contribution and pledge snapshots.
           */
          const contactRows =
            contactsResult.error
              ? []
              : (
                  Array.isArray(
                    contactsResult.data,
                  )
                    ? contactsResult.data
                    : []
                );

          const goalNameById =
            new Map(
              goalRows.map(
                (goal) => [
                  goal.id,
                  goal.name,
                ],
              ),
            );

          const raisedByGoal =
            new Map();

          let totalRaised =
            0;

          let recurringRaised =
            0;

          const recurringDonorKeys =
            new Set();

          let pendingReceipts =
            0;

          let sentReceipts =
            0;


          for (
            const contribution of contributionRows
          ) {
            if (
              contribution.status !==
              "completed"
            ) {
              continue;
            }

            const amount =
              Number(
                contribution
                  .amount_cents ||
                0,
              ) /
              100;

            totalRaised +=
              amount;

            if (
              contribution.goal_id
            ) {
              raisedByGoal.set(
                contribution.goal_id,
                (
                  raisedByGoal.get(
                    contribution.goal_id,
                  ) ||
                  0
                ) +
                amount,
              );
            }

            const isRecurring =
              contribution
                .is_recurring ||
              contribution
                .contribution_type ===
                "recurring";

            if (
              isRecurring
            ) {
              recurringRaised +=
                amount;

              recurringDonorKeys.add(
                donorMapKey({
                  contactId:
                    contribution
                      .donor_contact_id,

                  name:
                    contribution
                      .donor_name_snapshot,
                }),
              );
            }

            if (
              contribution
                .receipt_status ===
              "pending"
            ) {
              pendingReceipts +=
                1;
            }

            if (
              contribution
                .receipt_status ===
              "sent"
            ) {
              sentReceipts +=
                1;
            }
          }


          const nextGoals =
            goalRows.map(
              (goal) => {
                const goalAmount =
                  Number(
                    goal
                      .goal_amount_cents ||
                    0,
                  ) /
                  100;

                const raisedAmount =
                  raisedByGoal.get(
                    goal.id,
                  ) ||
                  0;

                const progress =
                  goalAmount >
                    0
                    ? Math.min(
                        100,
                        Math.round(
                          (
                            raisedAmount /
                            goalAmount
                          ) *
                          100,
                        ),
                      )
                    : 0;

                return {
                  id:
                    goal.id,

                  name:
                    goal.name,

                  raised:
                    money(
                      raisedAmount,
                    ),

                  goal:
                    money(
                      goalAmount,
                    ),

                  raisedAmount,

                  goalAmount,

                  progress,

                  status:
                    titleCase(
                      goal.status,
                    ),
                };
              },
            );


          const nextContributions =
            contributionRows.map(
              (row) =>
                normalizeContribution({
                  row,
                  goalNameById,
                  timezone,
                }),
            );


          const nextDonors =
            buildDonors({
              contacts:
                contactRows,

              contributions:
                contributionRows,

              pledges:
                pledgeRows,

              timezone,
            });


          const nextPledges =
            pledgeRows.map(
              (pledge) => ({
                id:
                  pledge.id,

                donor:
                  pledge
                    .donor_name_snapshot ||
                  "Unnamed donor",

                donorContactId:
                  pledge
                    .donor_contact_id ||
                  "",

                amount:
                  money(
                    Number(
                      pledge
                        .amount_cents ||
                      0,
                    ) /
                    100,
                  ),

                due:
                  formatDateOnly(
                    pledge
                      .due_date,
                  ),

                dueRaw:
                  pledge
                    .due_date ||
                  "",

                owner:
                  pledge
                    .owner_user_id ===
                    currentUserId
                    ? (
                        currentUserName ||
                        "You"
                      )
                    : pledge
                        .owner_user_id
                      ? "Campaign member"
                      : "Campaign team",

                status:
                  titleCase(
                    pledge.status,
                  ),

                statusKey:
                  pledge.status,
              }),
            );


          const fundraisingGoal =
            nextGoals
              .filter(
                (goal) =>
                  goal.status ===
                  "Active",
              )
              .reduce(
                (
                  sum,
                  goal,
                ) =>
                  sum +
                  goal.goalAmount,
                0,
              );


          const openPledges =
            pledgeRows.filter(
              (pledge) =>
                [
                  "open",
                  "follow_up",
                ].includes(
                  pledge.status,
                ),
            );


          const incompleteDonors =
            nextDonors.filter(
              (donor) =>
                !donor.email ||
                !donor.phone,
            ).length;


          setGoals(
            nextGoals,
          );

          setContributions(
            nextContributions,
          );

          setDonors(
            nextDonors,
          );

          setPledges(
            nextPledges,
          );

          setMetrics({
            totalRaised,

            fundraisingGoal,

            recurringDonorCount:
              recurringDonorKeys
                .size,

            recurringRaised,

            pendingReceipts,

            sentReceipts,

            openPledges:
              openPledges
                .length,

            incompleteDonors,

            nextPledgeDue:
              openPledges[0]
                ?.due_date
                ? formatDateOnly(
                    openPledges[0]
                      .due_date,
                  )
                : "",
          });

          setLoading(false);

          return true;
        } catch (
          loadError
        ) {
          console.error(
            "[Fundraising] live workspace load failed",
            loadError,
          );

          setError(
            loadError?.message ||
            "Unable to load the live fundraising workspace.",
          );

          setLoading(false);

          return false;
        }
      },
      [
        enabled,
        workspaceId,
        timezone,
        currentUserId,
        currentUserName,
      ],
    );


  useEffect(
    () => {
      void refresh();
    },
    [
      refresh,
    ],
  );


  const addDonor =
    useCallback(
      async ({
        name,
        email,
        phone,
        segment,
      }) => {
        if (
          !workspaceId
        ) {
          throw new Error(
            "No campaign workspace is selected.",
          );
        }

        let actorId =
          currentUserId ||
          "";

        if (
          !actorId
        ) {
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

        if (
          !actorId
        ) {
          throw new Error(
            "Your campaign session could not be verified.",
          );
        }

        const cleanName =
          String(
            name ||
            "",
          ).trim();

        if (
          !cleanName
        ) {
          throw new Error(
            "Donor name is required.",
          );
        }

        const segmentKey =
          fundraisingKey(
            segment ||
            "active",
          ) ||
          "active";

        const {
          data,
          error:
            insertError,
        } =
          await supabase
            .from(
              "campaign_contacts",
            )
            .insert({
              workspace_id:
                workspaceId,

              full_name:
                cleanName,

              email:
                String(
                  email ||
                  "",
                ).trim() ||
                null,

              phone:
                String(
                  phone ||
                  "",
                ).trim() ||
                null,

              contact_type:
                "donor",

              source:
                "campaign_seat_fundraising",

              status:
                "active",

              tags: [
                "fundraising",
                `fundraising-segment:${segmentKey}`,
              ],

              created_by:
                actorId,

              updated_by:
                actorId,
            })
            .select(
              [
                "id",
                "full_name",
                "email",
                "phone",
                "tags",
              ].join(","),
            )
            .single();

        if (
          insertError
        ) {
          throw insertError;
        }

        await refresh();

        return {
          id:
            data.id,

          contactId:
            data.id,

          name:
            data.full_name,

          email:
            data.email ||
            "",

          phone:
            data.phone ||
            "",

          segment:
            segment ||
            "Active",
        };
      },
      [
        workspaceId,
        currentUserId,
        refresh,
      ],
    );


  const recordContribution =
    useCallback(
      async ({
        donorName,
        amount,
        type,
        goalId,
      }) => {
        if (
          !workspaceId
        ) {
          throw new Error(
            "No campaign workspace is selected.",
          );
        }

        const cleanDonorName =
          String(
            donorName ||
            "",
          ).trim();

        const numericAmount =
          Number(amount);

        if (
          !cleanDonorName ||
          !Number.isFinite(
            numericAmount,
          ) ||
          numericAmount <=
            0
        ) {
          throw new Error(
            "A donor and positive contribution amount are required.",
          );
        }

        const matchingDonor =
          donors.find(
            (donor) =>
              fundraisingKey(
                donor.name,
              ) ===
              fundraisingKey(
                cleanDonorName,
              ),
          );

        const normalizedType =
          contributionTypeValue(
            type,
          );

        const {
          data,
          error:
            insertError,
        } =
          await supabase
            .from(
              "campaign_contributions",
            )
            .insert({
              workspace_id:
                workspaceId,

              donor_contact_id:
                matchingDonor
                  ?.contactId ||
                null,

              donor_name_snapshot:
                cleanDonorName,

              donor_email_snapshot:
                matchingDonor
                  ?.email ||
                null,

              donor_phone_snapshot:
                matchingDonor
                  ?.phone ||
                null,

              goal_id:
                goalId ||
                null,

              amount_cents:
                Math.round(
                  numericAmount *
                  100,
                ),

              currency:
                "USD",

              contribution_type:
                normalizedType,

              status:
                "completed",

              is_recurring:
                normalizedType ===
                "recurring",

              source:
                "manual",

              receipt_status:
                "pending",
            })
            .select(
              "id",
            )
            .single();

        if (
          insertError
        ) {
          throw insertError;
        }

        await refresh();

        return {
          id:
            data.id,
        };
      },
      [
        workspaceId,
        donors,
        refresh,
      ],
    );


  return {
    contributions,
    donors,
    goals,
    pledges,
    metrics,
    loading,
    error,
    refresh,
    addDonor,
    recordContribution,
  };
}
