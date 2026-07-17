<script lang="ts">
  import { Check } from '@lucide/svelte';
  import type { Parameter } from '$lib/client/api.js';
  import strings from '$lib/strings.js';

  interface Props {
    parameters: Parameter[];
    selected: string[];
    /* Ids of engine-derived parameters detected from the trip dates;
       rendered as a read-only "automatic" section, never as toggles. */
    derivedActive?: string[];
    onChange: (next: string[]) => void;
  }

  let { parameters, selected, derivedActive = [], onChange }: Props = $props();

  const activeDerivedParams = $derived(
    parameters.filter((p) => p.is_derived && derivedActive.includes(p.id))
  );

  const byCategory = $derived.by(() => {
    const accommodation: Parameter[] = [];
    const environment: Parameter[] = [];
    const day_plans: Parameter[] = [];
    for (const p of parameters) {
      if (p.is_derived) continue;
      if (p.category === 'accommodation') accommodation.push(p);
      else if (p.category === 'environment') environment.push(p);
      else if (p.category === 'day_plans') day_plans.push(p);
    }
    const bySort = (a: Parameter, b: Parameter) => a.sort_order - b.sort_order;
    accommodation.sort(bySort);
    environment.sort(bySort);
    day_plans.sort(bySort);
    return { accommodation, environment, day_plans };
  });

  const selectedSet = $derived(new Set(selected));

  function chooseAccommodation(id: string) {
    const next = selected.filter((s) => {
      const p = parameters.find((x) => x.id === s);
      return !p || p.category !== 'accommodation';
    });
    next.push(id);
    onChange(next);
  }

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }
</script>

<div class="selector">
  {#if byCategory.accommodation.length > 0}
    <fieldset class="group">
      <legend>{strings.parameter_category.accommodation}</legend>
      <div class="options" role="radiogroup">
        {#each byCategory.accommodation as p (p.id)}
          <label class="radio-option" class:active={selectedSet.has(p.id)}>
            <input
              type="radio"
              name="accommodation"
              value={p.id}
              checked={selectedSet.has(p.id)}
              onchange={() => chooseAccommodation(p.id)}
            />
            <span>{p.display_name}</span>
          </label>
        {/each}
      </div>
    </fieldset>
  {/if}

  {#if byCategory.environment.length > 0}
    <fieldset class="group">
      <legend>{strings.parameter_category.environment}</legend>
      <div class="options chips">
        {#each byCategory.environment as p (p.id)}
          <button
            type="button"
            class="chip-toggle"
            class:active={selectedSet.has(p.id)}
            aria-pressed={selectedSet.has(p.id)}
            onclick={() => toggle(p.id)}
          >
            {p.display_name}
          </button>
        {/each}
      </div>
    </fieldset>
  {/if}

  {#if byCategory.day_plans.length > 0}
    <fieldset class="group">
      <legend>{strings.parameter_category.day_plans}</legend>
      <div class="options chips">
        {#each byCategory.day_plans as p (p.id)}
          <button
            type="button"
            class="chip-toggle"
            class:active={selectedSet.has(p.id)}
            aria-pressed={selectedSet.has(p.id)}
            onclick={() => toggle(p.id)}
          >
            {p.display_name}
          </button>
        {/each}
      </div>
    </fieldset>
  {/if}

  {#if activeDerivedParams.length > 0}
    <div class="group derived-group">
      <p class="derived-legend">{strings.parameter_category.derived}</p>
      <div class="options chips">
        {#each activeDerivedParams as p (p.id)}
          <span class="derived-chip">
            <Check size={14} aria-hidden="true" />
            {p.display_name}
          </span>
        {/each}
      </div>
      <p class="derived-hint">{strings.new_trip.derived_hint}</p>
    </div>
  {/if}
</div>

<style>
  .selector {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .group {
    border: 0;
    padding: 0;
    margin: 0;
  }

  legend {
    font-size: var(--fs-meta);
    font-weight: 700;
    color: var(--color-text-muted);
    margin-block-end: var(--space-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .options.chips {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .radio-option {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .radio-option.active {
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
  }

  .radio-option input {
    margin: 0;
    accent-color: var(--color-primary);
  }

  .chip-toggle {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    cursor: pointer;
    font-size: var(--fs-meta);
    transition: background 0.12s ease, border-color 0.12s ease;
  }

  .chip-toggle:hover {
    border-color: var(--color-primary);
  }

  .chip-toggle.active {
    background: var(--color-primary-soft);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .derived-legend {
    font-size: var(--fs-meta);
    font-weight: 700;
    color: var(--color-text-muted);
    margin-block-end: var(--space-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .derived-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-pill);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }

  .derived-hint {
    margin-block-start: var(--space-2);
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }
</style>
