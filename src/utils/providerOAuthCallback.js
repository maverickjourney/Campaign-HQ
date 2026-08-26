import {
  supabase,
} from "../lib/supabase";


const SESSION_WAIT_MS =
  5000;

const SESSION_POLL_MS =
  160;

const EXCHANGE_TIMEOUT_MS =
  20000;


function delay(
  milliseconds,
) {
  return new Promise(
    (resolve) => {
      window.setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}


async function readFunctionError(
  error,
) {
  if (
    error?.context instanceof
      Response
  ) {
    try {
      const payload =
        await error.context
          .clone()
          .json();

      return (
        payload?.error ||
        payload?.message ||
        ""
      );
    } catch {
      return "";
    }
  }

  return "";
}


async function waitForSession() {
  const deadline =
    Date.now() +
    SESSION_WAIT_MS;

  let lastError =
    null;

  while (
    Date.now() <
    deadline
  ) {
    try {
      const {
        data,
        error,
      } =
        await supabase.auth
          .getSession();

      if (error) {
        lastError =
          error;
      }

      if (
        data?.session
          ?.access_token
      ) {
        return data.session;
      }
    } catch (
      sessionError
    ) {
      lastError =
        sessionError;
    }

    await delay(
      SESSION_POLL_MS,
    );
  }

  throw new Error(
    lastError?.message ||
      "Your Campaign Seat sign-in session is not available on this provider callback. Return to Campaign Seat, sign in if needed, and restart the connection.",
  );
}


export async function invokeProtectedOAuthExchange({
  functionName,
  body,
  fallbackErrorMessage,
}) {
  await waitForSession();

  const controller =
    new AbortController();

  let timedOut =
    false;

  const timeoutId =
    window.setTimeout(
      () => {
        timedOut =
          true;

        controller.abort();
      },
      EXCHANGE_TIMEOUT_MS,
    );

  try {
    const {
      data,
      error,
    } =
      await supabase
        .functions
        .invoke(
          functionName,
          {
            body,
            signal:
              controller.signal,
          },
        );

    if (
      error ||
      data?.success !==
        true
    ) {
      if (timedOut) {
        throw new Error(
          "Campaign Seat could not verify the provider connection within 20 seconds. The connection was not confirmed. Return to Settings and review the current connection before trying again.",
        );
      }

      const functionMessage =
        await readFunctionError(
          error,
        );

      throw new Error(
        functionMessage ||
          data?.error ||
          error?.message ||
          fallbackErrorMessage,
      );
    }

    return data;
  } finally {
    window.clearTimeout(
      timeoutId,
    );
  }
}
