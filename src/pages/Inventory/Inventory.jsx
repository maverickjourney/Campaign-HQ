import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Archive,
  ArrowDownToLine,
  BookmarkPlus,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  ImagePlus,
  PackageOpen,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Undo2,
  X,
} from "lucide-react";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  SeatPage,
  SeatPageSection,
} from "../../components/SeatPage/SeatPage";

import {
  useFilesCommandCenter,
} from "../../hooks/useFilesCommandCenter";

import {
  supabase,
} from "../../lib/supabase";

import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./Inventory.module.css";

const CATEGORIES = [
  ["all", "All categories"],
  ["yard_signs", "Yard Signs"],
  ["large_signs", "Large Signs"],
  ["banners", "Banners"],
  ["palm_cards", "Palm Cards"],
  ["door_hangers", "Door Hangers"],
  ["posters", "Posters"],
  ["shirts", "Shirts"],
  ["hats", "Hats"],
  ["stickers", "Stickers"],
  ["buttons", "Buttons"],
  ["canvassing_supplies", "Canvassing Supplies"],
  ["event_supplies", "Event Supplies"],
  ["office_supplies", "Office Supplies"],
  ["other", "Other"],
];

const MOVEMENT_LABELS = {
  received: "Received",
  distributed: "Distributed",
  reserved: "Reserved",
  released: "Released",
  returned: "Returned",
  damaged: "Damaged",
  adjustment: "Adjusted",
};



const DEMO_INVENTORY_ITEMS = [
  {
    id: "demo-inventory-1",
    workspace_id:
      "demo-workspace",
    item_name:
      "18×24 Yard Signs — Herrerias",
    sku: "SIGN-18X24-D6",
    category: "yard_signs",
    quantity_on_hand: 420,
    quantity_reserved: 120,
    quantity_available: 300,
    reorder_point: 150,
    unit_cost: 3.85,
    storage_location:
      "Campaign HQ · Rack A",
    vendor_name:
      "Victory Signs",
    description:
      "Standard double-sided campaign yard signs with wire stakes for District 6 field deployment.",
    image_file_id: null,
    status: "active",
    metadata: {
      purchase_order: {
        number: "PO-2026-1042",
        status: "received",
        order_date:
          "2026-09-10",
        expected_delivery_date:
          "2026-09-18",
      },
    },
    updated_at:
      "2026-09-28T19:42:00-04:00",
  },
  {
    id: "demo-inventory-2",
    workspace_id:
      "demo-workspace",
    item_name:
      "Palm Cards — District 6",
    sku: "PALM-D6-2026",
    category: "palm_cards",
    quantity_on_hand: 2400,
    quantity_reserved: 600,
    quantity_available: 1800,
    reorder_point: 750,
    unit_cost: 0.11,
    storage_location:
      "Campaign HQ · Shelf B",
    vendor_name:
      "Suncoast Print",
    description:
      "Candidate palm cards used for canvassing, volunteer packets and voter-contact events.",
    image_file_id: null,
    status: "active",
    metadata: {
      purchase_order: {
        number: "PO-2026-1061",
        status: "received",
        order_date:
          "2026-09-16",
        expected_delivery_date:
          "2026-09-22",
      },
    },
    updated_at:
      "2026-09-28T20:18:00-04:00",
  },
  {
    id: "demo-inventory-3",
    workspace_id:
      "demo-workspace",
    item_name:
      "Volunteer T-Shirts — Navy",
    sku: "SHIRT-NAVY-VOL",
    category: "shirts",
    quantity_on_hand: 84,
    quantity_reserved: 36,
    quantity_available: 48,
    reorder_point: 40,
    unit_cost: 8.75,
    storage_location:
      "Campaign HQ · Closet 2",
    vendor_name:
      "Palm Beach Apparel",
    description:
      "Campaign volunteer shirts used for canvassing, events and visibility operations.",
    image_file_id: null,
    status: "active",
    metadata: {
      purchase_order: {
        number: "PO-2026-1038",
        status: "received",
        order_date:
          "2026-09-07",
        expected_delivery_date:
          "2026-09-15",
      },
    },
    updated_at:
      "2026-09-27T17:25:00-04:00",
  },
  {
    id: "demo-inventory-4",
    workspace_id:
      "demo-workspace",
    item_name:
      "Early Vote Door Hangers",
    sku: "DOOR-EV-2026",
    category: "door_hangers",
    quantity_on_hand: 180,
    quantity_reserved: 0,
    quantity_available: 180,
    reorder_point: 250,
    unit_cost: 0.19,
    storage_location:
      "Campaign HQ · Shelf C",
    vendor_name:
      "Suncoast Print",
    description:
      "Early-vote reminder door hangers staged for upcoming field deployment.",
    image_file_id: null,
    status: "active",
    metadata: {
      purchase_order: {
        number: "PO-2026-1074",
        status: "in_production",
        order_date:
          "2026-09-26",
        expected_delivery_date:
          "2026-10-01",
      },
    },
    updated_at:
      "2026-09-28T18:05:00-04:00",
  },
  {
    id: "demo-inventory-5",
    workspace_id:
      "demo-workspace",
    item_name:
      "Event Table Banners",
    sku: "BANNER-TABLE-01",
    category: "banners",
    quantity_on_hand: 8,
    quantity_reserved: 2,
    quantity_available: 6,
    reorder_point: 3,
    unit_cost: 42,
    storage_location:
      "Campaign HQ · Event Storage",
    vendor_name:
      "Victory Signs",
    description:
      "Reusable branded table banners for campaign events, forums and volunteer check-in stations.",
    image_file_id: null,
    status: "active",
    metadata: {
      purchase_order: {
        number: "PO-2026-1019",
        status: "received",
        order_date:
          "2026-08-29",
        expected_delivery_date:
          "2026-09-05",
      },
    },
    updated_at:
      "2026-09-25T15:10:00-04:00",
  },
];

const DEMO_INVENTORY_MOVEMENTS = [
  {
    id: "demo-movement-1",
    workspace_id:
      "demo-workspace",
    inventory_item_id:
      "demo-inventory-2",
    movement_type:
      "distributed",
    on_hand_delta: -400,
    reserved_delta: -400,
    note:
      "Canvassing packet distribution.",
    created_at:
      "2026-09-28T19:30:00-04:00",
  },
  {
    id: "demo-movement-2",
    workspace_id:
      "demo-workspace",
    inventory_item_id:
      "demo-inventory-1",
    movement_type:
      "reserved",
    on_hand_delta: 0,
    reserved_delta: 120,
    note:
      "Reserved for weekend canvassing launch.",
    created_at:
      "2026-09-28T16:20:00-04:00",
  },
  {
    id: "demo-movement-3",
    workspace_id:
      "demo-workspace",
    inventory_item_id:
      "demo-inventory-3",
    movement_type:
      "distributed",
    on_hand_delta: -18,
    reserved_delta: 0,
    note:
      "Volunteer orientation shirts.",
    created_at:
      "2026-09-27T18:10:00-04:00",
  },
  {
    id: "demo-movement-4",
    workspace_id:
      "demo-workspace",
    inventory_item_id:
      "demo-inventory-4",
    movement_type:
      "received",
    on_hand_delta: 180,
    reserved_delta: 0,
    note:
      "Partial print run received.",
    created_at:
      "2026-09-27T14:45:00-04:00",
  },
];

const PURCHASE_ORDER_STATUSES = [
  ["not_ordered", "Not ordered"],
  ["ordered", "Ordered"],
  ["in_production", "In production"],
  ["shipped", "Shipped"],
  ["received", "Received"],
  ["cancelled", "Cancelled"],
];

function purchaseOrderFor(item) {
  return (
    item?.metadata
      ?.purchase_order ||
    {}
  );
}

function purchaseOrderStatusLabel(
  value,
) {
  return (
    PURCHASE_ORDER_STATUSES.find(
      ([key]) =>
        key === value,
    )?.[1] ||
    "Not ordered"
  );
}

const ACTIONS = [
  {
    key: "received",
    label: "Receive",
    icon: ArrowDownToLine,
  },
  {
    key: "distributed",
    label: "Distribute",
    icon: Send,
  },
  {
    key: "reserved",
    label: "Reserve",
    icon: BookmarkPlus,
  },
  {
    key: "released",
    label: "Release",
    icon: Undo2,
  },
  {
    key: "returned",
    label: "Return",
    icon: RotateCcw,
  },
  {
    key: "damaged",
    label: "Damaged",
    icon: AlertTriangle,
  },
];

function categoryLabel(value) {
  return (
    CATEGORIES.find(
      ([key]) => key === value,
    )?.[1] || "Other"
  );
}

function formatCurrency(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    },
  ).format(number);
}

function formatDateTime(value) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
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

function emptyItemForm() {
  return {
    item_name: "",
    sku: "",
    category: "yard_signs",
    quantity_on_hand: "0",
    quantity_reserved: "0",
    reorder_point: "0",
    unit_cost: "",
    storage_location: "",
    vendor_name: "",
    purchase_order_number: "",
    purchase_order_status:
      "not_ordered",
    purchase_order_date: "",
    expected_delivery_date: "",
    description: "",
  };
}

export default function Inventory() {
  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const workspaceId =
    workspace?.id || "";

  const demoMode =
    new URLSearchParams(
      window.location.search,
    ).get(
      "inventory-demo",
    ) === "1";

  const {
    uploadFiles,
    isSaving:
      isSavingAsset,
  } = useFilesCommandCenter({
    workspaceId,
    userId:
      user?.id || "",
  });

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    selectedItemId,
    setSelectedItemId,
  ] = useState(
    () =>
      new URLSearchParams(
        window.location.search,
      ).get("item") || "",
  );

  const [
    imageUrls,
    setImageUrls,
  ] = useState({});

  const [
    movements,
    setMovements,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("active");

  const [
    addOpen,
    setAddOpen,
  ] = useState(false);

  const [
    editingItem,
    setEditingItem,
  ] = useState(null);

  const [
    itemImageFile,
    setItemImageFile,
  ] = useState(null);

  const [
    itemImagePreview,
    setItemImagePreview,
  ] = useState("");

  const [
    removeItemImage,
    setRemoveItemImage,
  ] = useState(false);

  const [
    itemForm,
    setItemForm,
  ] = useState(
    emptyItemForm,
  );

  const [
    savingItem,
    setSavingItem,
  ] = useState(false);

  const [
    adjustment,
    setAdjustment,
  ] = useState(null);

  const [
    adjustmentQuantity,
    setAdjustmentQuantity,
  ] = useState("");

  const [
    adjustmentNote,
    setAdjustmentNote,
  ] = useState("");

  const [
    savingAdjustment,
    setSavingAdjustment,
  ] = useState(false);

  const loadInventory =
    useCallback(
      async () => {
      if (demoMode) {
        setError("");
        setLoading(false);
        setImageUrls({});

        setItems(
          DEMO_INVENTORY_ITEMS.map(
            (item) => ({
              ...item,
              metadata: {
                ...(item.metadata || {}),
                purchase_order: {
                  ...(
                    item.metadata
                      ?.purchase_order ||
                    {}
                  ),
                },
              },
            }),
          ),
        );

        setMovements(
          DEMO_INVENTORY_MOVEMENTS.map(
            (movement) => ({
              ...movement,
            }),
          ),
        );

        return;
      }

      if (!workspaceId) {
        setItems([]);
        setMovements([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [
          itemResult,
          movementResult,
        ] = await Promise.all([
          supabase
            .from(
              "workspace_inventory_items",
            )
            .select("*")
            .eq(
              "workspace_id",
              workspaceId,
            )
            .order(
              "item_name",
              {
                ascending: true,
              },
            ),

          supabase
            .from(
              "workspace_inventory_movements",
            )
            .select(
              [
                "id",
                "workspace_id",
                "inventory_item_id",
                "movement_type",
                "on_hand_delta",
                "reserved_delta",
                "note",
                "created_at",
              ].join(","),
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .order(
              "created_at",
              {
                ascending: false,
              },
            )
            .limit(20),
        ]);

        if (itemResult.error) {
          throw itemResult.error;
        }

        if (movementResult.error) {
          throw movementResult.error;
        }

        const itemRows =
          itemResult.data || [];

        const imageFileIds = [
          ...new Set(
            itemRows
              .map(
                (item) =>
                  item.image_file_id,
              )
              .filter(Boolean),
          ),
        ];

        const signedUrlsByFileId =
          {};

        if (imageFileIds.length) {
          const {
            data:
              imageFiles,
            error:
              imageFilesError,
          } = await supabase
            .from(
              "campaign_files",
            )
            .select(
              "id, storage_path, mime_type",
            )
            .in(
              "id",
              imageFileIds,
            );

          if (imageFilesError) {
            throw imageFilesError;
          }

          await Promise.all(
            (
              imageFiles || []
            ).map(
              async (file) => {
                if (
                  !String(
                    file.mime_type ||
                      "",
                  ).startsWith(
                    "image/",
                  )
                ) {
                  return;
                }

                const {
                  data:
                    signedData,
                  error:
                    signedError,
                } =
                  await supabase.storage
                    .from(
                      "campaign-files",
                    )
                    .createSignedUrl(
                      file.storage_path,
                      3600,
                    );

                if (
                  !signedError &&
                  signedData
                    ?.signedUrl
                ) {
                  signedUrlsByFileId[
                    file.id
                  ] =
                    signedData
                      .signedUrl;
                }
              },
            ),
          );
        }

        const nextImageUrls =
          {};

        itemRows.forEach(
          (item) => {
            const signedUrl =
              signedUrlsByFileId[
                item.image_file_id
              ];

            if (signedUrl) {
              nextImageUrls[
                item.id
              ] =
                signedUrl;
            }
          },
        );

        setImageUrls(
          nextImageUrls,
        );

        setItems(
          itemRows,
        );

        setMovements(
          movementResult.data || [],
        );
      } catch (loadError) {
        setError(
          loadError?.message ||
            "Inventory could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
          },
      [workspaceId, demoMode],
    );


  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        void loadInventory();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadInventory]);

  const filteredItems =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      return items.filter(
        (item) => {
          const categoryMatches =
            category === "all" ||
            item.category ===
              category;

          const statusMatches =
            statusFilter ===
              "all" ||
            item.status ===
              statusFilter;

          if (
            !categoryMatches ||
            !statusMatches
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          return [
            item.item_name,
            item.vendor_name,
            item.storage_location,
            item.description,
            item.sku,
            purchaseOrderFor(
              item,
            ).number,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(
                  normalizedSearch,
                ),
            );
        },
      );
    }, [
      items,
      searchTerm,
      category,
      statusFilter,
    ]);

  const activeItems =
    useMemo(
      () =>
        items.filter(
          (item) =>
            item.status ===
            "active",
        ),
      [items],
    );

  const metrics =
    useMemo(() => {
      const totalUnits =
        activeItems.reduce(
          (
            sum,
            item,
          ) =>
            sum +
            Number(
              item.quantity_on_hand ||
                0,
            ),
          0,
        );

      const lowStock =
        activeItems.filter(
          (item) =>
            Number(
              item.quantity_available ||
                0,
            ) <=
            Number(
              item.reorder_point ||
                0,
            ),
        ).length;

      const value =
        activeItems.reduce(
          (
            sum,
            item,
          ) =>
            sum +
            (
              Number(
                item.quantity_on_hand ||
                  0,
              ) *
              Number(
                item.unit_cost ||
                  0,
              )
            ),
          0,
        );

      return {
        itemCount:
          activeItems.length,
        totalUnits,
        lowStock,
        value,
      };
    }, [activeItems]);

  const itemById =
    useMemo(
      () =>
        new Map(
          items.map(
            (item) => [
              item.id,
              item,
            ],
          ),
        ),
      [items],
    );


  const selectedItem =
    useMemo(
      () =>
        selectedItemId
          ? itemById.get(
              selectedItemId,
            ) || null
          : null,
      [
        itemById,
        selectedItemId,
      ],
    );

  /*
   * V94A INVENTORY BROWSER HISTORY
   *
   * Opening an inventory detail must create a real history
   * entry so browser Back closes the drawer and Forward
   * reopens the same item.
   *
   * Direct ?item=<uuid> loads remain supported. If an item
   * was opened from the Inventory list we mark that history
   * entry so the drawer close button can safely return to the
   * prior list entry. A direct deep link is closed in place
   * instead of navigating the user away from Campaign Seat.
   */
  const syncItemQuery =
    useCallback(
      (
        nextItemId,
        {
          replace = false,
        } = {},
      ) => {
        const url =
          new URL(
            window.location.href,
          );

        if (nextItemId) {
          url.searchParams.set(
            "item",
            nextItemId,
          );
        } else {
          url.searchParams.delete(
            "item",
          );
        }

        const nextState = {
          ...(
            window.history.state ||
            {}
          ),
        };

        delete nextState
          .campaignSeatInventoryItemId;

        if (nextItemId) {
          nextState
            .campaignSeatInventoryItemId =
            nextItemId;
        }

        window.history[
          replace
            ? "replaceState"
            : "pushState"
        ](
          nextState,
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );
      },
      [],
    );

  const openItemDetails =
    useCallback(
      (item) => {
        if (!item?.id) {
          return;
        }

        if (
          selectedItemId ===
          item.id
        ) {
          return;
        }

        setSelectedItemId(
          item.id,
        );

        syncItemQuery(
          item.id,
        );
      },
      [
        selectedItemId,
        syncItemQuery,
      ],
    );

  const closeItemDetails =
    useCallback(
      () => {
        const url =
          new URL(
            window.location.href,
          );

        const currentItemId =
          url.searchParams.get(
            "item",
          ) ||
          "";

        const historyItemId =
          String(
            window.history.state
              ?.campaignSeatInventoryItemId ||
              "",
          );

        if (
          currentItemId &&
          historyItemId ===
            currentItemId
        ) {
          window.history.back();
          return;
        }

        setSelectedItemId("");

        syncItemQuery(
          "",
          {
            replace: true,
          },
        );
      },
      [syncItemQuery],
    );

  useEffect(() => {
    const handlePopState =
      () => {
        setSelectedItemId(
          new URLSearchParams(
            window.location.search,
          ).get("item") || "",
        );
      };

    window.addEventListener(
      "popstate",
      handlePopState,
    );

    return () => {
      window.removeEventListener(
        "popstate",
        handlePopState,
      );
    };
  }, []);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    const visible =
      filteredItems.some(
        (item) =>
          item.id ===
          selectedItem.id,
      );

    if (visible) {
      return;
    }

    setSearchTerm("");
    setCategory("all");

    setStatusFilter(
      selectedItem.status ===
        "archived"
        ? "archived"
        : "active",
    );
  }, [
    selectedItem,
    filteredItems,
  ]);

  const resetItemEditor =
    () => {
      setAddOpen(false);
      setEditingItem(null);

      setItemForm(
        emptyItemForm(),
      );

      setItemImageFile(
        null,
      );

      setItemImagePreview(
        "",
      );

      setRemoveItemImage(
        false,
      );
    };

  const openAdd =
    () => {
      setEditingItem(null);

      setItemForm(
        emptyItemForm(),
      );

      setItemImageFile(
        null,
      );

      setItemImagePreview(
        "",
      );

      setRemoveItemImage(
        false,
      );

      setAddOpen(true);
    };

  const openEdit =
    (item) => {
      const purchaseOrder =
        purchaseOrderFor(
          item,
        );

      setEditingItem(item);

      setItemForm({
        item_name:
          item.item_name || "",

        sku:
          item.sku || "",

        category:
          item.category ||
          "other",

        quantity_on_hand:
          String(
            item.quantity_on_hand ||
              0,
          ),

        quantity_reserved:
          String(
            item.quantity_reserved ||
              0,
          ),

        reorder_point:
          String(
            item.reorder_point ||
              0,
          ),

        unit_cost:
          item.unit_cost ==
          null
            ? ""
            : String(
                item.unit_cost,
              ),

        storage_location:
          item.storage_location ||
          "",

        vendor_name:
          item.vendor_name ||
          "",

        purchase_order_number:
          purchaseOrder.number ||
          "",

        purchase_order_status:
          purchaseOrder.status ||
          "not_ordered",

        purchase_order_date:
          purchaseOrder
            .order_date ||
          "",

        expected_delivery_date:
          purchaseOrder
            .expected_delivery_date ||
          "",

        description:
          item.description ||
          "",
      });

      setItemImageFile(
        null,
      );

      setItemImagePreview(
        imageUrls[item.id] ||
          "",
      );

      setRemoveItemImage(
        false,
      );

      setAddOpen(true);
    };

  const closeAdd =
    () => {
      if (
        savingItem ||
        isSavingAsset
      ) {
        return;
      }

      resetItemEditor();
    };

  const handleImageSelection =
    (event) => {
      const file =
        event.target
          .files?.[0];

      event.target.value =
        "";

      if (!file) {
        return;
      }

      if (
        !String(
          file.type || "",
        ).startsWith(
          "image/",
        )
      ) {
        setError(
          "Inventory photos must be image files.",
        );
        return;
      }

      if (
        file.size >
        10 * 1024 * 1024
      ) {
        setError(
          "Inventory photos must be 10 MB or smaller.",
        );
        return;
      }

      setError("");

      setItemImageFile(
        file,
      );

      setRemoveItemImage(
        false,
      );

      const reader =
        new FileReader();

      reader.onload = () => {
        setItemImagePreview(
          String(
            reader.result ||
              "",
          ),
        );
      };

      reader.readAsDataURL(
        file,
      );
    };

  const removeImage =
    () => {
      setItemImageFile(null);
      setItemImagePreview("");

      setRemoveItemImage(
        true,
      );
    };

  const saveItem =
    async (event) => {
      event.preventDefault();

      if (
        !workspaceId ||
        !itemForm
          .item_name
          .trim()
      ) {
        return;
      }

      setSavingItem(true);
      setError("");


      if (demoMode) {
        const itemId =
          editingItem?.id ||
          `demo-inventory-${Date.now()}`;

        const existing =
          editingItem || {};

        const onHand =
          editingItem
            ? Number(
                existing.quantity_on_hand ||
                  0,
              )
            : Number(
                itemForm
                  .quantity_on_hand ||
                  0,
              );

        const reserved =
          editingItem
            ? Number(
                existing.quantity_reserved ||
                  0,
              )
            : Number(
                itemForm
                  .quantity_reserved ||
                  0,
              );

        const purchaseOrder = {
          number:
            itemForm
              .purchase_order_number
              .trim() ||
            null,

          status:
            itemForm
              .purchase_order_status ||
            "not_ordered",

          order_date:
            itemForm
              .purchase_order_date ||
            null,

          expected_delivery_date:
            itemForm
              .expected_delivery_date ||
            null,
        };

        const nextItem = {
          ...existing,

          id: itemId,

          workspace_id:
            existing.workspace_id ||
            workspaceId ||
            "demo-workspace",

          item_name:
            itemForm
              .item_name
              .trim(),

          sku:
            itemForm.sku.trim() ||
            null,

          category:
            itemForm.category,

          quantity_on_hand:
            onHand,

          quantity_reserved:
            reserved,

          quantity_available:
            Math.max(
              0,
              onHand - reserved,
            ),

          reorder_point:
            Number(
              itemForm.reorder_point ||
                0,
            ),

          unit_cost:
            itemForm.unit_cost ===
            ""
              ? null
              : Number(
                  itemForm.unit_cost,
                ),

          storage_location:
            itemForm
              .storage_location
              .trim() ||
            null,

          vendor_name:
            itemForm
              .vendor_name
              .trim() ||
            null,

          description:
            itemForm
              .description
              .trim() ||
            null,

          image_file_id:
            null,

          status:
            existing.status ||
            "active",

          metadata: {
            ...(
              existing.metadata ||
              {}
            ),
            purchase_order:
              purchaseOrder,
          },

          updated_at:
            new Date()
              .toISOString(),
        };

        setItems(
          (current) =>
            editingItem
              ? current.map(
                  (item) =>
                    item.id ===
                    itemId
                      ? nextItem
                      : item,
                )
              : [
                  ...current,
                  nextItem,
                ],
        );

        setImageUrls(
          (current) => {
            const next = {
              ...current,
            };

            if (
              itemImagePreview
            ) {
              next[itemId] =
                itemImagePreview;
            } else if (
              removeItemImage
            ) {
              delete next[itemId];
            }

            return next;
          },
        );

        resetItemEditor();
        setSavingItem(false);
        return;
      }

      try {
        let imageFileId =
          editingItem
            ?.image_file_id ||
          null;

        if (removeItemImage) {
          imageFileId =
            null;
        }

        if (itemImageFile) {
          const uploaded =
            await uploadFiles(
              [itemImageFile],
              "Campaign Materials",
            );

          imageFileId =
            uploaded?.[0]?.id ||
            null;

          if (!imageFileId) {
            throw new Error(
              "The inventory image uploaded but could not be attached.",
            );
          }
        }

        const purchaseOrder = {
          number:
            itemForm
              .purchase_order_number
              .trim() ||
            null,

          status:
            itemForm
              .purchase_order_status ||
            "not_ordered",

          order_date:
            itemForm
              .purchase_order_date ||
            null,

          expected_delivery_date:
            itemForm
              .expected_delivery_date ||
            null,
        };

        const payload = {
          item_name:
            itemForm
              .item_name
              .trim(),

          sku:
            itemForm.sku
              .trim() ||
            null,

          category:
            itemForm.category,

          reorder_point:
            Number(
              itemForm.reorder_point ||
                0,
            ),

          unit_cost:
            itemForm.unit_cost ===
            ""
              ? null
              : Number(
                  itemForm.unit_cost,
                ),

          storage_location:
            itemForm
              .storage_location
              .trim() ||
            null,

          vendor_name:
            itemForm
              .vendor_name
              .trim() ||
            null,

          description:
            itemForm
              .description
              .trim() ||
            null,

          image_file_id:
            imageFileId,

          metadata: {
            ...(
              editingItem
                ?.metadata ||
              {}
            ),

            purchase_order:
              purchaseOrder,
          },

          updated_at:
            new Date()
              .toISOString(),
        };

        if (editingItem) {
          const {
            error:
              updateError,
          } = await supabase
            .from(
              "workspace_inventory_items",
            )
            .update(
              payload,
            )
            .eq(
              "id",
              editingItem.id,
            )
            .eq(
              "workspace_id",
              workspaceId,
            );

          if (updateError) {
            throw updateError;
          }
        } else {
          const {
            error:
              insertError,
          } = await supabase
            .from(
              "workspace_inventory_items",
            )
            .insert({
              ...payload,

              workspace_id:
                workspaceId,

              quantity_on_hand:
                Number(
                  itemForm
                    .quantity_on_hand ||
                    0,
                ),

              quantity_reserved:
                Number(
                  itemForm
                    .quantity_reserved ||
                    0,
                ),
            });

          if (insertError) {
            throw insertError;
          }
        }

        resetItemEditor();

        await loadInventory();
      } catch (saveError) {
        setError(
          saveError?.message ||
            "Inventory item could not be saved.",
        );
      } finally {
        setSavingItem(false);
      }
    };

  const setItemStatus =
    async (
      item,
      nextStatus,
    ) => {
      if (
        nextStatus ===
          "archived" &&
        !window.confirm(
          `Archive ${item.item_name}? It can be restored later.`,
        )
      ) {
        return;
      }

      setError("");


      if (demoMode) {
        setItems(
          (current) =>
            current.map(
              (currentItem) =>
                currentItem.id ===
                item.id
                  ? {
                      ...currentItem,
                      status:
                        nextStatus,
                      updated_at:
                        new Date()
                          .toISOString(),
                    }
                  : currentItem,
            ),
        );

        return;
      }

      try {
        const {
          error:
            statusError,
        } = await supabase
          .from(
            "workspace_inventory_items",
          )
          .update({
            status:
              nextStatus,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            item.id,
          )
          .eq(
            "workspace_id",
            workspaceId,
          );

        if (statusError) {
          throw statusError;
        }

        await loadInventory();
      } catch (
        statusSaveError
      ) {
        setError(
          statusSaveError
            ?.message ||
            "Inventory status could not be updated.",
        );
      }
    };

  const openAdjustment =
    (
      item,
      movementType,
    ) => {
      setAdjustment({
        item,
        movementType,
      });

      setAdjustmentQuantity(
        "",
      );

      setAdjustmentNote("");
    };

  const closeAdjustment =
    () => {
      if (
        savingAdjustment
      ) {
        return;
      }

      setAdjustment(null);
      setAdjustmentQuantity(
        "",
      );
      setAdjustmentNote("");
    };

  const saveAdjustment =
    async (event) => {
      event.preventDefault();

      if (!adjustment) {
        return;
      }

      const quantity =
        Math.floor(
          Number(
            adjustmentQuantity ||
              0,
          ),
        );

      if (
        !Number.isFinite(
          quantity,
        ) ||
        quantity <= 0
      ) {
        setError(
          "Enter a quantity greater than zero.",
        );
        return;
      }

      const movementType =
        adjustment.movementType;

      let onHandDelta = 0;
      let reservedDelta = 0;

      if (
        movementType ===
          "received" ||
        movementType ===
          "returned"
      ) {
        onHandDelta =
          quantity;
      }

      if (
        movementType ===
          "distributed" ||
        movementType ===
          "damaged"
      ) {
        onHandDelta =
          -quantity;
      }

      if (
        movementType ===
        "reserved"
      ) {
        reservedDelta =
          quantity;
      }

      if (
        movementType ===
        "released"
      ) {
        reservedDelta =
          -quantity;
      }


      if (demoMode) {
        const createdAt =
          new Date()
            .toISOString();

        setItems(
          (current) =>
            current.map(
              (item) => {
                if (
                  item.id !==
                  adjustment.item.id
                ) {
                  return item;
                }

                const nextOnHand =
                  Math.max(
                    0,
                    Number(
                      item.quantity_on_hand ||
                        0,
                    ) +
                      onHandDelta,
                  );

                const nextReserved =
                  Math.max(
                    0,
                    Math.min(
                      nextOnHand,
                      Number(
                        item.quantity_reserved ||
                          0,
                      ) +
                        reservedDelta,
                    ),
                  );

                return {
                  ...item,

                  quantity_on_hand:
                    nextOnHand,

                  quantity_reserved:
                    nextReserved,

                  quantity_available:
                    Math.max(
                      0,
                      nextOnHand -
                        nextReserved,
                    ),

                  updated_at:
                    createdAt,
                };
              },
            ),
        );

        setMovements(
          (current) => [
            {
              id:
                `demo-movement-${Date.now()}`,
              workspace_id:
                workspaceId ||
                "demo-workspace",
              inventory_item_id:
                adjustment.item.id,
              movement_type:
                movementType,
              on_hand_delta:
                onHandDelta,
              reserved_delta:
                reservedDelta,
              note:
                adjustmentNote
                  .trim() ||
                null,
              created_at:
                createdAt,
            },
            ...current,
          ].slice(
            0,
            20,
          ),
        );

        closeAdjustment();
        return;
      }

      setSavingAdjustment(
        true,
      );
      setError("");

      try {
        const {
          error: rpcError,
        } = await supabase.rpc(
          "adjust_campaign_inventory",
          {
            target_item_id:
              adjustment.item.id,
            target_movement_type:
              movementType,
            target_on_hand_delta:
              onHandDelta,
            target_reserved_delta:
              reservedDelta,
            target_note:
              adjustmentNote.trim() ||
              null,
          },
        );

        if (rpcError) {
          throw rpcError;
        }

        closeAdjustment();
        await loadInventory();
      } catch (saveError) {
        setError(
          saveError?.message ||
            "Inventory could not be adjusted.",
        );
      } finally {
        setSavingAdjustment(
          false,
        );
      }
    };

  return (
    <CampaignWorkspaceShell
      activeItem="Inventory"
    >
      <SeatPage
        eyebrow="Seat Core"
        title="Inventory"
        description="Track campaign materials, physical assets, quantities, reservations, storage locations and movement history."
        loading={loading}
        error={error}
        actions={
          <button
            className={
              styles.primaryButton
            }
            type="button"
            onClick={openAdd}
          >
            <Plus size={17} />
            Add inventory
          </button>
        }
      >
        <div
          className={
            styles.metrics
          }
        >
          <article>
            <PackageOpen
              size={19}
            />
            <span>
              Inventory items
            </span>
            <strong>
              {metrics.itemCount}
            </strong>
          </article>

          <article>
            <Boxes size={19} />
            <span>
              Units on hand
            </span>
            <strong>
              {metrics.totalUnits.toLocaleString()}
            </strong>
          </article>

          <article
            data-alert={
              metrics.lowStock > 0
                ? "true"
                : "false"
            }
          >
            <AlertTriangle
              size={19}
            />
            <span>
              Low stock
            </span>
            <strong>
              {metrics.lowStock}
            </strong>
          </article>

          <article>
            <CircleDollarSign
              size={19}
            />
            <span>
              Inventory value
            </span>
            <strong>
              {formatCurrency(
                metrics.value,
              )}
            </strong>
          </article>
        </div>

        <SeatPageSection
          title="Inventory items"
          description="Search, review availability and manage physical campaign materials."
        >
          <div
            className={
              styles.filters
            }
          >
            <label
              className={
                styles.search
              }
            >
              <Search
                size={17}
              />
              <input
                type="search"
                value={
                  searchTerm
                }
                placeholder="Search inventory"
                onChange={(
                  event,
                ) =>
                  setSearchTerm(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <select
              className={
                styles.categorySelect
              }
              value={category}
              onChange={(
                event,
              ) =>
                setCategory(
                  event.target
                    .value,
                )
              }
              aria-label="Inventory category"
            >
              {CATEGORIES.map(
                ([
                  key,
                  label,
                ]) => (
                  <option
                    key={key}
                    value={key}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>

            <select
              className={
                styles.categorySelect
              }
              value={
                statusFilter
              }
              onChange={(
                event,
              ) =>
                setStatusFilter(
                  event.target
                    .value,
                )
              }
              aria-label="Inventory status"
            >
              <option value="active">
                Active
              </option>

              <option value="archived">
                Archived
              </option>

              <option value="all">
                All statuses
              </option>
            </select>
          </div>

          {filteredItems.length ? (
            <>
              <div
                className={
                  styles.tableWrap
                }
              >
                <table
                  className={
                    styles.table
                  }
                >
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>On hand</th>
                      <th>Reserved</th>
                      <th>Available</th>
                      <th>Reorder</th>
                      <th>Location</th>
                      <th>Unit cost</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredItems.map(
                      (item) => {
                        const low =
                          Number(
                            item.quantity_available ||
                              0,
                          ) <=
                          Number(
                            item.reorder_point ||
                              0,
                          );

                        return (
                          <tr
                            key={
                              item.id
                            }
                            data-low={
                              low
                                ? "true"
                                : "false"
                            }
                            data-selected={
                              selectedItemId ===
                              item.id
                                ? "true"
                                : "false"
                            }
                            onClick={() =>
                              openItemDetails(
                                item,
                              )
                            }
                          >
                            <td>
                              <div
                                className={
                                  styles.itemIdentity
                                }
                              >
                                <span
                                  className={
                                    styles.itemThumb
                                  }
                                >
                                  {imageUrls[
                                    item.id
                                  ] ? (
                                    <img
                                      src={
                                        imageUrls[
                                          item.id
                                        ]
                                      }
                                      alt=""
                                    />
                                  ) : (
                                    <PackageOpen
                                      size={18}
                                    />
                                  )}
                                </span>

                                <span
                                  className={
                                    styles.itemCopy
                                  }
                                >
                                  <strong>
                                    {
                                      item.item_name
                                    }
                                  </strong>

                                  {item.sku ? (
                                    <small>
                                      SKU{" "}
                                      {
                                        item.sku
                                      }
                                    </small>
                                  ) : null}

                                  {item.vendor_name ? (
                                    <small>
                                      {
                                        item.vendor_name
                                      }
                                    </small>
                                  ) : null}

                                  {purchaseOrderFor(
                                    item,
                                  ).number ? (
                                    <small>
                                      PO{" "}
                                      {
                                        purchaseOrderFor(
                                          item,
                                        ).number
                                      }{" "}
                                      ·{" "}
                                      {purchaseOrderStatusLabel(
                                        purchaseOrderFor(
                                          item,
                                        ).status,
                                      )}
                                    </small>
                                  ) : null}
                                </span>
                              </div>
                            </td>

                            <td>
                              {categoryLabel(
                                item.category,
                              )}
                            </td>

                            <td>
                              {
                                item.quantity_on_hand
                              }
                            </td>

                            <td>
                              {
                                item.quantity_reserved
                              }
                            </td>

                            <td>
                              <strong>
                                {
                                  item.quantity_available
                                }
                              </strong>
                            </td>

                            <td>
                              {
                                item.reorder_point
                              }
                            </td>

                            <td>
                              {item.storage_location ||
                                "—"}
                            </td>

                            <td>
                              {item.unit_cost ==
                              null
                                ? "—"
                                : formatCurrency(
                                    item.unit_cost,
                                  )}
                            </td>

                            <td>
                              <div
                                className={
                                  styles.rowActions
                                }
                                onClick={(
                                  event,
                                ) =>
                                  event.stopPropagation()
                                }
                              >
                                <button
                                  type="button"
                                  title="Open details"
                                  aria-label={`Open ${item.item_name}`}
                                  onClick={() =>
                                    openItemDetails(
                                      item,
                                    )
                                  }
                                >
                                  <ChevronRight
                                    size={15}
                                  />
                                </button>

                                <button
                                  type="button"
                                  title="Edit item"
                                  aria-label={`Edit ${item.item_name}`}
                                  onClick={() =>
                                    openEdit(
                                      item,
                                    )
                                  }
                                >
                                  <Pencil
                                    size={15}
                                  />
                                </button>

                                {item.status ===
                                "active"
                                  ? ACTIONS.slice(
                                      0,
                                      4,
                                    ).map(
                                      (
                                        action,
                                      ) => {
                                        const Icon =
                                          action.icon;

                                        return (
                                          <button
                                            key={
                                              action.key
                                            }
                                            type="button"
                                            title={
                                              action.label
                                            }
                                            aria-label={`${action.label} ${item.item_name}`}
                                            onClick={() =>
                                              openAdjustment(
                                                item,
                                                action.key,
                                              )
                                            }
                                          >
                                            <Icon
                                              size={
                                                15
                                              }
                                            />
                                          </button>
                                        );
                                      },
                                    )
                                  : null}

                                <button
                                  type="button"
                                  title={
                                    item.status ===
                                    "archived"
                                      ? "Restore item"
                                      : "Archive item"
                                  }
                                  aria-label={
                                    item.status ===
                                    "archived"
                                      ? `Restore ${item.item_name}`
                                      : `Archive ${item.item_name}`
                                  }
                                  onClick={() =>
                                    void setItemStatus(
                                      item,
                                      item.status ===
                                      "archived"
                                        ? "active"
                                        : "archived",
                                    )
                                  }
                                >
                                  {item.status ===
                                  "archived" ? (
                                    <RefreshCw
                                      size={15}
                                    />
                                  ) : (
                                    <Archive
                                      size={15}
                                    />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              <div
                className={
                  styles.mobileList
                }
              >
                {filteredItems.map(
                  (item) => {
                    const low =
                      Number(
                        item.quantity_available ||
                          0,
                      ) <=
                      Number(
                        item.reorder_point ||
                          0,
                      );

                    return (
                      <article
                        key={item.id}
                        className={
                          styles.mobileCard
                        }
                        data-low={
                          low
                            ? "true"
                            : "false"
                        }
                        data-selected={
                          selectedItemId ===
                          item.id
                            ? "true"
                            : "false"
                        }
                        onClick={() =>
                          openItemDetails(
                            item,
                          )
                        }
                      >
                        <header>
                          <div
                            className={
                              styles.mobileIdentity
                            }
                          >
                            <span
                              className={
                                styles.itemThumb
                              }
                            >
                              {imageUrls[
                                item.id
                              ] ? (
                                <img
                                  src={
                                    imageUrls[
                                      item.id
                                    ]
                                  }
                                  alt=""
                                />
                              ) : (
                                <PackageOpen
                                  size={18}
                                />
                              )}
                            </span>

                            <span
                              className={
                                styles.itemCopy
                              }
                            >
                              <strong>
                                {
                                  item.item_name
                                }
                              </strong>

                              <span>
                                {categoryLabel(
                                  item.category,
                                )}
                              </span>

                              {item.sku ? (
                                <small>
                                  SKU{" "}
                                  {
                                    item.sku
                                  }
                                </small>
                              ) : null}

                              {purchaseOrderFor(
                                item,
                              ).number ? (
                                <small>
                                  PO{" "}
                                  {
                                    purchaseOrderFor(
                                      item,
                                    ).number
                                  }{" "}
                                  ·{" "}
                                  {purchaseOrderStatusLabel(
                                    purchaseOrderFor(
                                      item,
                                    ).status,
                                  )}
                                </small>
                              ) : null}
                            </span>
                          </div>

                          {item.status ===
                          "archived" ? (
                            <em>
                              Archived
                            </em>
                          ) : low ? (
                            <em>
                              Low stock
                            </em>
                          ) : null}
                        </header>

                        <dl>
                          <div>
                            <dt>
                              On hand
                            </dt>
                            <dd>
                              {
                                item.quantity_on_hand
                              }
                            </dd>
                          </div>

                          <div>
                            <dt>
                              Reserved
                            </dt>
                            <dd>
                              {
                                item.quantity_reserved
                              }
                            </dd>
                          </div>

                          <div>
                            <dt>
                              Available
                            </dt>
                            <dd>
                              {
                                item.quantity_available
                              }
                            </dd>
                          </div>

                          <div>
                            <dt>
                              Reorder
                            </dt>
                            <dd>
                              {
                                item.reorder_point
                              }
                            </dd>
                          </div>
                        </dl>

                        <p>
                          <strong>
                            Location:
                          </strong>{" "}
                          {item.storage_location ||
                            "Not set"}
                        </p>

                        <div
                          className={
                            styles.mobileActions
                          }
                          onClick={(
                            event,
                          ) =>
                            event.stopPropagation()
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openItemDetails(
                                item,
                              )
                            }
                          >
                            <ChevronRight
                              size={16}
                            />
                            Details
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openEdit(
                                item,
                              )
                            }
                          >
                            <Pencil
                              size={16}
                            />
                            Edit
                          </button>

                          {item.status ===
                          "active"
                            ? ACTIONS.map(
                                (
                                  action,
                                ) => {
                                  const Icon =
                                    action.icon;

                                  return (
                                    <button
                                      key={
                                        action.key
                                      }
                                      type="button"
                                      onClick={() =>
                                        openAdjustment(
                                          item,
                                          action.key,
                                        )
                                      }
                                    >
                                      <Icon
                                        size={
                                          16
                                        }
                                      />
                                      {
                                        action.label
                                      }
                                    </button>
                                  );
                                },
                              )
                            : null}

                          <button
                            type="button"
                            onClick={() =>
                              void setItemStatus(
                                item,
                                item.status ===
                                "archived"
                                  ? "active"
                                  : "archived",
                              )
                            }
                          >
                            {item.status ===
                            "archived" ? (
                              <RefreshCw
                                size={16}
                              />
                            ) : (
                              <Archive
                                size={16}
                              />
                            )}

                            {item.status ===
                            "archived"
                              ? "Restore"
                              : "Archive"}
                          </button>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </>
          ) : (
            <div
              className={
                styles.emptyState
              }
            >
              <PackageOpen
                size={30}
              />
              <strong>
                No inventory items found
              </strong>
              <p>
                Add yard signs, banners, palm cards, shirts, event supplies or other campaign materials.
              </p>

              <button
                className={
                  styles.primaryButton
                }
                type="button"
                onClick={openAdd}
              >
                <Plus size={17} />
                Add first item
              </button>
            </div>
          )}
        </SeatPageSection>

        <SeatPageSection
          title="Recent inventory activity"
          description="The latest receipts, distributions, reservations, returns and adjustments."
        >
          {movements.length ? (
            <div
              className={
                styles.activityList
              }
            >
              {movements.map(
                (movement) => {
                  const item =
                    itemById.get(
                      movement.inventory_item_id,
                    );

                  return (
                    <article
                      key={
                        movement.id
                      }
                    >
                      <div>
                        <strong>
                          {MOVEMENT_LABELS[
                            movement
                              .movement_type
                          ] ||
                            "Inventory update"}
                        </strong>

                        <span>
                          {item?.item_name ||
                            "Inventory item"}
                        </span>
                      </div>

                      <div
                        className={
                          styles.activityDelta
                        }
                      >
                        {movement.on_hand_delta ? (
                          <span>
                            On hand{" "}
                            {movement.on_hand_delta >
                            0
                              ? "+"
                              : ""}
                            {
                              movement.on_hand_delta
                            }
                          </span>
                        ) : null}

                        {movement.reserved_delta ? (
                          <span>
                            Reserved{" "}
                            {movement.reserved_delta >
                            0
                              ? "+"
                              : ""}
                            {
                              movement.reserved_delta
                            }
                          </span>
                        ) : null}
                      </div>

                      <time>
                        {formatDateTime(
                          movement.created_at,
                        )}
                      </time>

                      {movement.note ? (
                        <p>
                          {
                            movement.note
                          }
                        </p>
                      ) : null}
                    </article>
                  );
                },
              )}
            </div>
          ) : (
            <div
              className={
                styles.emptyActivity
              }
            >
              Inventory activity will appear here as materials are received, reserved and distributed.
            </div>
          )}
        </SeatPageSection>
      </SeatPage>


      {selectedItem ? (
        <div
          className={
            styles.detailBackdrop
          }
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeItemDetails();
            }
          }}
        >
          <aside
            className={
              styles.detailDrawer
            }
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedItem.item_name} inventory details`}
          >
            <header
              className={
                styles.detailHeader
              }
            >
              <div
                className={
                  styles.detailIdentity
                }
              >
                <span
                  className={
                    styles.detailIcon
                  }
                >
                  <PackageOpen
                    size={22}
                  />
                </span>

                <div>
                  <span>
                    Inventory details
                  </span>

                  <h2>
                    {
                      selectedItem.item_name
                    }
                  </h2>

                  <p>
                    {categoryLabel(
                      selectedItem.category,
                    )}
                    {" · "}
                    {selectedItem.status ===
                    "archived"
                      ? "Archived"
                      : "Active"}
                  </p>
                </div>
              </div>

              <button
                className={
                  styles.detailClose
                }
                type="button"
                aria-label="Close inventory details"
                onClick={
                  closeItemDetails
                }
              >
                <X size={21} />
              </button>
            </header>

            <div
              className={
                styles.detailBody
              }
            >
              {demoMode ? (
                <div
                  className={
                    styles.demoNotice
                  }
                >
                  Local inventory preview
                </div>
              ) : null}

              <div
                className={
                  styles.detailMetricGrid
                }
              >
                <article>
                  <span>
                    On hand
                  </span>
                  <strong>
                    {
                      selectedItem.quantity_on_hand
                    }
                  </strong>
                </article>

                <article>
                  <span>
                    Reserved
                  </span>
                  <strong>
                    {
                      selectedItem.quantity_reserved
                    }
                  </strong>
                </article>

                <article>
                  <span>
                    Available
                  </span>
                  <strong>
                    {
                      selectedItem.quantity_available
                    }
                  </strong>
                </article>

                <article>
                  <span>
                    Reorder point
                  </span>
                  <strong>
                    {
                      selectedItem.reorder_point
                    }
                  </strong>
                </article>
              </div>

              <section
                className={
                  styles.detailSection
                }
              >
                <div
                  className={
                    styles.detailSectionHeading
                  }
                >
                  <div>
                    <span>
                      Asset record
                    </span>
                    <h3>
                      Inventory information
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openEdit(
                        selectedItem,
                      )
                    }
                  >
                    <Pencil
                      size={15}
                    />
                    Edit
                  </button>
                </div>

                <dl
                  className={
                    styles.detailFacts
                  }
                >
                  <div>
                    <dt>SKU</dt>
                    <dd>
                      {selectedItem.sku ||
                        "Not set"}
                    </dd>
                  </div>

                  <div>
                    <dt>Location</dt>
                    <dd>
                      {selectedItem.storage_location ||
                        "Not set"}
                    </dd>
                  </div>

                  <div>
                    <dt>Vendor</dt>
                    <dd>
                      {selectedItem.vendor_name ||
                        "Not set"}
                    </dd>
                  </div>

                  <div>
                    <dt>Unit cost</dt>
                    <dd>
                      {selectedItem.unit_cost ==
                      null
                        ? "Not set"
                        : formatCurrency(
                            selectedItem.unit_cost,
                          )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Inventory value
                    </dt>
                    <dd>
                      {formatCurrency(
                        Number(
                          selectedItem.quantity_on_hand ||
                            0,
                        ) *
                          Number(
                            selectedItem.unit_cost ||
                              0,
                          ),
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Purchase order
                    </dt>
                    <dd>
                      {purchaseOrderFor(
                        selectedItem,
                      ).number ||
                        "Not set"}
                    </dd>
                  </div>

                  <div>
                    <dt>PO status</dt>
                    <dd>
                      {purchaseOrderStatusLabel(
                        purchaseOrderFor(
                          selectedItem,
                        ).status,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Updated</dt>
                    <dd>
                      {formatDateTime(
                        selectedItem.updated_at,
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              {selectedItem.description ? (
                <section
                  className={
                    styles.detailSection
                  }
                >
                  <div
                    className={
                      styles.detailSectionHeading
                    }
                  >
                    <div>
                      <span>
                        Notes
                      </span>
                      <h3>
                        Description
                      </h3>
                    </div>
                  </div>

                  <p
                    className={
                      styles.detailDescription
                    }
                  >
                    {
                      selectedItem.description
                    }
                  </p>
                </section>
              ) : null}

              {selectedItem.status ===
              "active" ? (
                <section
                  className={
                    styles.detailSection
                  }
                >
                  <div
                    className={
                      styles.detailSectionHeading
                    }
                  >
                    <div>
                      <span>
                        Inventory movement
                      </span>
                      <h3>
                        Update quantities
                      </h3>
                    </div>
                  </div>

                  <div
                    className={
                      styles.detailActions
                    }
                  >
                    {ACTIONS.map(
                      (action) => {
                        const Icon =
                          action.icon;

                        return (
                          <button
                            key={
                              action.key
                            }
                            type="button"
                            onClick={() =>
                              openAdjustment(
                                selectedItem,
                                action.key,
                              )
                            }
                          >
                            <Icon
                              size={16}
                            />
                            {
                              action.label
                            }
                          </button>
                        );
                      },
                    )}
                  </div>
                </section>
              ) : null}
            </div>

            <footer
              className={
                styles.detailFooter
              }
            >
              <button
                type="button"
                onClick={() =>
                  openEdit(
                    selectedItem,
                  )
                }
              >
                <Pencil
                  size={16}
                />
                Edit item
              </button>

              <button
                type="button"
                data-danger={
                  selectedItem.status ===
                  "active"
                    ? "true"
                    : "false"
                }
                onClick={() =>
                  void setItemStatus(
                    selectedItem,
                    selectedItem.status ===
                    "archived"
                      ? "active"
                      : "archived",
                  )
                }
              >
                {selectedItem.status ===
                "archived" ? (
                  <RefreshCw
                    size={16}
                  />
                ) : (
                  <Archive
                    size={16}
                  />
                )}

                {selectedItem.status ===
                "archived"
                  ? "Restore item"
                  : "Archive item"}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}

      {addOpen ? (
        <div
          className={
            styles.modalBackdrop
          }
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAdd();
            }
          }}
        >
          <section
            className={
              styles.modal
            }
            role="dialog"
            aria-modal="true"
            aria-label="Add inventory item"
          >
            <header>
              <div>
                <span>
                  Inventory item
                </span>

                <h2>
                  {editingItem
                    ? "Edit inventory item"
                    : "Add inventory item"}
                </h2>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={
                  closeAdd
                }
              >
                ×
              </button>
            </header>

            <form
              onSubmit={
                saveItem
              }
            >
              <label
                className={
                  styles.fullField
                }
              >
                <span>
                  Item name
                </span>
                <input
                  required
                  value={
                    itemForm.item_name
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        item_name:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Accomando 18×24 Yard Sign"
                />
              </label>

              <div
                className={[
                  styles.imageEditor,
                  styles.fullField,
                ].join(" ")}
              >
                <span
                  className={
                    styles.imagePreview
                  }
                >
                  {itemImagePreview ? (
                    <img
                      src={
                        itemImagePreview
                      }
                      alt="Inventory item preview"
                    />
                  ) : (
                    <ImagePlus
                      size={28}
                    />
                  )}
                </span>

                <div>
                  <strong>
                    Item photo / asset
                  </strong>

                  <p>
                    Add a product photo, yard-sign proof, shirt image or other visual. The image is also kept securely in Campaign Seat Files.
                  </p>

                  <div
                    className={
                      styles.imageEditorActions
                    }
                  >
                    <label
                      className={
                        styles.imageUploadButton
                      }
                    >
                      <ImagePlus
                        size={16}
                      />

                      {itemImagePreview
                        ? "Replace image"
                        : "Add image"}

                      <input
                        type="file"
                        accept="image/*"
                        onChange={
                          handleImageSelection
                        }
                      />
                    </label>

                    {itemImagePreview ? (
                      <button
                        type="button"
                        onClick={
                          removeImage
                        }
                      >
                        Remove image
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <label>
                <span>
                  SKU / internal code
                </span>

                <input
                  value={
                    itemForm.sku
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        sku:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="SIGN-18X24-001"
                />
              </label>

              <label>
                <span>
                  Category
                </span>
                <select
                  value={
                    itemForm.category
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        category:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  {CATEGORIES.filter(
                    ([key]) =>
                      key !==
                      "all",
                  ).map(
                    ([
                      key,
                      label,
                    ]) => (
                      <option
                        key={key}
                        value={key}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  On hand
                </span>
                <input
                  type="number"
                  min="0"
                  disabled={
                    Boolean(
                      editingItem,
                    )
                  }
                  value={
                    itemForm.quantity_on_hand
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        quantity_on_hand:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Reserved
                </span>
                <input
                  type="number"
                  min="0"
                  disabled={
                    Boolean(
                      editingItem,
                    )
                  }
                  value={
                    itemForm.quantity_reserved
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        quantity_reserved:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Reorder point
                </span>
                <input
                  type="number"
                  min="0"
                  value={
                    itemForm.reorder_point
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        reorder_point:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Unit cost
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    itemForm.unit_cost
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        unit_cost:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="3.85"
                />
              </label>

              <label>
                <span>
                  Storage location
                </span>
                <input
                  value={
                    itemForm.storage_location
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        storage_location:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Campaign HQ"
                />
              </label>

              <label>
                <span>
                  Vendor
                </span>
                <input
                  value={
                    itemForm.vendor_name
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        vendor_name:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Vendor name"
                />
              </label>

              <label>
                <span>
                  Purchase order #
                </span>

                <input
                  value={
                    itemForm
                      .purchase_order_number
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        purchase_order_number:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="PO-2026-1042"
                />
              </label>

              <label>
                <span>
                  PO status
                </span>

                <select
                  value={
                    itemForm
                      .purchase_order_status
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        purchase_order_status:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  {PURCHASE_ORDER_STATUSES.map(
                    ([
                      key,
                      label,
                    ]) => (
                      <option
                        key={key}
                        value={key}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Order date
                </span>

                <input
                  type="date"
                  value={
                    itemForm
                      .purchase_order_date
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        purchase_order_date:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Expected delivery
                </span>

                <input
                  type="date"
                  value={
                    itemForm
                      .expected_delivery_date
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        expected_delivery_date:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label
                className={
                  styles.fullField
                }
              >
                <span>
                  Notes
                </span>
                <textarea
                  rows="3"
                  value={
                    itemForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setItemForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        description:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Material, size, stakes included, print details..."
                />
              </label>

              <footer>
                <button
                  type="button"
                  onClick={
                    closeAdd
                  }
                >
                  Cancel
                </button>

                <button
                  className={
                    styles.primaryButton
                  }
                  type="submit"
                  disabled={
                    savingItem ||
                    isSavingAsset
                  }
                >
                  {isSavingAsset
                    ? "Uploading…"
                    : savingItem
                      ? "Saving…"
                      : editingItem
                        ? "Save changes"
                        : "Add inventory"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {adjustment ? (
        <div
          className={
            styles.modalBackdrop
          }
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAdjustment();
            }
          }}
        >
          <section
            className={[
              styles.modal,
              styles.adjustModal,
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-label="Adjust inventory"
          >
            <header>
              <div>
                <span>
                  {
                    MOVEMENT_LABELS[
                      adjustment
                        .movementType
                    ]
                  }
                </span>
                <h2>
                  {
                    adjustment
                      .item
                      .item_name
                  }
                </h2>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={
                  closeAdjustment
                }
              >
                ×
              </button>
            </header>

            <form
              onSubmit={
                saveAdjustment
              }
            >
              <label
                className={
                  styles.fullField
                }
              >
                <span>
                  Quantity
                </span>
                <input
                  autoFocus
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={
                    adjustmentQuantity
                  }
                  onChange={(
                    event,
                  ) =>
                    setAdjustmentQuantity(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label
                className={
                  styles.fullField
                }
              >
                <span>
                  Note
                </span>
                <textarea
                  rows="3"
                  value={
                    adjustmentNote
                  }
                  onChange={(
                    event,
                  ) =>
                    setAdjustmentNote(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Optional note"
                />
              </label>

              <footer>
                <button
                  type="button"
                  onClick={
                    closeAdjustment
                  }
                >
                  Cancel
                </button>

                <button
                  className={
                    styles.primaryButton
                  }
                  type="submit"
                  disabled={
                    savingAdjustment
                  }
                >
                  {savingAdjustment
                    ? "Saving…"
                    : MOVEMENT_LABELS[
                        adjustment
                          .movementType
                      ]}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </CampaignWorkspaceShell>
  );
}
