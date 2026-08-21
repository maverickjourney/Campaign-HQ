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
      [workspaceId],
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
                              >
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
                        >
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
