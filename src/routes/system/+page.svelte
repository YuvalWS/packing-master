<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types.js';
  import Toast from '$lib/components/Toast.svelte';
  import strings from '$lib/strings.js';
  import { makeSystemApi, type BackupEntry, type SystemInfo } from '$lib/client/system-api.js';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const s = strings.system;
  const api = makeSystemApi();

  // Seeded from the load, then overwritten by polling (writable deriveds).
  let system: SystemInfo = $derived(data.system);
  let backups: BackupEntry[] = $derived(data.backups);

  let busy = $state(false);
  let checking = $state(false);
  let updating = $state(false);
  let updateArmed = $state(false);
  let armed: { name: string; action: 'restore' | 'delete' } | null = $state(null);
  let toastMsg: string | null = $state(null);
  let toastTone: 'info' | 'success' | 'danger' = $state('info');
  let fileInput: HTMLInputElement | undefined = $state();

  function toast(msg: string, tone: 'info' | 'success' | 'danger' = 'info') {
    toastTone = tone;
    toastMsg = msg;
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  }

  function fmtSize(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  const short = (c: string | null | undefined) => (c ? c.slice(0, 7) : '');
  const reasonLabel = (r: string) => (s.reason as Record<string, string>)[r] ?? r;

  async function refreshBackups() {
    backups = (await api.listBackups()).backups;
  }

  async function checkForUpdate() {
    checking = true;
    const before = system.latest?.checked_at;
    try {
      await api.checkForUpdate();
      for (let i = 0; i < 20; i++) {
        await sleep(1500);
        system = await api.system();
        if (!system.check_requested && system.latest?.checked_at !== before) break;
      }
    } catch {
      toast(s.check_failed, 'danger');
    } finally {
      checking = false;
    }
  }

  async function startUpdate() {
    updateArmed = false;
    updating = true;
    const before = system.update_log_time;
    try {
      await api.update();
      toast(s.update_requested, 'info');
    } catch {
      updating = false;
      toast(s.failed, 'danger');
      return;
    }
    await waitForUpdate(before);
  }

  async function waitForUpdate(before: string | null) {
    updating = true;
    // The app restarts mid-update, so requests fail for a while: keep polling until the
    // host has written a new log and the app answers again.
    for (let i = 0; i < 400; i++) {
      await sleep(3000);
      try {
        const next = await api.system();
        system = next;
        if (!next.update_requested && next.update_log_time && next.update_log_time !== before) {
          const done = next.update_log.some((l) => l.startsWith('== update finished') || l.startsWith('== rolled back'));
          if (done) {
            location.reload();
            return;
          }
        }
      } catch {
        // restarting
      }
    }
    updating = false;
  }

  async function backupNow() {
    busy = true;
    try {
      await api.createBackup();
      await refreshBackups();
      toast(s.backup_created, 'success');
    } catch {
      toast(s.failed, 'danger');
    } finally {
      busy = false;
    }
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    busy = true;
    try {
      await api.uploadBackup(file);
      await refreshBackups();
      toast(s.uploaded, 'success');
    } catch {
      toast(s.failed, 'danger');
    } finally {
      busy = false;
    }
  }

  async function confirmArmed() {
    if (!armed) return;
    const { name, action } = armed;
    armed = null;
    busy = true;
    try {
      if (action === 'restore') {
        await api.restoreBackup(name);
        toast(s.restored, 'success');
        await invalidateAll();
      } else {
        await api.deleteBackup(name);
        toast(s.deleted, 'success');
      }
      await refreshBackups();
    } catch {
      toast(s.failed, 'danger');
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    if (system.update_requested) {
      void waitForUpdate(system.update_log_time);
      return;
    }
    const stale =
      !system.latest || Date.now() - new Date(system.latest.checked_at).getTime() > 10 * 60 * 1000;
    if (system.can_update && stale) void checkForUpdate();
  });
</script>

<section class="screen">
  <div class="card">
    <h2>{s.version_heading}</h2>
    <dl>
      <dt>{s.version}</dt>
      <dd class="ltr">{system.version}</dd>
      {#if system.installed}
        <dt>{s.installed}</dt>
        <dd class="ltr">{short(system.installed.commit)} · {fmtDate(system.installed.date)}</dd>
      {/if}
      {#if system.latest}
        <dt>{s.latest}</dt>
        <dd>
          {#if system.latest.error}
            <span class="danger">{s.check_failed}</span>
          {:else if system.update_available}
            <span class="warn">{s.update_available}</span>
            <span class="ltr">({short(system.latest.commit)})</span>
          {:else}
            <span class="ok">{s.up_to_date}</span>
          {/if}
          <span class="muted">· {s.checked_at} {fmtDate(system.latest.checked_at)}</span>
        </dd>
      {/if}
    </dl>

    {#if system.update_available && system.latest && system.latest.changes.length > 0}
      <h3>{s.changes}</h3>
      <ul class="changes ltr">
        {#each system.latest.changes as change, i (i)}
          <li>{change}</li>
        {/each}
      </ul>
    {/if}

    {#if !system.can_update}
      <p class="muted">{s.not_managed}</p>
    {:else if updating}
      <p class="warn">{s.updating}</p>
    {:else if updateArmed}
      <p>{s.update_confirm}</p>
      <div class="row">
        <button type="button" class="ghost" onclick={() => (updateArmed = false)}>{strings.common.cancel}</button>
        <button type="button" class="primary" onclick={startUpdate}>{s.update}</button>
      </div>
    {:else}
      <div class="row">
        <button type="button" class="ghost" disabled={checking} onclick={checkForUpdate}>
          {checking ? s.checking : s.check}
        </button>
        <button
          type="button"
          class="primary"
          disabled={checking || system.update_available === false}
          onclick={() => (updateArmed = true)}
        >
          {s.update}
        </button>
      </div>
    {/if}

    {#if system.update_log.length > 0}
      <details open={updating}>
        <summary>{s.update_log} · {fmtDate(system.update_log_time)}</summary>
        <pre class="ltr">{system.update_log.join('\n')}</pre>
      </details>
    {/if}
  </div>

  <div class="card">
    <h2>{s.backups_heading}</h2>
    <p class="muted">{s.backups_intro}</p>
    <div class="row">
      <button type="button" class="ghost" disabled={busy} onclick={() => fileInput?.click()}>{s.upload}</button>
      <button type="button" class="primary" disabled={busy} onclick={backupNow}>{s.backup_now}</button>
      <input
        bind:this={fileInput}
        type="file"
        accept=".gz,.json,application/gzip,application/json"
        hidden
        onchange={onFile}
      />
    </div>

    {#if backups.length === 0}
      <p class="muted">{s.no_backups}</p>
    {:else}
      <ul class="backups">
        {#each backups as b (b.name)}
          <li>
            <div class="backup-meta">
              <span>{fmtDate(b.created_at)}</span>
              <span class="muted">{reasonLabel(b.reason)} · <span class="ltr">{fmtSize(b.size)}</span></span>
            </div>
            {#if armed?.name === b.name}
              <div class="confirm">
                <p>{armed.action === 'restore' ? s.restore_confirm : s.delete_confirm}</p>
                <div class="row">
                  <button type="button" class="ghost" onclick={() => (armed = null)}>{strings.common.cancel}</button>
                  <button type="button" class="danger-btn" onclick={confirmArmed}>
                    {armed.action === 'restore' ? s.restore : s.delete}
                  </button>
                </div>
              </div>
            {:else}
              <div class="row">
                <a class="ghost" href={api.backupUrl(b.name)} download={b.name}>{s.download}</a>
                <button type="button" class="ghost" disabled={busy} onclick={() => (armed = { name: b.name, action: 'restore' })}>
                  {s.restore}
                </button>
                <button type="button" class="ghost danger" disabled={busy} onclick={() => (armed = { name: b.name, action: 'delete' })}>
                  {s.delete}
                </button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="card">
    <h2>{s.api_heading}</h2>
    <p class="muted">{s.api_intro}</p>
    <div class="row start">
      <a class="ghost" href="/llms.txt" target="_blank" rel="noopener">{s.api_guide}</a>
      <a class="ghost" href="/api/openapi.json" target="_blank" rel="noopener">{s.api_openapi}</a>
    </div>
  </div>
</section>

<Toast message={toastMsg} tone={toastTone} onDismiss={() => (toastMsg = null)} />

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-block: var(--space-3) var(--space-6);
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  h2 {
    font-size: var(--fs-row);
    font-weight: 700;
  }

  h3 {
    font-size: var(--fs-body);
    font-weight: 600;
  }

  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-1) var(--space-3);
  }

  dt {
    color: var(--color-text-muted);
  }

  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }

  .changes {
    padding-inline-start: var(--space-5);
    list-style: disc;
    font-size: var(--fs-meta);
    text-align: start;
  }

  .muted {
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }

  .ok {
    color: var(--color-success);
  }

  .warn {
    color: var(--color-warning);
  }

  .danger {
    color: var(--color-danger);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .row.start {
    justify-content: flex-start;
  }

  .primary,
  .ghost,
  .danger-btn {
    display: inline-flex;
    align-items: center;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-pill);
    cursor: pointer;
    font-size: var(--fs-body);
  }

  .primary {
    background: var(--color-primary);
    color: white;
  }

  .primary:disabled,
  .ghost:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .ghost {
    color: var(--color-primary);
    border: 1px solid var(--color-border);
  }

  .ghost:hover {
    text-decoration: none;
    background: var(--color-primary-soft);
  }

  .ghost.danger {
    color: var(--color-danger);
  }

  .danger-btn {
    background: var(--color-danger);
    color: white;
  }

  .backups {
    display: flex;
    flex-direction: column;
  }

  .backups li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding-block: var(--space-3);
    border-block-start: 1px solid var(--color-border);
  }

  .backup-meta {
    display: flex;
    flex-direction: column;
  }

  .confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }

  pre {
    max-height: 320px;
    overflow: auto;
    padding: var(--space-3);
    background: var(--color-bg);
    border-radius: var(--radius-sm);
    font-size: 12px;
    white-space: pre-wrap;
    text-align: start;
  }

  summary {
    cursor: pointer;
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }
</style>
