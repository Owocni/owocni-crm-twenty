const functions = require("@google-cloud/functions-framework");
const { google } = require("googleapis");
const crypto = require("crypto");
const {
  partitionTasksByEnvironment,
  logSandboxPlatformSkip,
  getSpreadsheetId,
} = require("./shared/envGuard");

// ============================================
// KONFIGURACJA
// ============================================
const STAPE_API_KEY = process.env.STAPE_API_KEY;
const STAPE_API_BASE = process.env.STAPE_API_BASE;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SHEET_ID_SANDBOX = process.env.GOOGLE_SHEET_ID_SANDBOX;

function getSheetIdForTaskData(taskData) {
  return getSpreadsheetId(
    taskData,
    GOOGLE_SHEET_ID,
    GOOGLE_SHEET_ID_SANDBOX,
  );
}

function pricingConfigForTask(task, pricingProd, pricingSandbox) {
  const sheetId = getSheetIdForTaskData(task.data || {});
  if (sheetId === GOOGLE_SHEET_ID_SANDBOX && pricingSandbox) {
    return pricingSandbox;
  }
  return pricingProd;
}

function withSheetId(task, event) {
  if (!event) return null;
  const sheetId = getSheetIdForTaskData(task.data || {});
  if (!sheetId) {
    console.warn(
      "⚠️ env-guard: pomijam zapis arkusza — sandbox bez GOOGLE_SHEET_ID_SANDBOX, task=",
      task.key || task.id || "?",
    );
    return null;
  }
  event._sheetId = sheetId;
  return event;
}

// GA4 Debug mode: debug_mode:1 w params → eventy w GA4 DebugView (real-time)
// GA4_DEBUG_VALIDATE: użyj /debug/mp/collect → validationMessages (bez wysyłki do GA4)
const GA4_DEBUG_MODE =
  process.env.GA4_DEBUG_MODE === "true" || process.env.GA4_DEBUG_MODE === "1";
const GA4_DEBUG_VALIDATE =
  process.env.GA4_DEBUG_VALIDATE === "true" ||
  process.env.GA4_DEBUG_VALIDATE === "1";

// GA4 per domena (Copywriting, Owocni, Logo firmowe)
const GA4_CONFIG = {
  copywriting: {
    measurementId: process.env.GA4_COPYWRITING_MEASUREMENT_ID || "",
    apiSecret: process.env.GA4_COPYWRITING_API_SECRET || "",
  },
  owocni: {
    measurementId: process.env.GA4_OWOCNI_MEASUREMENT_ID || "",
    apiSecret: process.env.GA4_OWOCNI_API_SECRET || "",
  },
  logofirmowe: {
    measurementId: process.env.GA4_LOGOFIRMOWE_MEASUREMENT_ID || "",
    apiSecret: process.env.GA4_LOGOFIRMOWE_API_SECRET || "",
  },
};

// Google Ads: konwersje Lead/SQL/Rejected → jedna akcja, Purchase → druga
const GOOGLE_ADS_CUSTOMER_ID = (
  process.env.GOOGLE_ADS_CUSTOMER_ID || "8037312085"
).replace(/-/g, "");
const GOOGLE_ADS_LEAD_CONVERSION_ACTION_ID =
  process.env.GOOGLE_ADS_LEAD_CONVERSION_ACTION_ID || "6897478455";
const GOOGLE_ADS_PURCHASE_CONVERSION_ACTION_ID =
  process.env.GOOGLE_ADS_PURCHASE_CONVERSION_ACTION_ID || "7512561962";
const GOOGLE_ADS_LEAD_ACTION = `customers/${GOOGLE_ADS_CUSTOMER_ID}/conversionActions/${GOOGLE_ADS_LEAD_CONVERSION_ACTION_ID}`;
const GOOGLE_ADS_PURCHASE_ACTION = `customers/${GOOGLE_ADS_CUSTOMER_ID}/conversionActions/${GOOGLE_ADS_PURCHASE_CONVERSION_ACTION_ID}`;
// v17–v19 zwracają 404 (HTML); endpoint REST działa od v20+ (401 bez auth). Domyślnie v22.
const GOOGLE_ADS_API_VERSION = (
  process.env.GOOGLE_ADS_API_VERSION || "22"
).replace(/^v/i, "");
// Opcjonalnie: ID konta menedżerskiego (MCC) 10 cyfr – nagłówek login-customer-id (gdy SA ma dostęp tylko przez MCC)
const GOOGLE_ADS_LOGIN_CUSTOMER_ID = (
  process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || ""
).replace(/-/g, "");

// Service Account credentials (z pliku JSON)
const SERVICE_ACCOUNT_KEY = JSON.parse(process.env.SERVICE_ACCOUNT_KEY || "{}");

// ============================================
// SSOT EVENT NAMES (owocni-crm/EVENT_CONTRACT.md §5.2, ADR #14)
// ============================================
const SSOT_EVENT_ALIASES = {
  lead_won: "purchase",
  closed_won: "purchase",
  lead_rejected: "rejected_lead",
};

function normalizeSsoEventName(eventName) {
  if (!eventName) return eventName;
  const key = String(eventName).trim();
  const mapped = SSOT_EVENT_ALIASES[key];
  if (mapped && mapped !== key) {
    console.warn(`⚠️ SSOT normalize: legacy event_name "${key}" → "${mapped}"`);
    return mapped;
  }
  return key;
}

function normalizeTasksEventNames(tasks) {
  tasks.forEach((task) => {
    if (task.data && task.data.event_name) {
      task.data.event_name = normalizeSsoEventName(task.data.event_name);
    }
  });
}

// ============================================
// GŁÓWNA FUNKCJA (HTTP TRIGGER)
// ============================================
functions.http("processTaskQueue", async (req, res) => {
  console.log("🚀 Robot Task Monitor started v4");
  if (GA4_DEBUG_MODE) console.log("🔧 GA4: DEBUG_VIEW (debug_mode:1)");
  else if (GA4_DEBUG_VALIDATE)
    console.log("🔧 GA4: DEBUG_VALIDATE (tylko walidacja)");
  else console.log("✅ GA4: LIVE (/mp/collect, bez debug)");

  try {
    // KROK 0: Wyczyść stare "done" zadania (zwolnij miejsce w kolekcji - limit 100!)
    // WAŻNE: Stape Store API NIE wspiera filtrowania po stronie serwera,
    // więc musimy usuwać "done" zadania, aby zwolnić miejsce dla nowych
    const deletedCount = await deleteDoneTasks(50); // Usuń max 50 na raz
    if (deletedCount > 0) {
      console.log(
        `🧹 Cleaned up ${deletedCount} old "done" tasks from collection`,
      );
    }

    // KROK 1: Pricing Config — osobno prod i sandbox (osobne arkusze)
    const pricingConfigProd = await getPricingConfigFromSheets(GOOGLE_SHEET_ID);
    const pricingConfigSandbox = GOOGLE_SHEET_ID_SANDBOX
      ? await getPricingConfigFromSheets(GOOGLE_SHEET_ID_SANDBOX)
      : null;
    if (!GOOGLE_SHEET_ID_SANDBOX) {
      console.warn(
        "⚠️ GOOGLE_SHEET_ID_SANDBOX unset — taski sandbox nie trafią do arkusza (ochrona prod)",
      );
    }

    // KROK 2: Pobierz pending LUB monitored tasks z Stape Store
    let tasks = await fetchPendingTasks();
    normalizeTasksEventNames(tasks);
    console.log(
      `📥 Fetched ${tasks.length} tasks to process (pending OR monitored)`,
    );

    // DODATKOWE ZABEZPIECZENIE: Sprawdź statusy zadań przed przetworzeniem
    const statusCheck = tasks.map((task) => {
      const status = (task.data || {}).status || "unknown";
      const taskId = task.key || task.id || "unknown";
      return { taskId, status };
    });

    const doneTasks = statusCheck.filter(
      (t) => t.status === "done" || t.status === "processed_ga4",
    );
    if (doneTasks.length > 0) {
      console.error(
        `❌ CRITICAL: Found ${doneTasks.length} tasks with status "done" or "processed_ga4" in the processing queue!`,
      );
      console.error(`❌ Task IDs:`, doneTasks.map((t) => t.taskId).join(", "));
      console.error(`❌ This should not happen! Filtering them out...`);

      // Filtruj je jeszcze raz (na wszelki wypadek)
      const filteredTasks = tasks.filter((task) => {
        const status = (task.data || {}).status || "pending";
        return status !== "done" && status !== "processed_ga4";
      });

      console.log(
        `✅ After filtering: ${filteredTasks.length} tasks to process (removed ${doneTasks.length} done tasks)`,
      );

      if (filteredTasks.length === 0) {
        console.log("✅ No tasks to process after filtering - nothing to do");
        res.status(200).json({
          success: true,
          message: "No tasks to process (all were done)",
          processed: 0,
          filtered_out: doneTasks.length,
        });
        return;
      }

      // Użyj przefiltrowanych zadań
      tasks = filteredTasks;
    }

    if (tasks.length === 0) {
      console.log("✅ No tasks to process - nothing to do");
      res.status(200).json({
        success: true,
        message: "No tasks to process",
        processed: 0,
      });
      return;
    }

    // KROK 3: Append tasks to Google Sheets (monitoring) - tylko dla pending, bez crm:* (worker sGTM)
    const tasksForMonitoring = tasks.filter((task) => {
      const status = (task.data || {}).status;
      const jobType = String((task.data || {}).job_type || "");
      if (jobType.indexOf("crm:") === 0) return false;
      return status === "pending";
    });

    let appendedCount = 0;
    let monitoredCount = 0;

    if (tasksForMonitoring.length > 0) {
      appendedCount = await appendToGoogleSheets(tasksForMonitoring);
      console.log(`✅ Appended ${appendedCount} rows to Google Sheets`);

      monitoredCount = await updateTaskStatus(tasksForMonitoring, "monitored");
      console.log(`✅ Updated ${monitoredCount} tasks to "monitored" status`);
    } else {
      console.log(
        "ℹ️ No pending tasks - skipping monitoring (already monitored)",
      );
    }

    // KROK 4: NAJPIERW zmień status na "done" (aby uniknąć powielania przy następnym uruchomieniu)
    // WAŻNE: Zmieniamy status PRZED zapisem do arkuszy, aby jeśli zapis się nie powiedzie,
    // zadania nie były przetwarzane ponownie w nieskończoność

    // DODATKOWE ZABEZPIECZENIE: Sprawdź statusy PRZED zmianą
    const statusesBefore = tasks.map((task) => {
      const status = (task.data || {}).status || "unknown";
      const taskId = task.key || task.id || "unknown";
      return { taskId, status };
    });

    const alreadyDone = statusesBefore.filter(
      (t) => t.status === "done" || t.status === "processed_ga4",
    );
    if (alreadyDone.length > 0) {
      console.error(
        `❌ CRITICAL: ${alreadyDone.length} tasks are already "done" before status update!`,
      );
      console.error(
        `❌ Task IDs:`,
        alreadyDone.map((t) => t.taskId).join(", "),
      );
      console.error(
        `❌ This should not happen! These tasks should have been filtered out earlier.`,
      );

      // Filtruj je jeszcze raz
      tasks = tasks.filter((task) => {
        const status = (task.data || {}).status || "pending";
        return status !== "done" && status !== "processed_ga4";
      });

      if (tasks.length === 0) {
        console.log("✅ No tasks to process after filtering - nothing to do");
        res.status(200).json({
          success: true,
          message: "No tasks to process (all were already done)",
          processed: 0,
          filtered_out: alreadyDone.length,
        });
        return;
      }
    }

    console.log(
      `🔄 Changing status to "done" for ${tasks.length} tasks BEFORE writing to sheets...`,
    );
    const doneCount = await updateTaskStatus(tasks, "done");
    console.log(`✅ Updated ${doneCount} tasks to "done" status`);

    if (doneCount !== tasks.length) {
      console.error(
        `❌ CRITICAL ERROR: Only ${doneCount}/${tasks.length} tasks were updated to "done"!`,
      );
      console.error(
        `❌ ${tasks.length - doneCount} tasks were NOT updated and will be processed again!`,
      );
      console.error(
        `❌ This will cause duplication! Check updateTaskStatus function.`,
      );
    }

    // env-guard: sandbox taski → safe-sink (arkusze), bez prod Google/Meta/GA4 API
    const { prod: prodTasks, sandbox: sandboxTasks } =
      partitionTasksByEnvironment(tasks);
    logSandboxPlatformSkip(sandboxTasks.length);

    // KROK 5: GA4 Events (imitacja) — routing arkusza prod vs sandbox
    const ga4Events = tasks
      .map((task) =>
        withSheetId(
          task,
          prepareGA4Event(
            task,
            pricingConfigForTask(
              task,
              pricingConfigProd,
              pricingConfigSandbox,
            ),
          ),
        ),
      )
      .filter((event) => event !== null);

    const ga4Appended = await appendGA4EventsToSheets(ga4Events);
    console.log(
      `✅ Appended ${ga4Appended} GA4 events to GA4_Events sheet (debug)`,
    );

    // KROK 5b: Wyślij do GA4 Measurement Protocol (tylko prod)
    const ga4EventsProd = prodTasks
      .map((task) => prepareGA4Event(task, pricingConfigProd))
      .filter((event) => event !== null);
    const ga4MPSent = await sendToGA4MeasurementProtocol(ga4EventsProd);
    console.log(
      `✅ Sent ${ga4MPSent} GA4 events to Measurement Protocol (prod only)`,
    );

    // KROK 6: Meta Events (imitacja) — routing arkusza
    const metaEvents = tasks
      .map((task) =>
        withSheetId(
          task,
          prepareMetaEvent(
            task,
            pricingConfigForTask(
              task,
              pricingConfigProd,
              pricingConfigSandbox,
            ),
          ),
        ),
      )
      .filter((event) => event !== null);

    const metaAppended = await appendMetaEventsToSheets(metaEvents);
    console.log(`✅ Appended ${metaAppended} Meta events to Meta_Events sheet`);

    // KROK 7: Google Ads Events (imitacja) — routing arkusza
    const googleAdsEvents = tasks
      .map((task) =>
        withSheetId(
          task,
          prepareGoogleAdsEvent(
            task,
            pricingConfigForTask(
              task,
              pricingConfigProd,
              pricingConfigSandbox,
            ),
          ),
        ),
      )
      .filter((event) => event !== null);

    const googleAdsAppended =
      await appendGoogleAdsEventsToSheets(googleAdsEvents);
    console.log(
      `✅ Appended ${googleAdsAppended} Google Ads events to GoogleAds_Events sheet`,
    );

    // KROK 7b: Wyślij konwersje do Google Ads API (tylko prod)
    const googleAdsSent = await sendToGoogleAdsApi(
      prodTasks,
      pricingConfigProd,
    );
    console.log(`✅ Sent ${googleAdsSent} Google Ads conversions to API`);

    // Success response
    res.status(200).json({
      success: true,
      deleted: deletedCount,
      processed: tasks.length,
      appended: appendedCount,
      monitored: monitoredCount,
      ga4_events: ga4Appended,
      ga4_mp_sent: ga4MPSent,
      meta_events: metaAppended,
      googleads_events: googleAdsAppended,
      googleads_api_sent: googleAdsSent,
      done: doneCount,
    });
  } catch (error) {
    console.error("❌ Error processing tasks:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// HELPER: Fetch pending tasks z Stape Store
// ============================================
async function fetchPendingTasks() {
  const collectionUrl = `${STAPE_API_BASE}/${STAPE_API_KEY}/v2/store/collections/task_queue/documents`;

  console.log("🔍 Fetching tasks from:", collectionUrl);

  // PRÓBA 1: Filtrowanie po stronie serwera (jeśli API wspiera)
  // Jeśli API wspiera filtrowanie, limit 100 dotyczy tylko przefiltrowanych dokumentów
  const requestBody = {
    filter: {
      // Spróbuj filtrowania po status (jeśli API wspiera)
      // UWAGA: Jeśli to nie zadziała, API zwróci błąd i przejdziemy do PRÓBY 2
      "data.status": { $in: ["pending", "monitored"] },
    },
    pagination: {
      sort: [
        {
          field: "created_at",
          order: "asc",
        },
      ],
      limit: 100,
    },
  };

  console.log(
    "📤 Request body (with server-side filter):",
    JSON.stringify(requestBody),
  );

  const response = await fetch(collectionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  console.log("📡 Response status:", response.status);

  const responseText = await response.text();

  let data;
  let allItems = [];

  // Jeśli filtrowanie po stronie serwera zadziałało (status 200)
  if (response.ok) {
    try {
      data = JSON.parse(responseText);
      allItems = data?.data?.items || [];

      // UWAGA: Stape Store API zwraca 200 OK nawet jeśli filtr jest ignorowany!
      // Sprawdzimy statusy zadań poniżej i zfiltrujemy lokalnie.
      console.log(
        `⚠️ Server returned ${allItems.length} tasks (filter may be ignored - will check statuses locally)`,
      );
    } catch (e) {
      console.error("❌ Failed to parse JSON:", e.message);
      throw new Error("Invalid JSON response from Stape API");
    }
  } else {
    // PRÓBA 2: Filtrowanie po stronie serwera nie działa - użyj pustego filtra i filtruj lokalnie
    console.log(
      "⚠️ Server-side filter not supported, falling back to client-side filtering",
    );

    const fallbackRequestBody = {
      filter: {},
      pagination: {
        sort: [
          {
            field: "created_at",
            order: "asc",
          },
        ],
        limit: 100,
      },
    };

    const fallbackResponse = await fetch(collectionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fallbackRequestBody),
    });

    if (!fallbackResponse.ok) {
      console.error(
        "❌ Stape API error:",
        fallbackResponse.status,
        await fallbackResponse.text(),
      );
      throw new Error(`Stape API error: ${fallbackResponse.status}`);
    }

    const fallbackText = await fallbackResponse.text();
    try {
      data = JSON.parse(fallbackText);
      allItems = data?.data?.items || [];
    } catch (e) {
      console.error("❌ Failed to parse JSON:", e.message);
      throw new Error("Invalid JSON response from Stape API");
    }

    console.log(`📥 Total documents from API: ${allItems.length}`);
  }

  // WAŻNE: ZAWSZE filtruj lokalnie, niezależnie od tego czy filtrowanie po stronie serwera działa
  // API może zwrócić zadania ze statusem "done" jeśli filtrowanie nie działa poprawnie
  console.log(
    `🔍 Filtering ${allItems.length} tasks locally (checking status)...`,
  );

  // Filtruj lokalnie: pending LUB monitored (adaptery jeszcze nie przetworzyły)
  // WAŻNE: NIE pobieraj "done" zadań - te już zostały przetworzone!
  const tasksToProcess = allItems.filter((item) => {
    const taskData = item.data || {};
    const status = taskData.status || "pending";
    const taskId = item.key || item.id || "unknown";

    // Pobierz taski które NIE są jeszcze przetworzone przez adaptery
    const isPending = status === "pending";
    const isMonitored = status === "monitored"; // Monitoring done, ale adaptery nie
    const isDone = status === "done"; // JUŻ PRZETWORZONE - POMIŃ!
    const isProcessed = status === "processed_ga4"; // STARY STATUS - POMIŃ!

    if (isDone || isProcessed) {
      console.log(
        `  ⏭️ Skipping task ${taskId}: status="${status}" (already processed)`,
      );
      return false;
    }

    var jobType = String(taskData.job_type || "");
    if (jobType.indexOf("crm:") === 0) {
      console.log(
        `  ⏭️ Skipping task ${taskId}: job_type="${jobType}" (sGTM worker /crm/twenty_worker)`,
      );
      return false;
    }

    if (isPending || isMonitored) {
      console.log(`  ✅ Including task ${taskId}: status="${status}"`);
      return true;
    }

    // Nieznany status - pomiń
    console.log(
      `  ⚠️ Unknown status for task ${taskId}: "${status}" - skipping`,
    );
    return false;
  });

  // Statystyki statusów
  const statusCounts = {};
  allItems.forEach((item) => {
    const status = (item.data || {}).status || "unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log(`📊 Status breakdown:`, JSON.stringify(statusCounts));
  console.log(
    `✅ Tasks to process (pending OR monitored): ${tasksToProcess.length} (filtered from ${allItems.length} total)`,
  );

  // UWAGA: Jeśli mamy 100 dokumentów, ale tylko 10 to pending/monitored,
  // a reszta to "done", to limit 100 może być problemem.
  // W takim przypadku warto rozważyć usuwanie "done" zadań (opcjonalne).
  if (allItems.length >= 100 && tasksToProcess.length < allItems.length) {
    const doneCount = allItems.filter((item) => {
      const status = (item.data || {}).status || "pending";
      return status === "done" || status === "processed_ga4";
    }).length;
    console.warn(
      `⚠️ Collection at limit (${allItems.length}/100), but only ${tasksToProcess.length} tasks to process. ${doneCount} tasks are "done" and should be deleted.`,
    );
  }

  // Jeśli wszystkie zadania są "done", zwróć pustą listę
  if (tasksToProcess.length === 0 && allItems.length > 0) {
    console.log(
      `ℹ️ All ${allItems.length} tasks are already processed (status: done/processed_ga4). Nothing to do.`,
    );
  }

  return tasksToProcess;
}

// ============================================
// HELPER: Append tasks to Google Sheets (monitoring)
// ============================================
async function appendToGoogleSheets(tasks) {
  if (!SERVICE_ACCOUNT_KEY.client_email) {
    console.warn("⚠️ No Service Account credentials - skipping Google Sheets");
    return 0;
  }

  const bySheet = {};
  tasks.forEach((task) => {
    const sheetId = getSheetIdForTaskData(task.data || {});
    if (!sheetId) {
      console.warn(
        "⚠️ env-guard: pomijam monitoring Sheet1 — sandbox bez GOOGLE_SHEET_ID_SANDBOX",
      );
      return;
    }
    if (!bySheet[sheetId]) bySheet[sheetId] = [];
    bySheet[sheetId].push(task);
  });

  let totalRows = 0;
  for (const sheetId of Object.keys(bySheet)) {
    totalRows += await appendToGoogleSheetsForId(bySheet[sheetId], sheetId);
  }
  return totalRows;
}

async function appendToGoogleSheetsForId(tasks, spreadsheetId) {
  // Authorize with Service Account
  const auth = new google.auth.GoogleAuth({
    credentials: SERVICE_ACCOUNT_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Prepare rows for Google Sheets
  const rows = tasks.map((task) => {
    const taskData = task.data || {};
    return [
      new Date().toISOString(), // timestamp (A) - ISTNIEJĄCE
      taskData.id_oid || "", // (B) - ISTNIEJĄCE
      taskData.id_event || "", // (C) - ISTNIEJĄCE
      taskData.event_name || "", // (D) - ISTNIEJĄCE
      taskData.owner || "", // (E) - ISTNIEJĄCE
      taskData.order_id || "", // (F) - ISTNIEJĄCE
      taskData.biz_email || "", // (G) - ISTNIEJĄCE
      taskData.biz_phone || "", // (H) - ISTNIEJĄCE
      taskData.biz_pricing_key || taskData.biz_product || "", // (I) - ISTNIEJĄCE
      taskData.biz_value || "", // (J) - ISTNIEJĄCE
      taskData.status || "", // (K) - ISTNIEJĄCE
      taskData.attr_gclid || "", // (L) - ISTNIEJĄCE
      taskData.ctx_page_url || "", // (M) - ISTNIEJĄCE
      // ✅ NOWE KOLUMNY (dodane na końcu, bez zmiany istniejących):
      taskData.biz_name || "", // (N) ✅ NOWE: biz_name
      taskData.biz_product || "", // (O) ✅ NOWE: biz_product
      taskData.ga_client_id || taskData.client_id || "", // (P) ✅ NOWE: ga_client_id
      taskData.src_system || "", // (Q) ✅ NOWE: src_system
      taskData.src_action_source || "", // (R) ✅ NOWE: src_action_source
      taskData.consent_analytics_storage || "", // (S) ✅ NOWE: consent_analytics_storage
      taskData.consent_ad_storage || "", // (T) ✅ NOWE: consent_ad_storage
      taskData.created_at || "", // (U) ✅ NOWE: created_at
      taskData.job_type || "", // (V) ✅ NOWE: job_type
      taskData.attr_fbc || "", // (W) ✅ NOWE: attr_fbc (Meta Click ID)
      taskData.attr_gbraid || "", // (X) ✅ NOWE: attr_gbraid (Google Braid)
      taskData.attr_wbraid || "", // (Y) ✅ NOWE: attr_wbraid (Google Wbraid)
      // ✅ Kolumny jak w mailu: IP, czas na stronie, treść wiadomości
      taskData.ctx_ip_address || "", // (Z) IP
      taskData.ctx_time_on_page_ms || "", // (AA) Czas na stronie (ms)
      taskData.biz_message || "", // (AB) Treść wiadomości
    ];
  });

  // Append to sheet (prod lub sandbox)
  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: "Sheet1!A:AB", // ✅ Z: A:Y → A:AB (dodano Z: ctx_ip_address, AA: ctx_time_on_page_ms, AB: biz_message)
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows,
      },
    });

    const updated = response.data.updates.updatedRows || 0;
    console.log(
      `✅ Appended ${updated} rows to Sheet1 (spreadsheet …${String(spreadsheetId).slice(-8)})`,
    );
    return updated;
  } catch (error) {
    console.error("❌ Error appending to monitoring sheet:", error.message);
    throw error;
  }
}

// ============================================
// HELPER: Delete processed tasks (done status) from Stape Store
// ============================================
async function deleteDoneTasks(maxDelete = 50) {
  const collectionUrl = `${STAPE_API_BASE}/${STAPE_API_KEY}/v2/store/collections/task_queue/documents`;

  console.log(`🧹 Cleaning up "done" tasks (max ${maxDelete})...`);

  const requestBody = {
    filter: {},
    pagination: {
      sort: [{ field: "created_at", order: "asc" }],
      limit: 100,
    },
  };

  const response = await fetch(collectionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    console.warn(`⚠️ Failed to fetch tasks for cleanup: ${response.status}`);
    return 0;
  }

  const data = await response.json();
  const allTasks = data?.data?.items || [];

  // Znajdź zadania ze statusem "done"
  const doneTasks = allTasks
    .filter((task) => {
      const taskData = task.data || {};
      const status = taskData.status || "";
      return status === "done" || status === "processed_ga4";
    })
    .slice(0, maxDelete); // Ogranicz do maxDelete, aby nie usunąć zbyt dużo na raz

  if (doneTasks.length === 0) {
    console.log('✅ No "done" tasks to delete');
    return 0;
  }

  console.log(
    `🗑️ Found ${doneTasks.length} "done" tasks to delete (out of ${allTasks.length} total)`,
  );

  let deletedCount = 0;
  let failedCount = 0;

  for (const task of doneTasks) {
    const documentId = task.key || task.id;

    if (!documentId) {
      console.warn(`⚠️ Task has no key/id, skipping deletion`);
      failedCount++;
      continue;
    }

    const deleteUrl = `${STAPE_API_BASE}/${STAPE_API_KEY}/v2/store/collections/task_queue/documents/${encodeURIComponent(documentId)}`;

    try {
      const deleteResponse = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (deleteResponse.ok) {
        deletedCount++;
      } else {
        const errorText = await deleteResponse.text();
        console.warn(
          `⚠️ Failed to delete task ${documentId}: ${deleteResponse.status} - ${errorText}`,
        );
        failedCount++;
      }
    } catch (error) {
      console.error(`❌ Error deleting task ${documentId}:`, error.message);
      failedCount++;
    }
  }

  console.log(
    `✅ Deleted ${deletedCount} "done" tasks (${failedCount} failed)`,
  );
  return deletedCount;
}

// ============================================
// HELPER: Update task status in Stape Store
// ============================================
async function updateTaskStatus(tasks, newStatus = "monitored") {
  let updatedCount = 0;
  let failedCount = 0;

  console.log(`🔄 Updating ${tasks.length} tasks to status "${newStatus}"...`);

  for (const task of tasks) {
    // Stape Store API może używać 'key' lub 'id' - sprawdź oba
    const documentId = task.key || task.id;

    if (!documentId) {
      console.error(`❌ Task has no key/id:`, JSON.stringify(task));
      failedCount++;
      continue;
    }

    const taskData = task.data || {};
    const currentStatus = taskData.status || "unknown";

    // Loguj zmianę statusu
    if (currentStatus !== newStatus) {
      console.log(`  📝 Task ${documentId}: ${currentStatus} → ${newStatus}`);
    } else {
      console.log(`  ℹ️ Task ${documentId}: already ${newStatus}, skipping`);
      updatedCount++;
      continue;
    }

    const updatedData = {
      ...taskData,
      status: newStatus, // ← Parametr do zmiany statusu
      [`${newStatus}_at`]: new Date().toISOString(), // Timestamp
    };

    const updateUrl = `${STAPE_API_BASE}/${STAPE_API_KEY}/v2/store/collections/task_queue/documents/${encodeURIComponent(documentId)}`;

    try {
      const response = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedData),
      });

      if (response.ok) {
        updatedCount++;
      } else {
        const errorText = await response.text();
        console.warn(
          `⚠️ Failed to update task ${documentId}: ${response.status} - ${errorText}`,
        );
        failedCount++;
      }
    } catch (error) {
      console.error(`❌ Error updating task ${documentId}:`, error.message);
      failedCount++;
    }
  }

  console.log(
    `✅ Updated ${updatedCount}/${tasks.length} tasks to "${newStatus}" (${failedCount} failed)`,
  );

  return updatedCount;
}

// ============================================
// HELPER: Pobierz Pricing Config z Google Sheets
// ============================================
async function getPricingConfigFromSheets(spreadsheetId) {
  if (!SERVICE_ACCOUNT_KEY.client_email) {
    console.warn("⚠️ No Service Account - using fallback pricing");
    return null;
  }
  if (!spreadsheetId) {
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: SERVICE_ACCOUNT_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    // Pobierz całą kartę Pricing_Config
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: "Pricing_Config!A2:D100", // Wiersze 2-100 (pomijamy nagłówki)
    });

    const rows = response.data.values || [];

    // Zbuduj mapę: pricing_key → {google_ads, meta, ga4}
    const pricingMap = {};

    for (const row of rows) {
      if (row.length < 4) continue; // Skip niepełne wiersze

      const key = (row[0] || "").trim();
      const googleAds = parseFloat(row[1]) || 0;
      const meta = parseFloat(row[2]) || 0;
      const ga4 = parseFloat(row[3]) || 0;

      if (key) {
        pricingMap[key] = {
          google_ads: googleAds,
          meta: meta,
          ga4: ga4,
        };
      }
    }

    console.log(
      `📊 Loaded ${Object.keys(pricingMap).length} pricing keys from Sheets (…${String(spreadsheetId).slice(-8)})`,
    );
    return pricingMap;
  } catch (error) {
    console.error("❌ Error loading pricing config:", error.message);
    return null;
  }
}

// ============================================
// HELPER: Mapowanie wartości z Pricing Key Config
// ============================================
function getPricingValue(pricingKey, platform, pricingConfig) {
  if (!pricingKey || !pricingConfig) {
    return null;
  }

  // Spróbuj najpierw dokładnego match
  let keyConfig = pricingConfig[pricingKey];

  // Jeśli nie znaleziono i ma prefiks, spróbuj bez prefiksu (fallback)
  if (!keyConfig && pricingKey.includes("_")) {
    const parts = pricingKey.split("_");
    const withoutPrefix = parts.slice(1).join("\_");
    keyConfig = pricingConfig[withoutPrefix];

    if (keyConfig) {
      console.log(
        `🔧 Found pricing for "${withoutPrefix}" (without prefix from "${pricingKey}")`,
      );
    }
  }

  // Jeśli nadal nie znaleziono, spróbuj "Other"
  if (!keyConfig) {
    keyConfig = pricingConfig["Other"];
    if (keyConfig) {
      console.log(`🔧 Using fallback "Other" for key "${pricingKey}"`);
    }
  }

  if (!keyConfig) {
    console.warn(`⚠️ No pricing mapping for key: "${pricingKey}"`);
    return null;
  }

  const value = keyConfig[platform] || null;
  console.log(
    `💰 getPricingValue: "${pricingKey}" → ${value} (platform: ${platform})`,
  );

  return value;
}

// ============================================
// HELPER: Określ domenę GA4 z ctx_page_url (do mapowania na właściwe GA4)
// ============================================
function getGA4KeyFromPageUrl(ctxPageUrl) {
  if (!ctxPageUrl || typeof ctxPageUrl !== "string") return "owocni";
  try {
    const u = new URL(ctxPageUrl);
    const host = (u.hostname || "").toLowerCase();
    if (host.includes("copywriting.pl")) return "copywriting";
    if (host.includes("logofirmowe.pl")) return "logofirmowe";
    // owocni.pl, cennik.owocni.pl, strony.owocni.pl, form.owocni.pl itd.
    if (host.includes("owocni")) return "owocni";
  } catch (_) {}
  return "owocni";
}

// ============================================
// HELPER: Przygotuj dane GA4 MP
// ============================================
function prepareGA4Event(task, pricingConfig) {
  const taskData = task.data || {};
  const eventName = taskData.event_name;

  console.log(
    `🔍 Preparing GA4 event for: ${eventName}, task key: ${task.key}`,
  );
  console.log(`🔍 biz_product:`, taskData.biz_product);
  console.log(`🔍 biz_pricing_key:`, taskData.biz_pricing_key);

  // ✅ CONSENT GATE: Sprawdź consent_analytics_storage
  const consentAnalytics = taskData.consent_analytics_storage;
  if (consentAnalytics === "denied") {
    console.log(
      `⏭️ SKIP GA4: consent_analytics_storage = denied for ${eventName}`,
    );
    return null; // Funkcja już zwraca null dla skipped events
  }

  // Opcja wdrożeniowa: generate_lead → GA4 tylko z Web GTM (bez dublowania MP + arkusza GA4 z robota).
  // Sortownia nadal tworzy task (Google Ads, arkusze, Meta); tutaj pomijamy wyłącznie GA4.
  if (eventName === "generate_lead") {
    console.log(
      `⏭️ SKIP GA4 (MP + arkusz GA4_Events): generate_lead — źródło GA4 = Web GTM`,
    );
    return null;
  }

  // Mapowanie event_name → GA4 event
  const ga4EventMap = {
    generate_lead: "lead",
    qualify_lead: "qualify_lead",
    purchase: "purchase",
    rejected_lead: "lead_rejected",
  };

  const ga4EventName = ga4EventMap[eventName] || eventName;

  // Pobierz wartość (z Pricing Key lub biz_value)
  let value = null;
  let currency = taskData.biz_currency || "PLN";

  if (eventName === "purchase") {
    // purchase używa rzeczywistej wartości (biz_value)
    value = taskData.biz_value || null;
    console.log(`💰 purchase value: ${value} (from biz_value)`);
  } else {
    // Inne eventy używają Pricing Key
    let pricingKey = taskData.biz_pricing_key;

    // Mapowanie event_name → prefix
    const prefixMap = {
      generate_lead: "lead",
      qualify_lead: "sql",
      rejected_lead: "rejected",
    };

    const prefix = prefixMap[eventName] || "lead";

    // Jeśli pricing_key już ma prefiks (np. "lead_strony"), użyj go
    // Jeśli NIE MA prefiksu (np. "strony"), dodaj prefiks
    if (pricingKey) {
      // Sprawdź czy już ma prefiks
      const hasPrefix =
        pricingKey.startsWith("lead_") ||
        pricingKey.startsWith("sql_") ||
        pricingKey.startsWith("rejected_");

      if (!hasPrefix) {
        // Brak prefiksu - dodaj go
        pricingKey = `${prefix}_${pricingKey}`;
        console.log(
          `🔧 Added prefix: "${pricingKey}" (was: "${taskData.biz_pricing_key}")`,
        );
      } else {
        console.log(`✅ Pricing key already has prefix: "${pricingKey}"`);
      }
    } else if (taskData.biz_product) {
      // Brak pricing_key - zbuduj z biz_product
      pricingKey = `${prefix}_${taskData.biz_product}`;
      console.log(
        `🔧 Built pricing_key: "${pricingKey}" from event="${eventName}" + product="${taskData.biz_product}"`,
      );
    }

    console.log(`🔑 Final pricing key: "${pricingKey}" for event ${eventName}`);

    if (pricingKey && pricingConfig) {
      value = getPricingValue(pricingKey, "ga4", pricingConfig);
      console.log(`💰 Mapped value: ${value} for key "${pricingKey}"`);

      // Fallback: jeśli null, spróbuj "Other"
      if (value === null) {
        console.log(`⚠️ No value for "${pricingKey}", trying fallback "Other"`);
        value = getPricingValue("Other", "ga4", pricingConfig);
        if (value !== null) {
          console.log(`✅ Using fallback value: ${value}`);
        }
      }
    } else {
      console.warn(
        `⚠️ No pricing_key (${pricingKey}) or config for event ${eventName}`,
      );
    }
  }

  // Przygotuj event params
  const eventParams = {
    event_category: "conversion",
    event_label: taskData.biz_pricing_key || taskData.biz_product || "",
    owner: taskData.owner || "",
    order_id: taskData.order_id || "",
  };

  // ✅ POPRAWKA: Dodaj timestamp_micros (Unix timestamp w mikrosekundach) dla lepszej jakości
  const timestampMicros =
    new Date(
      taskData.time_occurred_iso_utc || new Date().toISOString(),
    ).getTime() * 1000;

  // Określ domenę → GA4 (copywriting / owocni / logofirmowe)
  const ga4Key = getGA4KeyFromPageUrl(taskData.ctx_page_url);

  return {
    timestamp: new Date().toISOString(),
    event_name: ga4EventName,
    client_id: taskData.ga_client_id || taskData.client_id || "",
    user_id: taskData.id_oid || "",
    value: value,
    currency: currency,
    event_params: JSON.stringify(eventParams),
    timestamp_micros: timestampMicros.toString(), // ✅ NOWA KOLUMNA: Unix timestamp w mikrosekundach
    ga4_key: ga4Key, // copywriting | owocni | logofirmowe - do wysyłki do właściwego GA4
  };
}

async function appendSheetRows(spreadsheetId, range, valueInputOption, rows) {
  const auth = new google.auth.GoogleAuth({
    credentials: SERVICE_ACCOUNT_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption,
    requestBody: { values: rows },
  });
  return response.data.updates.updatedRows || 0;
}

function groupEventsBySheetId(events) {
  const bySheet = {};
  events.forEach((event) => {
    if (!event || !event._sheetId) return;
    if (!bySheet[event._sheetId]) bySheet[event._sheetId] = [];
    bySheet[event._sheetId].push(event);
  });
  return bySheet;
}

async function appendGA4EventsToSheets(ga4Events) {
  if (!SERVICE_ACCOUNT_KEY.client_email) {
    return 0;
  }

  const validEvents = ga4Events.filter((event) => event !== null);

  if (validEvents.length === 0) {
    console.log("ℹ️ No valid GA4 events to append");
    return 0;
  }

  const bySheet = groupEventsBySheetId(validEvents);
  let total = 0;

  for (const spreadsheetId of Object.keys(bySheet)) {
    const sheetEvents = bySheet[spreadsheetId];
    const rows = sheetEvents.map((event, index) => {
      let valueStr = "";
      if (event.value !== null && event.value !== undefined) {
        const numValue = parseFloat(event.value);
        if (!isNaN(numValue)) {
          valueStr = numValue.toString();
        }
      }

      const row = [
        event.timestamp || "",
        event.event_name || "",
        event.client_id || "",
        event.user_id || "",
        valueStr,
        event.currency || "PLN",
        event.event_params || "{}",
        event.timestamp_micros || "",
      ];

      if (index < 3) {
        console.log(`📤 GA4 row ${index} → …${String(spreadsheetId).slice(-8)}`);
      }

      return row;
    });

    try {
      const n = await appendSheetRows(
        spreadsheetId,
        "GA4_Events!A:H",
        "RAW",
        rows,
      );
      total += n;
      console.log(
        `✅ Appended ${n} GA4 events (spreadsheet …${String(spreadsheetId).slice(-8)})`,
      );
    } catch (error) {
      console.error(
        `❌ Error appending GA4 to …${String(spreadsheetId).slice(-8)}:`,
        error.message,
      );
      throw error;
    }
  }

  return total;
}

// ============================================
// HELPER: Wyślij eventy do GA4 Measurement Protocol
// ============================================
async function sendToGA4MeasurementProtocol(ga4Events) {
  const validEvents = ga4Events.filter((e) => e !== null);
  if (validEvents.length === 0) return 0;

  let sent = 0;
  for (const event of validEvents) {
    const ga4Key = event.ga4_key || "owocni";
    const config = GA4_CONFIG[ga4Key];
    if (!config || !config.measurementId || !config.apiSecret) {
      console.log(
        `⏭️ SKIP GA4 MP dla ${ga4Key}: brak GA4_${ga4Key.toUpperCase()}_MEASUREMENT_ID lub API_SECRET`,
      );
      continue;
    }

    const baseUrl = GA4_DEBUG_VALIDATE
      ? "https://www.google-analytics.com/debug/mp/collect"
      : "https://www.google-analytics.com/mp/collect";
    const url = `${baseUrl}?measurement_id=${encodeURIComponent(config.measurementId)}&api_secret=${encodeURIComponent(config.apiSecret)}`;
    const clientId = event.client_id || event.user_id || "";
    if (!clientId) {
      console.warn(
        `⚠️ GA4 MP: pomijam event ${event.event_name} - brak client_id i user_id`,
      );
      continue;
    }
    // ✅ Asercja diagnostyczna: gdy brak prawdziwego ga_client_id (cookie _ga z Web GTM),
    // robot wpada w fallback `client_id = user_id = id_oid`. Skutek: GA4 widzi to jako innego
    // użytkownika niż `generate_lead` z Web GTM (które idzie z prawdziwym _ga), więc lejek
    // SQL/Lead Won → generate_lead się nie skleja. Najczęstsza przyczyna: Sortownia nie
    // wzbogaciła taska o `ga_client_id` z profilu w `identity_map` (zwłaszcza dla zdarzeń CRM).
    if (!event.client_id && event.user_id) {
      console.warn(
        `⚠️ GA4 MP [${ga4Key}]: ${event.event_name} (user_id=${String(event.user_id).slice(0, 12)}...) — brak ga_client_id, fallback client_id=user_id (id_oid). Lejek w GA4 może się NIE skleić z generate_lead z Web GTM. Sprawdź: Sortownia → identity_map → task_queue.ga_client_id.`,
      );
    }

    // Mapowanie nazwy eventu na standard GA4 (np. lead → generate_lead)
    const mpEventNameMap = {
      lead: "generate_lead",
      generate_lead: "generate_lead",
      qualify_lead: "qualify_lead",
      purchase: "purchase",
      rejected_lead: "lead_rejected",
    };
    const mpEventName = mpEventNameMap[event.event_name] || event.event_name;

    const params = { engagement_time_msec: 100 };
    if (GA4_DEBUG_MODE) params.debug_mode = 1;
    if (event.timestamp_micros)
      params.timestamp_micros = event.timestamp_micros;
    if (event.value != null && event.value !== "") {
      params.value = parseFloat(event.value);
      params.currency = event.currency || "PLN";
    }
    if (event.event_params) {
      try {
        const parsed = JSON.parse(event.event_params);
        if (parsed.order_id) params.transaction_id = parsed.order_id;
        Object.assign(params, parsed);
      } catch (_) {}
    }

    const payload = {
      client_id: clientId,
      user_id: event.user_id || undefined,
      events: [
        {
          name: mpEventName,
          params: params,
        },
      ],
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseText = await res.text();
      if (res.ok) {
        if (GA4_DEBUG_VALIDATE) {
          try {
            const debugBody = JSON.parse(responseText);
            const msgs = debugBody.validationMessages || [];
            if (msgs.length > 0) {
              console.error(
                `⚠️ GA4 MP [${ga4Key}] validation_messages dla ${mpEventName}:`,
                JSON.stringify(msgs, null, 2),
              );
            } else {
              console.log(
                `✅ GA4 MP [${ga4Key}] DEBUG VALIDATE: payload OK dla ${mpEventName} (nie wysyłamy – tylko walidacja)`,
              );
            }
          } catch (_) {
            console.log(
              `✅ GA4 MP [${ga4Key}] DEBUG VALIDATE: odpowiedź dla ${mpEventName}`,
            );
          }
        } else {
          sent++;
          console.log(
            `✅ GA4 MP [${ga4Key}]: wysłano ${mpEventName} (client_id: ${clientId.slice(0, 12)}...)${GA4_DEBUG_MODE ? " [DEBUG_VIEW]" : ""}`,
          );
        }
      } else {
        console.error(
          `❌ GA4 MP: błąd ${res.status} dla ${mpEventName}`,
          responseText,
        );
      }
    } catch (err) {
      console.error(
        `❌ GA4 MP: fetch error dla ${event.event_name}:`,
        err.message,
      );
    }
  }

  return sent;
}

// ============================================
// HELPER: Przygotuj dane Meta CAPI
// ============================================
function prepareMetaEvent(task, pricingConfig) {
  const taskData = task.data || {};
  const eventName = taskData.event_name;

  // ✅ FILTR: Meta_Events TYLKO dla platform meta_ads (zgodnie z SSOT2)
  const owner = taskData.owner || "";
  const assist = taskData.assist || "";
  const isMetaRelevant =
    owner === "platform:meta_ads" || assist === "platform:meta_ads";
  if (!isMetaRelevant) {
    console.log(
      `⏭️ SKIP Meta_Events: owner="${owner}", assist="${assist}" (not platform:meta_ads) for ${eventName}`,
    );
    return null;
  }

  // ✅ DEBUG: Sprawdź ctx_ip_address w taskData
  console.log(
    `🔍 DEBUG Meta: taskData.ctx_ip_address =`,
    taskData.ctx_ip_address,
  );
  console.log(
    `🔍 DEBUG Meta: taskData.ctx_user_agent =`,
    taskData.ctx_user_agent,
  );

  // ✅ CONSENT GATE: Sprawdź consent_ad_storage
  const consentAd = taskData.consent_ad_storage;
  if (consentAd === "denied") {
    console.log(`⏭️ SKIP Meta: consent_ad_storage = denied for ${eventName}`);
    return null; // Funkcja już zwraca null dla skipped events
  }

  // Mapowanie event_name → Meta event
  const metaEventMap = {
    generate_lead: "Lead",
    qualify_lead: "QualifiedLead",
    purchase: "Purchase",
    rejected_lead: "rejected",
  };

  const metaEventName = metaEventMap[eventName] || eventName;

  // Pobierz wartość (z Pricing Key lub biz_value)
  let value = null;
  let currency = taskData.biz_currency || "PLN";

  if (eventName === "purchase") {
    value = taskData.biz_value || null;
  } else {
    let pricingKey = taskData.biz_pricing_key;

    const prefixMap = {
      generate_lead: "lead",
      qualify_lead: "sql",
      rejected_lead: "rejected",
    };

    const prefix = prefixMap[eventName] || "lead";

    if (pricingKey) {
      const hasPrefix =
        pricingKey.startsWith("lead_") ||
        pricingKey.startsWith("sql_") ||
        pricingKey.startsWith("rejected_");

      if (!hasPrefix) {
        pricingKey = `${prefix}_${pricingKey}`;
      }
    } else if (taskData.biz_product) {
      pricingKey = `${prefix}_${taskData.biz_product}`;
    }

    if (pricingKey && pricingConfig) {
      value = getPricingValue(pricingKey, "meta", pricingConfig);

      // Fallback: jeśli null, spróbuj "Other"
      if (value === null) {
        value = getPricingValue("Other", "meta", pricingConfig);
      }
    }
  }

  // ✅ POPRAWKA: Przygotuj user_data z haszowaniem PII (SHA-256)
  const userData = {};
  if (taskData.biz_email) {
    // Haszuj email (lowercase, trim przed haszowaniem)
    const emailNorm = taskData.biz_email.toLowerCase().trim();
    userData.em = sha256HexLower(emailNorm);
  }
  if (taskData.biz_phone) {
    // Phone już jest w E.164 format (+48123456789), haszujemy bezpośrednio
    userData.ph = sha256HexLower(taskData.biz_phone);
  }
  if (taskData.id_oid) {
    userData.external_id = taskData.id_oid;
  }

  // ✅ POPRAWKA: Format daty - Meta wymaga Unix timestamp w SEKUNDACH (nie mikrosekundach)
  const eventTime = Math.floor(
    new Date(
      taskData.time_occurred_iso_utc || new Date().toISOString(),
    ).getTime() / 1000,
  );

  // event*id = id_event lub id_oid + timestamp
  const eventId = taskData.id_event || `${taskData.id_oid}*${Date.now()}`;

  // ✅ POPRAWKA: Dodaj client_user_agent (WYMAGANE) i client_ip_address (ZALECANE)
  const metaEvent = {
    timestamp: new Date().toISOString(), // Dla arkusza monitoringowego
    event_time: eventTime, // Dla Meta API (Unix timestamp w sekundach)
    event_name: metaEventName,
    event_id: eventId,
    fbc: taskData.attr_fbc || "",
    fbp: taskData.attr_fbp || "",
    value: value,
    currency: currency,
    user_data: JSON.stringify(userData),
  };

  // ✅ POPRAWKA: client_user_agent (WYMAGANE dla Meta CAPI)
  if (taskData.ctx_user_agent) {
    metaEvent.client_user_agent = taskData.ctx_user_agent;
  } else {
    console.warn(
      `⚠️ Missing ctx_user_agent for Meta CAPI event ${metaEventName} - event quality may be reduced`,
    );
  }

  // ✅ POPRAWKA: client_ip_address (ZALECANE dla Meta CAPI) - plain text, nie hashowane
  if (taskData.ctx_ip_address) {
    metaEvent.client_ip_address = taskData.ctx_ip_address;
    console.log(
      `✅ Meta: Added client_ip_address = ${taskData.ctx_ip_address}`,
    );
  } else {
    console.warn(
      `⚠️ Meta: Missing ctx_ip_address in taskData for event ${metaEventName}`,
    );
  }

  return metaEvent;
}

// ============================================
// HELPER: Zapisz Meta events do Google Sheets
// ============================================
async function appendMetaEventsToSheets(metaEvents) {
  if (!SERVICE_ACCOUNT_KEY.client_email) {
    return 0;
  }

  const validEvents = metaEvents.filter((event) => event !== null);

  if (validEvents.length === 0) {
    return 0;
  }

  const bySheet = groupEventsBySheetId(validEvents);
  let total = 0;

  for (const spreadsheetId of Object.keys(bySheet)) {
    const rows = bySheet[spreadsheetId].map((event) => {
      let valueStr = "";
      if (event.value !== null && event.value !== undefined) {
        const numValue = parseFloat(event.value);
        if (!isNaN(numValue)) {
          valueStr = numValue.toString();
        }
      }

      return [
        event.timestamp || "",
        event.event_name || "",
        event.event_id || "",
        event.fbc || "",
        event.fbp || "",
        valueStr,
        event.currency || "PLN",
        event.user_data || "{}",
        event.client_user_agent || "",
        event.client_ip_address || "",
        event.event_time || "",
      ];
    });

    try {
      const n = await appendSheetRows(
        spreadsheetId,
        "Meta_Events!A:K",
        "RAW",
        rows,
      );
      total += n;
      console.log(
        `✅ Appended ${n} Meta events (spreadsheet …${String(spreadsheetId).slice(-8)})`,
      );
    } catch (error) {
      console.error("❌ Error appending Meta events:", error.message);
      throw error;
    }
  }

  return total;
}

// ============================================
// GOOGLE ADS ADAPTER - Helpers (zgodnie z ADAPTER_GOOGLE.md)
// ============================================

// Validation & formatting
function assertConversionActionResourceName(resourceName) {
  const ok =
    typeof resourceName === "string" &&
    resourceName.startsWith("customers/") &&
    resourceName.includes("/conversionActions/");

  if (!ok) {
    throw new Error(
      `Bad conversionActionResourceName (expected "customers/{cid}/conversionActions/{id}"): ${resourceName}`,
    );
  }
}

function isoToGoogleAdsDateTime(iso) {
  // Google Ads API expects: "YYYY-MM-DD HH:MM:SS+00:00"
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) {
    throw new Error(`Bad ISO datetime: ${iso}`);
  }
  const z = d.toISOString(); // "2025-11-01T10:30:01.123Z"
  const base = z.slice(0, 19).replace("T", " "); // "2025-11-01 10:30:01"
  return `${base}+00:00`;
}

function sha256HexLower(input) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function isValidSha256HexLower(x) {
  return /^[0-9a-f]{64}$/.test(x);
}

// Gmail rules + normalization
function normalizeEmailForGoogle(raw) {
  if (!raw) return null;

  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, "");
  const at = cleaned.lastIndexOf("@");
  if (at <= 0 || at === cleaned.length - 1) return null;

  let localPart = cleaned.slice(0, at);
  const domain = cleaned.slice(at + 1);

  // Gmail rules
  if (domain === "gmail.com" || domain === "googlemail.com") {
    localPart = localPart.replace(/\./g, "");
    localPart = localPart.split("+")[0];
    // Ujednolicenie domeny
    const normalized = `${localPart}@gmail.com`;
    // minimalna walidacja
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
    return normalized;
  }

  const normalized = `${localPart}@${domain}`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

function normalizePhoneToE164(raw, defaultCountry = "PL") {
  if (!raw) return null;

  let s = raw.trim();

  // zachowujemy plus jeśli był, reszta digits-only
  const hadPlus = s.startsWith("+");
  s = s.replace(/[^\d+]/g, "");
  if (s.startsWith("00")) {
    s = "+" + s.slice(2);
  } else if (!hadPlus && !s.startsWith("+")) {
    // digits-only
  }

  let digits = s.startsWith("+") ? s.slice(1) : s;

  // jeśli PL i 9 cyfr -> dodaj 48
  if (defaultCountry === "PL" && digits.length === 9) {
    digits = "48" + digits;
  }

  // ostatecznie E.164: + oraz 10-15 cyfr
  if (!/^\d{10,15}$/.test(digits)) return null;
  return `+${digits}`;
}

function buildUserIdentifiers(job) {
  const userIdentifiers = [];
  const noteParts = [];

  // EMAIL
  // ✅ POPRAWKA: job.biz_email już jest znormalizowany z Sortowni (z Gmail rules)
  // Nie robimy podwójnej normalizacji - używamy bezpośrednio
  const emailNorm = job.biz_email || null;

  if (emailNorm) {
    const hash = sha256HexLower(emailNorm);
    userIdentifiers.push({
      hashedEmail: hash,
      userIdentifierSource: "FIRST_PARTY",
    });
  } else if (
    job.hash_email_sha256 &&
    isValidSha256HexLower(job.hash_email_sha256)
  ) {
    userIdentifiers.push({
      hashedEmail: job.hash_email_sha256,
      userIdentifierSource: "FIRST_PARTY",
    });
    noteParts.push(
      "Email hash used from contract (raw email missing/invalid).",
    );
  } else if (job.biz_email) {
    noteParts.push(
      "Invalid email format after normalization; sending without email EC.",
    );
  }

  // PHONE
  // ✅ POPRAWKA: job.biz_phone już jest znormalizowany z Sortowni (E.164 format z +)
  // Sprawdzamy czy ma format E.164, jeśli nie - próbujemy znormalizować (fallback)
  var phoneE164 = null;
  if (job.biz_phone) {
    // Jeśli już ma + i 10-15 cyfr, użyj bezpośrednio
    if (
      job.biz_phone.indexOf("+") === 0 &&
      /^\+?\d{10,15}$/.test(job.biz_phone.replace("+", ""))
    ) {
      phoneE164 = job.biz_phone;
    } else {
      // Fallback: próbuj znormalizować (dla kompatybilności wstecznej)
      phoneE164 = normalizePhoneToE164(job.biz_phone, "PL");
    }
  }

  if (phoneE164) {
    const hash = sha256HexLower(phoneE164);
    userIdentifiers.push({
      hashedPhoneNumber: hash,
      userIdentifierSource: "FIRST_PARTY",
    });
  } else if (
    job.hash_phone_sha256 &&
    isValidSha256HexLower(job.hash_phone_sha256)
  ) {
    userIdentifiers.push({
      hashedPhoneNumber: job.hash_phone_sha256,
      userIdentifierSource: "FIRST_PARTY",
    });
    noteParts.push(
      "Phone hash used from contract (raw phone missing/invalid).",
    );
  } else if (job.biz_phone) {
    noteParts.push(
      "Invalid phone format after normalization; sending without phone EC.",
    );
  }

  if (userIdentifiers.length === 0) {
    return {
      note:
        noteParts.join(" ") ||
        "No valid PII for Enhanced Conversions; sending without EC.",
    };
  }
  return { userIdentifiers, note: noteParts.join(" ") };
}

function safeRestateValue(v) {
  // safety floor 0.01 (żeby uniknąć RETRACT/0)
  if (!Number.isFinite(v) || v <= 0) return 0.01;
  return v;
}

function daysBetween(aIso, bIso) {
  const a = new Date(aIso);
  const b = new Date(bIso);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()))
    return null;
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ============================================
// GOOGLE ADS ADAPTER - Payload builders (zgodnie z ADAPTER_GOOGLE.md)
// ============================================

function buildNewLeadClickConversion(cfg, job) {
  assertConversionActionResourceName(cfg.conversionActionResourceName);

  if (!job.order_id || job.order_id.trim() === "") {
    return {
      status: "failed_final",
      note: "CRITICAL: Missing order_id in NEW LEAD. RESTATE will be impossible and pipeline is broken.",
    };
  }

  const payload = {
    conversionAction: cfg.conversionActionResourceName,
    conversionDateTime: isoToGoogleAdsDateTime(job.time_occurred_iso_utc),
    orderId: job.order_id,
    conversionValue: cfg.valueNew,
    currencyCode: cfg.currencyCode,
  };

  const clickField = applySingleGoogleAdsClickId(payload, job);
  const owner = job.owner || "";
  const assist = job.assist || "";
  const { userIdentifiers, note } = buildUserIdentifiers(job);
  if (userIdentifiers && userIdentifiers.length)
    payload.userIdentifiers = userIdentifiers;

  if (!clickField) {
    const platformNone =
      owner === "platform:none" || assist === "platform:none";
    if (platformNone && userIdentifiers && userIdentifiers.length) {
      return {
        status: "success_ec_only",
        note:
          (note ? note + " " : "") +
          "platform:none — upload bez gclid (Enhanced Conversions for Leads).",
        payload,
      };
    }
    return {
      status: "failed_final",
      note: platformNone
        ? "platform:none bez gclid i bez PII (email/phone) — brak danych do Enhanced Conversions."
        : "Missing attr_gclid / attr_gbraid / attr_wbraid — uploadClickConversions wymaga identyfikatora kliknięcia (platform:google_ads).",
    };
  }

  return {
    status:
      userIdentifiers && userIdentifiers.length ? "success" : "success_no_ec",
    note,
    payload,
  };
}

function buildRestateAdjustment(cfg, job) {
  assertConversionActionResourceName(cfg.conversionActionResourceName);

  if (!job.order_id || job.order_id.trim() === "") {
    return {
      status: "failed_final",
      note: "Missing order_id for RESTATE (must come from Akt Własności).",
    };
  }

  // biz_value: sprawdzamy istnienie, nie truthy (0 jest OK)
  if (job.biz_value === undefined || job.biz_value === null) {
    return { status: "failed_final", note: "Missing biz_value for RESTATE." };
  }

  // (opcjonalnie) gate na stare korekty
  if (cfg.maxDaysSinceBaseForAdjustment && job.base_time_occurred_iso_utc) {
    const d = daysBetween(
      job.base_time_occurred_iso_utc,
      job.time_occurred_iso_utc,
    );
    if (d !== null && d > cfg.maxDaysSinceBaseForAdjustment) {
      return {
        status: "skipped_stale_window",
        note: `Adjustment outside configured window: ${d} days since base (limit=${cfg.maxDaysSinceBaseForAdjustment}).`,
      };
    }
  }

  const adjusted = safeRestateValue(Number(job.biz_value));
  const currency = (
    job.biz_currency ||
    cfg.currencyCode ||
    "PLN"
  ).toUpperCase();

  const payload = {
    conversionAction: cfg.conversionActionResourceName,
    adjustmentType: "RESTATEMENT",
    orderId: job.order_id,
    adjustmentDateTime: isoToGoogleAdsDateTime(job.time_occurred_iso_utc),
    restatementValue: {
      adjustedValue: adjusted,
      currencyCode: currency,
    },
  };

  // UWAGA: nie dodajemy gclidDateTimePair, bo w ConversionAdjustment to jest oneof z orderId.
  return { status: "success", payload };
}

// ============================================
// GOOGLE ADS ADAPTER - Error handling (zgodnie z ADAPTER_GOOGLE.md)
// ============================================

function handleGoogleAdsApiError(cfg, errCode, httpStatus, attemptIndex) {
  // błędy "wyścigu" – specjalny retry
  const baseMissing = new Set([
    "NO_BASE_CONVERSION_YET",
    "CONVERSION_NOT_FOUND",
  ]);
  if (baseMissing.has(errCode)) {
    const waits = cfg.baseMissingRetryMinutes;
    if (attemptIndex >= waits.length) {
      return {
        status: "failed_final",
        note: "Base conversion never arrived after max retries (race condition).",
      };
    }
    return {
      status: "retry_wait_base",
      note: `Base conversion not found yet (${errCode}); delayed retry.`,
      retryAfterMinutes: waits[attemptIndex],
    };
  }

  // transient: 429 / 5xx / timeout-ish
  const transient =
    httpStatus === 429 ||
    (httpStatus !== null && httpStatus >= 500) ||
    ["INTERNAL_ERROR", "DEADLINE_EXCEEDED", "RESOURCE_EXHAUSTED"].includes(
      errCode,
    );

  if (transient) {
    const waits = cfg.transientRetryMinutes;
    if (attemptIndex >= waits.length) {
      return {
        status: "failed_final",
        note: `Transient error exhausted retries: ${errCode}`,
      };
    }
    return {
      status: "retry",
      note: `Transient error (${errCode}); will retry.`,
      retryAfterMinutes: waits[attemptIndex],
    };
  }

  // reszta = permanent
  return {
    status: "failed_final",
    note: `Google Ads API error (permanent): ${errCode}`,
  };
}

// ============================================
// HELPER: Przygotuj dane Google Ads (dla arkusza monitoringowego)
// ============================================
function prepareGoogleAdsEvent(task, pricingConfig) {
  const taskData = task.data || {};
  const eventName = taskData.event_name;

  // ✅ FILTR: GoogleAds_Events dla platform google_ads oraz platform:none (też wysyłamy do GA)
  const owner = taskData.owner || "";
  const assist = taskData.assist || "";
  const isGoogleAdsRelevant =
    owner === "platform:google_ads" ||
    assist === "platform:google_ads" ||
    owner === "platform:none" ||
    assist === "platform:none";
  if (!isGoogleAdsRelevant) {
    console.log(
      `⏭️ SKIP GoogleAds_Events: owner="${owner}", assist="${assist}" for ${eventName}`,
    );
    return null;
  }

  // ✅ CONSENT GATE: Sprawdź consent_ad_storage
  const consentAd = taskData.consent_ad_storage;
  if (consentAd === "denied") {
    console.log(
      `⏭️ SKIP Google Ads: consent_ad_storage = denied for ${eventName}`,
    );
    return null; // Funkcja już zwraca null dla skipped events
  }

  // Mapowanie event_name → Google Ads conversion_name
  const googleAdsConversionMap = {
    generate_lead: "Lead_Form_Submission",
    qualify_lead: "SQL_Lead",
    purchase: "Purchase",
    rejected_lead: "Rejected_Lead",
  };

  const conversionName =
    googleAdsConversionMap[eventName] || "Lead_Form_Submission";

  // Pobierz wartość (z Pricing Key lub biz_value)
  let value = null;
  let currency = taskData.biz_currency || "PLN";

  if (eventName === "purchase") {
    value = taskData.biz_value || null;
  } else {
    let pricingKey = taskData.biz_pricing_key;

    const prefixMap = {
      generate_lead: "lead",
      qualify_lead: "sql",
      rejected_lead: "rejected",
    };

    const prefix = prefixMap[eventName] || "lead";

    if (pricingKey) {
      const hasPrefix =
        pricingKey.startsWith("lead_") ||
        pricingKey.startsWith("sql_") ||
        pricingKey.startsWith("rejected_");

      if (!hasPrefix) {
        pricingKey = `${prefix}_${pricingKey}`;
      }
    } else if (taskData.biz_product) {
      pricingKey = `${prefix}_${taskData.biz_product}`;
    }

    if (pricingKey && pricingConfig) {
      value = getPricingValue(pricingKey, "google_ads", pricingConfig);

      // Fallback: jeśli null, spróbuj "Other"
      if (value === null) {
        value = getPricingValue("Other", "google_ads", pricingConfig);
      }
    }
  }

  // conversion_date_time = timestamp w formacie Google Ads
  const conversionDateTime = new Date()
    .toISOString()
    .replace("T", " ")
    .substring(0, 19);

  // Przygotuj user_data (dla Enhanced Conversions - zgodnie z SSOT)
  // W arkuszu monitoringowym zapisujemy surowe dane, w API użyjemy hash_sha256
  const userData = {
    em: taskData.biz_email || "",
    ph: taskData.biz_phone || "",
    external_id: taskData.id_oid || "",
  };

  return {
    timestamp: new Date().toISOString(),
    conversion_name: conversionName,
    gclid: taskData.attr_gclid || "",
    order_id: taskData.order_id || "",
    value: value,
    currency: currency,
    conversion_date_time: conversionDateTime,
    user_data: JSON.stringify(userData), // Dodane dla monitoring
  };
}

// ============================================
// HELPER: Zapisz Google Ads events do Google Sheets
// ============================================
async function appendGoogleAdsEventsToSheets(googleAdsEvents) {
  if (!SERVICE_ACCOUNT_KEY.client_email) {
    return 0;
  }

  const validEvents = googleAdsEvents.filter((event) => event !== null);

  if (validEvents.length === 0) {
    return 0;
  }

  const bySheet = groupEventsBySheetId(validEvents);
  let total = 0;

  for (const spreadsheetId of Object.keys(bySheet)) {
    const rows = bySheet[spreadsheetId].map((event) => {
      let valueStr = "";
      if (event.value !== null && event.value !== undefined) {
        const numValue = parseFloat(event.value);
        if (!isNaN(numValue)) {
          valueStr = numValue.toString();
        }
      }

      return [
        event.timestamp || "",
        event.conversion_name || "",
        event.gclid || "",
        event.order_id || "",
        valueStr,
        event.currency || "PLN",
        event.conversion_date_time || "",
        event.user_data || "{}",
      ];
    });

    try {
      const n = await appendSheetRows(
        spreadsheetId,
        "GoogleAds_Events!A:H",
        "RAW",
        rows,
      );
      total += n;
      console.log(
        `✅ Appended ${n} Google Ads events (spreadsheet …${String(spreadsheetId).slice(-8)})`,
      );
    } catch (error) {
      console.error("❌ Error appending to GoogleAds_Events:", error.message);
      throw error;
    }
  }

  return total;
}

// ============================================
// HELPER: Wartość konwersji Google Ads dla taska (lead/sql/rejected – z cennika)
// ============================================
function getGoogleAdsValueForTask(taskData, eventName, pricingConfig) {
  let value = null;
  const currency = (taskData.biz_currency || "PLN").trim() || "PLN";
  if (eventName === "purchase") {
    value = taskData.biz_value != null ? parseFloat(taskData.biz_value) : null;
    return { value, currency };
  }
  const prefixMap = {
    generate_lead: "lead",
    qualify_lead: "sql",
    rejected_lead: "rejected",
  };
  const prefix = prefixMap[eventName] || "lead";
  let pricingKey = taskData.biz_pricing_key;
  if (pricingKey) {
    const hasPrefix =
      pricingKey.startsWith("lead_") ||
      pricingKey.startsWith("sql_") ||
      pricingKey.startsWith("rejected_");
    if (!hasPrefix) pricingKey = `${prefix}_${pricingKey}`;
  } else if (taskData.biz_product) {
    pricingKey = `${prefix}_${taskData.biz_product}`;
  }
  if (pricingKey && pricingConfig) {
    value = getPricingValue(pricingKey, "google_ads", pricingConfig);
    if (value === null)
      value = getPricingValue("Other", "google_ads", pricingConfig);
  }
  if (eventName === "rejected_lead") value = 0;
  return { value: value != null ? parseFloat(value) : null, currency };
}

function isGoogleAdsRelevantOwner(owner, assist) {
  return (
    owner === "platform:google_ads" ||
    assist === "platform:google_ads" ||
    owner === "platform:none" ||
    assist === "platform:none"
  );
}

function isPlatformNoneOwner(owner, assist) {
  return owner === "platform:none" || assist === "platform:none";
}

/**
 * Dodaje konwersję do uploadClickConversions:
 * - platform:google_ads → wymaga gclid/gbraid/wbraid (opcjonalnie + userIdentifiers EC)
 * - platform:none → gclid LUB samo EC (userIdentifiers z email/phone) — Enhanced Conversions for Leads
 * @returns {boolean} true jeśli dodano do tablicy conversions
 */
function tryPushGoogleAdsClickConversion(
  conversions,
  conv,
  taskData,
  eventName,
  owner,
  assist,
) {
  const clickField = applySingleGoogleAdsClickId(conv, taskData);
  const ec = buildUserIdentifiers(taskData);
  const userIdentifiers = ec.userIdentifiers;
  if (userIdentifiers && userIdentifiers.length)
    conv.userIdentifiers = userIdentifiers;

  if (clickField) {
    conversions.push(conv);
    return true;
  }

  if (
    isPlatformNoneOwner(owner, assist) &&
    userIdentifiers &&
    userIdentifiers.length
  ) {
    console.log(
      `📤 Google Ads: ${eventName} platform:none — Enhanced Conversions (bez gclid), orderId=${conv.orderId}`,
    );
    conversions.push(conv);
    return true;
  }

  if (isPlatformNoneOwner(owner, assist)) {
    console.warn(
      `⚠️ Google Ads: pomijam ${eventName} platform:none — brak gclid i brak email/phone do Enhanced Conversions`,
    );
  } else {
    console.warn(
      `⚠️ Google Ads: pomijam ${eventName} — brak attr_gclid / attr_gbraid / attr_wbraid`,
    );
  }
  return false;
}

/**
 * Google Ads uploadClickConversions: dokładnie jeden z gclid | gbraid | wbraid (nie wszystkie naraz).
 * Priorytet: gclid (Search), potem gbraid (iOS / privacy), potem wbraid (web-to-app).
 * @returns {string|null} nazwa ustawionego pola albo null gdy brak identyfikatora
 */
function applySingleGoogleAdsClickId(conv, taskLike) {
  const g = taskLike.attr_gclid && String(taskLike.attr_gclid).trim();
  const gb = taskLike.attr_gbraid && String(taskLike.attr_gbraid).trim();
  const wb = taskLike.attr_wbraid && String(taskLike.attr_wbraid).trim();
  if (g) {
    conv.gclid = g;
    return "gclid";
  }
  if (gb) {
    conv.gbraid = gb;
    return "gbraid";
  }
  if (wb) {
    conv.wbraid = wb;
    return "wbraid";
  }
  return null;
}

function logGoogleAdsUploadResponse(operationLabel, res, data) {
  const reqId =
    (typeof res.headers.get === "function" &&
      (res.headers.get("request-id") ||
        res.headers.get("x-goog-request-id"))) ||
    "";
  if (reqId)
    console.log(`📎 Google Ads ${operationLabel} request-id: ${reqId}`);
  if (data.jobId != null && data.jobId !== "") {
    console.log(`📎 Google Ads ${operationLabel} jobId: ${String(data.jobId)}`);
  }
  const results = data.results || [];
  if (results.length > 0) {
    console.log(
      `📎 Google Ads ${operationLabel} results (${results.length}):`,
      JSON.stringify(results),
    );
  } else {
    console.warn(
      `⚠️ Google Ads ${operationLabel}: pusty results[] (HTTP OK) — sprawdź partialFailureError poniżej`,
    );
  }
  if (data.partialFailureError) {
    console.error(
      `⚠️ Google Ads ${operationLabel} partialFailureError:`,
      JSON.stringify(data.partialFailureError),
    );
  }
}

// ============================================
// Wyślij konwersje do Google Ads API (Lead/SQL/Rejected → lead action, Purchase → purchase action)
// ============================================
async function sendToGoogleAdsApi(tasks, pricingConfig) {
  if (!SERVICE_ACCOUNT_KEY.client_email) {
    console.log("⏭️ SKIP Google Ads API: brak Service Account");
    return 0;
  }
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    console.log("⏭️ SKIP Google Ads API: brak GOOGLE_ADS_DEVELOPER_TOKEN");
    return 0;
  }

  const customerId = GOOGLE_ADS_CUSTOMER_ID;
  const conversions = [];
  const adjustments = [];

  for (const task of tasks) {
    const taskData = task.data || {};
    const eventName = normalizeSsoEventName(taskData.event_name);
    const owner = taskData.owner || "";
    const assist = taskData.assist || "";
    if (!isGoogleAdsRelevantOwner(owner, assist)) continue;
    if (taskData.consent_ad_storage === "denied") continue;

    const orderId = (taskData.order_id || "").trim();
    const timeOccurred =
      taskData.time_occurred_iso_utc || new Date().toISOString();
    const conversionDateTime =
      timeOccurred.slice(0, 19).replace("T", " ") + "+00:00";

    if (eventName === "generate_lead") {
      if (!orderId) {
        console.warn("⚠️ Google Ads: pomijam generate_lead bez order_id");
        continue;
      }
      const { value, currency } = getGoogleAdsValueForTask(
        taskData,
        eventName,
        pricingConfig,
      );
      const conversionValue =
        value != null && !isNaN(value) ? Number(value) : 0.01;
      const conv = {
        conversionAction: GOOGLE_ADS_LEAD_ACTION,
        conversionDateTime,
        orderId,
        conversionValue,
        currencyCode: (currency || "PLN").toUpperCase(),
      };
      tryPushGoogleAdsClickConversion(
        conversions,
        conv,
        taskData,
        eventName,
        owner,
        assist,
      );
    } else if (eventName === "purchase") {
      if (!orderId) {
        console.warn("⚠️ Google Ads: pomijam purchase bez order_id");
        continue;
      }
      const purchaseValue =
        taskData.biz_value != null ? parseFloat(taskData.biz_value) : 0.01;
      const conv = {
        conversionAction: GOOGLE_ADS_PURCHASE_ACTION,
        conversionDateTime,
        orderId,
        conversionValue: purchaseValue > 0 ? purchaseValue : 0.01,
        currencyCode: (taskData.biz_currency || "PLN").toUpperCase(),
      };
      tryPushGoogleAdsClickConversion(
        conversions,
        conv,
        taskData,
        eventName,
        owner,
        assist,
      );
    } else if (eventName === "qualify_lead" || eventName === "rejected_lead") {
      if (!orderId) {
        console.warn(`⚠️ Google Ads: pomijam ${eventName} bez order_id`);
        continue;
      }
      const { value, currency } = getGoogleAdsValueForTask(
        taskData,
        eventName,
        pricingConfig,
      );
      let adjustedValue = value != null && !isNaN(value) ? Number(value) : 0.01;
      if (adjustedValue <= 0) adjustedValue = 0.01;
      adjustments.push({
        conversionAction: GOOGLE_ADS_LEAD_ACTION,
        adjustmentType: "RESTATEMENT",
        orderId,
        adjustmentDateTime: conversionDateTime,
        restatementValue: {
          adjustedValue,
          currencyCode: (currency || "PLN").toUpperCase(),
        },
      });
    }
  }

  let sent = 0;
  if (conversions.length === 0 && adjustments.length === 0) return 0;

  console.log(
    `📡 Google Ads API REST v${GOOGLE_ADS_API_VERSION} (customer ${customerId})`,
  );

  const auth = new google.auth.GoogleAuth({
    credentials: SERVICE_ACCOUNT_KEY,
    scopes: ["https://www.googleapis.com/auth/adwords"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token || !token.token) {
    console.error("❌ Google Ads API: brak access token (adwords scope)");
    return 0;
  }
  const headers = {
    Authorization: `Bearer ${token.token}`,
    "Content-Type": "application/json",
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
  };

  if (conversions.length > 0) {
    const url = `https://googleads.googleapis.com/v${GOOGLE_ADS_API_VERSION}/customers/${customerId}:uploadClickConversions`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ conversions, partialFailure: true }),
      });
      const text = await res.text();
      if (res.ok) {
        const data = JSON.parse(text);
        const results = data.results || [];
        sent += results.length;
        logGoogleAdsUploadResponse("uploadClickConversions", res, data);
        console.log(
          `✅ Google Ads API: uploadClickConversions HTTP OK, results.length=${results.length}`,
        );
      } else {
        console.error(
          "❌ Google Ads API uploadClickConversions:",
          res.status,
          text,
        );
      }
    } catch (e) {
      console.error("❌ Google Ads API uploadClickConversions:", e.message);
    }
  }

  if (adjustments.length > 0) {
    const url = `https://googleads.googleapis.com/v${GOOGLE_ADS_API_VERSION}/customers/${customerId}:uploadConversionAdjustments`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          conversionAdjustments: adjustments,
          partialFailure: true,
        }),
      });
      const text = await res.text();
      if (res.ok) {
        const data = JSON.parse(text);
        const adjResults = data.results || [];
        sent += adjResults.length;
        logGoogleAdsUploadResponse("uploadConversionAdjustments", res, data);
        console.log(
          `✅ Google Ads API: uploadConversionAdjustments HTTP OK, results.length=${adjResults.length}`,
        );
      } else {
        console.error(
          "❌ Google Ads API uploadConversionAdjustments:",
          res.status,
          text,
        );
      }
    } catch (e) {
      console.error(
        "❌ Google Ads API uploadConversionAdjustments:",
        e.message,
      );
    }
  }

  return sent;
}

function logGoogleAdsApiError(status, text, label) {
  try {
    const j = JSON.parse(text);
    const err = j.error || j;
    const msg = err.message || text;
    const details = err.details || err.statusDetails;
    console.error(`❌ Google Ads API ${label}: HTTP ${status} — ${msg}`);
    if (details) console.error("   details:", JSON.stringify(details, null, 2));
    if (err.status) console.error("   status:", JSON.stringify(err.status));
  } catch (_) {
    const preview = (text || "").slice(0, 4000);
    console.error(`❌ Google Ads API ${label}: HTTP ${status}`, preview);
  }
}

// ============================================
// UWAGI DOTYCZĄCE LIMITU 100 DOKUMENTÓW
// ============================================
//
// PROBLEM: Stape Store ma limit 100 dokumentów w kolekcji.
//
// ROZWIĄZANIE 1 (PREFEROWANE): Filtrowanie po stronie serwera
// - Jeśli Stape Store API wspiera filtrowanie w `filter: { 'data.status': { $in: [...] } }`,
// to limit 100 dotyczy TYLKO przefiltrowanych dokumentów (pending/monitored).
// - W takim przypadku USUWANIE NIE JEST KONIECZNE!
// - Kod próbuje najpierw filtrowania po stronie serwera, jeśli nie działa - fallback do filtrowania lokalnego.
//
// ROZWIĄZANIE 2 (FALLBACK): Filtrowanie po stronie klienta
// - Jeśli API nie wspiera filtrowania, pobieramy wszystkie 100 dokumentów,
// a potem filtrujemy lokalnie (pending/monitored).
// - W takim przypadku problem: jeśli mamy 100 dokumentów, ale tylko 10 to pending/monitored,
// a reszta to "done", to limit 100 może blokować nowe zadania.
// - W takim przypadku USUWANIE "done" zadań JEST KONIECZNE (opcjonalna funkcja deleteProcessedTasks).
//
// WORKFLOW:
// pending → monitored → done → [opcjonalnie DELETE]
//
// STATUSY:
// - pending: Nowe zadanie, czeka na monitoring
// - monitored: Monitoring done (zapisane do Sheet1), czeka na adaptery
// - done: Wszystkie adaptery przetworzone (GA4, Meta, Google Ads)
//
// TEST: Po deploy sprawdź logi:
// - Jeśli widzisz "✅ Server-side filter worked!" → USUWANIE NIE KONIECZNE
// - Jeśli widzisz "⚠️ Server-side filter not supported" → ROZWAŻ USUWANIE "done" zadań
//
// ============================================
// ZMIANY W ARKUSZACH GOOGLE SHEETS
// ============================================
//
// GoogleAds_Events: Dodano kolumnę H (user_data)
// Format: {"em":"email","ph":"phone","external_id":"id_oid"}
// Zgodnie z SSOT: Google Ads Enhanced Conversions wymaga user_data (email, phone, external_id)
//
// Arkusz GoogleAds_Events ma teraz 8 kolumn (A:H):
// A: timestamp
// B: conversion_name
// C: gclid
// D: order_id
// E: value
// F: currency
// G: conversion_date_time
// H: user_data (NOWE!)
//
// ============================================
// NAPRAWIONE: POWIELANIE WPISÓW
// ============================================
//
// Problem: Zadania były przetwarzane ponownie, bo status był zmieniany PO zapisie do arkuszy.
// Rozwiązanie:
// 1. Status zmieniany NAJPIERW na "done" (PRZED zapisem do arkuszy)
// 2. Filtrowanie pomija "done" i "processed_ga4" zadania
// 3. Lepsze logowanie w updateTaskStatus (sprawdza czy status się zmienił)
// 4. Ostrzeżenie jeśli update statusu się nie powiedzie
//
// ============================================
// PROBLEM: STAPE STORE API NIE WSPIERA FILTROWANIA PO STRONIE SERWERA
// ============================================
//
// WAŻNE ODKRYCIE (2024-12-22):
// Stape Store API v2 NIE WSPIERA filtrowania po stronie serwera!
// Nawet jeśli wyślemy request z filtrem:
// {"filter": {"data.status": {"$in": ["pending", "monitored"]}}}
// API zwraca status 200 (sukces), ale IGNORUJE filtr i zwraca WSZYSTKIE dokumenty!
//
// Przykład z logów:
// - Request: filter={"data.status":{"$in":["pending","monitored"]}}
// - Response: 200 OK
// - Zwrócone zadania: 100 zadań ze statusem "done" (wszystkie!)
//
// ROZWIĄZANIE:
// 1. Zawsze filtrujemy lokalnie (w kodzie JavaScript)
// 2. Usuwamy "done" zadania z kolekcji (funkcja deleteDoneTasks)
// - Limit 100 dokumentów w kolekcji
// - Jeśli wszystkie 100 to "done", nie ma miejsca na nowe zadania
// - Usuwamy max 50 "done" zadań na każdym uruchomieniu Robota
// 3. Usuwanie następuje NAJPIERW (przed pobraniem nowych zadań)
//
// ALTERNATYWA (nie zaimplementowana):
// - Przenoszenie "done" zadań do innej kolekcji (task_queue_archive)
// - Wymaga dodatkowej logiki i kolekcji
