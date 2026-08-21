import {
  createClient,
} from "npm:@supabase/supabase-js@2";

function clean(
  value: unknown,
) {
  return String(
    value || "",
  ).trim();
}

function jsonResponse(
  status: number,
  payload: Record<
    string,
    unknown
  >,
) {
  return new Response(
    JSON.stringify(
      payload,
    ),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",

        "Cache-Control":
          "no-store",
      },
    },
  );
}

async function fetchTollFreeVerificationStatus({
  accountSid,
  authToken,
  verificationSid,
}: {
  accountSid: string;
  authToken: string;
  verificationSid: string;
}) {
  const response =
    await fetch(
      `https://messaging.twilio.com/v1/Tollfree/Verifications/${verificationSid}`,
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
      },
    );

  const payload =
    await response
      .json()
      .catch(
        () => (
          {}
        ),
      ) as Record<
        string,
        unknown
      >;

  if (
    !response.ok
  ) {
    return {
      ok:
        false,

      status:
        "UNKNOWN",

      approved:
        false,

      rejected:
        false,

      http_status:
        response.status,

      error_code:
        payload.code ??
        null,

      error:
        clean(
          payload.message,
        ) ||
        "Twilio verification status could not be loaded.",

      verification_sid:
        verificationSid,

      tollfree_phone_number:
        null,

      updated_at:
        null,
    };
  }

  const status =
    clean(
      payload.status,
    )
      .toUpperCase();

  return {
    ok:
      true,

    status:
      status ||
      "UNKNOWN",

    approved:
      status ===
      "TWILIO_APPROVED",

    rejected:
      status ===
      "TWILIO_REJECTED",

    http_status:
      response.status,

    error_code:
      null,

    error:
      null,

    verification_sid:
      clean(
        payload.sid,
      ) ||
      verificationSid,

    tollfree_phone_number:
      clean(
        payload
          .tollfree_phone_number ??
        payload
          .tollfreePhoneNumber,
      ) ||
      null,

    updated_at:
      clean(
        payload
          .date_updated ??
        payload
          .dateUpdated,
      ) ||
      null,
  };
}


Deno.serve(
  async (
    request: Request,
  ) => {
    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        405,
        {
          error:
            "Method not allowed.",
        },
      );
    }

    const suppliedSecret =
      clean(
        request.headers.get(
          "x-campaign-seat-dispatch-secret",
        ),
      );

    const expectedSecret =
      clean(
        Deno.env.get(
          "PLATFORM_NOTIFICATION_DISPATCH_SECRET",
        ),
      );

    if (
      !expectedSecret ||
      suppliedSecret !==
        expectedSecret
    ) {
      return jsonResponse(
        401,
        {
          error:
            "Unauthorized.",
        },
      );
    }

    let requestBody:
      Record<
        string,
        unknown
      > =
      {};

    try {
      requestBody =
        await request
          .json();
    } catch {
      requestBody =
        {};
    }

    const action =
      clean(
        requestBody
          .action,
      );

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return jsonResponse(
        503,
        {
          error:
            "Notification dispatcher database configuration is incomplete.",
        },
      );
    }

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession:
              false,
          },
        },
      );

    if (
      action ===
      "configure_scheduler"
    ) {
      const dispatchUrl =
        `${supabaseUrl}/functions/v1/notification-dispatch`;

      const {
        data,
        error:
          configureError,
      } =
        await admin.rpc(
          "configure_platform_notification_scheduler",
          {
            target_dispatch_url:
              dispatchUrl,

            target_dispatch_secret:
              suppliedSecret,
          },
        );

      if (
        configureError
      ) {
        console.error(
          "Notification scheduler configuration failed.",
          configureError,
        );

        return jsonResponse(
          500,
          {
            error:
              "Notification scheduler could not be configured.",

            detail:
              configureError
                .message,
          },
        );
      }

      return jsonResponse(
        200,
        {
          ok:
            true,

          configured:
            true,

          scheduler:
            data,
        },
      );
    }

    if (
      action ===
      "scheduler_status"
    ) {
      const {
        data,
        error:
          statusError,
      } =
        await admin.rpc(
          "get_platform_notification_scheduler_status",
        );

      if (
        statusError
      ) {
        console.error(
          "Notification scheduler status failed.",
          statusError,
        );

        return jsonResponse(
          500,
          {
            error:
              "Notification scheduler status could not be loaded.",

            detail:
              statusError
                .message,
          },
        );
      }

      return jsonResponse(
        200,
        {
          ok:
            true,

          dispatch_enabled:
            clean(
              Deno.env.get(
                "PLATFORM_NOTIFICATION_DISPATCH_ENABLED",
              ),
            )
              .toLowerCase() ===
            "true",

          scheduler:
            data,
        },
      );
    }

    if (
      action ===
      "queue_health"
    ) {
      const {
        data,
        error:
          queueHealthError,
      } =
        await admin.rpc(
          "get_platform_notification_queue_health",
        );

      if (
        queueHealthError
      ) {
        console.error(
          "Notification queue health failed.",
          queueHealthError,
        );

        return jsonResponse(
          500,
          {
            error:
              "Notification queue health could not be loaded.",

            detail:
              queueHealthError
                .message,
          },
        );
      }

      return jsonResponse(
        200,
        {
          ok:
            true,

          queue:
            data,
        },
      );
    }

    const accountSidForVerification =
      clean(
        Deno.env.get(
          "TWILIO_ACCOUNT_SID",
        ),
      );

    const authTokenForVerification =
      clean(
        Deno.env.get(
          "TWILIO_AUTH_TOKEN",
        ),
      );

    const verificationSidForVerification =
      clean(
        Deno.env.get(
          "TWILIO_TOLL_FREE_VERIFICATION_SID",
        ),
      );

    if (
      action ===
      "twilio_verification_status"
    ) {
      if (
        !accountSidForVerification ||
        !authTokenForVerification ||
        !verificationSidForVerification
      ) {
        return jsonResponse(
          503,
          {
            error:
              "Twilio verification status configuration is incomplete.",
          },
        );
      }

      const verification =
        await fetchTollFreeVerificationStatus({
          accountSid:
            accountSidForVerification,

          authToken:
            authTokenForVerification,

          verificationSid:
            verificationSidForVerification,
        });

      return jsonResponse(
        verification.ok
          ? 200
          : 502,
        {
          ok:
            verification.ok,

          verification_sid:
            verification.verification_sid ??
            verificationSidForVerification,

          tollfree_phone_number:
            verification.tollfree_phone_number ??
            null,

          verification_status:
            verification.status,

          approved:
            verification.approved,

          rejected:
            verification.rejected ??
            false,

          twilio_http_status:
            verification.http_status,

          twilio_error_code:
            verification.error_code ??
            null,

          twilio_error:
            verification.error ??
            null,

          verification_updated_at:
            verification.updated_at ??
            null,

          dispatch_enabled:
            clean(
              Deno.env.get(
                "PLATFORM_NOTIFICATION_DISPATCH_ENABLED",
              ),
            )
              .toLowerCase() ===
            "true",
        },
      );
    }

    const dispatchEnabled =
      clean(
        Deno.env.get(
          "PLATFORM_NOTIFICATION_DISPATCH_ENABLED",
        ),
      )
        .toLowerCase() ===
      "true";

    if (
      !dispatchEnabled
    ) {
      return jsonResponse(
        200,
        {
          ok:
            true,

          enabled:
            false,

          paused:
            true,

          processed:
            0,

          sent:
            0,

          skipped:
            0,

          failed:
            0,
        },
      );
    }

    if (
      !accountSidForVerification ||
      !authTokenForVerification ||
      !verificationSidForVerification
    ) {
      return jsonResponse(
        503,
        {
          error:
            "Twilio verification gate configuration is incomplete.",
        },
      );
    }

    const verification =
      await fetchTollFreeVerificationStatus({
        accountSid:
          accountSidForVerification,

        authToken:
          authTokenForVerification,

        verificationSid:
          verificationSidForVerification,
      });

    if (
      !verification.ok
    ) {
      return jsonResponse(
        503,
        {
          ok:
            false,

          enabled:
            true,

          paused:
            true,

          reason:
            "twilio_verification_unavailable",

          verification_status:
            verification.status,

          processed:
            0,

          sent:
            0,

          skipped:
            0,

          failed:
            0,
        },
      );
    }

    if (
      !verification.approved
    ) {
      return jsonResponse(
        200,
        {
          ok:
            true,

          enabled:
            true,

          paused:
            true,

          reason:
            verification.rejected
              ? "twilio_verification_rejected"
              : "twilio_verification_not_approved",

          verification_status:
            verification.status,

          processed:
            0,

          sent:
            0,

          skipped:
            0,

          failed:
            0,
        },
      );
    }

    const {
      data:
        recoveryResult,
      error:
        recoveryError,
    } =
      await admin.rpc(
        "recover_stale_platform_notification_queue",
      );

    if (
      recoveryError
    ) {
      console.error(
        "Notification stale-processing recovery failed.",
        recoveryError,
      );

      return jsonResponse(
        500,
        {
          error:
            "Notification queue recovery failed.",
        },
      );
    }

    const {
      data:
        expiredCount,
      error:
        expiryError,
    } =
      await admin.rpc(
        "expire_platform_notification_queue",
      );

    if (
      expiryError
    ) {
      console.error(
        "Notification expiration failed.",
        expiryError,
      );

      return jsonResponse(
        500,
        {
          error:
            "Notification queue expiration failed.",
        },
      );
    }

    const accountSid =
      Deno.env.get(
        "TWILIO_ACCOUNT_SID",
      );

    const apiKeySid =
      Deno.env.get(
        "TWILIO_API_KEY_SID",
      );

    const apiKeySecret =
      Deno.env.get(
        "TWILIO_API_KEY_SECRET",
      );

    const messagingServiceSid =
      Deno.env.get(
        "TWILIO_MESSAGING_SERVICE_SID",
      );

    if (
      !accountSid ||
      !apiKeySid ||
      !apiKeySecret ||
      !messagingServiceSid
    ) {
      return jsonResponse(
        503,
        {
          error:
            "Notification dispatcher Twilio configuration is incomplete.",
        },
      );
    }

    const {
      data:
        pendingRows,
      error:
        queueError,
    } =
      await admin
        .from(
          "platform_notification_queue",
        )
        .select(
          "id,workspace_id,recipient_user_id,category,source_type,source_id,title,body,route,status,attempts",
        )
        .eq(
          "status",
          "pending",
        )
        .lte(
          "available_at",
          new Date()
            .toISOString(),
        )
        .gt(
          "expires_at",
          new Date()
            .toISOString(),
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        )
        .limit(
          25,
        );

    if (
      queueError
    ) {
      console.error(
        "Notification queue load failed.",
        queueError,
      );

      return jsonResponse(
        500,
        {
          error:
            "Notification queue could not be loaded.",
        },
      );
    }

    let sent =
      0;

    let skipped =
      0;

    let failed =
      0;

    for (
      const row of
        pendingRows || []
    ) {
      const attemptNumber =
        Number(
          row.attempts ||
          0,
        ) + 1;

      const {
        data:
          claimed,
        error:
          claimError,
      } =
        await admin
          .from(
            "platform_notification_queue",
          )
          .update({
            status:
              "processing",

            attempts:
              attemptNumber,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            row.id,
          )
          .eq(
            "status",
            "pending",
          )
          .select(
            "id",
          )
          .maybeSingle();

      if (
        claimError ||
        !claimed
      ) {
        continue;
      }

      const {
        data:
          subscription,
      } =
        await admin
          .from(
            "platform_sms_subscriptions",
          )
          .select(
            "phone_e164,status",
          )
          .eq(
            "user_id",
            row.recipient_user_id,
          )
          .maybeSingle();

      const {
        data:
          preference,
      } =
        await admin
          .from(
            "platform_notification_preferences",
          )
          .select(
            "campaign_updates,task_reminders,approvals,field_alerts,weekly_summary",
          )
          .eq(
            "user_id",
            row.recipient_user_id,
          )
          .maybeSingle();

      const categoryEnabled =
        row.category ===
          "task_reminders"
          ? Boolean(
              preference
                ?.task_reminders,
            )
          : row.category ===
              "approvals"
            ? Boolean(
                preference
                  ?.approvals,
              )
            : row.category ===
                "campaign_updates"
              ? Boolean(
                  preference
                    ?.campaign_updates,
                )
              : row.category ===
                  "field_alerts"
                ? Boolean(
                    preference
                      ?.field_alerts,
                  )
                : row.category ===
                    "weekly_summary"
                  ? Boolean(
                      preference
                        ?.weekly_summary,
                    )
                  : false;

      if (
        subscription
          ?.status !==
          "active" ||
        !subscription
          ?.phone_e164 ||
        !categoryEnabled
      ) {
        await admin
          .from(
            "platform_notification_queue",
          )
          .update({
            status:
              "skipped",

            last_error:
              "Recipient is not eligible for this notification category.",

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            row.id,
          );

        skipped +=
          1;

        continue;
      }

      const messageBody =
        clean(
          row.body,
        ).slice(
          0,
          1500,
        );

      const form =
        new URLSearchParams();

      form.set(
        "To",
        subscription
          .phone_e164,
      );

      form.set(
        "MessagingServiceSid",
        messagingServiceSid,
      );

      form.set(
        "Body",
        messageBody,
      );

      const twilioResponse =
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Basic ${btoa(`${apiKeySid}:${apiKeySecret}`)}`,

              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            body:
              form,
          },
        );

      const twilioResult =
        await twilioResponse
          .json()
          .catch(
            () => (
              {}
            ),
          ) as Record<
            string,
            unknown
          >;

      if (
        !twilioResponse.ok
      ) {
        const errorMessage =
          clean(
            twilioResult.message,
          ) ||
          "Twilio could not send the notification.";

        const transientFailure =
          twilioResponse.status ===
            429 ||
          twilioResponse.status >=
            500;

        if (
          transientFailure &&
          attemptNumber <
            5
        ) {
          const backoffSeconds =
            Math.min(
              60 *
                (2 **
                  Math.max(
                    attemptNumber -
                      1,
                    0,
                  )),
              1800,
            );

          await admin
            .from(
              "platform_notification_queue",
            )
            .update({
              status:
                "pending",

              available_at:
                new Date(
                  Date.now() +
                    backoffSeconds *
                      1000,
                )
                  .toISOString(),

              last_error:
                `Temporary Twilio error; retry scheduled. ${errorMessage}`
                  .slice(
                    0,
                    1000,
                  ),

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              row.id,
            );
        } else {
          await admin
            .from(
              "platform_notification_queue",
            )
            .update({
              status:
                "failed",

              last_error:
                errorMessage.slice(
                  0,
                  1000,
                ),

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              row.id,
            );

          failed +=
            1;
        }

        continue;
      }

      const messageSid =
        clean(
          twilioResult.sid,
        );

      const status =
        clean(
          twilioResult.status,
        ) ||
        "queued";

      await admin
        .from(
          "platform_sms_messages",
        )
        .upsert(
          {
            user_id:
              row.recipient_user_id,

            direction:
              "outbound",

            channel:
              "sms",

            twilio_message_sid:
              messageSid,

            messaging_service_sid:
              messagingServiceSid,

            from_number:
              clean(
                twilioResult.from,
              ) ||
              null,

            to_number:
              subscription
                .phone_e164,

            body:
              messageBody,

            status,

            num_media:
              0,

            media:
              [],

            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "twilio_message_sid",
          },
        );

      await admin
        .from(
          "platform_notification_queue",
        )
        .update({
          status:
            "sent",

          twilio_message_sid:
            messageSid,

          sent_at:
            new Date()
              .toISOString(),

          last_error:
            null,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          row.id,
        );

      await admin
        .from(
          "platform_sms_subscriptions",
        )
        .update({
          last_outbound_at:
            new Date()
              .toISOString(),

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "user_id",
          row.recipient_user_id,
        );

      sent +=
        1;
    }

    return jsonResponse(
      200,
      {
        ok:
          true,

        enabled:
          true,

        processed:
          (pendingRows || [])
            .length,

        sent,

        skipped,

        failed,

        recovered:
          recoveryResult,

        expired:
          Number(
            expiredCount ||
            0,
          ),
      },
    );
  },
);
