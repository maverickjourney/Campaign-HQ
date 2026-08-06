import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  Flag,
  Footprints,
  Home,
  Layers3,
  Mail,
  Map,
  MapPin,
  MessageCircle,
  Navigation,
  PhoneCall,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  UserPlus,
  Users,
  X,
  Camera,
  ImagePlus,
  Trash2,
} from "lucide-react";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import styles from "./VolunteersReferencePreview.module.css";

const STORAGE_PREFIX =
  "campaign-seat-volunteer-field-ops-v3";

const TABS = [
  {
    id: "overview",
    label: "Operations Overview",
    icon: BarChart3,
  },
  {
    id: "map",
    label: "Field Activity Map",
    icon: Map,
  },
  {
    id: "routes",
    label: "Routes & Walk Lists",
    icon: Route,
  },
  {
    id: "assignments",
    label: "Assignments",
    icon: ClipboardCheck,
  },
  {
    id: "doors",
    label: "Door Knocking",
    icon: Footprints,
  },
  {
    id: "signs",
    label: "Yard Signs",
    icon: Flag,
  },
  {
    id: "roster",
    label: "Volunteer Roster",
    icon: Users,
  },
  {
    id: "activity",
    label: "Activity & Reports",
    icon: ClipboardList,
  },
];

const INITIAL_VOLUNTEERS = [
  {
    id: "elizabeth",
    initials: "EA",
    name: "Elizabeth Accomando",
    role: "Candidate / Field Lead",
    phone: "(561) 555-0100",
    email: "elizabeth@example.com",
    status: "In field",
    readiness: [
      "Route lead",
      "Yard signs",
      "Voter outreach",
    ],
  },
  {
    id: "maria",
    initials: "ML",
    name: "Maria Lopez",
    role: "Canvassing Captain",
    phone: "(561) 555-0184",
    email: "maria.lopez@example.com",
    status: "Active",
    readiness: [
      "Captain approved",
      "Canvassing",
      "Spanish",
    ],
  },
  {
    id: "andre",
    initials: "AW",
    name: "Andre Williams",
    role: "Event & Field Captain",
    phone: "(561) 555-0117",
    email: "andre.williams@example.com",
    status: "Active",
    readiness: [
      "Captain approved",
      "Logistics",
      "Driver approved",
    ],
  },
  {
    id: "david",
    initials: "DK",
    name: "David Kim",
    role: "Event Volunteer",
    phone: "(561) 555-0128",
    email: "david.kim@example.com",
    status: "Active",
    readiness: [
      "Event setup",
      "Check-in",
    ],
  },
  {
    id: "tasha",
    initials: "TG",
    name: "Tasha Green",
    role: "Phone Bank Volunteer",
    phone: "(561) 555-0162",
    email: "tasha.green@example.com",
    status: "Training",
    readiness: [
      "Phone banking",
      "Data entry",
    ],
  },
  {
    id: "marcus",
    initials: "MR",
    name: "Marcus Reed",
    role: "Sign Delivery Volunteer",
    phone: "(561) 555-0133",
    email: "marcus.reed@example.com",
    status: "Needs follow-up",
    readiness: [
      "Driver approved",
      "Yard signs",
    ],
  },
];

const INITIAL_ROUTES = [
  {
    id: "route-north",
    name: "North Wellington Route A",
    precinct: "Precinct 602",
    captain: "Maria Lopez",
    volunteers: [
      "Maria Lopez",
      "David Kim",
      "Olivia Grant",
    ],
    startAddress:
      "Wellington Community Center, Wellington, FL",
    doorsAssigned: 84,
    doorsKnocked: 63,
    supporters: 31,
    followUps: 8,
    signRequests: 6,
    status: "In progress",
    time: "9:00 AM–12:30 PM",
    instructions:
      "Meet at the east entrance. Blue route packets.",
    x: 29,
    y: 28,
  },
  {
    id: "route-central",
    name: "Central Wellington Route B",
    precinct: "Precinct 604",
    captain: "Andre Williams",
    volunteers: [
      "Andre Williams",
      "Nicole Chen",
    ],
    startAddress:
      "Village Park, Wellington, FL",
    doorsAssigned: 72,
    doorsKnocked: 41,
    supporters: 20,
    followUps: 6,
    signRequests: 4,
    status: "In progress",
    time: "10:00 AM–1:00 PM",
    instructions:
      "Start near the south parking lot.",
    x: 58,
    y: 52,
  },
  {
    id: "route-west",
    name: "West District 6 Route C",
    precinct: "Precinct 607",
    captain: "Elizabeth Accomando",
    volunteers: [
      "Elizabeth Accomando",
      "Marcus Reed",
    ],
    startAddress:
      "District 6 Staging Area, Wellington, FL",
    doorsAssigned: 54,
    doorsKnocked: 18,
    supporters: 9,
    followUps: 3,
    signRequests: 7,
    status: "Needs help",
    time: "1:30 PM–4:00 PM",
    instructions:
      "Elizabeth is visiting priority households.",
    x: 73,
    y: 32,
  },
];

const INITIAL_ASSIGNMENTS = [
  {
    id: "assignment-elizabeth",
    title: "Priority household visits",
    type: "Door knocking",
    location: "West District 6",
    lead: "Elizabeth Accomando",
    helpers: [
      "Marcus Reed",
    ],
    status: "In progress",
    due: "Today · 4:00 PM",
    notes:
      "Visit supporter follow-ups and deliver requested signs.",
    x: 72,
    y: 30,
  },
  {
    id: "assignment-signs",
    title: "Yard sign installation run",
    type: "Yard signs",
    location: "Wellington Trace area",
    lead: "Marcus Reed",
    helpers: [
      "David Kim",
    ],
    status: "Assigned",
    due: "Today · 5:30 PM",
    notes:
      "Eight approved properties. Confirm placement before leaving.",
    x: 45,
    y: 68,
  },
  {
    id: "assignment-packets",
    title: "Prepare Route D packets",
    type: "Materials",
    location: "Campaign office",
    lead: "Tasha Green",
    helpers: [],
    status: "Needs help",
    due: "Tomorrow · 8:00 AM",
    notes:
      "Print walk sheets and prepare literature bundles.",
    x: 37,
    y: 45,
  },
  {
    id: "assignment-event",
    title: "Community forum check-in",
    type: "Event",
    location: "Wellington Community Center",
    lead: "Andre Williams",
    helpers: [
      "Nicole Chen",
      "Olivia Grant",
    ],
    status: "Completed",
    due: "Completed today",
    notes:
      "Attendance and volunteer hours recorded.",
    x: 25,
    y: 26,
  },
];

const INITIAL_DOOR_LOGS = [
  {
    id: "door-1",
    address: "Sample household — Route A Stop 14",
    precinct: "Precinct 602",
    volunteer: "Maria Lopez",
    result: "Supporter",
    literature: true,
    signRequested: true,
    followUp: false,
    notes:
      "Requested one standard yard sign.",
    date: "Today · 10:12 AM",
    x: 33,
    y: 35,
  },
  {
    id: "door-2",
    address: "Sample household — Route A Stop 21",
    precinct: "Precinct 602",
    volunteer: "David Kim",
    result: "Not home",
    literature: true,
    signRequested: false,
    followUp: true,
    notes:
      "Leave on evening follow-up list.",
    date: "Today · 10:34 AM",
    x: 39,
    y: 29,
  },
  {
    id: "door-3",
    address: "Sample household — Route C Stop 5",
    precinct: "Precinct 607",
    volunteer: "Elizabeth Accomando",
    result: "Undecided",
    literature: true,
    signRequested: false,
    followUp: true,
    notes:
      "Asked for information on neighborhood traffic.",
    date: "Today · 1:48 PM",
    x: 69,
    y: 39,
  },
  {
    id: "door-4",
    address: "Sample household — Route B Stop 9",
    precinct: "Precinct 604",
    volunteer: "Andre Williams",
    result: "Supporter",
    literature: true,
    signRequested: true,
    followUp: false,
    notes:
      "Large sign requested with permission confirmed.",
    date: "Today · 11:06 AM",
    x: 61,
    y: 57,
  },
];

const INITIAL_YARD_SIGNS = [
  {
    id: "sign-1",
    resident: "Sample Property A",
    address: "Sample address — Wellington Trace",
    installer: "Marcus Reed",
    status: "Installed",
    permission: true,
    installedDate: "Jul 29, 2026",
    pickupDate: "After Election Day",
    notes:
      "Place inside fence line near driveway.",
    x: 47,
    y: 71,
  },
  {
    id: "sign-2",
    resident: "Sample Property B",
    address: "Sample address — West District 6",
    installer: "Elizabeth Accomando",
    status: "Assigned",
    permission: true,
    installedDate: "Pending",
    pickupDate: "After Election Day",
    notes:
      "Elizabeth plans to install during afternoon route.",
    x: 76,
    y: 36,
  },
  {
    id: "sign-3",
    resident: "Sample Property C",
    address: "Sample address — Central Wellington",
    installer: "Andre Williams",
    status: "Requested",
    permission: false,
    installedDate: "Pending",
    pickupDate: "Pending",
    notes:
      "Call resident to confirm placement permission.",
    x: 62,
    y: 62,
  },
  {
    id: "sign-4",
    resident: "Sample Property D",
    address: "Sample address — North Wellington",
    installer: "David Kim",
    status: "Needs replacement",
    permission: true,
    installedDate: "Jul 23, 2026",
    pickupDate: "Pending",
    notes:
      "Reported damaged after heavy rain.",
    x: 27,
    y: 20,
  },
];

const INITIAL_ISSUES = [
  {
    id: "issue-1",
    type: "Supply shortage",
    location: "West District 6 Route C",
    reportedBy: "Elizabeth Accomando",
    priority: "High",
    status: "Open",
    notes:
      "Team needs additional palm cards and two sign stakes.",
  },
  {
    id: "issue-2",
    type: "Incorrect address",
    location: "North Wellington Route A",
    reportedBy: "David Kim",
    priority: "Normal",
    status: "Open",
    notes:
      "One walk-list address could not be located.",
  },
];

const EMPTY_ROUTE = {
  name: "",
  precinct: "",
  startAddress: "",
  captain: "Elizabeth Accomando",
  volunteers: "",
  doorsAssigned: "50",
  time: "",
  instructions: "",
  photos: [],
  mapX: 50,
  mapY: 50,
};

const EMPTY_DOOR = {
  address: "",
  precinct: "",
  volunteer: "Elizabeth Accomando",
  result: "Supporter",
  literature: true,
  signRequested: false,
  followUp: false,
  notes: "",
  photos: [],
  mapX: 50,
  mapY: 50,
};

const EMPTY_SIGN = {
  resident: "",
  address: "",
  installer: "Elizabeth Accomando",
  status: "Requested",
  permission: false,
  notes: "",
  photos: [],
  mapX: 50,
  mapY: 50,
};

const EMPTY_ASSIGNMENT = {
  title: "",
  type: "Door knocking",
  location: "",
  lead: "Elizabeth Accomando",
  helpers: "",
  status: "Assigned",
  due: "",
  notes: "",
  photos: [],
};

const EMPTY_ISSUE = {
  type: "Route access problem",
  location: "",
  priority: "Normal",
  notes: "",
  photos: [],
};

const EMPTY_VOLUNTEER = {
  name: "",
  email: "",
  phone: "",
  role: "General Volunteer",
  status: "Training",
};

function readSessionList(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.sessionStorage.getItem(
      `${STORAGE_PREFIX}-${key}`,
    );

    if (!value) {
      return fallback;
    }

    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed
      : fallback;
  } catch {
    return fallback;
  }
}

function saveSessionList(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    `${STORAGE_PREFIX}-${key}`,
    JSON.stringify(value),
  );
}

function initialsFromName(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function statusKey(status) {
  return status
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function createPlacement(index) {
  return {
    x: 19 + ((index * 17) % 65),
    y: 18 + ((index * 23) % 62),
  };
}

function ModalShell({
  title,
  eyebrow,
  icon: Icon,
  onClose,
  wide = false,
  children,
}) {
  return (
    <div
      className={styles.modalScrim}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={
          wide
            ? `${styles.modal} ${styles.modalWide}`
            : styles.modal
        }
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className={styles.modalHeader}>
          <div>
            <span>
              <Icon size={21} />
            </span>

            <div>
              <small>{eyebrow}</small>
              <h2>{title}</h2>
            </div>
          </div>

          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>

        {children}
      </section>
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span
      className={styles.statusPill}
      data-status={statusKey(status)}
    >
      {status}
    </span>
  );
}

function OperationsMapCanvas({
  items,
  selectedItem,
  onSelect,
}) {
  return (
    <div className={styles.mapCanvas}>
      <iframe
        className={styles.mapFrame}
        title="Wellington field operations map preview"
        loading="lazy"
        src="https://www.openstreetmap.org/export/embed.html?bbox=-80.34%2C26.59%2C-80.18%2C26.74&layer=mapnik"
      />

      <div className={styles.mapShade} />

      <div className={styles.routeLineOne} />
      <div className={styles.routeLineTwo} />
      <div className={styles.routeLineThree} />

      {items.map((item) => (
        <button
          className={styles.mapMarker}
          data-type={item.type}
          data-selected={
            selectedItem?.mapId === item.mapId
          }
          type="button"
          key={item.mapId}
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
          }}
          aria-label={`${item.typeLabel}: ${item.title}`}
          onClick={() => onSelect(item)}
        >
          <span>{item.marker}</span>
        </button>
      ))}

      <div className={styles.mapPreviewNotice}>
        <ShieldCheck size={14} />
        Logged campaign locations only. This is not live
        volunteer GPS tracking.
      </div>
    </div>
  );
}


function MapPointPicker({
  x,
  y,
  onChange,
  label,
}) {
  const choosePoint = (event) => {
    const bounds =
      event.currentTarget.getBoundingClientRect();

    const nextX = Math.min(
      95,
      Math.max(
        5,
        Math.round(
          (
            (event.clientX - bounds.left) /
            bounds.width
          ) * 100,
        ),
      ),
    );

    const nextY = Math.min(
      95,
      Math.max(
        5,
        Math.round(
          (
            (event.clientY - bounds.top) /
            bounds.height
          ) * 100,
        ),
      ),
    );

    onChange({
      x: nextX,
      y: nextY,
    });
  };

  return (
    <div className={styles.mapPicker}>
      <div className={styles.mapPickerHeader}>
        <strong>{label}</strong>
        <span>
          Click the map to place this logged location.
        </span>
      </div>

      <div className={styles.mapPickerCanvas}>
        <iframe
          title={`${label} map preview`}
          loading="lazy"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-80.34%2C26.59%2C-80.18%2C26.74&layer=mapnik"
        />

        <div
          className={styles.mapPickerSurface}
          role="button"
          tabIndex="0"
          aria-label={`Choose ${label.toLowerCase()} on map`}
          onClick={choosePoint}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();

              onChange({
                x: 50,
                y: 50,
              });
            }
          }}
        >
          <span
            className={styles.mapPickerMarker}
            style={{
              left: `${x}%`,
              top: `${y}%`,
            }}
          >
            <MapPin size={15} />
          </span>
        </div>
      </div>

      <p>
        Logged location only. This does not track a
        volunteer’s live position.
      </p>
    </div>
  );
}

const MAX_PHOTOS_PER_RECORD = 4;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_DIMENSION = 1000;

function readPhotoFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(
        new Error(
          `Could not read ${file.name}.`,
        ),
      );

    reader.readAsDataURL(file);
  });
}

function loadPhotoImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "Could not prepare that image.",
        ),
      );

    image.src = dataUrl;
  });
}

async function compressPhoto(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error(
      `${file.name} is not a supported picture.`,
    );
  }

  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error(
      `${file.name} is larger than 8 MB.`,
    );
  }

  const source = await readPhotoFile(file);
  const image = await loadPhotoImage(source);

  const largest = Math.max(
    image.naturalWidth,
    image.naturalHeight,
  );

  const scale = Math.min(
    1,
    MAX_PHOTO_DIMENSION / largest,
  );

  const width = Math.max(
    1,
    Math.round(image.naturalWidth * scale),
  );

  const height = Math.max(
    1,
    Math.round(image.naturalHeight * scale),
  );

  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Could not prepare that picture.",
    );
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return {
    id: `photo-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    name: file.name,
    addedAt: new Date().toISOString(),
    dataUrl: canvas.toDataURL(
      "image/jpeg",
      0.68,
    ),
  };
}

function PhotoAttachmentField({
  label,
  photos,
  onChange,
}) {
  const [isPreparing, setIsPreparing] =
    useState(false);

  const currentPhotos = Array.isArray(photos)
    ? photos
    : [];

  const remaining =
    MAX_PHOTOS_PER_RECORD - currentPhotos.length;

  const handleChange = async (event) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);

    input.value = "";

    if (!files.length) {
      return;
    }

    if (remaining <= 0) {
      window.alert(
        `A maximum of ${MAX_PHOTOS_PER_RECORD} photos can be attached.`,
      );
      return;
    }

    setIsPreparing(true);

    const prepared = [];
    const errors = [];

    for (const file of files.slice(0, remaining)) {
      try {
        prepared.push(await compressPhoto(file));
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : "A picture could not be prepared.",
        );
      }
    }

    if (prepared.length) {
      onChange([
        ...currentPhotos,
        ...prepared,
      ]);
    }

    if (errors.length) {
      window.alert(errors.join("\n"));
    }

    setIsPreparing(false);
  };

  const removePhoto = (id) => {
    onChange(
      currentPhotos.filter(
        (photo) => photo.id !== id,
      ),
    );
  };

  return (
    <section className={styles.photoField}>
      <header className={styles.photoFieldHeader}>
        <div>
          <Camera size={18} />

          <span>
            <strong>{label}</strong>
            <small>
              Add up to four documentation photos.
            </small>
          </span>
        </div>

        <label
          className={styles.photoAddButton}
          data-disabled={
            remaining <= 0 || isPreparing
          }
        >
          <ImagePlus size={17} />

          {isPreparing
            ? "Preparing…"
            : currentPhotos.length
              ? "Add another"
              : "Add photos"}

          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={
              remaining <= 0 || isPreparing
            }
            onChange={handleChange}
          />
        </label>
      </header>

      {currentPhotos.length ? (
        <div className={styles.photoThumbnailGrid}>
          {currentPhotos.map((photo, index) => (
            <article
              className={styles.photoThumbnail}
              key={photo.id}
            >
              <img
                src={photo.dataUrl}
                alt={`${label} ${index + 1}`}
              />

              <button
                type="button"
                title="Remove photo"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() =>
                  removePhoto(photo.id)
                }
              >
                <Trash2 size={15} />
              </button>

              <span>Photo {index + 1}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.photoEmptyState}>
          Take a picture or choose one from the device.
        </p>
      )}

      <p className={styles.photoPrivacyNote}>
        Preview only. Compressed photos remain in this
        browser tab and are not uploaded to Supabase.
      </p>
    </section>
  );
}

function PhotoCountButton({
  photos,
  label,
  onOpen,
}) {
  const count = Array.isArray(photos)
    ? photos.length
    : 0;

  if (!count) {
    return null;
  }

  return (
    <button
      className={styles.photoCountButton}
      type="button"
      title={`View ${label}`}
      onClick={onOpen}
    >
      <Camera size={14} />
      {count} {count === 1 ? "photo" : "photos"}
    </button>
  );
}

export default function VolunteersReferencePreview() {
  const [activeTab, setActiveTab] =
    useState("overview");

  const [modal, setModal] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [photoViewer, setPhotoViewer] =
    useState(null);
  const [volunteerActivityOpen, setVolunteerActivityOpen] =
    useState(false);

  const [volunteerActivityTab, setVolunteerActivityTab] =
    useState("overview");


  const [volunteers, setVolunteers] = useState(
    () =>
      readSessionList(
        "volunteers",
        INITIAL_VOLUNTEERS,
      ),
  );

  const [routes, setRoutes] = useState(
    () =>
      readSessionList(
        "routes",
        INITIAL_ROUTES,
      ),
  );

  const [assignments, setAssignments] = useState(
    () =>
      readSessionList(
        "assignments",
        INITIAL_ASSIGNMENTS,
      ),
  );

  const [doorLogs, setDoorLogs] = useState(
    () =>
      readSessionList(
        "door-logs",
        INITIAL_DOOR_LOGS,
      ),
  );

  const [yardSigns, setYardSigns] = useState(
    () =>
      readSessionList(
        "yard-signs",
        INITIAL_YARD_SIGNS,
      ),
  );

  const [issues, setIssues] = useState(
    () =>
      readSessionList(
        "issues",
        INITIAL_ISSUES,
      ),
  );

  const [routeForm, setRouteForm] =
    useState(EMPTY_ROUTE);

  const [doorForm, setDoorForm] =
    useState(EMPTY_DOOR);

  const [signForm, setSignForm] =
    useState(EMPTY_SIGN);

  const [assignmentForm, setAssignmentForm] =
    useState(EMPTY_ASSIGNMENT);

  const [issueForm, setIssueForm] =
    useState(EMPTY_ISSUE);

  const [volunteerForm, setVolunteerForm] =
    useState(EMPTY_VOLUNTEER);

  const [selectedVolunteerId, setSelectedVolunteerId] =
    useState("elizabeth");

  const [rosterQuery, setRosterQuery] =
    useState("");

  const [mapFilters, setMapFilters] = useState({
    route: true,
    door: true,
    sign: true,
    assignment: true,
  });

  const [selectedMapItem, setSelectedMapItem] =
    useState(null);

  useEffect(() => {
    saveSessionList("volunteers", volunteers);
  }, [volunteers]);

  useEffect(() => {
    saveSessionList("routes", routes);
  }, [routes]);

  useEffect(() => {
    saveSessionList("assignments", assignments);
  }, [assignments]);

  useEffect(() => {
    saveSessionList("door-logs", doorLogs);
  }, [doorLogs]);

  useEffect(() => {
    saveSessionList("yard-signs", yardSigns);
  }, [yardSigns]);

  useEffect(() => {
    saveSessionList("issues", issues);
  }, [issues]);

  const selectedVolunteer = useMemo(
    () =>
      volunteers.find(
        (volunteer) =>
          volunteer.id === selectedVolunteerId,
      ) || volunteers[0],
    [
      selectedVolunteerId,
      volunteers,
    ],
  );

  const selectedVolunteerActivity = useMemo(() => {
    const volunteerName = selectedVolunteer?.name || "";

    const volunteerDoors = doorLogs.filter(
      (door) => door.volunteer === volunteerName,
    );

    const volunteerRoutes = routes.filter(
      (route) =>
        route.captain === volunteerName ||
        (
          Array.isArray(route.volunteers) &&
          route.volunteers.includes(volunteerName)
        ),
    );

    const volunteerAssignments = assignments.filter(
      (assignment) =>
        assignment.lead === volunteerName ||
        (
          Array.isArray(assignment.helpers) &&
          assignment.helpers.includes(volunteerName)
        ),
    );

    const volunteerSigns = yardSigns.filter(
      (sign) => sign.installer === volunteerName,
    );

    const volunteerIssues = issues.filter(
      (issue) => issue.reportedBy === volunteerName,
    );

    const photoRecords = [
      ...volunteerDoors.map((door) => ({
        id: `door-photo-${door.id}`,
        type: "Door knock",
        title: door.address,
        photos: Array.isArray(door.photos)
          ? door.photos
          : [],
      })),
      ...volunteerRoutes.map((route) => ({
        id: `route-photo-${route.id}`,
        type: "Route",
        title: route.name,
        photos: Array.isArray(route.photos)
          ? route.photos
          : [],
      })),
      ...volunteerAssignments.map((assignment) => ({
        id: `assignment-photo-${assignment.id}`,
        type: "Assignment",
        title: assignment.title,
        photos: Array.isArray(assignment.photos)
          ? assignment.photos
          : [],
      })),
      ...volunteerSigns.map((sign) => ({
        id: `sign-photo-${sign.id}`,
        type: "Yard sign",
        title: sign.resident,
        photos: Array.isArray(sign.photos)
          ? sign.photos
          : [],
      })),
      ...volunteerIssues.map((issue) => ({
        id: `issue-photo-${issue.id}`,
        type: "Field issue",
        title: issue.type,
        photos: Array.isArray(issue.photos)
          ? issue.photos
          : [],
      })),
    ].filter((record) => record.photos.length);

    return {
      doors: volunteerDoors,
      routes: volunteerRoutes,
      assignments: volunteerAssignments,
      signs: volunteerSigns,
      issues: volunteerIssues,
      supporters: volunteerDoors.filter(
        (door) => door.result === "Supporter",
      ).length,
      undecided: volunteerDoors.filter(
        (door) => door.result === "Undecided",
      ).length,
      notHome: volunteerDoors.filter(
        (door) => door.result === "Not home",
      ).length,
      literatureLeft: volunteerDoors.filter(
        (door) => door.literature,
      ).length,
      signRequests: volunteerDoors.filter(
        (door) => door.signRequested,
      ).length,
      followUps: volunteerDoors.filter(
        (door) => door.followUp,
      ).length,
      completedAssignments: volunteerAssignments.filter(
        (assignment) => assignment.status === "Completed",
      ).length,
      installedSigns: volunteerSigns.filter(
        (sign) => sign.status === "Installed",
      ).length,
      photoRecords,
      photoCount: photoRecords.reduce(
        (total, record) =>
          total + record.photos.length,
        0,
      ),
    };
  }, [
    assignments,
    doorLogs,
    issues,
    routes,
    selectedVolunteer,
    yardSigns,
  ]);

  const filteredVolunteers = useMemo(() => {
    const query = rosterQuery
      .trim()
      .toLowerCase();

    if (!query) {
      return volunteers;
    }

    return volunteers.filter((volunteer) =>
      [
        volunteer.name,
        volunteer.role,
        volunteer.status,
        volunteer.readiness.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [
    rosterQuery,
    volunteers,
  ]);

  const mapItems = useMemo(() => {
    const routeItems = routes.map((route) => ({
      mapId: `route-${route.id}`,
      source: "route",
      sourceId: route.id,
      type: "route",
      typeLabel: "Saved route",
      marker: "R",
      title: route.name,
      subtitle: route.precinct,
      address: route.startAddress,
      lead: route.captain,
      status: route.status,
      notes: route.instructions,
      x: route.x,
      y: route.y,
    }));

    const doorItems = doorLogs.map((door) => ({
      mapId: `door-${door.id}`,
      source: "door",
      sourceId: door.id,
      type: "door",
      typeLabel: "Door-knocking record",
      marker: "D",
      title: door.address,
      subtitle: door.result,
      address: door.address,
      lead: door.volunteer,
      status: door.followUp
        ? "Follow-up required"
        : door.result,
      notes: door.notes,
      x: door.x,
      y: door.y,
    }));

    const signItems = yardSigns.map((sign) => ({
      mapId: `sign-${sign.id}`,
      source: "sign",
      sourceId: sign.id,
      type: "sign",
      typeLabel: "Yard-sign location",
      marker: "S",
      title: sign.resident,
      subtitle: sign.status,
      address: sign.address,
      lead: sign.installer,
      status: sign.status,
      notes: sign.notes,
      x: sign.x,
      y: sign.y,
    }));

    const assignmentItems = assignments.map(
      (assignment) => ({
        mapId: `assignment-${assignment.id}`,
        source: "assignment",
        sourceId: assignment.id,
        type: "assignment",
        typeLabel: "Field assignment",
        marker: "A",
        title: assignment.title,
        subtitle: assignment.type,
        address: assignment.location,
        lead: assignment.lead,
        status: assignment.status,
        notes: assignment.notes,
        x: assignment.x,
        y: assignment.y,
      }),
    );

    return [
      ...routeItems,
      ...doorItems,
      ...signItems,
      ...assignmentItems,
    ];
  }, [
    assignments,
    doorLogs,
    routes,
    yardSigns,
  ]);

  const visibleMapItems = useMemo(
    () =>
      mapItems.filter(
        (item) => mapFilters[item.type],
      ),
    [
      mapFilters,
      mapItems,
    ],
  );

  useEffect(() => {
    if (
      !selectedMapItem &&
      visibleMapItems.length
    ) {
      setSelectedMapItem(visibleMapItems[0]);
    }
  }, [
    selectedMapItem,
    visibleMapItems,
  ]);

  const totalDoorsAssigned = routes.reduce(
    (total, route) =>
      total + route.doorsAssigned,
    0,
  );

  const totalDoorsKnocked = routes.reduce(
    (total, route) =>
      total + route.doorsKnocked,
    0,
  );

  const totalSupporters = routes.reduce(
    (total, route) =>
      total + route.supporters,
    0,
  );

  const totalFollowUps =
    routes.reduce(
      (total, route) =>
        total + route.followUps,
      0,
    ) +
    doorLogs.filter(
      (door) => door.followUp,
    ).length;

  const installedSigns = yardSigns.filter(
    (sign) => sign.status === "Installed",
  ).length;

  const openIssues = issues.filter(
    (issue) => issue.status !== "Resolved",
  ).length;

  const activeRoutes = routes.filter(
    (route) =>
      route.status !== "Completed",
  ).length;

  const volunteersWorking = new Set(
    assignments
      .filter(
        (assignment) =>
          assignment.status !== "Completed",
      )
      .flatMap((assignment) => [
        assignment.lead,
        ...assignment.helpers,
      ]),
  ).size;

  const openVolunteerActivity = (volunteerId) => {
    setSelectedVolunteerId(volunteerId);
    setVolunteerActivityTab("overview");
    setVolunteerActivityOpen(true);
  };

  const openMap = () => {
    setMapOpen(true);

    if (
      !selectedMapItem &&
      visibleMapItems.length
    ) {
      setSelectedMapItem(
        visibleMapItems[0],
      );
    }
  };

  const addRoute = (event) => {
    event.preventDefault();

    const route = {
      id: `route-${Date.now()}`,
      name: routeForm.name.trim(),
      precinct: routeForm.precinct.trim(),
      captain: routeForm.captain,
      volunteers: routeForm.volunteers
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      startAddress:
        routeForm.startAddress.trim(),
      doorsAssigned:
        Number.parseInt(
          routeForm.doorsAssigned,
          10,
        ) || 1,
      doorsKnocked: 0,
      supporters: 0,
      followUps: 0,
      signRequests: 0,
      status: "Not started",
      time: routeForm.time.trim(),
      instructions:
        routeForm.instructions.trim(),
      photos: routeForm.photos,
      x: Number(routeForm.mapX),
      y: Number(routeForm.mapY),
    };

    setRoutes((current) => [
      route,
      ...current,
    ]);

    setRouteForm(EMPTY_ROUTE);
    setModal(null);
    setActiveTab("routes");
  };

  const addDoorLog = (event) => {
    event.preventDefault();

    const door = {
      id: `door-${Date.now()}`,
      address: doorForm.address.trim(),
      precinct: doorForm.precinct.trim(),
      volunteer: doorForm.volunteer,
      result: doorForm.result,
      literature: doorForm.literature,
      signRequested:
        doorForm.signRequested,
      followUp: doorForm.followUp,
      notes: doorForm.notes.trim(),
      photos: doorForm.photos,
      date: "Just recorded",
      x: Number(doorForm.mapX),
      y: Number(doorForm.mapY),
    };

    setDoorLogs((current) => [
      door,
      ...current,
    ]);

    setDoorForm(EMPTY_DOOR);
    setModal(null);
    setActiveTab("doors");
  };

  const addYardSign = (event) => {
    event.preventDefault();

    const sign = {
      id: `sign-${Date.now()}`,
      resident: signForm.resident.trim(),
      address: signForm.address.trim(),
      installer: signForm.installer,
      status: signForm.status,
      permission: signForm.permission,
      installedDate:
        signForm.status === "Installed"
          ? "Today"
          : "Pending",
      pickupDate: "After Election Day",
      notes: signForm.notes.trim(),
      photos: signForm.photos,
      x: Number(signForm.mapX),
      y: Number(signForm.mapY),
    };

    setYardSigns((current) => [
      sign,
      ...current,
    ]);

    setSignForm(EMPTY_SIGN);
    setModal(null);
    setActiveTab("signs");
  };

  const addAssignment = (event) => {
    event.preventDefault();

    const placement = createPlacement(
      assignments.length + 15,
    );

    const assignment = {
      id: `assignment-${Date.now()}`,
      title: assignmentForm.title.trim(),
      type: assignmentForm.type,
      location:
        assignmentForm.location.trim(),
      lead: assignmentForm.lead,
      helpers: assignmentForm.helpers
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      status: assignmentForm.status,
      due: assignmentForm.due.trim(),
      notes: assignmentForm.notes.trim(),
      photos: assignmentForm.photos,
      ...placement,
    };

    setAssignments((current) => [
      assignment,
      ...current,
    ]);

    setAssignmentForm(EMPTY_ASSIGNMENT);
    setModal(null);
    setActiveTab("assignments");
  };

  const addIssue = (event) => {
    event.preventDefault();

    setIssues((current) => [
      {
        id: `issue-${Date.now()}`,
        type: issueForm.type,
        location: issueForm.location.trim(),
        reportedBy:
          "Elizabeth Accomando",
        priority: issueForm.priority,
        status: "Open",
        notes: issueForm.notes.trim(),
        photos: issueForm.photos,
      },
      ...current,
    ]);

    setIssueForm(EMPTY_ISSUE);
    setModal(null);
    setActiveTab("activity");
  };

  const addVolunteer = (event) => {
    event.preventDefault();

    const volunteer = {
      id: `volunteer-${Date.now()}`,
      initials:
        initialsFromName(
          volunteerForm.name,
        ) || "NV",
      name: volunteerForm.name.trim(),
      role: volunteerForm.role,
      phone: volunteerForm.phone.trim(),
      email: volunteerForm.email.trim(),
      status: volunteerForm.status,
      readiness: [
        "Orientation pending",
      ],
    };

    setVolunteers((current) => [
      volunteer,
      ...current,
    ]);

    setSelectedVolunteerId(volunteer.id);
    setVolunteerForm(EMPTY_VOLUNTEER);
    setModal(null);
    setActiveTab("roster");
  };

  const markSelectedComplete = () => {
    if (!selectedMapItem) {
      return;
    }

    const {
      source,
      sourceId,
    } = selectedMapItem;

    if (source === "route") {
      setRoutes((current) =>
        current.map((route) =>
          route.id === sourceId
            ? {
                ...route,
                status: "Completed",
                doorsKnocked:
                  route.doorsAssigned,
              }
            : route,
        ),
      );
    }

    if (source === "assignment") {
      setAssignments((current) =>
        current.map((assignment) =>
          assignment.id === sourceId
            ? {
                ...assignment,
                status: "Completed",
              }
            : assignment,
        ),
      );
    }

    if (source === "sign") {
      setYardSigns((current) =>
        current.map((sign) =>
          sign.id === sourceId
            ? {
                ...sign,
                status: "Installed",
                installedDate: "Today",
              }
            : sign,
        ),
      );
    }

    if (source === "door") {
      setDoorLogs((current) =>
        current.map((door) =>
          door.id === sourceId
            ? {
                ...door,
                followUp: false,
              }
            : door,
        ),
      );
    }

    setSelectedMapItem((current) =>
      current
        ? {
            ...current,
            status: "Completed",
          }
        : current,
    );
  };

  const resolveIssue = (id) => {
    setIssues((current) =>
      current.map((issue) =>
        issue.id === id
          ? {
              ...issue,
              status: "Resolved",
            }
          : issue,
      ),
    );
  };

  const renderMapPanel = (large = false) => (
    <section
      className={
        large
          ? styles.mapWorkspace
          : styles.mapPanel
      }
    >
      <header className={styles.panelHeader}>
        <div>
          <span>
            <Map size={19} />
          </span>

          <div>
            <h2>Field Activity Map</h2>
            <p>
              Saved routes, logged door visits, yard signs,
              and assignments in one view.
            </p>
          </div>
        </div>

        {!large ? (
          <button
            className={styles.textButton}
            type="button"
            onClick={openMap}
          >
            Open full activity map
            <Navigation size={15} />
          </button>
        ) : null}
      </header>

      <div className={styles.mapLegend}>
        <span data-type="route">
          Saved route
        </span>

        <span data-type="door">
          Logged door visit
        </span>

        <span data-type="sign">
          Yard-sign location
        </span>

        <span data-type="assignment">
          Field assignment
        </span>
      </div>

      <OperationsMapCanvas
        items={visibleMapItems}
        selectedItem={selectedMapItem}
        onSelect={setSelectedMapItem}
      />
    </section>
  );

  const renderOverview = () => (
    <>
      <section className={styles.metricGrid}>
        <article>
          <span>
            <Users size={21} />
          </span>

          <div>
            <small>Volunteer roster</small>
            <strong>{volunteers.length}</strong>
            <p>People available for assignments</p>
          </div>
        </article>

        <article>
          <span>
            <Route size={21} />
          </span>

          <div>
            <small>Saved routes</small>
            <strong>{routes.length}</strong>
            <p>Uploaded and created walk lists</p>
          </div>
        </article>

        <article>
          <span>
            <Footprints size={21} />
          </span>

          <div>
            <small>Doors completed</small>
            <strong>
              {totalDoorsKnocked}/{totalDoorsAssigned}
            </strong>
            <p>{totalSupporters} supporters identified</p>
          </div>
        </article>

        <article>
          <span>
            <Flag size={21} />
          </span>

          <div>
            <small>Signs installed</small>
            <strong>{installedSigns}</strong>
            <p>
              {yardSigns.length - installedSigns} pending
              or needing service
            </p>
          </div>
        </article>

        <article>
          <span>
            <MessageCircle size={21} />
          </span>

          <div>
            <small>Follow-ups due</small>
            <strong>{totalFollowUps}</strong>
            <p>Households and route responses</p>
          </div>
        </article>

        <article>
          <span>
            <AlertTriangle size={21} />
          </span>

          <div>
            <small>Open field issues</small>
            <strong>{openIssues}</strong>
            <p>Needs campaign attention</p>
          </div>
        </article>
      </section>

      <div className={styles.overviewGrid}>
        <div className={styles.overviewMain}>
          {renderMapPanel()}

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>
                  <Route size={19} />
                </span>

                <div>
                  <h2>Saved Routes & Walk Lists</h2>
                  <p>
                    Uploaded or created routes with their
                    logged door progress.
                  </p>
                </div>
              </div>

              <button
                className={styles.textButton}
                type="button"
                onClick={() =>
                  setActiveTab("routes")
                }
              >
                View all
              </button>
            </header>

            <div className={styles.routeGrid}>
              {routes.slice(0, 3).map((route) => {
                const progress = Math.round(
                  (
                    route.doorsKnocked /
                    route.doorsAssigned
                  ) * 100,
                );

                return (
                  <article
                    className={styles.routeCard}
                    key={route.id}
                  >
                    <header>
                      <div>
                        <span>{route.precinct}</span>
                        <h3>{route.name}</h3>
                      </div>

                      <StatusPill
                        status={route.status}
                      />
                    </header>

                    <div className={styles.routeLead}>
                      <strong>
                        Captain: {route.captain}
                      </strong>

                      <span>
                        {route.volunteers.length} volunteers
                      </span>
                    </div>

                    <div className={styles.progressTrack}>
                      <span
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>

                    <footer>
                      <span>
                        {route.doorsKnocked} of{" "}
                        {route.doorsAssigned} doors
                      </span>

                      <b>{progress}%</b>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className={styles.overviewSide}>
          <section className={styles.elizabethCard}>
            <header>
              <span>EA</span>

              <div>
                <small>Elizabeth’s field plan</small>
                <h2>Priority household visits</h2>
                <p>West District 6 · Route C</p>
              </div>
            </header>

            <div>
              <span>
                <Clock3 size={15} />
                1:30 PM–4:00 PM
              </span>

              <span>
                <MapPin size={15} />
                Seven priority stops
              </span>

              <span>
                <Flag size={15} />
                Three sign deliveries
              </span>

              <span>
                <Users size={15} />
                Marcus Reed assisting
              </span>
            </div>

            <button
              type="button"
              onClick={openMap}
            >
              <Map size={16} />
              Show Elizabeth’s stops
            </button>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>
                  <ClipboardCheck size={19} />
                </span>

                <div>
                  <h2>Assignment pulse</h2>
                  <p>Who is responsible right now</p>
                </div>
              </div>

              <button
                className={styles.iconButton}
                type="button"
                aria-label="Create field assignment"
                onClick={() =>
                  setModal("assignment")
                }
              >
                <Plus size={17} />
              </button>
            </header>

            <div className={styles.assignmentPulse}>
              {assignments
                .filter(
                  (assignment) =>
                    assignment.status !==
                    "Completed",
                )
                .slice(0, 4)
                .map((assignment) => (
                  <article key={assignment.id}>
                    <div>
                      <strong>
                        {assignment.title}
                      </strong>
                      <span>
                        {assignment.lead} ·{" "}
                        {assignment.location}
                      </span>
                    </div>

                    <StatusPill
                      status={assignment.status}
                    />
                  </article>
                ))}
            </div>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>
                  <AlertTriangle size={19} />
                </span>

                <div>
                  <h2>Needs attention</h2>
                  <p>Open field issues and blockers</p>
                </div>
              </div>

              <button
                className={styles.iconButton}
                type="button"
                aria-label="Report field issue"
                onClick={() =>
                  setModal("issue")
                }
              >
                <Plus size={17} />
              </button>
            </header>

            <div className={styles.issuePreview}>
              {issues
                .filter(
                  (issue) =>
                    issue.status !== "Resolved",
                )
                .slice(0, 3)
                .map((issue) => (
                  <article key={issue.id}>
                    <div>
                      <strong>{issue.type}</strong>
                      <span>{issue.location}</span>
                    </div>

                    <StatusPill
                      status={issue.priority}
                    />
                  </article>
                ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );

  const renderRoutes = () => (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <span>
            <Route size={19} />
          </span>

          <div>
            <h2>Saved Routes & Walk Lists</h2>
            <p>
              Store uploaded or manually created walking
              plans and log results as work is completed.
            </p>
          </div>
        </div>

        <button
          className={styles.primarySmall}
          type="button"
          onClick={() => setModal("route")}
        >
          <Plus size={16} />
          Create Walking Route
        </button>
      </header>

      <div className={styles.fullRouteGrid}>
        {routes.map((route) => {
          const progress = Math.round(
            (
              route.doorsKnocked /
              route.doorsAssigned
            ) * 100,
          );

          return (
            <article
              className={styles.fullRouteCard}
              key={route.id}
            >
              <header>
                <div>
                  <small>{route.precinct}</small>
                  <h3>{route.name}</h3>
                  <p>{route.startAddress}</p>
                </div>

                <StatusPill status={route.status} />
              </header>

              <div className={styles.routeStats}>
                <span>
                  <strong>{route.doorsAssigned}</strong>
                  Doors assigned
                </span>

                <span>
                  <strong>{route.doorsKnocked}</strong>
                  Doors knocked
                </span>

                <span>
                  <strong>{route.supporters}</strong>
                  Supporters
                </span>

                <span>
                  <strong>{route.signRequests}</strong>
                  Sign requests
                </span>
              </div>

              <div className={styles.routeTeam}>
                <strong>
                  Captain: {route.captain}
                </strong>

                <span>
                  Team: {route.volunteers.join(", ")}
                </span>
              </div>

              <PhotoCountButton
                photos={route.photos}
                label={`${route.name} documentation`}
                onOpen={() =>
                  setPhotoViewer({
                    title: route.name,
                    photos: route.photos || [],
                  })
                }
              />

              <div className={styles.progressTrack}>
                <span
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <footer>
                <span>
                  {route.time} · {route.instructions}
                </span>

                <b>{progress}% complete</b>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );

  const renderAssignments = () => {
    const columns = [
      "Assigned",
      "In progress",
      "Needs help",
      "Completed",
    ];

    return (
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <span>
              <ClipboardCheck size={19} />
            </span>

            <div>
              <h2>Field Assignment Board</h2>
              <p>
                Responsibility, helpers, locations,
                deadlines, and completion status.
              </p>
            </div>
          </div>

          <button
            className={styles.primarySmall}
            type="button"
            onClick={() =>
              setModal("assignment")
            }
          >
            <Plus size={16} />
            Assign Field Team
          </button>
        </header>

        <div className={styles.assignmentBoard}>
          {columns.map((column) => (
            <section key={column}>
              <header>
                <strong>{column}</strong>

                <span>
                  {
                    assignments.filter(
                      (assignment) =>
                        assignment.status ===
                        column,
                    ).length
                  }
                </span>
              </header>

              <div>
                {assignments
                  .filter(
                    (assignment) =>
                      assignment.status ===
                      column,
                  )
                  .map((assignment) => (
                    <article
                      className={styles.assignmentCard}
                      key={assignment.id}
                    >
                      <small>{assignment.type}</small>
                      <h3>{assignment.title}</h3>

                      <p>
                        <MapPin size={13} />
                        {assignment.location}
                      </p>

                      <p>
                        <UserCheck size={13} />
                        Lead: {assignment.lead}
                      </p>

                      <p>
                        <Users size={13} />
                        Helpers:{" "}
                        {assignment.helpers.length
                          ? assignment.helpers.join(", ")
                          : "None assigned"}
                      </p>

                      <PhotoCountButton
                        photos={assignment.photos}
                        label={`${assignment.title} documentation`}
                        onOpen={() =>
                          setPhotoViewer({
                            title: assignment.title,
                            photos: assignment.photos || [],
                          })
                        }
                      />

                      <footer>
                        <span>{assignment.due}</span>
                      </footer>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    );
  };

  const renderDoorLogs = () => (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <span>
            <Footprints size={19} />
          </span>

          <div>
            <h2>Door-Knocking Activity</h2>
            <p>
              Household results, literature, sign
              requests, and required follow-up.
            </p>
          </div>
        </div>

        <button
          className={styles.primarySmall}
          type="button"
          onClick={() => setModal("door")}
        >
          <Plus size={16} />
          Log Door Knock
        </button>
      </header>

      <div className={styles.dataTable}>
        <div className={styles.tableHeading}>
          <span>Household / Address</span>
          <span>Volunteer</span>
          <span>Result</span>
          <span>Literature</span>
          <span>Yard sign</span>
          <span>Follow-up</span>
        </div>

        {doorLogs.map((door) => (
          <article key={door.id}>
            <div>
              <strong>{door.address}</strong>
              <small>
                {door.precinct} · {door.date}
              </small>

              <PhotoCountButton
                photos={door.photos}
                label={`${door.address} documentation`}
                onOpen={() =>
                  setPhotoViewer({
                    title: door.address,
                    photos: door.photos || [],
                  })
                }
              />
            </div>

            <span>{door.volunteer}</span>

            <StatusPill status={door.result} />

            <span>
              {door.literature
                ? "Left"
                : "No"}
            </span>

            <span>
              {door.signRequested
                ? "Requested"
                : "No"}
            </span>

            <span>
              {door.followUp
                ? "Required"
                : "None"}
            </span>
          </article>
        ))}
      </div>
    </section>
  );

  const renderYardSigns = () => (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <span>
            <Flag size={19} />
          </span>

          <div>
            <h2>Yard-Sign Location Tracker</h2>
            <p>
              Permission, installer, condition, placement,
              replacement, and pickup details.
            </p>
          </div>
        </div>

        <button
          className={styles.primarySmall}
          type="button"
          onClick={() => setModal("sign")}
        >
          <Plus size={16} />
          Add Yard Sign Location
        </button>
      </header>

      <div className={styles.dataTable}>
        <div className={styles.signTableHeading}>
          <span>Property</span>
          <span>Address</span>
          <span>Installer</span>
          <span>Permission</span>
          <span>Status</span>
          <span>Installed</span>
        </div>

        {yardSigns.map((sign) => (
          <article
            className={styles.signTableRow}
            key={sign.id}
          >
            <div>
              <strong>{sign.resident}</strong>
              <small>{sign.notes}</small>

              <PhotoCountButton
                photos={sign.photos}
                label={`${sign.resident} documentation`}
                onOpen={() =>
                  setPhotoViewer({
                    title: sign.resident,
                    photos: sign.photos || [],
                  })
                }
              />
            </div>

            <span>{sign.address}</span>
            <span>{sign.installer}</span>

            <span>
              {sign.permission
                ? "Confirmed"
                : "Pending"}
            </span>

            <StatusPill status={sign.status} />

            <span>{sign.installedDate}</span>
          </article>
        ))}
      </div>
    </section>
  );

  const renderRoster = () => (
    <div className={styles.rosterLayout}>
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <span>
              <Users size={19} />
            </span>

            <div>
              <h2>Volunteer Roster</h2>
              <p>
                Contact information, readiness, current
                status, and field leadership.
              </p>
            </div>
          </div>

          <button
            className={styles.primarySmall}
            type="button"
            onClick={() =>
              setModal("volunteer")
            }
          >
            <UserPlus size={16} />
            Add Volunteer
          </button>
        </header>

        <label className={styles.rosterSearch}>
          <Search size={17} />

          <input
            type="search"
            value={rosterQuery}
            placeholder="Search volunteer, role, status, or training"
            onChange={(event) =>
              setRosterQuery(event.target.value)
            }
          />
        </label>

        <div className={styles.rosterList}>
          {filteredVolunteers.map(
            (volunteer) => (
              <button
                className={styles.volunteerRow}
                data-selected={
                  volunteer.id ===
                  selectedVolunteer?.id
                }
                type="button"
                key={volunteer.id}
                onClick={() =>
                  openVolunteerActivity(
                    volunteer.id,
                  )
                }
              >
                <span>{volunteer.initials}</span>

                <div>
                  <strong>{volunteer.name}</strong>
                  <small>{volunteer.role}</small>
                </div>

                <StatusPill
                  status={volunteer.status}
                />

                <div className={styles.readinessInline}>
                  {volunteer.readiness
                    .slice(0, 2)
                    .map((item) => (
                      <em key={item}>{item}</em>
                    ))}
                </div>
              </button>
            ),
          )}
        </div>
      </section>

      <aside className={styles.volunteerProfile}>
        <header>
          <span>{selectedVolunteer?.initials}</span>

          <div>
            <small>Volunteer profile</small>
            <h2>{selectedVolunteer?.name}</h2>
            <p>{selectedVolunteer?.role}</p>
          </div>
        </header>

        <StatusPill
          status={selectedVolunteer?.status || "Active"}
        />

        <div className={styles.profileReadiness}>
          <h3>Training & readiness</h3>

          {selectedVolunteer?.readiness.map(
            (item) => (
              <span key={item}>
                <CheckCircle2 size={14} />
                {item}
              </span>
            ),
          )}
        </div>

        <div className={styles.profileActions}>
          <a
            href={`mailto:${selectedVolunteer?.email}`}
          >
            <Mail size={16} />
            Email
          </a>

          <a
            href={`tel:${selectedVolunteer?.phone}`}
          >
            <PhoneCall size={16} />
            Call
          </a>
        </div>

        <div className={styles.profileActivity}>
          <h3>Field activity</h3>

          <span>
            Current assignment:{" "}
            {
              assignments.find(
                (assignment) =>
                  assignment.lead ===
                    selectedVolunteer?.name ||
                  assignment.helpers.includes(
                    selectedVolunteer?.name,
                  ),
              )?.title || "No active assignment"
            }
          </span>

          <span>
            Doors recorded:{" "}
            {
              doorLogs.filter(
                (door) =>
                  door.volunteer ===
                  selectedVolunteer?.name,
              ).length
            }
          </span>

          <span>
            Yard signs assigned:{" "}
            {
              yardSigns.filter(
                (sign) =>
                  sign.installer ===
                  selectedVolunteer?.name,
              ).length
            }
          </span>
        </div>

        <button
          className={styles.profileViewButton}
          type="button"
          onClick={() =>
            openVolunteerActivity(
              selectedVolunteer.id,
            )
          }
        >
          <BarChart3 size={17} />
          View Full Activity
        </button>
      </aside>
    </div>
  );

  const renderActivity = () => (
    <div className={styles.activityGrid}>
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <span>
              <AlertTriangle size={19} />
            </span>

            <div>
              <h2>Field Issues</h2>
              <p>
                Safety, route access, supplies, addresses,
                weather, and other blockers.
              </p>
            </div>
          </div>

          <button
            className={styles.primarySmall}
            type="button"
            onClick={() =>
              setModal("issue")
            }
          >
            <Plus size={16} />
            Report Field Issue
          </button>
        </header>

        <div className={styles.issueList}>
          {issues.map((issue) => (
            <article key={issue.id}>
              <div>
                <header>
                  <strong>{issue.type}</strong>
                  <StatusPill
                    status={issue.priority}
                  />
                </header>

                <p>{issue.notes}</p>

                <small>
                  {issue.location} · Reported by{" "}
                  {issue.reportedBy}
                </small>

                  <PhotoCountButton
                    photos={issue.photos}
                    label={`${issue.type} documentation`}
                    onOpen={() =>
                      setPhotoViewer({
                        title: issue.type,
                        photos: issue.photos || [],
                      })
                    }
                  />
              </div>

              <button
                type="button"
                disabled={
                  issue.status === "Resolved"
                }
                onClick={() =>
                  resolveIssue(issue.id)
                }
              >
                <CheckCircle2 size={16} />
                {issue.status === "Resolved"
                  ? "Resolved"
                  : "Resolve"}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.dailyReportCard}>
        <header>
          <span>
            <Download size={21} />
          </span>

          <div>
            <small>Daily campaign closeout</small>
            <h2>Field Operations Report</h2>
            <p>Wednesday, July 29, 2026</p>
          </div>
        </header>

        <div className={styles.dailyReportMetrics}>
          <span>
            <strong>{volunteersWorking}</strong>
            Volunteers working
          </span>

          <span>
            <strong>{totalDoorsKnocked}</strong>
            Doors completed
          </span>

          <span>
            <strong>{totalSupporters}</strong>
            Supporters identified
          </span>

          <span>
            <strong>{installedSigns}</strong>
            Signs installed
          </span>

          <span>
            <strong>{totalFollowUps}</strong>
            Follow-ups created
          </span>

          <span>
            <strong>{openIssues}</strong>
            Open issues
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            setModal("closeout")
          }
        >
          <ClipboardList size={16} />
          Open Daily Closeout
        </button>
      </section>
    </div>
  );

  return (
    <CampaignWorkspaceShell activeItem="Volunteers">
      <main className={styles.main}>
        <div className={styles.page}>
          <header className={styles.pageHeader}>
            <div>
              <span className={styles.eyebrow}>
                Field & Volunteer Operations
              </span>

              <h1>Volunteer Command Center</h1>

              <p>
                See who is working, where they are
                assigned, which doors have been visited,
                where signs are located, and what needs
                attention next.
              </p>
            </div>

            <div className={styles.topActions}>
              <button
                className={styles.secondaryAction}
                type="button"
                onClick={openMap}
              >
                <Map size={17} />
                Open Activity Map
              </button>

              <button
                className={styles.secondaryAction}
                type="button"
                onClick={() => setActiveTab("roster")}
              >
                <Users size={17} />
                See All Volunteers
              </button>

              <button
                className={styles.secondaryAction}
                type="button"
                onClick={() => setModal("route")}
              >
                <Route size={17} />
                Create Route
              </button>

              <button
                className={styles.secondaryAction}
                type="button"
                onClick={() => setModal("door")}
              >
                <Footprints size={17} />
                Log Door Knock
              </button>

              <button
                className={styles.primaryAction}
                type="button"
                onClick={() => setModal("sign")}
              >
                <Flag size={17} />
                Add Yard Sign
              </button>
            </div>
          </header>

          <nav
            className={styles.tabBar}
            aria-label="Volunteer operations sections"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;

              return (
                <button
                  type="button"
                  key={tab.id}
                  data-active={
                    activeTab === tab.id
                  }
                  onClick={() =>
                    setActiveTab(tab.id)
                  }
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {activeTab === "overview"
            ? renderOverview()
            : null}

          {activeTab === "map"
            ? renderMapPanel(true)
            : null}

          {activeTab === "routes"
            ? renderRoutes()
            : null}

          {activeTab === "assignments"
            ? renderAssignments()
            : null}

          {activeTab === "doors"
            ? renderDoorLogs()
            : null}

          {activeTab === "signs"
            ? renderYardSigns()
            : null}

          {activeTab === "roster"
            ? renderRoster()
            : null}

          {activeTab === "activity"
            ? renderActivity()
            : null}
        </div>

        {volunteerActivityOpen && selectedVolunteer ? (
          <ModalShell
            title={selectedVolunteer.name}
            eyebrow="Volunteer activity profile"
            icon={Users}
            wide
            onClose={() =>
              setVolunteerActivityOpen(false)
            }
          >
            <div className={styles.volunteerActivityProfile}>
              <section className={styles.activityProfileHero}>
                <div className={styles.activityProfileIdentity}>
                  <span className={styles.activityProfileAvatar}>
                    {selectedVolunteer.initials}
                  </span>

                  <div>
                    <StatusPill
                      status={selectedVolunteer.status}
                    />

                    <h2>{selectedVolunteer.role}</h2>

                    <p>
                      Review this volunteer’s logged campaign work,
                      outcomes, responsibilities, follow-ups, and
                      documentation.
                    </p>
                  </div>
                </div>

                <div className={styles.activityProfileContact}>
                  <a href={`mailto:${selectedVolunteer.email}`}>
                    <Mail size={17} />
                    Email
                  </a>

                  <a href={`tel:${selectedVolunteer.phone}`}>
                    <PhoneCall size={17} />
                    Call
                  </a>
                </div>
              </section>

              <nav
                className={styles.activityProfileTabs}
                aria-label="Volunteer activity profile sections"
              >
                {[
                  [
                    "overview",
                    "Overview",
                    BarChart3,
                  ],
                  [
                    "doors",
                    "Door Knocking",
                    Footprints,
                  ],
                  [
                    "work",
                    "Assignments & Routes",
                    ClipboardCheck,
                  ],
                  [
                    "signs",
                    "Signs & Photos",
                    Camera,
                  ],
                ].map(
                  ([
                    id,
                    label,
                    Icon,
                  ]) => (
                    <button
                      key={id}
                      type="button"
                      data-active={
                        volunteerActivityTab === id
                      }
                      onClick={() =>
                        setVolunteerActivityTab(id)
                      }
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ),
                )}
              </nav>

              {volunteerActivityTab === "overview" ? (
                <>
                  <section className={styles.activityMetricGrid}>
                    <article>
                      <span>
                        <Footprints size={20} />
                      </span>

                      <div>
                        <strong>
                          {selectedVolunteerActivity.doors.length}
                        </strong>
                        <small>Door records</small>
                      </div>
                    </article>

                    <article>
                      <span>
                        <CheckCircle2 size={20} />
                      </span>

                      <div>
                        <strong>
                          {selectedVolunteerActivity.supporters}
                        </strong>
                        <small>Supporters</small>
                      </div>
                    </article>

                    <article>
                      <span>
                        <MessageCircle size={20} />
                      </span>

                      <div>
                        <strong>
                          {selectedVolunteerActivity.followUps}
                        </strong>
                        <small>Follow-ups</small>
                      </div>
                    </article>

                    <article>
                      <span>
                        <Flag size={20} />
                      </span>

                      <div>
                        <strong>
                          {selectedVolunteerActivity.signs.length}
                        </strong>
                        <small>Signs assigned</small>
                      </div>
                    </article>

                    <article>
                      <span>
                        <ClipboardCheck size={20} />
                      </span>

                      <div>
                        <strong>
                          {
                            selectedVolunteerActivity
                              .assignments.length
                          }
                        </strong>
                        <small>Assignments</small>
                      </div>
                    </article>

                    <article>
                      <span>
                        <Route size={20} />
                      </span>

                      <div>
                        <strong>
                          {selectedVolunteerActivity.routes.length}
                        </strong>
                        <small>Routes</small>
                      </div>
                    </article>

                    <article>
                      <span>
                        <Camera size={20} />
                      </span>

                      <div>
                        <strong>
                          {selectedVolunteerActivity.photoCount}
                        </strong>
                        <small>Field photos</small>
                      </div>
                    </article>

                    <article>
                      <span>
                        <AlertTriangle size={20} />
                      </span>

                      <div>
                        <strong>
                          {selectedVolunteerActivity.issues.length}
                        </strong>
                        <small>Issues reported</small>
                      </div>
                    </article>
                  </section>

                  <div className={styles.activityProfileColumns}>
                    <section className={styles.activityProfileSection}>
                      <header>
                        <div>
                          <ClipboardCheck size={19} />
                          <h3>Current responsibilities</h3>
                        </div>

                        <span>
                          {
                            selectedVolunteerActivity.assignments
                              .filter(
                                (assignment) =>
                                  assignment.status !==
                                  "Completed",
                              )
                              .length
                          }{" "}
                          open
                        </span>
                      </header>

                      <div className={styles.activitySummaryList}>
                        {selectedVolunteerActivity.assignments.length ? (
                          selectedVolunteerActivity.assignments.map(
                            (assignment) => (
                              <article key={assignment.id}>
                                <div>
                                  <strong>
                                    {assignment.title}
                                  </strong>

                                  <small>
                                    {assignment.location} ·{" "}
                                    {
                                      assignment.lead ===
                                      selectedVolunteer.name
                                        ? "Lead"
                                        : "Helper"
                                    }
                                  </small>
                                </div>

                                <StatusPill
                                  status={assignment.status}
                                />
                              </article>
                            ),
                          )
                        ) : (
                          <p className={styles.activityEmpty}>
                            No assignments are currently connected
                            to this volunteer.
                          </p>
                        )}
                      </div>
                    </section>

                    <section className={styles.activityProfileSection}>
                      <header>
                        <div>
                          <UserCheck size={19} />
                          <h3>Training & readiness</h3>
                        </div>
                      </header>

                      <div className={styles.activityReadinessList}>
                        {selectedVolunteer.readiness.map(
                          (item) => (
                            <span key={item}>
                              <CheckCircle2 size={16} />
                              {item}
                            </span>
                          ),
                        )}
                      </div>

                      <dl className={styles.activityContactDetails}>
                        <div>
                          <dt>Email</dt>
                          <dd>{selectedVolunteer.email}</dd>
                        </div>

                        <div>
                          <dt>Phone</dt>
                          <dd>{selectedVolunteer.phone}</dd>
                        </div>
                      </dl>
                    </section>

                    <section className={styles.activityProfileSection}>
                      <header>
                        <div>
                          <Footprints size={19} />
                          <h3>Door-knocking outcomes</h3>
                        </div>
                      </header>

                      <div className={styles.activityOutcomeGrid}>
                        <span>
                          <strong>
                            {selectedVolunteerActivity.supporters}
                          </strong>
                          Supporters
                        </span>

                        <span>
                          <strong>
                            {selectedVolunteerActivity.undecided}
                          </strong>
                          Undecided
                        </span>

                        <span>
                          <strong>
                            {selectedVolunteerActivity.notHome}
                          </strong>
                          Not home
                        </span>

                        <span>
                          <strong>
                            {
                              selectedVolunteerActivity
                                .literatureLeft
                            }
                          </strong>
                          Literature left
                        </span>

                        <span>
                          <strong>
                            {
                              selectedVolunteerActivity
                                .signRequests
                            }
                          </strong>
                          Sign requests
                        </span>

                        <span>
                          <strong>
                            {selectedVolunteerActivity.followUps}
                          </strong>
                          Follow-ups
                        </span>
                      </div>
                    </section>

                    <section className={styles.activityProfileSection}>
                      <header>
                        <div>
                          <AlertTriangle size={19} />
                          <h3>Reported field issues</h3>
                        </div>
                      </header>

                      <div className={styles.activitySummaryList}>
                        {selectedVolunteerActivity.issues.length ? (
                          selectedVolunteerActivity.issues.map(
                            (issue) => (
                              <article key={issue.id}>
                                <div>
                                  <strong>{issue.type}</strong>
                                  <small>
                                    {issue.location}
                                  </small>
                                </div>

                                <StatusPill
                                  status={issue.priority}
                                />
                              </article>
                            ),
                          )
                        ) : (
                          <p className={styles.activityEmpty}>
                            No field issues have been reported by
                            this volunteer.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>
                </>
              ) : null}

              {volunteerActivityTab === "doors" ? (
                <section className={styles.activityProfileSection}>
                  <header>
                    <div>
                      <Footprints size={19} />
                      <h3>Individual door-knocking records</h3>
                    </div>

                    <span>
                      {selectedVolunteerActivity.doors.length} logged
                    </span>
                  </header>

                  <div className={styles.activityRecordList}>
                    {selectedVolunteerActivity.doors.length ? (
                      selectedVolunteerActivity.doors.map(
                        (door) => (
                          <article key={door.id}>
                            <div className={styles.activityRecordMain}>
                              <div>
                                <strong>{door.address}</strong>

                                <small>
                                  {door.precinct} · {door.date}
                                </small>
                              </div>

                              <StatusPill
                                status={door.result}
                              />
                            </div>

                            <div className={styles.activityRecordTags}>
                              <span>
                                Literature:{" "}
                                {door.literature
                                  ? "Left"
                                  : "No"}
                              </span>

                              <span>
                                Yard sign:{" "}
                                {door.signRequested
                                  ? "Requested"
                                  : "No"}
                              </span>

                              <span>
                                Follow-up:{" "}
                                {door.followUp
                                  ? "Required"
                                  : "None"}
                              </span>
                            </div>

                            {door.notes ? (
                              <p>{door.notes}</p>
                            ) : null}

                            <PhotoCountButton
                              photos={door.photos}
                              label={`${door.address} documentation`}
                              onOpen={() =>
                                setPhotoViewer({
                                  title: door.address,
                                  photos: door.photos || [],
                                })
                              }
                            />
                          </article>
                        ),
                      )
                    ) : (
                      <p className={styles.activityEmpty}>
                        No door-knocking records have been logged
                        for this volunteer yet.
                      </p>
                    )}
                  </div>
                </section>
              ) : null}

              {volunteerActivityTab === "work" ? (
                <div className={styles.activityProfileColumns}>
                  <section className={styles.activityProfileSection}>
                    <header>
                      <div>
                        <ClipboardCheck size={19} />
                        <h3>Assignments</h3>
                      </div>

                      <span>
                        {
                          selectedVolunteerActivity
                            .completedAssignments
                        }{" "}
                        completed
                      </span>
                    </header>

                    <div className={styles.activityWorkList}>
                      {selectedVolunteerActivity.assignments.length ? (
                        selectedVolunteerActivity.assignments.map(
                          (assignment) => (
                            <article key={assignment.id}>
                              <header>
                                <div>
                                  <small>{assignment.type}</small>
                                  <h4>{assignment.title}</h4>
                                </div>

                                <StatusPill
                                  status={assignment.status}
                                />
                              </header>

                              <p>
                                <MapPin size={15} />
                                {assignment.location}
                              </p>

                              <p>
                                <UserCheck size={15} />
                                {
                                  assignment.lead ===
                                  selectedVolunteer.name
                                    ? "Assignment lead"
                                    : `Helping ${assignment.lead}`
                                }
                              </p>

                              <p>
                                <ClipboardList size={15} />
                                {assignment.due}
                              </p>

                              {assignment.notes ? (
                                <blockquote>
                                  {assignment.notes}
                                </blockquote>
                              ) : null}

                              <PhotoCountButton
                                photos={assignment.photos}
                                label={`${assignment.title} documentation`}
                                onOpen={() =>
                                  setPhotoViewer({
                                    title: assignment.title,
                                    photos:
                                      assignment.photos || [],
                                  })
                                }
                              />
                            </article>
                          ),
                        )
                      ) : (
                        <p className={styles.activityEmpty}>
                          No assignments are connected to this
                          volunteer.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className={styles.activityProfileSection}>
                    <header>
                      <div>
                        <Route size={19} />
                        <h3>Routes & walk lists</h3>
                      </div>

                      <span>
                        {selectedVolunteerActivity.routes.length}
                      </span>
                    </header>

                    <div className={styles.activityWorkList}>
                      {selectedVolunteerActivity.routes.length ? (
                        selectedVolunteerActivity.routes.map(
                          (route) => {
                            const progress = Math.round(
                              (
                                route.doorsKnocked /
                                Math.max(
                                  route.doorsAssigned,
                                  1,
                                )
                              ) * 100,
                            );

                            return (
                              <article key={route.id}>
                                <header>
                                  <div>
                                    <small>
                                      {route.precinct}
                                    </small>
                                    <h4>{route.name}</h4>
                                  </div>

                                  <StatusPill
                                    status={route.status}
                                  />
                                </header>

                                <p>
                                  <MapPin size={15} />
                                  {route.startAddress}
                                </p>

                                <p>
                                  <UserCheck size={15} />
                                  {
                                    route.captain ===
                                    selectedVolunteer.name
                                      ? "Route captain"
                                      : `Captain: ${route.captain}`
                                  }
                                </p>

                                <div
                                  className={
                                    styles.activityRouteProgress
                                  }
                                >
                                  <div>
                                    <span
                                      style={{
                                        width: `${progress}%`,
                                      }}
                                    />
                                  </div>

                                  <footer>
                                    <span>
                                      Team progress:{" "}
                                      {route.doorsKnocked} of{" "}
                                      {route.doorsAssigned} doors
                                    </span>

                                    <strong>
                                      {progress}%
                                    </strong>
                                  </footer>
                                </div>

                                <PhotoCountButton
                                  photos={route.photos}
                                  label={`${route.name} documentation`}
                                  onOpen={() =>
                                    setPhotoViewer({
                                      title: route.name,
                                      photos:
                                        route.photos || [],
                                    })
                                  }
                                />
                              </article>
                            );
                          },
                        )
                      ) : (
                        <p className={styles.activityEmpty}>
                          No saved routes include this volunteer.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              ) : null}

              {volunteerActivityTab === "signs" ? (
                <div className={styles.activityProfileColumns}>
                  <section className={styles.activityProfileSection}>
                    <header>
                      <div>
                        <Flag size={19} />
                        <h3>Yard-sign responsibilities</h3>
                      </div>

                      <span>
                        {
                          selectedVolunteerActivity
                            .installedSigns
                        }{" "}
                        installed
                      </span>
                    </header>

                    <div className={styles.activityWorkList}>
                      {selectedVolunteerActivity.signs.length ? (
                        selectedVolunteerActivity.signs.map(
                          (sign) => (
                            <article key={sign.id}>
                              <header>
                                <div>
                                  <small>
                                    {sign.permission
                                      ? "Permission confirmed"
                                      : "Permission pending"}
                                  </small>

                                  <h4>{sign.resident}</h4>
                                </div>

                                <StatusPill
                                  status={sign.status}
                                />
                              </header>

                              <p>
                                <MapPin size={15} />
                                {sign.address}
                              </p>

                              <p>
                                <ClipboardList size={15} />
                                Installed:{" "}
                                {sign.installed || "Pending"}
                              </p>

                              {sign.notes ? (
                                <blockquote>
                                  {sign.notes}
                                </blockquote>
                              ) : null}

                              <PhotoCountButton
                                photos={sign.photos}
                                label={`${sign.resident} documentation`}
                                onOpen={() =>
                                  setPhotoViewer({
                                    title: sign.resident,
                                    photos: sign.photos || [],
                                  })
                                }
                              />
                            </article>
                          ),
                        )
                      ) : (
                        <p className={styles.activityEmpty}>
                          No yard-sign locations are assigned to
                          this volunteer.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className={styles.activityProfileSection}>
                    <header>
                      <div>
                        <Camera size={19} />
                        <h3>Field documentation</h3>
                      </div>

                      <span>
                        {selectedVolunteerActivity.photoCount} photos
                      </span>
                    </header>

                    <div className={styles.activityPhotoRecords}>
                      {
                        selectedVolunteerActivity
                          .photoRecords.length
                          ? selectedVolunteerActivity
                              .photoRecords.map(
                                (record) => (
                                  <button
                                    key={record.id}
                                    type="button"
                                    onClick={() =>
                                      setPhotoViewer({
                                        title: record.title,
                                        photos:
                                          record.photos,
                                      })
                                    }
                                  >
                                    <span>
                                      <Camera size={18} />
                                    </span>

                                    <div>
                                      <small>
                                        {record.type}
                                      </small>

                                      <strong>
                                        {record.title}
                                      </strong>

                                      <p>
                                        {
                                          record.photos
                                            .length
                                        }{" "}
                                        photo
                                        {
                                          record.photos
                                            .length === 1
                                            ? ""
                                            : "s"
                                        }
                                      </p>
                                    </div>
                                  </button>
                                ),
                              )
                          : (
                            <p className={styles.activityEmpty}>
                              No field photos are connected to
                              this volunteer yet.
                            </p>
                          )
                      }
                    </div>
                  </section>
                </div>
              ) : null}

              <p className={styles.activityProfileDisclosure}>
                This profile is calculated from the volunteer,
                assignment, route, door-knocking, yard-sign,
                issue, and photo records stored in this browser
                tab. Shared production storage and live mobile
                syncing are not connected yet.
              </p>
            </div>
          </ModalShell>
        ) : null}

        {photoViewer ? (
          <ModalShell
            title={photoViewer.title}
            eyebrow="Field photo documentation"
            icon={Camera}
            wide
            onClose={() => setPhotoViewer(null)}
          >
            <div className={styles.photoViewerGrid}>
              {photoViewer.photos.map(
                (photo, index) => (
                  <article
                    className={styles.photoViewerCard}
                    key={photo.id}
                  >
                    <img
                      src={photo.dataUrl}
                      alt={`${photoViewer.title} photo ${
                        index + 1
                      }`}
                    />

                    <footer>
                      <Camera size={15} />
                      <span>Photo {index + 1}</span>
                    </footer>
                  </article>
                ),
              )}
            </div>

            <p className={styles.photoViewerDisclosure}>
              These compressed preview photos remain in
              this browser tab. Production photo storage
              is not connected yet.
            </p>
          </ModalShell>
        ) : null}

        {mapOpen ? (
          <ModalShell
            title="Field Activity Map"
            eyebrow="Logged District 6 campaign activity"
            icon={Map}
            wide
            onClose={() => setMapOpen(false)}
          >
            <div className={styles.mapModalLayout}>
              <aside className={styles.mapFilterPanel}>
                <h3>Map layers</h3>

                {[
                  ["route", "Saved routes"],
                  ["door", "Logged door visits"],
                  ["sign", "Yard-sign locations"],
                  ["assignment", "Field assignments"],
                ].map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={mapFilters[key]}
                      onChange={() =>
                        setMapFilters(
                          (current) => ({
                            ...current,
                            [key]:
                              !current[key],
                          }),
                        )
                      }
                    />

                    <span data-type={key} />
                    {label}
                  </label>
                ))}

                <div className={styles.mapTotals}>
                  <span>
                    <strong>{routes.length}</strong>
                    Saved routes
                  </span>

                  <span>
                    <strong>{doorLogs.length}</strong>
                    Door records
                  </span>

                  <span>
                    <strong>{yardSigns.length}</strong>
                    Sign locations
                  </span>

                  <span>
                    <strong>{assignments.length}</strong>
                    Assignments
                  </span>
                </div>
              </aside>

              <OperationsMapCanvas
                items={visibleMapItems}
                selectedItem={selectedMapItem}
                onSelect={setSelectedMapItem}
              />

              <aside className={styles.mapDetailPanel}>
                {selectedMapItem ? (
                  <>
                    <small>
                      {selectedMapItem.typeLabel}
                    </small>

                    <h3>
                      {selectedMapItem.title}
                    </h3>

                    <StatusPill
                      status={
                        selectedMapItem.status
                      }
                    />

                    <dl>
                      <div>
                        <dt>Location</dt>
                        <dd>
                          {selectedMapItem.address}
                        </dd>
                      </div>

                      <div>
                        <dt>Assigned lead</dt>
                        <dd>{selectedMapItem.lead}</dd>
                      </div>

                      <div>
                        <dt>Details</dt>
                        <dd>
                          {selectedMapItem.subtitle}
                        </dd>
                      </div>

                      <div>
                        <dt>Notes</dt>
                        <dd>
                          {selectedMapItem.notes ||
                            "No notes recorded."}
                        </dd>
                      </div>
                    </dl>

                    <div className={styles.mapDetailActions}>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          selectedMapItem.address,
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Navigation size={15} />
                        Directions
                      </a>

                      <button
                        type="button"
                        onClick={markSelectedComplete}
                      >
                        <CheckCircle2 size={15} />
                        Mark Complete
                      </button>
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyMapDetail}>
                    <MapPin size={25} />
                    <strong>Select a map marker</strong>
                    <span>
                      Location and assignment details will
                      appear here.
                    </span>
                  </div>
                )}
              </aside>
            </div>
          </ModalShell>
        ) : null}

        {modal === "route" ? (
          <ModalShell
            title="Create Walking Route"
            eyebrow="Routes & precincts"
            icon={Route}
            onClose={() => setModal(null)}
          >
            <form
              className={styles.modalForm}
              onSubmit={addRoute}
            >
              <div className={styles.formGrid}>
                <label className={styles.formWide}>
                  <span>Route name</span>
                  <input
                    required
                    autoFocus
                    value={routeForm.name}
                    placeholder="Example: Precinct 602 Route D"
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          name: event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Precinct</span>
                  <input
                    required
                    value={routeForm.precinct}
                    placeholder="Precinct number"
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          precinct:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Door goal</span>
                  <input
                    required
                    min="1"
                    type="number"
                    value={routeForm.doorsAssigned}
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          doorsAssigned:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label className={styles.formWide}>
                  <span>Starting location</span>
                  <input
                    required
                    value={routeForm.startAddress}
                    placeholder="Meeting or starting address"
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          startAddress:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <div
                  className={`${styles.formWide} ${styles.mapPickerField}`}
                >
                  <MapPointPicker
                    label="Route starting point"
                    x={routeForm.mapX}
                    y={routeForm.mapY}
                    onChange={({ x, y }) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          mapX: x,
                          mapY: y,
                        }),
                      )
                    }
                  />
                </div>

                <label>
                  <span>Team captain</span>
                  <select
                    value={routeForm.captain}
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          captain:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    {volunteers.map((volunteer) => (
                      <option
                        key={volunteer.id}
                        value={volunteer.name}
                      >
                        {volunteer.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Start / end time</span>
                  <input
                    required
                    value={routeForm.time}
                    placeholder="9:00 AM–12:00 PM"
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          time: event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label className={styles.formWide}>
                  <span>
                    Assigned volunteers
                  </span>
                  <input
                    value={routeForm.volunteers}
                    placeholder="Separate names with commas"
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          volunteers:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label className={styles.formWide}>
                  <span>Instructions</span>
                  <textarea
                    value={routeForm.instructions}
                    placeholder="Meeting instructions, materials, or route notes"
                    onChange={(event) =>
                      setRouteForm(
                        (current) => ({
                          ...current,
                          instructions:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </div>

              <p className={styles.previewDisclosure}>
                This preview saves the route in the
                current browser tab. Live route geocoding
                and shared Supabase storage are not
                connected yet.
              </p>

              <PhotoAttachmentField
                label="Route documentation"
                photos={routeForm.photos}
                onChange={(photos) =>
                  setRouteForm((current) => ({
                    ...current,
                    photos,
                  }))
                }
              />

              <footer className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>

                <button type="submit">
                  <Route size={16} />
                  Create Route
                </button>
              </footer>
            </form>
          </ModalShell>
        ) : null}

        {modal === "door" ? (
          <ModalShell
            title="Log Door Knock"
            eyebrow="Household activity"
            icon={Footprints}
            onClose={() => setModal(null)}
          >
            <form
              className={styles.modalForm}
              onSubmit={addDoorLog}
            >
              <div className={styles.formGrid}>
                <label className={styles.formWide}>
                  <span>Address or household</span>
                  <input
                    required
                    autoFocus
                    value={doorForm.address}
                    placeholder="Enter household address"
                    onChange={(event) =>
                      setDoorForm(
                        (current) => ({
                          ...current,
                          address:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <div
                  className={`${styles.formWide} ${styles.mapPickerField}`}
                >
                  <MapPointPicker
                    label="Door-visit location"
                    x={doorForm.mapX}
                    y={doorForm.mapY}
                    onChange={({ x, y }) =>
                      setDoorForm(
                        (current) => ({
                          ...current,
                          mapX: x,
                          mapY: y,
                        }),
                      )
                    }
                  />
                </div>

                <label>
                  <span>Precinct</span>
                  <input
                    required
                    value={doorForm.precinct}
                    placeholder="Precinct"
                    onChange={(event) =>
                      setDoorForm(
                        (current) => ({
                          ...current,
                          precinct:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Volunteer</span>
                  <select
                    value={doorForm.volunteer}
                    onChange={(event) =>
                      setDoorForm(
                        (current) => ({
                          ...current,
                          volunteer:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    {volunteers.map((volunteer) => (
                      <option
                        key={volunteer.id}
                        value={volunteer.name}
                      >
                        {volunteer.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.formWide}>
                  <span>Result</span>
                  <select
                    value={doorForm.result}
                    onChange={(event) =>
                      setDoorForm(
                        (current) => ({
                          ...current,
                          result:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    <option>Supporter</option>
                    <option>Undecided</option>
                    <option>Not home</option>
                    <option>Refused</option>
                    <option>Moved</option>
                    <option>Inaccessible</option>
                    <option>Follow-up needed</option>
                  </select>
                </label>

                <div className={styles.checkboxGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={doorForm.literature}
                      onChange={(event) =>
                        setDoorForm(
                          (current) => ({
                            ...current,
                            literature:
                              event.target.checked,
                          }),
                        )
                      }
                    />
                    Literature left
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={
                        doorForm.signRequested
                      }
                      onChange={(event) =>
                        setDoorForm(
                          (current) => ({
                            ...current,
                            signRequested:
                              event.target.checked,
                          }),
                        )
                      }
                    />
                    Yard sign requested
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={doorForm.followUp}
                      onChange={(event) =>
                        setDoorForm(
                          (current) => ({
                            ...current,
                            followUp:
                              event.target.checked,
                          }),
                        )
                      }
                    />
                    Follow-up required
                  </label>
                </div>

                <label className={styles.formWide}>
                  <span>Notes</span>
                  <textarea
                    value={doorForm.notes}
                    placeholder="Household response or follow-up details"
                    onChange={(event) =>
                      setDoorForm(
                        (current) => ({
                          ...current,
                          notes:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </div>

              <p className={styles.previewDisclosure}>
                Exact household information remains in
                this browser tab only during this preview.
              </p>

              <PhotoAttachmentField
                label="Door-visit documentation"
                photos={doorForm.photos}
                onChange={(photos) =>
                  setDoorForm((current) => ({
                    ...current,
                    photos,
                  }))
                }
              />

              <footer className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>

                <button type="submit">
                  <Footprints size={16} />
                  Save Door Record
                </button>
              </footer>
            </form>
          </ModalShell>
        ) : null}

        {modal === "sign" ? (
          <ModalShell
            title="Add Yard Sign Location"
            eyebrow="Sign lifecycle"
            icon={Flag}
            onClose={() => setModal(null)}
          >
            <form
              className={styles.modalForm}
              onSubmit={addYardSign}
            >
              <div className={styles.formGrid}>
                <label>
                  <span>Resident / property</span>
                  <input
                    required
                    autoFocus
                    value={signForm.resident}
                    placeholder="Property or resident name"
                    onChange={(event) =>
                      setSignForm(
                        (current) => ({
                          ...current,
                          resident:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Assigned installer</span>
                  <select
                    value={signForm.installer}
                    onChange={(event) =>
                      setSignForm(
                        (current) => ({
                          ...current,
                          installer:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    {volunteers.map((volunteer) => (
                      <option
                        key={volunteer.id}
                        value={volunteer.name}
                      >
                        {volunteer.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.formWide}>
                  <span>Exact address</span>
                  <input
                    required
                    value={signForm.address}
                    placeholder="Yard-sign installation address"
                    onChange={(event) =>
                      setSignForm(
                        (current) => ({
                          ...current,
                          address:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <div
                  className={`${styles.formWide} ${styles.mapPickerField}`}
                >
                  <MapPointPicker
                    label="Yard-sign location"
                    x={signForm.mapX}
                    y={signForm.mapY}
                    onChange={({ x, y }) =>
                      setSignForm(
                        (current) => ({
                          ...current,
                          mapX: x,
                          mapY: y,
                        }),
                      )
                    }
                  />
                </div>

                <label className={styles.formWide}>
                  <span>Status</span>
                  <select
                    value={signForm.status}
                    onChange={(event) =>
                      setSignForm(
                        (current) => ({
                          ...current,
                          status:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    <option>Requested</option>
                    <option>Approved</option>
                    <option>Assigned</option>
                    <option>Installed</option>
                    <option>Needs replacement</option>
                    <option>Pickup scheduled</option>
                    <option>Removed</option>
                  </select>
                </label>

                <div className={styles.checkboxGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={signForm.permission}
                      onChange={(event) =>
                        setSignForm(
                          (current) => ({
                            ...current,
                            permission:
                              event.target.checked,
                          }),
                        )
                      }
                    />
                    Placement permission confirmed
                  </label>
                </div>

                <label className={styles.formWide}>
                  <span>
                    Placement instructions / notes
                  </span>
                  <textarea
                    value={signForm.notes}
                    placeholder="Gate code, placement instructions, condition, or pickup notes"
                    onChange={(event) =>
                      setSignForm(
                        (current) => ({
                          ...current,
                          notes:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </div>

              <p className={styles.previewDisclosure}>
                Addresses are stored only in this browser
                tab during the preview.
              </p>

              <PhotoAttachmentField
                label="Yard-sign documentation"
                photos={signForm.photos}
                onChange={(photos) =>
                  setSignForm((current) => ({
                    ...current,
                    photos,
                  }))
                }
              />

              <footer className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>

                <button type="submit">
                  <Flag size={16} />
                  Add Yard Sign
                </button>
              </footer>
            </form>
          </ModalShell>
        ) : null}

        {modal === "assignment" ? (
          <ModalShell
            title="Assign Field Team"
            eyebrow="Responsibility & follow-through"
            icon={ClipboardCheck}
            onClose={() => setModal(null)}
          >
            <form
              className={styles.modalForm}
              onSubmit={addAssignment}
            >
              <div className={styles.formGrid}>
                <label className={styles.formWide}>
                  <span>Assignment name</span>
                  <input
                    required
                    autoFocus
                    value={assignmentForm.title}
                    placeholder="Example: Route A literature delivery"
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          title:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Assignment type</span>
                  <select
                    value={assignmentForm.type}
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          type:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    <option>Door knocking</option>
                    <option>Yard signs</option>
                    <option>Literature delivery</option>
                    <option>Event</option>
                    <option>Phone banking</option>
                    <option>Voter registration</option>
                    <option>Materials</option>
                    <option>Data entry</option>
                  </select>
                </label>

                <label>
                  <span>Status</span>
                  <select
                    value={assignmentForm.status}
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          status:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    <option>Assigned</option>
                    <option>In progress</option>
                    <option>Needs help</option>
                    <option>Completed</option>
                  </select>
                </label>

                <label className={styles.formWide}>
                  <span>Location</span>
                  <input
                    required
                    value={assignmentForm.location}
                    placeholder="Route, precinct, event, or address"
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          location:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Person in charge</span>
                  <select
                    value={assignmentForm.lead}
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          lead:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    {volunteers.map((volunteer) => (
                      <option
                        key={volunteer.id}
                        value={volunteer.name}
                      >
                        {volunteer.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Deadline</span>
                  <input
                    required
                    value={assignmentForm.due}
                    placeholder="Today · 5:00 PM"
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          due:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label className={styles.formWide}>
                  <span>Helpers</span>
                  <input
                    value={assignmentForm.helpers}
                    placeholder="Separate names with commas"
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          helpers:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label className={styles.formWide}>
                  <span>Instructions</span>
                  <textarea
                    value={assignmentForm.notes}
                    placeholder="Supplies, contact instructions, or completion requirements"
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          notes:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </div>

              <PhotoAttachmentField
                label="Assignment documentation"
                photos={assignmentForm.photos}
                onChange={(photos) =>
                  setAssignmentForm((current) => ({
                    ...current,
                    photos,
                  }))
                }
              />

              <footer className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>

                <button type="submit">
                  <ClipboardCheck size={16} />
                  Create Assignment
                </button>
              </footer>
            </form>
          </ModalShell>
        ) : null}

        {modal === "issue" ? (
          <ModalShell
            title="Report Field Issue"
            eyebrow="Operations safety & support"
            icon={AlertTriangle}
            onClose={() => setModal(null)}
          >
            <form
              className={styles.modalForm}
              onSubmit={addIssue}
            >
              <div className={styles.formGrid}>
                <label>
                  <span>Issue type</span>
                  <select
                    value={issueForm.type}
                    onChange={(event) =>
                      setIssueForm(
                        (current) => ({
                          ...current,
                          type:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    <option>
                      Route access problem
                    </option>
                    <option>Volunteer no-show</option>
                    <option>Hostile interaction</option>
                    <option>Injured volunteer</option>
                    <option>Supply shortage</option>
                    <option>Damaged yard sign</option>
                    <option>Incorrect address</option>
                    <option>Weather interruption</option>
                    <option>Vehicle problem</option>
                    <option>Technical problem</option>
                  </select>
                </label>

                <label>
                  <span>Priority</span>
                  <select
                    value={issueForm.priority}
                    onChange={(event) =>
                      setIssueForm(
                        (current) => ({
                          ...current,
                          priority:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    <option>Normal</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </label>

                <label className={styles.formWide}>
                  <span>Location</span>
                  <input
                    required
                    value={issueForm.location}
                    placeholder="Route, precinct, or address"
                    onChange={(event) =>
                      setIssueForm(
                        (current) => ({
                          ...current,
                          location:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label className={styles.formWide}>
                  <span>What happened?</span>
                  <textarea
                    required
                    value={issueForm.notes}
                    placeholder="Describe what the campaign needs to know"
                    onChange={(event) =>
                      setIssueForm(
                        (current) => ({
                          ...current,
                          notes:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </div>

              <PhotoAttachmentField
                label="Field-issue documentation"
                photos={issueForm.photos}
                onChange={(photos) =>
                  setIssueForm((current) => ({
                    ...current,
                    photos,
                  }))
                }
              />

              <footer className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>

                <button type="submit">
                  <AlertTriangle size={16} />
                  Report Issue
                </button>
              </footer>
            </form>
          </ModalShell>
        ) : null}

        {modal === "volunteer" ? (
          <ModalShell
            title="Add Volunteer"
            eyebrow="Volunteer roster"
            icon={UserPlus}
            onClose={() => setModal(null)}
          >
            <form
              className={styles.modalForm}
              onSubmit={addVolunteer}
            >
              <div className={styles.formGrid}>
                <label className={styles.formWide}>
                  <span>Full name</span>
                  <input
                    required
                    autoFocus
                    value={volunteerForm.name}
                    placeholder="Volunteer name"
                    onChange={(event) =>
                      setVolunteerForm(
                        (current) => ({
                          ...current,
                          name:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Email</span>
                  <input
                    required
                    type="email"
                    value={volunteerForm.email}
                    placeholder="name@example.com"
                    onChange={(event) =>
                      setVolunteerForm(
                        (current) => ({
                          ...current,
                          email:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Phone</span>
                  <input
                    required
                    type="tel"
                    value={volunteerForm.phone}
                    placeholder="(561) 555-0000"
                    onChange={(event) =>
                      setVolunteerForm(
                        (current) => ({
                          ...current,
                          phone:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Role</span>
                  <input
                    required
                    value={volunteerForm.role}
                    onChange={(event) =>
                      setVolunteerForm(
                        (current) => ({
                          ...current,
                          role:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Status</span>
                  <select
                    value={volunteerForm.status}
                    onChange={(event) =>
                      setVolunteerForm(
                        (current) => ({
                          ...current,
                          status:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    <option>Training</option>
                    <option>Active</option>
                    <option>In field</option>
                    <option>Needs follow-up</option>
                  </select>
                </label>
              </div>

              <footer className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>

                <button type="submit">
                  <UserPlus size={16} />
                  Add Volunteer
                </button>
              </footer>
            </form>
          </ModalShell>
        ) : null}

        {modal === "closeout" ? (
          <ModalShell
            title="Daily Field Closeout"
            eyebrow="Wednesday, July 29, 2026"
            icon={ClipboardList}
            onClose={() => setModal(null)}
          >
            <div className={styles.closeoutContent}>
              <div className={styles.closeoutMetrics}>
                <span>
                  <strong>{volunteersWorking}</strong>
                  Volunteers assigned
                </span>

                <span>
                  <strong>{activeRoutes}</strong>
                  Routes with work remaining
                </span>

                <span>
                  <strong>{totalDoorsKnocked}</strong>
                  Doors completed
                </span>

                <span>
                  <strong>{totalSupporters}</strong>
                  Supporters
                </span>

                <span>
                  <strong>{installedSigns}</strong>
                  Signs installed
                </span>

                <span>
                  <strong>{totalFollowUps}</strong>
                  Follow-ups
                </span>
              </div>

              <section>
                <h3>Unfinished operations</h3>

                {routes
                  .filter(
                    (route) =>
                      route.status !== "Completed",
                  )
                  .map((route) => (
                    <p key={route.id}>
                      <strong>{route.name}:</strong>{" "}
                      {route.doorsAssigned -
                        route.doorsKnocked}{" "}
                      doors remaining
                    </p>
                  ))}
              </section>

              <section>
                <h3>Open issues</h3>

                {issues
                  .filter(
                    (issue) =>
                      issue.status !== "Resolved",
                  )
                  .map((issue) => (
                    <p key={issue.id}>
                      <strong>{issue.type}:</strong>{" "}
                      {issue.location}
                    </p>
                  ))}
              </section>

              <p className={styles.previewDisclosure}>
                This report is calculated from the
                browser-session preview records.
              </p>

              <footer className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                >
                  <Download size={16} />
                  Print Report
                </button>
              </footer>
            </div>
          </ModalShell>
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}
