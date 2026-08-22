import { supabase } from "../lib/supabase";

export async function loadPlatformAdminOverview() {
  const [
    customers,
    deals,
    proposals,
    accounts,
    products,
  ] = await Promise.all([
    supabase
      .from("seat_customers")
      .select("id", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("seat_deals")
      .select("id", {
        count: "exact",
        head: true,
      })
      .neq("stage", "lost"),

    supabase
      .from("seat_proposals")
      .select("id", {
        count: "exact",
        head: true,
      })
      .in("status", [
        "draft",
        "sent",
        "viewed",
        "changes_requested",
      ]),

    supabase
      .from("seat_product_accounts")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "active"),

    supabase
      .from("seat_products")
      .select(
        "id, product_key, product_name, hq_label, status",
      )
      .order("product_name"),
  ]);

  const failed = [
    customers,
    deals,
    proposals,
    accounts,
    products,
  ].find((result) => result.error);

  if (failed?.error) {
    console.error(failed.error);
    throw new Error(
      "Seat Platform overview could not be loaded.",
    );
  }

  return {
    counts: {
      customers: customers.count || 0,
      openDeals: deals.count || 0,
      proposals: proposals.count || 0,
      activeAccounts: accounts.count || 0,
    },

    products: products.data || [],
  };
}

export async function loadPlatformCustomers() {
  const {
    data,
    error,
  } = await supabase
    .from("seat_customers")
    .select(
      `
        id,
        display_name,
        customer_type,
        status,
        billing_email,
        phone,
        created_at,
        seat_customer_contacts (
          id,
          full_name,
          email,
          phone,
          is_primary,
          status
        ),
        seat_deals (
          id,
          deal_code,
          stage,
          expected_monthly_cents,
          expected_setup_cents,
          updated_at
        )
      `,
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(error);
    throw new Error(
      "Customers could not be loaded.",
    );
  }

  return (data || []).map((customer) => {
    const contacts =
      customer.seat_customer_contacts || [];

    const deals =
      customer.seat_deals || [];

    const primaryContact =
      contacts.find(
        (contact) =>
          contact.is_primary &&
          contact.status === "active",
      ) ||
      contacts[0] ||
      null;

    const currentDeal =
      [...deals].sort(
        (a, b) =>
          new Date(b.updated_at || 0) -
          new Date(a.updated_at || 0),
      )[0] || null;

    return {
      ...customer,
      primaryContact,
      currentDeal,
    };
  });
}

export async function loadNewClientOptions() {
  const {
    data,
    error,
  } = await supabase
    .from("seat_products")
    .select(
      "id, product_key, product_name, hq_label, status",
    )
    .eq("status", "active")
    .order("product_name");

  if (error) {
    throw new Error(
      "Seat products could not be loaded.",
    );
  }

  return data || [];
}

export async function loadProductSalesOptions(
  productId,
) {
  const [
    packages,
    productModules,
    productIntegrations,
    addons,
  ] = await Promise.all([
    supabase
      .from("seat_packages")
      .select(
        `
          id,
          display_name,
          status,
          monthly_price_cents,
          onboarding_fee_cents,
          included_user_seats,
          contract_term_months
        `,
      )
      .eq("product_id", productId)
      .neq("status", "retired")
      .order("display_name"),

    supabase
      .from("seat_product_modules")
      .select(
        `
          required,
          default_enabled,
          display_label,
          sort_order,
          seat_modules (
            id,
            module_key,
            display_name,
            module_scope
          )
        `,
      )
      .eq("product_id", productId)
      .eq("enabled", true)
      .order("sort_order"),

    supabase
      .from("seat_product_integrations")
      .select(
        `
          default_enabled,
          availability,
          seat_integration_catalog (
            id,
            integration_key,
            display_name,
            category
          )
        `,
      )
      .eq("product_id", productId)
      .neq("availability", "hidden"),

    supabase
      .from("seat_addons")
      .select(
        `
          id,
          addon_key,
          display_name,
          billing_cadence,
          unit_price_cents,
          setup_price_cents
        `,
      )
      .eq("product_id", productId)
      .neq("status", "retired")
      .order("display_name"),
  ]);

  const failed = [
    packages,
    productModules,
    productIntegrations,
    addons,
  ].find((result) => result.error);

  if (failed?.error) {
    console.error(failed.error);
    throw new Error(
      "Product sales options could not be loaded.",
    );
  }

  return {
    packages: packages.data || [],

    modules:
      (productModules.data || [])
        .map((row) => ({
          ...row.seat_modules,
          required: row.required,
          defaultEnabled:
            row.default_enabled,
          displayLabel:
            row.display_label ||
            row.seat_modules?.display_name,
        }))
        .filter((row) => row.id),

    integrations:
      (productIntegrations.data || [])
        .map((row) => ({
          ...row.seat_integration_catalog,
          defaultEnabled:
            row.default_enabled,
        }))
        .filter((row) => row.id),

    addons: addons.data || [],
  };
}

export async function createPlatformClientDraft(
  values,
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "create_seat_client_draft",
    {
      target_product_id:
        values.productId,

      target_customer_name:
        values.customerName,

      target_customer_type:
        values.customerType,

      target_primary_contact_name:
        values.contactName,

      target_primary_contact_email:
        values.contactEmail,

      target_primary_contact_phone:
        values.contactPhone || null,

      target_package_id:
        values.packageId || null,

      target_monthly_cents:
        values.monthlyCents,

      target_setup_cents:
        values.setupCents,

      target_contract_term_months:
        values.contractMonths,

      target_notes:
        values.notes || null,

      target_metadata:
        values.metadata || {},
    },
  );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
      "Client draft could not be created.",
    );
  }

  return data?.[0] || null;
}
