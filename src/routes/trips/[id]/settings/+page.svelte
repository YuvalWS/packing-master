<script lang="ts">
  import type { PageData } from './$types.js';
  import { goto } from '$app/navigation';
  import { Trash2 } from '@lucide/svelte';
  import ParameterSelector from '$lib/components/ParameterSelector.svelte';
  import RegenDiffModal from '$lib/components/RegenDiffModal.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import type { PatchTripResponse, PatchTripDiffRemoved } from '$lib/client/api.js';
  import { makeApi } from '$lib/client/api.js';
  import strings from '$lib/strings.js';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  // svelte-ignore state_referenced_locally
  let name = $state(data.trip.name ?? '');
  // svelte-ignore state_referenced_locally
  let startDate = $state(data.trip.start_date);
  // svelte-ignore state_referenced_locally
  let endDate = $state(data.trip.end_date);
  // svelte-ignore state_referenced_locally
  let destination = $state(data.trip.destination ?? '');
  // svelte-ignore state_referenced_locally
  let parameters = $state<string[]>([...data.trip.context.parameters]);

  let submitting = $state(false);
  let toastMsg = $state<string | null>(null);
  let toastTone = $state<'info' | 'success' | 'danger'>('info');
  let pendingDiff = $state<PatchTripResponse['diff'] | null>(null);

  async function save() {
    submitting = true;
    try {
      const api = makeApi();
      const res = await api.patchTrip(data.trip.id, {
        name: name.trim() || null,
        start_date: startDate,
        end_date: endDate,
        destination: destination.trim() || null,
        parameters
      });
      const added = res.diff.added.length;
      const updated = res.diff.updated.length;
      const toBeRemoved = res.diff.to_be_removed.length;

      if (toBeRemoved === 0) {
        const msg =
          added + updated === 0
            ? strings.settings.saved_toast
            : strings.settings.saved_with_changes
                .replace('{added}', String(added))
                .replace('{updated}', String(updated));
        toastTone = 'success';
        toastMsg = msg;
        setTimeout(() => goto(`/trips/${data.trip.id}`), 400);
      } else {
        pendingDiff = res.diff;
      }
    } catch {
      toastTone = 'danger';
      toastMsg = strings.settings.save_failed;
    } finally {
      submitting = false;
    }
  }

  async function confirmRemoval(picks: PatchTripDiffRemoved[]) {
    if (picks.length === 0 || !pendingDiff) {
      pendingDiff = null;
      goto(`/trips/${data.trip.id}`);
      return;
    }
    submitting = true;
    try {
      const api = makeApi();
      await api.regenerateTrip(data.trip.id, {
        remove_item_keys: picks
          .filter((p) => p.row_id !== null)
          .map((p) => ({ row_id: p.row_id as number }))
      });
      toastTone = 'success';
      toastMsg = strings.settings.saved_toast;
      pendingDiff = null;
      setTimeout(() => goto(`/trips/${data.trip.id}`), 400);
    } catch {
      toastTone = 'danger';
      toastMsg = strings.settings.save_failed;
    } finally {
      submitting = false;
    }
  }

  function cancelRemoval() {
    pendingDiff = null;
    goto(`/trips/${data.trip.id}`);
  }

  async function destroy() {
    if (typeof confirm === 'function' && !confirm(strings.settings.delete_confirm)) return;
    submitting = true;
    try {
      const api = makeApi();
      await api.deleteTrip(data.trip.id);
      toastTone = 'success';
      toastMsg = strings.settings.deleted_toast;
      setTimeout(() => goto('/'), 300);
    } catch {
      toastTone = 'danger';
      toastMsg = strings.settings.save_failed;
      submitting = false;
    }
  }
</script>

<section class="step">
  <h2>{strings.settings.title}</h2>

  <form
    onsubmit={(e) => {
      e.preventDefault();
      save();
    }}
  >
    <label class="field">
      <span>{strings.new_trip.label_name}</span>
      <input type="text" bind:value={name} placeholder={strings.new_trip.label_name_placeholder} />
    </label>

    <div class="row">
      <label class="field">
        <span>{strings.new_trip.label_start}</span>
        <input type="date" bind:value={startDate} required />
      </label>
      <label class="field">
        <span>{strings.new_trip.label_end}</span>
        <input type="date" bind:value={endDate} required />
      </label>
    </div>

    <label class="field">
      <span>{strings.new_trip.label_destination}</span>
      <input
        type="text"
        bind:value={destination}
        placeholder={strings.new_trip.label_destination_placeholder}
      />
    </label>

    <ParameterSelector
      parameters={data.parameters}
      selected={parameters}
      onChange={(next) => (parameters = next)}
    />

    <div class="actions">
      <button type="submit" class="submit" disabled={submitting}>
        {submitting ? strings.common.loading : strings.common.save}
      </button>
      <button type="button" class="danger" onclick={destroy} disabled={submitting}>
        <Trash2 size={16} />
        <span>{strings.settings.delete_trip}</span>
      </button>
    </div>
  </form>
</section>

<Toast message={toastMsg} tone={toastTone} onDismiss={() => (toastMsg = null)} />

<RegenDiffModal
  open={pendingDiff !== null}
  added={pendingDiff?.added ?? []}
  updated={pendingDiff?.updated ?? []}
  toBeRemoved={pendingDiff?.to_be_removed ?? []}
  onConfirm={confirmRemoval}
  onCancel={cancelRemoval}
/>

<style>
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-block-start: var(--space-3);
  }

  h2 {
    font-size: var(--fs-title);
    font-weight: 700;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field > span {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  .field input {
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .submit {
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-pill);
    background: var(--color-primary);
    color: white;
    font-weight: 600;
    cursor: pointer;
  }

  .submit:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .danger {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-danger);
    cursor: pointer;
  }

  .danger:hover:not(:disabled) {
    background: var(--color-danger-soft);
  }
</style>
