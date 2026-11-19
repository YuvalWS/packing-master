<script lang="ts">
  import type { PageData } from './$types.js';
  import { ChevronLeft } from '@lucide/svelte';
  import { formatCondition } from '$lib/util/format-condition.js';
  import { formatQuantity } from '$lib/util/format-quantity.js';
  import { bagLabel } from '$lib/util/bag-label.js';
  import { formatScope } from '$lib/util/format-scope.js';
  import strings from '$lib/strings.js';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const item = $derived(data.item);
</script>

<a class="back" href="/items">
  <ChevronLeft size={18} />
  <span>{strings.items_catalog.back_to_list}</span>
</a>

<header class="head">
  <h2>{item.display_name}</h2>
  <span class="id ltr-number">{item.id}</span>
</header>

<dl class="fields">
  <div class="field">
    <dt>{strings.items_catalog.field_category}</dt>
    <dd>{item.category ?? '—'}</dd>
  </div>
  <div class="field">
    <dt>{strings.items_catalog.field_default_bag}</dt>
    <dd>{item.default_bag ? bagLabel(item.default_bag) : '—'}</dd>
  </div>
  <div class="field">
    <dt>{strings.items_catalog.field_optional}</dt>
    <dd>{item.is_optional ? strings.items_catalog.yes : strings.items_catalog.no}</dd>
  </div>
  <div class="field">
    <dt>{strings.items_catalog.field_scope}</dt>
    <dd>{formatScope(item, data.names)}</dd>
  </div>
  <div class="field">
    <dt>{strings.items_catalog.field_kit}</dt>
    <dd>{item.is_kit ? strings.items_catalog.yes : strings.items_catalog.no}</dd>
  </div>
  <div class="field wide">
    <dt>{strings.items_catalog.field_condition}</dt>
    <dd>{formatCondition(item.include_when, data.names)}</dd>
  </div>
  <div class="field wide">
    <dt>{strings.items_catalog.field_quantity}</dt>
    <dd>{formatQuantity(item.quantity)}</dd>
  </div>
  {#if item.is_kit && item.kit_contents && item.kit_contents.length > 0}
    <div class="field wide">
      <dt>{strings.items_catalog.field_kit_contents}</dt>
      <dd>
        <ul class="kit-list">
          {#each item.kit_contents as c (c.id)}
            <li>
              <span>{c.display_name}</span>
              <span class="kit-count ltr-number">× {c.default_count}</span>
            </li>
          {/each}
        </ul>
      </dd>
    </div>
  {/if}
  {#if item.notes}
    <div class="field wide">
      <dt>{strings.items_catalog.field_notes}</dt>
      <dd>{item.notes}</dd>
    </div>
  {/if}
</dl>

<p class="source-note">
  {strings.items_catalog.source_note} <span class="ltr-number">seed/</span>
</p>

<style>
  .source-note {
    margin-block-start: var(--space-4);
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
    padding-block-end: var(--space-3);
  }

  :global(html[dir='rtl']) .back :global(svg) {
    transform: scaleX(-1);
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-block: var(--space-2);
    border-block-end: 1px solid var(--color-border);
    margin-block-end: var(--space-4);
  }

  h2 {
    font-size: var(--fs-title);
    font-weight: 700;
  }

  .id {
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }

  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .field.wide {
    grid-column: 1 / -1;
  }

  dt {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  dd {
    font-size: var(--fs-body);
  }

  .kit-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .kit-list li {
    display: flex;
    justify-content: space-between;
    padding: var(--space-1) var(--space-2);
    background: var(--color-bg);
    border-radius: var(--radius-sm);
  }

  .kit-count {
    color: var(--color-text-muted);
  }
</style>
