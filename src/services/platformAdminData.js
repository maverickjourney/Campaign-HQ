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
        ),
        seat_proposals (
          id,
          proposal_code,
          status,
          version,
          approved_at,
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

    const proposals =
      customer.seat_proposals || [];

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

    const currentProposal =
      [...proposals].sort(
        (a, b) =>
          Number(b.version || 0) -
            Number(a.version || 0) ||
          new Date(b.updated_at || 0) -
            new Date(a.updated_at || 0),
      )[0] || null;

    return {
      ...customer,
      primaryContact,
      currentDeal,
      currentProposal,
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


export async function loadProposalBuilder(
  dealCode,
) {
  const normalized =
    String(dealCode || "")
      .trim()
      .toUpperCase();

  const {
    data: deal,
    error: dealError,
  } =
    await supabase
      .from("seat_deals")
      .select(
        `
          id,
          deal_code,
          customer_id,
          product_id,
          currency,
          expected_monthly_cents,
          expected_setup_cents,
          contract_term_months,
          notes,
          metadata
        `,
      )
      .eq(
        "deal_code",
        normalized,
      )
      .single();

  if (dealError || !deal) {
    throw new Error(
      "Deal could not be loaded.",
    );
  }

  const [
    customerResult,
    productResult,
  ] =
    await Promise.all([
      supabase
        .from("seat_customers")
        .select(
          `
            id,
            display_name,
            customer_type,
            billing_email,
            seat_customer_contacts (
              id,
              full_name,
              email,
              phone,
              is_primary,
              status
            )
          `,
        )
        .eq(
          "id",
          deal.customer_id,
        )
        .single(),

      supabase
        .from("seat_products")
        .select(
          "id, product_name, hq_label",
        )
        .eq(
          "id",
          deal.product_id,
        )
        .single(),
    ]);

  if (
    customerResult.error ||
    productResult.error
  ) {
    throw new Error(
      "Proposal customer information could not be loaded.",
    );
  }

  const contacts =
    customerResult
      .data
      ?.seat_customer_contacts ||
    [];

  const primaryContact =
    contacts.find(
      (contact) =>
        contact.is_primary &&
        contact.status === "active",
    ) ||
    contacts[0] ||
    null;

  return {
    deal,

    customer:
      customerResult.data,

    product:
      productResult.data,

    primaryContact,
  };
}


export async function createPlatformProposalDraft(
  values,
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "create_seat_proposal_draft",
      {
        target_deal_code:
          values.dealCode,

        target_customer_display_name:
          values.customerName,

        target_client_name:
          values.clientName,

        target_client_email:
          values.clientEmail,

        target_monthly_cents:
          values.monthlyCents,

        target_setup_cents:
          values.setupCents,

        target_contract_term_months:
          values.contractMonths,

        target_valid_days:
          values.validDays,

        target_terms_summary:
          values.termsSummary,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Proposal draft could not be created.",
    );
  }

  return data?.[0] || null;
}


export async function loadAdminProposal(
  proposalId,
) {
  const {
    data: proposal,
    error,
  } =
    await supabase
      .from("seat_proposals")
      .select(
        `
          id,
          proposal_code,
          deal_id,
          customer_id,
          product_id,
          client_name,
          client_email,
          status,
          version,
          currency,
          monthly_total_cents,
          annual_total_cents,
          setup_total_cents,
          contract_term_months,
          valid_until,
          terms_summary,
          dashboard_config,
          onboarding_config,
          metadata,
          seat_proposal_items (
            id,
            item_type,
            item_key,
            display_name,
            description,
            quantity,
            unit_amount_cents,
            billing_cadence,
            included,
            sort_order
          )
        `,
      )
      .eq(
        "id",
        proposalId,
      )
      .single();

  if (error || !proposal) {
    throw new Error(
      "Proposal could not be loaded.",
    );
  }

  const [
    customer,
    product,
  ] =
    await Promise.all([
      supabase
        .from("seat_customers")
        .select(
          "id, display_name",
        )
        .eq(
          "id",
          proposal.customer_id,
        )
        .single(),

      supabase
        .from("seat_products")
        .select(
          "id, product_name, hq_label",
        )
        .eq(
          "id",
          proposal.product_id,
        )
        .single(),
    ]);

  if (
    customer.error ||
    product.error
  ) {
    throw new Error(
      "Proposal details could not be loaded.",
    );
  }

  return {
    ...proposal,

    customer:
      customer.data,

    product:
      product.data,

    items:
      [
        ...(
          proposal.seat_proposal_items ||
          []
        ),
      ].sort(
        (a, b) =>
          (a.sort_order || 0) -
          (b.sort_order || 0),
      ),
  };
}


export async function sendPlatformProposal(
  proposalId,
  validDays,
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "send_seat_proposal",
      {
        target_proposal_id:
          proposalId,

        target_valid_days:
          validDays || null,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Secure proposal link could not be generated.",
    );
  }

  return data?.[0] || null;
}


export async function loadClientProposal(
  token,
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_seat_proposal_by_token",
      {
        target_token:
          token,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      "Proposal could not be opened.",
    );
  }

  return data;
}


export async function respondToClientProposal(
  token,
  action,
  note = "",
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "respond_to_seat_proposal",
      {
        target_token:
          token,

        target_action:
          action,

        target_note:
          note || null,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Proposal response could not be saved.",
    );
  }

  return data;
}


// ============================================================
// PLATFORM ADMIN — CUSTOMER WORKSPACE MANAGEMENT
// ============================================================

export async function loadPlatformCustomerWorkspaceBindings() {
  const [
    accountsResult,
    bindingsResult,
  ] = await Promise.all([
    supabase
      .from("seat_product_accounts")
      .select(
        `
          id,
          customer_id,
          account_name,
          status,
          onboarding_status,
          created_at
        `,
      )
      .eq("status", "active")
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("seat_workspace_bindings")
      .select(
        `
          id,
          product_account_id,
          workspace_id,
          relationship_type,
          status,
          created_at
        `,
      )
      .eq("status", "active")
      .order("created_at", {
        ascending: false,
      }),
  ]);

  if (
    accountsResult.error ||
    bindingsResult.error
  ) {
    console.error(
      accountsResult.error ||
      bindingsResult.error,
    );

    throw new Error(
      "Customer workspace access could not be loaded.",
    );
  }

  const bindingsByAccount =
    new Map();

  for (
    const binding of
    bindingsResult.data || []
  ) {
    const existing =
      bindingsByAccount.get(
        binding.product_account_id,
      ) || [];

    existing.push(binding);

    bindingsByAccount.set(
      binding.product_account_id,
      existing,
    );
  }

  const result = [];

  for (
    const account of
    accountsResult.data || []
  ) {
    const bindings =
      bindingsByAccount.get(
        account.id,
      ) || [];

    const primaryBinding =
      bindings.find(
        (binding) =>
          binding.status === "active" &&
          binding.relationship_type === "primary",
      ) ||
      bindings.find(
        (binding) =>
          binding.status === "active",
      ) ||
      null;

    if (!primaryBinding?.workspace_id) {
      continue;
    }

    result.push({
      customer_id:
        account.customer_id,

      product_account_id:
        account.id,

      account_name:
        account.account_name,

      product_account_status:
        account.status,

      onboarding_status:
        account.onboarding_status,

      binding_id:
        primaryBinding.id,

      workspace_id:
        primaryBinding.workspace_id,

      relationship_type:
        primaryBinding.relationship_type,

      binding_status:
        primaryBinding.status,
    });
  }

  return result;
}


export async function loadPlatformWorkspaceEditor(
  workspaceId,
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "get_platform_workspace_editor",
    {
      target_workspace_id:
        workspaceId,
    },
  );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
      "Workspace editor could not be loaded.",
    );
  }

  return data || null;
}


export async function savePlatformWorkspaceDraft(
  workspaceId,
  payload,
  expectedRevisionNumber,
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "save_platform_workspace_draft",
    {
      target_workspace_id:
        workspaceId,

      target_payload:
        payload,

      expected_revision_number:
        expectedRevisionNumber,
    },
  );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
      "Workspace draft could not be saved.",
    );
  }

  return data || null;
}


export async function previewPlatformWorkspaceDraft(
  workspaceId,
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "preview_platform_workspace_draft",
    {
      target_workspace_id:
        workspaceId,
    },
  );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
      "Workspace draft preview could not be loaded.",
    );
  }

  return data || null;
}


export async function publishPlatformWorkspaceDraft(
  workspaceId,
  revisionId,
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "publish_platform_workspace_draft",
    {
      target_workspace_id:
        workspaceId,

      target_revision_id:
        revisionId,
    },
  );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
      "Workspace draft could not be published.",
    );
  }

  return data || null;
}

// ============================================================
// SEAT PLATFORM ADMIN — CUSTOMER 360
// ============================================================

export async function loadPlatformCustomerControlCenter(
  workspaceId,
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "get_platform_customer_control_center",
    {
      target_workspace_id:
        workspaceId,
    },
  );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
      "Customer 360 could not be loaded.",
    );
  }

  return data;
}


export async function updatePlatformManualBilling({
  workspaceId,
  billing,
  expectedUpdatedAt,
  reason,
}) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "update_platform_manual_billing",
    {
      target_workspace_id:
        workspaceId,

      target_billing:
        billing,

      expected_subscription_updated_at:
        expectedUpdatedAt ||
        null,

      target_reason:
        reason || null,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
      "Billing could not be updated.",
    );
  }

  return data;
}


export async function setPlatformCustomerModule({
  workspaceId,
  moduleKey,
  enabled,
  reason,
}) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "set_platform_customer_module",
    {
      target_workspace_id:
        workspaceId,

      target_module_key:
        moduleKey,

      target_enabled:
        enabled,

      target_reason:
        reason,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
      "Module access could not be changed.",
    );
  }

  return data;
}


export async function setPlatformCustomerAccountStatus({
  workspaceId,
  status,
  reason,
}) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "set_platform_customer_account_status",
    {
      target_workspace_id:
        workspaceId,

      target_status:
        status,

      target_reason:
        reason,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
      "Account status could not be changed.",
    );
  }

  return data;
}


export async function setPlatformCustomerMemberAccess({
  workspaceId,
  membershipId,
  roleKey,
  displayTitle,
  status,
  reason,
}) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "set_platform_customer_member_access",
    {
      target_workspace_id:
        workspaceId,

      target_membership_id:
        membershipId,

      target_role_key:
        roleKey,

      target_display_title:
        displayTitle || null,

      target_status:
        status,

      target_reason:
        reason,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
      "Team access could not be changed.",
    );
  }

  return data;
}


export async function loadPlatformWorkspaceRevisionHistory(
  workspaceId,
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "get_platform_workspace_revision_history",
    {
      target_workspace_id:
        workspaceId,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
      "Workspace history could not be loaded.",
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}


export async function discardPlatformWorkspaceDraft({
  workspaceId,
  revisionId,
  reason,
}) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "discard_platform_workspace_draft",
    {
      target_workspace_id:
        workspaceId,

      target_revision_id:
        revisionId,

      target_reason:
        reason,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
      "Workspace draft could not be discarded.",
    );
  }

  return data;
}


export async function loadPlatformCampaignRoles() {
  const {
    data,
    error,
  } = await supabase
    .from("campaign_roles")
    .select(
      "key, name, dashboard_type, seat_type, authority_rank, is_active",
    )
    .eq(
      "is_active",
      true,
    )
    .order(
      "authority_rank",
    );

  if (error) {
    console.warn(
      "Campaign roles could not be loaded for Platform Admin.",
      error,
    );

    return [];
  }

  return data || [];
}
