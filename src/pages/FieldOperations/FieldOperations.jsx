import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  GripVertical,
  ChevronRight,
  Circle,
  Edit3,
  FileSpreadsheet,
  Flag,
  House,
  LoaderCircle,
  MapPin,
  Menu,
  MessageSquareText,
  Navigation,
  Plus,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  useState,
} from "react";

import {
  CampaignSidebar,
} from "../../components/CampaignSidebar/CampaignSidebar";
import {
  CampaignDateTime,
} from "../../components/CampaignDateTime/CampaignDateTime";
import {
  FieldStopBulkImport,
} from "../../components/FieldStopBulkImport/FieldStopBulkImport";
import {
  FieldRouteMap,
} from "../../components/FieldRouteMap/FieldRouteMap";
import {
  useFieldOperationsCommandCenter,
} from "../../hooks/useFieldOperationsCommandCenter";
import {
  useTeamAccessCommandCenter,
} from "../../hooks/useTeamAccessCommandCenter";
import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import shellStyles from "../Team/Team.module.css";
import styles from "./FieldOperations.module.css";

const EMPTY_ASSIGNMENT = {
  id: "",
  volunteerUserId: "",
  title: "Door-knocking assignment",
  precinct: "",
  turfName: "",
  assignmentDate: "",
  shiftStartsAt: "",
  shiftEndsAt: "",
  meetingLocation: "",
  instructions: "",
  status: "assigned",
};

const EMPTY_ROUTE = {
  id: "",
  routeOrder: 1,
  name: "Route 1",
  startLocation: "",
  finishMode: "final_stop",
  instructions: "",
  status: "ready",
};

const EMPTY_STOP = {
  id: "",
  routeId: "",
  stopOrder: 1,
  locationLabel: "",
  addressLine1: "",
  addressLine2: "",
  city: "Wellington",
  state: "FL",
  postalCode: "",
  latitude: "",
  longitude: "",
  instructions: "",
};


const FOLLOW_UP_SUGGESTED_RESULTS =
  new Set([
    "not_home",
    "inaccessible",
    "moved",
    "other",
  ]);

const EMPTY_FOLLOW_UP = {
  title: "",
  volunteerUserId: "",
  assignmentDate: "",
  meetingLocation: "",
  instructions: "",
  finishMode: "final_stop",
};

const EMPTY_TURF_ACTION_PLAN = {
  title: "",
  volunteerUserId: "",
  assignmentDate: "",
  meetingLocation: "",
  instructions: "",
  finishMode: "final_stop",
};

function labelStatus(value) {
  return String(value || "assigned")
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function toDateTimeLocal(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset =
    date.getTimezoneOffset() *
    60 *
    1000;

  return new Date(
    date.getTime() - offset,
  )
    .toISOString()
    .slice(0, 16);
}

function toIso(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date.toISOString();
}

function formatDateTime(value) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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
    },
  ).format(date);
}

function getAddress(stop) {
  return [
    stop.address_line_1,
    stop.address_line_2,
    [
      stop.city,
      stop.state,
      stop.postal_code,
    ]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

function hasCoordinate(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return false;
  }

  return Number.isFinite(
    Number(value),
  );
}

function addressSignature({
  addressLine1,
  addressLine2,
  city,
  state,
  postalCode,
}) {
  return [
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
  ]
    .map((value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " "),
    )
    .join("|");
}

function stopAddressSignature(stop) {
  return addressSignature({
    addressLine1:
      stop.address_line_1,
    addressLine2:
      stop.address_line_2,
    city:
      stop.city,
    state:
      stop.state,
    postalCode:
      stop.postal_code,
  });
}

function needsAutomaticGeocoding(payload) {
  return (
    !hasCoordinate(
      payload.latitude,
    ) ||
    !hasCoordinate(
      payload.longitude,
    )
  );
}

function numericCoordinate(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function sortedRouteStops(route) {
  return (
    route.field_stops ||
    []
  )
    .slice()
    .sort(
      (left, right) =>
        Number(
          left.stop_order ||
            0,
        ) -
        Number(
          right.stop_order ||
            0,
        ),
    );
}

function stopName(stop) {
  return (
    stop.location_label ||
    getAddress(stop) ||
    `Stop ${stop.stop_order}`
  );
}


function isSuggestedFollowUpStop(
  stop,
) {
  return (
    stop.status ===
      "skipped" ||
    FOLLOW_UP_SUGGESTED_RESULTS
      .has(
        stop.result_code,
      )
  );
}

function sourceResultLabel(
  stop,
) {
  if (!stop) {
    return "Result unavailable";
  }

  if (
    stop.status ===
    "pending"
  ) {
    return "Pending";
  }

  if (
    stop.status ===
    "skipped"
  ) {
    return "Skipped";
  }

  return labelStatus(
    stop.result_code ||
      stop.status,
  );
}

function followUpGenerationLabel(
  distance,
) {
  const generation =
    Number(distance) ||
    1;

  return generation === 1
    ? "Direct follow-up"
    : `Generation ${generation} follow-up`;
}

function assignmentStops(
  assignment,
) {
  return (
    assignment?.field_routes ||
    []
  ).flatMap(
    (route) =>
      route.field_stops ||
      [],
  );
}

function completionReview(
  assignment,
) {
  return (
    assignment
      ?.completion_review || {
      review_status:
        "pending",
      review_notes:
        "",
      reviewed_by:
        null,
      reviewed_at:
        null,
    }
  );
}

function completionSummary(
  assignment,
) {
  const stops =
    assignmentStops(
      assignment,
    );

  const totals = {
    contacted: 0,
    not_home: 0,
    refused: 0,
    inaccessible: 0,
    moved: 0,
    other: 0,
    skipped: 0,
    pending: 0,
  };

  stops.forEach((stop) => {
    if (
      stop.status ===
      "pending"
    ) {
      totals.pending += 1;
      return;
    }

    if (
      stop.status ===
      "skipped"
    ) {
      totals.skipped += 1;
      return;
    }

    const result =
      stop.result_code;

    if (
      Object.prototype
        .hasOwnProperty.call(
          totals,
          result,
        ) &&
      result !== "pending" &&
      result !== "skipped"
    ) {
      totals[result] += 1;
      return;
    }

    if (
      stop.status ===
      "inaccessible"
    ) {
      totals.inaccessible += 1;
      return;
    }

    totals.other += 1;
  });

  const total =
    stops.length;

  const recorded =
    total -
    totals.pending;

  return {
    stops,
    totals,
    total,
    recorded,
    ready:
      total > 0 &&
      totals.pending === 0 &&
      assignment?.status ===
        "completed",
  };
}

function reviewStatusLabel(
  assignment,
) {
  return (
    completionReview(
      assignment,
    ).review_status ===
    "reviewed"
      ? "Reviewed"
      : "Review pending"
  );
}

function performanceDateKey(
  assignment,
) {
  const value =
    assignment
      ?.assignment_date ||
    assignment
      ?.shift_starts_at ||
    assignment
      ?.created_at ||
    "";

  if (!value) {
    return "";
  }

  const stringValue =
    String(value);

  if (
    /^\d{4}-\d{2}-\d{2}/
      .test(
        stringValue,
      )
  ) {
    return stringValue.slice(
      0,
      10,
    );
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

function formatPerformanceDate(
  assignment,
) {
  const key =
    performanceDateKey(
      assignment,
    );

  if (!key) {
    return "No assignment date";
  }

  const [
    year,
    month,
    day,
  ] =
    key
      .split("-")
      .map(Number);

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(
    new Date(
      year,
      month - 1,
      day,
    ),
  );
}

function percentage(
  numerator,
  denominator,
) {
  return denominator
    ? Math.round(
        (
          numerator /
          denominator
        ) *
          100,
      )
    : 0;
}

function matchesPerformanceStatus(
  assignment,
  filter,
) {
  if (
    !filter ||
    filter === "all"
  ) {
    return true;
  }

  if (
    filter === "active"
  ) {
    return ![
      "completed",
      "cancelled",
    ].includes(
      assignment.status,
    );
  }

  if (
    filter === "reviewed"
  ) {
    return (
      completionReview(
        assignment,
      ).review_status ===
      "reviewed"
    );
  }

  if (
    filter === "needs_review"
  ) {
    return (
      assignment.status ===
        "completed" &&
      completionReview(
        assignment,
      ).review_status !==
        "reviewed"
    );
  }

  return (
    assignment.status ===
    filter
  );
}

function emptyPerformanceTotals() {
  return {
    assignments: 0,
    originalAssignments: 0,
    followUpAssignments: 0,
    routes: 0,
    totalStops: 0,
    recordedStops: 0,
    pendingStops: 0,
    contacted: 0,
    not_home: 0,
    refused: 0,
    inaccessible: 0,
    moved: 0,
    other: 0,
    skipped: 0,
    completedAssignments: 0,
    reviewedAssignments: 0,
    reviewPendingAssignments: 0,
  };
}

function addAssignmentPerformance(
  totals,
  assignment,
) {
  const summary =
    completionSummary(
      assignment,
    );

  totals.assignments += 1;

  if (
    assignment
      .source_assignment_id
  ) {
    totals.followUpAssignments +=
      1;
  } else {
    totals.originalAssignments +=
      1;
  }

  totals.routes +=
    (
      assignment
        .field_routes ||
      []
    ).length;

  totals.totalStops +=
    summary.total;

  totals.recordedStops +=
    summary.recorded;

  totals.pendingStops +=
    summary.totals.pending;

  totals.contacted +=
    summary.totals.contacted;

  totals.not_home +=
    summary.totals.not_home;

  totals.refused +=
    summary.totals.refused;

  totals.inaccessible +=
    summary.totals.inaccessible;

  totals.moved +=
    summary.totals.moved;

  totals.other +=
    summary.totals.other;

  totals.skipped +=
    summary.totals.skipped;

  if (
    assignment.status ===
    "completed"
  ) {
    totals.completedAssignments +=
      1;

    if (
      completionReview(
        assignment,
      ).review_status ===
      "reviewed"
    ) {
      totals.reviewedAssignments +=
        1;
    } else {
      totals.reviewPendingAssignments +=
        1;
    }
  }

  return totals;
}

function fieldAreaLabel(
  value,
  fallback,
) {
  const label =
    String(
      value || "",
    ).trim();

  return label || fallback;
}

function unresolvedPriorityCount(
  totals,
) {
  return (
    totals.pendingStops +
    totals.not_home +
    totals.inaccessible +
    totals.moved +
    totals.other
  );
}

function turfPriorityScore(
  totals,
) {
  return (
    totals.pendingStops * 5 +
    totals.inaccessible * 4 +
    totals.moved * 4 +
    totals.not_home * 3 +
    totals.other * 2 +
    totals.skipped
  );
}

function turfPriorityLabel(
  totals,
) {
  const unresolved =
    unresolvedPriorityCount(
      totals,
    );

  const score =
    turfPriorityScore(
      totals,
    );

  if (!unresolved) {
    return {
      label: "Covered",
      tone: "covered",
    };
  }

  if (
    score >= 20 ||
    unresolved >= 8
  ) {
    return {
      label: "High priority",
      tone: "high",
    };
  }

  if (
    score >= 8 ||
    unresolved >= 3
  ) {
    return {
      label: "Medium priority",
      tone: "medium",
    };
  }

  return {
    label: "Watch",
    tone: "watch",
  };
}

function assignmentPriorityScore(
  assignment,
) {
  const totals =
    completionSummary(
      assignment,
    ).totals;

  return (
    totals.pending * 5 +
    totals.inaccessible * 4 +
    totals.moved * 4 +
    totals.not_home * 3 +
    totals.other * 2 +
    totals.skipped
  );
}

function turfActionCandidateRecords(
  assignments,
  followedUpSourceIds,
) {
  return assignments
    .flatMap(
      (assignment) =>
        (
          assignment
            .field_routes ||
          []
        ).flatMap(
          (route) =>
            sortedRouteStops(
              route,
            ).map(
              (stop) => {
                const alreadyFollowed =
                  followedUpSourceIds
                    .has(
                      stop.id,
                    );

                const reviewed =
                  completionReview(
                    assignment,
                  ).review_status ===
                  "reviewed";

                const selectable =
                  stop.status !==
                    "pending" &&
                  !alreadyFollowed &&
                  assignment.status ===
                    "completed" &&
                  reviewed;

                let availability =
                  "ready";

                if (
                  stop.status ===
                  "pending"
                ) {
                  availability =
                    "active_pending";
                } else if (
                  alreadyFollowed
                ) {
                  availability =
                    "already_followed";
                } else if (
                  assignment.status ===
                    "completed" &&
                  !reviewed
                ) {
                  availability =
                    "needs_review";
                } else if (
                  assignment.status !==
                    "completed"
                ) {
                  availability =
                    "finish_first";
                }

                return {
                  assignment,
                  route,
                  stop,
                  selectable,
                  availability,
                  suggested:
                    selectable &&
                    isSuggestedFollowUpStop(
                      stop,
                    ),
                };
              },
            ),
        ),
    )
    .sort(
      (left, right) =>
        performanceDateKey(
          right.assignment,
        ).localeCompare(
          performanceDateKey(
            left.assignment,
          ),
        ) ||
        Number(
          left.route
            .route_order ||
            0,
        ) -
          Number(
            right.route
              .route_order ||
              0,
          ) ||
        Number(
          left.stop
            .stop_order ||
            0,
        ) -
          Number(
            right.stop
              .stop_order ||
              0,
          ),
    );
}

function turfActionAvailabilityLabel(
  candidate,
) {
  if (
    candidate.availability ===
    "active_pending"
  ) {
    return "Already active";
  }

  if (
    candidate.availability ===
    "already_followed"
  ) {
    return "Already added";
  }

  if (
    candidate.availability ===
    "needs_review"
  ) {
    return "Review first";
  }

  if (
    candidate.availability ===
    "finish_first"
  ) {
    return "Finish first";
  }

  return candidate.suggested
    ? "Suggested"
    : "Optional";
}


function commandBoardLocalDateKey(
  value = new Date(),
) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

function commandBoardTodayKey() {
  return commandBoardLocalDateKey(
    new Date(),
  );
}

function commandBoardDateFromKey(
  key,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/
      .test(
        String(key || ""),
      )
  ) {
    return null;
  }

  const [
    year,
    month,
    day,
  ] =
    key
      .split("-")
      .map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}

function commandBoardShiftDate(
  key,
  amount,
) {
  const date =
    commandBoardDateFromKey(
      key,
    );

  if (!date) {
    return commandBoardTodayKey();
  }

  date.setDate(
    date.getDate() +
      amount,
  );

  return commandBoardLocalDateKey(
    date,
  );
}

function formatCommandBoardDate(
  key,
) {
  const date =
    commandBoardDateFromKey(
      key,
    );

  if (!date) {
    return "Operational date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(
    date,
  );
}

function commandBoardAssignmentDateKey(
  assignment,
) {
  const assignmentDate =
    String(
      assignment
        ?.assignment_date ||
        "",
    ).trim();

  if (
    /^\d{4}-\d{2}-\d{2}/
      .test(
        assignmentDate,
      )
  ) {
    return assignmentDate.slice(
      0,
      10,
    );
  }

  if (
    assignment
      ?.shift_starts_at
  ) {
    return commandBoardLocalDateKey(
      assignment
        .shift_starts_at,
    );
  }

  return "";
}

function formatCommandBoardTime(
  assignment,
) {
  const startsAt =
    assignment
      ?.shift_starts_at;

  if (!startsAt) {
    return "Time not scheduled";
  }

  const start =
    new Date(
      startsAt,
    );

  if (
    Number.isNaN(
      start.getTime(),
    )
  ) {
    return "Time not scheduled";
  }

  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      },
    );

  const endsAt =
    assignment
      ?.shift_ends_at;

  if (!endsAt) {
    return formatter.format(
      start,
    );
  }

  const end =
    new Date(
      endsAt,
    );

  if (
    Number.isNaN(
      end.getTime(),
    )
  ) {
    return formatter.format(
      start,
    );
  }

  return `${formatter.format(
    start,
  )} - ${formatter.format(
    end,
  )}`;
}

function commandBoardAssignmentSort(
  left,
  right,
) {
  const leftShift =
    left
      ?.shift_starts_at
      ? new Date(
          left.shift_starts_at,
        ).getTime()
      : Number.POSITIVE_INFINITY;

  const rightShift =
    right
      ?.shift_starts_at
      ? new Date(
          right.shift_starts_at,
        ).getTime()
      : Number.POSITIVE_INFINITY;

  const safeLeftShift =
    Number.isFinite(
      leftShift,
    )
      ? leftShift
      : Number.POSITIVE_INFINITY;

  const safeRightShift =
    Number.isFinite(
      rightShift,
    )
      ? rightShift
      : Number.POSITIVE_INFINITY;

  return (
    safeLeftShift -
      safeRightShift ||
    String(
      left?.title ||
        "",
    ).localeCompare(
      String(
        right?.title ||
          "",
      ),
    )
  );
}

function commandBoardStatusGroup(
  assignment,
) {
  if (
    assignment
      ?.status ===
    "in_progress"
  ) {
    return "in_progress";
  }

  if (
    assignment
      ?.status ===
    "completed"
  ) {
    return "completed";
  }

  if (
    assignment
      ?.status ===
    "cancelled"
  ) {
    return "cancelled";
  }

  return "scheduled";
}

function commandBoardAvailableFollowUpCount(
  assignment,
  followedUpSourceIds,
) {
  if (
    assignment
      ?.status !==
      "completed" ||
    completionReview(
      assignment,
    ).review_status !==
      "reviewed"
  ) {
    return 0;
  }

  return assignmentStops(
    assignment,
  ).filter(
    (stop) =>
      stop.status !==
        "pending" &&
      isSuggestedFollowUpStop(
        stop,
      ) &&
      !followedUpSourceIds
        .has(
          stop.id,
        ),
  ).length;
}

function fieldAlertReasonLabel(
  reason,
) {
  const count =
    Number(
      reason?.count,
    ) ||
    0;

  const labels = {
    unassigned:
      "Volunteer unassigned",
    overdue:
      count === 1
        ? "1 pending stop overdue"
        : `${count} pending stops overdue`,
    starting_soon:
      "Starts within 4 hours",
    review_waiting:
      "Completion review waiting",
    follow_up:
      count === 1
        ? "1 follow-up stop available"
        : `${count} follow-up stops available`,
    time_unscheduled:
      "Time not scheduled",
    needs_scheduling:
      "Operational date needed",
    upcoming:
      "Upcoming deployment",
  };

  return (
    labels[
      reason?.key
    ] ||
    "Needs attention"
  );
}

function fieldAlertShiftTime(
  assignment,
) {
  const value =
    assignment
      ?.shift_starts_at;

  if (!value) {
    return null;
  }

  const time =
    new Date(
      value,
    ).getTime();

  return Number.isFinite(
    time,
  )
    ? time
    : null;
}

function distanceMiles(
  left,
  right,
) {
  const leftLatitude =
    numericCoordinate(
      left.latitude,
    );

  const leftLongitude =
    numericCoordinate(
      left.longitude,
    );

  const rightLatitude =
    numericCoordinate(
      right.latitude,
    );

  const rightLongitude =
    numericCoordinate(
      right.longitude,
    );

  if (
    leftLatitude === null ||
    leftLongitude === null ||
    rightLatitude === null ||
    rightLongitude === null
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const radians =
    (degrees) =>
      (
        degrees *
        Math.PI
      ) /
      180;

  const latitudeDelta =
    radians(
      rightLatitude -
        leftLatitude,
    );

  const longitudeDelta =
    radians(
      rightLongitude -
        leftLongitude,
    );

  const leftRadians =
    radians(
      leftLatitude,
    );

  const rightRadians =
    radians(
      rightLatitude,
    );

  const value =
    Math.sin(
      latitudeDelta / 2,
    ) ** 2 +
    Math.cos(
      leftRadians,
    ) *
      Math.cos(
        rightRadians,
      ) *
      Math.sin(
        longitudeDelta / 2,
      ) ** 2;

  return (
    3958.7613 *
    2 *
    Math.atan2(
      Math.sqrt(value),
      Math.sqrt(
        1 - value,
      ),
    )
  );
}

function routeFinishMode(route) {
  return [
    "final_stop",
    "return_start",
    "meeting_point",
  ].includes(
    route?.finish_mode,
  )
    ? route.finish_mode
    : "final_stop";
}

function routeFinishLabel(
  route,
  meetingLocation = "",
) {
  const finishMode =
    routeFinishMode(route);

  if (
    finishMode ===
    "return_start"
  ) {
    return "Return to starting stop";
  }

  if (
    finishMode ===
    "meeting_point"
  ) {
    return meetingLocation
      ? `Return to meeting point: ${meetingLocation}`
      : "Return to meeting point";
  }

  return "End at final stop";
}

function routeDistanceMiles(
  stops,
  finishMode = "final_stop",
) {
  const openDistance =
    stops
      .slice(1)
      .reduce(
        (
          total,
          stop,
          index,
        ) =>
          total +
          distanceMiles(
            stops[index],
            stop,
          ),
        0,
      );

  if (
    finishMode ===
      "return_start" &&
    stops.length > 1
  ) {
    return (
      openDistance +
      distanceMiles(
        stops[
          stops.length - 1
        ],
        stops[0],
      )
    );
  }

  return openDistance;
}

function nearestNeighborOrder(stops) {
  const ordered =
    sortedRouteStops({
      field_stops: stops,
    });

  if (ordered.length < 3) {
    return ordered;
  }

  const result = [
    ordered[0],
  ];

  const remaining =
    ordered.slice(1);

  while (remaining.length) {
    const current =
      result[
        result.length - 1
      ];

    let nearestIndex = 0;
    let nearestDistance =
      Number.POSITIVE_INFINITY;

    remaining.forEach(
      (
        candidate,
        index,
      ) => {
        const candidateDistance =
          distanceMiles(
            current,
            candidate,
          );

        if (
          candidateDistance <
          nearestDistance
        ) {
          nearestDistance =
            candidateDistance;
          nearestIndex =
            index;
        }
      },
    );

    result.push(
      remaining.splice(
        nearestIndex,
        1,
      )[0],
    );
  }

  return result;
}

function improveRoute(
  stops,
  finishMode = "final_stop",
) {
  const result =
    stops.slice();

  if (result.length < 4) {
    return result;
  }

  const maximumPasses =
    Math.min(
      5,
      result.length,
    );

  for (
    let pass = 0;
    pass < maximumPasses;
    pass += 1
  ) {
    let improved = false;

    for (
      let start = 1;
      start <
      result.length - 1;
      start += 1
    ) {
      for (
        let end =
          start + 1;
        end <
        result.length;
        end += 1
      ) {
        const before =
          result[
            start - 1
          ];

        const first =
          result[start];

        const last =
          result[end];

        const after =
          result[
            end + 1
          ] ||
          (
            finishMode ===
              "return_start"
              ? result[0]
              : null
          );

        const currentDistance =
          distanceMiles(
            before,
            first,
          ) +
          (
            after
              ? distanceMiles(
                  last,
                  after,
                )
              : 0
          );

        const reversedDistance =
          distanceMiles(
            before,
            last,
          ) +
          (
            after
              ? distanceMiles(
                  first,
                  after,
                )
              : 0
          );

        if (
          reversedDistance +
            0.000001 <
          currentDistance
        ) {
          const reversed =
            result
              .slice(
                start,
                end + 1,
              )
              .reverse();

          result.splice(
            start,
            reversed.length,
            ...reversed,
          );

          improved = true;
        }
      }
    }

    if (!improved) {
      break;
    }
  }

  return result;
}

function optimizedRouteStops(route) {
  return improveRoute(
    nearestNeighborOrder(
      sortedRouteStops(
        route,
      ),
    ),
    routeFinishMode(route),
  );
}

function moveStopInOrder(
  stops,
  fromIndex,
  toIndex,
) {
  if (
    fromIndex < 0 ||
    fromIndex >= stops.length ||
    toIndex < 0 ||
    toIndex >= stops.length ||
    fromIndex === toIndex
  ) {
    return stops.slice();
  }

  const next =
    stops.slice();

  const [moved] =
    next.splice(
      fromIndex,
      1,
    );

  next.splice(
    toIndex,
    0,
    moved,
  );

  return next;
}


const READINESS_ACTIVE_STATUSES =
  new Set([
    "assigned",
    "accepted",
    "in_progress",
  ]);

const READINESS_FINISH_MODES =
  new Set([
    "final_stop",
    "return_start",
    "meeting_point",
  ]);

function readinessOrderCheck(
  records,
  key,
) {
  if (!records.length) {
    return {
      valid: false,
      values: [],
    };
  }

  const values =
    records.map(
      (record) =>
        Number(record[key]),
    );

  const validValues =
    values.every(
      (value) =>
        Number.isInteger(value) &&
        value > 0,
    );

  const unique =
    new Set(values).size ===
    values.length;

  const contiguous =
    values
      .slice()
      .sort(
        (left, right) =>
          left - right,
      )
      .every(
        (value, index) =>
          value === index + 1,
      );

  return {
    valid:
      validValues &&
      unique &&
      contiguous,
    values,
  };
}

function readinessAddressComplete(
  stop,
) {
  return Boolean(
    String(
      stop.address_line_1 ||
        "",
    ).trim() &&
      String(
        stop.city ||
          "",
      ).trim() &&
      String(
        stop.state ||
          "",
      ).trim() &&
      String(
        stop.postal_code ||
          "",
      ).trim(),
  );
}

function readinessCoordinateComplete(
  stop,
) {
  const latitude =
    numericCoordinate(
      stop.latitude,
    );

  const longitude =
    numericCoordinate(
      stop.longitude,
    );

  return (
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function readinessRecord(
  assignment,
) {
  const routes =
    assignment.field_routes ||
    [];

  const stops =
    assignmentStops(
      assignment,
    );

  const emptyRoutes =
    routes.filter(
      (route) =>
        !(
          route.field_stops ||
          []
        ).length,
    );

  const incompleteAddressStops =
    stops.filter(
      (stop) =>
        !readinessAddressComplete(
          stop,
        ),
    );

  const missingCoordinateStops =
    stops.filter(
      (stop) =>
        !readinessCoordinateComplete(
          stop,
        ),
    );

  const invalidFinishRoutes =
    routes.filter(
      (route) =>
        !READINESS_FINISH_MODES
          .has(
            route.finish_mode,
          ),
    );

  const meetingPointRoutes =
    routes.filter(
      (route) =>
        route.finish_mode ===
        "meeting_point",
    );

  const routeOrder =
    readinessOrderCheck(
      routes,
      "route_order",
    );

  const stopOrderIssueRoutes =
    routes.filter(
      (route) =>
        !readinessOrderCheck(
          route.field_stops ||
            [],
          "stop_order",
        ).valid,
    );

  const blockers = [];
  const warnings = [];

  const addBlocker =
    (
      key,
      label,
      detail,
    ) => {
      blockers.push({
        key,
        label,
        detail,
        state: "blocked",
      });
    };

  const addWarning =
    (
      key,
      label,
      detail,
    ) => {
      warnings.push({
        key,
        label,
        detail,
        state: "warning",
      });
    };

  const checks = [];

  const addCheck =
    (
      key,
      label,
      state,
      detail,
    ) => {
      checks.push({
        key,
        label,
        state,
        detail,
      });

      if (state === "blocked") {
        addBlocker(
          key,
          label,
          detail,
        );
      }

      if (state === "warning") {
        addWarning(
          key,
          label,
          detail,
        );
      }
    };

  addCheck(
    "volunteer",
    "Volunteer assigned",
    assignment
      .volunteer_user_id
      ? "passed"
      : "blocked",
    assignment
      .volunteer_user_id
      ? "An active Volunteer is assigned."
      : "Assign an active Volunteer before deployment.",
  );

  addCheck(
    "assignment_date",
    "Assignment date",
    assignment
      .assignment_date
      ? "passed"
      : "blocked",
    assignment
      .assignment_date
      ? "The operational date is scheduled."
      : "Choose the field-work date.",
  );

  addCheck(
    "shift_start",
    "Shift start",
    assignment
      .shift_starts_at
      ? "passed"
      : "blocked",
    assignment
      .shift_starts_at
      ? "The Volunteer has a start time."
      : "Set the shift start time.",
  );

  addCheck(
    "shift_end",
    "Shift end",
    assignment
      .shift_ends_at
      ? "passed"
      : "warning",
    assignment
      .shift_ends_at
      ? "The expected shift window is complete."
      : "Adding an end time is recommended.",
  );

  addCheck(
    "routes",
    "Route created",
    routes.length
      ? "passed"
      : "blocked",
    routes.length
      ? `${routes.length} ${
          routes.length === 1
            ? "route is"
            : "routes are"
        } attached.`
      : "Add at least one route.",
  );

  addCheck(
    "stops",
    "Stops added",
    stops.length &&
      !emptyRoutes.length
      ? "passed"
      : "blocked",
    !stops.length
      ? "Add at least one stop."
      : emptyRoutes.length
        ? `${emptyRoutes.length} ${
            emptyRoutes.length === 1
              ? "route has"
              : "routes have"
          } no stops.`
        : `${stops.length} ${
            stops.length === 1
              ? "stop is"
              : "stops are"
          } ready for validation.`,
  );

  addCheck(
    "addresses",
    "Complete addresses",
    stops.length &&
      !incompleteAddressStops
        .length
      ? "passed"
      : "blocked",
    !stops.length
      ? "Add stops before validating addresses."
      : incompleteAddressStops
          .length
        ? `${incompleteAddressStops.length} ${
            incompleteAddressStops.length === 1
              ? "stop needs"
              : "stops need"
          } street, city, state and ZIP information.`
        : "Every stop has a complete address.",
  );

  addCheck(
    "coordinates",
    "Map coordinates",
    stops.length &&
      !missingCoordinateStops
        .length
      ? "passed"
      : "warning",
    !stops.length
      ? "Coordinates will be checked after stops are added."
      : missingCoordinateStops
          .length
        ? `${missingCoordinateStops.length} ${
            missingCoordinateStops.length === 1
              ? "stop needs"
              : "stops need"
          } map coordinates.`
        : "Every stop is located on the map.",
  );

  addCheck(
    "finish_mode",
    "Route finish",
    routes.length &&
      !invalidFinishRoutes
        .length
      ? "passed"
      : "blocked",
    !routes.length
      ? "Add a route before choosing how it finishes."
      : invalidFinishRoutes
          .length
        ? `${invalidFinishRoutes.length} ${
            invalidFinishRoutes.length === 1
              ? "route has"
              : "routes have"
          } an invalid finish option.`
        : "Every route has a valid finish option.",
  );

  addCheck(
    "meeting_point",
    "Meeting point",
    meetingPointRoutes.length &&
      !String(
        assignment
          .meeting_location ||
          "",
      ).trim()
      ? "blocked"
      : "passed",
    meetingPointRoutes.length
      ? String(
          assignment
            .meeting_location ||
            "",
        ).trim()
        ? "The return meeting point is provided."
        : "Add a meeting point because a route returns there."
      : "No route requires a return meeting point.",
  );

  addCheck(
    "route_order",
    "Route order",
    routes.length &&
      routeOrder.valid
      ? "passed"
      : "blocked",
    !routes.length
      ? "Add routes before validating route order."
      : routeOrder.valid
        ? "Route numbers are complete and unique."
        : "Route numbers must be unique and sequential.",
  );

  addCheck(
    "stop_order",
    "Stop order",
    routes.length &&
      !stopOrderIssueRoutes
        .length
      ? "passed"
      : "blocked",
    !routes.length
      ? "Add routes before validating stop order."
      : stopOrderIssueRoutes
          .length
        ? `${stopOrderIssueRoutes.length} ${
            stopOrderIssueRoutes.length === 1
              ? "route needs"
              : "routes need"
          } a complete, unique stop order.`
        : "Every route has a complete, unique stop order.",
  );

  addCheck(
    "instructions",
    "Volunteer instructions",
    String(
      assignment.instructions ||
        "",
    ).trim()
      ? "passed"
      : "warning",
    String(
      assignment.instructions ||
        "",
    ).trim()
      ? "Deployment instructions are available."
      : "Adding Volunteer instructions is recommended.",
  );

  const group =
    assignment.status ===
      "in_progress"
      ? "in_progress"
      : blockers.length
        ? "blocked"
        : warnings.length
          ? "attention"
          : "ready";

  const firstOrderIssueRoute =
    !routeOrder.valid
      ? routes[0] ||
        null
      : stopOrderIssueRoutes[0] ||
        null;

  return {
    assignment,
    routes,
    stops,
    checks,
    blockers,
    warnings,
    group,
    incompleteAddressStops,
    missingCoordinateStops,
    missingCoordinateRoutes:
      routes.filter(
        (route) =>
          (
            route.field_stops ||
            []
          ).some(
            (stop) =>
              !readinessCoordinateComplete(
                stop,
              ),
          ),
      ),
    routeOrderInvalid:
      !routeOrder.valid,
    firstOrderIssueRoute,
  };
}

function deploymentHandoffHistory(
  assignment,
) {
  return (
    assignment
      ?.deployment_handoffs ||
    []
  )
    .slice()
    .sort(
      (left, right) =>
        Number(
          right.cycle_number ||
            0,
        ) -
          Number(
            left.cycle_number ||
              0,
          ) ||
        new Date(
          right.sent_at ||
            right.created_at ||
            0,
        ).getTime() -
          new Date(
            left.sent_at ||
              left.created_at ||
              0,
          ).getTime(),
    );
}

function latestDeploymentHandoff(
  assignment,
) {
  return (
    deploymentHandoffHistory(
      assignment,
    )[0] ||
    null
  );
}

function deploymentHandoffState(
  handoff,
) {
  if (!handoff) {
    return "not_sent";
  }

  if (
    handoff.invalidated_at ||
    handoff.status ===
      "invalidated"
  ) {
    return "changed";
  }

  if (
    handoff.acknowledged_at ||
    handoff.status ===
      "acknowledged"
  ) {
    return "acknowledged";
  }

  return "awaiting";
}

function deploymentHandoffLabel(
  state,
) {
  const labels = {
    not_sent:
      "Not sent",
    awaiting:
      "Awaiting acknowledgment",
    acknowledged:
      "Acknowledged",
    changed:
      "Changed - send again",
  };

  return (
    labels[state] ||
    "Not sent"
  );
}

function readinessGroupLabel(
  group,
) {
  const labels = {
    blocked: "Blocked",
    attention:
      "Needs attention",
    ready: "Ready",
    in_progress:
      "Deployment started",
  };

  return (
    labels[group] ||
    "Needs attention"
  );
}

function assignmentFormFrom(
  assignment,
) {
  return {
    id:
      assignment.id,
    volunteerUserId:
      assignment.volunteer_user_id ||
      "",
    title:
      assignment.title || "",
    precinct:
      assignment.precinct || "",
    turfName:
      assignment.turf_name || "",
    assignmentDate:
      assignment.assignment_date || "",
    shiftStartsAt:
      toDateTimeLocal(
        assignment.shift_starts_at,
      ),
    shiftEndsAt:
      toDateTimeLocal(
        assignment.shift_ends_at,
      ),
    meetingLocation:
      assignment.meeting_location ||
      "",
    instructions:
      assignment.instructions || "",
    status:
      assignment.status ||
      "assigned",
  };
}

function routeFormFrom(route) {
  return {
    id: route.id,
    routeOrder:
      route.route_order,
    name:
      route.name || "",
    startLocation:
      route.start_location || "",
    finishMode:
      route.finish_mode ||
      "final_stop",
    instructions:
      route.instructions || "",
    status:
      route.status || "ready",
  };
}

function stopFormFrom(
  stop,
  routeId,
) {
  return {
    id: stop.id,
    routeId,
    stopOrder:
      stop.stop_order,
    locationLabel:
      stop.location_label || "",
    addressLine1:
      stop.address_line_1 || "",
    addressLine2:
      stop.address_line_2 || "",
    city:
      stop.city || "Wellington",
    state:
      stop.state || "FL",
    postalCode:
      stop.postal_code || "",
    latitude:
      stop.latitude ?? "",
    longitude:
      stop.longitude ?? "",
    instructions:
      stop.instructions || "",
  };
}

export default function FieldOperations() {
  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    selectedAssignmentId,
    setSelectedAssignmentId,
  ] = useState("");

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("active");

  const [
    editorType,
    setEditorType,
  ] = useState("");

  const [
    assignmentForm,
    setAssignmentForm,
  ] = useState(
    EMPTY_ASSIGNMENT,
  );

  const [
    routeForm,
    setRouteForm,
  ] = useState(
    EMPTY_ROUTE,
  );

  const [
    stopForm,
    setStopForm,
  ] = useState(
    EMPTY_STOP,
  );

  const [
    formError,
    setFormError,
  ] = useState("");

  const [
    bulkImportRoute,
    setBulkImportRoute,
  ] = useState(null);

  const [
    geocodingRouteId,
    setGeocodingRouteId,
  ] = useState("");

  const [
    optimizingRouteId,
    setOptimizingRouteId,
  ] = useState("");

  const [
    manualOrderRoute,
    setManualOrderRoute,
  ] = useState(null);

  const [
    manualOrderStops,
    setManualOrderStops,
  ] = useState([]);

  const [
    manualOrderError,
    setManualOrderError,
  ] = useState("");

  const [
    manualOrderAnnouncement,
    setManualOrderAnnouncement,
  ] = useState("");

  const [
    draggedStopId,
    setDraggedStopId,
  ] = useState("");

  const [
    reorderingRouteId,
    setReorderingRouteId,
  ] = useState("");

  const [
    startingStopId,
    setStartingStopId,
  ] = useState("");

  const [
    reviewAssignmentId,
    setReviewAssignmentId,
  ] = useState("");

  const [
    reviewNotes,
    setReviewNotes,
  ] = useState("");

  const [
    reviewError,
    setReviewError,
  ] = useState("");

  const [
    reviewAction,
    setReviewAction,
  ] = useState("");


  const [
    followUpAssignmentId,
    setFollowUpAssignmentId,
  ] = useState("");

  const [
    followUpStopIds,
    setFollowUpStopIds,
  ] = useState([]);

  const [
    followUpForm,
    setFollowUpForm,
  ] = useState(
    EMPTY_FOLLOW_UP,
  );

  const [
    followUpError,
    setFollowUpError,
  ] = useState("");

  const [
    followUpAction,
    setFollowUpAction,
  ] = useState("");

  const [
    alertsOpen,
    setAlertsOpen,
  ] = useState(false);

  const [
    readinessOpen,
    setReadinessOpen,
  ] = useState(false);

  const [
    readinessActionId,
    setReadinessActionId,
  ] = useState("");

  const [
    handoffOpen,
    setHandoffOpen,
  ] = useState(false);

  const [
    handoffAssignmentId,
    setHandoffAssignmentId,
  ] = useState("");

  const [
    handoffAction,
    setHandoffAction,
  ] = useState("");

  const [
    handoffError,
    setHandoffError,
  ] = useState("");

  const [
    commandBoardOpen,
    setCommandBoardOpen,
  ] = useState(false);

  const [
    commandBoardDate,
    setCommandBoardDate,
  ] = useState(
    commandBoardTodayKey,
  );

  const [
    performanceOpen,
    setPerformanceOpen,
  ] = useState(false);

  const [
    performanceVolunteerId,
    setPerformanceVolunteerId,
  ] = useState("all");

  const [
    performanceStatus,
    setPerformanceStatus,
  ] = useState("all");

  const [
    performanceWorkType,
    setPerformanceWorkType,
  ] = useState("all");

  const [
    performanceDateFrom,
    setPerformanceDateFrom,
  ] = useState("");

  const [
    performanceDateTo,
    setPerformanceDateTo,
  ] = useState("");

  const [
    turfOpen,
    setTurfOpen,
  ] = useState(false);

  const [
    turfPrecinctFilter,
    setTurfPrecinctFilter,
  ] = useState("all");

  const [
    turfNameFilter,
    setTurfNameFilter,
  ] = useState("all");

  const [
    turfStatus,
    setTurfStatus,
  ] = useState("all");

  const [
    turfWorkType,
    setTurfWorkType,
  ] = useState("all");

  const [
    turfDateFrom,
    setTurfDateFrom,
  ] = useState("");

  const [
    turfDateTo,
    setTurfDateTo,
  ] = useState("");

  const [
    turfPlannerRowKey,
    setTurfPlannerRowKey,
  ] = useState("");

  const [
    turfPlannerStopIds,
    setTurfPlannerStopIds,
  ] = useState([]);

  const [
    turfPlannerForm,
    setTurfPlannerForm,
  ] = useState(
    EMPTY_TURF_ACTION_PLAN,
  );

  const [
    turfPlannerError,
    setTurfPlannerError,
  ] = useState("");

  const [
    turfPlannerAction,
    setTurfPlannerAction,
  ] = useState("");

  const {
    members,
    isLoading:
      membersLoading,
    error:
      membersError,
  } =
    useTeamAccessCommandCenter({
      workspaceId:
        workspace.id,
    });

  const {
    assignments,
    isLoading:
      assignmentsLoading,
    isSaving,
    error:
      assignmentsError,
    lastUpdated,
    refresh,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    createRoute,
    updateRoute,
    deleteRoute,
    createStop,
    bulkCreateStops,
    geocodeRoute,
    reorderRouteStops,
    saveAssignmentReview,
    createFollowUpAssignment,
    createTurfActionPlan,
    sendDeploymentHandoff,
    resetDeploymentHandoff,
    updateStop,
    deleteStop,
  } =
    useFieldOperationsCommandCenter({
      workspaceId:
        workspace.id,
      userId:
        user.id,
    });

  const volunteers =
    members.filter(
      (member) =>
        member.status === "active" &&
        (
          member.roleKey ===
            "volunteer" ||
          member.seatType ===
            "volunteer" ||
          member.dashboardType ===
            "volunteer"
        ),
    );

  const volunteerMap =
    new Map(
      volunteers.map(
        (volunteer) => [
          volunteer.userId,
          volunteer,
        ],
      ),
    );

  const memberMap =
    new Map(
      members.map(
        (member) => [
          member.userId,
          member,
        ],
      ),
    );

  const filteredAssignments =
    (() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase();

      return assignments.filter(
        (assignment) => {
          if (
            statusFilter ===
              "active" &&
            [
              "completed",
              "cancelled",
            ].includes(
              assignment.status,
            )
          ) {
            return false;
          }

          if (
            statusFilter ===
              "needs_review" &&
            (
              assignment.status !==
                "completed" ||
              completionReview(
                assignment,
              ).review_status ===
                "reviewed"
            )
          ) {
            return false;
          }

          if (
            statusFilter ===
              "reviewed" &&
            completionReview(
              assignment,
            ).review_status !==
              "reviewed"
          ) {
            return false;
          }

          if (
            ![
              "all",
              "active",
              "needs_review",
              "reviewed",
            ].includes(
              statusFilter,
            ) &&
            assignment.status !==
              statusFilter
          ) {
            return false;
          }

          if (!search) {
            return true;
          }

          const volunteer =
            volunteerMap.get(
              assignment
                .volunteer_user_id,
            );

          return [
            assignment.title,
            assignment.precinct,
            assignment.turf_name,
            assignment
              .meeting_location,
            assignment.status,
            volunteer?.fullName,
            volunteer?.email,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search);
        },
      );
    })();

  const selectedAssignment =
    assignments.find(
      (assignment) =>
        assignment.id ===
        selectedAssignmentId,
    ) ||
    filteredAssignments[0] ||
    assignments[0] ||
    null;

  const selectedVolunteer =
    selectedAssignment
      ? volunteerMap.get(
          selectedAssignment
            .volunteer_user_id,
        )
      : null;

  const reviewAssignment =
    assignments.find(
      (assignment) =>
        assignment.id ===
        reviewAssignmentId,
    ) ||
    null;

  const reviewSummary =
    completionSummary(
      reviewAssignment,
    );

  const reviewRecord =
    completionReview(
      reviewAssignment,
    );

  const reviewMember =
    reviewRecord
      .reviewed_by
      ? memberMap.get(
          reviewRecord
            .reviewed_by,
        )
      : null;


  const followUpAssignment =
    assignments.find(
      (assignment) =>
        assignment.id ===
        followUpAssignmentId,
    ) ||
    null;

  const followedUpSourceIds =
    new Set(
      assignments.flatMap(
        (assignment) =>
          (
            assignment
              .field_routes ||
            []
          ).flatMap(
            (route) =>
              (
                route
                  .field_stops ||
                []
              )
                .map(
                  (stop) =>
                    stop.source_stop_id,
                )
                .filter(Boolean),
          ),
      ),
    );

  const followUpCandidateStops =
    (
      followUpAssignment
        ?.field_routes ||
      []
    ).flatMap(
      (route) =>
        sortedRouteStops(
          route,
        )
          .filter(
            (stop) =>
              stop.status !==
              "pending",
          )
          .map(
            (stop) => ({
              stop,
              route,
              alreadyFollowed:
                followedUpSourceIds.has(
                  stop.id,
                ),
              suggested:
                isSuggestedFollowUpStop(
                  stop,
                ),
            }),
          ),
    );

  const allStops =
    assignments.flatMap(
      (assignment) =>
        (
          assignment.field_routes ||
          []
        ).flatMap(
          (route) =>
            route.field_stops ||
            [],
        ),
    );

  const completedStops =
    allStops.filter(
      (stop) =>
        stop.status !==
        "pending",
    );

  const activeAssignments =
    assignments.filter(
      (assignment) =>
        ![
          "completed",
          "cancelled",
        ].includes(
          assignment.status,
        ),
    );

  const completionRate =
    allStops.length
      ? Math.round(
          (
            completedStops.length /
            allStops.length
          ) *
            100,
        )
      : 0;

  const performanceVolunteerOptions =
    (() => {
      const optionMap =
        new Map();

      volunteers.forEach(
        (volunteer) => {
          optionMap.set(
            volunteer.userId,
            {
              userId:
                volunteer.userId,
              fullName:
                volunteer.fullName ||
                "Volunteer",
              email:
                volunteer.email ||
                "",
            },
          );
        },
      );

      assignments.forEach(
        (assignment) => {
          const volunteerId =
            assignment
              .volunteer_user_id;

          if (
            !volunteerId ||
            optionMap.has(
              volunteerId,
            )
          ) {
            return;
          }

          const member =
            memberMap.get(
              volunteerId,
            );

          optionMap.set(
            volunteerId,
            {
              userId:
                volunteerId,
              fullName:
                member?.fullName ||
                "Former or unknown Volunteer",
              email:
                member?.email ||
                "",
            },
          );
        },
      );

      return [
        ...optionMap.values(),
      ].sort(
        (left, right) =>
          left.fullName
            .localeCompare(
              right.fullName,
            ),
      );
    })();

  const performanceAssignments =
    assignments.filter(
      (assignment) => {
        if (
          performanceVolunteerId !==
            "all" &&
          (
            performanceVolunteerId ===
            "__unassigned__"
              ? Boolean(
                  assignment
                    .volunteer_user_id,
                )
              : assignment
                  .volunteer_user_id !==
                performanceVolunteerId
          )
        ) {
          return false;
        }

        if (
          performanceWorkType ===
            "original" &&
          assignment
            .source_assignment_id
        ) {
          return false;
        }

        if (
          performanceWorkType ===
            "follow_up" &&
          !assignment
            .source_assignment_id
        ) {
          return false;
        }

        if (
          !matchesPerformanceStatus(
            assignment,
            performanceStatus,
          )
        ) {
          return false;
        }

        const dateKey =
          performanceDateKey(
            assignment,
          );

        if (
          performanceDateFrom &&
          (
            !dateKey ||
            dateKey <
              performanceDateFrom
          )
        ) {
          return false;
        }

        if (
          performanceDateTo &&
          (
            !dateKey ||
            dateKey >
              performanceDateTo
          )
        ) {
          return false;
        }

        return true;
      },
    );

  const performanceTotals =
    performanceAssignments.reduce(
      (
        totals,
        assignment,
      ) =>
        addAssignmentPerformance(
          totals,
          assignment,
        ),
      emptyPerformanceTotals(),
    );

  const performanceCompletionRate =
    percentage(
      performanceTotals
        .recordedStops,
      performanceTotals
        .totalStops,
    );

  const performanceContactRate =
    percentage(
      performanceTotals
        .contacted,
      performanceTotals
        .recordedStops,
    );

  const performanceRows =
    (() => {
      const rowMap =
        new Map();

      performanceAssignments.forEach(
        (assignment) => {
          const volunteerId =
            assignment
              .volunteer_user_id ||
            "__unassigned__";

          const member =
            assignment
              .volunteer_user_id
              ? memberMap.get(
                  assignment
                    .volunteer_user_id,
                )
              : null;

          const row =
            rowMap.get(
              volunteerId,
            ) || {
              volunteerId,
              fullName:
                member?.fullName ||
                (
                  volunteerId ===
                  "__unassigned__"
                    ? "Unassigned"
                    : "Former or unknown Volunteer"
                ),
              email:
                member?.email ||
                "",
              totals:
                emptyPerformanceTotals(),
            };

          addAssignmentPerformance(
            row.totals,
            assignment,
          );

          rowMap.set(
            volunteerId,
            row,
          );
        },
      );

      return [
        ...rowMap.values(),
      ].sort(
        (left, right) =>
          right.totals
            .recordedStops -
            left.totals
              .recordedStops ||
          right.totals
            .assignments -
            left.totals
              .assignments ||
          left.fullName
            .localeCompare(
              right.fullName,
            ),
      );
    })();

  const turfPrecinctOptions =
    [
      ...new Set(
        assignments.map(
          (assignment) =>
            fieldAreaLabel(
              assignment.precinct,
              "Unassigned precinct",
            ),
        ),
      ),
    ].sort(
      (left, right) =>
        left.localeCompare(
          right,
        ),
    );

  const turfNameOptions =
    [
      ...new Set(
        assignments
          .filter(
            (assignment) =>
              turfPrecinctFilter ===
                "all" ||
              fieldAreaLabel(
                assignment.precinct,
                "Unassigned precinct",
              ) ===
                turfPrecinctFilter,
          )
          .map(
            (assignment) =>
              fieldAreaLabel(
                assignment.turf_name,
                "Unassigned turf",
              ),
          ),
      ),
    ].sort(
      (left, right) =>
        left.localeCompare(
          right,
        ),
    );

  const turfAssignments =
    assignments.filter(
      (assignment) => {
        const precinct =
          fieldAreaLabel(
            assignment.precinct,
            "Unassigned precinct",
          );

        const turfName =
          fieldAreaLabel(
            assignment.turf_name,
            "Unassigned turf",
          );

        if (
          turfPrecinctFilter !==
            "all" &&
          precinct !==
            turfPrecinctFilter
        ) {
          return false;
        }

        if (
          turfNameFilter !==
            "all" &&
          turfName !==
            turfNameFilter
        ) {
          return false;
        }

        if (
          turfWorkType ===
            "original" &&
          assignment
            .source_assignment_id
        ) {
          return false;
        }

        if (
          turfWorkType ===
            "follow_up" &&
          !assignment
            .source_assignment_id
        ) {
          return false;
        }

        if (
          !matchesPerformanceStatus(
            assignment,
            turfStatus,
          )
        ) {
          return false;
        }

        const dateKey =
          performanceDateKey(
            assignment,
          );

        if (
          turfDateFrom &&
          (
            !dateKey ||
            dateKey <
              turfDateFrom
          )
        ) {
          return false;
        }

        if (
          turfDateTo &&
          (
            !dateKey ||
            dateKey >
              turfDateTo
          )
        ) {
          return false;
        }

        return true;
      },
    );

  const turfTotals =
    turfAssignments.reduce(
      (
        totals,
        assignment,
      ) =>
        addAssignmentPerformance(
          totals,
          assignment,
        ),
      emptyPerformanceTotals(),
    );

  const turfCompletionRate =
    percentage(
      turfTotals
        .recordedStops,
      turfTotals
        .totalStops,
    );

  const turfContactRate =
    percentage(
      turfTotals
        .contacted,
      turfTotals
        .recordedStops,
    );

  const turfPriorityBacklog =
    unresolvedPriorityCount(
      turfTotals,
    );

  const turfRows =
    (() => {
      const rowMap =
        new Map();

      turfAssignments.forEach(
        (assignment) => {
          const precinct =
            fieldAreaLabel(
              assignment.precinct,
              "Unassigned precinct",
            );

          const turfName =
            fieldAreaLabel(
              assignment.turf_name,
              "Unassigned turf",
            );

          const key =
            `${precinct}::${turfName}`;

          const row =
            rowMap.get(
              key,
            ) || {
              key,
              precinct,
              turfName,
              assignments: [],
              totals:
                emptyPerformanceTotals(),
            };

          row.assignments.push(
            assignment,
          );

          addAssignmentPerformance(
            row.totals,
            assignment,
          );

          rowMap.set(
            key,
            row,
          );
        },
      );

      return [
        ...rowMap.values(),
      ]
        .map(
          (row) => ({
            ...row,
            priority:
              turfPriorityLabel(
                row.totals,
              ),
            priorityScore:
              turfPriorityScore(
                row.totals,
              ),
            unresolved:
              unresolvedPriorityCount(
                row.totals,
              ),
          }),
        )
        .sort(
          (left, right) =>
            right.priorityScore -
              left.priorityScore ||
            right.totals
              .pendingStops -
              left.totals
                .pendingStops ||
            right.totals
              .totalStops -
              left.totals
                .totalStops ||
            left.precinct
              .localeCompare(
                right.precinct,
              ) ||
            left.turfName
              .localeCompare(
                right.turfName,
              ),
        );
    })();

  const turfPriorityAssignments =
    turfAssignments
      .filter(
        (assignment) =>
          assignmentPriorityScore(
            assignment,
          ) > 0,
      )
      .slice()
      .sort(
        (left, right) =>
          assignmentPriorityScore(
            right,
          ) -
            assignmentPriorityScore(
              left,
            ) ||
          new Date(
            right.updated_at ||
              right.created_at ||
              0,
          ).getTime() -
            new Date(
              left.updated_at ||
                left.created_at ||
                0,
            ).getTime(),
      );

  const turfPlannerRow =
    turfRows.find(
      (row) =>
        row.key ===
        turfPlannerRowKey,
    ) ||
    null;

  const turfPlannerCandidates =
    turfPlannerRow
      ? turfActionCandidateRecords(
          turfPlannerRow
            .assignments,
          followedUpSourceIds,
        )
      : [];

  const turfPlannerSelectedCandidates =
    turfPlannerCandidates.filter(
      (candidate) =>
        candidate.selectable &&
        turfPlannerStopIds
          .includes(
            candidate.stop.id,
          ),
    );

  const turfPlannerSelectedGroupCount =
    new Set(
      turfPlannerSelectedCandidates
        .map(
          (candidate) =>
            candidate
              .assignment
              .id,
        ),
    ).size;

  const turfPlannerGroups =
    (() => {
      const groupMap =
        new Map();

      turfPlannerCandidates.forEach(
        (candidate) => {
          const assignmentId =
            candidate
              .assignment
              .id;

          const group =
            groupMap.get(
              assignmentId,
            ) || {
              assignment:
                candidate
                  .assignment,
              candidates: [],
            };

          group.candidates.push(
            candidate,
          );

          groupMap.set(
            assignmentId,
            group,
          );
        },
      );

      return [
        ...groupMap.values(),
      ];
    })();

  const turfPlannerActivePendingCount =
    turfPlannerCandidates.filter(
      (candidate) =>
        candidate
          .availability ===
        "active_pending",
    ).length;

  const commandBoardToday =
    commandBoardTodayKey();

  const commandBoardThroughDate =
    commandBoardShiftDate(
      commandBoardDate,
      7,
    );

  const commandBoardSelectedAssignments =
    assignments
      .filter(
        (assignment) =>
          commandBoardAssignmentDateKey(
            assignment,
          ) ===
          commandBoardDate,
      )
      .slice()
      .sort(
        commandBoardAssignmentSort,
      );

  const commandBoardStatusGroups =
    [
      {
        key: "scheduled",
        label: "Scheduled",
        description:
          "Assigned or accepted",
        assignments:
          commandBoardSelectedAssignments.filter(
            (assignment) =>
              commandBoardStatusGroup(
                assignment,
              ) ===
              "scheduled",
          ),
      },
      {
        key: "in_progress",
        label: "In progress",
        description:
          "Active in the field",
        assignments:
          commandBoardSelectedAssignments.filter(
            (assignment) =>
              commandBoardStatusGroup(
                assignment,
              ) ===
              "in_progress",
          ),
      },
      {
        key: "completed",
        label: "Completed",
        description:
          "Field work finished",
        assignments:
          commandBoardSelectedAssignments.filter(
            (assignment) =>
              commandBoardStatusGroup(
                assignment,
              ) ===
              "completed",
          ),
      },
      {
        key: "cancelled",
        label: "Cancelled",
        description:
          "No longer active",
        assignments:
          commandBoardSelectedAssignments.filter(
            (assignment) =>
              commandBoardStatusGroup(
                assignment,
              ) ===
              "cancelled",
          ),
      },
    ];

  const commandBoardUpcomingAssignments =
    assignments
      .filter(
        (assignment) => {
          const dateKey =
            commandBoardAssignmentDateKey(
              assignment,
            );

          return (
            dateKey >
              commandBoardDate &&
            dateKey <=
              commandBoardThroughDate &&
            ![
              "completed",
              "cancelled",
            ].includes(
              assignment.status,
            )
          );
        },
      )
      .slice()
      .sort(
        (
          left,
          right,
        ) =>
          commandBoardAssignmentDateKey(
            left,
          ).localeCompare(
            commandBoardAssignmentDateKey(
              right,
            ),
          ) ||
          commandBoardAssignmentSort(
            left,
            right,
          ),
      );

  const commandBoardUndatedAssignments =
    assignments
      .filter(
        (assignment) =>
          !commandBoardAssignmentDateKey(
            assignment,
          ) &&
          ![
            "completed",
            "cancelled",
          ].includes(
            assignment.status,
          ),
      )
      .slice()
      .sort(
        commandBoardAssignmentSort,
      );

  const commandBoardUnassignedAssignments =
    assignments
      .filter(
        (assignment) =>
          !assignment
            .volunteer_user_id &&
          ![
            "completed",
            "cancelled",
          ].includes(
            assignment.status,
          ),
      )
      .slice()
      .sort(
        (
          left,
          right,
        ) =>
          (
            commandBoardAssignmentDateKey(
              left,
            ) ||
            "9999-12-31"
          ).localeCompare(
            commandBoardAssignmentDateKey(
              right,
            ) ||
              "9999-12-31",
          ) ||
          commandBoardAssignmentSort(
            left,
            right,
          ),
      );

  const commandBoardOverdueAssignments =
    assignments
      .filter(
        (assignment) => {
          const dateKey =
            commandBoardAssignmentDateKey(
              assignment,
            );

          return (
            Boolean(
              dateKey,
            ) &&
            dateKey <
              commandBoardDate &&
            ![
              "completed",
              "cancelled",
            ].includes(
              assignment.status,
            ) &&
            completionSummary(
              assignment,
            ).totals
              .pending >
              0
          );
        },
      )
      .slice()
      .sort(
        (
          left,
          right,
        ) =>
          commandBoardAssignmentDateKey(
            left,
          ).localeCompare(
            commandBoardAssignmentDateKey(
              right,
            ),
          ),
      );

  const commandBoardReviewQueue =
    assignments
      .filter(
        (assignment) => {
          const summary =
            completionSummary(
              assignment,
            );

          return (
            assignment.status ===
              "completed" &&
            summary.total >
              0 &&
            summary.totals
              .pending ===
              0 &&
            completionReview(
              assignment,
            ).review_status !==
              "reviewed"
          );
        },
      )
      .slice()
      .sort(
        (
          left,
          right,
        ) =>
          (
            commandBoardAssignmentDateKey(
              right,
            ) ||
            ""
          ).localeCompare(
            commandBoardAssignmentDateKey(
              left,
            ) ||
              "",
          ),
      );

  const commandBoardFollowUpOpportunities =
    assignments
      .map(
        (assignment) => ({
          assignment,
          availableStops:
            commandBoardAvailableFollowUpCount(
              assignment,
              followedUpSourceIds,
            ),
        }),
      )
      .filter(
        (record) =>
          record.availableStops >
          0,
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.availableStops -
            left.availableStops ||
          (
            commandBoardAssignmentDateKey(
              right.assignment,
            ) ||
            ""
          ).localeCompare(
            commandBoardAssignmentDateKey(
              left.assignment,
            ) ||
              "",
          ),
      );

  const commandBoardSelectedPendingStops =
    commandBoardSelectedAssignments
      .reduce(
        (
          total,
          assignment,
        ) =>
          total +
          completionSummary(
            assignment,
          ).totals
            .pending,
        0,
      );

  const commandBoardAttentionAssignments =
    new Set([
      ...commandBoardUnassignedAssignments
        .map(
          (assignment) =>
            assignment.id,
        ),
      ...commandBoardOverdueAssignments
        .map(
          (assignment) =>
            assignment.id,
        ),
      ...commandBoardReviewQueue
        .map(
          (assignment) =>
            assignment.id,
        ),
      ...commandBoardFollowUpOpportunities
        .map(
          (record) =>
            record.assignment.id,
        ),
    ]).size;

  const fieldAlertNow =
    new Date();

  const fieldAlertNowMs =
    fieldAlertNow.getTime();

  const fieldAlertToday =
    commandBoardLocalDateKey(
      fieldAlertNow,
    );

  const fieldAlertThrough =
    commandBoardShiftDate(
      fieldAlertToday,
      7,
    );

  const fieldAlertReviewIds =
    new Set(
      commandBoardReviewQueue
        .map(
          (assignment) =>
            assignment.id,
        ),
    );

  const fieldAlertFollowUpMap =
    new Map(
      commandBoardFollowUpOpportunities
        .map(
          (record) => [
            record.assignment.id,
            record.availableStops,
          ],
        ),
    );

  const fieldAlertRecords =
    assignments
      .filter(
        (assignment) =>
          assignment.status !==
          "cancelled",
      )
      .map(
        (assignment) => {
          const summary =
            completionSummary(
              assignment,
            );

          const dateKey =
            commandBoardAssignmentDateKey(
              assignment,
            );

          const shiftTime =
            fieldAlertShiftTime(
              assignment,
            );

          const isActive =
            ![
              "completed",
              "cancelled",
            ].includes(
              assignment.status,
            );

          const reasons = [];

          if (
            isActive &&
            !assignment
              .volunteer_user_id
          ) {
            reasons.push({
              key: "unassigned",
              severity:
                "critical",
            });
          }

          if (
            isActive &&
            dateKey &&
            dateKey <
              fieldAlertToday &&
            summary.totals
              .pending >
              0
          ) {
            reasons.push({
              key: "overdue",
              severity:
                "critical",
              count:
                summary.totals
                  .pending,
            });
          }

          if (
            isActive &&
            shiftTime !==
              null &&
            shiftTime >=
              fieldAlertNowMs &&
            shiftTime <=
              fieldAlertNowMs +
                4 *
                  60 *
                  60 *
                  1000
          ) {
            reasons.push({
              key:
                "starting_soon",
              severity:
                "critical",
            });
          }

          if (
            fieldAlertReviewIds
              .has(
                assignment.id,
              )
          ) {
            reasons.push({
              key:
                "review_waiting",
              severity:
                "attention",
            });
          }

          const availableStops =
            fieldAlertFollowUpMap
              .get(
                assignment.id,
              ) ||
            0;

          if (
            availableStops >
            0
          ) {
            reasons.push({
              key: "follow_up",
              severity:
                "attention",
              count:
                availableStops,
            });
          }

          if (
            isActive &&
            dateKey &&
            !assignment
              .shift_starts_at
          ) {
            reasons.push({
              key:
                "time_unscheduled",
              severity:
                "attention",
            });
          }

          if (
            isActive &&
            !dateKey
          ) {
            reasons.push({
              key:
                "needs_scheduling",
              severity:
                "attention",
            });
          }

          const isUpcoming =
            isActive &&
            Boolean(
              dateKey,
            ) &&
            dateKey >=
              fieldAlertToday &&
            dateKey <=
              fieldAlertThrough;

          if (
            !reasons.length &&
            isUpcoming
          ) {
            reasons.push({
              key: "upcoming",
              severity:
                "upcoming",
            });
          }

          if (
            !reasons.length
          ) {
            return null;
          }

          const category =
            reasons.some(
              (reason) =>
                reason.severity ===
                "critical",
            )
              ? "critical"
              : reasons.some(
                    (reason) =>
                      reason.severity ===
                      "attention",
                  )
                ? "attention"
                : "upcoming";

          return {
            assignment,
            summary,
            reasons,
            category,
            dateKey,
            shiftTime,
            availableStops,
          };
        },
      )
      .filter(Boolean)
      .sort(
        (
          left,
          right,
        ) => {
          const categoryOrder = {
            critical: 0,
            attention: 1,
            upcoming: 2,
          };

          return (
            categoryOrder[
              left.category
            ] -
              categoryOrder[
                right.category
              ] ||
            (
              left.dateKey ||
              "9999-12-31"
            ).localeCompare(
              right.dateKey ||
                "9999-12-31",
            ) ||
            commandBoardAssignmentSort(
              left.assignment,
              right.assignment,
            )
          );
        },
      );

  const fieldAlertGroups =
    [
      {
        key: "critical",
        label: "Critical",
        description:
          "Resolve before field deployment",
        records:
          fieldAlertRecords.filter(
            (record) =>
              record.category ===
              "critical",
          ),
      },
      {
        key: "attention",
        label:
          "Needs attention",
        description:
          "Leadership action is required",
        records:
          fieldAlertRecords.filter(
            (record) =>
              record.category ===
              "attention",
          ),
      },
      {
        key: "upcoming",
        label: "Upcoming",
        description:
          "Scheduled in the next seven days",
        records:
          fieldAlertRecords.filter(
            (record) =>
              record.category ===
              "upcoming",
          ),
      },
    ];

  const fieldAlertCriticalCount =
    fieldAlertGroups[0]
      .records.length;

  const fieldAlertAttentionCount =
    fieldAlertGroups[1]
      .records.length;

  const fieldAlertUpcomingCount =
    fieldAlertGroups[2]
      .records.length;

  const fieldAlertActiveCount =
    fieldAlertCriticalCount +
    fieldAlertAttentionCount;


  const readinessRecords =
    assignments
      .filter(
        (assignment) =>
          READINESS_ACTIVE_STATUSES
            .has(
              assignment.status,
            ),
      )
      .map(
        (assignment) =>
          readinessRecord(
            assignment,
          ),
      )
      .sort(
        (
          left,
          right,
        ) => {
          const groupOrder = {
            blocked: 0,
            attention: 1,
            ready: 2,
            in_progress: 3,
          };

          return (
            groupOrder[
              left.group
            ] -
              groupOrder[
                right.group
              ] ||
            commandBoardAssignmentSort(
              left.assignment,
              right.assignment,
            )
          );
        },
      );

  const readinessGroups =
    [
      {
        key: "blocked",
        label: "Blocked",
        description:
          "Resolve before assigning field work",
        records:
          readinessRecords.filter(
            (record) =>
              record.group ===
              "blocked",
          ),
      },
      {
        key: "attention",
        label:
          "Needs attention",
        description:
          "Deployable after recommended fixes",
        records:
          readinessRecords.filter(
            (record) =>
              record.group ===
              "attention",
          ),
      },
      {
        key: "ready",
        label: "Ready",
        description:
          "Prepared for Volunteer deployment",
        records:
          readinessRecords.filter(
            (record) =>
              record.group ===
              "ready",
          ),
      },
      {
        key: "in_progress",
        label:
          "Deployment started",
        description:
          "Assignment is already in progress",
        records:
          readinessRecords.filter(
            (record) =>
              record.group ===
              "in_progress",
          ),
      },
    ];

  const readinessBlockedCount =
    readinessGroups[0]
      .records.length;

  const readinessAttentionCount =
    readinessGroups[1]
      .records.length;

  const readinessReadyCount =
    readinessGroups[2]
      .records.length;

  const readinessInProgressCount =
    readinessGroups[3]
      .records.length;

  const readinessIssueCount =
    readinessBlockedCount +
    readinessAttentionCount;

  const handoffAssignment =
    assignments.find(
      (assignment) =>
        assignment.id ===
        handoffAssignmentId,
    ) ||
    null;

  const handoffReadiness =
    handoffAssignment
      ? readinessRecord(
          handoffAssignment,
        )
      : null;

  const handoffLatest =
    latestDeploymentHandoff(
      handoffAssignment,
    );

  const handoffState =
    deploymentHandoffState(
      handoffLatest,
    );

  const handoffCanSend =
    Boolean(
      handoffAssignment &&
        handoffReadiness &&
        !handoffReadiness
          .blockers.length &&
        ![
          "completed",
          "cancelled",
        ].includes(
          handoffAssignment.status,
        ),
    );

  const isLoading =
    membersLoading ||
    assignmentsLoading;

  const visibleError =
    formError ||
    assignmentsError ||
    membersError;

  const openLinkedAssignment =
    (assignmentId) => {
      if (!assignmentId) {
        return;
      }

      setSearchTerm("");
      setStatusFilter("all");
      setSelectedAssignmentId(
        assignmentId,
      );
      setReviewAssignmentId(
        "",
      );
      setReviewNotes("");
      setReviewError("");
      setReviewAction("");
      setFollowUpAssignmentId(
        "",
      );
      setFollowUpStopIds([]);
      setFollowUpForm(
        EMPTY_FOLLOW_UP,
      );
      setFollowUpError("");
      setFollowUpAction("");

      window.setTimeout(
        () => {
          document
            .querySelector(
              `.${styles.detailPanel}`,
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
        },
        0,
      );
    };

  const openPerformanceAssignment =
    (assignmentId) => {
      setPerformanceOpen(
        false,
      );

      openLinkedAssignment(
        assignmentId,
      );
    };

  const resetPerformanceFilters =
    () => {
      setPerformanceVolunteerId(
        "all",
      );
      setPerformanceStatus(
        "all",
      );
      setPerformanceWorkType(
        "all",
      );
      setPerformanceDateFrom(
        "",
      );
      setPerformanceDateTo(
        "",
      );
    };

  const resetTurfFilters =
    () => {
      setTurfPrecinctFilter(
        "all",
      );
      setTurfNameFilter(
        "all",
      );
      setTurfStatus(
        "all",
      );
      setTurfWorkType(
        "all",
      );
      setTurfDateFrom(
        "",
      );
      setTurfDateTo(
        "",
      );
    };

  const focusTurfArea =
    (row) => {
      setTurfPrecinctFilter(
        row.precinct,
      );
      setTurfNameFilter(
        row.turfName,
      );
    };

  const openTurfAssignment =
    (assignmentId) => {
      setTurfOpen(
        false,
      );

      openLinkedAssignment(
        assignmentId,
      );
    };

  const openTurfActionPlanner =
    (row) => {
      const candidates =
        turfActionCandidateRecords(
          row.assignments,
          followedUpSourceIds,
        );

      const selectable =
        candidates.filter(
          (candidate) =>
            candidate.selectable,
        );

      if (!selectable.length) {
        window.alert(
          "This area has no reviewed source stops available for a new route. Pending stops remain active in their current assignments, and completed work must be reviewed first.",
        );
        return;
      }

      const selectedIds =
        selectable
          .filter(
            (candidate) =>
              candidate.suggested,
          )
          .map(
            (candidate) =>
              candidate.stop.id,
          );

      const volunteerIds =
        [
          ...new Set(
            row.assignments
              .map(
                (assignment) =>
                  assignment
                    .volunteer_user_id,
              )
              .filter(Boolean),
          ),
        ];

      const sharedVolunteerId =
        volunteerIds.length ===
          1 &&
        volunteers.some(
          (volunteer) =>
            volunteer.userId ===
            volunteerIds[0],
        )
          ? volunteerIds[0]
          : "";

      const meetingLocations =
        [
          ...new Set(
            row.assignments
              .map(
                (assignment) =>
                  String(
                    assignment
                      .meeting_location ||
                      "",
                  ).trim(),
              )
              .filter(Boolean),
          ),
        ];

      setTurfPlannerRowKey(
        row.key,
      );
      setTurfPlannerStopIds(
        selectedIds,
      );
      setTurfPlannerForm({
        title:
          `${row.turfName} turf action route`,
        volunteerUserId:
          sharedVolunteerId,
        assignmentDate:
          "",
        meetingLocation:
          meetingLocations.length ===
            1
            ? meetingLocations[0]
            : "",
        instructions:
          `Priority field work planned from ${row.precinct} - ${row.turfName}.`,
        finishMode:
          "final_stop",
      });
      setTurfPlannerError("");
      setTurfPlannerAction("");
      setTurfOpen(false);
    };

  const openDailyCommandBoard =
    () => {
      setCommandBoardDate(
        commandBoardTodayKey(),
      );
      setCommandBoardOpen(
        true,
      );
    };

  const openFieldAlerts =
    () => {
      setAlertsOpen(
        true,
      );
    };

  const openAlertAssignment =
    (assignmentId) => {
      setAlertsOpen(
        false,
      );

      openLinkedAssignment(
        assignmentId,
      );
    };

  const openAlertReview =
    (assignment) => {
      setAlertsOpen(
        false,
      );

      openCompletionReview(
        assignment,
      );
    };

  const openAlertTurfPlanner =
    (assignment) => {
      setAlertsOpen(
        false,
      );

      openCommandBoardTurfPlanner(
        assignment,
      );
    };

  const openAlertsCommandBoard =
    () => {
      setAlertsOpen(
        false,
      );

      openDailyCommandBoard();
    };

  const openAlertsReadiness =
    () => {
      setAlertsOpen(
        false,
      );
      setReadinessOpen(
        true,
      );
    };

  const openReadinessAssignment =
    (assignmentId) => {
      setReadinessOpen(
        false,
      );

      openLinkedAssignment(
        assignmentId,
      );
    };

  const editReadinessAssignment =
    (assignment) => {
      setReadinessOpen(
        false,
      );
      openLinkedAssignment(
        assignment.id,
      );
      openAssignmentEdit(
        assignment,
      );
    };

  const locateReadinessStops =
    async (record) => {
      if (
        !record
          .missingCoordinateRoutes
          .length
      ) {
        window.alert(
          "Every stop already has map coordinates.",
        );
        return;
      }

      setReadinessActionId(
        record.assignment.id,
      );
      setFormError("");

      let updated = 0;
      let unmatched = 0;
      let failed = 0;
      let remaining = 0;

      try {
        for (
          const route
          of record
            .missingCoordinateRoutes
        ) {
          const result =
            await geocodeRouteWithProgress(
              route.id,
            );

          updated +=
            Number(
              result.updated ||
                0,
            );

          unmatched +=
            Number(
              result.unmatched ||
                0,
            );

          failed +=
            Number(
              result.failed ||
                0,
            );

          remaining +=
            Number(
              result.remaining ||
                0,
            );
        }

        window.alert(
          [
            `${updated} ${
              updated === 1
                ? "stop was"
                : "stops were"
            } located and saved.`,
            unmatched
              ? `${unmatched} ${
                  unmatched === 1
                    ? "address had"
                    : "addresses had"
                } no Census match.`
              : "",
            failed
              ? `${failed} ${
                  failed === 1
                    ? "address failed"
                    : "addresses failed"
                } and was not changed.`
              : "",
            remaining
              ? `${remaining} additional ${
                  remaining === 1
                    ? "stop remains"
                    : "stops remain"
                }; run Locate stops again.`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        );
      } catch {
        // The hook displays the secure geocoding error.
      } finally {
        setReadinessActionId(
          "",
        );
      }
    };

  const reviewReadinessOrder =
    (record) => {
      const route =
        record
          .firstOrderIssueRoute;

      if (!route) {
        window.alert(
          "Route and stop ordering are already valid.",
        );
        return;
      }

      setReadinessOpen(
        false,
      );
      openLinkedAssignment(
        record.assignment.id,
      );

      window.setTimeout(
        () => {
          if (
            record
              .routeOrderInvalid
          ) {
            openRouteEdit(
              route,
            );
            return;
          }

          openManualOrder(
            route,
          );
        },
        0,
      );
    };

  const openReadinessAlerts =
    () => {
      setReadinessOpen(
        false,
      );
      setAlertsOpen(
        true,
      );
    };

  const openDeploymentHandoff =
    (assignment) => {
      if (!assignment?.id) {
        return;
      }

      setReadinessOpen(
        false,
      );
      setHandoffAssignmentId(
        assignment.id,
      );
      setHandoffError("");
      setHandoffAction("");
      setHandoffOpen(
        true,
      );
    };

  const closeDeploymentHandoff =
    () => {
      setHandoffOpen(
        false,
      );
      setHandoffAssignmentId(
        "",
      );
      setHandoffError("");
      setHandoffAction("");
    };

  const openHandoffReadiness =
    () => {
      closeDeploymentHandoff();
      setReadinessOpen(
        true,
      );
    };

  const submitDeploymentHandoff =
    async () => {
      if (
        !handoffAssignment ||
        !handoffCanSend
      ) {
        return;
      }

      setHandoffAction(
        "send",
      );
      setHandoffError("");

      try {
        await sendDeploymentHandoff(
          handoffAssignment.id,
        );
      } catch (error) {
        setHandoffError(
          error?.message ||
            "The deployment handoff could not be sent.",
        );
      } finally {
        setHandoffAction(
          "",
        );
      }
    };

  const clearDeploymentHandoff =
    async () => {
      if (
        !handoffAssignment ||
        !handoffLatest ||
        handoffLatest.invalidated_at
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          "Reset this deployment handoff? The Volunteer will no longer be able to acknowledge the current cycle.",
        );

      if (!confirmed) {
        return;
      }

      setHandoffAction(
        "reset",
      );
      setHandoffError("");

      try {
        await resetDeploymentHandoff(
          handoffAssignment.id,
        );
      } catch (error) {
        setHandoffError(
          error?.message ||
            "The deployment handoff could not be reset.",
        );
      } finally {
        setHandoffAction(
          "",
        );
      }
    };

  const openCommandBoardAssignment =
    (assignmentId) => {
      setCommandBoardOpen(
        false,
      );

      openLinkedAssignment(
        assignmentId,
      );
    };

  const openCommandBoardReview =
    (assignment) => {
      setCommandBoardOpen(
        false,
      );

      openCompletionReview(
        assignment,
      );
    };

  const openCommandBoardTurfPlanner =
    (assignment) => {
      const precinct =
        fieldAreaLabel(
          assignment.precinct,
          "Unassigned precinct",
        );

      const turfName =
        fieldAreaLabel(
          assignment.turf_name,
          "Unassigned turf",
        );

      const areaAssignments =
        assignments.filter(
          (candidate) =>
            fieldAreaLabel(
              candidate.precinct,
              "Unassigned precinct",
            ) ===
              precinct &&
            fieldAreaLabel(
              candidate.turf_name,
              "Unassigned turf",
            ) ===
              turfName,
        );

      const row = {
        key:
          `${precinct}::${turfName}`,
        precinct,
        turfName,
        assignments:
          areaAssignments,
      };

      const hasAvailableStops =
        turfActionCandidateRecords(
          areaAssignments,
          followedUpSourceIds,
        ).some(
          (candidate) =>
            candidate.selectable,
        );

      if (!hasAvailableStops) {
        window.alert(
          "This area has no reviewed source stops available for another route.",
        );
        return;
      }

      setCommandBoardOpen(
        false,
      );

      openTurfActionPlanner(
        row,
      );
    };

  const closeTurfActionPlanner =
    () => {
      if (isSaving) {
        return;
      }

      setTurfPlannerRowKey("");
      setTurfPlannerStopIds([]);
      setTurfPlannerForm(
        EMPTY_TURF_ACTION_PLAN,
      );
      setTurfPlannerError("");
      setTurfPlannerAction("");
      setTurfOpen(true);
    };

  const toggleTurfPlannerStop =
    (stopId) => {
      setTurfPlannerStopIds(
        (current) =>
          current.includes(
            stopId,
          )
            ? current.filter(
                (id) =>
                  id !== stopId,
              )
            : [
                ...current,
                stopId,
              ],
      );
    };

  const openTurfPlannerSource =
    (assignmentId) => {
      setTurfPlannerRowKey("");
      setTurfPlannerStopIds([]);
      setTurfPlannerForm(
        EMPTY_TURF_ACTION_PLAN,
      );
      setTurfPlannerError("");
      setTurfPlannerAction("");
      setTurfOpen(false);

      openLinkedAssignment(
        assignmentId,
      );
    };

  const submitTurfActionPlan =
    async (event) => {
      event.preventDefault();

      if (!turfPlannerRow) {
        return;
      }

      setTurfPlannerError("");

      const title =
        turfPlannerForm
          .title
          .trim();

      if (!title) {
        setTurfPlannerError(
          "Enter a Turf Action Plan title.",
        );
        return;
      }

      if (
        turfPlannerForm
          .finishMode ===
          "meeting_point" &&
        !turfPlannerForm
          .meetingLocation
          .trim()
      ) {
        setTurfPlannerError(
          "Add a meeting point before choosing Return to meeting point.",
        );
        return;
      }

      const selectedCandidates =
        turfPlannerCandidates.filter(
          (candidate) =>
            candidate.selectable &&
            turfPlannerStopIds
              .includes(
                candidate.stop.id,
              ),
        );

      if (!selectedCandidates.length) {
        setTurfPlannerError(
          "Choose at least one reviewed source stop for the Turf Action Plan.",
        );
        return;
      }

      const groupMap =
        new Map();

      selectedCandidates.forEach(
        (candidate) => {
          const assignment =
            candidate
              .assignment;

          const group =
            groupMap.get(
              assignment.id,
            ) || {
              assignment,
              sourceStopIds: [],
            };

          group.sourceStopIds.push(
            candidate.stop.id,
          );

          groupMap.set(
            assignment.id,
            group,
          );
        },
      );

      const sourceGroups =
        [
          ...groupMap.values(),
        ];

      const groups =
        sourceGroups.map(
          (
            group,
            index,
          ) => ({
            sourceAssignmentId:
              group.assignment.id,
            sourceStopIds:
              group.sourceStopIds,
            title:
              sourceGroups.length ===
                1
                ? title
                : `${title} - ${group.assignment.title}`.slice(
                    0,
                    160,
                  ),
            order:
              index + 1,
          }),
        );

      const approved =
        window.confirm(
          [
            `Create "${title}"?`,
            "",
            `${selectedCandidates.length} reviewed ${
              selectedCandidates.length ===
              1
                ? "stop"
                : "stops"
            } will become new pending work.`,
            `${groups.length} lineage-safe ${
              groups.length ===
              1
                ? "assignment will"
                : "assignments will"
            } be created because each generated assignment keeps one direct source assignment.`,
            turfPlannerForm
              .volunteerUserId
              ? "The selected Volunteer will see every new assignment."
              : "The new assignments will remain unassigned until leadership assigns a Volunteer.",
            turfPlannerActivePendingCount
              ? `${turfPlannerActivePendingCount} pending ${
                  turfPlannerActivePendingCount ===
                  1
                    ? "stop remains"
                    : "stops remain"
                } in existing active work and will not be duplicated.`
              : "",
            "",
            "Original results, Volunteer notes, completion times and reviews will not change.",
            "The complete plan is created in one database transaction.",
            "",
            "Create this Turf Action Plan?",
          ]
            .filter(Boolean)
            .join("\n"),
        );

      if (!approved) {
        return;
      }

      setTurfPlannerAction(
        "creating",
      );

      try {
        const created =
          await createTurfActionPlan({
            groups,
            volunteerUserId:
              turfPlannerForm
                .volunteerUserId ||
              null,
            assignmentDate:
              turfPlannerForm
                .assignmentDate ||
              null,
            meetingLocation:
              turfPlannerForm
                .meetingLocation
                .trim(),
            instructions:
              turfPlannerForm
                .instructions
                .trim(),
            finishMode:
              turfPlannerForm
                .finishMode,
          });

        setTurfPlannerRowKey("");
        setTurfPlannerStopIds([]);
        setTurfPlannerForm(
          EMPTY_TURF_ACTION_PLAN,
        );
        setTurfPlannerError("");
        setTurfPlannerAction("");
        setTurfOpen(false);
        setPerformanceOpen(false);
        setStatusFilter(
          "active",
        );

        if (
          created[0]
            ?.created_assignment_id
        ) {
          setSelectedAssignmentId(
            created[0]
              .created_assignment_id,
          );
        }

        const createdStops =
          created.reduce(
            (
              total,
              record,
            ) =>
              total +
              Number(
                record
                  .created_stop_count ||
                  0,
              ),
            0,
          );

        window.alert(
          `${created.length} ${
            created.length ===
            1
              ? "assignment"
              : "assignments"
          } and ${createdStops} pending ${
            createdStops ===
            1
              ? "stop was"
              : "stops were"
          } created. The original field records remain unchanged.`,
        );
      } catch (error) {
        setTurfPlannerError(
          error.message ||
            "The Turf Action Plan could not be created.",
        );
        setTurfPlannerAction("");
      }
    };

  const closeEditor =
    () => {
      if (isSaving) {
        return;
      }

      setEditorType("");
      setFormError("");
    };

  const openAssignmentCreate =
    () => {
      setAssignmentForm({
        ...EMPTY_ASSIGNMENT,
        volunteerUserId:
          volunteers[0]
            ?.userId ||
          "",
      });

      setFormError("");
      setEditorType(
        "assignment",
      );
    };

  const openAssignmentEdit =
    (assignment) => {
      setAssignmentForm(
        assignmentFormFrom(
          assignment,
        ),
      );

      setFormError("");
      setEditorType(
        "assignment",
      );
    };

  const openRouteCreate =
    (assignment) => {
      const routes =
        assignment
          .field_routes ||
        [];

      const nextOrder =
        routes.reduce(
          (
            maximum,
            route,
          ) =>
            Math.max(
              maximum,
              Number(
                route.route_order ||
                  0,
              ),
            ),
          0,
        ) + 1;

      setRouteForm({
        ...EMPTY_ROUTE,
        routeOrder:
          nextOrder,
        name:
          `Route ${nextOrder}`,
      });

      setFormError("");
      setEditorType(
        "route",
      );
    };

  const openRouteEdit =
    (route) => {
      setRouteForm(
        routeFormFrom(route),
      );

      setFormError("");
      setEditorType(
        "route",
      );
    };

  const openStopCreate =
    (route) => {
      const stops =
        route.field_stops ||
        [];

      const nextOrder =
        stops.reduce(
          (
            maximum,
            stop,
          ) =>
            Math.max(
              maximum,
              Number(
                stop.stop_order ||
                  0,
              ),
            ),
          0,
        ) + 1;

      setStopForm({
        ...EMPTY_STOP,
        routeId:
          route.id,
        stopOrder:
          nextOrder,
      });

      setFormError("");
      setEditorType(
        "stop",
      );
    };

  const openStopEdit =
    (
      stop,
      routeId,
    ) => {
      setStopForm(
        stopFormFrom(
          stop,
          routeId,
        ),
      );

      setFormError("");
      setEditorType(
        "stop",
      );
    };

  const submitAssignment =
    async (event) => {
      event.preventDefault();
      setFormError("");

      if (
        !assignmentForm
          .volunteerUserId
      ) {
        setFormError(
          "Choose an active Volunteer.",
        );
        return;
      }

      if (
        !assignmentForm
          .title
          .trim()
      ) {
        setFormError(
          "Enter an assignment title.",
        );
        return;
      }

      const payload = {
        ...assignmentForm,
        title:
          assignmentForm
            .title
            .trim(),
        shiftStartsAt:
          toIso(
            assignmentForm
              .shiftStartsAt,
          ),
        shiftEndsAt:
          toIso(
            assignmentForm
              .shiftEndsAt,
          ),
      };

      try {
        if (
          assignmentForm.id
        ) {
          const updated =
            await updateAssignment(
              assignmentForm.id,
              payload,
            );

          setSelectedAssignmentId(
            updated.id,
          );
        } else {
          const created =
            await createAssignment(
              payload,
            );

          setSelectedAssignmentId(
            created.id,
          );
        }

        setEditorType("");
      } catch (error) {
        setFormError(
          error.message,
        );
      }
    };

  const submitRoute =
    async (event) => {
      event.preventDefault();
      setFormError("");

      if (
        !selectedAssignment
      ) {
        setFormError(
          "Choose an assignment first.",
        );
        return;
      }

      if (
        !routeForm.name.trim()
      ) {
        setFormError(
          "Enter a route name.",
        );
        return;
      }

      if (
        routeForm.finishMode ===
          "meeting_point" &&
        !selectedAssignment
          .meeting_location
          ?.trim()
      ) {
        setFormError(
          "Add a meeting point to this assignment before choosing Return to meeting point.",
        );
        return;
      }

      const payload = {
        ...routeForm,
        name:
          routeForm.name.trim(),
        routeOrder:
          Number(
            routeForm.routeOrder,
          ),
      };

      try {
        if (routeForm.id) {
          await updateRoute(
            routeForm.id,
            payload,
          );
        } else {
          await createRoute(
            selectedAssignment.id,
            payload,
          );
        }

        setEditorType("");
      } catch (error) {
        setFormError(
          error.message,
        );
      }
    };

  const submitStop =
    async (event) => {
      event.preventDefault();
      setFormError("");

      if (
        !stopForm
          .addressLine1
          .trim()
      ) {
        setFormError(
          "Enter the street address.",
        );
        return;
      }

      if (
        !stopForm.city.trim()
      ) {
        setFormError(
          "Enter the city.",
        );
        return;
      }

      const originalStop =
        stopForm.id
          ? allStops.find(
              (stop) =>
                stop.id ===
                stopForm.id,
            )
          : null;

      const payload = {
        ...stopForm,
        addressLine1:
          stopForm
            .addressLine1
            .trim(),
        city:
          stopForm
            .city
            .trim(),
        stopOrder:
          Number(
            stopForm.stopOrder,
          ),
      };

      const addressChanged =
        originalStop &&
        stopAddressSignature(
          originalStop,
        ) !==
          addressSignature(
            payload,
          );

      const coordinatesUnchanged =
        originalStop &&
        String(
          originalStop.latitude ??
            "",
        ) ===
          String(
            payload.latitude ??
              "",
          ) &&
        String(
          originalStop.longitude ??
            "",
        ) ===
          String(
            payload.longitude ??
              "",
          );

      if (
        addressChanged &&
        coordinatesUnchanged
      ) {
        payload.latitude = "";
        payload.longitude = "";
      }

      try {
        if (stopForm.id) {
          await updateStop(
            stopForm.id,
            payload,
          );
        } else {
          await createStop(
            stopForm.routeId,
            payload,
          );
        }

        setEditorType("");

        if (
          needsAutomaticGeocoding(
            payload,
          )
        ) {
          await automaticallyLocateRoute(
            stopForm.routeId,
          );
        }
      } catch (error) {
        setFormError(
          error.message,
        );
      }
    };

  const confirmDeleteAssignment =
    async (assignment) => {
      const approved =
        window.confirm(
          `Delete "${assignment.title}" and all of its routes and stops?`,
        );

      if (!approved) {
        return;
      }

      try {
        await deleteAssignment(
          assignment.id,
        );

        setSelectedAssignmentId(
          "",
        );
      } catch {
        // Hook displays the error.
      }
    };

  const confirmDeleteRoute =
    async (route) => {
      const approved =
        window.confirm(
          `Delete "${route.name}" and all of its stops?`,
        );

      if (!approved) {
        return;
      }

      try {
        await deleteRoute(
          route.id,
        );
      } catch {
        // Hook displays the error.
      }
    };

  const confirmDeleteStop =
    async (stop) => {
      const approved =
        window.confirm(
          `Delete ${getAddress(stop)}?`,
        );

      if (!approved) {
        return;
      }

      try {
        await deleteStop(
          stop.id,
        );
      } catch {
        // Hook displays the error.
      }
    };

  const geocodeRouteWithProgress =
    async (routeId) => {
      setGeocodingRouteId(
        routeId,
      );

      try {
        return await geocodeRoute(
          routeId,
        );
      } finally {
        setGeocodingRouteId(
          "",
        );
      }
    };

  const automaticallyLocateRoute =
    async (routeId) => {
      try {
        return await geocodeRouteWithProgress(
          routeId,
        );
      } catch {
        // The hook displays the secure function error without interrupting the save.
        return null;
      }
    };

  const importStopsAndLocate =
    async (
      routeId,
      rows,
    ) => {
      const inserted =
        await bulkCreateStops(
          routeId,
          rows,
        );

      const hasMissingCoordinates =
        rows.some(
          (row) =>
            needsAutomaticGeocoding(
              row,
            ),
        );

      if (
        hasMissingCoordinates
      ) {
        await automaticallyLocateRoute(
          routeId,
        );
      }

      return inserted;
    };

  const locateRouteStops =
    async (route) => {
      setFormError("");

      try {
        const result =
          await geocodeRouteWithProgress(
            route.id,
          );

        const message = [
          `${result.updated || 0} stops located and saved.`,
          result.unmatched
            ? `${result.unmatched} addresses had no Census match.`
            : "",
          result.failed
            ? `${result.failed} addresses failed and were not changed.`
            : "",
          result.remaining
            ? `${result.remaining} additional stops remain; run Locate stops again.`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        window.alert(
          message ||
            "No route stops needed coordinates.",
        );
      } catch {
        // The hook displays the secure function error.
      }
    };

  const optimizeRouteOrder =
    async (route) => {
      setFormError("");

      const current =
        sortedRouteStops(
          route,
        );

      const finishMode =
        routeFinishMode(
          route,
        );

      if (current.length < 3) {
        window.alert(
          "Add at least three stops before optimizing this route.",
        );
        return;
      }

      const missingCoordinates =
        current.filter(
          (stop) =>
            numericCoordinate(
              stop.latitude,
            ) === null ||
            numericCoordinate(
              stop.longitude,
            ) === null,
        );

      if (
        missingCoordinates.length
      ) {
        window.alert(
          `${missingCoordinates.length} ${
            missingCoordinates.length === 1
              ? "stop needs"
              : "stops need"
          } coordinates before this route can be optimized. Use Locate stops first.`,
        );
        return;
      }

      const optimized =
        optimizedRouteStops(
          route,
        );

      const sameOrder =
        current.every(
          (
            stop,
            index,
          ) =>
            stop.id ===
            optimized[index]
              ?.id,
        );

      const currentDistance =
        routeDistanceMiles(
          current,
          finishMode,
        );

      const optimizedDistance =
        routeDistanceMiles(
          optimized,
          finishMode,
        );

      const savings =
        Math.max(
          0,
          currentDistance -
            optimizedDistance,
        );

      const hasContiguousOrder =
        current.every(
          (
            stop,
            index,
          ) =>
            Number(
              stop.stop_order,
            ) ===
            index + 1,
        );

      if (
        sameOrder &&
        hasContiguousOrder
      ) {
        window.alert(
          "This route is already in the best local sequence Campaign HQ found while keeping the current first stop.",
        );
        return;
      }

      const preview =
        optimized
          .slice(
            0,
            20,
          )
          .map(
            (
              stop,
              index,
            ) =>
              `${index + 1}. ${stopName(
                stop,
              )}`,
          );

      if (
        optimized.length > 20
      ) {
        preview.push(
          `...and ${
            optimized.length -
            20
          } more stops`,
        );
      }

      const finishEstimateNote =
        finishMode ===
          "return_start"
          ? "The estimate includes the straight-line return to the starting stop."
          : finishMode ===
              "meeting_point"
            ? "Google Maps will return to the meeting point. This local estimate excludes that final leg because the meeting point is stored as an address, not map coordinates."
            : "The estimate ends at the final stop.";

      const approved =
        window.confirm(
          [
            `${sameOrder ? "Normalize" : "Optimize"} "${route.name}"?`,
            "",
            sameOrder
              ? "This route is already in the best local sequence. Campaign HQ will only renumber its stops cleanly from 1."
              : "Campaign HQ keeps the current first stop, then arranges the remaining stops using their saved coordinates.",
            "No addresses are sent to another routing provider.",
            finishEstimateNote,
            "",
            `Current straight-line distance: ${currentDistance.toFixed(
              2,
            )} miles`,
            `Suggested straight-line distance: ${optimizedDistance.toFixed(
              2,
            )} miles`,
            `Estimated reduction: ${savings.toFixed(
              2,
            )} miles`,
            "",
            "Suggested order:",
            ...preview,
            "",
            "Actual walking distance can differ. Save this sequence?",
          ].join("\n"),
        );

      if (!approved) {
        return;
      }

      setOptimizingRouteId(
        route.id,
      );

      try {
        await reorderRouteStops(
          route.id,
          optimized.map(
            (stop) =>
              stop.id,
          ),
        );

        window.alert(
          sameOrder
            ? "The route was already in the best sequence. Its stop numbers were normalized to start at 1, and every Campaign HQ view now uses the clean numbering."
            : "The optimized stop order was saved. The leadership map, Google Maps route link and Volunteer assignment now use the new sequence.",
        );
      } catch {
        // The hook displays the secure RPC error.
      } finally {
        setOptimizingRouteId(
          "",
        );
      }
    };

  const chooseStartingStop =
    async (
      route,
      selectedStop,
    ) => {
      setFormError("");

      const current =
        sortedRouteStops(
          route,
        );

      if (
        !current.length ||
        current[0]?.id ===
          selectedStop.id
      ) {
        window.alert(
          "This stop is already the starting stop.",
        );
        return;
      }

      const nextOrder = [
        selectedStop,
        ...current.filter(
          (stop) =>
            stop.id !==
            selectedStop.id,
        ),
      ];

      const preview =
        nextOrder
          .slice(
            0,
            20,
          )
          .map(
            (
              stop,
              index,
            ) =>
              `${index + 1}. ${stopName(
                stop,
              )}`,
          );

      if (
        nextOrder.length > 20
      ) {
        preview.push(
          `...and ${
            nextOrder.length -
            20
          } more stops`,
        );
      }

      const approved =
        window.confirm(
          [
            `Start "${route.name}" at ${stopName(
              selectedStop,
            )}?`,
            "",
            "Campaign HQ will move this stop to position 1.",
            "Every other stop will keep its current relative order.",
            "Nothing changes for the Volunteer until you confirm.",
            "",
            "New route order:",
            ...preview,
            "",
            "Set this as the starting stop?",
          ].join("\n"),
        );

      if (!approved) {
        return;
      }

      setStartingStopId(
        selectedStop.id,
      );

      try {
        await reorderRouteStops(
          route.id,
          nextOrder.map(
            (stop) =>
              stop.id,
          ),
        );

        window.alert(
          `${stopName(
            selectedStop,
          )} is now the starting stop. The leadership map, Google Maps route link and Volunteer assignment now begin there.`,
        );
      } catch {
        // The hook displays the secure route-order error.
      } finally {
        setStartingStopId(
          "",
        );
      }
    };

  const openManualOrder =
    (route) => {
      const ordered =
        sortedRouteStops(
          route,
        );

      if (ordered.length < 2) {
        window.alert(
          "Add at least two stops before manually ordering this route.",
        );
        return;
      }

      setManualOrderRoute(
        route,
      );
      setManualOrderStops(
        ordered,
      );
      setManualOrderError(
        "",
      );
      setManualOrderAnnouncement(
        "",
      );
      setDraggedStopId(
        "",
      );
    };

  const closeManualOrder =
    () => {
      if (isSaving) {
        return;
      }

      setManualOrderRoute(
        null,
      );
      setManualOrderStops(
        [],
      );
      setManualOrderError(
        "",
      );
      setManualOrderAnnouncement(
        "",
      );
      setDraggedStopId(
        "",
      );
    };

  const moveManualStop =
    (
      stopId,
      offset,
    ) => {
      const fromIndex =
        manualOrderStops.findIndex(
          (stop) =>
            stop.id === stopId,
        );

      const toIndex =
        fromIndex + offset;

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        toIndex >=
          manualOrderStops.length
      ) {
        return;
      }

      const next =
        moveStopInOrder(
          manualOrderStops,
          fromIndex,
          toIndex,
        );

      setManualOrderStops(
        next,
      );

      setManualOrderAnnouncement(
        `${stopName(
          next[toIndex],
        )} moved to position ${
          toIndex + 1
        }.`,
      );
    };

  const dropManualStop =
    (
      event,
      targetStopId,
    ) => {
      event.preventDefault();

      const sourceStopId =
        event.dataTransfer.getData(
          "text/plain",
        ) ||
        draggedStopId;

      const fromIndex =
        manualOrderStops.findIndex(
          (stop) =>
            stop.id ===
            sourceStopId,
        );

      const targetIndex =
        manualOrderStops.findIndex(
          (stop) =>
            stop.id ===
            targetStopId,
        );

      if (
        fromIndex < 0 ||
        targetIndex < 0 ||
        fromIndex ===
          targetIndex
      ) {
        setDraggedStopId(
          "",
        );
        return;
      }

      const rectangle =
        event.currentTarget
          .getBoundingClientRect();

      const afterTarget =
        event.clientY >
        rectangle.top +
          rectangle.height / 2;

      let toIndex =
        targetIndex +
        (
          afterTarget
            ? 1
            : 0
        );

      if (
        fromIndex <
        toIndex
      ) {
        toIndex -= 1;
      }

      toIndex =
        Math.max(
          0,
          Math.min(
            toIndex,
            manualOrderStops.length -
              1,
          ),
        );

      const next =
        moveStopInOrder(
          manualOrderStops,
          fromIndex,
          toIndex,
        );

      setManualOrderStops(
        next,
      );
      setDraggedStopId(
        "",
      );
      setManualOrderAnnouncement(
        `${stopName(
          next[toIndex],
        )} moved to position ${
          toIndex + 1
        }.`,
      );
    };

  const saveManualOrder =
    async () => {
      if (
        !manualOrderRoute ||
        !manualOrderStops.length
      ) {
        return;
      }

      setManualOrderError(
        "",
      );

      const current =
        sortedRouteStops(
          manualOrderRoute,
        );

      const sameOrder =
        current.length ===
          manualOrderStops.length &&
        current.every(
          (
            stop,
            index,
          ) =>
            stop.id ===
            manualOrderStops[
              index
            ]?.id,
        );

      const hasContiguousOrder =
        current.every(
          (
            stop,
            index,
          ) =>
            Number(
              stop.stop_order,
            ) ===
            index + 1,
        );

      if (
        sameOrder &&
        hasContiguousOrder
      ) {
        window.alert(
          "No route-order changes are waiting to be saved.",
        );
        return;
      }

      setReorderingRouteId(
        manualOrderRoute.id,
      );

      try {
        await reorderRouteStops(
          manualOrderRoute.id,
          manualOrderStops.map(
            (stop) =>
              stop.id,
          ),
        );

        setManualOrderRoute(
          null,
        );
        setManualOrderStops(
          [],
        );
        setManualOrderError(
          "",
        );
        setManualOrderAnnouncement(
          "",
        );
        setDraggedStopId(
          "",
        );

        window.alert(
          "The manual route order was saved. The leadership map, Google Maps route link and Volunteer assignment now use this sequence.",
        );
      } catch (error) {
        setManualOrderError(
          error.message ||
            "The manual route order could not be saved.",
        );
      } finally {
        setReorderingRouteId(
          "",
        );
      }
    };


  const openFollowUpGenerator =
    (assignment) => {
      if (
        completionReview(
          assignment,
        ).review_status !==
        "reviewed"
      ) {
        window.alert(
          "Mark the completion review reviewed before creating follow-up work.",
        );
        return;
      }

      const candidates =
        (
          assignment
            .field_routes ||
          []
        ).flatMap(
          (route) =>
            sortedRouteStops(
              route,
            ).filter(
              (stop) =>
                stop.status !==
                  "pending" &&
                !followedUpSourceIds
                  .has(
                    stop.id,
                  ),
            ),
        );

      if (!candidates.length) {
        window.alert(
          "Every recorded stop in this assignment already has follow-up work, or there are no recorded stops available.",
        );
        return;
      }

      const suggestedIds =
        candidates
          .filter(
            isSuggestedFollowUpStop,
          )
          .map(
            (stop) =>
              stop.id,
          );

      const originalVolunteerIsActive =
        volunteers.some(
          (volunteer) =>
            volunteer.userId ===
            assignment
              .volunteer_user_id,
        );

      setFollowUpAssignmentId(
        assignment.id,
      );

      setFollowUpStopIds(
        suggestedIds,
      );

      setFollowUpForm({
        title:
          `${assignment.title} follow-up`,
        volunteerUserId:
          originalVolunteerIsActive
            ? assignment
                .volunteer_user_id
            : "",
        assignmentDate:
          "",
        meetingLocation:
          assignment
            .meeting_location ||
          "",
        instructions:
          `Follow-up field work generated from the reviewed "${assignment.title}" assignment.`,
        finishMode:
          "final_stop",
      });

      setFollowUpError("");
      setFollowUpAction("");
      setReviewAssignmentId("");
      setReviewError("");
    };

  const closeFollowUpGenerator =
    () => {
      if (isSaving) {
        return;
      }

      setFollowUpAssignmentId("");
      setFollowUpStopIds([]);
      setFollowUpForm(
        EMPTY_FOLLOW_UP,
      );
      setFollowUpError("");
      setFollowUpAction("");
    };

  const toggleFollowUpStop =
    (stopId) => {
      setFollowUpStopIds(
        (current) =>
          current.includes(
            stopId,
          )
            ? current.filter(
                (id) =>
                  id !== stopId,
              )
            : [
                ...current,
                stopId,
              ],
      );
    };

  const submitFollowUpAssignment =
    async (event) => {
      event.preventDefault();

      if (!followUpAssignment) {
        return;
      }

      setFollowUpError("");

      const title =
        followUpForm
          .title
          .trim();

      if (!title) {
        setFollowUpError(
          "Enter a follow-up assignment title.",
        );
        return;
      }

      const orderedStopIds =
        followUpCandidateStops
          .filter(
            ({
              stop,
              alreadyFollowed,
            }) =>
              !alreadyFollowed &&
              followUpStopIds
                .includes(
                  stop.id,
                ),
          )
          .map(
            ({ stop }) =>
              stop.id,
          );

      if (!orderedStopIds.length) {
        setFollowUpError(
          "Choose at least one recorded stop for follow-up.",
        );
        return;
      }

      const approved =
        window.confirm(
          [
            `Create "${title}"?`,
            "",
            `${orderedStopIds.length} recorded ${
              orderedStopIds.length ===
              1
                ? "stop will"
                : "stops will"
            } become new pending follow-up work.`,
            "The original results, Volunteer notes and completion times will not change.",
            followUpForm
              .volunteerUserId
              ? "The selected Volunteer will see the new assignment."
              : "The follow-up will remain unassigned until leadership assigns a Volunteer.",
            "",
            "Create this follow-up route?",
          ].join("\n"),
        );

      if (!approved) {
        return;
      }

      setFollowUpAction(
        "creating",
      );

      try {
        const created =
          await createFollowUpAssignment({
            sourceAssignmentId:
              followUpAssignment.id,
            sourceStopIds:
              orderedStopIds,
            title,
            volunteerUserId:
              followUpForm
                .volunteerUserId ||
              null,
            assignmentDate:
              followUpForm
                .assignmentDate ||
              null,
            meetingLocation:
              followUpForm
                .meetingLocation
                .trim(),
            instructions:
              followUpForm
                .instructions
                .trim(),
            finishMode:
              followUpForm
                .finishMode,
          });

        setFollowUpAssignmentId("");
        setFollowUpStopIds([]);
        setFollowUpForm(
          EMPTY_FOLLOW_UP,
        );
        setFollowUpError("");
        setFollowUpAction("");

        if (
          created
            ?.created_assignment_id
        ) {
          setSelectedAssignmentId(
            created
              .created_assignment_id,
          );
        }

        setStatusFilter(
          "active",
        );

        window.alert(
          `${created?.created_stop_count || orderedStopIds.length} follow-up stops were created in a new assignment. The original completion review remains unchanged.`,
        );
      } catch (error) {
        setFollowUpError(
          error.message ||
            "The follow-up assignment could not be created.",
        );
        setFollowUpAction("");
      }
    };

  const openCompletionReview =
    (assignment) => {
      setReviewAssignmentId(
        assignment.id,
      );
      setReviewNotes(
        completionReview(
          assignment,
        ).review_notes ||
          "",
      );
      setReviewError("");
      setReviewAction("");
    };

  const closeCompletionReview =
    () => {
      if (isSaving) {
        return;
      }

      setReviewAssignmentId(
        "",
      );
      setReviewNotes("");
      setReviewError("");
      setReviewAction("");
    };

  const submitReviewAction =
    async (action) => {
      if (!reviewAssignment) {
        return;
      }

      setReviewError("");

      if (
        action ===
          "mark_reviewed" &&
        !reviewSummary.ready
      ) {
        setReviewError(
          reviewSummary.total ===
            0
            ? "Add at least one stop before reviewing this assignment."
            : reviewSummary
                  .totals
                  .pending >
                0
              ? `Record or skip the remaining ${reviewSummary.totals.pending} stops before marking this assignment reviewed.`
              : "The Volunteer must complete the assignment before leadership can mark it reviewed.",
        );
        return;
      }

      if (
        action ===
        "mark_reviewed"
      ) {
        const approved =
          window.confirm(
            [
              `Mark "${reviewAssignment.title}" reviewed?`,
              "",
              `${reviewSummary.recorded} of ${reviewSummary.total} stops are recorded.`,
              "The private leadership note remains hidden from the Volunteer.",
              "",
              "Confirm completion review?",
            ].join("\n"),
          );

        if (!approved) {
          return;
        }
      }

      if (
        action === "reopen"
      ) {
        const approved =
          window.confirm(
            "Reopen this completion review for leadership corrections?",
          );

        if (!approved) {
          return;
        }
      }

      setReviewAction(action);

      try {
        await saveAssignmentReview({
          assignmentId:
            reviewAssignment.id,
          action,
          notes:
            reviewNotes.trim(),
        });

        setReviewAssignmentId(
          "",
        );
        setReviewNotes("");
        setReviewError("");
        setReviewAction("");

        window.alert(
          action ===
            "mark_reviewed"
            ? "The assignment is now marked reviewed."
            : action ===
                "reopen"
              ? "The completion review was reopened."
              : "The private leadership note was saved.",
        );
      } catch (error) {
        setReviewError(
          error.message ||
            "The completion review could not be saved.",
        );
        setReviewAction("");
      }
    };

  const renderCommandBoardAssignment =
    (
      assignment,
      {
        showReview = false,
        showPlan = false,
        opportunityCount = 0,
      } = {},
    ) => {
      const summary =
        completionSummary(
          assignment,
        );

      const volunteer =
        assignment
          .volunteer_user_id
          ? memberMap.get(
              assignment
                .volunteer_user_id,
            )
          : null;

      const dateKey =
        commandBoardAssignmentDateKey(
          assignment,
        );

      return (
        <article
          className={
            styles.commandAssignmentRow
          }
          key={
            assignment.id
          }
        >
          <div
            className={
              styles.commandAssignmentMain
            }
          >
            <span>
              {labelStatus(
                assignment.status,
              )}
              {assignment
                .source_assignment_id
                ? " - Follow-up"
                : " - Original"}
            </span>

            <strong>
              {assignment.title}
            </strong>

            <small>
              {volunteer
                ?.fullName ||
                "Unassigned"}
              {" - "}
              {dateKey
                ? formatCommandBoardDate(
                    dateKey,
                  )
                : "Date not scheduled"}
            </small>
          </div>

          <div
            className={
              styles.commandAssignmentFacts
            }
          >
            <span>
              {formatCommandBoardTime(
                assignment,
              )}
            </span>

            <span>
              {summary.recorded}
              {" / "}
              {summary.total}
              {" stops"}
            </span>

            <span>
              {summary.totals
                .pending}
              {" pending"}
            </span>

            {opportunityCount >
              0 && (
              <span>
                {opportunityCount}
                {" ready for follow-up"}
              </span>
            )}
          </div>

          <div
            className={
              styles.commandAssignmentActions
            }
          >
            {showReview && (
              <button
                type="button"
                onClick={() =>
                  openCommandBoardReview(
                    assignment,
                  )
                }
              >
                <ClipboardCheck
                  size={15}
                />
                Open review
              </button>
            )}

            {showPlan && (
              <button
                type="button"
                onClick={() =>
                  openCommandBoardTurfPlanner(
                    assignment,
                  )
                }
              >
                <Route size={15} />
                Plan next route
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                openCommandBoardAssignment(
                  assignment.id,
                )
              }
            >
              Open assignment
              <ChevronRight
                size={15}
              />
            </button>
          </div>
        </article>
      );
    };

  return (
    <div className={styles.app}>
      <CampaignSidebar
        activePage="Field operations"
        sidebarOpen={
          sidebarOpen
        }
        onClose={() =>
          setSidebarOpen(false)
        }
        styles={
          shellStyles
        }
        showLeadership
        adminAccent
      />

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.menuButton}
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div>
              <span>
                Campaign HQ
                <ChevronRight size={13} />
                Field operations
              </span>

              <strong>
                Field Operations Center
              </strong>
            </div>
          </div>

          <div className={styles.topbarRight}>
            <CampaignDateTime />

            <span className={styles.secureBadge}>
              <ShieldCheck size={15} />
              Leadership only
            </span>
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.pageHeader}>
            <div>
              <span>
                Volunteer deployment
              </span>

              <h1>
                Field Operations
              </h1>

              <p>
                Assign volunteers to
                precincts, build routes,
                add ordered stops and
                monitor completion from
                one secure workspace.
              </p>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                onClick={refresh}
                disabled={isLoading}
              >
                <RefreshCw
                  className={
                    isLoading
                      ? styles.spinning
                      : ""
                  }
                  size={17}
                />
                Refresh
              </button>

              <button
                className={
                  styles.alertsLaunchButton
                }
                type="button"
                onClick={
                  openFieldAlerts
                }
                aria-label={`Open Field Operations alerts. ${fieldAlertActiveCount} active alerts.`}
              >
                <Bell
                  size={17}
                />
                Alerts
                <span
                  className={[
                    styles.alertsLaunchBadge,
                    fieldAlertActiveCount
                      ? styles.alertsLaunchBadgeActive
                      : styles.alertsLaunchBadgeClear,
                  ].join(" ")}
                >
                  {
                    fieldAlertActiveCount >
                    99
                      ? "99+"
                      : fieldAlertActiveCount
                  }
                </span>
              </button>

              <button
                className={
                  styles.commandBoardLaunchButton
                }
                type="button"
                onClick={
                  openDailyCommandBoard
                }
              >
                <ClipboardList
                  size={17}
                />
                Daily board
              </button>

              <button
                className={
                  styles.performanceLaunchButton
                }
                type="button"
                onClick={() =>
                  setPerformanceOpen(
                    true,
                  )
                }
              >
                <BarChart3
                  size={17}
                />
                Performance dashboard
              </button>

              <button
                className={styles.primaryButton}
                type="button"
                onClick={
                  openAssignmentCreate
                }
                disabled={
                  !volunteers.length
                }
              >
                <Plus size={17} />
                New assignment
              </button>
            </div>
          </section>

          {visibleError && (
            <section
              className={styles.error}
              role="alert"
            >
              <AlertTriangle size={19} />
              <span>
                {visibleError}
              </span>
            </section>
          )}

          {!volunteers.length &&
            !membersLoading && (
              <section className={styles.notice}>
                <UsersRound size={21} />

                <div>
                  <strong>
                    Add an active Volunteer
                    before creating field
                    assignments
                  </strong>

                  <p>
                    Field work can only be
                    assigned to an active
                    Volunteer workspace
                    account.
                  </p>
                </div>
              </section>
            )}

          <section className={styles.summaryGrid}>
            <article>
              <MapPin size={22} />
              <span>
                Active assignments
              </span>
              <strong>
                {isLoading
                  ? "—"
                  : activeAssignments.length}
              </strong>
              <p>
                Assigned or underway
              </p>
            </article>

            <article>
              <UserRound size={22} />
              <span>
                Active volunteers
              </span>
              <strong>
                {membersLoading
                  ? "—"
                  : volunteers.length}
              </strong>
              <p>
                Eligible for field work
              </p>
            </article>

            <article>
              <House size={22} />
              <span>
                Total stops
              </span>
              <strong>
                {assignmentsLoading
                  ? "—"
                  : allStops.length}
              </strong>
              <p>
                Across every route
              </p>
            </article>

            <article>
              <CheckCircle2 size={22} />
              <span>
                Completion
              </span>
              <strong>
                {assignmentsLoading
                  ? "—"
                  : `${completionRate}%`}
              </strong>
              <p>
                Stops recorded
              </p>
            </article>
          </section>

          <section className={styles.controls}>
            <label>
              <Search size={18} />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value,
                  )
                }
                placeholder="Search volunteer, precinct, turf or assignment"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
              aria-label="Filter assignments by status"
            >
              <option value="active">
                Active assignments
              </option>
              <option value="assigned">
                Assigned
              </option>
              <option value="accepted">
                Accepted
              </option>
              <option value="in_progress">
                In progress
              </option>
              <option value="completed">
                Completed
              </option>
              <option value="needs_review">
                Needs review
              </option>
              <option value="reviewed">
                Reviewed
              </option>
              <option value="cancelled">
                Cancelled
              </option>
              <option value="all">
                All assignments
              </option>
            </select>
          </section>

          <section className={styles.contentGrid}>
            <aside className={styles.assignmentList}>
              <header>
                <div>
                  <span>
                    Assignment queue
                  </span>
                  <h2>
                    Volunteer deployments
                  </h2>
                </div>

                <strong>
                  {
                    filteredAssignments.length
                  }
                </strong>
              </header>

              {isLoading ? (
                <div className={styles.loading}>
                  <LoaderCircle
                    className={styles.spinning}
                    size={28}
                  />
                  Loading field work
                </div>
              ) : filteredAssignments.length ? (
                <div className={styles.assignmentCards}>
                  {filteredAssignments.map(
                    (assignment) => {
                      const volunteer =
                        volunteerMap.get(
                          assignment
                            .volunteer_user_id,
                        );

                      const routes =
                        assignment
                          .field_routes ||
                        [];

                      const stops =
                        routes.flatMap(
                          (route) =>
                            route.field_stops ||
                            [],
                        );

                      const recorded =
                        stops.filter(
                          (stop) =>
                            stop.status !==
                            "pending",
                        ).length;

                      const active =
                        selectedAssignment
                          ?.id ===
                        assignment.id;

                      return (
                        <button
                          className={
                            active
                              ? styles.activeAssignment
                              : ""
                          }
                          key={assignment.id}
                          type="button"
                          onClick={() =>
                            setSelectedAssignmentId(
                              assignment.id,
                            )
                          }
                        >
                          <div>
                            <span>
                              {labelStatus(
                                assignment.status,
                              )}
                              {assignment.source_assignment_id
                                ? " · Follow-up"
                                : ""}
                            </span>

                            <small>
                              {routes.length}
                              {" routes · "}
                              {recorded}
                              {" / "}
                              {stops.length}
                              {" stops"}
                              {assignment.status ===
                              "completed"
                                ? ` · ${reviewStatusLabel(
                                    assignment,
                                  )}`
                                : ""}
                            </small>
                          </div>

                          <h3>
                            {assignment.title}
                          </h3>

                          <p>
                            {volunteer
                              ?.fullName ||
                              "Unassigned"}
                          </p>

                          {assignment
                            .source_assignment && (
                            <p className={styles.assignmentSourceLine}>
                              From{" "}
                              {
                                assignment
                                  .source_assignment
                                  .title
                              }
                            </p>
                          )}

                          <footer>
                            <span>
                              <MapPin
                                size={13}
                              />
                              {assignment.precinct ||
                                "Precinct pending"}
                            </span>

                            <ChevronRight
                              size={17}
                            />
                          </footer>
                        </button>
                      );
                    },
                  )}
                </div>
              ) : (
                <div className={styles.empty}>
                  <MapPin size={31} />
                  <strong>
                    No assignments match
                    this view
                  </strong>
                  <p>
                    Create a field
                    assignment or adjust
                    the filters.
                  </p>
                </div>
              )}
            </aside>

            <article className={styles.detailPanel}>
              {!selectedAssignment ? (
                <div className={styles.detailEmpty}>
                  <Route size={36} />
                  <strong>
                    Select or create an
                    assignment
                  </strong>
                  <p>
                    Assignment details,
                    routes and stops will
                    appear here.
                  </p>
                </div>
              ) : (
                <>
                  <header className={styles.detailHeader}>
                    <div>
                      <span>
                        {labelStatus(
                          selectedAssignment
                            .status,
                        )}
                        {selectedAssignment
                          .source_assignment_id
                          ? " · Follow-up"
                          : ""}
                      </span>

                      <h2>
                        {
                          selectedAssignment
                            .title
                        }
                      </h2>

                      <p>
                        {selectedVolunteer
                          ?.fullName ||
                          "Unassigned"}
                        {" · "}
                        {selectedVolunteer
                          ?.email ||
                          "Assign a Volunteer before field work"}
                      </p>
                    </div>

                    <div className={styles.detailActions}>
                      <button
                        type="button"
                        onClick={() =>
                          openCompletionReview(
                            selectedAssignment,
                          )
                        }
                      >
                        <ClipboardCheck
                          size={16}
                        />
                        Review completion
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openAssignmentEdit(
                            selectedAssignment,
                          )
                        }
                      >
                        <Edit3 size={16} />
                        Edit
                      </button>

                      <button
                        className={styles.deleteButton}
                        type="button"
                        onClick={() =>
                          confirmDeleteAssignment(
                            selectedAssignment,
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </header>

                  <div className={styles.assignmentFacts}>
                    <div>
                      <span>
                        Precinct
                      </span>
                      <strong>
                        {selectedAssignment
                          .precinct ||
                          "Pending"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Turf
                      </span>
                      <strong>
                        {selectedAssignment
                          .turf_name ||
                          "Pending"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Shift starts
                      </span>
                      <strong>
                        {formatDateTime(
                          selectedAssignment
                            .shift_starts_at,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Meeting point
                      </span>
                      <strong>
                        {selectedAssignment
                          .meeting_location ||
                          "Pending"}
                      </strong>
                    </div>
                  </div>

                  {selectedAssignment
                    .instructions && (
                    <div className={styles.instructions}>
                      {
                        selectedAssignment
                          .instructions
                      }
                    </div>
                  )}

                  {selectedAssignment
                    .source_assignment && (
                    <section className={styles.sourceTrailPanel}>
                      <header className={styles.sourceTrailHeader}>
                        <div>
                          <span>
                            <Route size={15} />
                            Follow-up source trail
                          </span>

                          <h3>
                            Generated from reviewed field work
                          </h3>

                          <p>
                            {
                              assignmentStops(
                                selectedAssignment,
                              ).filter(
                                (stop) =>
                                  stop.source_trail,
                              ).length
                            }
                            {" source "}
                            {assignmentStops(
                              selectedAssignment,
                            ).filter(
                              (stop) =>
                                stop.source_trail,
                            ).length ===
                            1
                              ? "stop is"
                              : "stops are"}
                            {" linked to the original saved results."}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            openLinkedAssignment(
                              selectedAssignment
                                .source_assignment
                                .id,
                            )
                          }
                        >
                          Open source assignment
                          <ChevronRight
                            size={16}
                          />
                        </button>
                      </header>

                      <div className={styles.sourceTrailChain}>
                        {(
                          selectedAssignment
                            .source_chain ||
                          []
                        ).map(
                          (
                            source,
                            index,
                          ) => (
                            <button
                              type="button"
                              key={
                                source.id
                              }
                              onClick={() =>
                                openLinkedAssignment(
                                  source.id,
                                )
                              }
                            >
                              <small>
                                {index === 0
                                  ? "Direct source"
                                  : `Earlier source - generation ${
                                      index +
                                      1
                                    }`}
                              </small>

                              <strong>
                                {
                                  source.title
                                }
                              </strong>

                              <span>
                                {labelStatus(
                                  source.status,
                                )}
                                {" - "}
                                {source
                                  .completion_review
                                  ?.review_status ===
                                "reviewed"
                                  ? `Reviewed ${formatDateTime(
                                      source
                                        .completion_review
                                        .reviewed_at,
                                    )}`
                                  : "Review pending"}
                              </span>
                            </button>
                          ),
                        )}
                      </div>
                    </section>
                  )}

                  {(
                    selectedAssignment
                      .generated_follow_up_history ||
                    []
                  ).length > 0 && (
                    <section className={styles.sourceTrailPanel}>
                      <header className={styles.sourceTrailHeader}>
                        <div>
                          <span>
                            <ClipboardList
                              size={15}
                            />
                            Follow-up history
                          </span>

                          <h3>
                            Generated assignments
                          </h3>

                          <p>
                            Open any later assignment without changing this assignment or its saved results.
                          </p>
                        </div>
                      </header>

                      <div className={styles.generatedFollowUpGrid}>
                        {selectedAssignment
                          .generated_follow_up_history
                          .map(
                            (followUp) => (
                              <button
                                type="button"
                                key={
                                  followUp.id
                                }
                                onClick={() =>
                                  openLinkedAssignment(
                                    followUp.id,
                                  )
                                }
                              >
                                <small>
                                  {followUpGenerationLabel(
                                    followUp
                                      .generation_distance,
                                  )}
                                </small>

                                <strong>
                                  {
                                    followUp.title
                                  }
                                </strong>

                                <span>
                                  {labelStatus(
                                    followUp.status,
                                  )}
                                  {" - "}
                                  {formatDateTime(
                                    followUp
                                      .created_at,
                                  )}
                                </span>
                              </button>
                            ),
                          )}
                      </div>
                    </section>
                  )}

                  {(() => {
                    const summary =
                      completionSummary(
                        selectedAssignment,
                      );

                    const review =
                      completionReview(
                        selectedAssignment,
                      );

                    return (
                      <section className={styles.reviewOverview}>
                        <div className={styles.reviewOverviewCopy}>
                          <span>
                            <ClipboardList
                              size={15}
                            />
                            Completion review
                          </span>

                          <strong>
                            {review.review_status ===
                            "reviewed"
                              ? `Leadership review complete · ${summary.recorded} of ${summary.total} stops recorded`
                              : `${summary.recorded} of ${summary.total} stops recorded · ${
                                  summary.ready
                                    ? "Ready for review"
                                    : summary.totals.pending
                                      ? `${summary.totals.pending} pending`
                                      : "Waiting for Volunteer completion"
                                }`}
                          </strong>

                          {review.review_status ===
                            "reviewed" && (
                            <small>
                              Reviewed{" "}
                              {formatDateTime(
                                review.reviewed_at,
                              )}
                            </small>
                          )}
                        </div>

                        <div className={styles.reviewOverviewActions}>
                          <span
                            className={[
                              styles.reviewStatus,
                              review.review_status ===
                              "reviewed"
                                ? styles.reviewedStatus
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            {reviewStatusLabel(
                              selectedAssignment,
                            )}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              openCompletionReview(
                                selectedAssignment,
                              )
                            }
                          >
                            Open review
                          </button>
                        </div>
                      </section>
                    );
                  })()}

                  <FieldRouteMap
                    eyebrow="Assignment map"
                    title={`${selectedAssignment.title} map`}
                    routes={
                      selectedAssignment.field_routes ||
                      []
                    }
                    meetingLocation={
                      selectedAssignment.meeting_location ||
                      ""
                    }
                    privacyLabel="Leadership route view"
                  />

                  <div className={styles.routeHeading}>
                    <div>
                      <span>
                        Route builder
                      </span>
                      <h3>
                        Routes and stops
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openRouteCreate(
                          selectedAssignment,
                        )
                      }
                    >
                      <Plus size={16} />
                      Add route
                    </button>
                  </div>

                  <div className={styles.routeList}>
                    {(
                      selectedAssignment
                        .field_routes ||
                      []
                    ).map(
                      (route) => (
                        <section
                          className={styles.routeCard}
                          key={route.id}
                        >
                          <header>
                            <div className={styles.routeIcon}>
                              <Navigation
                                size={18}
                              />
                            </div>

                            <div>
                              <span>
                                Route{" "}
                                {
                                  route.route_order
                                }
                              </span>
                              <h3>
                                {route.name}
                              </h3>
                              <p>
                                {route.start_location ||
                                  route.instructions ||
                                  "No starting point added"}
                              </p>

                              <small
                                className={
                                  styles.routeFinishBadge
                                }
                              >
                                {routeFinishLabel(
                                  route,
                                  selectedAssignment.meeting_location ||
                                    "",
                                )}
                              </small>
                            </div>

                            <div className={styles.routeActions}>
                              <button
                                type="button"
                                onClick={() =>
                                  openStopCreate(
                                    route,
                                  )
                                }
                              >
                                <Plus
                                  size={15}
                                />
                                Stop
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setBulkImportRoute(
                                    route,
                                  )
                                }
                              >
                                <FileSpreadsheet
                                  size={15}
                                />
                                Import
                              </button>

                              <button
                                type="button"
                                disabled={
                                  isSaving
                                }
                                onClick={() =>
                                  locateRouteStops(
                                    route,
                                  )
                                }
                                title="Convert missing route addresses into map coordinates"
                              >
                                <MapPin
                                  size={15}
                                />
                                {geocodingRouteId ===
                                route.id
                                  ? "Locating…"
                                  : "Locate stops"}
                              </button>

                              <button
                                type="button"
                                disabled={
                                  isSaving ||
                                  (
                                    route.field_stops ||
                                    []
                                  ).length < 3
                                }
                                onClick={() =>
                                  optimizeRouteOrder(
                                    route,
                                  )
                                }
                                title="Keep the current first stop and arrange the remaining mapped stops locally"
                              >
                                <Route
                                  size={15}
                                />
                                {optimizingRouteId ===
                                route.id
                                  ? "Optimizing…"
                                  : "Optimize order"}
                              </button>

                              <button
                                type="button"
                                disabled={
                                  isSaving ||
                                  (
                                    route.field_stops ||
                                    []
                                  ).length < 2
                                }
                                onClick={() =>
                                  openManualOrder(
                                    route,
                                  )
                                }
                                title="Review and save a custom stop sequence"
                              >
                                <GripVertical
                                  size={15}
                                />
                                {reorderingRouteId ===
                                route.id
                                  ? "Saving…"
                                  : "Reorder"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openRouteEdit(
                                    route,
                                  )
                                }
                              >
                                <Edit3
                                  size={15}
                                />
                              </button>

                              <button
                                className={styles.deleteButton}
                                type="button"
                                onClick={() =>
                                  confirmDeleteRoute(
                                    route,
                                  )
                                }
                              >
                                <Trash2
                                  size={15}
                                />
                              </button>
                            </div>
                          </header>

                          {(
                            route.field_stops ||
                            []
                          ).length ? (
                            <div className={styles.stopList}>
                              {route.field_stops.map(
                                (stop) => (
                                  <div
                                    className={styles.stopRow}
                                    key={stop.id}
                                  >
                                    <div className={styles.stopOrder}>
                                      {stop.status ===
                                      "pending" ? (
                                        <Circle
                                          size={17}
                                        />
                                      ) : (
                                        <CheckCircle2
                                          size={17}
                                        />
                                      )}
                                      {
                                        stop.stop_order
                                      }
                                    </div>

                                    <div>
                                      <strong>
                                        {stop.location_label ||
                                          getAddress(
                                            stop,
                                          )}
                                      </strong>
                                      <span>
                                        {getAddress(
                                          stop,
                                        )}
                                      </span>
                                      <small>
                                        {labelStatus(
                                          stop.status,
                                        )}
                                        {stop.result_code
                                          ? ` · ${labelStatus(
                                              stop.result_code,
                                            )}`
                                          : ""}
                                      </small>
                                      {stop.source_trail && (
                                        <div className={styles.stopSourceSnapshot}>
                                          <span>
                                            Original result from{" "}
                                            {
                                              stop.source_trail
                                                .assignment
                                                .title
                                            }
                                          </span>

                                          <strong>
                                            {sourceResultLabel(
                                              stop.source_trail,
                                            )}
                                            {" - "}
                                            {formatDateTime(
                                              stop.source_trail
                                                .completed_at,
                                            )}
                                          </strong>

                                          <p>
                                            {getAddress(
                                              stop.source_trail,
                                            )}
                                          </p>

                                          {stop.source_trail
                                            .volunteer_notes && (
                                            <small>
                                              Volunteer note:{" "}
                                              {
                                                stop.source_trail
                                                  .volunteer_notes
                                              }
                                            </small>
                                          )}
                                        </div>
                                      )}

                                      {(
                                        stop
                                          .generated_follow_up_history ||
                                        []
                                      ).length > 0 && (
                                        <div className={styles.stopFollowUpLinks}>
                                          <span>
                                            Follow-up history
                                          </span>

                                          {stop
                                            .generated_follow_up_history
                                            .map(
                                              (
                                                followUpStop,
                                              ) => (
                                                <button
                                                  type="button"
                                                  key={
                                                    followUpStop.id
                                                  }
                                                  onClick={() =>
                                                    openLinkedAssignment(
                                                      followUpStop
                                                        .assignment
                                                        .id,
                                                    )
                                                  }
                                                >
                                                  {followUpGenerationLabel(
                                                    followUpStop
                                                      .generation_distance,
                                                  )}
                                                  {": "}
                                                  {
                                                    followUpStop
                                                      .assignment
                                                      .title
                                                  }
                                                </button>
                                              ),
                                            )}
                                        </div>
                                      )}
                                    </div>

                                    <div className={styles.stopActions}>
                                      {sortedRouteStops(
                                        route,
                                      )[0]?.id ===
                                      stop.id ? (
                                        <span
                                          className={
                                            styles.startingStopBadge
                                          }
                                          title="The Volunteer begins here"
                                        >
                                          <Flag
                                            size={14}
                                          />
                                          Starting stop
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={
                                            isSaving
                                          }
                                          onClick={() =>
                                            chooseStartingStop(
                                              route,
                                              stop,
                                            )
                                          }
                                          title="Move this stop to position 1 while preserving the remaining sequence"
                                        >
                                          <Flag
                                            size={15}
                                          />
                                          {startingStopId ===
                                          stop.id
                                            ? "Saving…"
                                            : "Start here"}
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() =>
                                          openStopEdit(
                                            stop,
                                            route.id,
                                          )
                                        }
                                      >
                                        <Edit3
                                          size={15}
                                        />
                                      </button>

                                      <button
                                        className={styles.deleteButton}
                                        type="button"
                                        onClick={() =>
                                          confirmDeleteStop(
                                            stop,
                                          )
                                        }
                                      >
                                        <Trash2
                                          size={15}
                                        />
                                      </button>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            <div className={styles.routeEmpty}>
                              No stops added
                              yet.
                            </div>
                          )}
                        </section>
                      ),
                    )}

                    {!selectedAssignment
                      .field_routes
                      ?.length && (
                      <div className={styles.routeEmptyPanel}>
                        <Route size={29} />
                        <strong>
                          Build the first
                          route
                        </strong>
                        <p>
                          Add a route, then
                          add addresses in
                          the order the
                          Volunteer should
                          visit them.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </article>
          </section>

          <footer className={styles.footer}>
            <span>
              <ShieldCheck size={14} />
              Authorized campaign
              leadership use only
            </span>

            <small>
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString(
                    [],
                    {
                      hour: "numeric",
                      minute: "2-digit",
                    },
                  )}`
                : "Waiting for secure sync"}
            </small>
          </footer>
        </main>
      </div>

      {bulkImportRoute && (
        <FieldStopBulkImport
          route={bulkImportRoute}
          existingStops={
            bulkImportRoute.field_stops || []
          }
          isSaving={isSaving}
          onImport={importStopsAndLocate}
          onClose={() =>
            setBulkImportRoute(null)
          }
        />
      )}

      {alertsOpen && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={() =>
              setAlertsOpen(
                false,
              )
            }
            aria-label="Close Field Operations alerts"
          />

          <section
            className={[
              styles.modal,
              styles.alertsModal,
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="field-alerts-title"
          >
            <header className={styles.alertsHeader}>
              <div>
                <span>
                  Leadership only
                </span>

                <h2 id="field-alerts-title">
                  Field Operations alerts
                </h2>

                <p>
                  Urgent deployment,
                  scheduling, review and
                  follow-up issues from the
                  current campaign workspace.
                </p>
              </div>

              <div className={styles.alertsHeaderActions}>
                <button
                  type="button"
                  onClick={
                    openAlertsReadiness
                  }
                >
                  <ShieldCheck
                    size={16}
                  />
                  Readiness
                </button>

                <button
                  type="button"
                  onClick={
                    openAlertsCommandBoard
                  }
                >
                  <ClipboardList
                    size={16}
                  />
                  Daily board
                </button>

                <button
                  className={styles.closeButton}
                  type="button"
                  onClick={() =>
                    setAlertsOpen(
                      false,
                    )
                  }
                  aria-label="Close Field Operations alerts"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className={styles.alertsBody}>
              <section className={styles.alertsSummaryGrid}>
                <article>
                  <span>
                    Critical
                  </span>
                  <strong>
                    {
                      fieldAlertCriticalCount
                    }
                  </strong>
                  <small>
                    Unassigned, overdue or
                    starting soon
                  </small>
                </article>

                <article>
                  <span>
                    Needs attention
                  </span>
                  <strong>
                    {
                      fieldAlertAttentionCount
                    }
                  </strong>
                  <small>
                    Scheduling, reviews and
                    follow-up
                  </small>
                </article>

                <article>
                  <span>
                    Upcoming
                  </span>
                  <strong>
                    {
                      fieldAlertUpcomingCount
                    }
                  </strong>
                  <small>
                    Next seven days
                  </small>
                </article>

                <article>
                  <span>
                    Active alerts
                  </span>
                  <strong>
                    {
                      fieldAlertActiveCount
                    }
                  </strong>
                  <small>
                    Unique assignments only
                  </small>
                </article>
              </section>

              <section className={styles.alertsTimingNotice}>
                <ShieldCheck
                  size={17}
                />

                <span>
                  Alerts use this browser&apos;s
                  local time. Starting soon
                  means within four hours.
                  Each assignment appears once,
                  with every applicable reason
                  shown together.
                </span>
              </section>

              {fieldAlertGroups.map(
                (group) => (
                  <section
                    className={[
                      styles.alertGroup,
                      styles[
                        `alertGroup_${group.key}`
                      ],
                    ].join(" ")}
                    key={
                      group.key
                    }
                  >
                    <header>
                      <div>
                        <span>
                          {
                            group.label
                          }
                        </span>

                        <h3>
                          {
                            group.description
                          }
                        </h3>
                      </div>

                      <strong>
                        {
                          group.records
                            .length
                        }
                      </strong>
                    </header>

                    {group.records
                      .length ? (
                      <div className={styles.alertList}>
                        {group.records.map(
                          (record) => {
                            const {
                              assignment,
                              summary,
                              reasons,
                              dateKey,
                            } =
                              record;

                            const volunteer =
                              volunteerMap.get(
                                assignment
                                  .volunteer_user_id,
                              );

                            const hasReview =
                              reasons.some(
                                (reason) =>
                                  reason.key ===
                                  "review_waiting",
                              );

                            const hasFollowUp =
                              reasons.some(
                                (reason) =>
                                  reason.key ===
                                  "follow_up",
                              );

                            return (
                              <article
                                className={styles.alertRow}
                                key={
                                  assignment.id
                                }
                              >
                                <div className={styles.alertIdentity}>
                                  <span>
                                    {
                                      assignment
                                        .source_assignment_id
                                        ? "Follow-up assignment"
                                        : "Original assignment"
                                    }
                                  </span>

                                  <strong>
                                    {
                                      assignment.title
                                    }
                                  </strong>

                                  <small>
                                    {
                                      volunteer
                                        ?.fullName ||
                                      volunteer
                                        ?.email ||
                                      "Unassigned"
                                    }
                                    {" · "}
                                    {
                                      dateKey
                                        ? formatCommandBoardDate(
                                            dateKey,
                                          )
                                        : "Operational date not scheduled"
                                    }
                                    {" · "}
                                    {
                                      formatCommandBoardTime(
                                        assignment,
                                      )
                                    }
                                  </small>

                                  <div className={styles.alertReasonList}>
                                    {reasons.map(
                                      (reason) => (
                                        <span
                                          className={[
                                            styles.alertReason,
                                            styles[
                                              `alertReason_${reason.key}`
                                            ],
                                          ]
                                            .filter(
                                              Boolean,
                                            )
                                            .join(
                                              " ",
                                            )}
                                          key={
                                            reason.key
                                          }
                                        >
                                          {
                                            fieldAlertReasonLabel(
                                              reason,
                                            )
                                          }
                                        </span>
                                      ),
                                    )}
                                  </div>
                                </div>

                                <div className={styles.alertFacts}>
                                  <span>
                                    {
                                      assignment.precinct ||
                                      "No precinct"
                                    }
                                    {" · "}
                                    {
                                      assignment.turf_name ||
                                      "No turf"
                                    }
                                  </span>

                                  <strong>
                                    {
                                      summary.recorded
                                    }
                                    {" / "}
                                    {
                                      summary.total
                                    }
                                    {" stops recorded"}
                                  </strong>

                                  <small>
                                    {
                                      summary.totals
                                        .pending
                                    }
                                    {" pending · "}
                                    {
                                      summary.totals
                                        .contacted
                                    }
                                    {" contacted"}
                                  </small>
                                </div>

                                <div className={styles.alertActions}>
                                  {hasReview && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openAlertReview(
                                          assignment,
                                        )
                                      }
                                    >
                                      <ClipboardCheck
                                        size={15}
                                      />
                                      Open review
                                    </button>
                                  )}

                                  {hasFollowUp && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openAlertTurfPlanner(
                                          assignment,
                                        )
                                      }
                                    >
                                      <Route
                                        size={15}
                                      />
                                      Plan route
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openAlertAssignment(
                                        assignment.id,
                                      )
                                    }
                                  >
                                    Open assignment
                                    <ChevronRight
                                      size={15}
                                    />
                                  </button>
                                </div>
                              </article>
                            );
                          },
                        )}
                      </div>
                    ) : (
                      <p className={styles.alertEmpty}>
                        No assignments are in
                        this alert group.
                      </p>
                    )}
                  </section>
                ),
              )}

              <section className={styles.alertsPrivacy}>
                <ShieldCheck
                  size={16}
                />

                <span>
                  Alerts are calculated only
                  from Campaign HQ Field
                  Operations records already
                  available to leadership.
                  Volunteer pages, saved
                  results, reviews, route order
                  and source lineage are not
                  changed.
                </span>
              </section>
            </div>
          </section>
        </div>
      )}

      {readinessOpen && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={() =>
              setReadinessOpen(
                false,
              )
            }
            aria-label="Close Pre-deployment readiness"
          />

          <section
            className={[
              styles.modal,
              styles.readinessModal,
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pre-deployment-readiness-title"
          >
            <header className={styles.readinessHeader}>
              <div>
                <span>
                  Leadership only
                </span>

                <h2
                  id="pre-deployment-readiness-title"
                >
                  Pre-deployment readiness
                </h2>

                <p>
                  Verify every active
                  assignment before it reaches
                  a Volunteer in the field.
                </p>
              </div>

              <div className={styles.readinessHeaderActions}>
                <button
                  type="button"
                  onClick={
                    openReadinessAlerts
                  }
                >
                  <Bell size={16} />
                  Alerts
                </button>

                <button
                  className={styles.closeButton}
                  type="button"
                  onClick={() =>
                    setReadinessOpen(
                      false,
                    )
                  }
                  aria-label="Close Pre-deployment readiness"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className={styles.readinessBody}>
              <section className={styles.readinessSummaryGrid}>
                <article
                  data-tone="blocked"
                >
                  <span>
                    Blocked
                  </span>
                  <strong>
                    {
                      readinessBlockedCount
                    }
                  </strong>
                  <small>
                    Hard requirements missing
                  </small>
                </article>

                <article
                  data-tone="attention"
                >
                  <span>
                    Needs attention
                  </span>
                  <strong>
                    {
                      readinessAttentionCount
                    }
                  </strong>
                  <small>
                    Recommended fixes remain
                  </small>
                </article>

                <article
                  data-tone="ready"
                >
                  <span>
                    Ready
                  </span>
                  <strong>
                    {
                      readinessReadyCount
                    }
                  </strong>
                  <small>
                    Prepared for deployment
                  </small>
                </article>

                <article
                  data-tone="in_progress"
                >
                  <span>
                    In progress
                  </span>
                  <strong>
                    {
                      readinessInProgressCount
                    }
                  </strong>
                  <small>
                    Deployment already started
                  </small>
                </article>
              </section>

              <section className={styles.readinessNotice}>
                <ShieldCheck
                  size={18}
                />

                <div>
                  <strong>
                    {
                      readinessIssueCount
                    }
                    {" "}
                    {
                      readinessIssueCount ===
                      1
                        ? "active assignment needs"
                        : "active assignments need"
                    }
                    {" leadership attention"}
                  </strong>

                  <p>
                    Missing Volunteer, date,
                    start time, route, stops,
                    complete addresses, valid
                    finish mode or valid order
                    blocks deployment. Missing
                    coordinates, shift end and
                    instructions are warnings.
                  </p>
                </div>
              </section>

              {readinessGroups.map(
                (group) => (
                  <section
                    className={[
                      styles.readinessGroup,
                      styles[
                        `readinessGroup_${group.key}`
                      ],
                    ].join(" ")}
                    key={
                      group.key
                    }
                  >
                    <header>
                      <div>
                        <span>
                          {
                            group.label
                          }
                        </span>

                        <h3>
                          {
                            group.description
                          }
                        </h3>
                      </div>

                      <strong>
                        {
                          group.records
                            .length
                        }
                      </strong>
                    </header>

                    {group.records
                      .length ? (
                      <div className={styles.readinessList}>
                        {group.records.map(
                          (record) => {
                            const assignment =
                              record
                                .assignment;

                            const volunteer =
                              volunteerMap.get(
                                assignment
                                  .volunteer_user_id,
                              );

                            return (
                              <article
                                className={styles.readinessCard}
                                key={
                                  assignment.id
                                }
                              >
                                <header>
                                  <div className={styles.readinessIdentity}>
                                    <span>
                                      {
                                        assignment
                                          .source_assignment_id
                                          ? "Follow-up assignment"
                                          : "Original assignment"
                                      }
                                    </span>

                                    <h4>
                                      {
                                        assignment.title
                                      }
                                    </h4>

                                    <p>
                                      {
                                        volunteer
                                          ?.fullName ||
                                        volunteer
                                          ?.email ||
                                        "Unassigned"
                                      }
                                      {" · "}
                                      {
                                        assignment
                                          .assignment_date
                                          ? formatCommandBoardDate(
                                              assignment
                                                .assignment_date,
                                            )
                                          : "Date not scheduled"
                                      }
                                      {" · "}
                                      {
                                        formatCommandBoardTime(
                                          assignment,
                                        )
                                      }
                                    </p>
                                  </div>

                                  <strong
                                    className={styles.readinessStatus}
                                    data-tone={
                                      record.group
                                    }
                                  >
                                    {
                                      readinessGroupLabel(
                                        record.group,
                                      )
                                    }
                                  </strong>
                                </header>

                                <div className={styles.readinessFacts}>
                                  <div>
                                    <span>
                                      Precinct
                                    </span>
                                    <strong>
                                      {
                                        assignment.precinct ||
                                        "Not assigned"
                                      }
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      Turf
                                    </span>
                                    <strong>
                                      {
                                        assignment.turf_name ||
                                        "Not assigned"
                                      }
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      Routes
                                    </span>
                                    <strong>
                                      {
                                        record.routes
                                          .length
                                      }
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      Stops
                                    </span>
                                    <strong>
                                      {
                                        record.stops
                                          .length
                                      }
                                    </strong>
                                  </div>
                                </div>

                                <div className={styles.readinessChecklist}>
                                  {record.checks.map(
                                    (check) => (
                                      <div
                                        className={styles.readinessCheck}
                                        data-state={
                                          check.state
                                        }
                                        key={
                                          check.key
                                        }
                                      >
                                        {check.state ===
                                        "passed" ? (
                                          <CheckCircle2
                                            size={17}
                                          />
                                        ) : check.state ===
                                          "warning" ? (
                                          <AlertTriangle
                                            size={17}
                                          />
                                        ) : (
                                          <Circle
                                            size={17}
                                          />
                                        )}

                                        <div>
                                          <strong>
                                            {
                                              check.label
                                            }
                                          </strong>

                                          <span>
                                            {
                                              check.detail
                                            }
                                          </span>
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>

                                <footer className={styles.readinessActions}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      editReadinessAssignment(
                                        assignment,
                                      )
                                    }
                                  >
                                    <Edit3
                                      size={15}
                                    />
                                    Edit details
                                  </button>

                                  {record
                                    .missingCoordinateStops
                                    .length >
                                    0 && (
                                    <button
                                      type="button"
                                      disabled={
                                        readinessActionId ===
                                        assignment.id
                                      }
                                      onClick={() =>
                                        locateReadinessStops(
                                          record,
                                        )
                                      }
                                    >
                                      <MapPin
                                        size={15}
                                      />
                                      {readinessActionId ===
                                      assignment.id
                                        ? "Locating..."
                                        : "Locate stops"}
                                    </button>
                                  )}

                                  {record
                                    .firstOrderIssueRoute && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        reviewReadinessOrder(
                                          record,
                                        )
                                      }
                                    >
                                      <GripVertical
                                        size={15}
                                      />
                                      Review order
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDeploymentHandoff(
                                        assignment,
                                      )
                                    }
                                  >
                                    <ClipboardCheck
                                      size={15}
                                    />
                                    Deployment handoff
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openReadinessAssignment(
                                        assignment.id,
                                      )
                                    }
                                  >
                                    Open assignment
                                    <ChevronRight
                                      size={15}
                                    />
                                  </button>
                                </footer>
                              </article>
                            );
                          },
                        )}
                      </div>
                    ) : (
                      <p className={styles.readinessEmpty}>
                        No assignments are in
                        this readiness group.
                      </p>
                    )}
                  </section>
                ),
              )}

              {!readinessRecords.length && (
                <section className={styles.readinessEmptyState}>
                  <ShieldCheck
                    size={30}
                  />
                  <strong>
                    No active assignments
                  </strong>
                  <p>
                    Create or reopen field work
                    to run a deployment
                    readiness check.
                  </p>
                </section>
              )}

              <section className={styles.readinessPrivacy}>
                <ShieldCheck
                  size={16}
                />

                <span>
                  Readiness is calculated only
                  from Campaign HQ records
                  already available to
                  leadership. No assignment,
                  route, result, review,
                  source history or Volunteer
                  permission is changed.
                </span>
              </section>
            </div>
          </section>
        </div>
      )}

      {handoffOpen &&
      handoffAssignment && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={
              closeDeploymentHandoff
            }
            aria-label="Close Deployment handoff"
          />

          <section
            className={[
              styles.modal,
              styles.handoffModal,
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deployment-handoff-title"
          >
            <header
              className={
                styles.handoffHeader
              }
            >
              <div>
                <span>
                  Leadership only
                </span>

                <h2
                  id="deployment-handoff-title"
                >
                  Deployment handoff
                </h2>

                <p>
                  Preview the exact
                  Volunteer-facing assignment
                  brief and request a private
                  acknowledgment.
                </p>
              </div>

              <div
                className={
                  styles.handoffHeaderActions
                }
              >
                <button
                  type="button"
                  onClick={
                    openHandoffReadiness
                  }
                >
                  <ShieldCheck
                    size={15}
                  />
                  Readiness
                </button>

                <button
                  className={
                    styles.closeButton
                  }
                  type="button"
                  onClick={
                    closeDeploymentHandoff
                  }
                  aria-label="Close Deployment handoff"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div
              className={
                styles.handoffBody
              }
            >
              <section
                className={
                  styles.handoffStatusPanel
                }
                data-state={
                  handoffState
                }
              >
                <div>
                  {handoffState ===
                  "acknowledged" ? (
                    <CheckCircle2
                      size={22}
                    />
                  ) : handoffState ===
                    "changed" ? (
                    <AlertTriangle
                      size={22}
                    />
                  ) : (
                    <ClipboardCheck
                      size={22}
                    />
                  )}
                </div>

                <div>
                  <span>
                    Current handoff status
                  </span>

                  <strong>
                    {
                      deploymentHandoffLabel(
                        handoffState,
                      )
                    }
                  </strong>

                  <p>
                    {handoffState ===
                    "not_sent"
                      ? "This assignment has not been sent for Volunteer acknowledgment."
                      : handoffState ===
                          "awaiting"
                        ? `Sent ${formatDateTime(
                            handoffLatest
                              ?.sent_at,
                          )}. The assigned Volunteer has not acknowledged it yet.`
                        : handoffState ===
                            "acknowledged"
                          ? `Acknowledged ${formatDateTime(
                              handoffLatest
                                ?.acknowledged_at,
                            )}. Acknowledgment does not start or complete field work.`
                          : handoffLatest
                              ?.invalidation_reason ||
                            "Leadership changed the Volunteer-facing brief. Send a new handoff cycle."}
                  </p>
                </div>
              </section>

              <section
                className={
                  styles.handoffBrief
                }
              >
                <header>
                  <div>
                    <span>
                      Volunteer-facing brief
                    </span>

                    <h3>
                      {
                        handoffAssignment.title
                      }
                    </h3>
                  </div>

                  <strong>
                    {
                      handoffAssignment
                        .source_assignment_id
                        ? "Follow-up"
                        : "Original"
                    }
                  </strong>
                </header>

                <div
                  className={
                    styles.handoffFacts
                  }
                >
                  <div>
                    <span>
                      Volunteer
                    </span>
                    <strong>
                      {
                        volunteerMap.get(
                          handoffAssignment
                            .volunteer_user_id,
                        )?.fullName ||
                        volunteerMap.get(
                          handoffAssignment
                            .volunteer_user_id,
                        )?.email ||
                        "Unassigned"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Assignment date
                    </span>
                    <strong>
                      {
                        handoffAssignment
                          .assignment_date
                          ? formatCommandBoardDate(
                              handoffAssignment
                                .assignment_date,
                            )
                          : "Not scheduled"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Shift
                    </span>
                    <strong>
                      {
                        formatCommandBoardTime(
                          handoffAssignment,
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Meeting point
                    </span>
                    <strong>
                      {
                        handoffAssignment
                          .meeting_location ||
                        "Not provided"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Routes
                    </span>
                    <strong>
                      {
                        handoffAssignment
                          .field_routes
                          ?.length ||
                        0
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Stops
                    </span>
                    <strong>
                      {
                        assignmentStops(
                          handoffAssignment,
                        ).length
                      }
                    </strong>
                  </div>
                </div>

                <div
                  className={
                    styles.handoffRoutes
                  }
                >
                  {(
                    handoffAssignment
                      .field_routes ||
                    []
                  ).map(
                    (route) => (
                      <div
                        key={
                          route.id
                        }
                      >
                        <span>
                          Route {
                            route.route_order
                          }
                        </span>

                        <strong>
                          {
                            route.name ||
                            `Route ${route.route_order}`
                          }
                        </strong>

                        <small>
                          {
                            (
                              route.field_stops ||
                              []
                            ).length
                          }{" "}
                          stops
                          {" · "}
                          {
                            routeFinishLabel(
                              route,
                            )
                          }
                        </small>
                      </div>
                    ),
                  )}
                </div>

                <div
                  className={
                    styles.handoffInstructions
                  }
                >
                  <span>
                    Volunteer instructions
                  </span>

                  <p>
                    {
                      handoffAssignment
                        .instructions ||
                      "No additional Volunteer instructions were provided."
                    }
                  </p>
                </div>
              </section>

              <section
                className={
                  styles.handoffReadiness
                }
                data-ready={
                  handoffCanSend
                    ? "true"
                    : "false"
                }
              >
                <div>
                  {handoffCanSend ? (
                    <CheckCircle2
                      size={20}
                    />
                  ) : (
                    <AlertTriangle
                      size={20}
                    />
                  )}
                </div>

                <div>
                  <strong>
                    {handoffCanSend
                      ? "Ready to send"
                      : "Readiness blockers remain"}
                  </strong>

                  <p>
                    {handoffCanSend
                      ? handoffReadiness
                          ?.warnings
                          .length
                        ? `${handoffReadiness.warnings.length} recommended readiness warning remains, but the handoff may be sent.`
                        : "Every required deployment check is complete."
                      : (
                          handoffReadiness
                            ?.blockers ||
                          []
                        )
                          .map(
                            (blocker) =>
                              blocker.label,
                          )
                          .join(", ") ||
                        "This assignment cannot request acknowledgment in its current status."}
                  </p>
                </div>
              </section>

              {handoffError && (
                <div
                  className={
                    styles.formError
                  }
                  role="alert"
                >
                  <AlertTriangle
                    size={17}
                  />
                  {handoffError}
                </div>
              )}

              <section
                className={
                  styles.handoffPrivacy
                }
              >
                <ShieldCheck
                  size={16}
                />

                <span>
                  Only the Volunteer currently
                  assigned to this field work
                  can view and acknowledge the
                  handoff. Sending or
                  acknowledging does not start
                  the route, record a result or
                  change completion review.
                </span>
              </section>
            </div>

            <footer
              className={
                styles.handoffFooter
              }
            >
              <small>
                {handoffLatest
                  ? `Handoff cycle ${handoffLatest.cycle_number}`
                  : "No handoff cycle yet"}
              </small>

              <div>
                {handoffLatest &&
                  !handoffLatest
                    .invalidated_at && (
                    <button
                      type="button"
                      disabled={
                        Boolean(
                          handoffAction,
                        )
                      }
                      onClick={
                        clearDeploymentHandoff
                      }
                    >
                      <RotateCcw
                        size={15}
                      />
                      {handoffAction ===
                      "reset"
                        ? "Resetting..."
                        : "Reset"}
                    </button>
                  )}

                <button
                  type="button"
                  onClick={
                    closeDeploymentHandoff
                  }
                  disabled={
                    Boolean(
                      handoffAction,
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  className={
                    styles.saveButton
                  }
                  type="button"
                  disabled={
                    !handoffCanSend ||
                    Boolean(
                      handoffAction,
                    )
                  }
                  onClick={
                    submitDeploymentHandoff
                  }
                >
                  <ClipboardCheck
                    size={16}
                  />
                  {handoffAction ===
                  "send"
                    ? "Sending..."
                    : handoffState ===
                        "not_sent" ||
                      handoffState ===
                        "changed"
                      ? "Send to Volunteer"
                      : "Resend handoff"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {commandBoardOpen && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={() =>
              setCommandBoardOpen(
                false,
              )
            }
            aria-label="Close Daily command board"
          />

          <section
            className={[
              styles.modal,
              styles.commandBoardModal,
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-command-board-title"
          >
            <header>
              <div>
                <span>
                  Leadership only
                </span>

                <h2
                  id="daily-command-board-title"
                >
                  Daily command board
                </h2>

                <p>
                  Schedule, deployment,
                  overdue work and
                  leadership action queues
                  in one operational view.
                </p>
              </div>

              <div
                className={
                  styles.analyticsHeaderActions
                }
              >
                <button
                  className={
                    styles.analyticsSwitchButton
                  }
                  type="button"
                  onClick={() => {
                    setCommandBoardOpen(
                      false,
                    );
                    setPerformanceOpen(
                      true,
                    );
                  }}
                >
                  <BarChart3
                    size={16}
                  />
                  Volunteer performance
                </button>

                <button
                  className={
                    styles.analyticsSwitchButton
                  }
                  type="button"
                  onClick={() => {
                    setCommandBoardOpen(
                      false,
                    );
                    setTurfOpen(
                      true,
                    );
                  }}
                >
                  <Target size={16} />
                  Turf coverage
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCommandBoardOpen(
                      false,
                    )
                  }
                  aria-label="Close Daily command board"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div
              className={
                styles.commandBoardBody
              }
            >
              <section
                className={
                  styles.commandDateToolbar
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setCommandBoardDate(
                      commandBoardShiftDate(
                        commandBoardDate,
                        -1,
                      ),
                    )
                  }
                >
                  <ChevronRight
                    className={
                      styles.commandPreviousIcon
                    }
                    size={16}
                  />
                  Previous
                </button>

                <div>
                  <span>
                    Selected operational
                    day
                  </span>

                  <strong>
                    {formatCommandBoardDate(
                      commandBoardDate,
                    )}
                  </strong>

                  <small>
                    {commandBoardDate ===
                    commandBoardToday
                      ? "Today"
                      : commandBoardDate <
                          commandBoardToday
                        ? "Past operational day"
                        : "Future operational day"}
                  </small>
                </div>

                <label>
                  <span>
                    Jump to date
                  </span>

                  <input
                    type="date"
                    value={
                      commandBoardDate
                    }
                    onChange={(event) =>
                      setCommandBoardDate(
                        event.target
                          .value ||
                          commandBoardTodayKey(),
                      )
                    }
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setCommandBoardDate(
                      commandBoardTodayKey(),
                    )
                  }
                >
                  <RotateCcw
                    size={16}
                  />
                  Today
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCommandBoardDate(
                      commandBoardShiftDate(
                        commandBoardDate,
                        1,
                      ),
                    )
                  }
                >
                  Next
                  <ChevronRight
                    size={16}
                  />
                </button>
              </section>

              <section
                className={
                  styles.commandMetricGrid
                }
              >
                <article>
                  <span>
                    Day assignments
                  </span>

                  <strong>
                    {
                      commandBoardSelectedAssignments.length
                    }
                  </strong>

                  <small>
                    Scheduled for the
                    selected day
                  </small>
                </article>

                <article>
                  <span>
                    Pending stops
                  </span>

                  <strong>
                    {
                      commandBoardSelectedPendingStops
                    }
                  </strong>

                  <small>
                    Remaining that day
                  </small>
                </article>

                <article>
                  <span>
                    Unassigned
                  </span>

                  <strong>
                    {
                      commandBoardUnassignedAssignments.length
                    }
                  </strong>

                  <small>
                    Active work needing a
                    Volunteer
                  </small>
                </article>

                <article>
                  <span>
                    Overdue
                  </span>

                  <strong>
                    {
                      commandBoardOverdueAssignments.length
                    }
                  </strong>

                  <small>
                    Earlier dated work with
                    pending stops
                  </small>
                </article>

                <article>
                  <span>
                    Attention
                  </span>

                  <strong>
                    {
                      commandBoardAttentionAssignments
                    }
                  </strong>

                  <small>
                    Unique assignments in
                    leadership queues
                  </small>
                </article>
              </section>

              <section
                className={
                  styles.commandSection
                }
              >
                <header>
                  <div>
                    <span>
                      Selected day
                    </span>

                    <h3>
                      Deployment status
                    </h3>
                  </div>

                  <small>
                    {
                      commandBoardSelectedAssignments.length
                    }
                    {" assignments"}
                  </small>
                </header>

                <div
                  className={
                    styles.commandStatusGrid
                  }
                >
                  {commandBoardStatusGroups.map(
                    (group) => (
                      <article
                        className={[
                          styles.commandStatusColumn,
                          styles[
                            `commandStatus_${group.key}`
                          ],
                        ]
                          .filter(
                            Boolean,
                          )
                          .join(" ")}
                        key={
                          group.key
                        }
                      >
                        <header>
                          <div>
                            <strong>
                              {
                                group.label
                              }
                            </strong>

                            <small>
                              {
                                group.description
                              }
                            </small>
                          </div>

                          <span>
                            {
                              group.assignments
                                .length
                            }
                          </span>
                        </header>

                        {group.assignments
                          .length ? (
                          <div
                            className={
                              styles.commandCompactList
                            }
                          >
                            {group.assignments.map(
                              (
                                assignment,
                              ) =>
                                renderCommandBoardAssignment(
                                  assignment,
                                ),
                            )}
                          </div>
                        ) : (
                          <p
                            className={
                              styles.commandEmpty
                            }
                          >
                            No assignments in
                            this status.
                          </p>
                        )}
                      </article>
                    ),
                  )}
                </div>
              </section>

              <section
                className={
                  styles.commandSection
                }
              >
                <header>
                  <div>
                    <span>
                      Leadership action
                    </span>

                    <h3>
                      Attention queues
                    </h3>
                  </div>

                  <small>
                    Review before field
                    deployment
                  </small>
                </header>

                <div
                  className={
                    styles.commandQueueGrid
                  }
                >
                  <article
                    className={
                      styles.commandQueueCard
                    }
                  >
                    <header>
                      <div>
                        <span>
                          Staffing
                        </span>

                        <h4>
                          Unassigned work
                        </h4>
                      </div>

                      <strong>
                        {
                          commandBoardUnassignedAssignments.length
                        }
                      </strong>
                    </header>

                    {commandBoardUnassignedAssignments
                      .length ? (
                      <div
                        className={
                          styles.commandQueueList
                        }
                      >
                        {commandBoardUnassignedAssignments.map(
                          (
                            assignment,
                          ) =>
                            renderCommandBoardAssignment(
                              assignment,
                            ),
                        )}
                      </div>
                    ) : (
                      <p
                        className={
                          styles.commandEmpty
                        }
                      >
                        Every active
                        assignment has a
                        Volunteer.
                      </p>
                    )}
                  </article>

                  <article
                    className={
                      styles.commandQueueCard
                    }
                  >
                    <header>
                      <div>
                        <span>
                          Timing
                        </span>

                        <h4>
                          Overdue routes
                        </h4>
                      </div>

                      <strong>
                        {
                          commandBoardOverdueAssignments.length
                        }
                      </strong>
                    </header>

                    {commandBoardOverdueAssignments
                      .length ? (
                      <div
                        className={
                          styles.commandQueueList
                        }
                      >
                        {commandBoardOverdueAssignments.map(
                          (
                            assignment,
                          ) =>
                            renderCommandBoardAssignment(
                              assignment,
                            ),
                        )}
                      </div>
                    ) : (
                      <p
                        className={
                          styles.commandEmpty
                        }
                      >
                        No earlier dated
                        assignment has
                        pending stops.
                      </p>
                    )}
                  </article>

                  <article
                    className={
                      styles.commandQueueCard
                    }
                  >
                    <header>
                      <div>
                        <span>
                          Completion
                        </span>

                        <h4>
                          Reviews waiting
                        </h4>
                      </div>

                      <strong>
                        {
                          commandBoardReviewQueue.length
                        }
                      </strong>
                    </header>

                    {commandBoardReviewQueue
                      .length ? (
                      <div
                        className={
                          styles.commandQueueList
                        }
                      >
                        {commandBoardReviewQueue.map(
                          (
                            assignment,
                          ) =>
                            renderCommandBoardAssignment(
                              assignment,
                              {
                                showReview:
                                  true,
                              },
                            ),
                        )}
                      </div>
                    ) : (
                      <p
                        className={
                          styles.commandEmpty
                        }
                      >
                        No completed
                        assignment is
                        waiting for review.
                      </p>
                    )}
                  </article>

                  <article
                    className={
                      styles.commandQueueCard
                    }
                  >
                    <header>
                      <div>
                        <span>
                          Follow-up
                        </span>

                        <h4>
                          Route opportunities
                        </h4>
                      </div>

                      <strong>
                        {
                          commandBoardFollowUpOpportunities.length
                        }
                      </strong>
                    </header>

                    {commandBoardFollowUpOpportunities
                      .length ? (
                      <div
                        className={
                          styles.commandQueueList
                        }
                      >
                        {commandBoardFollowUpOpportunities.map(
                          (
                            record,
                          ) =>
                            renderCommandBoardAssignment(
                              record.assignment,
                              {
                                showPlan:
                                  true,
                                opportunityCount:
                                  record.availableStops,
                              },
                            ),
                        )}
                      </div>
                    ) : (
                      <p
                        className={
                          styles.commandEmpty
                        }
                      >
                        No reviewed
                        unresolved result is
                        waiting for a new
                        route.
                      </p>
                    )}
                  </article>
                </div>
              </section>

              <section
                className={
                  styles.commandSection
                }
              >
                <header>
                  <div>
                    <span>
                      Next seven days
                    </span>

                    <h3>
                      Upcoming deployments
                    </h3>
                  </div>

                  <small>
                    Through{" "}
                    {formatCommandBoardDate(
                      commandBoardThroughDate,
                    )}
                  </small>
                </header>

                {commandBoardUpcomingAssignments
                  .length ? (
                  <div
                    className={
                      styles.commandWideList
                    }
                  >
                    {commandBoardUpcomingAssignments.map(
                      (
                        assignment,
                      ) =>
                        renderCommandBoardAssignment(
                          assignment,
                        ),
                    )}
                  </div>
                ) : (
                  <p
                    className={
                      styles.commandEmptyPanel
                    }
                  >
                    No active assignment is
                    scheduled in the next
                    seven days.
                  </p>
                )}
              </section>

              {commandBoardUndatedAssignments
                .length >
                0 && (
                <section
                  className={
                    styles.commandSection
                  }
                >
                  <header>
                    <div>
                      <span>
                        Scheduling
                      </span>

                      <h3>
                        Date not scheduled
                      </h3>
                    </div>

                    <small>
                      {
                        commandBoardUndatedAssignments.length
                      }
                      {" assignments"}
                    </small>
                  </header>

                  <div
                    className={
                      styles.commandWideList
                    }
                  >
                    {commandBoardUndatedAssignments.map(
                      (
                        assignment,
                      ) =>
                        renderCommandBoardAssignment(
                          assignment,
                        ),
                    )}
                  </div>
                </section>
              )}

              <footer
                className={
                  styles.commandPrivacy
                }
              >
                <ShieldCheck
                  size={16}
                />

                <span>
                  The Daily command board
                  uses only Campaign HQ
                  Field Operations records
                  already available to
                  leadership. Volunteer
                  pages, saved results,
                  reviews, route order and
                  source lineage are not
                  changed.
                </span>
              </footer>
            </div>
          </section>
        </div>
      )}

      {performanceOpen && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={() =>
              setPerformanceOpen(
                false,
              )
            }
            aria-label="Close Volunteer performance dashboard"
          />

          <section
            className={[
              styles.modal,
              styles.performanceModal,
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="volunteer-performance-title"
          >
            <header>
              <div>
                <span>
                  Leadership only
                </span>

                <h2
                  id="volunteer-performance-title"
                >
                  Volunteer performance
                </h2>

                <p>
                  Route activity and saved
                  field results across this
                  campaign workspace.
                </p>
              </div>

              <div className={styles.analyticsHeaderActions}>
                <button
                  className={styles.analyticsSwitchButton}
                  type="button"
                  onClick={() => {
                    setPerformanceOpen(
                      false,
                    );
                    setTurfOpen(
                      true,
                    );
                  }}
                >
                  <Target size={16} />
                  Turf coverage
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPerformanceOpen(
                      false,
                    )
                  }
                  aria-label="Close Volunteer performance dashboard"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className={styles.performanceBody}>
              <section className={styles.performanceFilters}>
                <label>
                  <span>
                    Volunteer
                  </span>

                  <select
                    value={
                      performanceVolunteerId
                    }
                    onChange={(event) =>
                      setPerformanceVolunteerId(
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="all">
                      All Volunteers
                    </option>

                    <option value="__unassigned__">
                      Unassigned work
                    </option>

                    {performanceVolunteerOptions
                      .map(
                        (
                          volunteer,
                        ) => (
                          <option
                            key={
                              volunteer.userId
                            }
                            value={
                              volunteer.userId
                            }
                          >
                            {
                              volunteer.fullName
                            }
                            {volunteer.email
                              ? ` - ${volunteer.email}`
                              : ""}
                          </option>
                        ),
                      )}
                  </select>
                </label>

                <label>
                  <span>
                    Assignment status
                  </span>

                  <select
                    value={
                      performanceStatus
                    }
                    onChange={(event) =>
                      setPerformanceStatus(
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="all">
                      All statuses
                    </option>
                    <option value="active">
                      Active work
                    </option>
                    <option value="assigned">
                      Assigned
                    </option>
                    <option value="accepted">
                      Accepted
                    </option>
                    <option value="in_progress">
                      In progress
                    </option>
                    <option value="completed">
                      Completed
                    </option>
                    <option value="needs_review">
                      Needs review
                    </option>
                    <option value="reviewed">
                      Reviewed
                    </option>
                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Work type
                  </span>

                  <select
                    value={
                      performanceWorkType
                    }
                    onChange={(event) =>
                      setPerformanceWorkType(
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="all">
                      Original + follow-up
                    </option>
                    <option value="original">
                      Original only
                    </option>
                    <option value="follow_up">
                      Follow-up only
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    From
                  </span>

                  <input
                    type="date"
                    value={
                      performanceDateFrom
                    }
                    onChange={(event) =>
                      setPerformanceDateFrom(
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Through
                  </span>

                  <input
                    type="date"
                    value={
                      performanceDateTo
                    }
                    onChange={(event) =>
                      setPerformanceDateTo(
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <button
                  type="button"
                  onClick={
                    resetPerformanceFilters
                  }
                >
                  Reset filters
                </button>
              </section>

              <div className={styles.performanceCountNote}>
                <ShieldCheck
                  size={16}
                />

                <p>
                  Every assignment and stop
                  is counted once. Follow-up
                  work remains separate from
                  its source and can be
                  included or excluded with
                  the Work type filter.
                  Date filters use the
                  assignment date, then the
                  scheduled start or creation
                  date when needed.
                </p>
              </div>

              <section className={styles.performanceMetricGrid}>
                <article>
                  <span>
                    Assignments
                  </span>

                  <strong>
                    {
                      performanceTotals
                        .assignments
                    }
                  </strong>

                  <small>
                    {
                      performanceTotals
                        .originalAssignments
                    }
                    {" original - "}
                    {
                      performanceTotals
                        .followUpAssignments
                    }
                    {" follow-up"}
                  </small>
                </article>

                <article>
                  <span>
                    Routes
                  </span>

                  <strong>
                    {
                      performanceTotals
                        .routes
                    }
                  </strong>

                  <small>
                    Across matching work
                  </small>
                </article>

                <article>
                  <span>
                    Stops recorded
                  </span>

                  <strong>
                    {
                      performanceTotals
                        .recordedStops
                    }
                    {" / "}
                    {
                      performanceTotals
                        .totalStops
                    }
                  </strong>

                  <small>
                    {
                      performanceTotals
                        .pendingStops
                    }
                    {" pending"}
                  </small>
                </article>

                <article>
                  <span>
                    Completion rate
                  </span>

                  <strong>
                    {
                      performanceCompletionRate
                    }
                    {"%"}
                  </strong>

                  <small>
                    Recorded of total stops
                  </small>
                </article>

                <article>
                  <span>
                    Contact rate
                  </span>

                  <strong>
                    {
                      performanceContactRate
                    }
                    {"%"}
                  </strong>

                  <small>
                    Contacted of recorded
                  </small>
                </article>

                <article>
                  <span>
                    Completion reviews
                  </span>

                  <strong>
                    {
                      performanceTotals
                        .reviewedAssignments
                    }
                    {" / "}
                    {
                      performanceTotals
                        .completedAssignments
                    }
                  </strong>

                  <small>
                    {
                      performanceTotals
                        .reviewPendingAssignments
                    }
                    {" awaiting review"}
                  </small>
                </article>
              </section>

              <section className={styles.performanceResults}>
                <header>
                  <div>
                    <span>
                      Saved field results
                    </span>

                    <strong>
                      Outcome mix
                    </strong>
                  </div>

                  <small>
                    {
                      performanceTotals
                        .recordedStops
                    }
                    {" recorded stops"}
                  </small>
                </header>

                <div className={styles.performanceResultGrid}>
                  {[
                    [
                      "Contacted",
                      performanceTotals
                        .contacted,
                    ],
                    [
                      "Not home",
                      performanceTotals
                        .not_home,
                    ],
                    [
                      "Refused",
                      performanceTotals
                        .refused,
                    ],
                    [
                      "Inaccessible",
                      performanceTotals
                        .inaccessible,
                    ],
                    [
                      "Moved",
                      performanceTotals
                        .moved,
                    ],
                    [
                      "Other",
                      performanceTotals
                        .other,
                    ],
                    [
                      "Skipped",
                      performanceTotals
                        .skipped,
                    ],
                    [
                      "Pending",
                      performanceTotals
                        .pendingStops,
                    ],
                  ].map(
                    ([
                      label,
                      value,
                    ]) => (
                      <article
                        key={
                          label
                        }
                      >
                        <span>
                          {label}
                        </span>

                        <strong>
                          {value}
                        </strong>
                      </article>
                    ),
                  )}
                </div>
              </section>

              <section className={styles.performanceSection}>
                <header>
                  <div>
                    <span>
                      Volunteer comparison
                    </span>

                    <h3>
                      Performance by Volunteer
                    </h3>
                  </div>

                  <small>
                    {
                      performanceRows.length
                    }
                    {" with matching work"}
                  </small>
                </header>

                {performanceRows.length ? (
                  <div className={styles.performanceVolunteerTable}>
                    <div className={styles.performanceTableHeader}>
                      <span>
                        Volunteer
                      </span>
                      <span>
                        Work
                      </span>
                      <span>
                        Stops
                      </span>
                      <span>
                        Completion
                      </span>
                      <span>
                        Contact
                      </span>
                      <span>
                        Reviews
                      </span>
                      <span>
                        Focus
                      </span>
                    </div>

                    {performanceRows.map(
                      (row) => {
                        const rowCompletionRate =
                          percentage(
                            row.totals
                              .recordedStops,
                            row.totals
                              .totalStops,
                          );

                        const rowContactRate =
                          percentage(
                            row.totals
                              .contacted,
                            row.totals
                              .recordedStops,
                          );

                        return (
                          <div
                            className={
                              styles.performanceVolunteerRow
                            }
                            key={
                              row.volunteerId
                            }
                          >
                            <div>
                              <strong>
                                {
                                  row.fullName
                                }
                              </strong>

                              <small>
                                {row.email ||
                                  "No account email"}
                              </small>
                            </div>

                            <div>
                              <strong>
                                {
                                  row.totals
                                    .assignments
                                }
                                {" assignments"}
                              </strong>

                              <small>
                                {
                                  row.totals
                                    .routes
                                }
                                {" routes"}
                              </small>
                            </div>

                            <div>
                              <strong>
                                {
                                  row.totals
                                    .recordedStops
                                }
                                {" / "}
                                {
                                  row.totals
                                    .totalStops
                                }
                              </strong>

                              <small>
                                {
                                  row.totals
                                    .pendingStops
                                }
                                {" pending"}
                              </small>
                            </div>

                            <div>
                              <strong>
                                {
                                  rowCompletionRate
                                }
                                {"%"}
                              </strong>

                              <small>
                                Recorded
                              </small>
                            </div>

                            <div>
                              <strong>
                                {
                                  rowContactRate
                                }
                                {"%"}
                              </strong>

                              <small>
                                {
                                  row.totals
                                    .contacted
                                }
                                {" contacted"}
                              </small>
                            </div>

                            <div>
                              <strong>
                                {
                                  row.totals
                                    .reviewedAssignments
                                }
                                {" / "}
                                {
                                  row.totals
                                    .completedAssignments
                                }
                              </strong>

                              <small>
                                Reviewed
                              </small>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setPerformanceVolunteerId(
                                  row.volunteerId,
                                )
                              }
                            >
                              Focus
                            </button>
                          </div>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <div className={styles.performanceEmpty}>
                    <UsersRound
                      size={28}
                    />

                    <strong>
                      No Volunteer results
                      match these filters
                    </strong>

                    <p>
                      Change the Volunteer,
                      status, work type or
                      date range.
                    </p>
                  </div>
                )}
              </section>

              <section className={styles.performanceSection}>
                <header>
                  <div>
                    <span>
                      Assignment detail
                    </span>

                    <h3>
                      Matching assignments
                    </h3>
                  </div>

                  <small>
                    {
                      performanceAssignments.length
                    }
                    {" assignments"}
                  </small>
                </header>

                {performanceAssignments.length ? (
                  <div className={styles.performanceAssignmentList}>
                    {performanceAssignments.map(
                      (assignment) => {
                        const summary =
                          completionSummary(
                            assignment,
                          );

                        const volunteer =
                          assignment
                            .volunteer_user_id
                            ? memberMap.get(
                                assignment
                                  .volunteer_user_id,
                              )
                            : null;

                        const assignmentCompletion =
                          percentage(
                            summary.recorded,
                            summary.total,
                          );

                        return (
                          <button
                            type="button"
                            key={
                              assignment.id
                            }
                            onClick={() =>
                              openPerformanceAssignment(
                                assignment.id,
                              )
                            }
                          >
                            <div>
                              <span>
                                {labelStatus(
                                  assignment.status,
                                )}
                                {assignment
                                  .source_assignment_id
                                  ? " - Follow-up"
                                  : " - Original"}
                              </span>

                              <strong>
                                {
                                  assignment.title
                                }
                              </strong>

                              <small>
                                {volunteer
                                  ?.fullName ||
                                  "Unassigned"}
                                {" - "}
                                {formatPerformanceDate(
                                  assignment,
                                )}
                              </small>
                            </div>

                            <div className={styles.performanceAssignmentStats}>
                              <span>
                                {
                                  (
                                    assignment
                                      .field_routes ||
                                    []
                                  ).length
                                }
                                {" routes"}
                              </span>

                              <span>
                                {
                                  summary.recorded
                                }
                                {" / "}
                                {
                                  summary.total
                                }
                                {" stops"}
                              </span>

                              <span>
                                {
                                  assignmentCompletion
                                }
                                {"% complete"}
                              </span>

                              <span>
                                {
                                  summary.totals
                                    .contacted
                                }
                                {" contacted"}
                              </span>

                              <span>
                                {assignment.status ===
                                "completed"
                                  ? reviewStatusLabel(
                                      assignment,
                                    )
                                  : "Review after completion"}
                              </span>
                            </div>

                            <ChevronRight
                              size={18}
                            />
                          </button>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <div className={styles.performanceEmpty}>
                    <Target
                      size={28}
                    />

                    <strong>
                      No assignments match
                    </strong>

                    <p>
                      Reset or change the
                      performance filters.
                    </p>
                  </div>
                )}
              </section>

              <footer className={styles.performancePrivacy}>
                <ShieldCheck
                  size={16}
                />

                <span>
                  This dashboard is built
                  only from Campaign HQ
                  field records already
                  available to leadership.
                  No campaign addresses,
                  Volunteer notes or
                  performance data are sent
                  to an external analytics
                  provider.
                </span>
              </footer>
            </div>
          </section>
        </div>
      )}

      {turfOpen && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={() =>
              setTurfOpen(
                false,
              )
            }
            aria-label="Close turf coverage dashboard"
          />

          <section
            className={[
              styles.modal,
              styles.performanceModal,
              styles.turfModal,
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="turf-coverage-title"
          >
            <header>
              <div>
                <span>
                  Leadership only
                </span>

                <h2
                  id="turf-coverage-title"
                >
                  Turf coverage and priorities
                </h2>

                <p>
                  Coverage, unresolved field
                  work and follow-up demand by
                  precinct and turf.
                </p>
              </div>

              <div className={styles.analyticsHeaderActions}>
                <button
                  className={styles.analyticsSwitchButton}
                  type="button"
                  onClick={() => {
                    setTurfOpen(
                      false,
                    );
                    setPerformanceOpen(
                      true,
                    );
                  }}
                >
                  <BarChart3
                    size={16}
                  />
                  Volunteer performance
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTurfOpen(
                      false,
                    )
                  }
                  aria-label="Close turf coverage dashboard"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className={styles.performanceBody}>
              <section
                className={[
                  styles.performanceFilters,
                  styles.turfFilters,
                ].join(" ")}
              >
                <label>
                  <span>
                    Precinct
                  </span>

                  <select
                    value={
                      turfPrecinctFilter
                    }
                    onChange={(event) => {
                      setTurfPrecinctFilter(
                        event.target
                          .value,
                      );
                      setTurfNameFilter(
                        "all",
                      );
                    }}
                  >
                    <option value="all">
                      All precincts
                    </option>

                    {turfPrecinctOptions.map(
                      (precinct) => (
                        <option
                          key={
                            precinct
                          }
                          value={
                            precinct
                          }
                        >
                          {precinct}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    Turf
                  </span>

                  <select
                    value={
                      turfNameFilter
                    }
                    onChange={(event) =>
                      setTurfNameFilter(
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="all">
                      All turfs
                    </option>

                    {turfNameOptions.map(
                      (turfName) => (
                        <option
                          key={
                            turfName
                          }
                          value={
                            turfName
                          }
                        >
                          {turfName}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    Assignment status
                  </span>

                  <select
                    value={
                      turfStatus
                    }
                    onChange={(event) =>
                      setTurfStatus(
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="all">
                      All statuses
                    </option>
                    <option value="active">
                      Active work
                    </option>
                    <option value="assigned">
                      Assigned
                    </option>
                    <option value="accepted">
                      Accepted
                    </option>
                    <option value="in_progress">
                      In progress
                    </option>
                    <option value="completed">
                      Completed
                    </option>
                    <option value="needs_review">
                      Needs review
                    </option>
                    <option value="reviewed">
                      Reviewed
                    </option>
                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Work type
                  </span>

                  <select
                    value={
                      turfWorkType
                    }
                    onChange={(event) =>
                      setTurfWorkType(
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="all">
                      Original + follow-up
                    </option>
                    <option value="original">
                      Original only
                    </option>
                    <option value="follow_up">
                      Follow-up only
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    From
                  </span>

                  <input
                    type="date"
                    value={
                      turfDateFrom
                    }
                    onChange={(event) =>
                      setTurfDateFrom(
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Through
                  </span>

                  <input
                    type="date"
                    value={
                      turfDateTo
                    }
                    onChange={(event) =>
                      setTurfDateTo(
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <button
                  type="button"
                  onClick={
                    resetTurfFilters
                  }
                >
                  Reset filters
                </button>
              </section>

              <div className={styles.performanceCountNote}>
                <ShieldCheck
                  size={16}
                />

                <p>
                  Coverage uses the precinct
                  and turf saved on each field
                  assignment. Priority backlog
                  counts pending, not home,
                  inaccessible, moved and other
                  results. Original and follow-up
                  assignments remain separate.
                </p>
              </div>

              <section className={styles.performanceMetricGrid}>
                <article>
                  <span>
                    Areas
                  </span>

                  <strong>
                    {
                      turfRows.length
                    }
                  </strong>

                  <small>
                    Matching precinct and turf pairs
                  </small>
                </article>

                <article>
                  <span>
                    Assignments
                  </span>

                  <strong>
                    {
                      turfTotals
                        .assignments
                    }
                  </strong>

                  <small>
                    {
                      turfTotals
                        .originalAssignments
                    }
                    {" original - "}
                    {
                      turfTotals
                        .followUpAssignments
                    }
                    {" follow-up"}
                  </small>
                </article>

                <article>
                  <span>
                    Stops recorded
                  </span>

                  <strong>
                    {
                      turfTotals
                        .recordedStops
                    }
                    {" / "}
                    {
                      turfTotals
                        .totalStops
                    }
                  </strong>

                  <small>
                    {
                      turfTotals
                        .pendingStops
                    }
                    {" pending"}
                  </small>
                </article>

                <article>
                  <span>
                    Completion rate
                  </span>

                  <strong>
                    {
                      turfCompletionRate
                    }
                    {"%"}
                  </strong>

                  <small>
                    Recorded of total stops
                  </small>
                </article>

                <article>
                  <span>
                    Contact rate
                  </span>

                  <strong>
                    {
                      turfContactRate
                    }
                    {"%"}
                  </strong>

                  <small>
                    Contacted of recorded
                  </small>
                </article>

                <article>
                  <span>
                    Priority backlog
                  </span>

                  <strong>
                    {
                      turfPriorityBacklog
                    }
                  </strong>

                  <small>
                    Pending or unresolved results
                  </small>
                </article>
              </section>

              <section className={styles.performanceResults}>
                <header>
                  <div>
                    <span>
                      Follow-up priorities
                    </span>

                    <strong>
                      Priority outcome mix
                    </strong>
                  </div>

                  <small>
                    {
                      turfTotals
                        .recordedStops
                    }
                    {" recorded stops"}
                  </small>
                </header>

                <div className={styles.performanceResultGrid}>
                  {[
                    [
                      "Pending",
                      turfTotals
                        .pendingStops,
                    ],
                    [
                      "Not home",
                      turfTotals
                        .not_home,
                    ],
                    [
                      "Inaccessible",
                      turfTotals
                        .inaccessible,
                    ],
                    [
                      "Moved",
                      turfTotals
                        .moved,
                    ],
                    [
                      "Other",
                      turfTotals
                        .other,
                    ],
                    [
                      "Skipped",
                      turfTotals
                        .skipped,
                    ],
                    [
                      "Contacted",
                      turfTotals
                        .contacted,
                    ],
                    [
                      "Refused",
                      turfTotals
                        .refused,
                    ],
                  ].map(
                    ([
                      label,
                      value,
                    ]) => (
                      <article
                        key={
                          label
                        }
                      >
                        <span>
                          {label}
                        </span>

                        <strong>
                          {value}
                        </strong>
                      </article>
                    ),
                  )}
                </div>
              </section>

              <section className={styles.performanceSection}>
                <header>
                  <div>
                    <span>
                      Coverage comparison
                    </span>

                    <h3>
                      Coverage by precinct and turf
                    </h3>
                  </div>

                  <small>
                    {
                      turfRows.length
                    }
                    {" matching areas"}
                  </small>
                </header>

                {turfRows.length ? (
                  <div className={styles.turfCoverageGrid}>
                    {turfRows.map(
                      (row) => {
                        const rowCompletion =
                          percentage(
                            row.totals
                              .recordedStops,
                            row.totals
                              .totalStops,
                          );

                        const rowContact =
                          percentage(
                            row.totals
                              .contacted,
                            row.totals
                              .recordedStops,
                          );

                        const rowActionCandidates =
                          turfActionCandidateRecords(
                            row.assignments,
                            followedUpSourceIds,
                          );

                        const rowReadyCount =
                          rowActionCandidates
                            .filter(
                              (candidate) =>
                                candidate.selectable,
                            ).length;

                        const rowActivePendingCount =
                          rowActionCandidates
                            .filter(
                              (candidate) =>
                                candidate
                                  .availability ===
                                "active_pending",
                            ).length;

                        return (
                          <article
                            className={styles.turfCoverageCard}
                            key={
                              row.key
                            }
                          >
                            <header>
                              <div>
                                <span>
                                  {row.precinct}
                                </span>

                                <h4>
                                  {row.turfName}
                                </h4>
                              </div>

                              <strong
                                className={styles.turfPriorityBadge}
                                data-tone={
                                  row.priority
                                    .tone
                                }
                              >
                                {
                                  row.priority
                                    .label
                                }
                              </strong>
                            </header>

                            <div className={styles.turfCoverageStats}>
                              <div>
                                <span>
                                  Assignments
                                </span>
                                <strong>
                                  {
                                    row.totals
                                      .assignments
                                  }
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Stops
                                </span>
                                <strong>
                                  {
                                    row.totals
                                      .recordedStops
                                  }
                                  {" / "}
                                  {
                                    row.totals
                                      .totalStops
                                  }
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Completion
                                </span>
                                <strong>
                                  {
                                    rowCompletion
                                  }
                                  {"%"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Contact
                                </span>
                                <strong>
                                  {
                                    rowContact
                                  }
                                  {"%"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Priority work
                                </span>
                                <strong>
                                  {
                                    row.unresolved
                                  }
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Follow-ups
                                </span>
                                <strong>
                                  {
                                    row.totals
                                      .followUpAssignments
                                  }
                                </strong>
                              </div>
                            </div>

                            <footer>
                              <span>
                                {
                                  row.totals
                                    .pendingStops
                                }
                                {" pending - "}
                                {
                                  row.totals
                                    .not_home
                                }
                                {" not home - "}
                                {
                                  row.totals
                                    .inaccessible
                                }
                                {" inaccessible"}
                                {rowActivePendingCount
                                  ? ` - ${rowActivePendingCount} already active`
                                  : ""}
                              </span>

                              <div className={styles.turfCoverageActions}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    focusTurfArea(
                                      row,
                                    )
                                  }
                                >
                                  Focus area
                                </button>

                                <button
                                  className={styles.turfPlanButton}
                                  type="button"
                                  disabled={
                                    !rowReadyCount
                                  }
                                  title={
                                    rowReadyCount
                                      ? `Plan from ${rowReadyCount} reviewed source stops`
                                      : "No reviewed source stops are available for a new route"
                                  }
                                  onClick={() =>
                                    openTurfActionPlanner(
                                      row,
                                    )
                                  }
                                >
                                  <Plus size={15} />
                                  Plan next route
                                </button>
                              </div>
                            </footer>
                          </article>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <div className={styles.performanceEmpty}>
                    <MapPin
                      size={28}
                    />

                    <strong>
                      No turf coverage matches
                    </strong>

                    <p>
                      Change the precinct, turf,
                      status, work type or date
                      filters.
                    </p>
                  </div>
                )}
              </section>

              <section className={styles.performanceSection}>
                <header>
                  <div>
                    <span>
                      Action queue
                    </span>

                    <h3>
                      Follow-up priority assignments
                    </h3>
                  </div>

                  <small>
                    {
                      turfPriorityAssignments.length
                    }
                    {" assignments with priority work"}
                  </small>
                </header>

                {turfPriorityAssignments.length ? (
                  <div className={styles.performanceAssignmentList}>
                    {turfPriorityAssignments.map(
                      (assignment) => {
                        const summary =
                          completionSummary(
                            assignment,
                          );

                        const unresolved =
                          summary.totals
                            .pending +
                          summary.totals
                            .not_home +
                          summary.totals
                            .inaccessible +
                          summary.totals
                            .moved +
                          summary.totals
                            .other;

                        return (
                          <button
                            type="button"
                            key={
                              assignment.id
                            }
                            onClick={() =>
                              openTurfAssignment(
                                assignment.id,
                              )
                            }
                          >
                            <div>
                              <span>
                                {fieldAreaLabel(
                                  assignment.precinct,
                                  "Unassigned precinct",
                                )}
                                {" - "}
                                {fieldAreaLabel(
                                  assignment.turf_name,
                                  "Unassigned turf",
                                )}
                              </span>

                              <strong>
                                {
                                  assignment.title
                                }
                              </strong>

                              <small>
                                {labelStatus(
                                  assignment.status,
                                )}
                                {" - "}
                                {formatPerformanceDate(
                                  assignment,
                                )}
                              </small>
                            </div>

                            <div className={styles.performanceAssignmentStats}>
                              <span>
                                {
                                  unresolved
                                }
                                {" priority results"}
                              </span>

                              <span>
                                {
                                  summary.totals
                                    .pending
                                }
                                {" pending"}
                              </span>

                              <span>
                                {
                                  summary.totals
                                    .not_home
                                }
                                {" not home"}
                              </span>

                              <span>
                                {assignment
                                  .source_assignment_id
                                  ? "Follow-up"
                                  : "Original"}
                              </span>

                              <span>
                                {assignment.status ===
                                "completed"
                                  ? reviewStatusLabel(
                                      assignment,
                                    )
                                  : "Review after completion"}
                              </span>
                            </div>

                            <ChevronRight
                              size={18}
                            />
                          </button>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <div className={styles.performanceEmpty}>
                    <Target
                      size={28}
                    />

                    <strong>
                      No priority assignments
                    </strong>

                    <p>
                      The matching work has no
                      pending or unresolved results.
                    </p>
                  </div>
                )}
              </section>

              <footer className={styles.performancePrivacy}>
                <ShieldCheck
                  size={16}
                />

                <span>
                  This dashboard uses only
                  Campaign HQ field records
                  already available to
                  leadership. It does not send
                  campaign addresses, Volunteer
                  notes or coverage data to an
                  external analytics provider.
                </span>
              </footer>
            </div>
          </section>
        </div>
      )}

      {turfPlannerRow && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={closeTurfActionPlanner}
            aria-label="Close Turf Action Planner"
          />

          <section
            className={[
              styles.modal,
              styles.turfPlannerModal,
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="turf-action-planner-title"
          >
            <header>
              <div>
                <span>
                  Leadership only
                </span>

                <h2
                  id="turf-action-planner-title"
                >
                  Plan the next turf routes
                </h2>

                <p>
                  {turfPlannerRow.precinct}
                  {" - "}
                  {turfPlannerRow.turfName}
                </p>
              </div>

              <button
                type="button"
                onClick={closeTurfActionPlanner}
                aria-label="Close Turf Action Planner"
                disabled={isSaving}
              >
                <X size={20} />
              </button>
            </header>

            <form
              className={styles.turfPlannerForm}
              onSubmit={submitTurfActionPlan}
            >
              <div className={styles.turfPlannerBody}>
                <section className={styles.turfPlannerNotice}>
                  <ShieldCheck
                    size={20}
                  />

                  <div>
                    <strong>
                      One click, with protected source history
                    </strong>

                    <p>
                      Reviewed selections are
                      split into one generated
                      assignment per source
                      assignment so every stop
                      keeps an exact lineage
                      trail. Pending stops stay
                      in their existing active
                      assignment and are never
                      duplicated.
                    </p>
                  </div>
                </section>

                {turfPlannerError && (
                  <section
                    className={styles.error}
                    role="alert"
                  >
                    <AlertTriangle
                      size={18}
                    />
                    <span>
                      {turfPlannerError}
                    </span>
                  </section>
                )}

                <section className={styles.turfPlannerFields}>
                  <label className={styles.turfPlannerWideField}>
                    <span>
                      Plan title
                    </span>

                    <input
                      type="text"
                      value={
                        turfPlannerForm
                          .title
                      }
                      maxLength={160}
                      onChange={(event) =>
                        setTurfPlannerForm(
                          (current) => ({
                            ...current,
                            title:
                              event.target
                                .value,
                          }),
                        )
                      }
                      required
                    />
                  </label>

                  <label>
                    <span>
                      Volunteer
                    </span>

                    <select
                      value={
                        turfPlannerForm
                          .volunteerUserId
                      }
                      onChange={(event) =>
                        setTurfPlannerForm(
                          (current) => ({
                            ...current,
                            volunteerUserId:
                              event.target
                                .value,
                          }),
                        )
                      }
                    >
                      <option value="">
                        Leave unassigned
                      </option>

                      {volunteers.map(
                        (volunteer) => (
                          <option
                            key={
                              volunteer.userId
                            }
                            value={
                              volunteer.userId
                            }
                          >
                            {
                              volunteer.fullName
                            }
                            {volunteer.email
                              ? ` - ${volunteer.email}`
                              : ""}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    <span>
                      Assignment date
                    </span>

                    <input
                      type="date"
                      value={
                        turfPlannerForm
                          .assignmentDate
                      }
                      onChange={(event) =>
                        setTurfPlannerForm(
                          (current) => ({
                            ...current,
                            assignmentDate:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label className={styles.turfPlannerWideField}>
                    <span>
                      Meeting point
                    </span>

                    <input
                      type="text"
                      value={
                        turfPlannerForm
                          .meetingLocation
                      }
                      onChange={(event) =>
                        setTurfPlannerForm(
                          (current) => ({
                            ...current,
                            meetingLocation:
                              event.target
                                .value,
                          }),
                        )
                      }
                      placeholder="Optional meeting address"
                    />
                  </label>

                  <label>
                    <span>
                      Route finish
                    </span>

                    <select
                      value={
                        turfPlannerForm
                          .finishMode
                      }
                      onChange={(event) =>
                        setTurfPlannerForm(
                          (current) => ({
                            ...current,
                            finishMode:
                              event.target
                                .value,
                          }),
                        )
                      }
                    >
                      <option value="final_stop">
                        End at final stop
                      </option>

                      <option value="return_start">
                        Return to starting stop
                      </option>

                      <option value="meeting_point">
                        Return to meeting point
                      </option>
                    </select>
                  </label>

                  <label className={styles.turfPlannerWideField}>
                    <span>
                      Volunteer instructions
                    </span>

                    <textarea
                      value={
                        turfPlannerForm
                          .instructions
                      }
                      maxLength={3000}
                      onChange={(event) =>
                        setTurfPlannerForm(
                          (current) => ({
                            ...current,
                            instructions:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>
                </section>

                <section className={styles.turfPlannerSelection}>
                  <header>
                    <div>
                      <span>
                        Priority addresses
                      </span>

                      <h3>
                        Choose reviewed stops
                      </h3>

                      <p>
                        Suggested unresolved
                        results are selected.
                        Contacted and refused
                        stops remain optional.
                      </p>
                    </div>

                    <strong>
                      {
                        turfPlannerSelectedCandidates.length
                      }
                      {" selected - "}
                      {
                        turfPlannerSelectedGroupCount
                      }
                      {" "}
                      {turfPlannerSelectedGroupCount ===
                      1
                        ? "route"
                        : "routes"}
                    </strong>
                  </header>

                  {turfPlannerActivePendingCount >
                    0 && (
                    <div className={styles.turfPlannerPendingNotice}>
                      <Circle
                        size={16}
                      />

                      <span>
                        {
                          turfPlannerActivePendingCount
                        }
                        {" pending "}
                        {turfPlannerActivePendingCount ===
                        1
                          ? "stop is"
                          : "stops are"}
                        {" already active and cannot be duplicated. Open the source assignment to manage that work."}
                      </span>
                    </div>
                  )}

                  <div className={styles.turfPlannerGroups}>
                    {turfPlannerGroups.map(
                      (group) => (
                        <section
                          className={styles.turfPlannerGroup}
                          key={
                            group.assignment
                              .id
                          }
                        >
                          <header>
                            <div>
                              <span>
                                Source assignment
                              </span>

                              <strong>
                                {
                                  group.assignment
                                    .title
                                }
                              </strong>

                              <small>
                                {labelStatus(
                                  group.assignment
                                    .status,
                                )}
                                {" - "}
                                {reviewStatusLabel(
                                  group.assignment,
                                )}
                                {" - "}
                                {formatPerformanceDate(
                                  group.assignment,
                                )}
                              </small>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                openTurfPlannerSource(
                                  group.assignment
                                    .id,
                                )
                              }
                              disabled={isSaving}
                            >
                              Open assignment
                              <ChevronRight
                                size={15}
                              />
                            </button>
                          </header>

                          <div className={styles.turfPlannerStops}>
                            {group.candidates.map(
                              (candidate) => (
                                <label
                                  className={styles.turfPlannerStop}
                                  data-disabled={
                                    candidate.selectable
                                      ? "false"
                                      : "true"
                                  }
                                  key={
                                    candidate.stop
                                      .id
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      candidate.selectable &&
                                      turfPlannerStopIds
                                        .includes(
                                          candidate.stop
                                            .id,
                                        )
                                    }
                                    disabled={
                                      !candidate.selectable ||
                                      isSaving
                                    }
                                    onChange={() =>
                                      toggleTurfPlannerStop(
                                        candidate.stop
                                          .id,
                                      )
                                    }
                                  />

                                  <div className={styles.turfPlannerStopOrder}>
                                    {
                                      candidate.route
                                        .route_order
                                    }
                                    {"."}
                                    {
                                      candidate.stop
                                        .stop_order
                                    }
                                  </div>

                                  <div className={styles.turfPlannerStopCopy}>
                                    <strong>
                                      {stopName(
                                        candidate.stop,
                                      )}
                                    </strong>

                                    <span>
                                      {getAddress(
                                        candidate.stop,
                                      )}
                                    </span>

                                    <small>
                                      {
                                        candidate.route
                                          .name
                                      }
                                      {" - "}
                                      {sourceResultLabel(
                                        candidate.stop,
                                      )}
                                      {candidate.stop
                                        .completed_at
                                        ? ` - ${formatDateTime(
                                            candidate.stop
                                              .completed_at,
                                          )}`
                                        : ""}
                                    </small>

                                    {candidate.stop
                                      .volunteer_notes && (
                                      <p>
                                        <MessageSquareText
                                          size={13}
                                        />
                                        {
                                          candidate.stop
                                            .volunteer_notes
                                        }
                                      </p>
                                    )}
                                  </div>

                                  <span
                                    className={styles.turfPlannerAvailability}
                                    data-state={
                                      candidate
                                        .availability
                                    }
                                  >
                                    {turfActionAvailabilityLabel(
                                      candidate,
                                    )}
                                  </span>
                                </label>
                              ),
                            )}
                          </div>
                        </section>
                      ),
                    )}
                  </div>
                </section>
              </div>

              <footer className={styles.turfPlannerFooter}>
                <p>
                  Original results, notes,
                  completion times and reviews
                  remain unchanged.
                </p>

                <div>
                  <button
                    type="button"
                    onClick={closeTurfActionPlanner}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>

                  <button
                    className={styles.primaryButton}
                    type="submit"
                    disabled={
                      isSaving ||
                      !turfPlannerSelectedCandidates
                        .length
                    }
                  >
                    {turfPlannerAction ===
                    "creating" ? (
                      <LoaderCircle
                        className={styles.spinning}
                        size={16}
                      />
                    ) : (
                      <Plus size={16} />
                    )}

                    {turfPlannerAction ===
                    "creating"
                      ? "Creating plan..."
                      : `Create ${
                          turfPlannerSelectedGroupCount ||
                          0
                        } ${
                          turfPlannerSelectedGroupCount ===
                          1
                            ? "route"
                            : "routes"
                        }`}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      )}

      {reviewAssignment && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={closeCompletionReview}
            aria-label="Close completion review"
          />

          <section
            className={[
              styles.modal,
              styles.reviewModal,
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="completion-review-title"
          >
            <header>
              <div>
                <span>
                  Leadership only
                </span>

                <h2
                  id="completion-review-title"
                >
                  Completion review
                </h2>

                <p>
                  {
                    reviewAssignment.title
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={closeCompletionReview}
                aria-label="Close completion review"
                disabled={isSaving}
              >
                <X size={20} />
              </button>
            </header>

            <div className={styles.reviewBody}>
              <div className={styles.reviewSummaryGrid}>
                {[
                  [
                    "Recorded",
                    reviewSummary.recorded,
                  ],
                  [
                    "Pending",
                    reviewSummary.totals.pending,
                  ],
                  [
                    "Contacted",
                    reviewSummary.totals.contacted,
                  ],
                  [
                    "Not home",
                    reviewSummary.totals.not_home,
                  ],
                  [
                    "Refused",
                    reviewSummary.totals.refused,
                  ],
                  [
                    "Inaccessible",
                    reviewSummary.totals.inaccessible,
                  ],
                  [
                    "Moved",
                    reviewSummary.totals.moved,
                  ],
                  [
                    "Other",
                    reviewSummary.totals.other,
                  ],
                  [
                    "Skipped",
                    reviewSummary.totals.skipped,
                  ],
                ].map(
                  ([
                    label,
                    value,
                  ]) => (
                    <article key={label}>
                      <span>
                        {label}
                      </span>
                      <strong>
                        {value}
                      </strong>
                    </article>
                  ),
                )}
              </div>

              <div
                className={[
                  styles.reviewReadiness,
                  reviewSummary.ready
                    ? styles.readyReview
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {reviewSummary.ready ? (
                  <CheckCircle2
                    size={19}
                  />
                ) : (
                  <AlertTriangle
                    size={19}
                  />
                )}

                <div>
                  <strong>
                    {reviewSummary.ready
                      ? "Ready to mark reviewed"
                      : "Review is not ready yet"}
                  </strong>

                  <p>
                    {reviewSummary.total ===
                    0
                      ? "This assignment does not have any route stops."
                      : reviewSummary.totals.pending >
                          0
                        ? `${reviewSummary.totals.pending} stops remain unrecorded.`
                        : reviewAssignment.status !==
                            "completed"
                          ? "Every stop is recorded, but the Volunteer has not completed the assignment."
                          : "Every stop has a saved result or skipped status."}
                  </p>
                </div>
              </div>

              <div className={styles.reviewRoutes}>
                {(
                  reviewAssignment.field_routes ||
                  []
                ).map(
                  (route) => (
                    <section
                      className={styles.reviewRoute}
                      key={route.id}
                    >
                      <header>
                        <div>
                          <span>
                            Route{" "}
                            {
                              route.route_order
                            }
                          </span>

                          <strong>
                            {route.name}
                          </strong>
                        </div>

                        <small>
                          {
                            (
                              route.field_stops ||
                              []
                            ).filter(
                              (stop) =>
                                stop.status !==
                                "pending",
                            ).length
                          }
                          {" / "}
                          {
                            (
                              route.field_stops ||
                              []
                            ).length
                          }
                          {" recorded"}
                        </small>
                      </header>

                      <div>
                        {sortedRouteStops(
                          route,
                        ).map(
                          (stop) => (
                            <article
                              className={styles.reviewStopRow}
                              key={stop.id}
                            >
                              <span className={styles.reviewStopNumber}>
                                {
                                  stop.stop_order
                                }
                              </span>

                              <div className={styles.reviewStopCopy}>
                                <strong>
                                  {stopName(
                                    stop,
                                  )}
                                </strong>

                                <span>
                                  {getAddress(
                                    stop,
                                  )}
                                </span>

                                {stop.volunteer_notes && (
                                  <p className={styles.reviewNote}>
                                    <MessageSquareText
                                      size={14}
                                    />
                                    {
                                      stop.volunteer_notes
                                    }
                                  </p>
                                )}
                                {stop.source_trail && (
                                  <div className={styles.reviewSourceSnapshot}>
                                    <span>
                                      Source result
                                    </span>

                                    <strong>
                                      {sourceResultLabel(
                                        stop.source_trail,
                                      )}
                                      {" - "}
                                      {formatDateTime(
                                        stop.source_trail
                                          .completed_at,
                                      )}
                                    </strong>

                                    <small>
                                      {
                                        stop.source_trail
                                          .assignment
                                          .title
                                      }
                                      {" - "}
                                      {getAddress(
                                        stop.source_trail,
                                      )}
                                    </small>

                                    {stop.source_trail
                                      .volunteer_notes && (
                                      <p>
                                        <MessageSquareText
                                          size={13}
                                        />
                                        {
                                          stop.source_trail
                                            .volunteer_notes
                                        }
                                      </p>
                                    )}
                                  </div>
                                )}

                                {(
                                  stop
                                    .generated_follow_up_history ||
                                  []
                                ).length > 0 && (
                                  <div className={styles.reviewFollowUpLinks}>
                                    <span>
                                      Generated follow-up work
                                    </span>

                                    {stop
                                      .generated_follow_up_history
                                      .map(
                                        (
                                          followUpStop,
                                        ) => (
                                          <button
                                            type="button"
                                            key={
                                              followUpStop.id
                                            }
                                            onClick={() =>
                                              openLinkedAssignment(
                                                followUpStop
                                                  .assignment
                                                  .id,
                                              )
                                            }
                                          >
                                            {followUpGenerationLabel(
                                              followUpStop
                                                .generation_distance,
                                            )}
                                            {": "}
                                            {
                                              followUpStop
                                                .assignment
                                                .title
                                            }
                                          </button>
                                        ),
                                      )}
                                  </div>
                                )}
                              </div>

                              <div className={styles.reviewResult}>
                                <strong>
                                  {stop.status ===
                                  "pending"
                                    ? "Unrecorded"
                                    : stop.status ===
                                        "skipped"
                                      ? "Skipped"
                                      : labelStatus(
                                          stop.result_code ||
                                            stop.status,
                                        )}
                                </strong>

                                <small>
                                  {stop.completed_at
                                    ? formatDateTime(
                                        stop.completed_at,
                                      )
                                    : labelStatus(
                                        stop.status,
                                      )}
                                </small>
                              </div>
                            </article>
                          ),
                        )}
                      </div>
                    </section>
                  ),
                )}
              </div>

              {(
                (
                  reviewAssignment
                    .source_chain ||
                  []
                ).length > 0 ||
                (
                  reviewAssignment
                    .generated_follow_up_history ||
                  []
                ).length > 0
              ) && (
                <section className={styles.reviewHistoryPanel}>
                  <header>
                    <div>
                      <span>
                        <Route size={15} />
                        Assignment source trail
                      </span>

                      <strong>
                        Review linked field work
                      </strong>
                    </div>
                  </header>

                  {(
                    reviewAssignment
                      .source_chain ||
                    []
                  ).length > 0 && (
                    <div className={styles.reviewHistoryGroup}>
                      <small>
                        Generated from
                      </small>

                      {reviewAssignment
                        .source_chain
                        .map(
                          (
                            source,
                            index,
                          ) => (
                            <button
                              type="button"
                              key={
                                source.id
                              }
                              onClick={() =>
                                openLinkedAssignment(
                                  source.id,
                                )
                              }
                            >
                              <strong>
                                {
                                  source.title
                                }
                              </strong>

                              <span>
                                {index === 0
                                  ? "Direct source"
                                  : `Earlier source - generation ${
                                      index +
                                      1
                                    }`}
                                {" - "}
                                {labelStatus(
                                  source.status,
                                )}
                              </span>
                            </button>
                          ),
                        )}
                    </div>
                  )}

                  {(
                    reviewAssignment
                      .generated_follow_up_history ||
                    []
                  ).length > 0 && (
                    <div className={styles.reviewHistoryGroup}>
                      <small>
                        Generated follow-ups
                      </small>

                      {reviewAssignment
                        .generated_follow_up_history
                        .map(
                          (followUp) => (
                            <button
                              type="button"
                              key={
                                followUp.id
                              }
                              onClick={() =>
                                openLinkedAssignment(
                                  followUp.id,
                                )
                              }
                            >
                              <strong>
                                {
                                  followUp.title
                                }
                              </strong>

                              <span>
                                {followUpGenerationLabel(
                                  followUp
                                    .generation_distance,
                                )}
                                {" - "}
                                {labelStatus(
                                  followUp.status,
                                )}
                              </span>
                            </button>
                          ),
                        )}
                    </div>
                  )}
                </section>
              )}

              <label className={styles.reviewForm}>
                <span>
                  Private leadership note
                </span>

                <textarea
                  value={reviewNotes}
                  onChange={(event) =>
                    setReviewNotes(
                      event.target.value,
                    )
                  }
                  maxLength={5000}
                  rows={5}
                  placeholder="Add internal follow-up, quality-control notes or corrections. This is never loaded in the Volunteer view."
                />

                <small>
                  Leadership only ·{" "}
                  {
                    reviewNotes.length
                  }
                  {" / 5000"}
                </small>
              </label>

              {reviewRecord.review_status ===
                "reviewed" && (
                <div className={styles.reviewedBy}>
                  <ClipboardCheck
                    size={18}
                  />

                  <div>
                    <span>
                      Reviewed by
                    </span>

                    <strong>
                      {reviewMember
                        ?.fullName ||
                        "Campaign leadership"}
                    </strong>

                    <small>
                      {formatDateTime(
                        reviewRecord.reviewed_at,
                      )}
                    </small>
                  </div>
                </div>
              )}

              {reviewError && (
                <div
                  className={styles.formError}
                  role="alert"
                >
                  <AlertTriangle
                    size={17}
                  />
                  {reviewError}
                </div>
              )}

              <footer className={styles.reviewFooter}>
                <button
                  type="button"
                  onClick={() =>
                    submitReviewAction(
                      "save_note",
                    )
                  }
                  disabled={isSaving}
                >
                  <MessageSquareText
                    size={16}
                  />
                  {reviewAction ===
                  "save_note"
                    ? "Saving…"
                    : "Save private note"}
                </button>


                {reviewRecord.review_status ===
                  "reviewed" && (
                  <button
                    className={styles.followUpButton}
                    type="button"
                    onClick={() =>
                      openFollowUpGenerator(
                        reviewAssignment,
                      )
                    }
                    disabled={
                      isSaving ||
                      !assignmentStops(
                        reviewAssignment,
                      ).some(
                        (stop) =>
                          stop.status !==
                            "pending" &&
                          !followedUpSourceIds
                            .has(
                              stop.id,
                            ),
                      )
                    }
                    title="Create new pending work from selected recorded stops"
                  >
                    <Route size={16} />
                    Create follow-up
                  </button>
                )}

                {reviewRecord.review_status ===
                "reviewed" ? (
                  <button
                    className={styles.reopenButton}
                    type="button"
                    onClick={() =>
                      submitReviewAction(
                        "reopen",
                      )
                    }
                    disabled={isSaving}
                  >
                    <RotateCcw
                      size={16}
                    />
                    {reviewAction ===
                    "reopen"
                      ? "Reopening…"
                      : "Reopen review"}
                  </button>
                ) : (
                  <button
                    className={styles.reviewCompleteButton}
                    type="button"
                    onClick={() =>
                      submitReviewAction(
                        "mark_reviewed",
                      )
                    }
                    disabled={
                      isSaving ||
                      !reviewSummary.ready
                    }
                    title={
                      reviewSummary.ready
                        ? "Mark this assignment reviewed"
                        : "Every stop must be recorded or skipped, and the assignment must be completed first"
                    }
                  >
                    <ClipboardCheck
                      size={16}
                    />
                    {reviewAction ===
                    "mark_reviewed"
                      ? "Marking…"
                      : "Mark reviewed"}
                  </button>
                )}
              </footer>
            </div>
          </section>
        </div>
      )}

      {followUpAssignment && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={closeFollowUpGenerator}
            aria-label="Close follow-up route generator"
          />

          <section
            className={[
              styles.modal,
              styles.followUpModal,
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="follow-up-route-title"
          >
            <header>
              <div>
                <span>
                  Leadership only
                </span>

                <h2
                  id="follow-up-route-title"
                >
                  Create follow-up route
                </h2>

                <p>
                  From{" "}
                  {
                    followUpAssignment
                      .title
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={closeFollowUpGenerator}
                aria-label="Close follow-up route generator"
                disabled={isSaving}
              >
                <X size={20} />
              </button>
            </header>

            <form
              className={styles.followUpBody}
              onSubmit={
                submitFollowUpAssignment
              }
            >
              <div className={styles.followUpIntro}>
                <Route size={20} />

                <div>
                  <strong>
                    Create new pending work without changing the original review
                  </strong>

                  <p>
                    Not home, inaccessible, moved, other and skipped stops are suggested. Contacted and refused stops remain available for manual selection.
                  </p>
                </div>
              </div>

              <div className={styles.followUpFormGrid}>
                <label className={styles.followUpFullField}>
                  <span>
                    Follow-up assignment title
                  </span>

                  <input
                    type="text"
                    value={
                      followUpForm.title
                    }
                    onChange={(event) =>
                      setFollowUpForm(
                        (current) => ({
                          ...current,
                          title:
                            event.target
                              .value,
                        }),
                      )
                    }
                    maxLength={160}
                    required
                  />
                </label>

                <label>
                  <span>
                    Volunteer
                  </span>

                  <select
                    value={
                      followUpForm
                        .volunteerUserId
                    }
                    onChange={(event) =>
                      setFollowUpForm(
                        (current) => ({
                          ...current,
                          volunteerUserId:
                            event.target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Leave unassigned
                    </option>

                    {volunteers.map(
                      (volunteer) => (
                        <option
                          key={
                            volunteer.userId
                          }
                          value={
                            volunteer.userId
                          }
                        >
                          {
                            volunteer.fullName
                          }
                          {" · "}
                          {
                            volunteer.email
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    Assignment date
                  </span>

                  <input
                    type="date"
                    value={
                      followUpForm
                        .assignmentDate
                    }
                    onChange={(event) =>
                      setFollowUpForm(
                        (current) => ({
                          ...current,
                          assignmentDate:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label className={styles.followUpFullField}>
                  <span>
                    Meeting point
                  </span>

                  <input
                    type="text"
                    value={
                      followUpForm
                        .meetingLocation
                    }
                    onChange={(event) =>
                      setFollowUpForm(
                        (current) => ({
                          ...current,
                          meetingLocation:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Optional campaign meeting location"
                  />
                </label>

                <label>
                  <span>
                    Route finish
                  </span>

                  <select
                    value={
                      followUpForm
                        .finishMode
                    }
                    onChange={(event) =>
                      setFollowUpForm(
                        (current) => ({
                          ...current,
                          finishMode:
                            event.target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="final_stop">
                      End at final stop
                    </option>

                    <option value="return_start">
                      Return to starting stop
                    </option>

                    <option
                      value="meeting_point"
                      disabled={
                        !followUpForm
                          .meetingLocation
                          .trim()
                      }
                    >
                      Return to meeting point
                    </option>
                  </select>
                </label>

                <label className={styles.followUpFullField}>
                  <span>
                    Volunteer instructions
                  </span>

                  <textarea
                    value={
                      followUpForm
                        .instructions
                    }
                    onChange={(event) =>
                      setFollowUpForm(
                        (current) => ({
                          ...current,
                          instructions:
                            event.target
                              .value,
                        }),
                      )
                    }
                    rows={3}
                    maxLength={3000}
                  />
                </label>
              </div>

              <section className={styles.followUpSelection}>
                <header>
                  <div>
                    <span>
                      Recorded stops
                    </span>

                    <strong>
                      Choose addresses for the new route
                    </strong>
                  </div>

                  <small>
                    {
                      followUpStopIds
                        .length
                    }
                    {" selected"}
                  </small>
                </header>

                <div className={styles.followUpStopList}>
                  {followUpCandidateStops.map(
                    ({
                      stop,
                      route,
                      alreadyFollowed,
                      suggested,
                    }) => (
                      <label
                        className={[
                          styles.followUpStopRow,
                          alreadyFollowed
                            ? styles.followUpStopDisabled
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={stop.id}
                      >
                        <input
                          type="checkbox"
                          checked={
                            !alreadyFollowed &&
                            followUpStopIds
                              .includes(
                                stop.id,
                              )
                          }
                          onChange={() =>
                            toggleFollowUpStop(
                              stop.id,
                            )
                          }
                          disabled={
                            alreadyFollowed ||
                            isSaving
                          }
                        />

                        <span className={styles.followUpStopNumber}>
                          {
                            route.route_order
                          }
                          {"."}
                          {
                            stop.stop_order
                          }
                        </span>

                        <div className={styles.followUpStopCopy}>
                          <strong>
                            {stopName(
                              stop,
                            )}
                          </strong>

                          <span>
                            {getAddress(
                              stop,
                            )}
                          </span>

                          <small>
                            {route.name}
                            {" · "}
                            {stop.status ===
                            "skipped"
                              ? "Skipped"
                              : labelStatus(
                                  stop.result_code ||
                                    stop.status,
                                )}
                          </small>

                          {stop.volunteer_notes && (
                            <p>
                              <MessageSquareText
                                size={13}
                              />
                              {
                                stop.volunteer_notes
                              }
                            </p>
                          )}
                        </div>

                        <span
                          className={[
                            styles.followUpTag,
                            alreadyFollowed
                              ? styles.followUpDoneTag
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {alreadyFollowed
                            ? "Already added"
                            : suggested
                              ? "Suggested"
                              : "Optional"}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </section>

              {followUpError && (
                <div
                  className={styles.formError}
                  role="alert"
                >
                  <AlertTriangle
                    size={17}
                  />
                  {followUpError}
                </div>
              )}

              <footer className={styles.followUpFooter}>
                <button
                  type="button"
                  onClick={closeFollowUpGenerator}
                  disabled={isSaving}
                >
                  Cancel
                </button>

                <button
                  className={styles.saveButton}
                  type="submit"
                  disabled={
                    isSaving ||
                    !followUpStopIds
                      .length
                  }
                >
                  <Plus size={16} />
                  {followUpAction ===
                  "creating"
                    ? "Creating…"
                    : "Create follow-up route"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {manualOrderRoute && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={closeManualOrder}
            aria-label="Close route ordering"
          />

          <section
            className={[
              styles.modal,
              styles.reorderModal,
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-route-order-title"
          >
            <header>
              <div>
                <span>
                  Leadership route control
                </span>

                <h2
                  id="manual-route-order-title"
                >
                  Reorder{" "}
                  {
                    manualOrderRoute.name
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={closeManualOrder}
                aria-label="Close route ordering"
                disabled={isSaving}
              >
                <X size={20} />
              </button>
            </header>

            <div className={styles.reorderBody}>
              <div className={styles.reorderIntro}>
                <strong>
                  Review the Volunteer’s visit order
                </strong>

                <p>
                  Drag rows with a mouse, or use Earlier and Later on touch screens and keyboards. Nothing changes for the Volunteer until you press Save order.
                </p>
              </div>

              <div
                className={styles.reorderList}
                role="list"
                aria-label={`${manualOrderRoute.name} stop order`}
              >
                {manualOrderStops.map(
                  (
                    stop,
                    index,
                  ) => (
                    <div
                      className={[
                        styles.reorderRow,
                        draggedStopId ===
                        stop.id
                          ? styles.draggingStop
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={stop.id}
                      role="listitem"
                      draggable={!isSaving}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed =
                          "move";

                        event.dataTransfer.setData(
                          "text/plain",
                          stop.id,
                        );

                        setDraggedStopId(
                          stop.id,
                        );
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect =
                          "move";
                      }}
                      onDrop={(event) =>
                        dropManualStop(
                          event,
                          stop.id,
                        )
                      }
                      onDragEnd={() =>
                        setDraggedStopId(
                          "",
                        )
                      }
                    >
                      <div
                        className={styles.dragHandle}
                        aria-hidden="true"
                        title="Drag to move"
                      >
                        <GripVertical
                          size={18}
                        />
                      </div>

                      <div className={styles.reorderPosition}>
                        {index + 1}
                      </div>

                      <div className={styles.reorderCopy}>
                        <strong>
                          {stopName(
                            stop,
                          )}
                        </strong>

                        <span>
                          {getAddress(
                            stop,
                          )}
                        </span>

                        <small>
                          Current saved stop{" "}
                          {
                            stop.stop_order
                          }
                        </small>
                      </div>

                      <div className={styles.reorderControls}>
                        <button
                          type="button"
                          onClick={() =>
                            moveManualStop(
                              stop.id,
                              -1,
                            )
                          }
                          disabled={
                            isSaving ||
                            index === 0
                          }
                          aria-label={`Move ${stopName(
                            stop,
                          )} earlier`}
                        >
                          <ArrowUp
                            size={15}
                          />
                          Earlier
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            moveManualStop(
                              stop.id,
                              1,
                            )
                          }
                          disabled={
                            isSaving ||
                            index ===
                              manualOrderStops.length -
                                1
                          }
                          aria-label={`Move ${stopName(
                            stop,
                          )} later`}
                        >
                          <ArrowDown
                            size={15}
                          />
                          Later
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>

              <div
                className={styles.srOnly}
                aria-live="polite"
              >
                {
                  manualOrderAnnouncement
                }
              </div>

              {manualOrderError && (
                <div
                  className={styles.formError}
                  role="alert"
                >
                  <AlertTriangle
                    size={17}
                  />
                  {manualOrderError}
                </div>
              )}

              <footer className={styles.reorderFooter}>
                <button
                  type="button"
                  onClick={closeManualOrder}
                  disabled={isSaving}
                >
                  Cancel
                </button>

                <button
                  className={styles.saveButton}
                  type="button"
                  onClick={saveManualOrder}
                  disabled={isSaving}
                >
                  {reorderingRouteId ===
                  manualOrderRoute.id
                    ? "Saving…"
                    : "Save order"}
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}

      {editorType && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={closeEditor}
            aria-label="Close editor"
          />

          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <span>
                  Field Operations
                </span>

                <h2>
                  {editorType ===
                  "assignment"
                    ? assignmentForm.id
                      ? "Edit assignment"
                      : "New assignment"
                    : editorType ===
                        "route"
                      ? routeForm.id
                        ? "Edit route"
                        : "Add route"
                      : stopForm.id
                        ? "Edit stop"
                        : "Add stop"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                aria-label="Close editor"
              >
                <X size={20} />
              </button>
            </header>

            {editorType ===
              "assignment" && (
              <form
                className={styles.form}
                onSubmit={
                  submitAssignment
                }
              >
                <label>
                  <span>
                    Volunteer
                  </span>
                  <select
                    value={
                      assignmentForm
                        .volunteerUserId
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          volunteerUserId:
                            event.target
                              .value,
                        }),
                      )
                    }
                    required
                  >
                    <option value="">
                      Choose Volunteer
                    </option>

                    {volunteers.map(
                      (volunteer) => (
                        <option
                          key={
                            volunteer.userId
                          }
                          value={
                            volunteer.userId
                          }
                        >
                          {
                            volunteer.fullName
                          }
                          {" · "}
                          {
                            volunteer.email
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className={styles.fullField}>
                  <span>
                    Assignment title
                  </span>
                  <input
                    type="text"
                    value={
                      assignmentForm
                        .title
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          title:
                            event.target
                              .value,
                        }),
                      )
                    }
                    maxLength={160}
                    required
                  />
                </label>

                <label>
                  <span>
                    Precinct
                  </span>
                  <input
                    type="text"
                    value={
                      assignmentForm
                        .precinct
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          precinct:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Example: Precinct 6124"
                  />
                </label>

                <label>
                  <span>
                    Turf
                  </span>
                  <input
                    type="text"
                    value={
                      assignmentForm
                        .turfName
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          turfName:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Example: Wellington North"
                  />
                </label>

                <label>
                  <span>
                    Assignment date
                  </span>
                  <input
                    type="date"
                    value={
                      assignmentForm
                        .assignmentDate
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          assignmentDate:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Status
                  </span>
                  <select
                    value={
                      assignmentForm
                        .status
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          status:
                            event.target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="assigned">
                      Assigned
                    </option>
                    <option value="accepted">
                      Accepted
                    </option>
                    <option value="in_progress">
                      In progress
                    </option>
                    <option value="completed">
                      Completed
                    </option>
                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Shift starts
                  </span>
                  <input
                    type="datetime-local"
                    value={
                      assignmentForm
                        .shiftStartsAt
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          shiftStartsAt:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Shift ends
                  </span>
                  <input
                    type="datetime-local"
                    value={
                      assignmentForm
                        .shiftEndsAt
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          shiftEndsAt:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label className={styles.fullField}>
                  <span>
                    Meeting point
                  </span>
                  <input
                    type="text"
                    value={
                      assignmentForm
                        .meetingLocation
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          meetingLocation:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Address or campaign meeting location"
                  />
                </label>

                <label className={styles.fullField}>
                  <span>
                    Volunteer instructions
                  </span>
                  <textarea
                    value={
                      assignmentForm
                        .instructions
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          instructions:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Add check-in, materials and route instructions."
                  />
                </label>

                {formError && (
                  <div className={styles.formError}>
                    <AlertTriangle size={17} />
                    {formError}
                  </div>
                )}

                <footer>
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.saveButton}
                    type="submit"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? "Saving…"
                      : assignmentForm.id
                        ? "Save assignment"
                        : "Create assignment"}
                  </button>
                </footer>
              </form>
            )}

            {editorType ===
              "route" && (
              <form
                className={styles.form}
                onSubmit={
                  submitRoute
                }
              >
                <label>
                  <span>
                    Route order
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={
                      routeForm
                        .routeOrder
                    }
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          routeOrder:
                            event.target
                              .value,
                        }),
                      )
                    }
                    required
                  />
                </label>

                <label>
                  <span>
                    Route status
                  </span>
                  <select
                    value={
                      routeForm.status
                    }
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          status:
                            event.target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="ready">
                      Ready
                    </option>
                    <option value="in_progress">
                      In progress
                    </option>
                    <option value="completed">
                      Completed
                    </option>
                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </label>

                <label className={styles.fullField}>
                  <span>
                    Route name
                  </span>
                  <input
                    type="text"
                    value={
                      routeForm.name
                    }
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          name:
                            event.target
                              .value,
                        }),
                      )
                    }
                    required
                  />
                </label>

                <label className={styles.fullField}>
                  <span>
                    Starting point
                  </span>
                  <input
                    type="text"
                    value={
                      routeForm
                        .startLocation
                    }
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          startLocation:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Where the Volunteer should begin"
                  />
                </label>


                <label className={styles.fullField}>
                  <span>
                    Route finish
                  </span>
                  <select
                    value={
                      routeForm
                        .finishMode
                    }
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          finishMode:
                            event.target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="final_stop">
                      End at final stop
                    </option>
                    <option value="return_start">
                      Return to starting stop
                    </option>
                    <option
                      value="meeting_point"
                      disabled={
                        !selectedAssignment
                          ?.meeting_location
                          ?.trim()
                      }
                    >
                      Return to meeting point
                    </option>
                  </select>

                  <small className={styles.fieldHint}>
                    {routeForm.finishMode ===
                    "return_start"
                      ? "The Volunteer finishes back at Stop 1."
                      : routeForm.finishMode ===
                          "meeting_point"
                        ? selectedAssignment
                            ?.meeting_location
                          ? `The Volunteer returns to ${selectedAssignment.meeting_location}.`
                          : "Add a meeting point to the assignment first."
                        : "The route ends after the last stop."}
                  </small>
                </label>

                <label className={styles.fullField}>
                  <span>
                    Route instructions
                  </span>
                  <textarea
                    value={
                      routeForm
                        .instructions
                    }
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          instructions:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                {formError && (
                  <div className={styles.formError}>
                    <AlertTriangle size={17} />
                    {formError}
                  </div>
                )}

                <footer>
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.saveButton}
                    type="submit"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? "Saving…"
                      : routeForm.id
                        ? "Save route"
                        : "Add route"}
                  </button>
                </footer>
              </form>
            )}

            {editorType ===
              "stop" && (
              <form
                className={styles.form}
                onSubmit={
                  submitStop
                }
              >
                <label>
                  <span>
                    Stop order
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={
                      stopForm.stopOrder
                    }
                    onChange={(event) =>
                      setStopForm(
                        (current) => ({
                          ...current,
                          stopOrder:
                            event.target
                              .value,
                        }),
                      )
                    }
                    required
                  />
                </label>

                <label>
                  <span>
                    Location label
                  </span>
                  <input
                    type="text"
                    value={
                      stopForm
                        .locationLabel
                    }
                    onChange={(event) =>
                      setStopForm(
                        (current) => ({
                          ...current,
                          locationLabel:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Example: Door 1"
                  />
                </label>

                <label className={styles.fullField}>
                  <span>
                    Street address
                  </span>
                  <input
                    type="text"
                    value={
                      stopForm
                        .addressLine1
                    }
                    onChange={(event) =>
                      setStopForm(
                        (current) => ({
                          ...current,
                          addressLine1:
                            event.target
                              .value,
                        }),
                      )
                    }
                    required
                  />
                </label>

                <label className={styles.fullField}>
                  <span>
                    Apartment, suite or unit
                  </span>
                  <input
                    type="text"
                    value={
                      stopForm
                        .addressLine2
                    }
                    onChange={(event) =>
                      setStopForm(
                        (current) => ({
                          ...current,
                          addressLine2:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    City
                  </span>
                  <input
                    type="text"
                    value={
                      stopForm.city
                    }
                    onChange={(event) =>
                      setStopForm(
                        (current) => ({
                          ...current,
                          city:
                            event.target
                              .value,
                        }),
                      )
                    }
                    required
                  />
                </label>

                <label>
                  <span>
                    State
                  </span>
                  <input
                    type="text"
                    value={
                      stopForm.state
                    }
                    onChange={(event) =>
                      setStopForm(
                        (current) => ({
                          ...current,
                          state:
                            event.target
                              .value,
                        }),
                      )
                    }
                    maxLength={2}
                    required
                  />
                </label>

                <label>
                  <span>
                    ZIP code
                  </span>
                  <input
                    type="text"
                    value={
                      stopForm
                        .postalCode
                    }
                    onChange={(event) =>
                      setStopForm(
                        (current) => ({
                          ...current,
                          postalCode:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Latitude
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={
                      stopForm.latitude
                    }
                    onChange={(event) =>
                      setStopForm(
                        (current) => ({
                          ...current,
                          latitude:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Longitude
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={
                      stopForm.longitude
                    }
                    onChange={(event) =>
                      setStopForm(
                        (current) => ({
                          ...current,
                          longitude:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label className={styles.fullField}>
                  <span>
                    Stop instructions
                  </span>
                  <textarea
                    value={
                      stopForm
                        .instructions
                    }
                    onChange={(event) =>
                      setStopForm(
                        (current) => ({
                          ...current,
                          instructions:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Gate information or location notes."
                  />
                </label>

                {formError && (
                  <div className={styles.formError}>
                    <AlertTriangle size={17} />
                    {formError}
                  </div>
                )}

                <footer>
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.saveButton}
                    type="submit"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? "Saving…"
                      : stopForm.id
                        ? "Save stop"
                        : "Add stop"}
                  </button>
                </footer>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

