import type { ExportModel } from "../clients/config-export";
import { loadConfig } from "../config";
import { isIntegrationClientId, type IntegrationClientId } from "../integrations/registry";
import { createIntegrationStateStore, type IntegrationStateStore } from "../integrations/store";
import { disableIntegrationCoordinated, type WriteOutcome } from "../integrations/writer";
import { loadExportModels } from "../server/management/model-rows";
import type { OcxConfig } from "../types";

export interface UninstallIntegrationCleanupDeps {
  createStore: () => IntegrationStateStore;
  loadConfig: () => OcxConfig;
  loadModels: (config: OcxConfig) => Promise<ExportModel[]>;
  disable: (input: Parameters<typeof disableIntegrationCoordinated>[0]) => Promise<WriteOutcome>;
  env?: NodeJS.ProcessEnv;
  home?: string;
}

const defaults: UninstallIntegrationCleanupDeps = {
  createStore: () => createIntegrationStateStore(),
  loadConfig,
  loadModels: config => loadExportModels(config),
  disable: input => disableIntegrationCoordinated(input),
};

export interface UninstallIntegrationCleanupResult {
  attempted: number;
  changed: number;
}

/**
 * Remove every contribution we can still prove we own before uninstall deletes that proof.
 * A single refusal aborts config removal: preserving recovery state is safer than leaving an
 * external client pointed at a proxy that no longer exists.
 */
export async function cleanupOwnedIntegrationsBeforeUninstall(
  deps: UninstallIntegrationCleanupDeps = defaults,
): Promise<UninstallIntegrationCleanupResult> {
  const store = deps.createStore();
  const records = store.readRecordsStrict();
  const rawIds = Object.keys(records);
  for (const id of rawIds) {
    if (!isIntegrationClientId(id)) {
      throw new Error(`integration cleanup refused: ownership names unknown client ${id}`);
    }
  }
  const clientIds = (rawIds as IntegrationClientId[]).sort();
  if (clientIds.length === 0) return { attempted: 0, changed: 0 };

  const config = deps.loadConfig();
  const models = await deps.loadModels(config);
  let changed = 0;
  for (const clientId of clientIds) {
    const result = await deps.disable({
      clientId,
      models,
      config,
      port: config.port,
      store,
      ...(deps.env ? { env: deps.env } : {}),
      ...(deps.home ? { home: deps.home } : {}),
    });
    if (!result.ok) {
      throw new Error(`integration cleanup refused for ${clientId}: ${result.message}`);
    }
    if (store.readRecordsStrict()[clientId]) {
      throw new Error(`integration cleanup did not retire ownership for ${clientId}`);
    }
    if (result.changed) changed++;
  }
  return { attempted: clientIds.length, changed };
}
