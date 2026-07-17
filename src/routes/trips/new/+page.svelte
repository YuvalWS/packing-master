<script lang="ts">
  import type { PageData } from './$types.js';
  import { goto } from '$app/navigation';
  import { ChevronLeft } from '@lucide/svelte';
  import ParameterSelector from '$lib/components/ParameterSelector.svelte';
  import { makeApi } from '$lib/client/api.js';
  import { derive, type DerivedTrip } from '$lib/rules/derived.js';
  import { formatDateRange } from '$lib/util/format-date.js';
  import strings from '$lib/strings.js';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let step = $state<'template' | 'details'>('template');
  let selectedTemplateId = $state<string | null>(null);
  let name = $state('');
  let startDate = $state('');
  let endDate = $state('');
  let destination = $state('');
  let parameters = $state<string[]>([]);
  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);

  const accommodationParams = $derived(
    data.parameters.filter((p) => p.category === 'accommodation' && !p.is_derived)
  );

  const derivedTrip = $derived.by<DerivedTrip | null>(() => {
    if (!startDate || !endDate || startDate > endDate) return null;
    try {
      return derive(startDate, endDate);
    } catch {
      return null;
    }
  });

  const days = $derived(derivedTrip?.days ?? null);

  const namePlaceholder = $derived.by(() => {
    const accommodation = parameters
      .map((id) => accommodationParams.find((p) => p.id === id))
      .find((p) => p !== undefined);
    if (days === null || !accommodation) return strings.new_trip.name_fallback_placeholder;
    return strings.new_trip.name_auto_placeholder
      .replace('{days}', String(days))
      .replace('{accommodation}', accommodation.display_name);
  });

  function chooseTemplate(templateId: string | null) {
    selectedTemplateId = templateId;
    const tpl = templateId ? data.templates.find((t) => t.id === templateId) : null;
    parameters = tpl ? [...tpl.default_parameters] : [];
    step = 'details';
  }

  function validate(): string | null {
    if (!startDate || !endDate) return strings.new_trip.error_dates;
    if (startDate > endDate) return strings.new_trip.error_dates;
    const hasAccommodation = parameters.some(
      (id) => accommodationParams.find((p) => p.id === id) !== undefined
    );
    if (!hasAccommodation) return strings.new_trip.error_no_accommodation;
    return null;
  }

  async function submit() {
    errorMsg = validate();
    if (errorMsg) return;
    submitting = true;
    try {
      const api = makeApi();
      const res = await api.createTrip({
        name: name.trim() || undefined,
        template_id: selectedTemplateId ?? undefined,
        start_date: startDate,
        end_date: endDate,
        destination: destination.trim() || undefined,
        parameters
      });
      await goto(`/trips/${res.trip.id}`);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : strings.new_trip.error_generic;
      submitting = false;
    }
  }
</script>

{#if step === 'template'}
  <section class="step">
    <p class="step-indicator">
      {strings.new_trip.step_indicator.replace('{n}', '1')} · {strings.new_trip.step_template_title}
    </p>
    <h2>{strings.new_trip.step_template_title}</h2>
    <ul class="template-list">
      {#each data.templates as t (t.id)}
        <li>
          <button type="button" class="template-card" onclick={() => chooseTemplate(t.id)}>
            <strong>{t.display_name}</strong>
            {#if t.default_parameters.length > 0}
              <span class="param-count ltr-number">{t.default_parameters.length}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
    <div class="or-sep" role="presentation">
      <span>{strings.new_trip.or_separator}</span>
    </div>
    <button type="button" class="blank-btn" onclick={() => chooseTemplate(null)}>
      {strings.new_trip.start_blank}
    </button>
  </section>
{:else}
  <section class="step">
    <button class="back" type="button" onclick={() => (step = 'template')}>
      <ChevronLeft size={18} />
      <span>{strings.common.back}</span>
    </button>
    <p class="step-indicator">
      {strings.new_trip.step_indicator.replace('{n}', '2')} · {strings.new_trip.step_details_title}
    </p>
    <h2>{strings.new_trip.step_details_title}</h2>

    <form
      onsubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label class="field">
        <span>{strings.new_trip.label_name}</span>
        <input type="text" bind:value={name} placeholder={namePlaceholder} />
      </label>

      <div class="row">
        <label class="field">
          <span>{strings.new_trip.label_start}</span>
          <input type="date" required bind:value={startDate} />
        </label>
        <label class="field">
          <span>{strings.new_trip.label_end}</span>
          <input type="date" required bind:value={endDate} />
        </label>
      </div>

      {#if derivedTrip !== null}
        <p class="days-hint">
          <span class="ltr-number">{formatDateRange(startDate, endDate)}</span>
          · <span class="ltr-number">{derivedTrip.days}</span>
          {derivedTrip.days === 1 ? strings.common.day_one : strings.common.day_many}
          {#if derivedTrip.hasShabbat}
            · {derivedTrip.shabbatCount === 1
              ? strings.new_trip.includes_shabbat_one
              : strings.new_trip.includes_shabbat_many.replace(
                  '{count}',
                  String(derivedTrip.shabbatCount)
                )}
          {/if}
        </p>
      {/if}

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
        derivedActive={derivedTrip?.derivedParamIds ?? []}
        onChange={(next) => (parameters = next)}
      />

      {#if errorMsg}
        <div class="error" role="alert">{errorMsg}</div>
      {/if}

      <button type="submit" class="submit" disabled={submitting}>
        {submitting ? strings.common.loading : strings.new_trip.submit}
      </button>
    </form>
  </section>
{/if}

<style>
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-block-start: var(--space-3);
  }

  .step h2 {
    font-size: var(--fs-title);
    font-weight: 700;
  }

  .step-indicator {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
    margin-block-end: calc(-1 * var(--space-3));
  }

  .or-sep {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }

  .or-sep::before,
  .or-sep::after {
    content: '';
    flex: 1;
    border-block-start: 1px solid var(--color-border);
  }

  .blank-btn {
    width: 100%;
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font-weight: 600;
    cursor: pointer;
  }

  .blank-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .template-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .template-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    text-align: start;
    cursor: pointer;
    font-size: var(--fs-row);
  }

  .template-card:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
  }

  .param-count {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
    align-self: flex-start;
    cursor: pointer;
  }

  :global(html[dir='rtl']) .back :global(svg) {
    transform: scaleX(-1);
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

  .field input:focus {
    border-color: var(--color-primary);
    outline: none;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .days-hint {
    margin-block-start: calc(-1 * var(--space-2));
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }

  .error {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-danger-soft);
    color: var(--color-danger);
    font-size: var(--fs-meta);
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
</style>
