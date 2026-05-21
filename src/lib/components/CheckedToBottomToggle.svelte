<script lang="ts">
  import strings from '$lib/strings.js';

  interface Props {
    checked: boolean;
    onChange: (next: boolean) => void;
  }

  let { checked, onChange }: Props = $props();
</script>

<label class="toggle">
  <input type="checkbox" {checked} onchange={() => onChange(!checked)} />
  <span>{strings.view.checked_to_bottom}</span>
</label>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
    cursor: pointer;
    user-select: none;
  }

  input {
    accent-color: var(--color-primary);
  }
</style>
