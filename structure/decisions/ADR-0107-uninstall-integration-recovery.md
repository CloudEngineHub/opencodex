# ADR-0107 — decision recorded under "Client Integrations"

- Contract owner: [clients/integrations.md](../clients/integrations.md)

## Decision record

- 목적과 의도: Restore every recorded third-party client contribution before uninstall deletes the ownership and snapshot evidence needed to do so safely.
- 기존 구현 및 제약 조건: Generic integration records lived under the OpenCodex config root and were removed by the ownership manifest, while uninstall restored native Codex, Grok, and Desktop state only. The ordinary disable writer already owns drift detection, snapshots, compensation, and per-client locking.
- 검토한 주요 대안: Leave external files unchanged; teach the config remover about third-party formats; restore snapshots wholesale; or invoke the existing coordinated disable workflow before config removal.
- 선택한 방식: Under the final client-lifecycle lease, strictly read all ownership records, validate every client ID before mutation, load one export roster, disable each recorded integration in deterministic order, verify its record retired, and abort config removal on any refusal or error.
- 다른 대안 대신 이 방식을 선택한 이유: Reusing the writer preserves the same fragment-level ownership and conflict rules as an explicit toggle. Whole-file restoration can erase later user edits, while deleting evidence first makes a safe retry impossible.
- 장점, 단점 및 영향: Successful uninstall no longer leaves third-party clients targeting a removed proxy. A conflict makes uninstall partial and retains recoverable OpenCodex state; cleanup can take the existing writer locks and model-roster load before local state is deleted.
