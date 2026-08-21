import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowDownToLine,
  BookmarkPlus,
  Boxes,
  CircleDollarSign,
  PackageOpen,
  Plus,
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
  supabase,
} from "../../lib/supabase";

import {
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
    category: "yard_signs",
    quantity_on_hand: "0",
    quantity_reserved: "0",
    reorder_point: "0",
    unit_cost: "",
    storage_location: "",
    vendor_name: "",
    description: "",
  };
}

export default function Inventory() {
  const workspace =
    getCurrentWorkspace();

  const workspaceId =
    workspace?.id || "";

  const [
    items,
    setItems,
  ] = useState([]);

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
    addOpen,
    setAddOpen,
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
            .eq(
              "status",
              "active",
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

        setItems(
          itemResult.data || [],
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

          if (!categoryMatches) {
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
    ]);

  const metrics =
    useMemo(() => {
      const totalUnits =
        items.reduce(
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
        items.filter(
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
        items.reduce(
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
          items.length,
        totalUnits,
        lowStock,
        value,
      };
    }, [items]);

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

  const closeAdd =
    () => {
      if (savingItem) {
        return;
      }

      setAddOpen(false);
      setItemForm(
        emptyItemForm(),
      );
    };

  const saveItem =
    async (event) => {
      event.preventDefault();

      if (
        !workspaceId ||
        !itemForm.item_name.trim()
      ) {
        return;
      }

      setSavingItem(true);
      setError("");

      try {
        const {
          error: insertError,
        } = await supabase
          .from(
            "workspace_inventory_items",
          )
          .insert({
            workspace_id:
              workspaceId,
            item_name:
              itemForm.item_name.trim(),
            category:
              itemForm.category,
            quantity_on_hand:
              Number(
                itemForm.quantity_on_hand ||
                  0,
              ),
            quantity_reserved:
              Number(
                itemForm.quantity_reserved ||
                  0,
              ),
            reorder_point:
              Number(
                itemForm.reorder_point ||
                  0,
              ),
            unit_cost:
              itemForm.unit_cost === ""
                ? null
                : Number(
                    itemForm.unit_cost,
                  ),
            storage_location:
              itemForm.storage_location
                .trim() ||
              null,
            vendor_name:
              itemForm.vendor_name
                .trim() ||
              null,
            description:
              itemForm.description
                .trim() ||
              null,
          });

        if (insertError) {
          throw insertError;
        }

        closeAdd();
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
            onClick={() =>
              setAddOpen(true)
            }
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
                              <strong>
                                {
                                  item.item_name
                                }
                              </strong>
                              {item.vendor_name ? (
                                <small>
                                  {
                                    item.vendor_name
                                  }
                                </small>
                              ) : null}
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
                                {ACTIONS.slice(
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
                                )}
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
                          <div>
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
                          </div>

                          {low ? (
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
                          {ACTIONS.map(
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
                          )}
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
                onClick={() =>
                  setAddOpen(true)
                }
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
                  Inventory
                </span>
                <h2>
                  Add inventory item
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
                    savingItem
                  }
                >
                  {savingItem
                    ? "Saving…"
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
