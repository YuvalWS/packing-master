<script lang="ts">
  import ParamChip from './ParamChip.svelte';
  import strings from '$lib/strings.js';
  import type { Person } from '$lib/client/api.js';

  interface Props {
    people: Person[];
    selected: string[];
    onChange: (next: string[]) => void;
  }

  let { people, selected, onChange }: Props = $props();

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
</script>

<fieldset class="travelers">
  <legend>{strings.travelers.label}</legend>
  {#if people.length === 0}
    <p class="hint">
      {strings.travelers.none_defined}
      <a href="/people">{strings.travelers.manage}</a>
    </p>
  {:else}
    <div class="chips">
      {#each people as p (p.id)}
        <ParamChip
          label={`${p.display_name} · ${strings.people.kinds[p.kind]}`}
          active={selected.includes(p.id)}
          onclick={() => toggle(p.id)}
        />
      {/each}
    </div>
    <p class="hint">{strings.travelers.hint}</p>
  {/if}
</fieldset>

<style>
  .travelers {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border: 0;
    padding: 0;
    margin: 0;
  }

  legend {
    font-weight: 600;
    margin-block-end: var(--space-2);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .hint {
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }
</style>
